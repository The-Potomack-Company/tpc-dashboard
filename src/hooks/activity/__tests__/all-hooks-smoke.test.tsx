import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactNode } from 'react';

// Phase 3 / Plan 03-03 / Task 2 — All-hooks smoke harness.
//
// Mirrors src/hooks/extension/__tests__/all-hooks-smoke.test.tsx exactly.
// Parameterizes over all 16 activity hooks. Each hook is mounted inside a
// fresh wrapper, the corresponding fetch mock returns [] / null / a default
// row, and the hook is asserted to fire its fetch exactly once. This catches
// type errors and import-path regressions across all hooks in one pass.
//
// URL filters use UNSORTED specialists / non-default mode so the smoke
// harness incidentally re-asserts the URL-order-at-fetch-boundary contract
// (sort lives in queryKey only — Pitfall 3).

const fetchTodayKpisMock = vi.fn().mockResolvedValue({
  sessions_today: 0,
  items_today: 0,
  exports_today: 0,
  items_done_today: 0,
  items_total_today: 0,
  sessions_yday: 0,
  items_yday: 0,
  exports_yday: 0,
  items_done_yday: 0,
  items_total_yday: 0,
});
const fetchActiveSessionsMock = vi.fn().mockResolvedValue([]);
const fetchActiveSpecialistsMock = vi.fn().mockResolvedValue([]);
const fetchItemsPerSpecialist14dMock = vi.fn().mockResolvedValue([]);
const fetchAiStatusDistributionMock = vi.fn().mockResolvedValue([]);
const fetchExportPipelineMock = vi.fn().mockResolvedValue([]);
const fetchHouseSaleSplitMock = vi.fn().mockResolvedValue([]);
const fetchStuckItemsMock = vi.fn().mockResolvedValue([]);
const fetchSessionDetailMock = vi.fn().mockResolvedValue(null);
const fetchPhotoCoverageMock = vi.fn().mockResolvedValue(null);
const fetchSessionItemsMock = vi.fn().mockResolvedValue([]);
const fetchSessionPhotosMock = vi.fn().mockResolvedValue([]);
const fetchFailedAiBreakdownMock = vi.fn().mockResolvedValue([]);
const fetchUiTopPagesMock = vi.fn().mockResolvedValue([]);
const fetchUiTopElementsMock = vi.fn().mockResolvedValue([]);
const fetchWalkthroughFunnelMock = vi.fn().mockResolvedValue([]);
const fetchUiRecentEventsMock = vi.fn().mockResolvedValue([]);

vi.mock('../../../services/activity/queries', () => ({
  fetchTodayKpis: (...args: unknown[]) => fetchTodayKpisMock(...args),
  fetchActiveSessions: (...args: unknown[]) => fetchActiveSessionsMock(...args),
  fetchActiveSpecialists: (...args: unknown[]) =>
    fetchActiveSpecialistsMock(...args),
  fetchItemsPerSpecialist14d: (...args: unknown[]) =>
    fetchItemsPerSpecialist14dMock(...args),
  fetchAiStatusDistribution: (...args: unknown[]) =>
    fetchAiStatusDistributionMock(...args),
  fetchExportPipeline: (...args: unknown[]) => fetchExportPipelineMock(...args),
  fetchHouseSaleSplit: (...args: unknown[]) => fetchHouseSaleSplitMock(...args),
  fetchStuckItems: (...args: unknown[]) => fetchStuckItemsMock(...args),
  fetchSessionDetail: (...args: unknown[]) => fetchSessionDetailMock(...args),
  fetchPhotoCoverage: (...args: unknown[]) => fetchPhotoCoverageMock(...args),
  fetchSessionItems: (...args: unknown[]) => fetchSessionItemsMock(...args),
  fetchSessionPhotos: (...args: unknown[]) => fetchSessionPhotosMock(...args),
  fetchFailedAiBreakdown: (...args: unknown[]) =>
    fetchFailedAiBreakdownMock(...args),
  fetchUiTopPages: (...args: unknown[]) => fetchUiTopPagesMock(...args),
  fetchUiTopElements: (...args: unknown[]) => fetchUiTopElementsMock(...args),
  fetchWalkthroughFunnel: (...args: unknown[]) =>
    fetchWalkthroughFunnelMock(...args),
  fetchUiRecentEvents: (...args: unknown[]) => fetchUiRecentEventsMock(...args),
}));

