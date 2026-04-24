import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Database } from '../db/database.types';

// Phase 4 Plan 04 Task 2 — integration test covering all 3 requirements
// (KPI-01, KPI-02, KPI-03) + independent section failures. Contract locked by
// .planning/phases/04-kpi-landing-page/04-UI-SPEC.md § Copywriting Contract
// (verbatim labels + delta suffix rules) and § Layout Specifications (page
// skeleton). Mirrors the hoisted-hook-mock pattern from sales-page.test.tsx.

const { useKpiSummaryMock, useSalesMock } = vi.hoisted(() => ({
  useKpiSummaryMock: vi.fn(),
  useSalesMock: vi.fn(),
}));
vi.mock('../hooks/useKpiSummary', () => ({
  useKpiSummary: (...args: unknown[]) => useKpiSummaryMock(...args),
}));
vi.mock('../hooks/useSales', () => ({
  useSales: () => useSalesMock(),
}));

// Import AFTER mock so the component under test binds to the mocked hooks.
import { DashboardPage } from '../pages/Dashboard';

type Sale = Database['public']['Tables']['sales']['Row'];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'id-' + (overrides.sale_number ?? 'x'),
    buyer_premium: null,
    created_at: '2024-01-01T00:00:00Z',
    hammer_total: null,
    imported_at: null,
    insurance: null,
    lot_charges: null,
    lots_auctioned: 100,
    lots_sold: 68,
    lots_unsold: 32,
    net_revenue: 214307.5,
    payment_status: null,
    referral_fees: null,
    registered_bidders: null,
    sale_date: '2024-03-15',
    sale_number: 'A',
    seller_commission: null,
    source_pdf_path: null,
    title: 'Sample Sale',
    total_high_estimate: null,
    total_low_estimate: null,
    total_reserves: null,
    total_sold_value: null,
    total_unsold_value: null,
    updated_at: '2024-01-01T00:00:00Z',
    validation_warning: false,
    winning_buyers: null,
    ...overrides,
  };
}

const validKpi = {
  current: {
    revenue: 2_437_580,
    sell_through: 0.684,
    lots_sold: 14_239,
    sales_count: 12,
  },
  previous: {
    revenue: 2_168_000,
    sell_through: 0.652,
    lots_sold: 12_100,
    sales_count: 11,
  },
};

function setSuccess(sales: Sale[] = []) {
  useKpiSummaryMock.mockReturnValue({
    data: validKpi,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
  useSalesMock.mockReturnValue({
    data: sales,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard page (integration)', () => {
  it('renders the Dashboard h1 heading on mount', () => {
    setSuccess();
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('renders skeleton grid on initial pending with no data', () => {
    useKpiSummaryMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useSalesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = renderPage();
    // 4 KpiCardSkeleton × 3 bars + 5 RecentSaleCardSkeleton × 5 bars = 37.
    const shimmers = container.querySelectorAll(
      '.motion-safe\\:animate-pulse',
    );
    expect(shimmers.length).toBe(4 * 3 + 5 * 5);
  });

  it('KPI-01: renders 4 KpiCards with labels in the fixed order', () => {
    setSuccess();
    renderPage();
    expect(screen.getByText('Total revenue')).toBeInTheDocument();
    expect(screen.getByText('Avg sell-through')).toBeInTheDocument();
    expect(screen.getByText('Total lots sold')).toBeInTheDocument();
    expect(screen.getByText('Total sales count')).toBeInTheDocument();

    // Confirm fixed left-to-right order by reading the rendered label nodes in
    // document order and asserting the sequence.
    const labels = Array.from(
      document.querySelectorAll('p.text-sm.font-semibold.text-gray-700'),
    ).map((n) => n.textContent?.trim());
    expect(labels.slice(0, 4)).toEqual([
      'Total revenue',
      'Avg sell-through',
      'Total lots sold',
      'Total sales count',
    ]);
  });

  it('KPI-01: renders formatted revenue value in the first card', () => {
    setSuccess();
    renderPage();
    expect(screen.getByText('$2,437,580.00')).toBeInTheDocument();
  });

  it('KPI-02: sell-through card delta uses pp suffix (percentage-points)', () => {
    setSuccess();
    renderPage();
    // delta = 0.684 - 0.652 = 0.032 → 3.2pp
    expect(screen.getByText(/3\.2pp/)).toBeInTheDocument();
  });

  it('KPI-02: revenue card delta uses % suffix (relative)', () => {
    setSuccess();
    renderPage();
    // delta = (2_437_580 - 2_168_000) / 2_168_000 * 100 ≈ 12.4
    expect(screen.getByText(/12\.4%/)).toBeInTheDocument();
  });

  it('KPI error: shows "Couldn\'t load KPIs" ErrorState but Recent Sales still renders', () => {
    useKpiSummaryMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('boom'),
      refetch: vi.fn(),
    });
    useSalesMock.mockReturnValue({
      data: [makeSale({ sale_number: 'S1', title: 'Alpha' })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/Couldn.t load KPIs/)).toBeInTheDocument();
    // Recent Sales still renders independently.
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('Sales error: shows "Couldn\'t load recent sales" but KPIs still render', () => {
    useKpiSummaryMock.mockReturnValue({
      data: validKpi,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useSalesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/Couldn.t load recent sales/)).toBeInTheDocument();
    // KPIs still render independently.
    expect(screen.getByText('Total revenue')).toBeInTheDocument();
  });

  it('KPI-03: Recent Sales panel limits to 5 cards even when 10 sales are provided', () => {
    const sales = Array.from({ length: 10 }, (_, i) =>
      makeSale({ sale_number: 'S' + i, title: 'Sale ' + i }),
    );
    useKpiSummaryMock.mockReturnValue({
      data: validKpi,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useSalesMock.mockReturnValue({
      data: sales,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Sale 0')).toBeInTheDocument();
    expect(screen.getByText('Sale 4')).toBeInTheDocument();
    // 6th card must NOT render — useMemo slice(0, 5) upstream in RecentSalesPanel.
    expect(screen.queryByText('Sale 5')).not.toBeInTheDocument();
  });

  it('default period is L12M on first render (aria-checked)', () => {
    setSuccess();
    renderPage();
    const l12m = screen.getByRole('radio', { name: 'L12M' });
    expect(l12m).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'YTD' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('radio', { name: 'L6M' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('clicking YTD calls useKpiSummary with "ytd" on next render', async () => {
    setSuccess();
    const user = userEvent.setup();
    renderPage();
    // The initial render calls useKpiSummary('l12m'). Clear the mock so we
    // only see the post-click invocation in the assertion below.
    useKpiSummaryMock.mockClear();
    await user.click(screen.getByRole('radio', { name: 'YTD' }));
    expect(useKpiSummaryMock).toHaveBeenCalledWith('ytd');
  });

  it('sets document.title to "Dashboard — TPC Dashboard" on mount', () => {
    setSuccess();
    renderPage();
    expect(document.title).toBe('Dashboard — TPC Dashboard');
  });
});
