// Phase 5 Plan 05-04 — TRND-02 Sell-through per sale chart.
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § TRND-02
// (lines 602-608) + § Tooltip format strings + § Accessibility Floor.
// REQ-ID: TRND-02, INTR-03.
//
// Sell-through = lots_sold / lots_auctioned. Filter out rows where
// lots_auctioned is null or zero to avoid NaN / Infinity propagating into
// the chart and trend computation. CRITICAL: formatPercent from format.ts
// expects a RATIO in [0, 1] — the sales table does NOT store a sell_through
// column; we derive it client-side from lots_sold / lots_auctioned (already
// a ratio). The sale_departments.sell_through_pct column stores 0-100 and
// must be /100-ed at the call site before passing to formatPercent — not
// applicable here.
//
// Mirrors NetRevenueTrendChart structure exactly; deliberate duplication
// keeps the two chart components decoupled (different tooltips, different
// y-axis domains, different series colors).

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
import { formatDate, formatPercent } from '../lib/format';
import { computeRollingMean } from '../lib/rolling-avg';
import type { Range } from '../lib/period';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface SellThroughTrendChartProps {
  range: Range;
}

interface ChartRow {
  sale_date: string;
  sale_number: string;
  sell_through: number;
  rolling_avg_3: number | null;
}

/** Accessibility-floor: suppress Recharts' first-mount reveal animation for
 *  users who've requested reduced motion. matchMedia may be undefined in SSR
 *  / test environments — guard via typeof window. */
function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SellThroughTrendChart({ range }: SellThroughTrendChartProps) {
  const hook = useSalesInRange(range);

  const chartData = useMemo<ChartRow[]>(() => {
    if (!hook.data) return [];
    const filtered = hook.data.filter(
      (
        s,
      ): s is typeof s & {
        sale_date: string;
        lots_auctioned: number;
        lots_sold: number;
      } =>
        s.sale_date != null &&
        s.lots_auctioned != null &&
        s.lots_auctioned > 0 &&
        s.lots_sold != null,
    );
    const values = filtered.map((s) => s.lots_sold / s.lots_auctioned);
    const rolling = computeRollingMean(values, 3);
    return filtered.map((s, i) => ({
      sale_date: s.sale_date,
      sale_number: s.sale_number,
      sell_through: s.lots_sold / s.lots_auctioned,
      rolling_avg_3: rolling[i],
    }));
  }, [hook.data]);

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
    formatPercent(typeof row.value === 'number' ? row.value : null);

  return (
    <div
      role="img"
      aria-label={`Sell-through per sale — ${chartData.length} sales in range`}
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
            tickFormatter={(v: number) => formatPercent(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
            domain={[0, 1]}
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
          <Line
            type="monotone"
            dataKey="sell_through"
            stroke={CHART_PALETTE[1]}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_PALETTE[1] }}
            isAnimationActive={animateSeries}
            name="Sell-through"
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
