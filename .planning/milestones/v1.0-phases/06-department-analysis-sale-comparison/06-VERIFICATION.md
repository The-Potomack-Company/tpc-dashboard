---
phase: 06-department-analysis-sale-comparison
verified: 2026-04-23T12:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Walk the 7-flow smoke check defined in 06-06-PLAN.md Task 2"
    expected: |
      Flow 1: Sidebar 'Departments' NavLink navigates to /departments (no Coming soon text).
      Flow 2: /departments renders rankings table + metric toggle (3 options) + date filter + chip bar (top-5 default) + line chart (DEPT-02) + stacked bar (DEPT-03) + cross-filter row-click dims non-matching series + chip appears + clearing works + 9th chip shows max-8 notice.
      Flow 3: /sales checkboxes + sticky footer + max-4 cap + Compare (N) button navigates to /sales/compare?sales=....
      Flow 4: /sales/compare renders Compare Sales heading + Comparing N sales + metric-group rows (Sale metadata / Lot metrics / Financial breakdown / Participation) + adjacent-pair deltas (columns 2-4 only) + emerald/rose/gray color coding + pp suffix on sell-through.
      Flow 5: Invalid URL branches (/sales/compare?sales=only-one, no params, malformed) all render 'Invalid comparison' card with Back to sales.
      Flow 6: Revenue breakdown ChartCard on Sale Detail is collapsed by default; chevron expands 7-bar waterfall; tooltip shows step name + signed delta + running total; chevron collapses; navigating to another sale resets to collapsed.
      Flow 7: Cross-regression — Trends page still loads; Sales page without selection still works; auth gates still redirect unauthenticated users.
    why_human: "Visual behavior (opacity dimming animation, bar colors, tooltip rendering under real browser layout, sticky-footer interplay with scroll, chart transitions) cannot be verified by automated tests. Listed as manual-only in 06-VALIDATION.md. 06-06-PLAN.md Task 2 was deferred by the user — per 06-06-SUMMARY.md, 'Task 2 is deferred to the operator.'"
---

# Phase 6: Department Analysis & Sale Comparison — Verification Report

**Phase Goal:** Users can compare departments across sales and compare selected sales side-by-side to identify patterns and outliers
**Verified:** 2026-04-23T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view departments ranked by total revenue, average sell-through, or lots above estimate | VERIFIED | `DepartmentRankingsTable.tsx` + `DeptRankingMetricToggle.tsx` + `DepartmentsPage` — sortable columns, metric toggle drives default sort DESC, 34 tests passing |
| 2 | User can select multiple departments and see their revenue plotted over time on a multi-line chart | VERIFIED | `DepartmentChipBar.tsx` + `DepartmentRevenueLineChart.tsx` — chip-bar drives `selectedDeptCodes`, one `<Line>` per code, `useDepartmentRevenueSeries` hook wired, 06-03 tests pass |
| 3 | User can view department share of sale as a stacked 100% bar chart | VERIFIED | `DepartmentShareStackedBarChart.tsx` — `stackId="share"` on every `<Bar>`, top-N + Other, `useDepartmentShareSeries` wired, 06-03 tests pass |
| 4 | User can compare 2-4 sales side-by-side with all metrics in columns, with color-coded deltas showing improvement or decline | VERIFIED | `ComparisonTable.tsx` (metric groups, adjacent-pair deltas, emerald/rose/gray color coding via `deltaColorClass`), `SaleComparePage.tsx` (`/sales/compare` route), `SaleSelectionFooter.tsx` (sticky footer + Compare CTA), 644/644 tests pass |
| 5 | User can view a revenue waterfall chart for any sale showing the path from hammer price to net revenue | VERIFIED | `RevenueWaterfallChart.tsx` + `transformToWaterfall()` + collapsible `isWaterfallExpanded` section in `SaleDetail.tsx`, 4 new sale-detail tests pass |

**Score:** 5/5 truths verified

### Human Verification Required (deferred checkpoint)

