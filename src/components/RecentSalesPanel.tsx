import { useMemo } from 'react';
import type { Database } from '../db/database.types';
import { RecentSaleCard } from './RecentSaleCard';
import { RecentSaleCardSkeleton } from './RecentSaleCardSkeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

// Wraps the Recent Sales section — heading + grid + loading/empty/error
// states. Contract locked by 04-UI-SPEC.md § Layout Specifications (Recent
// Sales section) + § Copywriting Contract → Recent Sales panel (verbatim
// empty/error copy) + 04-RESEARCH.md § Pattern 6 (useMemo slice stability).
//
// Why useMemo on the slice: `.slice(0, 5)` on every parent render creates a
// fresh array, breaking referential equality for downstream useMemo deps
// and forcing each RecentSaleCard to remount. The dep is `[sales]` — the
// slice is stable per identity of the input array (see Pitfall 5).

type Sale = Database['public']['Tables']['sales']['Row'];

interface RecentSalesPanelProps {
  sales: readonly Sale[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const SKELETON_COUNT = 5;

export function RecentSalesPanel({
  sales,
  isLoading,
  error,
  onRetry,
}: RecentSalesPanelProps) {
  const recent = useMemo(
    () => (sales ? sales.slice(0, SKELETON_COUNT) : []),
    [sales],
  );

  return (
    <section aria-labelledby="recent-heading" className="mt-8">
      <h2
        id="recent-heading"
        className="text-xl font-semibold text-gray-900 dark:text-gray-100"
      >
        Recent sales
      </h2>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading &&
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <RecentSaleCardSkeleton key={i} />
          ))}
        {!isLoading && error && (
          <div className="col-span-full">
            <ErrorState
              heading="Couldn't load recent sales"
              body="Something went wrong talking to the database. Retry below, or refresh the page."
              onRetry={onRetry}
            />
          </div>
        )}
        {!isLoading && !error && recent.length === 0 && (
          <div className="col-span-full">
            <EmptyState heading="No sales yet">
              Run <code>npm run import:pdfs</code> to load the 457 auction
              profiles. See the README for setup.
            </EmptyState>
          </div>
        )}
        {!isLoading &&
          !error &&
          recent.length > 0 &&
          recent.map((sale) => <RecentSaleCard key={sale.id} sale={sale} />)}
      </div>
    </section>
  );
}
