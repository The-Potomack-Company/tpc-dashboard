// Phase 5 Plan 05-05 — TRND-05 Estimate accuracy over time chart.
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § TRND-05
// (layout: lines 610-629; legend: lines 384-387; tooltip: line 436; error
// copy: line 422; empty copy: line 412).
// REQ-ID: TRND-05, INTR-03.
//
// Data pipeline: useDepartmentGrid(range) → per-row computeAccuracyBands →
// filter out rows with null bands or null sale_date → feed { sale_date,
// sale_number, below, within, above } into Recharts AreaChart.
//
// Bands derived client-side because the sales schema does not store the
// per-sale below/within/above counts (it stores raw per-dept totals). The
// derivation is inclusive on both estimate bounds — see
// src/lib/estimate-accuracy.ts.
//
// Stack rendering uses `stackOffset="expand"` so Recharts normalizes the
// three bands visually to 100% at every x-point. The raw ratios we compute
// may not sum to exactly 1.0 when some depts lack classifiable data; that
// "missing data" fact surfaces in the tooltip (where we render the raw
// per-band share via formatPercent), not the visual stack.
//
// Animation: honors `prefers-reduced-motion` and freezes during refetch
// (the UI-SPEC's no-skeleton-on-refetch pattern means chart stays mounted,
// but a fresh mount animation would read as "page reloaded" which it hasn't).

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { useDepartmentGrid } from '../hooks/useDepartmentGrid';
import type { DeptGridRow } from '../hooks/useDepartmentGrid';
import { computeAccuracyBands } from '../lib/estimate-accuracy';
import {
  CHART_PALETTE,
  CHART_GRID_STROKE,
  CHART_AXIS_TICK_FILL,
} from '../lib/chart-colors';
import { formatDate, formatPercent } from '../lib/format';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import type { Range } from '../lib/period';

export interface EstimateAccuracyChartProps {
  range: Range;
}

interface AccuracyPoint {
  sale_date: string;
  sale_number: string;
  below: number;
  within: number;
  above: number;
}

/**
 * Reduced-motion preference — queried once per render. jsdom's `matchMedia`
 * is undefined by default; guard for it so tests don't need a polyfill.
 * When `window.matchMedia` is missing we treat motion as allowed; Recharts'
 * default easing is short enough that it won't jar users without the media
 * query. A dedicated test env polyfill is out of scope for Wave 0.
 */
function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function headerFormatter(
  label: string | number | undefined,
  firstRow:
    | { payload?: Record<string, unknown> }
    | undefined,
): string {
  const saleNumber = (firstRow?.payload?.sale_number as string | undefined) ?? '';
  return `${formatDate(typeof label === 'string' ? label : null)} · Sale ${saleNumber}`;
}

function valueFormatter(row: { value: number | string }): string {
  return formatPercent(typeof row.value === 'number' ? row.value : null);
}

export function EstimateAccuracyChart({
  range,
}: EstimateAccuracyChartProps) {
  const query = useDepartmentGrid(range);
  const reducedMotion = prefersReducedMotion();
  const animationActive = !query.isRefetching && !reducedMotion;

  // Derive chart points keyed on the hook's data reference so we don't
  // recompute on every render. useMemo deps rely on hook data identity —
  // the WR-08 frozen-empty singleton in the hook guarantees reference
  // stability across refetches that resolve to no data.
  const chartData = useMemo<AccuracyPoint[]>(() => {
    const rows: DeptGridRow[] | undefined = query.data;
    if (!rows || rows.length === 0) return [];
    const out: AccuracyPoint[] = [];
    for (const row of rows) {
      if (row.sale_date == null) continue;
      const bands = computeAccuracyBands(row.sale_departments, row.lots_sold);
      if (bands == null) continue;
      out.push({
        sale_date: row.sale_date,
        sale_number: row.sale_number,
        below: bands.below,
        within: bands.within,
        above: bands.above,
      });
    }
    return out;
  }, [query.data]);

  if (query.isPending) {
    return <ChartSkeleton height="sm" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        heading="Couldn't load this chart"
        body="Something went wrong fetching department data for the selected range. Retry below, or try a different range."
        onRetry={() => query.refetch()}
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

  return (
    <div
      role="img"
      aria-label={`Estimate accuracy over time — ${chartData.length} sales in range`}
      className="h-full w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
          stackOffset="expand"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis
            dataKey="sale_date"
            tickFormatter={(v: string) => formatDate(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
          />
          <YAxis
            tickFormatter={(v: number) => formatPercent(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
            width={64}
          />
          <Tooltip
            content={
              <ChartTooltip
                headerFormatter={headerFormatter}
                valueFormatter={valueFormatter}
              />
            }
          />
          <Legend
            verticalAlign="top"
            height={24}
            wrapperStyle={{ paddingBottom: 8 }}
          />
          <Area
            dataKey="below"
            stackId="1"
            stroke={CHART_PALETTE[2]}
            fill={CHART_PALETTE[2]}
            fillOpacity={0.7}
            name="Below estimate"
            isAnimationActive={animationActive}
          />
          <Area
            dataKey="within"
            stackId="1"
            stroke={CHART_PALETTE[1]}
            fill={CHART_PALETTE[1]}
            fillOpacity={0.7}
            name="Within estimate"
            isAnimationActive={animationActive}
          />
          <Area
            dataKey="above"
            stackId="1"
            stroke={CHART_PALETTE[3]}
            fill={CHART_PALETTE[3]}
            fillOpacity={0.7}
            name="Above estimate"
            isAnimationActive={animationActive}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
