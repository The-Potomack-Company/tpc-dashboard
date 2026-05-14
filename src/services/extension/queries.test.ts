import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2 / Plan 02-03 / Task 1 — services/extension/queries.test.ts
//
// Mocks the supabase module so each .from()/.rpc() chain is observable.
// Tests assert the D-01 invariant (.eq('app_source','tpc-extension') on
// every applicable function), the D-02 5-event vocabulary, the D-03
// error_message-IS-NOT-NULL filter for fetchRecentErrors, the D-09 "no
// filters" shape for fetchLiveFeed, the empty-array no-op invariant for
// fetchRecentErrors's .in('user_email',...) skip, and the new
// fetchDistinctVersions builder added for the EXT-09 ExtensionVersionFilter.

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
  // The chain is awaited; supabase-js returns a thenable PostgrestBuilder.
  // We make the chain itself a thenable that resolves to {data, error}.
  chain.then = (onFulfilled) =>
    Promise.resolve(onFulfilled(resolve));
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
  fetchEventVolume,
  fetchKpiTotals,
  fetchErrorRate,
  fetchPerUserSummary,
  fetchDominantVersion,
  fetchCancellationRates,
  fetchRecentErrors,
  fetchLiveFeed,
  fetchExtensionGate,
  fetchDistinctVersions,
  fetchSkipReasons,
  EXTENSION_EVENT_TYPES,
} from './queries';

const FROM = new Date('2026-04-22T00:00:00Z');
const TO = new Date('2026-04-29T23:59:59Z');

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe('EXTENSION_EVENT_TYPES', () => {
  it('exports the 5-event vocabulary (D-02) — catalog_item is excluded', () => {
    expect(EXTENSION_EVENT_TYPES).toEqual([
      'catalog_single',
      'catalog_batch',
      'portal_upload',
      'spreadsheet_transform',
      'data_import',
    ]);
    expect(EXTENSION_EVENT_TYPES).not.toContain('catalog_item');
  });
});

describe('fetchEventVolume', () => {
  it('invokes supabase.rpc with the correct args and returns data ?? []', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ bucket_start: 'x', event_type: 'catalog_single', event_count: 1 }], error: null });
    const result = await fetchEventVolume({
      from: FROM,
      to: TO,
      users: [],
      versions: [],
      bucket: 'day',
    });
    expect(rpcMock).toHaveBeenCalledWith('get_event_volume_daily', {
      p_from: FROM.toISOString(),
      p_to: TO.toISOString(),
      p_users: [],
      p_versions: [],
      p_bucket: 'day',
    });
    expect(result).toEqual([{ bucket_start: 'x', event_type: 'catalog_single', event_count: 1 }]);
  });

  it('throws when supabase.rpc returns an error (TanStack consumers see the error state)', async () => {
    const err = { message: 'boom', code: '42501' };
    rpcMock.mockResolvedValueOnce({ data: null, error: err });
    await expect(
      fetchEventVolume({ from: FROM, to: TO, users: [], versions: [], bucket: 'day' }),
    ).rejects.toBe(err);
  });

  it('returns [] when data is null and error is null', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchEventVolume({
      from: FROM, to: TO, users: [], versions: [], bucket: 'hour',
    });
    expect(result).toEqual([]);
  });
});

