// Phase 5 Plan 04 Task 2 — NetRevenueTrendChart (TRND-01) contract tests.
// Contract locked by 05-04-PLAN.md Task 2 <behavior> + 05-UI-SPEC.md
// § TRND-01 layout (lines 568-600) + § Tooltip format strings + § Accessibility
// Floor (role='img' wrapper).
//
// Mocks useSalesInRange via vi.hoisted + vi.mock so each test drives a single
// hook shape. We do NOT assert Recharts SVG internals — jsdom renders
// Recharts' internals flakily (ResponsiveContainer has zero size). We DO
// assert the role='img' wrapper + aria-label, the pending skeleton, and
// the inline empty/error states.

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

// Import AFTER the mock so the component binds to the mocked hook.
import { NetRevenueTrendChart } from './NetRevenueTrendChart';
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

describe('NetRevenueTrendChart — pending state', () => {
  it('renders ChartSkeleton (aria-label "Loading chart") while the hook is pending', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: true,
      isError: false,
      isFetching: true,
      data: undefined,
      refetch: vi.fn(),
    });
    render(<NetRevenueTrendChart range={range} />);
    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
  });
});

describe('NetRevenueTrendChart — error state', () => {
  it('renders ErrorState with Retry that calls hook.refetch', () => {
    const refetch = vi.fn();
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      data: undefined,
      refetch,
    });
    render(<NetRevenueTrendChart range={range} />);
    const heading = screen.getByRole('alert');
    expect(heading).toHaveTextContent("Couldn't load this chart");
    const retry = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('NetRevenueTrendChart — empty state', () => {
  it('renders EmptyState when the hook returns zero rows', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: false,
      data: [],
      refetch: vi.fn(),
    });
    render(<NetRevenueTrendChart range={range} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });

  it('renders EmptyState when every row has a null sale_date or null net_revenue', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: false,
      data: [
        makeSale({ sale_number: 'A', sale_date: null, net_revenue: 100 }),
        makeSale({
          sale_number: 'B',
          sale_date: '2024-01-01',
          net_revenue: null,
        }),
      ],
      refetch: vi.fn(),
    });
    render(<NetRevenueTrendChart range={range} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });
});

describe('NetRevenueTrendChart — success state', () => {
  it('renders a role="img" wrapper with aria-label mentioning the sale count', () => {
    const sales: Sale[] = [
      makeSale({
        sale_number: '2024-001',
        sale_date: '2024-01-15',
        net_revenue: 100_000,
      }),
      makeSale({
        sale_number: '2024-002',
        sale_date: '2024-02-15',
        net_revenue: 120_000,
      }),
      makeSale({
        sale_number: '2024-003',
        sale_date: '2024-03-15',
        net_revenue: 150_000,
      }),
      makeSale({
        sale_number: '2024-004',
        sale_date: '2024-04-15',
        net_revenue: 180_000,
      }),
      makeSale({
        sale_number: '2024-005',
        sale_date: '2024-05-15',
        net_revenue: 200_000,
      }),
    ];
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: false,
      data: sales,
      refetch: vi.fn(),
    });
    render(<NetRevenueTrendChart range={range} />);
    const wrapper = screen.getByRole('img');
    expect(wrapper.getAttribute('aria-label')).toMatch(/5 sales in range/);
    expect(wrapper.getAttribute('aria-label')).toMatch(/Net revenue per sale/);
  });
});

describe('NetRevenueTrendChart — refetching with prior data', () => {
  it('still renders the chart (not skeleton) while isFetching && data is present', () => {
    const sales: Sale[] = [
      makeSale({
        sale_number: '2024-001',
        sale_date: '2024-01-15',
        net_revenue: 100_000,
      }),
      makeSale({
        sale_number: '2024-002',
        sale_date: '2024-02-15',
        net_revenue: 120_000,
      }),
      makeSale({
        sale_number: '2024-003',
        sale_date: '2024-03-15',
        net_revenue: 150_000,
      }),
      makeSale({
        sale_number: '2024-004',
        sale_date: '2024-04-15',
        net_revenue: 180_000,
      }),
      makeSale({
        sale_number: '2024-005',
        sale_date: '2024-05-15',
        net_revenue: 200_000,
      }),
    ];
    useSalesInRangeMock.mockReturnValue({
      isPending: false,
      isError: false,
      isFetching: true,
      data: sales,
      refetch: vi.fn(),
    });
    render(<NetRevenueTrendChart range={range} />);
    expect(screen.queryByLabelText('Loading chart')).toBeNull();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
