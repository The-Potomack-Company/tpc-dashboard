import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / Plan 03-03 / Task 1 — services/activity/queries.test.ts
//
// Mocks the supabase module so each .from()/.rpc() chain is observable.
// Asserts:
//   - D-19 (fetchActiveSpecialists filters profiles by is_active=true AND role='specialist')
//   - D-33 (fetchUiRecentEvents .eq('app_source','tpc-app'))
//   - D-34 (fetchUiTopPages / fetchUiTopElements do NOT pass p_specialists or p_mode)
//   - D-32 (fetchWalkthroughFunnel takes no args)
//   - D-16 (fetchItemsPerSpecialist14d does NOT pass p_from / p_to)
//   - D-17 (range-driven RPCs pass ISO from/to)
//   - Pitfall 7 (empty arrays passed verbatim — no filter)

interface ChainMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  __resolve: { data: unknown; error: unknown };
  then: (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
  ) => Promise<unknown>;
}

function makeChain(resolve: { data: unknown; error: unknown }): ChainMock {
  const chain: Partial<ChainMock> = { __resolve: resolve };
  const ret = () => chain as ChainMock;
  chain.select = vi.fn(ret);
  chain.eq = vi.fn(ret);
  chain.not = vi.fn(ret);
  chain.in = vi.fn(ret);
  chain.gte = vi.fn(ret);
  chain.lte = vi.fn(ret);
  chain.order = vi.fn(ret);
  chain.limit = vi.fn(ret);
  chain.then = (onFulfilled) => Promise.resolve(onFulfilled(resolve));
  return chain as ChainMock;
}

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import {
  fetchTodayKpis,
  fetchActiveSessions,
  fetchActiveSpecialists,
  fetchItemsPerSpecialist14d,
  fetchAiStatusDistribution,
  fetchExportPipeline,
  fetchHouseSaleSplit,
  fetchStuckItems,
  fetchSessionDetail,
  fetchPhotoCoverage,
  fetchFailedAiBreakdown,
  fetchUiTopPages,
  fetchUiTopElements,
  fetchWalkthroughFunnel,
  fetchUiRecentEvents,
  fetchSessionItems,
  fetchSessionPhotos,
} from './queries';

const FROM = new Date('2026-04-30T00:00:00.000Z');
const TO = new Date('2026-04-30T23:59:59.999Z');

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe('fetchTodayKpis', () => {
  it('calls get_today_kpis with empty arrays + mode=all', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          sessions_today: 0,
          items_today: 0,
          exports_today: 0,
          items_done_today: 0,
          items_total_today: 0,
          sessions_yday: 0,
          items_yday: 0,
          exports_yday: 0,
          items_done_yday: 0,
          items_total_yday: 0,
        },
      ],
      error: null,
    });
    const row = await fetchTodayKpis({ specialists: [], mode: 'all', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith('get_today_kpis', {
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
    expect(row.sessions_today).toBe(0);
  });

  it('returns the default zero row when supabase yields []', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const row = await fetchTodayKpis({ specialists: [], mode: 'all', includeDev: false });
    expect(row.sessions_today).toBe(0);
    expect(row.items_today).toBe(0);
  });

  it('throws on supabase error', async () => {
    const err = { message: 'kpi fail' };
    rpcMock.mockResolvedValueOnce({ data: null, error: err });
    await expect(
      fetchTodayKpis({ specialists: [], mode: 'all', includeDev: false }),
    ).rejects.toBe(err);
  });
});

describe('fetchActiveSessions', () => {
  it('passes specialists + mode to get_active_sessions', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchActiveSessions({ specialists: ['a@x.com'], mode: 'house', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith('get_active_sessions', {
      p_specialists: ['a@x.com'],
      p_mode: 'house',
      p_include_dev: false,
    });
  });
});

describe('fetchItemsPerSpecialist14d (D-16 fixed-window)', () => {
  it('does NOT pass p_from or p_to (server computes the 14-day window)', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchItemsPerSpecialist14d({ specialists: [], mode: 'all' });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const callArg = rpcMock.mock.calls[0][1];
    expect(callArg).not.toHaveProperty('p_from');
    expect(callArg).not.toHaveProperty('p_to');
    expect(callArg).toEqual({ p_specialists: [], p_mode: 'all' });
  });
});

