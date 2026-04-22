// Wave-2 data hook test for Plan 05-03. Mocks the supabase client with a
// chainable object so we can assert the exact call shape (from/select/gte/lte/
// order) and the terminal resolved value. The chain-mock pattern is declared
// inline — a shared helper will be extracted if a third consumer appears.
//
// Contracts verified here:
//   1. queryKey shape — ['sales-range', start, end]
//   2. Predicate application — .gte/.lte only when range.start/end are non-null
//   3. Ordering — ASC by sale_date with nullsFirst: false
//   4. Error propagation — isError fires when Supabase returns an error
//   5. Empty-data singleton — data=null returns the frozen EMPTY_SALES_IN_RANGE
//
// The QueryClient wrapper disables retries so errors surface on the first tick.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import React from 'react';

import { rangeFromPreset, type Range } from '../lib/period';

// ---------------------------------------------------------------------------
// Supabase chain mock. Each method returns the chain object so the queryFn can
// keep appending predicates before awaiting the terminal `.order(...)`.
// ---------------------------------------------------------------------------

const gte = vi.fn().mockReturnThis();
const lte = vi.fn().mockReturnThis();
const order = vi.fn();
const select = vi.fn(() => ({ gte, lte, order }));
const from = vi.fn(() => ({ select }));

vi.mock('../lib/supabase', () => ({ supabase: { from } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  from.mockClear();
  select.mockClear();
  gte.mockClear();
  lte.mockClear();
  order.mockClear();
  // Re-wire the chain so per-test `.mockReturnThis()` stays intact.
  gte.mockReturnThis();
  lte.mockReturnThis();
});

describe('useSalesInRange', () => {
  it('builds the expected supabase chain for an l12m preset range', async () => {
    order.mockResolvedValue({ data: [], error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const { useSalesInRange } = await import('./useSalesInRange');
    const { result } = renderHook(() => useSalesInRange(range), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(from).toHaveBeenCalledWith('sales');
    expect(select).toHaveBeenCalledWith('*');
    expect(gte).toHaveBeenCalledWith('sale_date', '2025-04-22');
    expect(lte).toHaveBeenCalledWith('sale_date', '2026-04-22');
    expect(order).toHaveBeenCalledWith('sale_date', {
      ascending: true,
      nullsFirst: false,
    });
  });

  it("omits .gte and .lte when range.preset='all'", async () => {
    order.mockResolvedValue({ data: [], error: null });
    const range: Range = { start: null, end: null, preset: 'all' };

    const { useSalesInRange } = await import('./useSalesInRange');
    const { result } = renderHook(() => useSalesInRange(range), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(from).toHaveBeenCalledWith('sales');
    expect(select).toHaveBeenCalledWith('*');
    expect(gte).not.toHaveBeenCalled();
    expect(lte).not.toHaveBeenCalled();
    expect(order).toHaveBeenCalledWith('sale_date', {
      ascending: true,
      nullsFirst: false,
    });
  });

  it('uses queryKey ["sales-range", start, end] for a concrete l12m range', async () => {
    order.mockResolvedValue({ data: [], error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    // Capture the queryKey by driving the QueryClient directly — we read the
    // cache after the hook resolves and assert the key primitives.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const inlineWrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);

    const { useSalesInRange } = await import('./useSalesInRange');
    const { result } = renderHook(() => useSalesInRange(range), {
      wrapper: inlineWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryCache().findAll();
    expect(cached).toHaveLength(1);
    expect(cached[0].queryKey).toEqual([
      'sales-range',
      '2025-04-22',
      '2026-04-22',
    ]);
  });

  it('transitions to isError when supabase returns an error', async () => {
    order.mockResolvedValue({ data: null, error: new Error('boom') });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const { useSalesInRange } = await import('./useSalesInRange');
    const { result } = renderHook(() => useSalesInRange(range), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('boom'));
  });

  it('returns the frozen EMPTY_SALES_IN_RANGE singleton when data is null', async () => {
    order.mockResolvedValue({ data: null, error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const mod = await import('./useSalesInRange');
    const { result: r1 } = renderHook(() => mod.useSalesInRange(range), {
      wrapper,
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    // Second render with a fresh wrapper (new QueryClient) also returns the
    // same module-scope frozen array — reference equality proves the singleton.
    const { result: r2 } = renderHook(() => mod.useSalesInRange(range), {
      wrapper,
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    expect(r1.current.data).toBe(r2.current.data);
    expect(Object.isFrozen(r1.current.data)).toBe(true);
  });
});
