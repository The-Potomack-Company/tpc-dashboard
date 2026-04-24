import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Hoisted chain stub so vi.mock (hoisted above imports) can reference it.
const { orderMock } = vi.hoisted(() => ({
  orderMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: orderMock,
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
    },
  };
});

// Import AFTER mock so the hook under test binds to the mocked supabase.
import { supabase } from '../lib/supabase';
import { useSales } from '../hooks/useSales';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useSales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses queryKey ["sales"] and returns sales sorted by sale_date DESC', async () => {
    const sale1 = { id: 'a', sale_number: '22NOV', sale_date: '2022-11-16' };
    const sale2 = { id: 'b', sale_number: '22OCT', sale_date: '2022-10-04' };
    orderMock.mockResolvedValueOnce({ data: [sale1, sale2], error: null });

    const { result } = renderHook(() => useSales(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(supabase.from).toHaveBeenCalledWith('sales');
    // Verify sort call shape — ascending:false, nullsFirst:false.
    expect(orderMock).toHaveBeenCalledWith('sale_date', {
      ascending: false,
      nullsFirst: false,
    });
    expect(result.current.data).toEqual([sale1, sale2]);
  });

  it('propagates Supabase errors into TanStack Query isError state', async () => {
    const boom = new Error('boom');
    orderMock.mockResolvedValueOnce({ data: null, error: boom });

    const { result } = renderHook(() => useSales(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBe(boom);
  });

  it('returns [] when Supabase returns null data with no error', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useSales(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([]);
  });
});
