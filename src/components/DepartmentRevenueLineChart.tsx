// Phase 6 Plan 06-03 — DEPT-02 multi-line revenue chart.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § DepartmentRevenueLineChart.
// REQ-ID: DEPT-02, INTR-01 (cross-filter opacity), INTR-03 (tooltip).
// Wide-row shape from useDepartmentRevenueSeries → one <Line dataKey={code}> per selected dept.
// All-null series (Pitfall 8) are filtered out before render to avoid Recharts runtime error.
//
// Wrapper applies `transition-opacity duration-200` so strokeOpacity changes
// (driven by `highlightedDept`) fade smoothly without needing Recharts to
// interpolate — see 06-RESEARCH Pattern 4 + Assumption A2. `isAnimationActive=false`
// on every Line keeps opacity changes "snap" at the Recharts layer; the CSS
// wrapper owns the fade.

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  CHART_AXIS_TICK_FILL,
  CHART_GRID_STROKE,
} from '../lib/chart-colors';
import {
  useDepartmentRevenueSeries,
  type DepartmentRevenueRow,
} from '../hooks/useDepartmentRevenueSeries';
import { formatCurrency, formatDate } from '../lib/format';
import type { Range } from '../lib/period';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface DepartmentRevenueLineChartProps {
  range: Range;
  selectedDeptCodes: readonly string[];
  /** INTR-01 cross-filter: non-null dims all non-matching lines to opacity 0.2. */
  highlightedDept: string | null;
  displayNameByCode: Readonly<Record<string, string | null>>;
  colorForCode: (code: string) => string;
}

// WR-02: Freeze the local empty sentinel so (a) naive mutation from a
// debug/dev session surfaces loudly rather than silently corrupting the
// referentially stable "empty" identity, and (b) matches the frozen
// singleton convention that useDepartmentRevenueSeries establishes with
// its own EMPTY_REVENUE_SERIES. The local constant is still needed for
// the pre-fetch (query.data === undefined) branch before the hook
// returns its own frozen empty array.
const EMPTY_ROWS: readonly DepartmentRevenueRow[] = Object.freeze(
  [],
) as readonly DepartmentRevenueRow[];

function headerFormatter(
  _label: string | number | undefined,
  firstRow: { payload?: Record<string, unknown> } | undefined,
): string {
  const payload = firstRow?.payload as
    | { sale_date?: string; sale_number?: string }
    | undefined;
  if (!payload || !payload.sale_date) return '';
  return `${formatDate(payload.sale_date)} · Sale ${payload.sale_number ?? ''}`;
}

function valueFormatter(row: { value: number | string }): string {
  return formatCurrency(typeof row.value === 'number' ? row.value : null);
}

export function DepartmentRevenueLineChart({
  range,
  selectedDeptCodes,
  highlightedDept,
  displayNameByCode,
  colorForCode,
}: DepartmentRevenueLineChartProps) {
  const query = useDepartmentRevenueSeries(range, selectedDeptCodes);
  const data = query.data ?? EMPTY_ROWS;

  // Filter out codes whose series is entirely null across the range (Pitfall 8).
  // Recharts <Line> with zero data points throws; this guard keeps the render
  // stable when a dept has no revenue in the window but is still selected.
  const renderableCodes = useMemo(() => {
    if (data.length === 0) return [];
    return selectedDeptCodes.filter((code) =>
      data.some((row) => row[code] != null),
    );
  }, [selectedDeptCodes, data]);

  // State branches — evaluated in priority order:
  //   1. empty selection (chip bar cleared) — parent-facing empty
  //   2. pending without prior data — skeleton
  //   3. error — ErrorState
  //   4. empty data — EmptyState
  //   5. all-selected-codes yielded null — inline notice
  //   6. success — chart

  if (selectedDeptCodes.length === 0) {
    return (
      <EmptyState heading="Select a department to begin">
        <p>
          Choose one or more departments from the chips above to plot revenue
          over time.
        </p>
      </EmptyState>
    );
  }

  if (query.isPending && !query.data) {
    return <ChartSkeleton height="lg" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        heading="Couldn't load this chart"
        body="Something went wrong fetching department series for the selected range. Retry below, or try a different range."
        onRetry={() => query.refetch()}
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState heading="No sales in this range">
        <p>Try expanding the date filter to see more data.</p>
      </EmptyState>
    );
  }

  if (renderableCodes.length === 0) {
    return (
      <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
        No revenue data for the selected departments in this range.
      </p>
    );
  }

  const ariaLabel = `Department revenue over time — ${renderableCodes.length} departments · ${data.length} sales in range`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="h-full w-full transition-opacity duration-200"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={[...data]}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis
            dataKey="sale_date"
            tickFormatter={(v: string) => formatDate(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
            width={80}
          />
          <Tooltip
            content={
              <ChartTooltip
                headerFormatter={headerFormatter}
                valueFormatter={valueFormatter}
              />
            }
          />
          {renderableCodes.map((code) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              name={displayNameByCode[code] ?? code}
              stroke={colorForCode(code)}
              strokeWidth={2}
              strokeOpacity={
                highlightedDept == null || highlightedDept === code ? 1 : 0.2
              }
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
