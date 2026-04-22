// Route component for /sales.
//
// Wires useSales() into the page shell per 03-UI-SPEC.md § Layout
// Specifications (/sales). Handles the four query branches:
//   - loading  → TableSkeleton (10 rows)
//   - error    → ErrorState with Retry
//   - empty    → EmptyState ("No sales yet" with npm run import:pdfs hint)
//   - success  → SalesTable (virtualized, sortable, filterable)
//
// Filter state lives locally; the raw input drives the live match-count
// readout, and the deferred value feeds SalesTable (React 19
// useDeferredValue per 03-RESEARCH.md Pattern 5). The aria-live region
// only renders when the filter is non-empty, matching the UI-SPEC.
//
// Threat model: T-03-01 XSS mitigated by React JSX auto-escaping — every
// sale.title / sale.sale_number flows through flexRender text children,
// never through dangerouslySetInnerHTML. T-03-08 ReDoS is mitigated by
// SalesTable's globalFilterFn: 'includesString' (no regex compilation).

import * as React from 'react';
import { useSales } from '../hooks/useSales';
import { SalesTable } from '../components/SalesTable';
import { FilterInput } from '../components/FilterInput';
import { TableSkeleton } from '../components/TableSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

export function SalesPage() {
  const query = useSales();
  const [filter, setFilter] = React.useState('');
  const deferredFilter = React.useDeferredValue(filter);

  const sales = query.data ?? [];
  const count = sales.length;

  // Compute the filtered count from the deferred filter so it matches
  // what SalesTable is rendering. Guard against Supabase returning a row
  // without title/sale_number (both are nullable in the DB).
  const filteredCount = React.useMemo(() => {
    if (!deferredFilter) return count;
    const lower = deferredFilter.toLowerCase();
    return sales.filter((s) => {
      const title = (s.title ?? '').toLowerCase();
      const num = (s.sale_number ?? '').toLowerCase();
      return title.includes(lower) || num.includes(lower);
    }).length;
  }, [sales, deferredFilter, count]);

  return (
    <>
      <header className="flex flex-col md:flex-row md:items-end md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Sales
          </h1>
          {count > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {count} sales imported
            </p>
          )}
          {filter && count > 0 && (
            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-sm text-gray-500 dark:text-gray-400 mt-1"
            >
              {filteredCount} of {count} sales
            </p>
          )}
        </div>
        <FilterInput
          value={filter}
          onChange={setFilter}
          placeholder="Search sales…"
          ariaLabel="Filter sales by title or sale number"
        />
      </header>

      {query.isLoading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <TableSkeleton
              rows={10}
              columnWidths={[
                'w-16',
                'w-48',
                'w-20',
                'w-12',
                'w-12',
                'w-20',
                'w-24',
                'w-24',
              ]}
            />
          </table>
        </div>
      )}

      {query.isError && (
        <ErrorState
          heading="Couldn't load sales"
          body="Something went wrong talking to the database. Retry below, or refresh the page."
          onRetry={() => query.refetch()}
        />
      )}

      {query.isSuccess && sales.length === 0 && (
        <EmptyState heading="No sales yet">
          <p>
            Run{' '}
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-sm">
              npm run import:pdfs
            </code>{' '}
            to load the 457 auction profiles. See the README for setup.
          </p>
        </EmptyState>
      )}

      {query.isSuccess && sales.length > 0 && (
        <SalesTable sales={sales} filterText={deferredFilter} />
      )}
    </>
  );
}

export default SalesPage;
