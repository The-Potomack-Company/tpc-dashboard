import { Link } from 'react-router';
import type { Database } from '../db/database.types';
import { formatCurrency, formatDate, formatPercent } from '../lib/format';

// Compact, navigable card for one recent sale — locked by 04-UI-SPEC.md
// § Layout Specifications → RecentSaleCard (lines 448–480). The entire card
// is a react-router <Link> so Enter activates via native anchor behavior.
//
// Security note (T-04-08 — Tampering / XSS): sale.title and sale.sale_number
// are rendered as React text children / attribute values. React JSX auto-
// escapes text and attributes so no `dangerouslySetInnerHTML` is needed or
// used. The `title` attribute also receives escaped text.

type Sale = Database['public']['Tables']['sales']['Row'];

interface RecentSaleCardProps {
  sale: Sale;
}

export function RecentSaleCard({ sale }: RecentSaleCardProps) {
  // Sell-through: lots_sold / lots_auctioned expressed as a [0, 1] ratio.
  // formatPercent returns EMPTY when the ratio is null. Guard against
  // lots_auctioned === 0 explicitly — JS would produce Infinity otherwise,
  // and formatPercent(Infinity) would render nonsense.
  const sellThroughRatio =
    sale.lots_sold != null &&
    sale.lots_auctioned != null &&
    sale.lots_auctioned > 0
      ? sale.lots_sold / sale.lots_auctioned
      : null;

  return (
    <Link
      to={`/sales/${sale.sale_number}`}
      className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[128px] space-y-1 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors"
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {sale.sale_number}
      </p>
      <p
        className="text-base text-gray-900 dark:text-gray-100 truncate"
        title={sale.title}
      >
        {sale.title}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {formatDate(sale.sale_date)}
      </p>
      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {formatCurrency(sale.net_revenue)}
      </p>
      <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
        {formatPercent(sellThroughRatio)} sell-through
      </p>
    </Link>
  );
}
