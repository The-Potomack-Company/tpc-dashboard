import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { classify, resetClassifierInvocationBudget } from './lib/crm/crmClassifier.js';
import { getThreadContent } from './lib/crm/gmailApi.js';
import { listOpenBoxes } from './lib/crm/streakApi.js';
import { ClassifierBudgetExceeded, StreakRateLimited, type ClassifierOutput, type StreakBox } from './lib/crm/types.js';

export const maxDuration = 60;

const APP_SOURCE = 'tpc-dashboard-crm-poll';
// Bump on prompt/contract changes to cache-bust existing classifications.
// v0.5.1: evidence-first rationale + multimodal photos + dropped VIP/deadline overrides.
const PROMPT_VERSION = 'v0.5.1';
const REQUIRED_ENV = [
  'STREAK_API_KEY',
  'STREAK_PIPELINE_KEY',
  'GEMINI_API_KEY',
  'GMAIL_OAUTH_CLIENT_ID',
  'GMAIL_OAUTH_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_USER_EMAIL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

type PollResponse = {
  polled: number;
  classified: number;
  skipped_unchanged: number;
  deferred: string[];
  errors: Array<{ box_key: string; message: string }>;
};

type ThreadRow = {
  id: string;
};

type ClassificationRow = {
  thread_id?: string;
  is_current?: boolean;
  metadata?: unknown;
};

type ApiDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: string; is_active: boolean };
        Insert: { id?: string; role?: string; is_active?: boolean };
        Update: { id?: string; role?: string; is_active?: boolean };
        Relationships: [];
      };
      crm_threads: {
        Row: ThreadRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      crm_classifications: {
        Row: ClassificationRow;
        Insert: Record<string, unknown>;
        Update: { is_current?: boolean };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  private: {
    Tables: {
      api_usage: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AdminClient = SupabaseClient<ApiDatabase>;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    return await handleRequest(req, res);
  } catch (error) {
    console.error('[crm-poll] unhandled error:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: `Internal error: ${message}`,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function handleRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const missingEnv = REQUIRED_ENV.find((key) => !process.env[key]);
  if (missingEnv) {
    res.status(500).json({ error: `Missing required env var: ${missingEnv}` });
    return;
  }

  const admin = createClient<ApiDatabase>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const authToken = readBearerToken(req.headers.authorization);
  if (!authToken) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(authToken);
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid Authorization bearer token' });
    return;
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .single();
  if (profileError) {
    res.status(403).json({ error: 'Profile not authorized' });
    return;
  }

  if (profile?.role !== 'admin' || profile.is_active !== true) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  resetClassifierInvocationBudget();

  let boxes: StreakBox[];
  try {
    boxes = await listOpenBoxes({
      apiKey: process.env.STREAK_API_KEY!,
      pipelineKey: process.env.STREAK_PIPELINE_KEY!,
      closedStageKeys: parseCsv(process.env.STREAK_CLOSED_STAGE_KEYS),
      maxBoxes: process.env.STREAK_MAX_BOXES_PER_POLL
        ? Number(process.env.STREAK_MAX_BOXES_PER_POLL)
        : undefined,
    });
  } catch (error) {
    if (error instanceof StreakRateLimited) {
      res.status(503).json({
        error: error.message,
        retry_after_ms: error.retryAfterMs,
      });
      return;
    }

    throw error;
  }

  const response: PollResponse = {
    polled: 0,
    classified: 0,
    skipped_unchanged: 0,
    deferred: [],
    errors: [],
  };

  // Process boxes in parallel batches so we stay inside the 60s function
  // budget. Serial loop was timing out at ~8 boxes; concurrency 5 fits 10+
  // boxes (gmail+LLM+supabase per box) comfortably.
  const CONCURRENCY = Number(process.env.CRM_POLL_CONCURRENCY) || 5;
  const userId = user.id; // capture for use inside processBox closure (TS narrowing doesn't cross closures)
  let budgetExceeded = false;

  type BoxOutcome =
    | { kind: 'classified' }
    | { kind: 'skipped' }
    | { kind: 'error'; message: string }
    | { kind: 'deferred-budget' };

  async function processBox(box: StreakBox): Promise<BoxOutcome> {
    const gmailThreadId = box.gmailThreadIds?.[0];
    if (!gmailThreadId) {
      return { kind: 'error', message: 'No Gmail thread id found on Streak box' };
    }

    const content = await getThreadContent(gmailThreadId);
    const bodyHash = hashContent(content.text, content.images);
    const thread = await upsertThread(admin, box, gmailThreadId, content.text, content.messages ?? []);
    response.polled += 1;

    const latest = await getLatestClassification(admin, thread.id);
    if (
      readBodyHash(latest?.metadata) === bodyHash &&
      readPromptVersion(latest?.metadata) === PROMPT_VERSION
    ) {
      return { kind: 'skipped' };
    }

    const startedAt = Date.now();
    let output: ClassifierOutput;
    try {
      output = await classify({
        boxKey: box.key,
        boxName: box.name,
        stageKey: box.stageKey,
        stageName: box.stageName,
        gmailBody: content.text,
        gmailImages: content.images,
        senderEmail: box.fromEmail,
        lastUpdatedMs: box.lastUpdatedTimestamp,
      });
    } catch (error) {
      if (error instanceof ClassifierBudgetExceeded) {
        return { kind: 'deferred-budget' };
      }

      // D-015 audit log is load-bearing — must await so the insert lands
      // before processBox exits (Vercel may terminate the function once the
      // response resolves, abandoning unawaited promises). One Supabase RTT
      // per box is negligible against classify()'s 2-5s Gemini round-trip
      // which dominates per-box latency (see Codex B1, 2026-05-21).
      await logUsage(admin, {
        model: 'gemini-2.5-flash',
        userId: userId,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown classifier error',
      });
      throw error;
    }

    await replaceCurrentClassification(admin, thread.id, output, bodyHash);
    await logUsage(admin, {
      model: output.model,
      userId: userId,
      durationMs: Date.now() - startedAt,
      status: 'ok',
      tokensIn: output.usage?.inputTokens,
      tokensOut: output.usage?.outputTokens,
      costUsd: output.usage?.costUsd,
    });
    return { kind: 'classified' };
  }

  for (let i = 0; i < boxes.length && !budgetExceeded; i += CONCURRENCY) {
    const batch = boxes.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((b) => processBox(b)));
    for (let j = 0; j < settled.length; j += 1) {
      const box = batch[j];
      const result = settled[j];
      if (result.status === 'rejected') {
        response.errors.push({
          box_key: box.key,
          message: result.reason instanceof Error ? result.reason.message : 'Unknown CRM poll error',
        });
        continue;
      }
      const outcome = result.value;
      if (outcome.kind === 'classified') {
        response.classified += 1;
      } else if (outcome.kind === 'skipped') {
        response.skipped_unchanged += 1;
      } else if (outcome.kind === 'error') {
        response.errors.push({ box_key: box.key, message: outcome.message });
      } else if (outcome.kind === 'deferred-budget') {
        budgetExceeded = true;
        response.deferred.push(...boxes.slice(i + j).map((d) => d.key));
        break;
      }
    }
  }

  console.error('[crm-debug] response →', JSON.stringify({
    polled: response.polled,
    classified: response.classified,
    skipped_unchanged: response.skipped_unchanged,
    deferred_count: response.deferred.length,
    errors_count: response.errors.length,
    sample_errors: response.errors.slice(0, 5),
  }));
  res.status(200).json(response);
}

async function upsertThread(
  admin: AdminClient,
  box: StreakBox,
  gmailThreadId: string,
  bodyText: string,
  messages: ReadonlyArray<{
    messageId: string;
    from: { name: string; email: string };
    date: Date;
    snippet: string;
    bodyText: string;
    hasAttachments: boolean;
    isForward: boolean;
  }>,
): Promise<ThreadRow> {
  // received_at represents "last actual consignor email", not Streak's
  // last-touch (stage changes / comments shouldn't reset the age clock).
  // Fall back to lastUpdatedTimestamp if Streak didn't track the email yet.
  const receivedMs = box.lastEmailReceivedTimestamp > 0
    ? box.lastEmailReceivedTimestamp
    : box.lastUpdatedTimestamp;
  const receivedAt = receivedMs > 0 ? new Date(receivedMs).toISOString() : null;
  const serializedMessages = [...messages]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((message) => ({
      messageId: message.messageId,
      from: message.from,
      date: message.date.toISOString(),
      snippet: message.snippet,
      bodyText: message.bodyText,
      hasAttachments: message.hasAttachments,
      isForward: message.isForward,
    }));
  const { data, error } = await admin
    .from('crm_threads')
    .upsert(
      {
        streak_box_key: box.key,
        streak_pipeline_key: process.env.STREAK_PIPELINE_KEY!,
        streak_stage_key: box.stageKey || null,
        streak_stage_name: box.stageName || null,
        gmail_thread_id: gmailThreadId,
        subject: box.subject || box.name || null,
        from_email: box.fromEmail || null,
        from_name: box.fromName || null,
        received_at: receivedAt,
        snippet: box.snippet || null,
        body_text: bodyText,
        messages: serializedMessages,
        body_source: 'gmail',
        last_polled_at: new Date().toISOString(),
      },
      { onConflict: 'streak_box_key' },
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to upsert crm_threads: ${error.message}`);
  }

  return data as ThreadRow;
}

async function getLatestClassification(
  admin: AdminClient,
  threadId: string,
): Promise<ClassificationRow | null> {
  const { data, error } = await admin
    .from('crm_classifications')
    .select('metadata')
    .eq('thread_id', threadId)
    .order('classified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read crm_classifications: ${error.message}`);
  }

  return data as ClassificationRow | null;
}

async function replaceCurrentClassification(
  admin: AdminClient,
  threadId: string,
  output: ClassifierOutput,
  bodyHash: string,
): Promise<void> {
  const updateResult = await admin
    .from('crm_classifications')
    .update({ is_current: false })
    .eq('thread_id', threadId)
    .eq('is_current', true);
  if (updateResult.error) {
    throw new Error(`Failed to retire current crm_classifications row: ${updateResult.error.message}`);
  }

  const insertResult = await admin.from('crm_classifications').insert({
    thread_id: threadId,
    department: output.department,
    priority: output.priority,
    rationale: output.rationale,
    model: output.model,
    prompt_version: PROMPT_VERSION,
    is_current: true,
    metadata: {
      body_hash: bodyHash,
      prompt_version: PROMPT_VERSION,
      needs_review: output.needsReview === true,
    },
  });
  if (insertResult.error) {
    throw new Error(`Failed to insert crm_classifications row: ${insertResult.error.message}`);
  }
}

async function logUsage(
  admin: AdminClient,
  input: {
    model: string;
    userId: string;
    durationMs: number;
    status: 'ok' | 'error' | 'rate_limited';
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    errorMessage?: string;
  },
): Promise<void> {
  const { error } = await admin.schema('private').from('api_usage').insert({
    user_id: input.userId,
    model: input.model,
    provider: 'gemini',
    tokens_in: input.tokensIn ?? null,
    tokens_out: input.tokensOut ?? null,
    cost_usd: input.costUsd ?? null,
    app_source: APP_SOURCE,
    duration_ms: input.durationMs,
    status: input.status,
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`Failed to insert private.api_usage row: ${error.message}`);
  }
}

function readBearerToken(value: string | string[] | undefined): string | null {
  const header = Array.isArray(value) ? value[0] : value;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function hashContent(bodyText: string, images: ReadonlyArray<{ data: string }>): string {
  const hash = crypto.createHash('sha256');
  hash.update(bodyText);
  // Image data is content-addressable (base64 of bytes), so hashing it cache-
  // busts when attachments change while leaving pure-text threads stable.
  for (const img of images) {
    hash.update('\x00');
    hash.update(img.data);
  }
  return hash.digest('hex');
}

function readBodyHash(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || !('body_hash' in metadata)) {
    return null;
  }

  const value = (metadata as { body_hash?: unknown }).body_hash;
  return typeof value === 'string' ? value : null;
}

function readPromptVersion(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || !('prompt_version' in metadata)) {
    return null;
  }

  const value = (metadata as { prompt_version?: unknown }).prompt_version;
  return typeof value === 'string' ? value : null;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