describe('fetchKpiTotals / fetchErrorRate / fetchPerUserSummary / fetchDominantVersion / fetchCancellationRates', () => {
  it('fetchKpiTotals passes p_bucket through (D-08 sparkline resolution)', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchKpiTotals({ from: FROM, to: TO, users: ['a@x.com'], versions: ['2.0.2'], bucket: 'hour' });
    expect(rpcMock).toHaveBeenCalledWith('get_kpi_totals', {
      p_from: FROM.toISOString(),
      p_to: TO.toISOString(),
      p_users: ['a@x.com'],
      p_versions: ['2.0.2'],
      p_bucket: 'hour',
    });
  });

  it('fetchErrorRate omits p_bucket (no bucket arg in this RPC)', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchErrorRate({ from: FROM, to: TO, users: [], versions: [] });
    expect(rpcMock).toHaveBeenCalledWith('get_error_rate_by_type', {
      p_from: FROM.toISOString(),
      p_to: TO.toISOString(),
      p_users: [],
      p_versions: [],
    });
  });

  it('fetchPerUserSummary calls get_per_user_summary', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchPerUserSummary({ from: FROM, to: TO, users: [], versions: [] });
    expect(rpcMock).toHaveBeenCalledWith('get_per_user_summary', expect.objectContaining({
      p_from: FROM.toISOString(),
      p_to: TO.toISOString(),
    }));
  });

  it('fetchDominantVersion returns first row or null (RPC returns at most 1 row)', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ extension_version: '2.0.2', event_count: 42 }], error: null });
    const v = await fetchDominantVersion({ from: FROM, to: TO, users: [], versions: [] });
    expect(v).toEqual({ extension_version: '2.0.2', event_count: 42 });

    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const empty = await fetchDominantVersion({ from: FROM, to: TO, users: [], versions: [] });
    expect(empty).toBeNull();
  });

  it('fetchCancellationRates returns rows with previous_rate (Plan 02-01 D-05 extension)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { event_type: 'catalog_batch', cancelled_count: 3, total_count: 12, rate: 0.25, previous_rate: 0.5 },
        { event_type: 'portal_upload', cancelled_count: 0, total_count: 0, rate: 0, previous_rate: null },
      ],
      error: null,
    });
    const rows = await fetchCancellationRates({ from: FROM, to: TO, users: [], versions: [] });
    expect(rows).toHaveLength(2);
    expect(rows[0].previous_rate).toBe(0.5);
    expect(rows[1].previous_rate).toBeNull();
  });
});

describe('fetchRecentErrors', () => {
  it('builds a chain with D-01 + D-02 + D-03 invariants and limit=100', async () => {
    const chain = makeChain({ data: [{ id: 'r1' }], error: null });
    fromMock.mockReturnValueOnce(chain);
    const result = await fetchRecentErrors({ from: FROM, to: TO, users: ['a@x.com'], versions: [] });

    expect(fromMock).toHaveBeenCalledWith('analytics_events');
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith('app_source', 'tpc-extension'); // D-01
    expect(chain.not).toHaveBeenCalledWith('error_message', 'is', null);   // D-03
    // D-02 — 5-event vocabulary in event_type filter
    const eventTypeCall = chain.in.mock.calls.find((c) => c[0] === 'event_type');
    expect(eventTypeCall).toBeDefined();
    expect(eventTypeCall![1]).toEqual([
      'catalog_single', 'catalog_batch', 'portal_upload',
      'spreadsheet_transform', 'data_import',
    ]);
    expect(chain.gte).toHaveBeenCalledWith('created_at', FROM.toISOString());
    expect(chain.lte).toHaveBeenCalledWith('created_at', TO.toISOString());
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(100);
    // users.length > 0 ⇒ .in('user_email',...) is called
    const userCall = chain.in.mock.calls.find((c) => c[0] === 'user_email');
    expect(userCall).toBeDefined();
    expect(userCall![1]).toEqual(['a@x.com']);
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('does NOT call .in("user_email", ...) when users is [] (empty filter is a no-op)', async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);
    await fetchRecentErrors({ from: FROM, to: TO, users: [], versions: [] });

    const userCall = chain.in.mock.calls.find((c) => c[0] === 'user_email');
    expect(userCall).toBeUndefined(); // never called for empty users
    const versionCall = chain.in.mock.calls.find((c) => c[0] === 'extension_version');
    expect(versionCall).toBeUndefined();
  });

  it('throws on supabase error', async () => {
    const err = { message: 'fail' };
    const chain = makeChain({ data: null, error: err });
    fromMock.mockReturnValueOnce(chain);
    await expect(
      fetchRecentErrors({ from: FROM, to: TO, users: [], versions: [] }),
    ).rejects.toBe(err);
  });
});

describe('fetchLiveFeed', () => {
  it('scopes by app_source ONLY — no event_type filter, no error_message filter (D-09)', async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);
    await fetchLiveFeed({ limit: 50 });

    expect(fromMock).toHaveBeenCalledWith('analytics_events');
    expect(chain.eq).toHaveBeenCalledWith('app_source', 'tpc-extension');
    // D-09: feed is unfiltered live activity — no event_type, no error_message
    expect(chain.in).not.toHaveBeenCalled();
    expect(chain.not).not.toHaveBeenCalled();
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('defaults limit to 50 when called without args', async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);
    await fetchLiveFeed();
    expect(chain.limit).toHaveBeenCalledWith(50);
  });
});

