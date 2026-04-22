// 4×N KPI tile grid for the /sales/:saleNumber summary card.
//
// Contract: 03-UI-SPEC.md § KPI summary card (19 locked tile labels +
// their source fields + formatter); § Color (white/gray-900 surface,
// no accent); § Spacing (p-4 tile padding, divide-based 1px dividers).
//
// Implementation notes:
//   - Tile order matches UI-SPEC § Copywriting → KPI summary card table
//     verbatim; the 4-column grid naturally wraps 19 tiles to 4×5 with
//     one trailing empty cell. The outer card's `overflow-hidden` clips
//     divider lines at the rounded corners.
//   - No HTML title attribute anywhere — payment_status renders its enum
//     label only (see UI-SPEC § Payment status resolution / OQ1).
//   - Sell-through rate is derived (lots_sold / lots_auctioned). Guard
//     against divide-by-zero: lots_auctioned must be > 0.
//   - Every tile value flows through src/lib/format.ts — null/undefined
//     fields render as EMPTY (em-dash), never "N/A", never blank.
//
// Threat model: T-03-01 (XSS via sale.* strings) is mitigated by React
// auto-escaping every text node. T-03-06 (unknown payment_status enum)
// is mitigated by formatPaymentStatus's whitelist.

import type { Database } from '../db/database.types';
import {
  formatCurrency,
  formatCount,
  formatDate,
  formatPercent,
  formatEstimateRange,
  formatPaymentStatus,
} from '../lib/format';

type Sale = Database['public']['Tables']['sales']['Row'];

interface SaleSummaryCardProps {
  sale: Sale;
}

interface Tile {
  label: string;
  value: string;
}

function buildTiles(sale: Sale): Tile[] {
  const sellThrough =
    sale.lots_sold != null &&
    sale.lots_auctioned != null &&
    sale.lots_auctioned > 0
      ? sale.lots_sold / sale.lots_auctioned
      : null;

  return [
    { label: 'Sale date', value: formatDate(sale.sale_date) },
    { label: 'Lots auctioned', value: formatCount(sale.lots_auctioned) },
    { label: 'Lots sold', value: formatCount(sale.lots_sold) },
    { label: 'Lots unsold', value: formatCount(sale.lots_unsold) },
    { label: 'Sell-through rate', value: formatPercent(sellThrough) },
    { label: 'Total sold value', value: formatCurrency(sale.total_sold_value) },
    {
      label: 'Total unsold value',
      value: formatCurrency(sale.total_unsold_value),
    },
    {
      label: 'Estimate range',
      value: formatEstimateRange(
        sale.total_low_estimate,
        sale.total_high_estimate,
      ),
    },
    { label: 'Reserves', value: formatCurrency(sale.total_reserves) },
    { label: 'Hammer total', value: formatCurrency(sale.hammer_total) },
    { label: 'Buyer premium', value: formatCurrency(sale.buyer_premium) },
    { label: 'Commission', value: formatCurrency(sale.seller_commission) },
    { label: 'Insurance', value: formatCurrency(sale.insurance) },
    { label: 'Lot charges', value: formatCurrency(sale.lot_charges) },
    { label: 'Referral fees', value: formatCurrency(sale.referral_fees) },
    { label: 'Net revenue', value: formatCurrency(sale.net_revenue) },
    {
      label: 'Registered bidders',
      value: formatCount(sale.registered_bidders),
    },
    { label: 'Buyers', value: formatCount(sale.winning_buyers) },
    {
      label: 'Payment status',
      value: formatPaymentStatus(sale.payment_status),
    },
  ];
}

export function SaleSummaryCard({ sale }: SaleSummaryCardProps) {
  const tiles = buildTiles(sale);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 divide-x divide-y divide-gray-200 dark:divide-gray-700">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="p-4 bg-white dark:bg-gray-900"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tile.label}
            </p>
            <p className="text-base font-semibold tabular-nums mt-1 text-gray-900 dark:text-gray-100">
              {tile.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
