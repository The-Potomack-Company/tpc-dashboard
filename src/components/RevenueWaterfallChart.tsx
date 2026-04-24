// Phase 6 Plan 06-05 — SALE-06 Revenue Waterfall chart.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § Waterfall color rules.
// REQ-ID: SALE-06, INTR-03.
// Recharts transparent-padding-bar pattern: invisible <Bar dataKey="base"> + visible <Bar dataKey="delta">
// both with stackId="waterfall". Per-row color via <Cell> keyed to direction (start/up/down/end).
// isAnimationActive={false} on BOTH bars (per 06-RESEARCH § Pattern 2 critical note — avoids the first-frame flash
// where the delta bar draws from y=0 before the base-bar offset is applied).
//
// Data flow: sale prop → transformToWaterfall(sale) → rows.
// If rows == null (any required financial field is null), render EmptyState
// per UI-SPEC § Copywriting → Revenue Breakdown "Waterfall empty state".
//
// Tooltip: inline minimal component (WaterfallTooltip). The shared ChartTooltip
// is not reused here because each hover-payload contains TWO entries (base +
// delta) but UI-SPEC requires one tooltip row per step (showing full step name,
// signed delta currency, and running total line on intermediate steps). An
// inline tooltip reads row.direction directly to decide sign prefix + whether
// to suppress the "Running total" line (suppressed for start + end per
// UI-SPEC line 394).

import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  CHART_AXIS_TICK_FILL,
  CHART_GRID_STROKE,
  CHART_PALETTE,
} from '../lib/chart-colors';
import { formatCurrency } from '../lib/format';
import { transformToWaterfall, type WaterfallRow } from '../lib/waterfall';
import type { Database } from '../db/database.types';
import { EmptyState } from './EmptyState';

type Sale = Database['public']['Tables']['sales']['Row'];

export interface RevenueWaterfallChartProps {
  sale: Sale;
}

/**
 * Direction → color map. Matches UI-SPEC § Waterfall color rules:
 *   start / end → blue-600 (CHART_PALETTE[0])   (terminal bars)
 *   up          → emerald-600 (CHART_PALETTE[1]) (positive step)
 *   down        → rose-600 (CHART_PALETTE[3])    (negative step)
 *
 * Index 2 (amber-600) and 3 (rose-600) are deliberately non-contiguous in the
 * map — rose-600 is `CHART_PALETTE[3]`, not `[2]`. Use the named palette entry
 * to make the choice grep-auditable from the UI-SPEC table.
 */
const COLOR_BY_DIRECTION = {
  start: CHART_PALETTE[0], // blue-600
  up: CHART_PALETTE[1], // emerald-600
  down: CHART_PALETTE[3], // rose-600
  end: CHART_PALETTE[0], // blue-600
} as const;

interface WaterfallTooltipPayloadEntry {
  payload: WaterfallRow;
  dataKey?: string | number;
}

interface WaterfallTooltipProps {
  active?: boolean;
  payload?: WaterfallTooltipPayloadEntry[];
}

/**
 * Inline tooltip for the waterfall. Receives Recharts' injected `active` +
 * `payload`. `payload` has TWO entries per hover (base + delta) but both
 * carry the same underlying `WaterfallRow` in `payload.payload`, so we read
 * index 0 and ignore index 1.
 *
 * Copy contract (UI-SPEC § Copywriting → Revenue Breakdown):
 *   - Header  → row.fullLabel
 *   - Delta   → "{+|-}$X,XXX.XX"  (sign by direction; 'start'/'end' have no sign)
 *   - Running → "Running total: $X,XXX.XX"  (suppressed on start + end)
 */
function WaterfallTooltip({ active, payload }: WaterfallTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const sign =
    row.direction === 'down' ? '-' : row.direction === 'up' ? '+' : '';
  const showRunningLine =
    row.direction !== 'start' && row.direction !== 'end';

  return (
    <div
      aria-live="polite"
      className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 border border-gray-800 dark:border-gray-300 shadow-lg"
    >
      <p className="text-sm font-semibold text-white dark:text-gray-900 mb-1">
        {row.fullLabel}
      </p>
      <p className="text-sm text-white dark:text-gray-900 tabular-nums">
        {sign}
        {formatCurrency(row.delta)}
      </p>
      {showRunningLine && (
        <p className="mt-1 text-xs text-gray-300 dark:text-gray-600 tabular-nums">
          Running total: {formatCurrency(row.runningTotal)}
        </p>
      )}
    </div>
  );
}

export function RevenueWaterfallChart({ sale }: RevenueWaterfallChartProps) {
  const rows = transformToWaterfall(sale);

  if (rows == null) {
    return (
      <EmptyState heading="No revenue breakdown available">
        <p>
          This sale is missing one or more financial fields needed to render
          the waterfall.
        </p>
      </EmptyState>
    );
  }

  const ariaLabel = `Revenue breakdown waterfall for sale ${sale.sale_number} — net revenue ${formatCurrency(
    sale.net_revenue ?? 0,
  )}`;

  return (
    <div role="img" aria-label={ariaLabel} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 16, bottom: 24, left: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis
            dataKey="step"
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }}
            width={80}
          />
          <Tooltip content={<WaterfallTooltip />} />
          {/* Transparent padding — lifts the visible delta bar to the correct
              running-total floor. No fill means invisible in the chart. */}
          <Bar
            dataKey="base"
            stackId="waterfall"
            fill="transparent"
            isAnimationActive={false}
          />
          {/* Visible delta — per-cell color encodes direction. Animation off
              on BOTH bars (Pattern 2 critical note) to avoid first-frame
              flash where Recharts animates the delta from y=0 before
              applying the base-bar offset. */}
          <Bar dataKey="delta" stackId="waterfall" isAnimationActive={false}>
            {rows.map((row, i) => (
              <Cell key={i} fill={COLOR_BY_DIRECTION[row.direction]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
