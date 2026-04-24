// Phase 6 Plan 06-03 — DEPT-03 stacked 100% bar chart of department share per sale.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § DepartmentShareStackedBarChart.
// REQ-ID: DEPT-03, INTR-01 (cross-filter fillOpacity), INTR-03 (tooltip).
// Top-N depts from topCodes array + aggregated 'other' (gray-400).
// stackId='share' on every Bar; server-returned fractions sum to ~1.0 per row.
//
// Y-axis domain is [0, 1] with `formatPercent` tick formatter — the server
// returns fractions (0 ≤ share ≤ 1), not percentages. The legend is
// positioned at the top; the 'Other' bar is rendered last so it stacks on
// top of the top-N segments, matching the visual reading order "primary
// departments first, rest above."

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  CHART_AXIS_TICK_FILL,
  CHART_GRID_STROKE,
} from '../lib/chart-colors';
import { useDepartmentShareSeries } from '../hooks/useDepartmentShareSeries';
import { formatDate, formatPercent } from '../lib/format';
import type { Range } from '../lib/period';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface DepartmentShareStackedBarChartProps {
  range: Range;
  /** Default 8 (matches palette). */
  topN?: number;
  /** INTR-01 cross-filter: non-null dims all non-matching segments to opacity 0.3. */
  highlightedDept: string | null;
  displayNameByCode: Readonly<Record<string, string | null>>;
  colorForCode: (code: string) => string;
}

/** Gray-400 fill for the aggregated 'Other' segment. */
const OTHER_FILL = '#9ca3af';

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

export function DepartmentShareStackedBarChart({
  range,
  topN = 8,
  highlightedDept,
  displayNameByCode,
  colorForCode,
}: DepartmentShareStackedBarChartProps) {
  const query = useDepartmentShareSeries(range, topN);
  const rows = query.data?.rows ?? [];
  const topCodes = query.data?.topCodes ?? [];

  // Per-row tooltip formatter resolves dept code → display name. Captured
  // inline so the `displayNameByCode` map stays in scope; Recharts clones
  // the ChartTooltip element on hover.
  const valueFormatter = (row: {
    value: number | string;
    dataKey: string | number;
  }): string => {
    const code = String(row.dataKey);
    const label =
      code === 'other'
        ? 'Other'
        : (displayNameByCode[code] ?? code);
    const fraction = typeof row.value === 'number' ? row.value : 0;
    return `${label}: ${formatPercent(fraction)}`;
  };

  if (query.isPending && !query.data) {
    return <ChartSkeleton height="lg" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        heading="Couldn't load this chart"
        body="Something went wrong fetching department share for the selected range. Retry below, or try a different range."
        onRetry={() => query.refetch()}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState heading="No sales in this range">
        <p>Try expanding the date filter to see more data.</p>
      </EmptyState>
    );
  }

  const ariaLabel = `Department share of sale — ${topCodes.length} departments plus Other · ${rows.length} sales in range`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="h-full w-full transition-opacity duration-200"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[...rows]}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis
            dataKey="sale_date"
            tickFormatter={(v: string) => formatDate(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
          />
          <YAxis
            tickFormatter={(v: number) => formatPercent(v)}
            domain={[0, 1]}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
            width={56}
          />
          <Tooltip
            content={
              <ChartTooltip
                headerFormatter={headerFormatter}
                valueFormatter={valueFormatter}
              />
            }
          />
          <Legend verticalAlign="top" height={24} />
          {topCodes.map((code) => (
            <Bar
              key={code}
              dataKey={code}
              stackId="share"
              name={displayNameByCode[code] ?? code}
              fill={colorForCode(code)}
              fillOpacity={
                highlightedDept == null || highlightedDept === code ? 1 : 0.3
              }
              isAnimationActive={false}
            />
          ))}
          <Bar
            key="other"
            dataKey="other"
            stackId="share"
            name="Other"
            fill={OTHER_FILL}
            fillOpacity={
              highlightedDept == null || highlightedDept === 'other' ? 1 : 0.3
            }
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
