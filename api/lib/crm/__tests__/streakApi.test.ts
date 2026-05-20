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

  it('returns filtered StreakBox array for open stages only', async () => {
    // stages (v1) → only "open-stage" is open per heuristic; "closed-stage" name matches pattern
    mockFetchJson([
      [
        { key: 'open-stage', name: 'New' },
        { key: 'closed-stage', name: 'Closed Won' },
      ],
      // v2 boxes for open-stage only (closed-stage is skipped client-side)
      pageResponse([box({ key: 'box-1', stageKey: 'open-stage' })]),
    ]);

    await expect(listOpenBoxes({ pipelineKey: 'pipe-key' })).resolves.toEqual([
      {
        key: 'box-1',
        name: 'Box box-1',
        stageKey: 'open-stage',
        stageName: 'New',
        lastUpdatedTimestamp: 1000,
        assignedToSharingEntries: [{ email: 'owner@example.com' }],
      },
    ]);

    // v1 stages call first
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://www.streak.com/api/v1/pipelines/pipe-key/stages',
      { headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    // v2 boxes call only for the open stage (no call for the closed-stage)
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.streak.com/api/v2/pipelines/pipe-key/boxes?stageKey=open-stage&limit=200&offset=0',
      { headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
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
      // Only "open-stage" should be iterated (closed-a is in the blocklist)
      pageResponse([box({ key: 'box-2', stageKey: 'open-stage' })]),
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes.map((item) => item.key)).toEqual(['box-2']);
  });

  it('uses heuristic name-pattern filtering when env is not set', async () => {
    mockFetchJson([
      [
        { key: 'done-stage', name: 'Done - archived' },
        { key: 'open-stage', name: 'Qualifying' },
      ],
      pageResponse([box({ key: 'box-2', stageKey: 'open-stage' })]),
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes.map((item) => item.key)).toEqual(['box-2']);
  });

  it('paginates v2 boxes endpoint via offset until hasNextPage is false', async () => {
    mockFetchJson([
      [{ key: 'open-stage', name: 'New' }],
      // page 1 — 200 results, hasNextPage true
      pageResponse(
        Array.from({ length: 200 }, (_, i) => box({ key: `box-${i}`, stageKey: 'open-stage' })),
        true,
      ),
      // page 2 — 50 results, hasNextPage false
      pageResponse(
        Array.from({ length: 50 }, (_, i) => box({ key: `box-${200 + i}`, stageKey: 'open-stage' })),
        false,
      ),
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes).toHaveLength(250);
    expect(boxes[0].key).toBe('box-0');
    expect(boxes[249].key).toBe('box-249');
    // two box-pagination calls plus the initial stages call = 3 fetches total
    expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
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
