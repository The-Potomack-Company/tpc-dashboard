import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Phase 4 Plan 03 Task 1 — useKpiSummary hook contract locked by
// .planning/phases/04-kpi-landing-page/04-RESEARCH.md § Pattern 3 (hook body),
// § Pitfall 1 (Zod narrows Json → KpiSummary), and § Pitfall 4 (v5
// keepPreviousData helper instead of the v4 boolean flag).

// Hoisted supabase.rpc mock so vi.mock (hoisted above imports) can reference it.
const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

// Import AFTER mock so the hook under test binds to the mocked supabase.
import { supabase } from '../lib/supabase';
import { useKpiSummary } from '../hooks/useKpiSummary';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const validPayload = {
  current: {
    revenue: 1_000,
    sell_through: 0.68,
    lots_sold: 100,
    sales_count: 5,
  },
  previous: {
    revenue: 800,
    sell_through: 0.65,
    lots_sold: 80,
    sales_count: 4,
  },
};

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useKpiSummary', () => {
  it('calls supabase.rpc("kpi_summary", ...) exactly once with 4 yyyy-mm-dd string params', async () => {
    rpcMock.mockResolvedValueOnce({ data: validPayload, error: null });

    const { result } = renderHook(() => useKpiSummary('l12m'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpcMock.mock.calls[0];
    expect(fnName).toBe('kpi_summary');
    expect(args).toHaveProperty('period_start');
    expect(args).toHaveProperty('period_end');
    expect(args).toHaveProperty('compare_start');
    expect(args).toHaveProperty('compare_end');
    // All four date params must be local yyyy-mm-dd strings — NOT Date objects,
    // NOT full ISO timestamps.
    expect(args.period_start).toMatch(YYYY_MM_DD);
    expect(args.period_end).toMatch(YYYY_MM_DD);
    expect(args.compare_start).toMatch(YYYY_MM_DD);
    expect(args.compare_end).toMatch(YYYY_MM_DD);
    expect(typeof args.period_start).toBe('string');
  });

  it('changing period re-issues the RPC (queryKey includes period)', async () => {
    rpcMock.mockResolvedValueOnce({ data: validPayload, error: null });
    rpcMock.mockResolvedValueOnce({ data: validPayload, error: null });

    type Period = 'ytd' | 'l6m' | 'l12m';
    const wrapper = makeWrapper();
    const initialProps: { period: Period } = { period: 'l12m' };
    const { result, rerender } = renderHook(
      ({ period }: { period: Period }) => useKpiSummary(period),
      { wrapper, initialProps },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpcMock).toHaveBeenCalledTimes(1);

    rerender({ period: 'ytd' });

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
  });

  it('exposes .data.current.revenue as a narrowed number after Zod parse', async () => {
    rpcMock.mockResolvedValueOnce({ data: validPayload, error: null });

    const { result } = renderHook(() => useKpiSummary('l12m'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(typeof result.current.data?.current.revenue).toBe('number');
    expect(result.current.data?.current.revenue).toBe(1_000);
    expect(result.current.data?.previous.revenue).toBe(800);
  });

  it('handles null sell_through (NULLIF divide-by-zero path from the RPC)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        current: { ...validPayload.current, sell_through: null },
        previous: { ...validPayload.previous, sell_through: null },
      },
      error: null,
    });

    const { result } = renderHook(() => useKpiSummary('ytd'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.current.sell_through).toBeNull();
    expect(result.current.data?.previous.sell_through).toBeNull();
  });

  it('propagates RPC errors into TanStack Query isError state', async () => {
    const boom = new Error('rpc exploded');
    rpcMock.mockResolvedValueOnce({ data: null, error: boom });

    const { result } = renderHook(() => useKpiSummary('l6m'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });

  it('raises a Zod failure into isError when the RPC payload is malformed (T-04-07 mitigation)', async () => {
    // Missing `previous` key entirely — kpiSummarySchema.parse must throw.
    rpcMock.mockResolvedValueOnce({
      data: { current: { revenue: 100 } },
      error: null,
    });

    const { result } = renderHook(() => useKpiSummary('l12m'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Error must be a real thrown value, not null
    expect(result.current.error).toBeDefined();
    expect(result.current.error).not.toBeNull();
  });

  it('exposes a refetch function on the result', async () => {
    rpcMock.mockResolvedValueOnce({ data: validPayload, error: null });

    const { result } = renderHook(() => useKpiSummary('l12m'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(typeof result.current.refetch).toBe('function');
  });
});
