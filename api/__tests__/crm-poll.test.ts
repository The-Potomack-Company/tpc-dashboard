import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../crm-poll';
import { ClassifierBudgetExceeded, StreakRateLimited, type ClassifierOutput, type StreakBox } from '../lib/crm/types';

const serviceMocks = vi.hoisted(() => ({
  listOpenBoxes: vi.fn(),
  getThreadBody: vi.fn(),
  getThreadContent: vi.fn(),
  classify: vi.fn(),
  resetClassifierInvocationBudget: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: serviceMocks.createClient,
}));

vi.mock('../lib/crm/streakApi', () => ({
  listOpenBoxes: serviceMocks.listOpenBoxes,
}));

vi.mock('../lib/crm/gmailApi', () => ({
  getThreadBody: serviceMocks.getThreadBody,
  getThreadContent: serviceMocks.getThreadContent,
}));

vi.mock('../lib/crm/crmClassifier', () => ({
  classify: serviceMocks.classify,
  resetClassifierInvocationBudget: serviceMocks.resetClassifierInvocationBudget,
}));

const OLD_ENV = process.env;

describe('api/crm-poll', () => {
  let supabase: MockSupabase;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
    process.env = {
      ...OLD_ENV,
      STREAK_API_KEY: 'streak-key',
      STREAK_PIPELINE_KEY: 'pipeline-key',
      GEMINI_API_KEY: 'gemini-key',
      GMAIL_OAUTH_CLIENT_ID: 'gmail-client',
      GMAIL_OAUTH_CLIENT_SECRET: 'gmail-secret',
      GMAIL_REFRESH_TOKEN: 'gmail-refresh',
      GMAIL_USER_EMAIL: 'consign@example.com',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };
    vi.clearAllMocks();
    supabase = new MockSupabase();
    serviceMocks.createClient.mockReturnValue(supabase.client);
    serviceMocks.getThreadBody.mockResolvedValue('Fresh consignment body.');
    serviceMocks.getThreadContent.mockResolvedValue({
      text: 'Fresh consignment body.',
      images: [],
      messages: [
        {
          messageId: 'msg-0',
          from: { name: 'Sender', email: 'sender@example.com' },
          date: new Date('2026-05-18T12:00:00.000Z'),
          snippet: 'Earlier snippet',
          bodyText: 'Earlier consignment context.',
          hasAttachments: false,
          isForward: false,
        },
        {
          messageId: 'msg-1',
          from: { name: 'Sender', email: 'sender@example.com' },
          date: new Date('2026-05-20T12:00:00.000Z'),
          snippet: 'Snippet',
          bodyText: 'Fresh consignment body.',
          hasAttachments: false,
          isForward: false,
        },
      ],
    });
    serviceMocks.classify.mockResolvedValue(classification());
    serviceMocks.listOpenBoxes.mockResolvedValue([box('box-1')]);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects non-admin callers with 403', async () => {
    supabase.profile = { role: 'specialist', is_active: true };

    const res = await postPoll();

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required' });
    expect(serviceMocks.listOpenBoxes).not.toHaveBeenCalled();
  });

  it('returns 500 naming missing env vars', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await postPoll();

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Missing required env var: GEMINI_API_KEY' });
  });

  it('handles an empty Streak response cleanly', async () => {
    serviceMocks.listOpenBoxes.mockResolvedValue([]);

    const res = await postPoll();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ polled: 0, classified: 0, skipped_unchanged: 0, deferred: [] });
    expect(serviceMocks.classify).not.toHaveBeenCalled();
  });

  it('skips classification when the body hash is unchanged on re-poll', async () => {
    await postPoll();
    serviceMocks.classify.mockClear();

    const res = await postPoll();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ polled: 1, classified: 0, skipped_unchanged: 1 });
    expect(serviceMocks.classify).not.toHaveBeenCalled();
  });

  it('stops at the classifier budget cap and reports deferred boxes', async () => {
    const boxes = Array.from({ length: 205 }, (_, index) => box(`box-${index}`));
    serviceMocks.listOpenBoxes.mockResolvedValue(boxes);
    serviceMocks.classify.mockImplementation(async () => {
      if (serviceMocks.classify.mock.calls.length > 200) {
        throw new ClassifierBudgetExceeded(201);
      }

      return classification();
    });

    const res = await postPoll();
    const body = res.body as { classified: number; deferred: string[] };

    expect(res.statusCode).toBe(200);
    expect(body.classified).toBe(200);
    expect(body.deferred).toHaveLength(5);
    expect(body.deferred[0]).toBe('box-200');
  });

  it('writes private.api_usage for classifier calls', async () => {
    serviceMocks.classify.mockResolvedValue(
      classification({ usage: { inputTokens: 11, outputTokens: 7, costUsd: 0.0012 } }),
    );

    const res = await postPoll();

    expect(res.statusCode).toBe(200);
    expect(supabase.privateApiUsageInserts).toEqual([
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        tokens_in: 11,
        tokens_out: 7,
        cost_usd: 0.0012,
        app_source: 'tpc-dashboard-crm-poll',
        status: 'ok',
      }),
    ]);
  });

  it('passes last-message context from structured Gmail messages into classify', async () => {
    const res = await postPoll();

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.classify).toHaveBeenCalledWith(
      expect.objectContaining({
        lastMessageBody: 'Fresh consignment body.',
        lastMessageDate: '2026-05-20T12:00:00.000Z',
        daysSinceLastMessage: 1,
        threadAgeDays: 3,
      }),
    );
  });

  it('returns 503 when Streak is rate-limited', async () => {
    serviceMocks.listOpenBoxes.mockRejectedValue(new StreakRateLimited(3000));

    const res = await postPoll();

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Streak API rate limit exceeded', retry_after_ms: 3000 });
  });
});