06-06-PLAN.md Task 2 is a blocking `checkpoint:human-verify` that was explicitly deferred by the user. Per 06-06-SUMMARY.md: "Task 2 is deferred to the operator." All automated checks pass but the following visual / behavioral flows require a human with a running dev server:

1. **7-flow smoke check (06-06-PLAN.md Task 2)** — See `human_verification` section in frontmatter above.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260423000000_department_analytics_rpcs.sql` | 3 RPCs + security hygiene | VERIFIED | 3 × `security definer`, 3 × `set search_path = public, pg_temp`, 4 × `if not private.is_admin()` (3 gates + 1 comment), 3 × `revoke all`, 3 × `grant execute to authenticated` |
| `src/db/database.types.ts` | Functions block includes 3 new RPCs | VERIFIED | `grep` returns 3 matches for `department_rankings\|department_revenue_series\|department_share_series`; pre-existing `kpi_summary` + `import_sale_with_departments` preserved |
| `src/lib/delta.ts` | `computePairDelta` + `deltaColorClass` | VERIFIED | Both functions exported; 14 tests passing; pure (no React/Supabase imports) |
| `src/lib/waterfall.ts` | `transformToWaterfall` producing 7 rows | VERIFIED | Exported; 9 tests passing; returns `null` when any required field is null |
| `src/hooks/useDepartmentRankings.ts` | TanStack Query hook for DEPT-01 | VERIFIED | Calls `rpc('department_rankings')`; frozen-empty singleton; 5 tests pass |
| `src/hooks/useDepartmentRevenueSeries.ts` | TanStack Query hook for DEPT-02 | VERIFIED | Calls `rpc('department_revenue_series')`; sorted queryKey; `enabled: deptCodes.length > 0`; 5 tests pass |
| `src/hooks/useDepartmentShareSeries.ts` | TanStack Query hook for DEPT-03 | VERIFIED | Calls `rpc('department_share_series')`; envelope shape-check; 5 tests pass |
| `src/hooks/useSalesComparison.ts` | Hook for SALE-04, 2-4 sale fetch | VERIFIED | `.in('sale_number', ...)` wired; sort-a-copy queryKey; `enabled: saleNumbers.length >= 2 && <= 4`; 6 tests pass |
| `src/components/DeptRankingMetricToggle.tsx` | WAI-ARIA radiogroup, 3 options | VERIFIED | `role="radiogroup"` + `aria-label="Select ranking metric"`; roving tabindex; 10 tests pass |
| `src/components/DepartmentRankingsTable.tsx` | TanStack Table, sort, filter, cross-filter | VERIFIED | 5 columns, metric-driven default sort, `globalFilterFn`, `bg-accent/5 border-l-2` highlight, `role="button"` rows; 15 tests pass |
| `src/pages/Departments.tsx` | /departments route component | VERIFIED | Owns range/metric/selectedDept/chipSelectedDepts; mounts all 3 chart components + table; chart-slot anchor; `selectedDept` threads to both charts as `highlightedDept`; 12 integration tests pass |
| `src/components/DepartmentChipBar.tsx` | Multi-select chip bar | VERIFIED | `role="switch"` per chip; max-8 cap; `onMaxExceeded` fires; color dot on active chips; 8 tests pass |
| `src/components/DepartmentRevenueLineChart.tsx` | DEPT-02 multi-line Recharts chart | VERIFIED | One `<Line>` per `renderableCodes`; `strokeOpacity` dims non-matching lines; all-null-series filter (Pitfall 8); 6 tests pass |
| `src/components/DepartmentShareStackedBarChart.tsx` | DEPT-03 stacked 100% bar chart | VERIFIED | `stackId="share"`, `fillOpacity` dims non-matching segments, Other bar uses `#9ca3af`; 6 tests pass |
| `src/lib/parse-sales-param.ts` | URL parser, discriminated union | VERIFIED | Whitelist `/^[A-Za-z0-9_-]+$/`; `CSV_SEPARATOR` exported; 10 tests pass |
| `src/components/SaleSelectionFooter.tsx` | Sticky footer for /sales | VERIFIED | Navigates to `/sales/compare?sales=<csv>`; `bg-accent` at size 2-4; `bg-gray-200` disabled at size 1; `role="status"` maxHint; 7 tests pass |
| `src/components/ComparisonTable.tsx` | Metrics-as-rows × sales-as-columns | VERIFIED | 4 metric groups; adjacent-pair deltas (col N vs N-1); `computePairDelta` + `deltaColorClass` imported; sticky first column; 10 tests pass |
| `src/pages/SaleCompare.tsx` | /sales/compare route component | VERIFIED | `useSearchParams` → `parseSalesParam` → `useSalesComparison` → `ComparisonTable`; `InvalidComparisonCard` for bad URLs; 7 integration tests pass |
| `src/components/RevenueWaterfallChart.tsx` | SALE-06 waterfall chart body | VERIFIED | Calls `transformToWaterfall(sale)`; transparent-padding-bar pattern; per-row `<Cell>` color; EmptyState when null; 8 tests pass |
| `src/pages/SaleDetail.tsx` (modified) | Revenue breakdown collapsible section | VERIFIED | `isWaterfallExpanded` state; `aria-expanded` + chevron rotate; collapses by default; 4 new integration tests pass |
| `src/layouts/DashboardLayout.tsx` (modified) | Departments as active NavLink | VERIFIED | `"/departments"` in NAV_ITEMS; `Coming soon` count = 3 (Team, Reports, Custom Charts only) |
| `src/App.tsx` (modified) | Route registrations | VERIFIED | `/departments` registered once; `/sales/compare` registered before `/sales/:saleNumber` (lines 20-21) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `20260423000000_department_analytics_rpcs.sql` | `public.sales`, `public.sale_departments`, `public.departments` | Aggregate JOINs in RPC bodies | VERIFIED | Migration contains `from public.sale_departments` and `join public.sales` |
| `useDepartmentRankings.ts` | `supabase.rpc('department_rankings')` | `rpc()` call | VERIFIED | `grep` returns 1 match |
| `useDepartmentRevenueSeries.ts` | `supabase.rpc('department_revenue_series')` | `rpc()` call | VERIFIED | `grep` returns 1 match |
| `useDepartmentShareSeries.ts` | `supabase.rpc('department_share_series')` | `rpc()` call | VERIFIED | `grep` returns 1 match |
| `useSalesComparison.ts` | `supabase.from('sales')` | `.in('sale_number', saleNumbers)` | VERIFIED | `grep` returns 2 matches (method chain) |
| `DepartmentRevenueLineChart.tsx` | `useDepartmentRevenueSeries.ts` | `useDepartmentRevenueSeries(range, deptCodes)` call | VERIFIED | 4 matches in file |
| `DepartmentShareStackedBarChart.tsx` | `useDepartmentShareSeries.ts` | `useDepartmentShareSeries(range, topN)` call | VERIFIED | 2 matches in file |
| `Departments.tsx` | `DepartmentRevenueLineChart`, `DepartmentShareStackedBarChart`, `DepartmentChipBar` | Imported and rendered; `highlightedDept={selectedDept}` | VERIFIED | 6 matches in file; `selectedDept` confirmed threaded as `highlightedDept` |
| `SaleCompare.tsx` | `useSalesComparison.ts` | `useSalesComparison(saleNumbers)` call | VERIFIED | 3 matches (import + hook + type) |
| `SaleCompare.tsx` | `parseSalesParam` | `parseSalesParam(searchParams.get('sales'))` | VERIFIED | 3 matches |
| `ComparisonTable.tsx` | `delta.ts` | `computePairDelta` + `deltaColorClass` per numeric cell | VERIFIED | 4 matches |
| `RevenueWaterfallChart.tsx` | `waterfall.ts` | `transformToWaterfall(sale)` call | VERIFIED | 3 matches (comment + import + call) |
| `SaleDetail.tsx` | `RevenueWaterfallChart.tsx` | `<RevenueWaterfallChart sale={sale}>` | VERIFIED | 2 matches |
| `App.tsx` | `SaleComparePage` | `<Route path="/sales/compare">` | VERIFIED | Line 20, before `/sales/:saleNumber` at line 21 |
| `DashboardLayout.tsx` | `/departments` | NavLink `to: "/departments"` in NAV_ITEMS | VERIFIED | `grep` returns 1 match in NAV_ITEMS object literal |
| `Sales.tsx` | `SaleSelectionFooter.tsx` | Conditional render when `selectedSaleNumbers.length >= 1` | VERIFIED | 2 matches in Sales.tsx |
| `SaleSelectionFooter.tsx` | `/sales/compare` | `navigate('/sales/compare?sales=' + csv)` | VERIFIED | Confirmed at line 42 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DepartmentRankingsTable.tsx` | `rows` prop | `useDepartmentRankings` → `supabase.rpc('department_rankings')` (live Supabase RPC, migration pushed) | YES — server-side aggregate of real `sales` + `sale_departments` tables | FLOWING |
| `DepartmentRevenueLineChart.tsx` | `data` (wide rows) | `useDepartmentRevenueSeries` → `supabase.rpc('department_revenue_series')` | YES — real RPC returning sale rows with dept revenue per column | FLOWING |
| `DepartmentShareStackedBarChart.tsx` | `rows`, `topCodes` | `useDepartmentShareSeries` → `supabase.rpc('department_share_series')` | YES — real RPC returning share envelope with top_codes | FLOWING |
| `ComparisonTable.tsx` | `sales` prop | `useSalesComparison` → `supabase.from('sales').in(...)` | YES — real DB query, `.in()` parameterized | FLOWING |
| `RevenueWaterfallChart.tsx` | `rows` (from `transformToWaterfall`) | `sale` prop from `useSale` (existing hook, unchanged) | YES — consumes existing sale object already verified in Phase 3 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 644 tests pass end-to-end | `npx vitest run --reporter=dot` | 644/644 passed, 68 test files | PASS |
| `/sales/compare` route registered before dynamic route | `grep -n 'path="/sales/compare"\|path="/sales/:saleNumber"' src/App.tsx` | Lines 20 then 21 (compare first) | PASS |
| DashboardLayout has exactly 3 Coming Soon items | `grep -o "Coming soon" src/layouts/DashboardLayout.tsx | wc -l` | 3 | PASS |
| Migration has correct security hygiene (3 × each) | `grep -c "security definer" + "set search_path" + "if not private.is_admin()"` | 3, 3, 4 (3 gates + 1 comment) | PASS |
| Database types include 3 new RPCs | `grep -c "department_rankings\|department_revenue_series\|department_share_series" src/db/database.types.ts` | 3 | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0 (per 06-06-SUMMARY.md) | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| DEPT-01 | 06-01, 06-02 | Departments ranked by total revenue, avg sell-through, lots above estimate | SATISFIED | `DepartmentRankingsTable` + `DeptRankingMetricToggle` + `useDepartmentRankings` wired end-to-end |
| DEPT-02 | 06-01, 06-03 | Multi-line chart of selected departments' revenue over time | SATISFIED | `DepartmentRevenueLineChart` + `DepartmentChipBar` + `useDepartmentRevenueSeries` wired end-to-end |
| DEPT-03 | 06-01, 06-03 | Stacked 100% bar chart of department share per sale | SATISFIED | `DepartmentShareStackedBarChart` + `useDepartmentShareSeries` wired end-to-end |
| SALE-04 | 06-01, 06-04 | Compare 2-4 sales side-by-side | SATISFIED | `SalesTable` checkbox column + `SaleSelectionFooter` + `/sales/compare` route + `useSalesComparison` wired end-to-end |
| SALE-05 | 06-01, 06-04 | Sale comparison highlights deltas with color coding | SATISFIED | `ComparisonTable` uses `computePairDelta` + `deltaColorClass`; adjacent-pair math; emerald/rose/gray classes |
| SALE-06 | 06-01, 06-05 | Revenue waterfall chart (hammer → net revenue) | SATISFIED | `RevenueWaterfallChart` + `transformToWaterfall` + collapsible section on `SaleDetail` |
| INTR-01 | 06-02, 06-03, 06-06 | Cross-filter: clicking dept dims non-matching chart series | SATISFIED (automated) / UAT pending | `selectedDept` threads from `DepartmentsPage` → both charts as `highlightedDept`; opacity/fillOpacity confirmed in source; visual behavior requires human verification |
| INFR-04 | 06-01 | Financial aggregations in PostgreSQL, not JavaScript | SATISFIED | All 3 RPCs aggregate server-side; no hook or helper performs client-side financial arithmetic |

Note: INTR-01 from plan 06-01 frontmatter (listed as INFR-04 in plan 06-01 `requirements` field) is verified separately above. The plan also listed `INTR-03` (tooltips on hover) under 06-03 and 06-05 — both charts wire `<ChartTooltip>` / `<WaterfallTooltip>` confirmed in source; visual rendering is a human-only check.

### Anti-Patterns Found

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `src/components/DepartmentRankingsTable.tsx` | `role="button"` on `<tr>` overrides native row semantics (WR-01 from code review) | Warning | Screen readers lose row/column association; announced as standalone buttons. Non-blocking for functional goal achievement. |
| `src/components/DepartmentRevenueLineChart.tsx` | Local `EMPTY_ROWS` is not frozen (WR-02 from code review) | Warning | Minor referential instability in pending→success transition with empty results. Not frozen but harmless in practice. |
| `src/pages/Departments.tsx` | `maxNotice` paragraph conditionally mounted rather than always-present with `sr-only` toggle (WR-03 from code review) | Warning | Some AT may miss first announcement. Does not block goal. |
| `src/components/DepartmentChipBar.tsx` | `new Set(selected)` runs on every render without `useMemo` (IN-04) | Info | Negligible perf cost with max-8 items. |
| `src/components/DepartmentRevenueLineChart.tsx` | Aria-label pluralization: "1 departments · 1 sales" (IN-06) | Info | Cosmetic AT readout issue. |

No MISSING artifacts. No STUB implementations (all data hooks make real RPC/DB calls; all components render real data from props). No critical blockers.

### Human Verification Required

#### 1. 7-Flow Phase 6 End-to-End Smoke Check

**Test:** Run `npm run dev`, log in as admin, walk the 7 flows defined in `06-06-PLAN.md` Task 2 (`<how-to-verify>` block):

1. Sidebar navigation — Departments NavLink → /departments
2. /departments page — rankings table + metric toggle + chip bar + line chart (DEPT-02) + stacked bar (DEPT-03) + cross-filter dimming (INTR-01) + max-8 notice
3. /sales selection — checkbox column + sticky footer + max-4 cap + Compare CTA navigation
4. /sales/compare — heading, metric-group rows, adjacent-pair deltas, pp suffix on sell-through
5. Invalid URL handling — too-few, no params, malformed → InvalidComparisonCard
6. Revenue Breakdown waterfall on Sale Detail — chevron expand/collapse, 7-bar order, tooltip behavior, per-sale state reset
7. Cross-regression — Trends, Sales without selection, auth gating

**Expected:** All 7 flows behave as documented in 06-06-PLAN.md Task 2. Return "approved" if all pass; list failing flow numbers otherwise.

**Why human:** Visual opacity dimming animation, bar colors (blue/green/red waterfall), tooltip rendering under real browser layout, sticky-footer interplay with scroll, chart transitions, and Recharts SVG rendering cannot be verified programmatically. These are explicitly listed as manual-only in 06-VALIDATION.md. The `checkpoint:human-verify` in 06-06 Task 2 was deferred by the user per 06-06-SUMMARY.md.

---

### Gaps Summary

No functional gaps. All 5 ROADMAP success criteria are verified by substantive, wired, data-flowing implementation artifacts. 644/644 tests pass. The three code-review warnings (WR-01 through WR-03) are advisory accessibility improvements — they do not block the phase goal.

**Status is `human_needed` solely because 06-06-PLAN.md Task 2 (the 7-flow browser walkthrough) was explicitly deferred by the user** and constitutes a blocking checkpoint gate on the phase.

---

_Verified: 2026-04-23T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
