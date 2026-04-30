import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Phase 2 / Plan 02-03 / Task 3 — useLiveFeed.test.tsx
//
// Fake-timer test pattern from RESEARCH Q2 lines 952-957. The {
// shouldAdvanceTime: true } flag matters — without it microtasks queued
// from invalidateQueries may stall and the immediate-refetch assertion
// times out.

const fetchMock = vi.fn();
vi.mock('../../services/extension/queries', () => ({
  fetchLiveFeed: (...args: unknown[]) => fetchMock(...args),
}));

import { useLiveFeed } from './useLiveFeed';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue([]);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLiveFeed', () => {
  it('refetches every 10s while running (D-10)', async () => {
    const { result } = renderHook(() => useLiveFeed(), { wrapper: makeWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.paused).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('Pause stops polling; Resume immediately refetches and resumes (D-09/D-10/D-11 + Pitfall 4)', async () => {
    const { result } = renderHook(() => useLiveFeed(), { wrapper: makeWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => result.current.pause());
    expect(result.current.paused).toBe(true);

    // Pause halts the interval — advancing 20s yields zero new calls.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Resume must IMMEDIATELY refetch (D-11 + Pitfall 4 mitigation via
    // queryClient.invalidateQueries inside the resume callback).
    await act(async () => {
      result.current.resume();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.paused).toBe(false);

    // After Resume, the 10s interval also resumes — advance 10s for tick #3.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });
});
