import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Phase 3 / Plan 03-03 / Task 2 — useUiRecentEventsFeed.test.tsx
//
// Mirrors src/hooks/extension/useLiveFeed.test.tsx — same fake-timer pattern.
// Verifies D-32 dev panel live-tail + Pitfall 10 (immediate refetch on resume
// via queryClient.invalidateQueries — flipping refetchInterval back to a number
// reschedules but does NOT fire immediately).

const fetchMock = vi.fn();
vi.mock('../../services/activity/queries', () => ({
  fetchUiRecentEvents: (...args: unknown[]) => fetchMock(...args),
}));

import { useUiRecentEventsFeed } from './useUiRecentEventsFeed';

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

describe('useUiRecentEventsFeed', () => {
  it('refetches every 10s while running (D-32 polling)', async () => {
    const { result } = renderHook(() => useUiRecentEventsFeed(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.paused).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('pause stops polling; resume immediately refetches and resumes (Pitfall 10)', async () => {
    const { result } = renderHook(() => useUiRecentEventsFeed(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => result.current.pause());
    expect(result.current.paused).toBe(true);

    // Pause halts the interval — advancing 20s yields zero new calls.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Resume must IMMEDIATELY refetch via invalidateQueries.
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
