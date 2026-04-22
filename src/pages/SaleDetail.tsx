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

import { useParams } from 'react-router';
import { useSale } from '../hooks/useSale';
import { SaleSummaryCard } from '../components/SaleSummaryCard';
import { DepartmentTable } from '../components/DepartmentTable';
import { ValidationWarningBanner } from '../components/ValidationWarningBanner';
import { ErrorState } from '../components/ErrorState';
import { TableSkeleton } from '../components/TableSkeleton';
import { BackLink } from '../components/BackLink';
import { SaleNotFound } from './SaleNotFound';

export function SaleDetailPage() {
  const { saleNumber } = useParams<{ saleNumber: string }>();
  // Always call useSale so the hook order is stable; it short-circuits
  // via enabled: Boolean(saleNumber) when the param is missing.
  const query = useSale(saleNumber ?? '');

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

  // status === 'ok'
  const { sale, departments } = query.data!;

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
    </>
  );
}

export default SaleDetailPage;
