// Phase 5 Plan 05-06 Task 2 — TRND-04 Department performance heat map.
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § TRND-04.
// REQ-ID: TRND-04.
//
// Hand-authored CSS grid (not Recharts). 22 department rows × N sale cols,
// cells bucketed into 5 blue-ramp quintiles by sell_through or revenue_share.
// Metric is controlled by the parent (Trends page, plan 05-07) — this
// component has no internal state beyond memoized derivations.
//
// Accessibility: role="grid" + role="columnheader" / rowheader / gridcell
// structure announces a grid to AT. Cells use native `title` for hover
// values (React tooltips per cell would bloat render at 22 × N cells).
// Phase 5 documented a11y gap (UI-SPEC § Accessibility Floor): cells are
// not keyboard-focusable; adjacent table view deferred to Phase 9.
//
// Security (threat register):
//   - T-05-06-XSS (mitigate): sale_number / dept code render as React text
//     children; title attributes are string templates, auto-escaped.
//   - T-05-06-RBAC (mitigate): useDepartmentGrid enforces Phase 1 RLS
//     admin-only SELECT on sale_departments — non-admin → empty → EmptyState.
//   - T-05-06-DIVZERO (mitigate): revenue_share checks totalSaleRevenue > 0
//     before dividing; null returned otherwise so bucketClassFor is never
//     called on a null value.

import { Fragment, useMemo } from 'react';

import { ChartSkeleton } from './ChartSkeleton';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import type { HeatMapMetric } from './MetricToggle';
import { useDepartmentGrid } from '../hooks/useDepartmentGrid';
import type { DeptGridRow } from '../hooks/useDepartmentGrid';
import type { Range } from '../lib/period';
import {
  SORTED_DEPT_CODES,
  bucketClassFor,
  NO_DATA_CELL_CLASS,
  NO_DATA_CELL_STYLE,
} from '../lib/heat-map-bucket';
import { formatPercent } from '../lib/format';

export interface DepartmentHeatMapProps {
  range: Range;
  /** Controlled by the Trends page's MetricToggle (in the ChartCard action slot). */
  metric: HeatMapMetric;
}

interface PreparedCells {
  sales: DeptGridRow[];
  /** Keyed `${deptCode}|${saleNumber}` — null indicates no-data. */
  cells: Record<string, number | null>;
  min: number;
  max: number;
}

function cellKey(deptCode: string, saleNumber: string): string {
  return `${deptCode}|${saleNumber}`;
}

/**
 * Derive filtered + sorted sales, the cell-value lookup, and the min/max
 * range across non-null cells. Keyed memoization on `[data, metric]` so a
 * range-only change that yields the same `data` reference (TanStack Query
 * keepPreviousData) doesn't rebuild the map.
 */
function prepareCells(
  data: DeptGridRow[] | undefined,
  metric: HeatMapMetric,
): PreparedCells {
  const safe = data ?? [];
  // Filter rows missing a sale_date — they don't fit on the x-axis.
  const dated = safe.filter((r) => r.sale_date != null);
  // Sort defensively (hook already sorts ASC, but re-sort after filtering).
  const sales = [...dated].sort((a, b) => {
    const aDate = a.sale_date ?? '';
    const bDate = b.sale_date ?? '';
    if (aDate < bDate) return -1;
    if (aDate > bDate) return 1;
    return 0;
  });

  const cells: Record<string, number | null> = {};
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of sales) {
    // For revenue_share we need the sale's total revenue first.
    let totalSaleRevenue = 0;
    if (metric === 'revenue_share') {
      for (const d of row.sale_departments) {
        if (d.revenue != null) totalSaleRevenue += d.revenue;
      }
    }

    for (const d of row.sale_departments) {
      const key = cellKey(d.department_code, row.sale_number);
      let v: number | null;
      if (metric === 'sell_through') {
        // Stored as 0..100; convert to 0..1 ratio for formatPercent.
        v = d.sell_through_pct == null ? null : d.sell_through_pct / 100;
      } else {
        // revenue_share — dept revenue / sale total revenue. Divide-by-zero
        // guard: null when denominator is 0 or revenue is missing.
        v =
          d.revenue == null || totalSaleRevenue <= 0
            ? null
            : d.revenue / totalSaleRevenue;
      }
      cells[key] = v;
      if (v != null) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  // When every cell is null we'll still short-circuit into EmptyState above,
  // but initialize sane defaults so bucketClassFor is never called on ±Infinity.
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 0;
  }

  return { sales, cells, min, max };
}

export function DepartmentHeatMap({ range, metric }: DepartmentHeatMapProps) {
  const { data, isPending, isError, refetch } = useDepartmentGrid(range);

  const { sales, cells, min, max } = useMemo(
    () => prepareCells(data, metric),
    [data, metric],
  );

  const metricLabel = metric === 'sell_through' ? 'Sell-through' : 'Revenue share';

  if (isPending) {
    return <ChartSkeleton height="lg" />;
  }

  if (isError) {
    return (
      <ErrorState
        heading="Couldn't load this chart"
        body="Something went wrong fetching department data for the selected range. Retry below, or try a different range."
        onRetry={() => {
          refetch();
        }}
      />
    );
  }

  if (sales.length === 0) {
    return (
      <EmptyState heading="No department data in this range">
        <p>Try expanding the date filter, or switch the metric above.</p>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label="Department performance heat map"
          className="inline-grid gap-1"
          style={{
            gridTemplateColumns: `112px repeat(${sales.length}, 32px)`,
            gridTemplateRows: `24px repeat(22, 32px)`,
          }}
        >
          {/* Row 1: top-left sticky blank + column headers (sale numbers) */}
          <div
            className="sticky left-0 z-[2] bg-white dark:bg-gray-900"
            aria-hidden="true"
          />
          {sales.map((s) => (
            <div
              key={s.sale_number}
              role="columnheader"
              className="text-xs text-gray-500 dark:text-gray-400 flex items-end justify-center h-6"
            >
              {s.sale_number}
            </div>
          ))}

          {/* Rows 2..23: dept rowheader + N gridcells */}
          {SORTED_DEPT_CODES.map((code) => (
            <Fragment key={code}>
              <div
                role="rowheader"
                className="sticky left-0 z-[1] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 pr-2 flex items-center text-sm font-semibold font-mono text-gray-900 dark:text-gray-100"
              >
                {code}
              </div>
              {sales.map((s) => {
                const v = cells[cellKey(code, s.sale_number)] ?? null;
                const title = `${code} • ${s.sale_number} — ${metricLabel}: ${formatPercent(v)}`;
                if (v === null) {
                  return (
                    <div
                      key={`${code}-${s.sale_number}`}
                      role="gridcell"
                      className={`${NO_DATA_CELL_CLASS} w-8 h-8`}
                      style={NO_DATA_CELL_STYLE}
                      title={title}
                    />
                  );
                }
                const bucket = bucketClassFor(v, min, max);
                return (
                  <div
                    key={`${code}-${s.sale_number}`}
                    role="gridcell"
                    className={`${bucket} w-8 h-8`}
                    title={title}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legend — Low ⇢ High, 5 abutting swatches (UI-SPEC § Corrected legend markup). */}
      <div className="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Low</span>
        <div className="flex" aria-hidden="true">
          <div className="w-4 h-2 bg-blue-100" />
          <div className="w-4 h-2 bg-blue-300" />
          <div className="w-4 h-2 bg-blue-500" />
          <div className="w-4 h-2 bg-blue-700" />
          <div className="w-4 h-2 bg-blue-900" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
