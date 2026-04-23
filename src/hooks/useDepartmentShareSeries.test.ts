// Phase 6 Plan 06-01 Task 6 — useDepartmentShareSeries contract tests.
// The RPC returns an object envelope { rows, top_codes } — distinct from the
// rankings / revenue_series hooks whose payloads are arrays. The shape check
// asserts both 'rows' and 'top_codes' are present; the return reshapes them
// into { rows, topCodes } (camelCase) so callers don't mix casing styles.

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

describe('useDepartmentShareSeries', () => {
  it('T1 — queryKey includes topN', async () => {
    rpc.mockResolvedValue({
      data: { rows: [], top_codes: [] },
      error: null,
    });

    const { client, wrapper } = makeWrapper();
    const { useDepartmentShareSeries } = await import(
      './useDepartmentShareSeries'
    );
    const { result } = renderHook(
      () => useDepartmentShareSeries(range, 8),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryCache().findAll();
    expect(cached[0].queryKey).toEqual([
      'department-share-series',
      '2024-01-01',
      '2024-12-31',
      8,
    ]);
    expect(rpc).toHaveBeenCalledWith('department_share_series', {
      range_start: '2024-01-01',
      range_end: '2024-12-31',
      top_n: 8,
    });
  });

  it('T2 — success path reshapes top_codes → topCodes and returns both', async () => {
    const payload = {
      rows: [
        {
          sale_date: '2024-01-15',
          sale_number: '2024-0001',
          ASN: 0.4,
          FRN: 0.3,
          other: 0.3,
        },
      ],
      top_codes: ['ASN', 'FRN'],
    };
    rpc.mockResolvedValue({ data: payload, error: null });

    const { wrapper } = makeWrapper();
    const { useDepartmentShareSeries } = await import(
      './useDepartmentShareSeries'
    );
    const { result } = renderHook(
      () => useDepartmentShareSeries(range, 8),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.rows).toEqual(payload.rows);
    expect(result.current.data?.topCodes).toEqual(['ASN', 'FRN']);
  });

  it('T3 — empty rows returns the frozen EMPTY_SHARE singleton on .data.rows', async () => {
    rpc.mockResolvedValue({
      data: { rows: [], top_codes: [] },
      error: null,
    });

    const mod = await import('./useDepartmentShareSeries');
    const { wrapper: w1 } = makeWrapper();
    const { result: r1 } = renderHook(() => mod.useDepartmentShareSeries(range, 8), {
      wrapper: w1,
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { wrapper: w2 } = makeWrapper();
    const { result: r2 } = renderHook(() => mod.useDepartmentShareSeries(range, 8), {
      wrapper: w2,
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    expect(r1.current.data).toBe(r2.current.data);
    expect(Object.isFrozen(r1.current.data)).toBe(true);
    expect(Object.isFrozen(r1.current.data?.rows)).toBe(true);
    expect(Object.isFrozen(r1.current.data?.topCodes)).toBe(true);
  });

  it('T4 — array payload (wrong shape) throws Invalid … response shape', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const { wrapper } = makeWrapper();
    const { useDepartmentShareSeries } = await import(
      './useDepartmentShareSeries'
    );
    const { result } = renderHook(
      () => useDepartmentShareSeries(range, 8),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain(
      'Invalid department_share_series response shape',
    );
  });

  it('T5 — missing top_codes key (only rows) throws Invalid … response shape', async () => {
    rpc.mockResolvedValue({ data: { rows: [] }, error: null });

    const { wrapper } = makeWrapper();
    const { useDepartmentShareSeries } = await import(
      './useDepartmentShareSeries'
    );
    const { result } = renderHook(
      () => useDepartmentShareSeries(range, 8),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain(
      'Invalid department_share_series response shape',
    );
  });
});
