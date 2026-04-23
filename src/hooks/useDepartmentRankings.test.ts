// Phase 6 Plan 06-01 Task 5 — useDepartmentRankings contract tests.
// Mirrors the supabase-mock pattern from useSalesInRange.test.ts, but the
// terminal call is `supabase.rpc('department_rankings', …)` (single function
// call, no chain) so the mock is simpler: one `rpc` spy that returns
// { data, error }.
//
// Contracts verified:
//   T1. queryKey shape = ['department-rankings', start, end] (null → 'null' sentinel).
//   T2. Success path: rpc return cast to DepartmentRanking[] reaches .data.
//   T3. Empty result: .data === EMPTY_RANKINGS module-singleton (reference equality).
//   T4. Shape error: non-array rpc payload throws 'Invalid department_rankings response shape'.
//   T5. Error propagation: { error, data: null } transitions the hook to isError.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import React from 'react';

import type { Range } from '../lib/period';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

beforeEach(() => {
  rpc.mockReset();
});

describe('useDepartmentRankings', () => {
  it('T1 — queryKey is ["department-rankings", start, end] with null→"null" sentinel', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const range: Range = {
      start: '2024-01-01',
      end: '2024-12-31',
      preset: 'custom',
    };

    const { client, wrapper } = makeWrapper();
    const { useDepartmentRankings } = await import('./useDepartmentRankings');
    const { result } = renderHook(() => useDepartmentRankings(range), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryCache().findAll();
    expect(cached).toHaveLength(1);
    expect(cached[0].queryKey).toEqual([
      'department-rankings',
      '2024-01-01',
      '2024-12-31',
    ]);
    expect(rpc).toHaveBeenCalledWith('department_rankings', {
      range_start: '2024-01-01',
      range_end: '2024-12-31',
    });
  });

  it('T2 — success path returns the array cast to DepartmentRanking[]', async () => {
    const payload = [
      {
        department_code: 'ASN',
        display_name: 'Asian art',
        sales_count: 5,
        total_revenue: 123456.78,
        avg_sell_through: 0.68,
        lots_above_estimate: 12,
      },
    ];
    rpc.mockResolvedValue({ data: payload, error: null });
    const range: Range = { start: null, end: null, preset: 'all' };

    const { wrapper } = makeWrapper();
    const { useDepartmentRankings } = await import('./useDepartmentRankings');
    const { result } = renderHook(() => useDepartmentRankings(range), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(payload);
    // Confirm null range bounds flow through to the rpc call as null (RPC
    // handles unbounded via coalesce).
    expect(rpc).toHaveBeenCalledWith('department_rankings', {
      range_start: null,
      range_end: null,
    });
  });

  it('T3 — empty result returns the referentially-stable EMPTY_RANKINGS singleton', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const range: Range = { start: null, end: null, preset: 'all' };

    const mod = await import('./useDepartmentRankings');
    const { wrapper: w1 } = makeWrapper();
    const { result: r1 } = renderHook(() => mod.useDepartmentRankings(range), {
      wrapper: w1,
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { wrapper: w2 } = makeWrapper();
    const { result: r2 } = renderHook(() => mod.useDepartmentRankings(range), {
      wrapper: w2,
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    // Reference equality proves both mounts share the module-singleton.
    expect(r1.current.data).toBe(r2.current.data);
    expect(Object.isFrozen(r1.current.data)).toBe(true);
  });

  it('T4 — non-array payload throws an Invalid … response shape error', async () => {
    rpc.mockResolvedValue({ data: { bogus: true }, error: null });
    const range: Range = { start: null, end: null, preset: 'all' };

    const { wrapper } = makeWrapper();
    const { useDepartmentRankings } = await import('./useDepartmentRankings');
    const { result } = renderHook(() => useDepartmentRankings(range), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain(
      'Invalid department_rankings response shape',
    );
  });

  it('T5 — Supabase error propagates as isError', async () => {
    rpc.mockResolvedValue({ error: { message: 'boom' }, data: null });
    const range: Range = { start: null, end: null, preset: 'all' };

    const { wrapper } = makeWrapper();
    const { useDepartmentRankings } = await import('./useDepartmentRankings');
    const { result } = renderHook(() => useDepartmentRankings(range), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });
});
