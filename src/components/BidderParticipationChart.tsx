// Phase 5 Plan 05-05 — TRND-06 Bidder participation chart.
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § TRND-06
// (layout: lines 631-649; legend: lines 389-391; tooltip: line 437; error
// copy: line 421; empty copy: line 412).
// REQ-ID: TRND-06, INTR-03.
//
// Dual-axis line: registered_bidders on left (blue-600, CHART_PALETTE[0])
// and winning_buyers on right (orange-600, CHART_PALETTE[6]). Each Line
// MUST set yAxisId matching one of the two YAxis components or Recharts
// silently plots both on the left axis. Right margin bumped to 48 to give
// the right-axis ticks room (UI-SPEC line 635).
//
// Data pipeline: useSalesInRange(range) → keep rows with sale_date and at
// least one non-null participation field → feed { sale_date, sale_number,
// registered_bidders, winning_buyers } into LineChart. Nulls pass through
// to Recharts which `connectNulls={false}` on each Line skips.
//
// Formatting: formatCount (integer-aware) — NOT formatPercent; these are
// headcount fields, not ratios.

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { useSalesInRange } from '../hooks/useSalesInRange';
import {
  CHART_PALETTE,
  CHART_GRID_STROKE,
  CHART_AXIS_TICK_FILL,
} from '../lib/chart-colors';
import { formatDate, formatCount } from '../lib/format';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import type { Range } from '../lib/period';

export interface BidderParticipationChartProps {
  range: Range;
}

interface ParticipationPoint {
  sale_date: string;
  sale_number: string;
  registered_bidders: number | null;
  winning_buyers: number | null;
}

/**
 * Mirrors the EstimateAccuracyChart helper — queries prefers-reduced-motion
 * lazily per render and guards against a missing matchMedia in the test
 * environment. When the media query resolves true, Recharts animation is
 * disabled for all series.
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
  firstRow: { payload?: Record<string, unknown> } | undefined,
): string {
  const saleNumber = (firstRow?.payload?.sale_number as string | undefined) ?? '';
  return `${formatDate(typeof label === 'string' ? label : null)} · Sale ${saleNumber}`;
}

function valueFormatter(row: { value: number | string }): string {
  return formatCount(typeof row.value === 'number' ? row.value : null);
}

export function BidderParticipationChart({
  range,
}: BidderParticipationChartProps) {
  const query = useSalesInRange(range);
  const reducedMotion = prefersReducedMotion();
  const animationActive = !query.isRefetching && !reducedMotion;

  const chartData = useMemo<ParticipationPoint[]>(() => {
    const rows = query.data;
    if (!rows || rows.length === 0) return [];
    const out: ParticipationPoint[] = [];
    for (const s of rows) {
      if (s.sale_date == null) continue;
      if (s.registered_bidders == null && s.winning_buyers == null) continue;
      out.push({
        sale_date: s.sale_date,
        sale_number: s.sale_number,
        registered_bidders: s.registered_bidders,
        winning_buyers: s.winning_buyers,
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
        body="Something went wrong fetching sales in the selected range. Retry below, or try a different range."
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
      aria-label={`Bidder participation — ${chartData.length} sales in range`}
      className="h-full w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 48, bottom: 8, left: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis
            dataKey="sale_date"
            tickFormatter={(v: string) => formatDate(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(v: number) => formatCount(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
            width={64}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v: number) => formatCount(v)}
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
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="registered_bidders"
            stroke={CHART_PALETTE[0]}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_PALETTE[0] }}
            name="Registered bidders"
            connectNulls={false}
            isAnimationActive={animationActive}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="winning_buyers"
            stroke={CHART_PALETTE[6]}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_PALETTE[6] }}
            name="Winning buyers"
            connectNulls={false}
            isAnimationActive={animationActive}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