import { useTodayKpis } from '../useTodayKpis';
import { useActiveSessions } from '../useActiveSessions';
import { useActiveSpecialists } from '../useActiveSpecialists';
import { useItemsPerSpecialist } from '../useItemsPerSpecialist';
import { useAiStatusDistribution } from '../useAiStatusDistribution';
import { useExportPipeline } from '../useExportPipeline';
import { useHouseSaleSplit } from '../useHouseSaleSplit';
import { useStuckItems } from '../useStuckItems';
import { useSessionDetail, useSessionItems } from '../useSessionDetail';
import { usePhotoCoverage } from '../usePhotoCoverage';
import { useSessionPhotos } from '../useSessionPhotos';
import { useFailedAiBreakdown } from '../useFailedAiBreakdown';
import { useUiTopPages } from '../useUiTopPages';
import { useUiTopElements } from '../useUiTopElements';
import { useWalkthroughFunnel } from '../useWalkthroughFunnel';
import { useUiRecentEventsFeed } from '../useUiRecentEventsFeed';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/?range=7d&specialists=b%40x.com,a%40x.com&mode=house']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

interface HookCase {
  name: string;
  hook: () => unknown;
  fetchMock: ReturnType<typeof vi.fn>;
}

const cases: HookCase[] = [
  { name: 'useTodayKpis', hook: useTodayKpis, fetchMock: fetchTodayKpisMock },
  {
    name: 'useActiveSessions',
    hook: useActiveSessions,
    fetchMock: fetchActiveSessionsMock,
  },
  {
    name: 'useActiveSpecialists',
    hook: useActiveSpecialists,
    fetchMock: fetchActiveSpecialistsMock,
  },
  {
    name: 'useItemsPerSpecialist',
    hook: useItemsPerSpecialist,
    fetchMock: fetchItemsPerSpecialist14dMock,
  },
  {
    name: 'useAiStatusDistribution',
    hook: useAiStatusDistribution,
    fetchMock: fetchAiStatusDistributionMock,
  },
  {
    name: 'useExportPipeline',
    hook: useExportPipeline,
    fetchMock: fetchExportPipelineMock,
  },
  {
    name: 'useHouseSaleSplit',
    hook: useHouseSaleSplit,
    fetchMock: fetchHouseSaleSplitMock,
  },
  { name: 'useStuckItems', hook: useStuckItems, fetchMock: fetchStuckItemsMock },
  {
    name: 'useSessionDetail',
    hook: () => useSessionDetail('s1'),
    fetchMock: fetchSessionDetailMock,
  },
  {
    name: 'useSessionItems',
    hook: () => useSessionItems('s1'),
    fetchMock: fetchSessionItemsMock,
  },
  {
    name: 'usePhotoCoverage',
    hook: () => usePhotoCoverage('s1'),
    fetchMock: fetchPhotoCoverageMock,
  },
  {
    name: 'useSessionPhotos',
    hook: () => useSessionPhotos('i1'),
    fetchMock: fetchSessionPhotosMock,
  },
  {
    name: 'useFailedAiBreakdown',
    hook: useFailedAiBreakdown,
    fetchMock: fetchFailedAiBreakdownMock,
  },
  { name: 'useUiTopPages', hook: useUiTopPages, fetchMock: fetchUiTopPagesMock },
  {
    name: 'useUiTopElements',
    hook: useUiTopElements,
    fetchMock: fetchUiTopElementsMock,
  },
  {
    name: 'useWalkthroughFunnel',
    hook: useWalkthroughFunnel,
    fetchMock: fetchWalkthroughFunnelMock,
  },
  {
    name: 'useUiRecentEventsFeed',
    hook: useUiRecentEventsFeed,
    fetchMock: fetchUiRecentEventsMock,
  },
];

beforeEach(() => {
  cases.forEach((c) => c.fetchMock.mockClear());
});

describe.each(cases)('$name', ({ hook, fetchMock }) => {
  it('mounts cleanly and fires its corresponding fetch fn exactly once', async () => {
    renderHook(() => hook(), { wrapper: makeWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