describe('fetchExtensionGate', () => {
  it('returns { hasAny: true } when 1 row is returned', async () => {
    const chain = makeChain({ data: [{ id: 'r1' }], error: null });
    fromMock.mockReturnValueOnce(chain);
    const result = await fetchExtensionGate();

    expect(chain.select).toHaveBeenCalledWith('id');
    expect(chain.eq).toHaveBeenCalledWith('app_source', 'tpc-extension'); // D-01
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual({ hasAny: true });
  });

  it('returns { hasAny: false } when 0 rows are returned', async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);
    const result = await fetchExtensionGate();
    expect(result).toEqual({ hasAny: false });
  });
});

describe('fetchSkipReasons (category-filtered-batch)', () => {
  // Migration 20260514100000_get_skip_reasons moved aggregation server-side.
  // D-01 + batch-only filters now live in the RPC body; tests assert the
  // wire-level RPC contract instead.

  it('invokes get_skip_reasons RPC with date range and empty filter arrays', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchSkipReasons({ from: FROM, to: TO, users: [], versions: [] });

    expect(rpcMock).toHaveBeenCalledWith('get_skip_reasons', {
      p_from: FROM.toISOString(),
      p_to: TO.toISOString(),
      p_users: [],
      p_versions: [],
    });
  });

  it('passes users and versions arrays through verbatim (server-side filter)', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await fetchSkipReasons({
      from: FROM,
      to: TO,
      users: ['a@x.com', 'b@x.com'],
      versions: ['2.0.3', '2.0.4'],
    });

    expect(rpcMock).toHaveBeenCalledWith('get_skip_reasons', {
      p_from: FROM.toISOString(),
      p_to: TO.toISOString(),
      p_users: ['a@x.com', 'b@x.com'],
      p_versions: ['2.0.3', '2.0.4'],
    });
  });

  it('returns rows from RPC response', async () => {
    const rows = [
      { reason: 'no_photos', count: 1 },
      { reason: 'fields_filled', count: 2 },
      { reason: 'manually', count: 3 },
      { reason: 'category_filter', count: 4 },
      { reason: 'classification_failed', count: 5 },
    ];
    rpcMock.mockResolvedValueOnce({ data: rows, error: null });
    const result = await fetchSkipReasons({ from: FROM, to: TO, users: [], versions: [] });
    expect(result).toEqual(rows);
  });

  it('throws on RPC error', async () => {
    const err = { message: 'skip fail' };
    rpcMock.mockResolvedValueOnce({ data: null, error: err });
    await expect(
      fetchSkipReasons({ from: FROM, to: TO, users: [], versions: [] }),
    ).rejects.toBe(err);
  });

  it('returns [] when data is null and error is null', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchSkipReasons({ from: FROM, to: TO, users: [], versions: [] });
    expect(result).toEqual([]);
  });
});

describe('fetchDistinctVersions', () => {
  it('scopes by app_source, drops NULLs, dedupes, returns sorted strings', async () => {
    // After .not('extension_version','is',null) PostgREST excludes nulls server-side.
    // The mock returns the rows that the server would return (no nulls), and we
    // verify the JS-side dedupe produces a sorted unique array.
    const chain = makeChain({
      data: [
        { extension_version: '2.0.2' },
        { extension_version: '2.0.1' },
        { extension_version: '2.0.2' }, // duplicate
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(chain);
    const versions = await fetchDistinctVersions();

    expect(fromMock).toHaveBeenCalledWith('analytics_events');
    expect(chain.select).toHaveBeenCalledWith('extension_version');
    expect(chain.eq).toHaveBeenCalledWith('app_source', 'tpc-extension'); // D-01
    expect(chain.not).toHaveBeenCalledWith('extension_version', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('extension_version', { ascending: false });
    expect(versions).toEqual(['2.0.2', '2.0.1']); // dedupe via Set, server-sorted desc
  });

  it('throws on supabase error', async () => {
    const err = { message: 'distinct fail' };
    const chain = makeChain({ data: null, error: err });
    fromMock.mockReturnValueOnce(chain);
    await expect(fetchDistinctVersions()).rejects.toBe(err);
  });
});
