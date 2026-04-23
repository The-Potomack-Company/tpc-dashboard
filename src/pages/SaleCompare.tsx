// Phase 6 Plan 06-04 — /sales/compare route component.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § /sales/compare Layout + § Copywriting.
// REQ-ID: SALE-04, SALE-05.
//
// Parses ?sales= via parseSalesParam; routes to InvalidComparisonCard on bad
// URL OR error containing "not found" (per 06-RESEARCH Open Question #3:
// any missing sale is treated as fully invalid so the user sees a uniform
// invalid-URL state rather than a partial comparison).
//
// Render branches:
//   1. parsed.kind === 'invalid'     → InvalidComparisonCard
//   2. isPending                     → TableSkeleton (1 + N columns)
//   3. isError + "not found"         → InvalidComparisonCard (per OQ #3)
//   4. isError                       → ErrorState with Retry + Back link
//   5. data ready                    → ComparisonTable

import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { parseSalesParam } from '../lib/parse-sales-param';
import type { ParsedSales } from '../lib/parse-sales-param';
import { useSalesComparison } from '../hooks/useSalesComparison';
import { ComparisonTable } from '../components/ComparisonTable';
import { BackLink } from '../components/BackLink';
import { ErrorState } from '../components/ErrorState';
import { TableSkeleton } from '../components/TableSkeleton';

type InvalidReason = Extract<ParsedSales, { kind: 'invalid' }>['reason'];

function InvalidComparisonCard({ reason: _reason }: { reason: InvalidReason }) {
  // The card body is generic (per UI-SPEC Copywriting: the same copy regardless
  // of which invalid reason triggered it). We intentionally don't surface the
  // reason to the user — empty/too-few/too-many/malformed all map to the same
  // recovery action (go back to /sales and pick 2-4 sales).
  return (
    <main className="max-w-7xl mx-auto px-8 py-8">
      <BackLink to="/sales">Back to sales</BackLink>
      <div
        className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center"
        role="alert"
      >
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Invalid comparison
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Select 2–4 sales from the sales page to compare them here.
        </p>
        <Link
          to="/sales"
          className="inline-block mt-6 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Back to sales
        </Link>
      </div>
    </main>
  );
}

export function SaleComparePage() {
  const [searchParams] = useSearchParams();
  const parsed = parseSalesParam(searchParams.get('sales'));

  // Document title scoped to the page lifetime. The restore-on-unmount effect
  // assumes the prior title was "TPC Dashboard"; if a future route needs a
  // stack-based title manager we can swap this for a shared util.
  React.useEffect(() => {
    const prev = document.title;
    document.title = 'Compare Sales — TPC Dashboard';
    return () => {
      document.title = prev;
    };
  }, []);

  // Hook is always called (React rules-of-hooks). When parsed is invalid we
  // pass an empty array; useSalesComparison's enabled gate blocks the fetch
  // (requires length 2-4), so no network traffic on invalid URLs.
  const saleNumbers = parsed.kind === 'ok' ? parsed.saleNumbers : [];
  const { data, isPending, isError, error, refetch } =
    useSalesComparison(saleNumbers);

  if (parsed.kind === 'invalid') {
    return <InvalidComparisonCard reason={parsed.reason} />;
  }

  // Open Question #3 routing: a "not found" error (from the hook's missing-
  // sale throw) should surface as Invalid comparison, NOT as a retry-able
  // ErrorState. Retrying would fail the same way, and the UX is clearer if
  // the URL itself is treated as bad.
  if (isError && /not found/i.test(error?.message ?? '')) {
    return <InvalidComparisonCard reason="malformed" />;
  }

  if (isError) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-8">
        <BackLink to="/sales">Back to sales</BackLink>
        <div className="mt-8">
          <ErrorState
            heading="Couldn't load comparison"
            body="Something went wrong fetching these sales. Retry below, or go back to the sales list."
            onRetry={() => refetch()}
          />
        </div>
      </main>
    );
  }

  if (isPending || data == null) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-8">
        <BackLink to="/sales">Back to sales</BackLink>
        <header className="mt-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Compare Sales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Comparing {parsed.saleNumbers.length} sales
          </p>
        </header>
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <TableSkeleton
              rows={20}
              columnWidths={Array(1 + parsed.saleNumbers.length).fill('w-full')}
            />
          </table>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-8 py-8">
      <BackLink to="/sales">Back to sales</BackLink>
      <header className="mt-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Compare Sales
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Comparing {data.length} sales
        </p>
      </header>
      <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <ComparisonTable sales={data} />
        </div>
      </div>
    </main>
  );
}

export default SaleComparePage;
