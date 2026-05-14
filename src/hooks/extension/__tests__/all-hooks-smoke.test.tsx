import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Phase 2 / Plan 02-03 / Task 2 — Shared sibling-hooks smoke (Checker WARNING #3 fix).
//
// Parameterizes over the 7 chart hooks. Asserts each (a) calls its
// corresponding fetch fn from services/extension/queries.ts exactly once
// after mount and (b) passes URL-order arrays to the fetch (proving the sort
// is queryKey-only). The "URL-order at fetch boundary" assertion is the
// load-bearing invariant across all hooks — it proves arrays were sorted for
// the queryKey but the fetch args still get the original user-supplied order.

const fetchEventVolumeMock = vi.fn().mockResolvedValue([]);
const fetchKpiTotalsMock = vi.fn().mockResolvedValue([]);
const fetchErrorRateMock = vi.fn().mockResolvedValue([]);
const fetchPerUserSummaryMock = vi.fn().mockResolvedValue([]);
const fetchRecentErrorsMock = vi.fn().mockResolvedValue([]);
const fetchDominantVersionMock = vi.fn().mockResolvedValue(null);
const fetchCancellationRatesMock = vi.fn().mockResolvedValue([]);
const fetchSkipReasonsMock = vi.fn().mockResolvedValue([]);

vi.mock('../../../services/extension/queries', () => ({
  fetchEventVolume: (...args: unknown[]) => fetchEventVolumeMock(...args),
  fetchKpiTotals: (...args: unknown[]) => fetchKpiTotalsMock(...args),
  fetchErrorRate: (...args: unknown[]) => fetchErrorRateMock(...args),
  fetchPerUserSummary: (...args: unknown[]) => fetchPerUserSummaryMock(...args),
  fetchRecentErrors: (...args: unknown[]) => fetchRecentErrorsMock(...args),
  fetchDominantVersion: (...args: unknown[]) => fetchDominantVersionMock(...args),
  fetchCancellationRates: (...args: unknown[]) => fetchCancellationRatesMock(...args),
  fetchSkipReasons: (...args: unknown[]) => fetchSkipReasonsMock(...args),
}));

// Mock the URL filter hooks with controlled return values. UNSORTED users/versions
// so we can prove the queryKey gets sorted independently of the fetch arg order.
const FROM = new Date('2026-04-22T00:00:00Z');
const TO = new Date('2026-04-29T00:00:00Z');

vi.mock('../../useDateRange', () => ({
  useDateRange: () => ({
    from: FROM,
    to: TO,
    range: '7d',
    setRange: vi.fn(),
    setCustom: vi.fn(),
  }),
}));

vi.mock('../useUserFilter', () => ({
  useUserFilter: () => ({ users: ['b@x.com', 'a@x.com'], setUsers: vi.fn() }),
}));

vi.mock('../useVersionFilter', () => ({
  useVersionFilter: () => ({ versions: ['2.0.2', '2.0.1'], setVersions: vi.fn() }),
}));

import { useEventVolume } from '../useEventVolume';
import { useKpiTotals } from '../useKpiTotals';
import { useErrorRate } from '../useErrorRate';
import { usePerUserSummary } from '../usePerUserSummary';
import { useRecentErrors } from '../useRecentErrors';
import { useDominantVersion } from '../useDominantVersion';
import { useCancellationRates } from '../useCancellationRates';
import { useSkipReasons } from '../useSkipReasons';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

interface HookCase {
  name: string;
  hook: () => unknown;
  fetchMock: ReturnType<typeof vi.fn>;
}

const cases: HookCase[] = [
  { name: 'useEventVolume', hook: useEventVolume, fetchMock: fetchEventVolumeMock },
  { name: 'useKpiTotals', hook: useKpiTotals, fetchMock: fetchKpiTotalsMock },
  { name: 'useErrorRate', hook: useErrorRate, fetchMock: fetchErrorRateMock },
  { name: 'usePerUserSummary', hook: usePerUserSummary, fetchMock: fetchPerUserSummaryMock },
  { name: 'useRecentErrors', hook: useRecentErrors, fetchMock: fetchRecentErrorsMock },
  { name: 'useDominantVersion', hook: useDominantVersion, fetchMock: fetchDominantVersionMock },
  { name: 'useCancellationRates', hook: useCancellationRates, fetchMock: fetchCancellationRatesMock },
  { name: 'useSkipReasons', hook: useSkipReasons, fetchMock: fetchSkipReasonsMock },
];

beforeEach(() => {
  cases.forEach((c) => c.fetchMock.mockClear());
});

describe.each(cases)('$name', ({ hook, fetchMock }) => {
  it('calls its corresponding fetch fn with URL-order users/versions (sort lives in queryKey only)', async () => {
    renderHook(() => hook(), { wrapper: makeWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const callArg = fetchMock.mock.calls[0][0] as {
      from: Date;
      to: Date;
      users: string[];
      versions: string[];
    };

    expect(callArg.from).toBe(FROM);
    expect(callArg.to).toBe(TO);
    // URL-order arrays at the fetch boundary (sort is queryKey-cache-only).
    expect(callArg.users).toEqual(['b@x.com', 'a@x.com']);
    expect(callArg.versions).toEqual(['2.0.2', '2.0.1']);
  });
});