async function postPoll() {
  const res = createResponse();
  await handler({ method: 'POST', headers: { authorization: 'Bearer test-token' } }, res);
  return res;
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
}

function box(key: string): StreakBox {
  return {
    key,
    name: `Lead ${key}`,
    stageKey: 'new',
    stageName: 'New',
    lastUpdatedTimestamp: Date.parse('2026-05-20T12:00:00-04:00'),
    lastEmailReceivedTimestamp: Date.parse('2026-05-20T12:00:00-04:00'),
    gmailThreadIds: [`gmail-${key}`],
    subject: `Subject ${key}`,
    fromEmail: 'sender@example.com',
    fromName: 'Sender',
    snippet: 'Snippet',
  };
}

function classification(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    department: ['decarts'],
    priority: 'standard',
    rationale: 'Mock rationale.',
    model: 'gemini-2.5-flash',
    ...overrides,
  };
}

class MockSupabase {
  profile = { role: 'admin', is_active: true };
  threads = new Map<string, { id: string }>();
  currentClassifications = new Map<string, { metadata: { body_hash: string; prompt_version?: string } }>();
  privateApiUsageInserts: Record<string, unknown>[] = [];

  client = {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token !== 'test-token') {
          return { data: { user: null }, error: { message: 'bad token' } };
        }

        return { data: { user: { id: 'user-1' } }, error: null };
      }),
    },
    from: (table: string) => new MockBuilder(this, table),
    schema: (schema: string) => ({
      from: (table: string) => new MockBuilder(this, table, schema),
    }),
  };
}

class MockBuilder {
  private filters = new Map<string, unknown>();
  private pendingInsert: Record<string, unknown> | null = null;
  private pendingUpdate: Record<string, unknown> | null = null;
  private pendingUpsert: Record<string, unknown> | null = null;
  private readonly db: MockSupabase;
  private readonly table: string;
  private readonly schema: string;

  constructor(db: MockSupabase, table: string, schema = 'public') {
    this.db = db;
    this.table = table;
    this.schema = schema;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  upsert(value: Record<string, unknown>) {
    this.pendingUpsert = value;
    return this;
  }

  update(value: Record<string, unknown>) {
    this.pendingUpdate = value;
    return this;
  }

  insert(value: Record<string, unknown>) {
    this.pendingInsert = value;
    return this;
  }

  async single() {
    if (this.table === 'profiles') {
      return { data: this.db.profile, error: null };
    }

    if (this.table === 'crm_threads' && this.pendingUpsert) {
      const key = String(this.pendingUpsert.streak_box_key);
      const existing = this.db.threads.get(key) ?? { id: `thread-${this.db.threads.size + 1}` };
      this.db.threads.set(key, existing);
      return { data: existing, error: null };
    }

    return { data: null, error: null };
  }

  async maybeSingle() {
    if (this.table === 'crm_classifications') {
      return { data: this.db.currentClassifications.get(String(this.filters.get('thread_id'))) ?? null, error: null };
    }

    return { data: null, error: null };
  }

  then(resolve: (value: { error: null }) => void) {
    if (this.schema === 'private' && this.table === 'api_usage' && this.pendingInsert) {
      this.db.privateApiUsageInserts.push(this.pendingInsert);
    }

    if (this.table === 'crm_classifications' && this.pendingInsert) {
      this.db.currentClassifications.set(String(this.pendingInsert.thread_id), {
        metadata: this.pendingInsert.metadata as { body_hash: string },
      });
    }

    if (this.table === 'crm_classifications' && this.pendingUpdate) {
      this.db.currentClassifications.delete(String(this.filters.get('thread_id')));
    }

    resolve({ error: null });
  }
}
