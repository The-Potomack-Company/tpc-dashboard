// Phase 5 Plan 05-07 — Trends page composition.
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § /trends.
// REQ-IDs: TRND-01..06, INTR-03 (all wired via the 5 chart components).
// State: range (Range, default L12M) + metric (HeatMapMetric, default sell_through).
// Both flow down as props to the chart children — no Zustand, no URL state.
//
// Composition notes:
//   - DashboardLayout (from Phase 1) provides `<main>` + outer padding
//     (`max-w-7xl mx-auto px-8 py-8`). This page renders just the body
//     content: header + 4 grid sections of ChartCard wrappers.
//   - range is computed once on mount via `useState(() => rangeFromPreset(...))`
//     so Date-based computations never re-run during re-renders. The
//     DateRangeFilter owns its own preset → Range translation; this page
//     only holds the resulting Range.
//   - metric lives here (not inside DepartmentHeatMap) so the MetricToggle
//     in the card's header action slot can control the chart body.
//   - Declarative composition — no useEffect-driven refetch orchestration.
//     Each chart owns its own TanStack Query hook; changing `range` re-keys
//     all 5 query keys simultaneously.
//   - `flex-wrap gap-4` on the header lets the DateRangeFilter wrap below
//     the heading on narrow viewports (UI-SPEC responsive note).
//   - `height="lg"` on the heat map routes through ChartCard (h-[400px]);
//     the other 4 cards use the default `h-80`.
//
// Threat model (T-05-07-*):
//   - T-05-07-XSS (mitigate): all user-visible text is hard-coded literals;
//     chart children render via React text nodes (auto-escape).
//   - T-05-07-RBAC (mitigate): ProtectedRoute gates the route. Non-admin
//     users see the page shell but data hooks return empty arrays under
//     the Phase 1 RLS policy.
//   - T-05-07-A11Y (mitigate): `<h1>Trends</h1>` + five `<h2>` chart titles
//     preserve landmark hierarchy; DateRangeFilter and MetricToggle own
//     their own fieldset/radiogroup semantics.

import { useEffect, useState } from 'react';

import { ChartCard } from '../components/ChartCard';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { MetricToggle, type HeatMapMetric } from '../components/MetricToggle';
import { NetRevenueTrendChart } from '../components/NetRevenueTrendChart';
import { SellThroughTrendChart } from '../components/SellThroughTrendChart';
import { EstimateAccuracyChart } from '../components/EstimateAccuracyChart';
import { BidderParticipationChart } from '../components/BidderParticipationChart';
import { DepartmentHeatMap } from '../components/DepartmentHeatMap';
import {
  DEFAULT_RANGE_PRESET,
  rangeFromPreset,
  type Range,
} from '../lib/period';

export function TrendsPage() {
  const [range, setRange] = useState<Range>(() =>
    rangeFromPreset(DEFAULT_RANGE_PRESET),
  );
  const [metric, setMetric] = useState<HeatMapMetric>('sell_through');

  useEffect(() => {
    document.title = 'Trends — TPC Dashboard';
  }, []);

  return (
    <div>
      <header className="flex items-end justify-between flex-wrap gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Trends
        </h1>
        <DateRangeFilter value={range} onChange={setRange} />
      </header>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Net revenue per sale"
          subtitle="Net revenue with 3-sale rolling trend"
        >
          <NetRevenueTrendChart range={range} />
        </ChartCard>
        <ChartCard
          title="Sell-through per sale"
          subtitle="Sell-through with 3-sale rolling trend"
        >
          <SellThroughTrendChart range={range} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <ChartCard
          title="Estimate accuracy over time"
          subtitle="Share of lots sold by estimate bracket"
        >
          <EstimateAccuracyChart range={range} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <ChartCard
          title="Bidder participation"
          subtitle="Registered bidders vs winning buyers"
        >
          <BidderParticipationChart range={range} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <ChartCard
          title="Department performance"
          height="lg"
          action={<MetricToggle value={metric} onChange={setMetric} />}
        >
          <DepartmentHeatMap range={range} metric={metric} />
        </ChartCard>
      </div>
    </div>
  );
}

export default TrendsPage;
