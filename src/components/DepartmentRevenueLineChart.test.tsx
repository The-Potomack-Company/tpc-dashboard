// Phase 6 Plan 06-03 Task 2 — DepartmentRevenueLineChart state-branch tests.
// Contract: 06-03-PLAN.md Task 2 <behavior> + 06-UI-SPEC.md § DepartmentRevenueLineChart.
// REQ-ID: DEPT-02, INTR-01 (cross-filter opacity wrapper), INTR-03 (tooltip).
//
// Strategy mirrors NetRevenueTrendChart.test.tsx:
//   - mock useDepartmentRevenueSeries at the module boundary so each test
//     drives exactly one hook shape,
//   - pass-through ResponsiveContainer so jsdom's zero-size viewport doesn't
//     hide the chart subtree,
//   - assert role='img' wrapper + aria-label + state-branch DOM — NOT
//     Recharts SVG internals (Phase 5 convention).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Range } from '../lib/period';
import type { DepartmentRevenueRow } from '../hooks/useDepartmentRevenueSeries';

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

const { useDepartmentRevenueSeriesMock } = vi.hoisted(() => ({
  useDepartmentRevenueSeriesMock: vi.fn(),
}));
vi.mock('../hooks/useDepartmentRevenueSeries', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/useDepartmentRevenueSeries')
  >('../hooks/useDepartmentRevenueSeries');
  return {
    ...actual,
    useDepartmentRevenueSeries: () => useDepartmentRevenueSeriesMock(),
  };
});

import { DepartmentRevenueLineChart } from './DepartmentRevenueLineChart';

const RANGE: Range = {
  start: '2024-01-01',
  end: '2024-12-31',
  preset: 'custom',
};

type Query = UseQueryResult<readonly DepartmentRevenueRow[], Error>;

const colorForCode = (code: string) => {
  const map: Record<string, string> = {
    ASN: '#2563eb',
    FRN: '#059669',
    PNT: '#d97706',
  };
  return map[code] ?? '#000000';
};

const DISPLAY_NAMES: Record<string, string | null> = {
  ASN: 'Asian Art',
  FRN: 'Furniture',
  PNT: 'Paintings',
};

function mockQuery(partial: Partial<Query>): void {
  useDepartmentRevenueSeriesMock.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as Query);
}

beforeEach(() => {
  useDepartmentRevenueSeriesMock.mockReset();
});

describe('DepartmentRevenueLineChart', () => {
  it('T1: pending → ChartSkeleton', () => {
    mockQuery({ isPending: true, data: undefined });
    render(
      <DepartmentRevenueLineChart
        range={RANGE}
        selectedDeptCodes={['ASN', 'FRN']}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('T2: error → ErrorState with working Retry', async () => {
    const refetch = vi.fn();
    mockQuery({ isError: true, refetch });
    render(
      <DepartmentRevenueLineChart
        range={RANGE}
        selectedDeptCodes={['ASN']}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load this chart",
    );
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('T3: empty selection (selectedDeptCodes=[]) → "Select a department to begin"', () => {
    // When selectedDeptCodes is empty, the hook is disabled and returns
    // isPending=false / data=undefined; the component short-circuits on the
    // empty-selection branch BEFORE reading data.
    mockQuery({ data: undefined, isPending: false });
    render(
      <DepartmentRevenueLineChart
        range={RANGE}
        selectedDeptCodes={[]}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    expect(
      screen.getByText('Select a department to begin'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('T4: empty data (data=[]) → "No sales in this range"', () => {
    mockQuery({ data: [] });
    render(
      <DepartmentRevenueLineChart
        range={RANGE}
        selectedDeptCodes={['ASN']}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });

  it('T5: success wrapper aria-label mentions dept-count + sale-count', () => {
    const rows: DepartmentRevenueRow[] = [
      { sale_date: '2024-01-15', sale_number: '2024-001', ASN: 400, FRN: 300 },
      { sale_date: '2024-02-15', sale_number: '2024-002', ASN: 350, FRN: 280 },
      { sale_date: '2024-03-15', sale_number: '2024-003', ASN: 500, FRN: 320 },
    ];
    mockQuery({ data: rows });
    render(
      <DepartmentRevenueLineChart
        range={RANGE}
        selectedDeptCodes={['ASN', 'FRN']}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    const wrapper = screen.getByRole('img');
    expect(wrapper.getAttribute('aria-label')).toMatch(
      /2 departments · 3 sales in range/,
    );
  });

  it('T6: highlightedDept set + success → wrapper has transition-opacity duration-200', () => {
    const rows: DepartmentRevenueRow[] = [
      { sale_date: '2024-01-15', sale_number: '2024-001', ASN: 400, FRN: 300 },
    ];
    mockQuery({ data: rows });
    render(
      <DepartmentRevenueLineChart
        range={RANGE}
        selectedDeptCodes={['ASN', 'FRN']}
        highlightedDept="ASN"
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    const wrapper = screen.getByRole('img');
    expect(wrapper.className).toMatch(/transition-opacity/);
    expect(wrapper.className).toMatch(/duration-200/);
  });
});
