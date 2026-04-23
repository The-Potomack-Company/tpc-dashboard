// Phase 6 Plan 06-02 — /departments page (skeleton; charts added in 06-03).
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § Layout Specifications /departments (JSX skeleton),
//   § Copywriting → /departments page (page title + headings + chip copy),
//   § Interaction Contract → click rankings-table row (cross-filter toggle).
// REQ-ID: DEPT-01, INTR-01 (partial — row highlight + chip; chart dimming in 06-03).
//
// Page owns range / metric / selectedDept state. `selectedDept` threads into
// the rankings table (this plan) and will thread into the line + stacked
// charts in 06-03 via the reserved `section#departments-charts-slot` anchor.
// Declarative composition — no useEffect-driven refetch orchestration. Each
// downstream hook owns its own TanStack Query cache; changing `range`
// re-keys them simultaneously.
//
// Threat model (T-06-02-*):
//   - T-06-02-01 XSS (mitigate): user-visible text renders via React JSX text
//     children (auto-escape). The chip's `{selectedDept}` interpolation is a
//     known dept code from the server; no raw HTML injection sink exists.
//   - T-06-02-03 Information disclosure (mitigate): the route is registered
//     inside <ProtectedRoute> in App.tsx — unauthenticated users cannot reach
//     the page or trigger the hook.
//   - T-06-02-04 selectedDept tampering (accept): state is page-local; no
//     server side-effect from setting selectedDept.

import { useEffect, useState } from 'react';

import {
  DeptRankingMetricToggle,
  type RankingMetric,
} from '../components/DeptRankingMetricToggle';
import { DepartmentRankingsTable } from '../components/DepartmentRankingsTable';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { useDepartmentRankings } from '../hooks/useDepartmentRankings';
import {
  DEFAULT_RANGE_PRESET,
  rangeFromPreset,
  type Range,
} from '../lib/period';

const EMPTY_ROWS = [] as const;

export function DepartmentsPage() {
  const [range, setRange] = useState<Range>(() =>
    rangeFromPreset(DEFAULT_RANGE_PRESET),
  );
  const [metric, setMetric] = useState<RankingMetric>('revenue');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // Document title follows Phase 5 pattern (page-local, restored on unmount).
  useEffect(() => {
    document.title = 'Departments — TPC Dashboard';
    return () => {
      document.title = 'TPC Dashboard';
    };
  }, []);

  const query = useDepartmentRankings(range);
  const rows = query.data ?? EMPTY_ROWS;

  // Toggle semantics: clicking the same row clears the filter; clicking a
  // different row switches. Consistent with the chip's × button clearing to
  // null. 06-03 will consume `selectedDept` to dim non-matching series.
  function toggleSelectedDept(code: string) {
    setSelectedDept((prev) => (prev === code ? null : code));
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Departments
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedDept !== null && (
            <span
              role="status"
              className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-accent/10 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              Filtering: {selectedDept}
              <button
                type="button"
                aria-label="Clear department filter"
                onClick={() => setSelectedDept(null)}
                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          )}
          <DeptRankingMetricToggle value={metric} onChange={setMetric} />
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </header>

      <section className="mt-6">
        <DepartmentRankingsTable
          rows={rows}
          metric={metric}
          selectedDept={selectedDept}
          onToggleSelection={toggleSelectedDept}
          isPending={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
        />
      </section>

      {/* Charts added in 06-03 — placeholder anchor for plan continuity. */}
      <section id="departments-charts-slot" className="mt-8" />
    </div>
  );
}

export default DepartmentsPage;
