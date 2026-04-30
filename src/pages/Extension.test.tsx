import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ExtensionPage } from './Extension';

// Phase 2 / Plan 02-08 — Page composition smoke test.
//
// The empty-gate branch lives ONLY at this page level (D-19 + Pattern 5);
// per-chart conditional rendering is forbidden because it would slow first
// paint with N+1 emptiness probes. We mock useExtensionGate to flip between
// the three branches (loading / empty / ready) and assert that:
//   1. loading branch shows a skeleton AND keeps the filter row
//   2. empty branch renders header + EmptyState ONLY (no chart testids in DOM)
//   3. ready branch mounts ALL section components in layout order
//
// All section components are stubbed to keep the smoke test focused on
// composition, not on each child's inner rendering (those are covered by
// each component's own colocated suite under src/components/extension/).

const gateMock = vi.fn();
vi.mock('../hooks/extension/useExtensionGate', () => ({
  useExtensionGate: () => gateMock(),
}));

vi.mock('../components/kit/DateRangeFilter', () => ({
  DateRangeFilter: () => <div data-testid="date-range-filter" />,
}));
vi.mock('../components/UserMultiSelect', () => ({
  UserMultiSelect: () => <div data-testid="user-multi-select" />,
}));
vi.mock('../components/extension/EventVolumeChart', () => ({
  EventVolumeChart: () => <div data-testid="event-volume-chart" />,
}));
vi.mock('../components/extension/KpiStrip', () => ({
  KpiStrip: () => <div data-testid="kpi-strip" />,
}));
vi.mock('../components/extension/ErrorRateChart', () => ({
  ErrorRateChart: () => <div data-testid="error-rate-chart" />,
}));
vi.mock('../components/extension/PerUserTable', () => ({
  PerUserTable: () => <div data-testid="per-user-table" />,
}));
vi.mock('../components/extension/RecentErrorsTable', () => ({
  RecentErrorsTable: () => <div data-testid="recent-errors-table" />,
}));
vi.mock('../components/extension/LiveEventFeed', () => ({
  LiveEventFeed: () => <div data-testid="live-event-feed" />,
}));
vi.mock('../components/extension/DeveloperPanel', () => ({
  DeveloperPanel: () => <div data-testid="developer-panel" />,
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/extension']}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ExtensionPage', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    gateMock.mockReset();
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('shows page-level loading skeleton when gate.isLoading (filters still rendered)', () => {
    gateMock.mockReturnValue({ isLoading: true, isEmpty: false, error: null });
    render(<ExtensionPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('extension-page-loading')).toBeInTheDocument();
    // Filter row still renders (UI-SPEC § Empty gate layout — filters
    // survive even gating branches; loading branch is a sibling of empty).
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    expect(screen.getByTestId('user-multi-select')).toBeInTheDocument();

    // No chart sections mounted while loading.
    expect(screen.queryByTestId('event-volume-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-rate-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('per-user-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recent-errors-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('live-event-feed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('developer-panel')).not.toBeInTheDocument();
    // Empty-state copy must NOT show during loading.
    expect(screen.queryByText('No extension events yet')).not.toBeInTheDocument();
  });

  it('D-19: when gate.isEmpty, renders only header + EmptyState — no chart sections in DOM', () => {
    gateMock.mockReturnValue({ isLoading: false, isEmpty: true, error: null });
    render(<ExtensionPage />, { wrapper: makeWrapper() });

    expect(screen.getByText('No extension events yet')).toBeInTheDocument();
    expect(screen.getByTestId('extension-page-empty')).toBeInTheDocument();

    // The CRITICAL D-19 invariant: no chart testids may appear when the
    // page is gated empty. Pattern 5 — empty-gate branch is the SINGLE
    // place charts get short-circuited, never per-chart.
    expect(screen.queryByTestId('event-volume-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-rate-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('per-user-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recent-errors-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('live-event-feed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('developer-panel')).not.toBeInTheDocument();

    // BUT the filter row IS still rendered (UI-SPEC § Empty gate layout).
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    expect(screen.getByTestId('user-multi-select')).toBeInTheDocument();
  });

  it('when gate is ready, mounts ALL section components in layout order', () => {
    gateMock.mockReturnValue({ isLoading: false, isEmpty: false, error: null });
    render(<ExtensionPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('event-volume-chart')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-strip')).toBeInTheDocument();
    expect(screen.getByTestId('error-rate-chart')).toBeInTheDocument();
    expect(screen.getByTestId('per-user-table')).toBeInTheDocument();
    expect(screen.getByTestId('recent-errors-table')).toBeInTheDocument();
    expect(screen.getByTestId('live-event-feed')).toBeInTheDocument();
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();

    // Filter row also present in ready state.
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    expect(screen.getByTestId('user-multi-select')).toBeInTheDocument();

    // No empty-state copy in ready state.
    expect(screen.queryByText('No extension events yet')).not.toBeInTheDocument();
  });

  it('renders Extension Analytics heading + subtitle', () => {
    gateMock.mockReturnValue({ isLoading: false, isEmpty: false, error: null });
    render(<ExtensionPage />, { wrapper: makeWrapper() });

    expect(
      screen.getByRole('heading', { name: 'Extension Analytics' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Cataloger Chrome extension activity'),
    ).toBeInTheDocument();
  });

  it('sets document.title to "Extension — TPC Dashboard" after mount', () => {
    gateMock.mockReturnValue({ isLoading: false, isEmpty: false, error: null });
    render(<ExtensionPage />, { wrapper: makeWrapper() });

    expect(document.title).toBe('Extension — TPC Dashboard');
  });

  it('section composition order: EXT-01 → EXT-02 → EXT-03 → EXT-04+05 → EXT-08 → DeveloperPanel', () => {
    gateMock.mockReturnValue({ isLoading: false, isEmpty: false, error: null });
    const { container } = render(<ExtensionPage />, { wrapper: makeWrapper() });

    const ids = [
      'event-volume-chart',
      'kpi-strip',
      'error-rate-chart',
      'per-user-table',
      'recent-errors-table',
      'live-event-feed',
      'developer-panel',
    ];
    const positions = ids.map((id) => {
      const el = container.querySelector(`[data-testid="${id}"]`);
      if (!el) throw new Error(`missing testid ${id}`);
      // sourceIndex isn't reliable in jsdom; use compareDocumentPosition vs
      // the previous element as a relative-order check.
      return el;
    });
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      // DOCUMENT_POSITION_FOLLOWING bit (0x04) — curr should follow prev.
      const rel = prev.compareDocumentPosition(curr);
      expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });
});
