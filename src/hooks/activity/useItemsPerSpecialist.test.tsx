import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactNode } from 'react';

// Phase 3 / Plan 03-03 / Task 2 — useItemsPerSpecialist.test.tsx
//
// Verifies the load-bearing fixed-window contract (D-16):
//   - Hook does NOT consume useDateRange (no from/to in fetch arg).
//   - Specialist array is sorted in queryKey but URL-order in fetch arg.
//   - Mode flows verbatim into fetch arg.
//   - Cache key collapses ?specialists=a,b and ?specialists=b,a → same fetch hits once.

const fetchItemsPerSpecialist14dMock = vi.fn();
vi.mock('../../services/activity/queries', () => ({
  fetchItemsPerSpecialist14d: (...args: unknown[]) =>
    fetchItemsPerSpecialist14dMock(...args),
}));

import { useItemsPerSpecialist } from './useItemsPerSpecialist';

function makeWrapper(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fetchItemsPerSpecialist14dMock.mockReset();
  fetchItemsPerSpecialist14dMock.mockResolvedValue([]);
});

describe('useItemsPerSpecialist', () => {
  it('passes URL-order specialists + mode to fetcher (sort lives in queryKey only)', async () => {
    renderHook(() => useItemsPerSpecialist(), {
      wrapper: makeWrapper(['/?specialists=b%40x.com,a%40x.com&mode=house']),
    });
    await waitFor(() =>
      expect(fetchItemsPerSpecialist14dMock).toHaveBeenCalledTimes(1),
    );
    const arg = fetchItemsPerSpecialist14dMock.mock.calls[0][0] as {
      specialists: string[];
      mode: 'house' | 'sale' | 'all';
    };
    expect(arg.specialists).toEqual(['b@x.com', 'a@x.com']); // URL order preserved
    expect(arg.mode).toBe('house');
  });

  it('does NOT consume useDateRange — varying ?range= does not trigger refetch (D-16 fixed-window)', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 60_000 } },
    });
    function Wrapper1({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/?range=today&specialists=a%40x.com&mode=all']}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }
    function Wrapper2({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/?range=30d&specialists=a%40x.com&mode=all']}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    const { unmount: u1 } = renderHook(() => useItemsPerSpecialist(), {
      wrapper: Wrapper1,
    });
    await waitFor(() =>
      expect(fetchItemsPerSpecialist14dMock).toHaveBeenCalledTimes(1),
    );
    u1();

    const { unmount: u2 } = renderHook(() => useItemsPerSpecialist(), {
      wrapper: Wrapper2,
    });
    // Same cache key (range ignored, sorted specialists, mode unchanged) → no second fetch.
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchItemsPerSpecialist14dMock).toHaveBeenCalledTimes(1);
    u2();
  });

  it('shares cache between ?specialists=b,a and ?specialists=a,b (sorted queryKey — Pitfall 3)', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 60_000 } },
    });
    function Wrapper1({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/?specialists=b%40x.com,a%40x.com']}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }
    function Wrapper2({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/?specialists=a%40x.com,b%40x.com']}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    const { unmount: u1 } = renderHook(() => useItemsPerSpecialist(), {
      wrapper: Wrapper1,
    });
    await waitFor(() =>
      expect(fetchItemsPerSpecialist14dMock).toHaveBeenCalledTimes(1),
    );
    u1();

    const { unmount: u2 } = renderHook(() => useItemsPerSpecialist(), {
      wrapper: Wrapper2,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchItemsPerSpecialist14dMock).toHaveBeenCalledTimes(1);
    u2();
  });
});
