// Phase 6 Plan 06-01 Task 6 — useDepartmentRevenueSeries contract tests.
// Mirrors the supabase.rpc-spy pattern from useDepartmentRankings.test.ts.
//
// Contracts verified:
//   T1. queryKey dept-codes slot is the sorted-join of the input — order-insensitive.
//   T2. Success path: rpc wide-row payload reaches .data as DepartmentRevenueRow[].
//   T3. Empty deptCodes → the hook is disabled (no rpc call, query never fetches).
//   T4. Empty rpc result (empty array) → .data is the frozen EMPTY singleton.
//   T5. Non-array payload → throws 'Invalid department_revenue_series response shape'.

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

const range: Range = { start: '2024-01-01', end: '2024-12-31', preset: 'custom' };

describe('useDepartmentRevenueSeries', () => {
  it('T1 — queryKey dept-codes slot is sorted (order-insensitive)', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const mod = await import('./useDepartmentRevenueSeries');
    const { client: c1, wrapper: w1 } = makeWrapper();
    const { result: r1 } = renderHook(
      () => mod.useDepartmentRevenueSeries(range, ['FRN', 'ASN']),
      { wrapper: w1 },
    );
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { client: c2, wrapper: w2 } = makeWrapper();
    const { result: r2 } = renderHook(
      () => mod.useDepartmentRevenueSeries(range, ['ASN', 'FRN']),
      { wrapper: w2 },
    );
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    const key1 = c1.getQueryCache().findAll()[0].queryKey;
    const key2 = c2.getQueryCache().findAll()[0].queryKey;
    expect(key1).toEqual(key2);
    expect(key1).toEqual([
      'department-revenue-series',
      '2024-01-01',
      '2024-12-31',
      'ASN,FRN',
    ]);
  });

  it('T2 — success path returns the wide-row array as DepartmentRevenueRow[]', async () => {
    const payload = [
      {
        sale_date: '2024-01-15',
        sale_number: '2024-0001',
        ASN: 1000,
        FRN: 500,
      },
    ];
    rpc.mockResolvedValue({ data: payload, error: null });

    const { wrapper } = makeWrapper();
    const { useDepartmentRevenueSeries } = await import(
      './useDepartmentRevenueSeries'
    );
    const { result } = renderHook(
      () => useDepartmentRevenueSeries(range, ['ASN', 'FRN']),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(payload);
    expect(rpc).toHaveBeenCalledWith('department_revenue_series', {
      range_start: '2024-01-01',
      range_end: '2024-12-31',
      dept_codes: ['ASN', 'FRN'],
    });
  });

  it('T3 — empty deptCodes disables the fetch entirely', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const { wrapper } = makeWrapper();
    const { useDepartmentRevenueSeries } = await import(
      './useDepartmentRevenueSeries'
    );
    const { result } = renderHook(
      () => useDepartmentRevenueSeries(range, []),
      { wrapper },
    );
    // Give TanStack Query a tick to see there's nothing to do.
    await new Promise((r) => setTimeout(r, 50));
    expect(rpc).not.toHaveBeenCalled();
    // Hook stays in the non-fetched state; isFetched is false.
    expect(result.current.isFetched).toBe(false);
  });

  it('T4 — empty rpc result returns the frozen EMPTY singleton', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const mod = await import('./useDepartmentRevenueSeries');
    const { wrapper: w1 } = makeWrapper();
    const { result: r1 } = renderHook(
      () => mod.useDepartmentRevenueSeries(range, ['ASN']),
      { wrapper: w1 },
    );
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { wrapper: w2 } = makeWrapper();
    const { result: r2 } = renderHook(
      () => mod.useDepartmentRevenueSeries(range, ['ASN']),
      { wrapper: w2 },
    );
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    expect(r1.current.data).toBe(r2.current.data);
    expect(Object.isFrozen(r1.current.data)).toBe(true);
  });

  it('T5 — non-array payload throws an Invalid … response shape error', async () => {
    rpc.mockResolvedValue({ data: { bogus: true }, error: null });

    const { wrapper } = makeWrapper();
    const { useDepartmentRevenueSeries } = await import(
      './useDepartmentRevenueSeries'
    );
    const { result } = renderHook(
      () => useDepartmentRevenueSeries(range, ['ASN']),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain(
      'Invalid department_revenue_series response shape',
    );
  });
});
