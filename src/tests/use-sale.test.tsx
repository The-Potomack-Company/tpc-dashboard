import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Hoisted terminal stub on the chain — .from().select().eq().maybeSingle()
const { maybeSingleMock, eqMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  eqMock: vi.fn(),
}));

// Single shared chain object reused across all tests. eqMock.mockImplementation
// is re-installed in beforeEach because vi.clearAllMocks() wipes it.
const sharedChain = {
  select: vi.fn(),
  eq: eqMock,
  maybeSingle: maybeSingleMock,
};
sharedChain.select.mockReturnValue(sharedChain);

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(() => sharedChain),
    },
  };
});

import { supabase } from '../lib/supabase';
import { useSale } from '../hooks/useSale';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks wipes mockImplementation — re-wire the chain so
    // .select() and .eq() keep returning the shared chain object.
    sharedChain.select.mockReturnValue(sharedChain);
    eqMock.mockImplementation(() => sharedChain);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(sharedChain);
  });

  it('returns status "ok" with sale + departments when sale exists', async () => {
    const dept = {
      id: 'd1',
      sale_id: 's1',
      department_code: 'ASN',
      revenue: 1000,
      department: { code: 'ASN', display_name: 'Asian', auto_discovered: false },
    };
    const sale = {
      id: 's1',
      sale_number: '22OCT',
      title: 'Fall sale',
      sale_date: '2022-10-04',
      sale_departments: [dept],
    };
    maybeSingleMock.mockResolvedValueOnce({ data: sale, error: null });

    const { result } = renderHook(() => useSale('22OCT'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(supabase.from).toHaveBeenCalledWith('sales');
    expect(eqMock).toHaveBeenCalledWith('sale_number', '22OCT');

    expect(result.current.data?.status).toBe('ok');
    if (result.current.data?.status === 'ok') {
      // sale_departments key is stripped from sale, materialized on departments
      expect(result.current.data.sale).not.toHaveProperty('sale_departments');
      expect(result.current.data.sale.sale_number).toBe('22OCT');
      expect(result.current.data.departments).toEqual([dept]);
    }
  });

  it('returns status "not_found" when maybeSingle returns null data', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useSale('NOPE'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.status).toBe('not_found');
  });

  it('surfaces Supabase errors into isError', async () => {
    const dbDown = new Error('db down');
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: dbDown });

    const { result } = renderHook(() => useSale('22OCT'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBe(dbDown);
  });

  it('does NOT fire the query when saleNumber is empty (enabled: false)', async () => {
    // Intentionally do NOT queue a maybeSingle response — the hook must be
    // disabled. Queuing a response here would leak into the next test via
    // mockResolvedValueOnce FIFO and mask real bugs.

    const { result } = renderHook(() => useSale(''), {
      wrapper: makeWrapper(),
    });

    // Give react-query a tick to settle; there is no async work to await.
    await Promise.resolve();

    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isFetched).toBe(false);
  });

  it('handles sales with null sale_departments gracefully', async () => {
    const sale = {
      id: 's2',
      sale_number: '22NOV',
      title: 'Another sale',
      sale_departments: null,
    };
    maybeSingleMock.mockResolvedValueOnce({ data: sale, error: null });

    const { result } = renderHook(() => useSale('22NOV'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.status).toBe('ok');
    if (result.current.data?.status === 'ok') {
      expect(result.current.data.departments).toEqual([]);
    }
  });
});
