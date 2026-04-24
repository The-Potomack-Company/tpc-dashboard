// Phase 6 Plan 06-01 Task 7 — useSalesComparison contract tests.
// Mock pattern: supabase.from('sales').select('*').in('sale_number', [...])
// is the chain — each link returns the next link (select -> in resolves the
// promise). 'in' is the terminal so its mock returns { data, error }.
//
// Contracts verified:
//   T1. queryKey sorts a COPY of saleNumbers → same key regardless of input order.
//   T2. Returned rows are reordered to match the caller's input order.
//   T3. Missing sale_number → isError with a message listing the missing ones.
//   T4. enabled gate at length < 2: no fetch triggered.
//   T5. enabled gate at length > 4: no fetch triggered.
//   T6. Frozen input array does NOT throw (we sort a copy, not the input).

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import React from 'react';

const inFn = vi.fn();
const select = vi.fn(() => ({ in: inFn }));
const from = vi.fn(() => ({ select }));

vi.mock('../lib/supabase', () => ({ supabase: { from } }));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

beforeEach(() => {
  from.mockClear();
  select.mockClear();
  inFn.mockReset();
});

describe('useSalesComparison', () => {
  it('T1 — queryKey is identical regardless of input array order', async () => {
    inFn.mockResolvedValue({
      data: [
        { sale_number: '2024-01' },
        { sale_number: '2024-02' },
      ],
      error: null,
    });

    const mod = await import('./useSalesComparison');
    const { client: c1, wrapper: w1 } = makeWrapper();
    const { result: r1 } = renderHook(
      () => mod.useSalesComparison(['2024-02', '2024-01']),
      { wrapper: w1 },
    );
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { client: c2, wrapper: w2 } = makeWrapper();
    const { result: r2 } = renderHook(
      () => mod.useSalesComparison(['2024-01', '2024-02']),
      { wrapper: w2 },
    );
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    const key1 = JSON.stringify(c1.getQueryCache().findAll()[0].queryKey);
    const key2 = JSON.stringify(c2.getQueryCache().findAll()[0].queryKey);
    expect(key1).toBe(key2);
    // Confirm it's sorted-copy, not caller order
    expect(c1.getQueryCache().findAll()[0].queryKey).toEqual([
      'sales-comparison',
      ['2024-01', '2024-02'],
    ]);
  });

  it('T2 — returned rows preserve caller input order even when server returns them in a different order', async () => {
    // Server returns ascending; caller asks descending
    inFn.mockResolvedValue({
      data: [
        { sale_number: '2024-01' },
        { sale_number: '2024-02' },
      ],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { useSalesComparison } = await import('./useSalesComparison');
    const { result } = renderHook(
      () => useSalesComparison(['2024-02', '2024-01']),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].sale_number).toBe('2024-02');
    expect(result.current.data?.[1].sale_number).toBe('2024-01');
  });

  it('T3 — missing sale_number throws an error naming the missing ones', async () => {
    inFn.mockResolvedValue({
      data: [{ sale_number: '2024-01' }], // MISSING not returned
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { useSalesComparison } = await import('./useSalesComparison');
    const { result } = renderHook(
      () => useSalesComparison(['2024-01', 'MISSING']),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('MISSING');
  });

  it('T4 — length === 1 disables the fetch', async () => {
    inFn.mockResolvedValue({ data: [], error: null });

    const { wrapper } = makeWrapper();
    const { useSalesComparison } = await import('./useSalesComparison');
    renderHook(() => useSalesComparison(['2024-01']), { wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(from).not.toHaveBeenCalled();
    expect(inFn).not.toHaveBeenCalled();
  });

  it('T5 — length === 5 disables the fetch', async () => {
    inFn.mockResolvedValue({ data: [], error: null });

    const { wrapper } = makeWrapper();
    const { useSalesComparison } = await import('./useSalesComparison');
    renderHook(
      () => useSalesComparison(['a', 'b', 'c', 'd', 'e']),
      { wrapper },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(from).not.toHaveBeenCalled();
    expect(inFn).not.toHaveBeenCalled();
  });

  it('T6 — a frozen input array does not cause the hook to throw (sorts a copy)', async () => {
    inFn.mockResolvedValue({
      data: [
        { sale_number: '2024-01' },
        { sale_number: '2024-02' },
      ],
      error: null,
    });

    const frozen = Object.freeze(['2024-02', '2024-01']);
    const { wrapper } = makeWrapper();
    const { useSalesComparison } = await import('./useSalesComparison');
    const { result } = renderHook(() => useSalesComparison(frozen), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Caller's frozen array was not mutated
    expect(frozen).toEqual(['2024-02', '2024-01']);
  });
});
