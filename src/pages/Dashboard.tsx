import { useEffect, useState } from 'react';
import { useKpiSummary } from '../hooks/useKpiSummary';
import { useSales } from '../hooks/useSales';
import { KpiCard } from '../components/KpiCard';
import { KpiCardSkeleton } from '../components/KpiCardSkeleton';
import { PeriodSelector } from '../components/PeriodSelector';
import { RecentSalesPanel } from '../components/RecentSalesPanel';
import { ErrorState } from '../components/ErrorState';
import { formatCount, formatCurrency, formatPercent } from '../lib/format';
import type { Period } from '../lib/period';

// Phase 4 Plan 04 — KPI landing page composition. Contract locked by
// .planning/phases/04-kpi-landing-page/04-UI-SPEC.md § Layout Specifications
// (page skeleton) + § Copywriting Contract (verbatim labels and delta suffix
// rules). No new types, no new libs — pure wiring of Wave 1–3 artifacts.
//
// Composition notes:
//   - DashboardLayout (from Phase 1) provides `<main>` + outer padding. This
//     component renders just the body content: header + KPI section + Recent
//     Sales section (the panel wraps itself in its own `<section>`).
//   - Period state lives here (useState<Period>) so changes only re-render
//     the KPI section via useKpiSummary's queryKey; useSales is independent
//     and never re-keys on period changes. See CONTEXT.md § Decisions.
//   - Skeleton condition `kpi.isPending && !kpi.data`: TanStack Query v5 with
//     `placeholderData: keepPreviousData` keeps data visible across period
//     flips. Only show 4 skeletons on the FIRST load (UI-SPEC § Interaction
//     Contract → "Period change: Do NOT replace cards with skeletons").
//   - KPI and Recent Sales fail INDEPENDENTLY (CONTEXT.md + threat model
//     T-04-10/11). The two sections share no error/loading state.
//   - `deltaType="percentage-points"` is ONLY the sell-through card — both
//     values are already ratios 0–1 so subtracting yields absolute pp change
//     (UI-SPEC § Copywriting → Delta semantics). The other 3 use `'relative'`.
//   - Labels are copy-locked: "Total revenue", "Avg sell-through",
//     "Total lots sold", "Total sales count" — do NOT reorder or rename
//     (UI-SPEC § Copywriting → KPI scorecards).
//   - 4 explicit <KpiCard> blocks (NOT a map) — keeps label/formatter/
//     deltaType inline and auditable against UI-SPEC without indirection.

const PERIOD_LABEL: Record<Period, string> = {
  ytd: 'YTD',
  l6m: '6mo',
  l12m: '12mo',
};

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('l12m');

  const kpi = useKpiSummary(period);
  const sales = useSales();

  useEffect(() => {
    document.title = 'Dashboard — TPC Dashboard';
  }, []);

  const periodLabel = PERIOD_LABEL[period];

  return (
    <div>
      <header className="flex items-end justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </header>

      <section aria-labelledby="kpi-heading" className="mt-6">
        <h2 id="kpi-heading" className="sr-only">
          Performance summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpi.isPending && !kpi.data && (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          )}
          {kpi.isError && (
            <div className="col-span-full">
              <ErrorState
                heading="Couldn't load KPIs"
                body="Something went wrong fetching this period's metrics. Retry below, or try a different period."
                onRetry={() => kpi.refetch()}
              />
            </div>
          )}
          {kpi.data && !kpi.isError && (
            <>
              <KpiCard
                label="Total revenue"
                value={formatCurrency(kpi.data.current.revenue)}
                current={kpi.data.current.revenue}
                previous={kpi.data.previous.revenue}
                deltaType="relative"
                periodLabel={periodLabel}
              />
              <KpiCard
                label="Avg sell-through"
                value={formatPercent(kpi.data.current.sell_through)}
                current={kpi.data.current.sell_through}
                previous={kpi.data.previous.sell_through}
                deltaType="percentage-points"
                periodLabel={periodLabel}
              />
              <KpiCard
                label="Total lots sold"
                value={formatCount(kpi.data.current.lots_sold)}
                current={kpi.data.current.lots_sold}
                previous={kpi.data.previous.lots_sold}
                deltaType="relative"
                periodLabel={periodLabel}
              />
              <KpiCard
                label="Total sales count"
                value={formatCount(kpi.data.current.sales_count)}
                current={kpi.data.current.sales_count}
                previous={kpi.data.previous.sales_count}
                deltaType="relative"
                periodLabel={periodLabel}
              />
            </>
          )}
        </div>
      </section>

      <RecentSalesPanel
        sales={sales.data}
        isLoading={sales.isLoading}
        error={sales.error as Error | null}
        onRetry={() => sales.refetch()}
      />
    </div>
  );
}

export default DashboardPage;
