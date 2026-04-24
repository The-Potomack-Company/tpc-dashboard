// Phase 5 Plan 04 Task 3 — SellThroughTrendChart (TRND-02) contract tests.
// Contract locked by 05-04-PLAN.md Task 3 <behavior> + 05-UI-SPEC.md
// § TRND-02 layout (lines 602-608) + § Tooltip format strings + § Accessibility
// Floor. Mirror of NetRevenueTrendChart.test.tsx with sell-through
// derivation (lots_sold / lots_auctioned) + emerald-600 series + [0,1] Y-axis.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

const { useSalesInRangeMock } = vi.hoisted(() => ({
  useSalesInRangeMock: vi.fn(),
}));
vi.mock('../hooks/useSalesInRange', () => ({
  useSalesInRange: (...args: unknown[]) => useSalesInRangeMock(...args),
}));

import { SellThroughTrendChart } from './SellThroughTrendChart';
import type { Range } from '../lib/period';

const range: Range = {
  start: '2024-01-01',
  end: '2024-12-31',
  preset: 'custom',
};

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
    lots_sold: 70,
    lots_unsold: null,
    net_revenue: 100_000,
    payment_status: null,
    referral_fees: null,
    registered_bidders: null,
    sale_date: '2024-01-15',
    sale_number: overrides.sale_number ?? '2024-001',
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

beforeEach(() => {
  useSalesInRangeMock.mockReset();
});

describe('SellThroughTrendChart — pending state', () => {
  it('renders ChartSkeleton while the hook is pending', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: true,
      isError: false,
      isFetching: true,
      data: undefined,
      refetch: vi.fn(),
    });
    render(<SellThroughTrendChart range={range} />);
    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
  });
});

describe('SellThroughTrendChart — error state', () => {
  it('renders ErrorState with Retry that calls hook.refetch', () => {
    const refetch = vi.fn();
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      data: undefined,
      refetch,
    });
    render(<SellThroughTrendChart range={range} />);
    const heading = screen.getByRole('alert');
    expect(heading).toHaveTextContent("Couldn't load this chart");
    const retry = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('SellThroughTrendChart — empty state', () => {
  it('renders EmptyState when the hook returns zero rows', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: false,
      data: [],
      refetch: vi.fn(),
    });
    render(<SellThroughTrendChart range={range} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });

  it('renders EmptyState when lots_auctioned is null/zero or sale_date is null for every row', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: false,
      data: [
        // sale_date null → filtered
        makeSale({
          sale_number: 'A',
          sale_date: null,
          lots_auctioned: 100,
          lots_sold: 50,
        }),
        // lots_auctioned null → filtered (divide-by-null guard)
        makeSale({
          sale_number: 'B',
          sale_date: '2024-02-01',
          lots_auctioned: null,
          lots_sold: 50,
        }),
        // lots_auctioned zero → filtered (divide-by-zero guard → NaN / Infinity)
        makeSale({
          sale_number: 'C',
          sale_date: '2024-03-01',
          lots_auctioned: 0,
          lots_sold: 0,
        }),
        // lots_sold null → filtered
        makeSale({
          sale_number: 'D',
          sale_date: '2024-04-01',
          lots_auctioned: 100,
          lots_sold: null,
        }),
      ],
      refetch: vi.fn(),
    });
    render(<SellThroughTrendChart range={range} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });
});

describe('SellThroughTrendChart — success state', () => {
  it('renders a role="img" wrapper with aria-label mentioning the sale count', () => {
    const sales: Sale[] = [
      makeSale({ sale_number: '1', sale_date: '2024-01-15', lots_auctioned: 100, lots_sold: 60 }),
      makeSale({ sale_number: '2', sale_date: '2024-02-15', lots_auctioned: 100, lots_sold: 70 }),
      makeSale({ sale_number: '3', sale_date: '2024-03-15', lots_auctioned: 100, lots_sold: 80 }),
      makeSale({ sale_number: '4', sale_date: '2024-04-15', lots_auctioned: 100, lots_sold: 75 }),
      makeSale({ sale_number: '5', sale_date: '2024-05-15', lots_auctioned: 100, lots_sold: 90 }),
    ];
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: false,
      data: sales,
      refetch: vi.fn(),
    });
    render(<SellThroughTrendChart range={range} />);
    const wrapper = screen.getByRole('img');
    expect(wrapper.getAttribute('aria-label')).toMatch(/5 sales in range/);
    expect(wrapper.getAttribute('aria-label')).toMatch(/Sell-through per sale/);
  });
});

describe('SellThroughTrendChart — refetching with prior data', () => {
  it('still renders the chart (not skeleton) while isFetching && data is present', () => {
    const sales: Sale[] = [
      makeSale({ sale_number: '1', sale_date: '2024-01-15', lots_auctioned: 100, lots_sold: 60 }),
      makeSale({ sale_number: '2', sale_date: '2024-02-15', lots_auctioned: 100, lots_sold: 70 }),
      makeSale({ sale_number: '3', sale_date: '2024-03-15', lots_auctioned: 100, lots_sold: 80 }),
      makeSale({ sale_number: '4', sale_date: '2024-04-15', lots_auctioned: 100, lots_sold: 75 }),
      makeSale({ sale_number: '5', sale_date: '2024-05-15', lots_auctioned: 100, lots_sold: 90 }),
    ];
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: true,
      data: sales,
      refetch: vi.fn(),
    });
    render(<SellThroughTrendChart range={range} />);
    expect(screen.queryByLabelText('Loading chart')).toBeNull();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
