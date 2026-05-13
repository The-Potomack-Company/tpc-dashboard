import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactNode } from 'react';

// Phase 3 / Plan 03-03 / Task 2 — useStuckItems.test.tsx
//
// Verifies the right-now classification (D-18 / D-24):
//   - Hook does NOT pass `from` / `to` to fetcher.
//   - Specialist + mode filters DO fold into fetch args.
//   - Specialist array is sorted in queryKey but URL-order in fetch arg.

const fetchStuckItemsMock = vi.fn();
vi.mock('../../services/activity/queries', () => ({
  fetchStuckItems: (...args: unknown[]) => fetchStuckItemsMock(...args),
}));

import { useStuckItems } from './useStuckItems';

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
  fetchStuckItemsMock.mockReset();
  fetchStuckItemsMock.mockResolvedValue([]);
});

describe('useStuckItems', () => {
  it('right-now class: NO from/to in fetch arg', async () => {
    renderHook(() => useStuckItems(), {
      wrapper: makeWrapper(['/?specialists=a%40x.com&mode=sale']),
    });
    await waitFor(() => expect(fetchStuckItemsMock).toHaveBeenCalledTimes(1));
    const arg = fetchStuckItemsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty('from');
    expect(arg).not.toHaveProperty('to');
  });

  it('passes specialists (URL order) + mode to fetcher', async () => {
    renderHook(() => useStuckItems(), {
      wrapper: makeWrapper(['/?specialists=b%40x.com,a%40x.com&mode=house']),
    });
    await waitFor(() => expect(fetchStuckItemsMock).toHaveBeenCalledTimes(1));
    const arg = fetchStuckItemsMock.mock.calls[0][0] as {
      specialists: string[];
      mode: 'house' | 'sale' | 'all';
    };
    expect(arg.specialists).toEqual(['b@x.com', 'a@x.com']);
    expect(arg.mode).toBe('house');
  });

  it('shares cache across ?specialists=b,a and ?specialists=a,b (sorted queryKey)', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 60_000 } },
    });
    function Wrapper1({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/?specialists=b%40x.com,a%40x.com&mode=all']}>
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
        <MemoryRouter initialEntries={['/?specialists=a%40x.com,b%40x.com&mode=all']}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    const { unmount: u1 } = renderHook(() => useStuckItems(), { wrapper: Wrapper1 });
    await waitFor(() => expect(fetchStuckItemsMock).toHaveBeenCalledTimes(1));
    u1();

    const { unmount: u2 } = renderHook(() => useStuckItems(), { wrapper: Wrapper2 });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchStuckItemsMock).toHaveBeenCalledTimes(1);
    u2();
  });
});
