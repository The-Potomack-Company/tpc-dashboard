import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Phase 5 Plan 05-07 Task 1 — integration test for the TrendsPage composition.
// Contract: .planning/phases/05-trend-analysis/05-07-PLAN.md § <behavior>.
// REQ-IDs covered: TRND-01..06 + INTR-03 (wiring verified via prop forwarding).
//
// Strategy: mock the 5 chart components so Recharts never renders under jsdom.
// DateRangeFilter + MetricToggle are kept real so keyboard/click behavior is
// exercised end-to-end through the page. Each chart mock re-emits its props
// as `data-range` / `data-metric` attributes so the test can assert that
// range/metric state flows down correctly when the filter/toggle is used.

// Chart mocks — must be declared before the component import so vi.mock
// hoists them above the TrendsPage import at the bottom of this block.
vi.mock('../components/NetRevenueTrendChart', () => ({
  NetRevenueTrendChart: (props: { range: unknown }) => (
    <div data-testid="net-rev" data-range={JSON.stringify(props.range)} />
  ),
}));
vi.mock('../components/SellThroughTrendChart', () => ({
  SellThroughTrendChart: (props: { range: unknown }) => (
    <div data-testid="sell-through" data-range={JSON.stringify(props.range)} />
  ),
}));
vi.mock('../components/EstimateAccuracyChart', () => ({
  EstimateAccuracyChart: (props: { range: unknown }) => (
    <div data-testid="estimate-accuracy" data-range={JSON.stringify(props.range)} />
  ),
}));
vi.mock('../components/BidderParticipationChart', () => ({
  BidderParticipationChart: (props: { range: unknown }) => (
    <div data-testid="bidder-participation" data-range={JSON.stringify(props.range)} />
  ),
}));
vi.mock('../components/DepartmentHeatMap', () => ({
  DepartmentHeatMap: (props: { range: unknown; metric: string }) => (
    <div
      data-testid="heat-map"
      data-range={JSON.stringify(props.range)}
      data-metric={props.metric}
    />
  ),
}));

// Import AFTER mocks so TrendsPage binds to the mocked chart components.
import { TrendsPage } from '../pages/Trends';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/trends']}>
        <TrendsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Trends page (integration)', () => {
  it('renders the Trends h1 heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Trends' }),
    ).toBeInTheDocument();
  });

  it('renders the DateRangeFilter fieldset', () => {
    renderPage();
    expect(
      screen.getByRole('group', { name: 'Select date range' }),
    ).toBeInTheDocument();
  });

  it('renders all 5 ChartCard h2 titles in the locked UI-SPEC order', () => {
    renderPage();
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent?.trim());
    expect(titles).toEqual([
      'Net revenue per sale',
      'Sell-through per sale',
      'Estimate accuracy over time',
      'Bidder participation',
      'Department performance',
    ]);
  });

  it('renders the MetricToggle fieldset in the heat-map card', () => {
    renderPage();
    expect(
      screen.getByRole('group', { name: 'Select heat map metric' }),
    ).toBeInTheDocument();
  });

  it('default range preset is l12m on first render', () => {
    renderPage();
    const netRev = screen.getByTestId('net-rev');
    const range = JSON.parse(netRev.getAttribute('data-range') ?? '{}');
    expect(range.preset).toBe('l12m');
  });

  it('clicking YTD updates range.preset on every chart', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'YTD' }));

    for (const id of [
      'net-rev',
      'sell-through',
      'estimate-accuracy',
      'bidder-participation',
      'heat-map',
    ]) {
      const range = JSON.parse(
        screen.getByTestId(id).getAttribute('data-range') ?? '{}',
      );
      expect(range.preset).toBe('ytd');
    }
  });

  it('default metric is sell_through on first render', () => {
    renderPage();
    const heat = screen.getByTestId('heat-map');
    expect(heat.getAttribute('data-metric')).toBe('sell_through');
  });

  it('clicking Revenue share % flips the heat-map metric', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Revenue share %' }));

    expect(screen.getByTestId('heat-map').getAttribute('data-metric')).toBe(
      'revenue_share',
    );
  });

  it('metric toggle does NOT change the range prop passed to line/area charts', async () => {
    const user = userEvent.setup();
    renderPage();

    const beforeRange = screen
      .getByTestId('net-rev')
      .getAttribute('data-range');

    await user.click(screen.getByRole('radio', { name: 'Revenue share %' }));

    const afterRange = screen
      .getByTestId('net-rev')
      .getAttribute('data-range');
    expect(afterRange).toBe(beforeRange);
  });

  it('sets document.title to "Trends — TPC Dashboard" on mount', () => {
    renderPage();
    expect(document.title).toBe('Trends — TPC Dashboard');
  });
});
