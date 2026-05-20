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
        assignedToSharingEntries: [{ email: 'owner@example.com' }],
        gmailThreadIds: ['thread-aaa', 'thread-bbb'],
        subject: 'Box box-1', // falls back to name when no real subject
      },
    ]);

    // v1 stages call first
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://www.streak.com/api/v1/pipelines/pipe-key/stages',
      { headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    // v2 boxes call for the open stage
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.streak.com/api/v2/pipelines/pipe-key/boxes?stageKey=open-stage&limit=200&offset=0',
      { headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    // v1 threads call per box to resolve Gmail thread IDs (v2 boxes don't include them)
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://www.streak.com/api/v1/boxes/box-1/threads',
      { headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
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

  it('paginates v2 boxes endpoint via offset until hasNextPage is false', async () => {
    const stages = [{ key: 'open-stage', name: 'New' }];
    const page1 = Array.from({ length: 200 }, (_, i) => box({ key: `box-${i}`, stageKey: 'open-stage' }));
    const page2 = Array.from({ length: 50 }, (_, i) => box({ key: `box-${200 + i}`, stageKey: 'open-stage' }));
    const allBoxes = [...page1, ...page2];

    mockFetchJson([
      stages,
      pageResponse(page1, true),
      pageResponse(page2, false),
      // 250 threads-lookup calls — one per box
      ...allBoxes.map(() => [{ threadGmailId: 'thread-x' }]),
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes).toHaveLength(250);
    expect(boxes[0].key).toBe('box-0');
    expect(boxes[249].key).toBe('box-249');
    // 1 stages + 2 box-pages + 250 thread-lookups = 253 fetches
    expect(vi.mocked(fetch).mock.calls).toHaveLength(253);
    const secondBoxesCall = vi.mocked(fetch).mock.calls[2][0] as string;
    expect(secondBoxesCall).toContain('offset=200');
  });
});

function box(input: { key: string; stageKey: string }) {
  return {
    key: input.key,
    name: `Box ${input.key}`,
    stageKey: input.stageKey,
    lastUpdatedTimestamp: 1000,
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
