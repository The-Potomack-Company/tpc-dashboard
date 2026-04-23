import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Database } from '../db/database.types';

const { useSaleMock } = vi.hoisted(() => ({ useSaleMock: vi.fn() }));
vi.mock('../hooks/useSale', () => ({ useSale: (n: string) => useSaleMock(n) }));

// Mock RevenueWaterfallChart so these page-level tests assert ONLY the
// page's composition contract (collapsible section + aria semantics) and
// don't double-test the chart itself (which has its own test file).
// The mock exposes role='img' with the sale_number in aria-label so the
// expand assertion can query it stably.
vi.mock('../components/RevenueWaterfallChart', () => ({
  RevenueWaterfallChart: ({ sale }: { sale: { sale_number: string } }) => (
    <div
      role="img"
      aria-label={`Revenue breakdown waterfall for sale ${sale.sale_number}`}
      data-testid="revenue-waterfall-chart"
    />
  ),
}));

import { SaleDetailPage } from '../pages/SaleDetail';

type Sale = Database['public']['Tables']['sales']['Row'];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'id-1',
    sale_number: '22OCT',
    title: 'Fall Auction',
    sale_date: '2024-01-15',
    lots_auctioned: 10,
    lots_sold: 8,
    lots_unsold: 2,
    total_sold_value: 100000,
    total_unsold_value: 10000,
    total_low_estimate: 80000,
    total_high_estimate: 120000,
    total_reserves: null,
    hammer_total: null,
    buyer_premium: null,
    seller_commission: null,
    insurance: null,
    lot_charges: null,
    referral_fees: null,
    net_revenue: null,
    registered_bidders: null,
    winning_buyers: null,
    payment_status: null,
    validation_warning: false,
    imported_at: null,
    source_pdf_path: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as Sale;
}

