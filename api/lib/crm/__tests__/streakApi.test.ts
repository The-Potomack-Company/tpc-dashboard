import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listOpenBoxes } from '../streakApi';
import { StreakRateLimited } from '../types';

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
    mockFetchJson([
      [
        { key: 'open-stage', name: 'New' },
        { key: 'closed-stage', name: 'Closed Won' },
      ],
      [
        box({ key: 'box-1', stageKey: 'open-stage' }),
        box({ key: 'box-2', stageKey: 'closed-stage' }),
      ],
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

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://www.streak.com/api/v1/pipelines/pipe-key/stages',
      { headers: { Authorization: `Basic ${Buffer.from('streak-key:').toString('base64')}` } },
    );
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
      [
        box({ key: 'box-1', stageKey: 'closed-a' }),
        box({ key: 'box-2', stageKey: 'open-stage' }),
      ],
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
      [
        box({ key: 'box-1', stageKey: 'done-stage' }),
        box({ key: 'box-2', stageKey: 'open-stage' }),
      ],
    ]);

    const boxes = await listOpenBoxes({ pipelineKey: 'pipe-key' });

    expect(boxes.map((item) => item.key)).toEqual(['box-2']);
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

function mockFetchJson(payloads: unknown[]): void {
  for (const payload of payloads) {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
  }
}
