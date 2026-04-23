// Phase 6 Plan 06-04 — SALE-04 / SALE-05 comparison grid.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § ComparisonTable + § Copywriting.
// REQ-ID: SALE-04, SALE-05.
//
// Metrics as rows × sales as columns; adjacent-pair deltas (col N vs col N-1).
// First column is sticky (sticky left-0 bg-white z-[1]). Delta color via
// deltaColorClass. See the UI-SPEC for the locked metric label list +
// four group-name headings.
//
// Column naming reconciliation vs plan METRICS sketch:
//   - plan used low_estimate/high_estimate; DB has total_low_estimate and
//     total_high_estimate. We use the DB column names; label reads
//     "Total low estimate" / "Total high estimate".
//   - plan used sell_through_pct; DB has no such column. We compute
//     lots_sold / lots_auctioned (same as SaleSummaryCard). Returns ratio
//     in [0, 1] so formatPercent renders XX.X% and absolute_pp delta
//     subtracts two ratios cleanly.
//
// Adjacent-pair delta math (Pitfall 3 guard): sales[colIdx - 1] is
// explicitly referenced — the first column renders no delta, and column N
// always compares against column N-1 (NOT against column 0).

import * as React from 'react';
import type { Database } from '../db/database.types';
import {
  formatCurrency,
  formatCount,
  formatPercent,
  formatDate,
  formatPaymentStatus,
  EMPTY,
} from '../lib/format';
import { computePairDelta, deltaColorClass } from '../lib/delta';

type Sale = Database['public']['Tables']['sales']['Row'];

export interface ComparisonTableProps {
  sales: readonly Sale[];
}

type GroupName =
  | 'Sale metadata'
  | 'Lot metrics'
  | 'Financial breakdown'
  | 'Participation';

type DeltaMode = 'relative' | 'absolute_pp' | null;

interface MetricDef {
  group: GroupName;
  label: string;
  get: (s: Sale) => number | string | null;
  format: (v: number | string | null) => string;
  deltaMode: DeltaMode;
}

const currencyMetric = (
  group: GroupName,
  label: string,
  get: (s: Sale) => number | null,
): MetricDef => ({
  group,
  label,
  get,
  format: (v) => (typeof v === 'number' ? formatCurrency(v) : EMPTY),
  deltaMode: 'relative',
});

const countMetric = (
  group: GroupName,
  label: string,
  get: (s: Sale) => number | null,
): MetricDef => ({
  group,
  label,
  get,
  format: (v) => (typeof v === 'number' ? formatCount(v) : EMPTY),
  deltaMode: 'relative',
});

const METRICS: readonly MetricDef[] = [
  {
    group: 'Sale metadata',
    label: 'Sale date',
    get: (s) => s.sale_date,
    format: (v) => (typeof v === 'string' ? formatDate(v) : EMPTY),
    deltaMode: null,
  },
  {
    group: 'Sale metadata',
    label: 'Title',
    get: (s) => s.title,
    format: (v) => (typeof v === 'string' && v.length > 0 ? v : EMPTY),
    deltaMode: null,
  },
  {
    group: 'Sale metadata',
    label: 'Payment status',
    get: (s) => s.payment_status,
    format: (v) => (typeof v === 'string' ? formatPaymentStatus(v) : EMPTY),
    deltaMode: null,
  },

  countMetric('Lot metrics', 'Lots auctioned', (s) => s.lots_auctioned),
  countMetric('Lot metrics', 'Lots sold', (s) => s.lots_sold),
  countMetric('Lot metrics', 'Lots unsold', (s) => s.lots_unsold),
  {
    group: 'Lot metrics',
    label: 'Sell-through %',
    get: (s) =>
      s.lots_sold != null &&
      s.lots_auctioned != null &&
      s.lots_auctioned > 0
        ? s.lots_sold / s.lots_auctioned
        : null,
    format: (v) => (typeof v === 'number' ? formatPercent(v) : EMPTY),
    deltaMode: 'absolute_pp',
  },
  currencyMetric('Lot metrics', 'Total sold value', (s) => s.total_sold_value),
  currencyMetric('Lot metrics', 'Total unsold value', (s) => s.total_unsold_value),
  currencyMetric('Lot metrics', 'Total low estimate', (s) => s.total_low_estimate),
  currencyMetric('Lot metrics', 'Total high estimate', (s) => s.total_high_estimate),
  currencyMetric('Lot metrics', 'Total reserves', (s) => s.total_reserves),

  currencyMetric('Financial breakdown', 'Hammer total', (s) => s.hammer_total),
  currencyMetric('Financial breakdown', 'Buyer premium', (s) => s.buyer_premium),
  currencyMetric('Financial breakdown', 'Commission', (s) => s.seller_commission),
  currencyMetric('Financial breakdown', 'Insurance', (s) => s.insurance),
  currencyMetric('Financial breakdown', 'Lot charges', (s) => s.lot_charges),
  currencyMetric('Financial breakdown', 'Referral fees', (s) => s.referral_fees),
  currencyMetric('Financial breakdown', 'Net revenue', (s) => s.net_revenue),

  countMetric('Participation', 'Registered bidders', (s) => s.registered_bidders),
  countMetric('Participation', 'Winning buyers', (s) => s.winning_buyers),
];

