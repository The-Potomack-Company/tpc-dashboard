import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityPage } from './Activity';

// Phase 3 / Plan 03-08 — Activity page composition smoke test.
//
// D-01 locks the section composition order; D-37 says NO full-page empty
// gate (each section renders with its own per-card empty/loading/error
// states). This test mocks every child as a stub testid so we can assert
// the page-level shape without coupling to each child's internal rendering.
//
// Per-card behavior is covered by each component's own colocated suite.

vi.mock('../components/kit/DateRangeFilter', () => ({
  DateRangeFilter: () => <div data-testid="date-range-filter" />,
}));
vi.mock('../components/SpecialistMultiSelect', () => ({
  SpecialistMultiSelect: () => <div data-testid="specialist-multi-select" />,
}));
vi.mock('../components/ModeToggle', () => ({
  ModeToggle: () => <div data-testid="mode-toggle" />,
}));
vi.mock('../components/activity/TodayKpiStrip', () => ({
  TodayKpiStrip: () => <div data-testid="today-kpi-strip" />,
}));
vi.mock('../components/activity/ActiveSessionsTable', () => ({
  ActiveSessionsTable: () => <div data-testid="active-sessions-table" />,
}));
vi.mock('../components/activity/StuckItemsAlertCard', () => ({
  StuckItemsAlertCard: () => <div data-testid="stuck-items-alert-card" />,
}));
vi.mock('../components/activity/ItemsPerSpecialistChart', () => ({
  ItemsPerSpecialistChart: () => <div data-testid="items-per-specialist-chart" />,
}));
vi.mock('../components/activity/AiStatusDonut', () => ({
  AiStatusDonut: () => <div data-testid="ai-status-donut" />,
}));
vi.mock('../components/activity/HouseSaleSplit', () => ({
  HouseSaleSplit: () => <div data-testid="house-sale-split" />,
}));
vi.mock('../components/activity/ExportPipelineChart', () => ({
  ExportPipelineChart: () => <div data-testid="export-pipeline-chart" />,
}));
vi.mock('../components/activity/DeveloperPanel', () => ({
  DeveloperPanel: () => <div data-testid="developer-panel" />,
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/activity']}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ActivityPage', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = originalTitle;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('renders the Activity heading and subtitle (UI-SPEC § Page titles)', () => {
    render(<ActivityPage />, { wrapper: makeWrapper() });

    expect(
      screen.getByRole('heading', { name: 'Activity', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('TPC team cataloging activity'),
    ).toBeInTheDocument();
  });

  it('renders the filter row with DateRangeFilter, SpecialistMultiSelect, ModeToggle in order', () => {
    const { container } = render(<ActivityPage />, { wrapper: makeWrapper() });

    const dateRange = screen.getByTestId('date-range-filter');
    const specialists = screen.getByTestId('specialist-multi-select');
    const modeToggle = screen.getByTestId('mode-toggle');

    expect(dateRange).toBeInTheDocument();
    expect(specialists).toBeInTheDocument();
    expect(modeToggle).toBeInTheDocument();

    // Order: DateRangeFilter → SpecialistMultiSelect → ModeToggle
    const filters = [dateRange, specialists, modeToggle];
    for (let i = 1; i < filters.length; i++) {
      const rel = filters[i - 1].compareDocumentPosition(filters[i]);
      expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    // Ensure the filter testids exist within the page (not just the wrapper).
    expect(container.contains(dateRange)).toBe(true);
  });

  it('D-01: composes all 8 admin sections in locked order', () => {
    const { container } = render(<ActivityPage />, { wrapper: makeWrapper() });

    const ids = [
      'today-kpi-strip',
      'active-sessions-table',
      'stuck-items-alert-card',
      'items-per-specialist-chart',
      'ai-status-donut',
      'house-sale-split',
      'export-pipeline-chart',
      'developer-panel',
    ];
    const elements = ids.map((id) => {
      const el = container.querySelector(`[data-testid="${id}"]`);
      if (!el) throw new Error(`missing testid ${id}`);
      return el;
    });

    for (let i = 1; i < elements.length; i++) {
      const rel = elements[i - 1].compareDocumentPosition(elements[i]);
      expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it('mounts DeveloperPanel unconditionally (it self-gates by isDevAccount)', () => {
    render(<ActivityPage />, { wrapper: makeWrapper() });
    // The mock always renders; the real component would render null for
    // non-dev users. The page-level mount call MUST be unconditional.
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
  });

  it('sets document.title to "Activity — TPC Dashboard" on mount and restores on unmount', () => {
    document.title = 'Original Title';
    const { unmount } = render(<ActivityPage />, { wrapper: makeWrapper() });

    expect(document.title).toBe('Activity — TPC Dashboard');

    unmount();
    expect(document.title).toBe('Original Title');
  });

  it('D-37: NO full-page empty gate — every section renders even with no data', () => {
    // Even when child queries are empty, the page does NOT short-circuit;
    // each card renders with its own per-card empty state. This test
    // verifies the absence of a page-level branching that would hide
    // sections (Phase 2 Extension.tsx had one; Phase 3 Activity must NOT).
    render(<ActivityPage />, { wrapper: makeWrapper() });

    // All 8 sections must be in the DOM regardless of child query state.
    expect(screen.getByTestId('today-kpi-strip')).toBeInTheDocument();
    expect(screen.getByTestId('active-sessions-table')).toBeInTheDocument();
    expect(screen.getByTestId('stuck-items-alert-card')).toBeInTheDocument();
    expect(screen.getByTestId('items-per-specialist-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ai-status-donut')).toBeInTheDocument();
    expect(screen.getByTestId('house-sale-split')).toBeInTheDocument();
    expect(screen.getByTestId('export-pipeline-chart')).toBeInTheDocument();
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();

    // No empty-state copy from a hypothetical full-page gate.
    expect(
      screen.queryByText(/no activity yet/i),
    ).not.toBeInTheDocument();
  });

  it('uses a <main> semantic element as the outer container', () => {
    const { container } = render(<ActivityPage />, { wrapper: makeWrapper() });
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    // Page header + sections live inside <main>.
    expect(main!.querySelector('[data-testid="today-kpi-strip"]')).not.toBeNull();
  });
});