describe('fetchAiStatusDistribution (D-17 range-driven)', () => {
  it('passes ISO from/to + specialists + mode', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchAiStatusDistribution({
      from: FROM,
      to: TO,
      specialists: ['a@x.com'],
      mode: 'sale',
      includeDev: false,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      'get_ai_status_distribution',
      expect.objectContaining({
        p_from: '2026-04-30T00:00:00.000Z',
        p_to: '2026-04-30T23:59:59.999Z',
        p_specialists: ['a@x.com'],
        p_mode: 'sale',
        p_include_dev: false,
      }),
    );
  });
});

describe('fetchExportPipeline / fetchHouseSaleSplit / fetchFailedAiBreakdown', () => {
  it('fetchExportPipeline calls get_export_pipeline', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchExportPipeline({ from: FROM, to: TO, specialists: [], mode: 'all', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith(
      'get_export_pipeline',
      expect.objectContaining({ p_from: FROM.toISOString(), p_to: TO.toISOString() }),
    );
  });

  it('fetchHouseSaleSplit calls get_house_sale_split', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchHouseSaleSplit({ from: FROM, to: TO, specialists: [], mode: 'all', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith(
      'get_house_sale_split',
      expect.objectContaining({ p_from: FROM.toISOString(), p_to: TO.toISOString() }),
    );
  });

  it('fetchFailedAiBreakdown calls get_failed_ai_breakdown', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchFailedAiBreakdown({
      from: FROM,
      to: TO,
      specialists: [],
      mode: 'all',
      includeDev: false,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      'get_failed_ai_breakdown',
      expect.objectContaining({ p_from: FROM.toISOString(), p_to: TO.toISOString() }),
    );
  });
});

describe('fetchStuckItems', () => {
  it('passes specialists + mode (NO from/to — right-now class)', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchStuckItems({ specialists: ['x@y.com'], mode: 'all', includeDev: false });
    const arg = rpcMock.mock.calls[0][1];
    expect(arg).not.toHaveProperty('p_from');
    expect(arg).not.toHaveProperty('p_to');
    expect(arg).toEqual({ p_specialists: ['x@y.com'], p_mode: 'all', p_include_dev: false });
  });
});

describe('fetchSessionDetail / fetchPhotoCoverage (one-shot)', () => {
  it('fetchSessionDetail returns first row or null', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          session_id: 's1',
          name: 'S1',
          mode: 'house',
          status: 'active',
          assigned_to_id: 'u1',
          assigned_to_display_name: 'A',
          created_by_id: 'u2',
          created_by_display_name: 'B',
          notes: '',
          review_notes: '',
          created_at: '2026-04-30T00:00:00Z',
          updated_at: '2026-04-30T00:00:00Z',
        },
      ],
      error: null,
    });
    const row = await fetchSessionDetail({ sessionId: 's1' });
    expect(rpcMock).toHaveBeenCalledWith('get_session_detail', { p_session_id: 's1' });
    expect(row?.session_id).toBe('s1');

    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const empty = await fetchSessionDetail({ sessionId: 's2' });
    expect(empty).toBeNull();
  });

  it('fetchPhotoCoverage returns first row or null', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          items_total: 10,
          items_with_photos: 8,
          items_without_photos: 2,
          status_failed: 0,
          status_pending: 1,
          status_uploaded: 8,
          status_uploading: 1,
        },
      ],
      error: null,
    });
    const row = await fetchPhotoCoverage({ sessionId: 's1' });
    expect(rpcMock).toHaveBeenCalledWith('get_photo_coverage', { p_session_id: 's1' });
    expect(row?.items_total).toBe(10);

    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const empty = await fetchPhotoCoverage({ sessionId: 's2' });
    expect(empty).toBeNull();
  });
});

describe('fetchUiTopPages / fetchUiTopElements (D-34 — no specialist/mode)', () => {
  it('fetchUiTopPages passes ONLY p_from/p_to', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchUiTopPages({ from: FROM, to: TO });
    const arg = rpcMock.mock.calls[0][1];
    expect(arg).toEqual({ p_from: FROM.toISOString(), p_to: TO.toISOString() });
    expect(arg).not.toHaveProperty('p_specialists');
    expect(arg).not.toHaveProperty('p_mode');
  });

  it('fetchUiTopElements passes ONLY p_from/p_to', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchUiTopElements({ from: FROM, to: TO });
    const arg = rpcMock.mock.calls[0][1];
    expect(arg).toEqual({ p_from: FROM.toISOString(), p_to: TO.toISOString() });
    expect(arg).not.toHaveProperty('p_specialists');
    expect(arg).not.toHaveProperty('p_mode');
  });
});