const GROUP_ORDER: readonly GroupName[] = [
  'Sale metadata',
  'Lot metrics',
  'Financial breakdown',
  'Participation',
];

function groupMetrics(): Record<GroupName, readonly MetricDef[]> {
  const byGroup: Record<GroupName, MetricDef[]> = {
    'Sale metadata': [],
    'Lot metrics': [],
    'Financial breakdown': [],
    'Participation': [],
  };
  for (const m of METRICS) byGroup[m.group].push(m);
  return byGroup as Record<GroupName, readonly MetricDef[]>;
}

export function ComparisonTable({ sales }: ComparisonTableProps) {
  const byGroup = React.useMemo(() => groupMetrics(), []);
  const columnCount = 1 + sales.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="h-12">
            <th
              scope="col"
              className="sticky left-0 bg-white dark:bg-gray-900 z-[1] border-r border-gray-200 dark:border-gray-700 w-56 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400"
            >
              <span className="sr-only">Metric</span>
            </th>
            {sales.map((s) => (
              <th
                key={s.sale_number}
                scope="col"
                className="px-4 text-left align-top py-2"
              >
                <div className="font-mono font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {s.sale_number}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(s.sale_date)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {GROUP_ORDER.map((group) => (
            <React.Fragment key={group}>
              <tr className="h-10 bg-gray-50 dark:bg-gray-800">
                <td
                  colSpan={columnCount}
                  className="px-4 text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  {group}
                </td>
              </tr>
              {byGroup[group].map((metric) => (
                <tr key={metric.label} aria-label={metric.label}>
                  <td
                    className="sticky left-0 bg-white dark:bg-gray-900 z-[1] border-r border-gray-200 dark:border-gray-700 w-56 px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 align-top"
                  >
                    {metric.label}
                  </td>
                  {sales.map((sale, colIdx) => {
                    const value = metric.get(sale);
                    const formatted = metric.format(value);
                    const renderDelta = metric.deltaMode != null && colIdx > 0;
                    let deltaText = '';
                    let deltaColor = '';
                    let vsLabel = '';
                    if (renderDelta) {
                      const prevSale = sales[colIdx - 1];
                      const prevValue = metric.get(prevSale);
                      const cur = typeof value === 'number' ? value : null;
                      const prev = typeof prevValue === 'number' ? prevValue : null;
                      const delta = computePairDelta(
                        cur,
                        prev,
                        metric.deltaMode ?? 'relative',
                      );
                      deltaText = delta.text;
                      deltaColor = deltaColorClass(delta.direction);
                      vsLabel = 'vs ' + prevSale.sale_number;
                    }

                    return (
                      <td
                        key={sale.sale_number}
                        className="px-4 py-3 align-top"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900 dark:text-gray-100 tabular-nums">
                            {formatted}
                          </span>
                          {renderDelta && (
                            <>
                              <span
                                className={
                                  'text-sm font-semibold tabular-nums ' + deltaColor
                                }
                              >
                                {deltaText}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {vsLabel}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
