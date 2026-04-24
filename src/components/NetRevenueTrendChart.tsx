// Phase 5 Plan 05-04 — TRND-01 Net revenue per sale chart.
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § TRND-01
// (lines 568-600) + § Tooltip format strings + § Accessibility Floor.
// REQ-ID: TRND-01, INTR-03.
//
// Data flow: useSalesInRange → filter nulls → computeRollingMean(values, 3)
//         → LineChart with 2 series (primary solid + trend dashed).
//
// This component renders ONLY the chart body (role='img' wrapper + states).
// The <ChartCard> chrome (title / subtitle) is supplied by the Trends page
// in plan 05-07 — keeping the chart chrome-free lets the same component
// render inside a future comparison page without inheriting card styling.

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useSalesInRange } from '../hooks/useSalesInRange';
import {
  CHART_PALETTE,
  CHART_GRID_STROKE,
  CHART_AXIS_TICK_FILL,
} from '../lib/chart-colors';
import { formatCurrency, formatDate } from '../lib/format';
import { computeRollingMean } from '../lib/rolling-avg';
import type { Range } from '../lib/period';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface NetRevenueTrendChartProps {
  range: Range;
}

interface ChartRow {
  sale_date: string;
  sale_number: string;
  net_revenue: number;
  rolling_avg_3: number | null;
}

/** Accessibility-floor: suppress Recharts' first-mount reveal animation for
 *  users who've requested reduced motion. matchMedia may be undefined in SSR
 *  / test environments — guard via typeof window. */
function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function NetRevenueTrendChart({ range }: NetRevenueTrendChartProps) {
  const hook = useSalesInRange(range);

  // Memoize derivation so re-renders (hover, tooltip) don't recompute the
  // rolling mean. Keyed on hook.data reference — the hook returns a frozen
  // singleton for null, and PostgREST responses are stable per refetch.
  const chartData = useMemo<ChartRow[]>(() => {
    if (!hook.data) return [];
    const filtered = hook.data.filter(
      (s): s is typeof s & { sale_date: string; net_revenue: number } =>
        s.sale_date != null && s.net_revenue != null,
    );
    const values = filtered.map((s) => s.net_revenue);
    const rolling = computeRollingMean(values, 3);
    return filtered.map((s, i) => ({
      sale_date: s.sale_date,
      sale_number: s.sale_number,
      net_revenue: s.net_revenue,
      rolling_avg_3: rolling[i],
    }));
  }, [hook.data]);

  // Pending: initial load only (no cached data yet). Refetches with
  // placeholderData continue to show the prior chart — UI-SPEC § Loading
  // patterns "no skeleton on refetch".
  if (hook.isPending && !hook.data) {
    return <ChartSkeleton height="sm" />;
  }

  if (hook.isError) {
    return (
      <ErrorState
        heading="Couldn't load this chart"
        body="Something went wrong fetching sales in the selected range. Retry below, or try a different range."
        onRetry={() => hook.refetch()}
      />
    );
  }

  if (chartData.length === 0) {
    return (
      <EmptyState heading="No sales in this range">
        <p>Try expanding the date filter to see more data.</p>
      </EmptyState>
    );
  }

  // isRefetching: suppresses animation on the in-place data swap when the
  // user changes the range. Initial mount (hook.data was undefined → now
  // populated) still animates.
  const isRefetching = hook.isFetching && !!hook.data;
  const prefersReducedMotion = getPrefersReducedMotion();
  const animateSeries = !isRefetching && !prefersReducedMotion;

  const headerFormatter = (
    _label: string | number | undefined,
    firstRow:
      | { payload?: Record<string, unknown> }
      | undefined,
  ) => {
    const payload = firstRow?.payload as ChartRow | undefined;
    if (!payload) return '';
    return `${formatDate(payload.sale_date)} · Sale ${payload.sale_number}`;
  };

  const valueFormatter = (row: { value: number | string }) =>
    formatCurrency(typeof row.value === 'number' ? row.value : null);

  return (
    <div
      role="img"
      aria-label={`Net revenue per sale — ${chartData.length} sales in range`}
      className="h-full w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
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
          <Line
            type="monotone"
            dataKey="net_revenue"
            stroke={CHART_PALETTE[0]}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_PALETTE[0] }}
            isAnimationActive={animateSeries}
            name="Net revenue"
          />
          <Line
            type="monotone"
            dataKey="rolling_avg_3"
            stroke={CHART_PALETTE[5]}
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
            isAnimationActive={animateSeries}
            name="3-sale avg"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
