// Phase 6 Plan 06-02 + 06-03 — /departments page.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § Layout Specifications /departments (JSX skeleton),
//   § Copywriting → /departments page,
//   § Interaction Contract → click rankings-table row (cross-filter toggle),
//     chip bar click / 9th click max-8 flow.
// REQ-ID: DEPT-01 (06-02), DEPT-02 + DEPT-03 + INTR-01 end-to-end (06-03).
//
// Page owns range / metric / selectedDept / chipSelectedDepts / maxNotice
// state. `selectedDept` threads into the rankings table AND both charts
// (INTR-01 dim-non-matching). `chipSelectedDepts` threads into the chip
// bar + the line chart; it defaults to top-5 by total_revenue from rankings.
//
// Color assignment rule: deterministic by position in `chipSelectedDepts`
// (palette index = chip position mod 8). Codes rendered by the stacked
// chart that are NOT in the chip selection (top-N may include a dept the
// user hasn't chipped) fall back to a rankings-position-based palette slot
// so every bar segment still gets a stable color across renders.
//
// Max-8 notice lifecycle: the chip bar fires onMaxExceeded; the page sets a
// status string for 3s via setTimeout. Timer is cleared on unmount OR on
// the next onMaxExceeded so rapid repeat clicks restart the fade.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChartCard } from '../components/ChartCard';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { DepartmentChipBar } from '../components/DepartmentChipBar';
import { DepartmentRankingsTable } from '../components/DepartmentRankingsTable';
import { DepartmentRevenueLineChart } from '../components/DepartmentRevenueLineChart';
import { DepartmentShareStackedBarChart } from '../components/DepartmentShareStackedBarChart';
import {
  DeptRankingMetricToggle,
  type RankingMetric,
} from '../components/DeptRankingMetricToggle';
import { useDepartmentRankings } from '../hooks/useDepartmentRankings';
import { CHART_PALETTE } from '../lib/chart-colors';
import {
  DEFAULT_RANGE_PRESET,
  rangeFromPreset,
  type Range,
} from '../lib/period';

const EMPTY_ROWS = [] as const;
const MAX_CHIP_SELECTED = 8;
const DEFAULT_CHIP_TOPN = 5;
const MAX_NOTICE_DURATION_MS = 3000;

export function DepartmentsPage() {
  const [range, setRange] = useState<Range>(() =>
    rangeFromPreset(DEFAULT_RANGE_PRESET),
  );
  const [metric, setMetric] = useState<RankingMetric>('revenue');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [chipSelectedDepts, setChipSelectedDepts] = useState<
    readonly string[]
  >(() => []);
  const [maxNotice, setMaxNotice] = useState<string | null>(null);
  const maxNoticeTimerRef = useRef<number | null>(null);

  // Document title follows Phase 5 pattern (page-local, restored on unmount).
  useEffect(() => {
    document.title = 'Departments — TPC Dashboard';
    return () => {
      document.title = 'TPC Dashboard';
    };
  }, []);

  const query = useDepartmentRankings(range);
  const rows = query.data ?? EMPTY_ROWS;

  // Default chip selection: top-5 by total_revenue (rankings arrive sorted
  // revenue-DESC from the RPC). Runs once when rankings first populate so
  // the user can immediately see revenue lines without manually picking.
  useEffect(() => {
    if (chipSelectedDepts.length === 0 && rows.length > 0) {
      const defaults = rows
        .slice(0, DEFAULT_CHIP_TOPN)
        .map((r) => r.department_code);
      setChipSelectedDepts(defaults);
    }
  }, [rows, chipSelectedDepts.length]);

  // Cleanup max-notice timer on unmount to avoid setState on an
  // unmounted page.
  useEffect(
    () => () => {
      if (maxNoticeTimerRef.current != null) {
        window.clearTimeout(maxNoticeTimerRef.current);
      }
    },
    [],
  );

  // Deterministic color per dept code: position in chipSelectedDepts drives
  // CHART_PALETTE index. Codes outside the chip selection (top-N stacked
  // segments for depts the user hasn't selected for the line chart) fall
  // back to a rankings-position-based slot. Memoized so identity stability
  // across renders lets children skip re-renders when colors don't change.
  const rankingCodes = useMemo(
    () => rows.map((r) => r.department_code),
    [rows],
  );
  const colorForCode = useCallback(
    (code: string): string => {
      const chipIdx = chipSelectedDepts.indexOf(code);
      if (chipIdx >= 0) {
        return CHART_PALETTE[chipIdx % CHART_PALETTE.length];
      }
      const rankIdx = rankingCodes.indexOf(code);
      return CHART_PALETTE[
        rankIdx >= 0 ? rankIdx % CHART_PALETTE.length : 0
      ];
    },
    [chipSelectedDepts, rankingCodes],
  );

  const displayNameByCode = useMemo<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    for (const r of rows) map[r.department_code] = r.display_name;
    return map;
  }, [rows]);

  const chipsAvailable = useMemo(
    () =>
      rows.map((r) => ({
        code: r.department_code,
        displayName: r.display_name,
      })),
    [rows],
  );

  // Toggle semantics: clicking the same row clears the filter; clicking a
  // different row switches. Consistent with the chip's × button clearing to
  // null. The chart components dim non-matching series via `highlightedDept`.
  function toggleSelectedDept(code: string) {
    setSelectedDept((prev) => (prev === code ? null : code));
  }

  const toggleChip = useCallback((code: string) => {
    setChipSelectedDepts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const handleMaxExceeded = useCallback(() => {
    setMaxNotice('Max 8 departments — deselect one first');
    if (maxNoticeTimerRef.current != null) {
      window.clearTimeout(maxNoticeTimerRef.current);
    }
    maxNoticeTimerRef.current = window.setTimeout(() => {
      setMaxNotice(null);
      maxNoticeTimerRef.current = null;
    }, MAX_NOTICE_DURATION_MS);
  }, []);

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

      <section id="departments-charts-slot" className="mt-8">
        <ChartCard
          title="Department revenue over time"
          subtitle="Revenue per sale by department"
          height="lg"
        >
          <DepartmentChipBar
            available={chipsAvailable}
            selected={chipSelectedDepts}
            onToggle={toggleChip}
            maxSelected={MAX_CHIP_SELECTED}
            onMaxExceeded={handleMaxExceeded}
            colorForCode={colorForCode}
          />
          {/* WR-03: Always mount the live region — some ATs (JAWS, older
              NVDA) miss the first announcement when a role="status" node
              is inserted into the DOM rather than updated in place. Mirrors
              the SalesPage pattern: collapse via sr-only when empty so the
              visual layout is unchanged. */}
          <p
            role="status"
            aria-live="polite"
            className={`text-sm text-gray-500 dark:text-gray-400 transition-opacity duration-200 ${
              maxNotice ? '' : 'sr-only'
            }`}
          >
            {maxNotice ?? ''}
          </p>
          <DepartmentRevenueLineChart
            range={range}
            selectedDeptCodes={chipSelectedDepts}
            highlightedDept={selectedDept}
            displayNameByCode={displayNameByCode}
            colorForCode={colorForCode}
          />
        </ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard
          title="Department share of sale"
          subtitle="Each department's share of total revenue per sale"
          height="lg"
        >
          <DepartmentShareStackedBarChart
            range={range}
            topN={MAX_CHIP_SELECTED}
            highlightedDept={selectedDept}
            displayNameByCode={displayNameByCode}
            colorForCode={colorForCode}
          />
        </ChartCard>
      </section>
    </div>
  );
}

export default DepartmentsPage;
