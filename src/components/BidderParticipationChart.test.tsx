// Phase 5 Plan 05-05 Task 3 — BidderParticipationChart state-branch tests.
// Contract: 05-05-PLAN.md Task 3 <behavior> + 05-UI-SPEC.md § TRND-06.
//
// Same state-branch coverage as the TRND-05 suite:
// pending / error / two empty paths (no rows; rows but all participation null) /
// success / refetching. Recharts ResponsiveContainer is mocked so the inner
// LineChart mounts under jsdom. The chart itself is opaque to these tests —
// we assert the `role="img"` wrapper and state substitutions, not SVG internals.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Database } from '../db/database.types';
import type { Range } from '../lib/period';

vi.mock('recharts', async () => {
  const actual =
    await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  };
});

const { useSalesInRangeMock } = vi.hoisted(() => ({
  useSalesInRangeMock: vi.fn(),
}));
vi.mock('../hooks/useSalesInRange', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/useSalesInRange')
  >('../hooks/useSalesInRange');
  return { ...actual, useSalesInRange: () => useSalesInRangeMock() };
});

import { BidderParticipationChart } from './BidderParticipationChart';

type Sale = Database['public']['Tables']['sales']['Row'];
type SalesQuery = UseQueryResult<Sale[], Error>;

const RANGE: Range = { start: '2025-04-22', end: '2026-04-22', preset: 'l12m' };

function makeSale(overrides: Partial<Sale>): Sale {
  return {
    id: 'id-' + (overrides.sale_number ?? 'x'),
    buyer_premium: null,
    created_at: '2024-01-01T00:00:00Z',
    hammer_total: null,
    imported_at: null,
    insurance: null,
    lot_charges: null,
    lots_auctioned: null,
    lots_sold: null,
    lots_unsold: null,
    net_revenue: null,
    payment_status: null,
    referral_fees: null,
    registered_bidders: null,
    sale_date: '2024-01-15',
    sale_number: '2024-001',
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

const SALES: Sale[] = [
  makeSale({ sale_number: '2024-001', sale_date: '2024-03-01', registered_bidders: 120, winning_buyers: 45 }),
  makeSale({ sale_number: '2024-002', sale_date: '2024-06-01', registered_bidders: 150, winning_buyers: 60 }),
  // only one of the two participation fields — still renderable
  makeSale({ sale_number: '2024-003', sale_date: '2024-09-01', registered_bidders: 90, winning_buyers: null }),
];

beforeEach(() => {
  useSalesInRangeMock.mockReset();
});

describe('BidderParticipationChart — state branches', () => {
  it('renders ChartSkeleton while the hook is pending', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: true, isError: false, isSuccess: false, isFetching: true,
      isRefetching: false, data: undefined, error: null, refetch: vi.fn(),
    } as unknown as SalesQuery);

    render(<BidderParticipationChart range={RANGE} />);
    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders ErrorState with sale-focused copy and a working Retry on isError', async () => {
    const refetch = vi.fn();
    useSalesInRangeMock.mockReturnValue({
      isPending: false, isError: true, isSuccess: false, isFetching: false,
      isRefetching: false, data: undefined, error: new Error('boom'), refetch,
    } as unknown as SalesQuery);

    render(<BidderParticipationChart range={RANGE} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this chart");
    expect(
      screen.getByText(/Something went wrong fetching sales in the selected range/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders EmptyState when the hook returns an empty array', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: false,
      isRefetching: false, data: [], error: null, refetch: vi.fn(),
    } as unknown as SalesQuery);

    render(<BidderParticipationChart range={RANGE} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders EmptyState when every row has null bidders AND null buyers', () => {
    const rows: Sale[] = [
      makeSale({ sale_number: '2024-001', sale_date: '2024-03-01', registered_bidders: null, winning_buyers: null }),
      makeSale({ sale_number: '2024-002', sale_date: '2024-06-01', registered_bidders: null, winning_buyers: null }),
    ];
    useSalesInRangeMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: false,
      isRefetching: false, data: rows, error: null, refetch: vi.fn(),
    } as unknown as SalesQuery);

    render(<BidderParticipationChart range={RANGE} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });

  it('renders the chart wrapper with a descriptive aria-label on success', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: false,
      isRefetching: false, data: SALES, error: null, refetch: vi.fn(),
    } as unknown as SalesQuery);

    render(<BidderParticipationChart range={RANGE} />);
    const wrapper = screen.getByRole('img');
    expect(wrapper).toHaveAttribute(
      'aria-label',
      expect.stringContaining('3 sales in range'),
    );
    expect(wrapper.getAttribute('aria-label')).toMatch(/bidder participation/i);
  });

  it('keeps chart mounted while refetching (no skeleton swap)', () => {
    useSalesInRangeMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: true,
      isRefetching: true, data: SALES, error: null, refetch: vi.fn(),
    } as unknown as SalesQuery);

    render(<BidderParticipationChart range={RANGE} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading chart')).not.toBeInTheDocument();
  });
});
