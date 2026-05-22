import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listOpenBoxes } from '../streakApi.js';
import { StreakRateLimited } from '../types.js';

const OLD_ENV = process.env;

describe('listOpenBoxes', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV, STREAK_API_KEY: 'streak-key' };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns filtered StreakBox array with Gmail thread IDs resolved via per-box call', async () => {
    mockFetchJson([
      // v1 stages — only "open-stage" is open per heuristic
      [
        { key: 'open-stage', name: 'New' },
        { key: 'closed-stage', name: 'Closed Won' },
      ],
      // v2 boxes for open-stage only (closed-stage is skipped client-side)
      pageResponse([box({ key: 'box-1', stageKey: 'open-stage' })]),
      // v1 /boxes/box-1/threads — resolve gmail thread IDs
      [{ threadGmailId: 'thread-aaa' }, { threadGmailId: 'thread-bbb' }],
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });
    expect(boxes).toEqual([
      {
        key: 'box-1',
        name: 'Box box-1',
        stageKey: 'open-stage',
        stageName: 'New',
        lastUpdatedTimestamp: 1000,
        lastEmailReceivedTimestamp: 1000,
        assignedToSharingEntries: [{ email: 'owner@example.com' }],
        gmailThreadIds: ['thread-aaa', 'thread-bbb'],
        subject: 'Box box-1', // falls back to name when no real subject
      },
    ]);

    // v1 stages call first
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://www.streak.com/api/v1/pipelines/pipe-key/stages',
      { method: 'GET', headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    // v2 boxes call for the open stage
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.streak.com/api/v2/pipelines/pipe-key/boxes?stageKey=open-stage&limit=200&offset=0',
      { method: 'GET', headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    // v1 threads call per box to resolve Gmail thread IDs (v2 boxes don't include them)
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://www.streak.com/api/v1/boxes/box-1/threads',
      { method: 'GET', headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
  });

  it('throws StreakRateLimited on 429 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '2' } }));

    await expect(listOpenBoxes({ pipelineKey: 'pipe-key' })).rejects.toMatchObject(
      new StreakRateLimited(2000),
    );
  });

  it('throws Error on 5xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 503 }));

    await expect(listOpenBoxes({ pipelineKey: 'pipe-key' })).rejects.toThrow('Streak API request failed with 503');
  });

  it('filters explicit csv stage keys from STREAK_CLOSED_STAGE_KEYS', async () => {
    process.env.STREAK_CLOSED_STAGE_KEYS = 'closed-a, closed-b';
    mockFetchJson([
      [
        { key: 'closed-a', name: 'Qualifying' },
        { key: 'open-stage', name: 'Completed intake' },
      ],
      pageResponse([box({ key: 'box-2', stageKey: 'open-stage' })]),
      [{ threadGmailId: 'thread-xyz' }],
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes.map((item) => item.key)).toEqual(['box-2']);
    expect(boxes[0].gmailThreadIds).toEqual(['thread-xyz']);
  });

  it('uses heuristic name-pattern filtering when env is not set', async () => {
    mockFetchJson([
      [
        { key: 'done-stage', name: 'Done - archived' },
        { key: 'open-stage', name: 'Qualifying' },
      ],
      pageResponse([box({ key: 'box-2', stageKey: 'open-stage' })]),
      [{ threadGmailId: 'thread-xyz' }],
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes.map((item) => item.key)).toEqual(['box-2']);
  });

  it('fetches first page per open stage in parallel, merges, sorts by recency, slices maxBoxes', async () => {
    const stages = [
      { key: 'stage-a', name: 'New' },
      { key: 'stage-b', name: 'Qualifying' },
    ];
    const stageA = [
      box({ key: 'old-a', stageKey: 'stage-a', lastEmailReceivedTimestamp: 1000 }),
      box({ key: 'mid-a', stageKey: 'stage-a', lastEmailReceivedTimestamp: 3000 }),
    ];
    const stageB = [
      box({ key: 'new-b', stageKey: 'stage-b', lastEmailReceivedTimestamp: 5000 }),
      box({ key: 'mid-b', stageKey: 'stage-b', lastEmailReceivedTimestamp: 2000 }),
    ];

    mockFetchJson([
      stages,
      // Parallel stage fetches resolve in registration order under the mock —
      // both pages return single-page (no pagination) per new contract.
      pageResponse(stageA, false),
      pageResponse(stageB, false),
      // Thread-id lookups: one per merged box. Order of these is the
      // post-sort order: [new-b(5000), mid-a(3000), mid-b(2000), old-a(1000)].
      [{ threadGmailId: 't-new-b' }],
      [{ threadGmailId: 't-mid-a' }],
      [{ threadGmailId: 't-mid-b' }],
      [{ threadGmailId: 't-old-a' }],
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key', maxBoxes: 1000 });

    expect(boxes.map((b) => b.key)).toEqual(['new-b', 'mid-a', 'mid-b', 'old-a']);
    // 1 stages + 2 per-stage boxes pages + 4 thread-lookups = 7 fetches
    expect(vi.mocked(fetch).mock.calls).toHaveLength(7);
    expect((vi.mocked(fetch).mock.calls[1][0] as string)).toContain('stageKey=stage-a');
    expect((vi.mocked(fetch).mock.calls[2][0] as string)).toContain('stageKey=stage-b');
  });

  it('caps merged result to maxBoxes after sorting by recency', async () => {
    const stages = [{ key: 'stage-x', name: 'New' }];
    const records = [
      box({ key: 'a', stageKey: 'stage-x', lastEmailReceivedTimestamp: 1 }),
      box({ key: 'b', stageKey: 'stage-x', lastEmailReceivedTimestamp: 5 }),
      box({ key: 'c', stageKey: 'stage-x', lastEmailReceivedTimestamp: 3 }),
      box({ key: 'd', stageKey: 'stage-x', lastEmailReceivedTimestamp: 9 }),
    ];

    mockFetchJson([
      stages,
      pageResponse(records, false),
      // Top 2 by recency: d(9), b(5) — only these get thread lookups
      [{ threadGmailId: 't-d' }],
      [{ threadGmailId: 't-b' }],
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key', maxBoxes: 2 });

    expect(boxes.map((b) => b.key)).toEqual(['d', 'b']);
  });
});

function box(input: { key: string; stageKey: string; lastEmailReceivedTimestamp?: number }) {
  return {
    key: input.key,
    name: `Box ${input.key}`,
    stageKey: input.stageKey,
    lastUpdatedTimestamp: 1000,
    lastEmailReceivedTimestamp: input.lastEmailReceivedTimestamp ?? 1000,
    assignedToSharingEntries: [{ email: 'owner@example.com' }],
  };
}

function pageResponse(results: unknown[], hasNextPage = false) {
  return { results, hasNextPage };
}

function mockFetchJson(payloads: unknown[]): void {
  for (const payload of payloads) {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
  }
}