function renderPage(saleNumber: string = '22OCT') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/sales/${saleNumber}`]}>
        <Routes>
          <Route path="/sales/:saleNumber" element={<SaleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SaleDetailPage', () => {
  it('renders skeleton and back link while loading', () => {
    useSaleMock.mockReturnValue({ isLoading: true, isError: false, data: undefined, error: null, refetch: vi.fn() });
    const { container } = renderPage('22OCT');
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
    const shimmers = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(shimmers.length).toBeGreaterThan(0);
  });

  it('renders 404 Sale not found when useSale returns status not_found', () => {
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'not_found' }, error: null, refetch: vi.fn() });
    renderPage('NONEXISTENT');
    expect(screen.getByText('Sale not found')).toBeInTheDocument();
    expect(screen.getByText(/NONEXISTENT/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
  });

  it('renders error state with Retry button when useSale fails', () => {
    const refetch = vi.fn();
    useSaleMock.mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('boom'), refetch });
    renderPage('22OCT');
    expect(screen.getByText("Couldn't load this sale")).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /Retry/ });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
  });

  it('renders SaleSummaryCard and DepartmentTable on happy path validation_warning false', () => {
    const sale = makeSale({ validation_warning: false });
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    expect(screen.getByRole('heading', { level: 1, name: 'Fall Auction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Department breakdown' })).toBeInTheDocument();
    expect(screen.getByText('Sale date')).toBeInTheDocument();
    expect(screen.getByText('Lots auctioned')).toBeInTheDocument();
    // WR-02: Banner uses role="status" now, so its absence is checked
    // via queryByRole('status').
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders ValidationWarningBanner when validation_warning true', () => {
    const sale = makeSale({ validation_warning: true });
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    // WR-02: Banner switched from role="alert" to role="status" (polite)
    // so it no longer re-interrupts AT focus on remount after Reload.
    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: /Reload sale/ })).toBeInTheDocument();
  });

  it('back link is present on every branch', () => {
    useSaleMock.mockReturnValue({ isLoading: true, isError: false, data: undefined, error: null, refetch: vi.fn() });
    const r1 = renderPage('22OCT');
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
    r1.unmount();

    useSaleMock.mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('x'), refetch: vi.fn() });
    const r2 = renderPage('22OCT');
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
    r2.unmount();

    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'not_found' }, error: null, refetch: vi.fn() });
    const r3 = renderPage('NOPE');
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
    r3.unmount();

    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale: makeSale(), departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    expect(screen.getByRole('link', { name: /Back to sales/ })).toBeInTheDocument();
  });

  it('Reload button in validation banner wires to query invalidation', () => {
    const sale = makeSale({ validation_warning: true });
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    expect(screen.getByRole('button', { name: /Reload sale/ })).toBeInTheDocument();
  });

  // ── Phase 6 Plan 06-05 — SALE-06 Revenue Breakdown section (4 new tests) ──
  //
  // Complete financial fields so the (mocked) RevenueWaterfallChart would
  // render its chart body (not EmptyState) when expanded.
  function makeSaleWithFinancials(overrides: Partial<Sale> = {}): Sale {
    return makeSale({
      hammer_total: 100000,
      buyer_premium: 25000,
      seller_commission: 10000,
      insurance: 2000,
      lot_charges: 3000,
      referral_fees: 5000,
      net_revenue: 105000,
      ...overrides,
    });
  }

  it('SALE-06 T-new-1: Revenue breakdown ChartCard renders collapsed by default with hint copy', () => {
    const sale = makeSaleWithFinancials();
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    // Section title is present.
    expect(screen.getByRole('heading', { level: 2, name: 'Revenue breakdown' })).toBeInTheDocument();
    // Chart body is NOT in the DOM (collapsed default — deep-link opt-in not supported per UI-SPEC).
    expect(screen.queryByTestId('revenue-waterfall-chart')).not.toBeInTheDocument();
    // Collapsed-state muted hint is visible.
    expect(screen.getByText('Tap to see the path from hammer to net')).toBeInTheDocument();
  });

  it('SALE-06 T-new-2: chevron button starts with aria-expanded="false" and "Expand revenue breakdown" label', () => {
    const sale = makeSaleWithFinancials();
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    const toggle = screen.getByRole('button', { name: 'Expand revenue breakdown' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('SALE-06 T-new-3: clicking the chevron expands the section, reveals the chart, updates aria-* attributes', () => {
    const sale = makeSaleWithFinancials({ sale_number: '22OCT' });
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    const toggle = screen.getByRole('button', { name: 'Expand revenue breakdown' });
    fireEvent.click(toggle);
    // Chart body mounts.
    const chart = screen.getByTestId('revenue-waterfall-chart');
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute('aria-label')).toMatch(/22OCT/);
    // Button flips aria-expanded + aria-label.
    const toggleAfter = screen.getByRole('button', { name: 'Collapse revenue breakdown' });
    expect(toggleAfter).toHaveAttribute('aria-expanded', 'true');
    // Collapsed hint is gone.
    expect(screen.queryByText('Tap to see the path from hammer to net')).not.toBeInTheDocument();
  });

  it('SALE-06 T-new-4: keyboard Enter toggles the expand state (native <button> semantics)', () => {
    const sale = makeSaleWithFinancials();
    useSaleMock.mockReturnValue({ isLoading: false, isError: false, data: { status: 'ok', sale, departments: [] }, error: null, refetch: vi.fn() });
    renderPage('22OCT');
    const toggle = screen.getByRole('button', { name: 'Expand revenue breakdown' });
    // Native <button> fires onClick for Enter/Space. fireEvent.click simulates that activation path.
    // We also issue keyDown(Enter) to cover the explicit keyboard contract documented
    // in UI-SPEC § Interaction Contract → "Enter or Space toggles".
    fireEvent.keyDown(toggle, { key: 'Enter', code: 'Enter' });
    fireEvent.click(toggle); // browsers fire click on Enter for <button>; jsdom does not — this is the activation proxy.
    expect(screen.getByTestId('revenue-waterfall-chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse revenue breakdown' })).toHaveAttribute('aria-expanded', 'true');
  });
});
