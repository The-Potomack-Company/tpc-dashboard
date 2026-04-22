// Wave-2 data hook test for Plan 05-03 — useDepartmentGrid. Mirrors the
// chain-mock pattern from useSalesInRange.test.ts. Separate mock so each
// file resets fully between runs and the two tests can execute in parallel
// without sharing spy state.
//
// Contracts verified here:
//   1. Exact embedded-relation select string (sale-level `lots_sold` hoisted)
//   2. Predicate application — .gte/.lte only when range.start/end are non-null
//   3. queryKey shape — ['dept-grid', start, end]
//   4. Shape preservation — embedded sale_departments array is passed through
//   5. Error propagation — isError fires when Supabase returns an error
//   6. Empty-data singleton — data=null returns the frozen EMPTY_GRID

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import React from 'react';

import { rangeFromPreset, type Range } from '../lib/period';

const gte = vi.fn().mockReturnThis();
const lte = vi.fn().mockReturnThis();
const order = vi.fn();
const select = vi.fn(() => ({ gte, lte, order }));
const from = vi.fn(() => ({ select }));

vi.mock('../lib/supabase', () => ({ supabase: { from } }));

const EXPECTED_SELECT =
  'sale_number, sale_date, lots_sold, sale_departments(department_code, sell_through_pct, revenue, total_sold_value, lots_sold, low_estimate, high_estimate)';

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
  gte.mockReturnThis();
  lte.mockReturnThis();
});

describe('useDepartmentGrid', () => {
  it('builds the expected supabase chain with embedded sale_departments', async () => {
    order.mockResolvedValue({ data: [], error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const { useDepartmentGrid } = await import('./useDepartmentGrid');
    const { result } = renderHook(() => useDepartmentGrid(range), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(from).toHaveBeenCalledWith('sales');
    expect(select).toHaveBeenCalledWith(EXPECTED_SELECT);
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

    const { useDepartmentGrid } = await import('./useDepartmentGrid');
    const { result } = renderHook(() => useDepartmentGrid(range), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(select).toHaveBeenCalledWith(EXPECTED_SELECT);
    expect(gte).not.toHaveBeenCalled();
    expect(lte).not.toHaveBeenCalled();
    expect(order).toHaveBeenCalledWith('sale_date', {
      ascending: true,
      nullsFirst: false,
    });
  });

  it('uses queryKey ["dept-grid", start, end]', async () => {
    order.mockResolvedValue({ data: [], error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const inlineWrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);

    const { useDepartmentGrid } = await import('./useDepartmentGrid');
    const { result } = renderHook(() => useDepartmentGrid(range), {
      wrapper: inlineWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryCache().findAll();
    expect(cached).toHaveLength(1);
    expect(cached[0].queryKey).toEqual([
      'dept-grid',
      '2025-04-22',
      '2026-04-22',
    ]);
  });

  it('passes through embedded sale_departments shape unchanged', async () => {
    const row = {
      sale_number: 'S0001',
      sale_date: '2026-03-01',
      lots_sold: 120,
      sale_departments: [
        {
          department_code: 'ART',
          sell_through_pct: 72.5,
          revenue: 45000,
          total_sold_value: 44000,
          lots_sold: 40,
          low_estimate: 30000,
          high_estimate: 50000,
        },
        {
          department_code: 'JWL',
          sell_through_pct: 85.0,
          revenue: 90000,
          total_sold_value: 92000,
          lots_sold: 80,
          low_estimate: 75000,
          high_estimate: 95000,
        },
      ],
    };
    order.mockResolvedValue({ data: [row], error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const { useDepartmentGrid } = await import('./useDepartmentGrid');
    const { result } = renderHook(() => useDepartmentGrid(range), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    const r = result.current.data![0];
    expect(r.sale_number).toBe('S0001');
    expect(r.sale_date).toBe('2026-03-01');
    expect(r.lots_sold).toBe(120);
    expect(r.sale_departments).toHaveLength(2);
    expect(r.sale_departments[0].department_code).toBe('ART');
    expect(r.sale_departments[0].sell_through_pct).toBe(72.5);
    expect(r.sale_departments[1].lots_sold).toBe(80);
  });

  it('transitions to isError when supabase returns an error', async () => {
    order.mockResolvedValue({ data: null, error: new Error('boom') });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const { useDepartmentGrid } = await import('./useDepartmentGrid');
    const { result } = renderHook(() => useDepartmentGrid(range), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('boom'));
  });

  it('returns the frozen EMPTY_GRID singleton when data is null', async () => {
    order.mockResolvedValue({ data: null, error: null });
    const range: Range = rangeFromPreset(
      'l12m',
      new Date('2026-04-22T12:00:00'),
    );

    const mod = await import('./useDepartmentGrid');
    const { result: r1 } = renderHook(() => mod.useDepartmentGrid(range), {
      wrapper,
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { result: r2 } = renderHook(() => mod.useDepartmentGrid(range), {
      wrapper,
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    expect(r1.current.data).toBe(r2.current.data);
    expect(Object.isFrozen(r1.current.data)).toBe(true);
  });
});
