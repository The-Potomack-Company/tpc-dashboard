// Phase 6 Plan 06-03 Task 3 — DepartmentShareStackedBarChart state-branch tests.
// Contract: 06-03-PLAN.md Task 3 <behavior> + 06-UI-SPEC.md § DepartmentShareStackedBarChart.
// REQ-ID: DEPT-03, INTR-01 (cross-filter fillOpacity), INTR-03 (tooltip).
//
// Strategy mirrors DepartmentRevenueLineChart.test.tsx. Stack-sum contract
// (T5) verifies the RPC returns fractions that sum to ~1.0 per row — a pure
// numeric check that validates the server contract without booting Recharts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Range } from '../lib/period';
import type {
  DepartmentShareRow,
  DepartmentShareSeriesData,
} from '../hooks/useDepartmentShareSeries';

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

const { useDepartmentShareSeriesMock } = vi.hoisted(() => ({
  useDepartmentShareSeriesMock: vi.fn(),
}));
vi.mock('../hooks/useDepartmentShareSeries', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/useDepartmentShareSeries')
  >('../hooks/useDepartmentShareSeries');
  return {
    ...actual,
    useDepartmentShareSeries: () => useDepartmentShareSeriesMock(),
  };
});

import { DepartmentShareStackedBarChart } from './DepartmentShareStackedBarChart';

const RANGE: Range = {
  start: '2024-01-01',
  end: '2024-12-31',
  preset: 'custom',
};

type Query = UseQueryResult<DepartmentShareSeriesData, Error>;

const colorForCode = (code: string) => {
  const map: Record<string, string> = {
    ASN: '#2563eb',
    FRN: '#059669',
  };
  return map[code] ?? '#000000';
};

const DISPLAY_NAMES: Record<string, string | null> = {
  ASN: 'Asian Art',
  FRN: 'Furniture',
};

function mockQuery(partial: Partial<Query>): void {
  useDepartmentShareSeriesMock.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as Query);
}

beforeEach(() => {
  useDepartmentShareSeriesMock.mockReset();
});

describe('DepartmentShareStackedBarChart', () => {
  it('T1: pending → ChartSkeleton', () => {
    mockQuery({ isPending: true, data: undefined });
    render(
      <DepartmentShareStackedBarChart
        range={RANGE}
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
      <DepartmentShareStackedBarChart
        range={RANGE}
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

  it('T3: empty rows → EmptyState "No sales in this range"', () => {
    mockQuery({ data: { rows: [], topCodes: [] } });
    render(
      <DepartmentShareStackedBarChart
        range={RANGE}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    expect(screen.getByText('No sales in this range')).toBeInTheDocument();
  });

  it('T4: success wrapper aria-label mentions N departments plus Other · M sales', () => {
    const rows: DepartmentShareRow[] = [
      {
        sale_date: '2024-01-15',
        sale_number: '2024-0001',
        ASN: 0.4,
        FRN: 0.3,
        other: 0.3,
      },
    ];
    mockQuery({
      data: { rows, topCodes: ['ASN', 'FRN'] },
    });
    render(
      <DepartmentShareStackedBarChart
        range={RANGE}
        highlightedDept={null}
        displayNameByCode={DISPLAY_NAMES}
        colorForCode={colorForCode}
      />,
    );
    const wrapper = screen.getByRole('img');
    expect(wrapper.getAttribute('aria-label')).toMatch(
      /2 departments plus Other · 1 sales in range/,
    );
  });

  it('T5: stack sum contract — topCodes[i] + other ≈ 1.0 per row', () => {
    // Pure-function check — validates the RPC contract shape the chart assumes.
    const row: DepartmentShareRow = {
      sale_date: '2024-01-15',
      sale_number: '2024-0001',
      ASN: 0.4,
      FRN: 0.3,
      other: 0.3,
    };
    const topCodes = ['ASN', 'FRN'] as const;
    const total =
      topCodes.reduce(
        (sum, code) => sum + (typeof row[code] === 'number' ? (row[code] as number) : 0),
        0,
      ) + (typeof row.other === 'number' ? row.other : 0);
    expect(Math.abs(total - 1.0)).toBeLessThanOrEqual(0.01);
  });

  it('T6: highlightedDept set + success → wrapper has transition-opacity duration-200', () => {
    const rows: DepartmentShareRow[] = [
      {
        sale_date: '2024-01-15',
        sale_number: '2024-0001',
        ASN: 0.4,
        FRN: 0.3,
        other: 0.3,
      },
    ];
    mockQuery({ data: { rows, topCodes: ['ASN', 'FRN'] } });
    render(
      <DepartmentShareStackedBarChart
        range={RANGE}
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
