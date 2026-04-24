// Phase 5 Plan 05-05 Task 2 — EstimateAccuracyChart state-branch tests.
// Contract: 05-05-PLAN.md Task 2 <behavior> + 05-UI-SPEC.md § TRND-05.
//
// We mock `useDepartmentGrid` so each test drives exactly one of the four
// rendering branches (pending / error / empty / success) plus a refetching
// case. Recharts' ResponsiveContainer needs a non-zero parent size under
// jsdom; we mock it to a simple pass-through so the chart subtree renders
// and the `role="img"` wrapper (which lives OUTSIDE ResponsiveContainer) is
// always assertable.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DeptGridRow } from '../hooks/useDepartmentGrid';
import type { Range } from '../lib/period';

// Pass-through ResponsiveContainer so the inner chart tree mounts under
// jsdom (where ResizeObserver-based sizing returns 0 and Recharts would
// otherwise render nothing). We only need the wrapper + state branches to
// be asserted — not Recharts' SVG internals.
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

const { useDepartmentGridMock } = vi.hoisted(() => ({
  useDepartmentGridMock: vi.fn(),
}));
vi.mock('../hooks/useDepartmentGrid', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/useDepartmentGrid')
  >('../hooks/useDepartmentGrid');
  return { ...actual, useDepartmentGrid: () => useDepartmentGridMock() };
});

import { EstimateAccuracyChart } from './EstimateAccuracyChart';

const RANGE: Range = { start: '2025-04-22', end: '2026-04-22', preset: 'l12m' };

type DeptGridQuery = UseQueryResult<DeptGridRow[], Error>;

function makeRow(
  sale_number: string,
  sale_date: string | null,
  lots_sold: number | null,
  depts: DeptGridRow['sale_departments'],
): DeptGridRow {
  return { sale_number, sale_date, lots_sold, sale_departments: depts };
}

const FULL_ROWS: DeptGridRow[] = [
  makeRow('2024-001', '2024-03-01', 20, [
    { department_code: 'FRN', total_sold_value: 500, low_estimate: 100, high_estimate: 300, lots_sold: 5, sell_through_pct: 80, revenue: 450 },
    { department_code: 'PNT', total_sold_value: 200, low_estimate: 100, high_estimate: 300, lots_sold: 10, sell_through_pct: 75, revenue: 180 },
    { department_code: 'SIL', total_sold_value: 50,  low_estimate: 100, high_estimate: 300, lots_sold: 3,  sell_through_pct: 50, revenue: 45 },
  ]),
  makeRow('2024-002', '2024-06-01', 30, [
    { department_code: 'FRN', total_sold_value: 120, low_estimate: 100, high_estimate: 300, lots_sold: 8, sell_through_pct: 70, revenue: 110 },
    { department_code: 'PNT', total_sold_value: 250, low_estimate: 100, high_estimate: 300, lots_sold: 12, sell_through_pct: 77, revenue: 230 },
  ]),
  makeRow('2024-003', '2024-09-01', 15, [
    { department_code: 'PNT', total_sold_value: 90, low_estimate: 100, high_estimate: 300, lots_sold: 6, sell_through_pct: 60, revenue: 85 },
    { department_code: 'SIL', total_sold_value: 400, low_estimate: 100, high_estimate: 300, lots_sold: 4, sell_through_pct: 90, revenue: 380 },
  ]),
];

beforeEach(() => {
  useDepartmentGridMock.mockReset();
});

describe('EstimateAccuracyChart — state branches', () => {
  it('renders ChartSkeleton while the hook is pending', () => {
    useDepartmentGridMock.mockReturnValue({
      isPending: true, isError: false, isSuccess: false, isFetching: true,
      isRefetching: false, data: undefined, error: null, refetch: vi.fn(),
    } as unknown as DeptGridQuery);

    render(<EstimateAccuracyChart range={RANGE} />);

    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders ErrorState with a working Retry button on isError', async () => {
    const refetch = vi.fn();
    useDepartmentGridMock.mockReturnValue({
      isPending: false, isError: true, isSuccess: false, isFetching: false,
      isRefetching: false, data: undefined, error: new Error('boom'), refetch,
    } as unknown as DeptGridQuery);

    render(<EstimateAccuracyChart range={RANGE} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this chart");
    expect(
      screen.getByText(/Something went wrong fetching department data/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders EmptyState when the hook returns an empty array', () => {
    useDepartmentGridMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: false,
      isRefetching: false, data: [], error: null, refetch: vi.fn(),
    } as unknown as DeptGridQuery);

    render(<EstimateAccuracyChart range={RANGE} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders EmptyState when every row has unclassifiable bands', () => {
    // Every dept has a null low_estimate → computeAccuracyBands returns null
    // for each row, so the filter drops everything.
    const rows: DeptGridRow[] = [
      makeRow('2024-001', '2024-03-01', 20, [
        { department_code: 'FRN', total_sold_value: 500, low_estimate: null, high_estimate: 300, lots_sold: 5, sell_through_pct: 80, revenue: 450 },
      ]),
    ];
    useDepartmentGridMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: false,
      isRefetching: false, data: rows, error: null, refetch: vi.fn(),
    } as unknown as DeptGridQuery);

    render(<EstimateAccuracyChart range={RANGE} />);
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });

  it('renders the chart wrapper with a descriptive aria-label on success', () => {
    useDepartmentGridMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: false,
      isRefetching: false, data: FULL_ROWS, error: null, refetch: vi.fn(),
    } as unknown as DeptGridQuery);

    render(<EstimateAccuracyChart range={RANGE} />);
    const wrapper = screen.getByRole('img');
    expect(wrapper).toHaveAttribute(
      'aria-label',
      expect.stringContaining('3 sales in range'),
    );
    expect(wrapper.getAttribute('aria-label')).toMatch(
      /estimate accuracy/i,
    );
  });

  it('keeps chart mounted while refetching (no skeleton swap)', () => {
    useDepartmentGridMock.mockReturnValue({
      isPending: false, isError: false, isSuccess: true, isFetching: true,
      isRefetching: true, data: FULL_ROWS, error: null, refetch: vi.fn(),
    } as unknown as DeptGridQuery);

    render(<EstimateAccuracyChart range={RANGE} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading chart')).not.toBeInTheDocument();
  });
});