describe('fetchWalkthroughFunnel (D-32 — no args)', () => {
  it('calls get_walkthrough_funnel with no parameters', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchWalkthroughFunnel();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe('get_walkthrough_funnel');
    // Second arg may be undefined or {} — we only assert no specialist/mode/range fields.
    const second = rpcMock.mock.calls[0][1];
    if (second != null) {
      expect(second).not.toHaveProperty('p_specialists');
      expect(second).not.toHaveProperty('p_mode');
      expect(second).not.toHaveProperty('p_from');
      expect(second).not.toHaveProperty('p_to');
    }
  });
});

describe('fetchActiveSpecialists (D-19)', () => {
  it('filters profiles by is_active=true AND role=specialist, ordered by display_name', async () => {
    const chain = makeChain({
      data: [
        { id: 'u1', email: 'a@x.com', display_name: 'Alice' },
        { id: 'u2', email: 'b@x.com', display_name: 'Bob' },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(chain);
    const result = await fetchActiveSpecialists();

    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(chain.select).toHaveBeenCalledWith('id, email, display_name');

    // BOTH filters present
    const eqCalls = chain.eq.mock.calls;
    expect(eqCalls).toContainEqual(['is_active', true]);
    expect(eqCalls).toContainEqual(['role', 'specialist']);

    expect(chain.not).toHaveBeenCalledWith('email', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('display_name', { ascending: true });
    expect(result).toHaveLength(2);
  });

  it('drops rows where email is null (defensive narrow)', async () => {
    const chain = makeChain({
      data: [
        { id: 'u1', email: 'a@x.com', display_name: 'Alice' },
        { id: 'u2', email: null, display_name: 'Anon' },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(chain);
    const result = await fetchActiveSpecialists();
    expect(result).toEqual([{ id: 'u1', email: 'a@x.com', display_name: 'Alice' }]);
  });
});

describe('fetchUiRecentEvents (D-33 invariant — load-bearing)', () => {
  it('scopes by app_source = tpc-app + orders desc + limits 50 by default', async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);
    await fetchUiRecentEvents({});

    expect(fromMock).toHaveBeenCalledWith('ui_interactions');
    expect(chain.eq).toHaveBeenCalledWith('app_source', 'tpc-app'); // D-33
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('honors custom limit', async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);
    await fetchUiRecentEvents({ limit: 25 });
    expect(chain.limit).toHaveBeenCalledWith(25);
  });
});

describe('fetchSessionItems (raw embed)', () => {
  it('selects from items + filters session_id + flattens photos count', async () => {
    const chain = makeChain({
      data: [
        {
          id: 'i1',
          receipt_number: 'R1',
          title: 'Item 1',
          ai_status: 'pending',
          description: null,
          category: null,
          estimate: null,
          measurements: null,
          transcript: null,
          created_at: '2026-04-30T00:00:00Z',
          photos: [{ count: 3 }],
        },
        {
          id: 'i2',
          receipt_number: 'R2',
          title: 'Item 2',
          ai_status: 'done',
          description: null,
          category: null,
          estimate: null,
          measurements: null,
          transcript: null,
          created_at: '2026-04-30T00:00:00Z',
          photos: null,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(chain);
    const rows = await fetchSessionItems({ sessionId: 's1' });

    expect(fromMock).toHaveBeenCalledWith('items');
    expect(chain.eq).toHaveBeenCalledWith('session_id', 's1');
    expect(rows[0].photo_count).toBe(3);
    expect(rows[1].photo_count).toBe(0);
  });
});

describe('fetchSessionPhotos (raw — D-09 lazy)', () => {
  it('selects photo metadata for an item, ordered by sort_order', async () => {
    const chain = makeChain({
      data: [
        {
          id: 'p1',
          item_id: 'i1',
          storage_path: 'a/b/c.jpg',
          thumbnail_path: 'a/b/c-thumb.jpg',
          upload_status: 'uploaded',
          sort_order: 0,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(chain);
    const rows = await fetchSessionPhotos({ itemId: 'i1' });

    expect(fromMock).toHaveBeenCalledWith('photos');
    expect(chain.eq).toHaveBeenCalledWith('item_id', 'i1');
    expect(chain.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(rows).toHaveLength(1);
  });
});
