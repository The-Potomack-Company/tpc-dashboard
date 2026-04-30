import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactNode } from 'react';

// Phase 2 / Plan 02-03 / Task 2 — useEventVolume.test.tsx
//
// Representative chart-hook test. The shared all-hooks-smoke parameterizes
// over all 7 chart hooks for the queryKey-fold-and-fetch invariant; this file
// focuses on the EventVolume-specific D-08 bucketing rule (today→hour, else→day)
// and the sort-arrays-into-queryKey-but-pass-URL-order-to-fetch contract.

const fetchEventVolumeMock = vi.fn();
vi.mock('../../services/extension/queries', () => ({
  fetchEventVolume: (...args: unknown[]) => fetchEventVolumeMock(...args),
}));

import { useEventVolume } from './useEventVolume';

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
  fetchEventVolumeMock.mockReset();
  fetchEventVolumeMock.mockResolvedValue([]);
});

describe('useEventVolume', () => {
  it('uses bucket=day for ?range=7d', async () => {
    renderHook(() => useEventVolume(), {
      wrapper: makeWrapper(['/?range=7d']),
    });
    await waitFor(() => expect(fetchEventVolumeMock).toHaveBeenCalledTimes(1));
    const arg = fetchEventVolumeMock.mock.calls[0][0] as { bucket: 'day' | 'hour' };
    expect(arg.bucket).toBe('day');
  });

  it('uses bucket=hour for ?range=today (D-08 today-range hourly bucketing)', async () => {
    renderHook(() => useEventVolume(), {
      wrapper: makeWrapper(['/?range=today']),
    });
    await waitFor(() => expect(fetchEventVolumeMock).toHaveBeenCalledTimes(1));
    const arg = fetchEventVolumeMock.mock.calls[0][0] as { bucket: 'day' | 'hour' };
    expect(arg.bucket).toBe('hour');
  });

  it('passes URL-order users[] to fetch (sort lives in queryKey, not in fetch args)', async () => {
    renderHook(() => useEventVolume(), {
      wrapper: makeWrapper(['/?range=7d&users=b@x.com,a@x.com']),
    });
    await waitFor(() => expect(fetchEventVolumeMock).toHaveBeenCalledTimes(1));
    const arg = fetchEventVolumeMock.mock.calls[0][0] as { users: string[] };
    expect(arg.users).toEqual(['b@x.com', 'a@x.com']); // URL order preserved
  });

  it('shares a single cache entry across users=b,a vs users=a,b (queryKey sort — Pitfall 3)', async () => {
    // Mount one hook with users=b,a inside one QueryClient.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 60_000 } },
    });
    function Wrapper1({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/?range=7d&users=b@x.com,a@x.com']}>
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
        <MemoryRouter initialEntries={['/?range=7d&users=a@x.com,b@x.com']}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    const { unmount: u1 } = renderHook(() => useEventVolume(), { wrapper: Wrapper1 });
    await waitFor(() => expect(fetchEventVolumeMock).toHaveBeenCalledTimes(1));
    u1();

    const { unmount: u2 } = renderHook(() => useEventVolume(), { wrapper: Wrapper2 });
    // Same cache key (sorted users) → no second fetch within staleTime
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchEventVolumeMock).toHaveBeenCalledTimes(1);
    u2();
  });
});
