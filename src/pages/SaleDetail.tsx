// Route component for /sales/:saleNumber.
//
// Wires useSale(saleNumber) through its four branches per
// 03-UI-SPEC.md § Layout Specifications (/sales/:saleNumber):
//   - loading    → back link + skeleton KPI grid + skeleton dept table
//   - error      → back link + ErrorState with Retry
//   - not_found  → SaleNotFound (also has its own back link)
//   - ok         → back link + (optional) ValidationWarningBanner +
//                  title header + SaleSummaryCard + DepartmentTable
//
// Hook order: useParams + useSale are called unconditionally at the top
// before any early returns (React Rules of Hooks). When saleNumber is
// missing (defensive — React Router should never land us here with an
// empty param since the route is /sales/:saleNumber, but useParams
// returns Partial<T>), we pass '' to useSale which guards with
// enabled: Boolean(saleNumber) — no query fires — and render
// SaleNotFound.
//
// Threat model: T-03-01 XSS via sale.title / saleNumber mitigated by
// React JSX text-child auto-escaping. T-03-02/T-03-03 elevation /
// flash-of-protected-data mitigated upstream by ProtectedRoute in
// App.tsx (page only mounts for authenticated admins) + Supabase RLS.

import { useState } from 'react';
import { useParams } from 'react-router';
import { useSale } from '../hooks/useSale';
import { SaleSummaryCard } from '../components/SaleSummaryCard';
import { DepartmentTable } from '../components/DepartmentTable';
import { ValidationWarningBanner } from '../components/ValidationWarningBanner';
import { ErrorState } from '../components/ErrorState';
import { TableSkeleton } from '../components/TableSkeleton';
import { BackLink } from '../components/BackLink';
import { RevenueWaterfallChart } from '../components/RevenueWaterfallChart';
import { SaleNotFound } from './SaleNotFound';

export function SaleDetailPage() {
  const { saleNumber } = useParams<{ saleNumber: string }>();
  // Always call useSale so the hook order is stable; it short-circuits
  // via enabled: Boolean(saleNumber) when the param is missing.
  const query = useSale(saleNumber ?? '');
  // Phase 6 Plan 06-05 (SALE-06): collapsible Revenue Breakdown section.
  // Per UI-SPEC § Interaction Contract → "Sale Detail: deep-link to
  // expanded state — Not supported in v1". Each visit starts collapsed.
  const [isWaterfallExpanded, setIsWaterfallExpanded] = useState(false);

  // Back link is rendered on every branch — UI-SPEC requires it always
  // visible on detail surfaces so the user can bail out at any time.
  const backLink = <BackLink to="/sales">Back to sales</BackLink>;

  if (!saleNumber) {
    return <SaleNotFound saleNumber="" />;
  }

  if (query.isLoading) {
    return (
      <>
        {backLink}
        <header className="mt-6">
          <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse mt-2" />
        </header>
        {/* Skeleton KPI grid — 19 tiles matching SaleSummaryCard shape */}
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 divide-x divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: 19 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse mt-2" />
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton dept table — 6 rows */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Department breakdown
          </h2>
          <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <TableSkeleton
                rows={6}
                columnWidths={[
                  'w-32',
                  'w-12',
                  'w-12',
                  'w-20',
                  'w-24',
                  'w-32',
                  'w-24',
                  'w-24',
                ]}
              />
            </table>
          </div>
        </section>
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        {backLink}
        <div className="mt-6">
          <ErrorState
            heading="Couldn't load this sale"
            body="Something went wrong. Retry below, or head back to the sales list."
            onRetry={() => query.refetch()}
          />
        </div>
      </>
    );
  }

  if (query.data?.status === 'not_found') {
    return <SaleNotFound saleNumber={saleNumber} />;
  }

  // WR-07: Narrow on `status === 'ok'` explicitly instead of asserting
  // non-null. Protects against future TanStack Query states (e.g. isPaused,
  // isFetching-without-data races) where `query.data` could be undefined
  // while `isLoading` / `isError` are both false.
  if (query.data?.status !== 'ok') return null;
  const { sale, departments } = query.data;

  return (
    <>
      {backLink}
      {sale.validation_warning && (
        <div className="mt-4">
          <ValidationWarningBanner saleNumber={saleNumber} />
        </div>
      )}
      <header className="mt-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {sale.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sale {sale.sale_number}
        </p>
      </header>
      <div className="mt-6">
        <SaleSummaryCard sale={sale} />
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Department breakdown
        </h2>
        <div className="mt-6">
          <DepartmentTable departments={departments} />
        </div>
      </section>
      {/*
        Phase 6 Plan 06-05 (SALE-06): Revenue Breakdown collapsible section.
        Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
          § Revenue Breakdown section on /sales/:saleNumber (lines 628-660)
          § Copywriting → Revenue Breakdown (lines 384-396)
          § Interaction Contract → Sale Detail chevron (lines 442-443)

        Card uses ChartCard's surface tokens (p-6 rounded-lg border
        bg-white) inline rather than composing via <ChartCard> because
        the collapsed state must render header-only (no body slot) to
        hit the 44px h-11 height spec. ChartCard always emits
        `<div className="mt-4 h-80">{children}</div>` which would
        collapse to 320px of empty space. The inline version lets the
        section collapse cleanly by simply not rendering the body div.

        Chevron button: native <button> so Enter/Space keyboard
        semantics come free (UI-SPEC § Interaction Contract line 443).
        aria-expanded + aria-label both flip on state change, and the
        SVG rotates 180deg (rotate-180 on expand) per the chevron-down
        → chevron-up contract (UI-SPEC line 40).

        Deep-link opt-in: NOT supported in v1 (UI-SPEC line 444) — state
        is purely view-local; useState initializes false on every mount.
      */}
      <section className="mt-6" aria-labelledby="revenue-breakdown-title">
        <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <header className="flex items-center justify-between gap-4">
            <h2
              id="revenue-breakdown-title"
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              Revenue breakdown
            </h2>
            <div className="flex items-center gap-3">
              {!isWaterfallExpanded && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tap to see the path from hammer to net
                </p>
              )}
              <button
                type="button"
                aria-expanded={isWaterfallExpanded}
                aria-controls="revenue-waterfall-body"
                aria-label={
                  isWaterfallExpanded
                    ? 'Collapse revenue breakdown'
                    : 'Expand revenue breakdown'
                }
                onClick={() => setIsWaterfallExpanded((v) => !v)}
                className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isWaterfallExpanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </header>
          {isWaterfallExpanded && (
            <div id="revenue-waterfall-body" className="mt-4 h-80">
              <RevenueWaterfallChart sale={sale} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default SaleDetailPage;
