---
phase: 06-department-analysis-sale-comparison
plan: 02
subsystem: ui, routing, components

tags:
  - react
  - typescript
  - tanstack-table
  - vitest
  - tdd
  - wai-aria
  - cross-filter

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: ProtectedRoute + DashboardLayout wrapping, auth store gates
  - phase: 03-sale-views
    provides: FilterInput + SortIndicator + EmptyState + ErrorState + TableSkeleton; SalesTable pattern; format helpers
  - phase: 05-trend-analysis
    provides: DateRangeFilter + Range/RangePreset + rangeFromPreset + DEFAULT_RANGE_PRESET; MetricToggle radiogroup pattern (mirror source)
  - plan: 06-01
    provides: useDepartmentRankings hook + DepartmentRanking type

provides:
  - src/components/DeptRankingMetricToggle.tsx — DEPT-01 ranking metric selector (radiogroup; 3 options)
  - src/components/DepartmentRankingsTable.tsx — TanStack Table v8 rankings table with INTR-01 cross-filter row highlight
  - src/pages/Departments.tsx — /departments route component (skeleton — charts added in 06-03)
  - /departments route wiring in src/App.tsx (inside ProtectedRoute → DashboardLayout tree)
  - section#departments-charts-slot anchor reserved for 06-03 chart mounting

affects:
  - Plan 06-03 (Department charts) — will mount DepartmentRevenueLineChart + DepartmentShareStackedBarChart inside section#departments-charts-slot; consumes selectedDept for dimming
  - Plan 06-06 (Sidebar nav flip) — will flip Departments nav item from aria-disabled span to active NavLink targeting this route

# Tech tracking
tech-stack:
  added: []  # no new packages
  patterns:
    - "Radiogroup via role='radiogroup' + buttons[role='radio'] + roving tabindex (matches Phase 5 MetricToggle precisely)"
    - "TanStack Table v8 nulls-last sort via null→undefined accessor + sortUndefined: 'last' (a custom sortingFn alone fails because v8 inverts the fn's return sign on DESC, flipping nulls to the top)"
    - "Custom globalFilterFn uses String.includes on a composed haystack (department_code + ' ' + display_name) — case-insensitive, no regex, no ReDoS (T-06-02-02)"
    - "Metric-prop-reset-sorting: useEffect on [metric] flips SortingState to the metric's DESC default; manual header clicks cycle within the same metric"
    - "Cross-filter chip uses role='status' + translucent bg-accent/10 surface (accent reservation #7 extension per UI-SPEC § Color) — reads as 'selection marker, not CTA'"
    - "Row-as-button accessibility: role='button' + tabIndex=0 + aria-pressed + Enter/Space parity with click (matches SalesTable keyboard pattern)"
    - "Declarative composition: page owns range/metric/selectedDept; downstream children are fully controlled. No useEffect-driven refetch orchestration — TanStack Query reads on range change"
    - "TDD discipline preserved: test-fails-at-import RED commit → feat-passes-tests GREEN commit for each of 3 tasks"

key-files:
  created:
    - src/components/DeptRankingMetricToggle.tsx
    - src/components/DeptRankingMetricToggle.test.tsx
    - src/components/DepartmentRankingsTable.tsx
    - src/components/DepartmentRankingsTable.test.tsx
    - src/pages/Departments.tsx
    - src/tests/departments-page.test.tsx
  modified:
    - src/App.tsx  # +import DepartmentsPage, +<Route path="/departments" ...>

key-decisions:
  - "TanStack Table v8 nulls-last via sortUndefined not sortingFn. A custom sortingFn returning +1 for 'a is null' works for ASC but v8 inverts the sign on DESC, flipping nulls to the top. Mapping null → undefined in the accessor + `sortUndefined: 'last'` is direction-agnostic and the cleanest v8 idiom."
  - "Test dept codes ADEP/BDEP/CDEP not A/B/C. byRole('button', { name: /^A/ }) in the rendered DOM matched the 'Avg sell-through' column-header button (it's also role='button' in TanStack headerless tables). Test codes were lengthened to 3-4 chars so the regex name scoping rejects the column-header button. No production impact — real dept codes are 3+ chars (ASN, FRN, PNT, CER, SIL, DRW, etc.)."
  - "Cross-filter chip in page, not a separate CrossFilterChip component. UI-SPEC § Structural inventory listed CrossFilterChip as a component, but for 06-02's minimal surface (single usage site, 12 lines of JSX) inlining it into DepartmentsPage keeps the component tree shallower. 06-03 will not need a shared CrossFilterChip either — the chip is /departments-specific."
  - "section#departments-charts-slot placeholder left in place. 06-03 will mount charts inside this anchor; the ID makes the handoff explicit and lets e2e smoke tests assert 'section exists, chart children present after 06-03'."
  - "No DashboardLayout modification. UI-SPEC flips the 'Departments' sidebar nav entry from aria-disabled span to active NavLink — but that's 06-06's scope. This plan intentionally leaves the sidebar untouched so the two concerns (route existence vs nav exposure) remain independent."

patterns-established:
  - "Phase 6 page wiring idiom: page-local useState for range/metric/selectedDept; useDepartmentRankings(range) data; useEffect-based document.title with restore on unmount; declarative composition (no refetch useEffects)"
  - "TanStack Table null-sort idiom: accessor remaps null → undefined + sortUndefined: 'last' (not a custom sortingFn)"
  - "Cross-filter row highlight class composition: inline array.filter(Boolean).join(' ') for conditional bg-accent/5 + border-l-2 border-accent"
  - "Chip with aria-label close button: role='status' container + inner button with aria-label='Clear {thing} filter' (matches FilterInput's clear-button pattern)"

requirements-completed:
  - DEPT-01  # Rankings table with sortable columns + metric toggle + cross-filter row highlight
  - INTR-01  # Partial — row highlight + chip surface + chip dismissal work end-to-end; chart dimming ships in 06-03

# Metrics
duration: ~50m  (Task 1 ~12m, Task 2 ~25m including null-sort debugging, Task 3 ~13m)
completed: 2026-04-23
---

# Phase 6 Plan 06-02: Departments Page Skeleton + Rankings Table Summary

**Ships `/departments` route, DEPT-01 rankings table with sort/filter/cross-filter highlight, DeptRankingMetricToggle radiogroup — the page surface that 06-03 will mount charts into.**

## Performance

- **Duration:** ~50m total (Task 1 ~12m, Task 2 ~25m, Task 3 ~13m)
- **Started:** 2026-04-23 (after 06-01 GREEN complete)
- **Completed:** 2026-04-23 (same session)
- **Tasks:** 3 (all TDD)
- **Files created:** 6 (3 components/pages + 3 tests)
- **Files modified:** 1 (src/App.tsx — 2 lines: import + Route)

## Accomplishments

- `DeptRankingMetricToggle` — WAI-ARIA radiogroup mirroring MetricToggle's pattern (roving tabindex, Arrow Left/Right/Up/Down + Home/End navigation with wrap). 3 options with exact UI-SPEC copy. Active background uses `bg-gray-50 / dark:bg-gray-800` (NOT accent) per UI-SPEC § Color (accent reservations for Phase 6 stay limited to selection indicators).
- `DepartmentRankingsTable` — TanStack Table v8 with 5 columns (Department / Sales / Total revenue / Avg sell-through / Above estimate). Default sort derived from `metric` prop DESC; useEffect resets on metric change; manual header clicks cycle within a metric. Custom global filter matches code OR display_name case-insensitive via `String.includes` (no regex, no ReDoS surface). Null avg_sell_through sorts last regardless of direction via `sortUndefined: 'last'`. Null display_name falls back to department_code (Pitfall 7). Row click fires `onToggleSelection(deptCode)`; selected row gets `bg-accent/5 + border-l-2 border-accent`. Rows are `role=button` + `tabIndex=0` + `aria-pressed` with Enter/Space keyboard parity.
- `DepartmentsPage` — page owns `range` (L12M default), `metric` (`'revenue'` default), `selectedDept` (`null` default) state. Mounts `useDepartmentRankings(range)`; retries via `query.refetch()`. Toggle semantics: clicking same row clears; different row switches; chip × button clears to null. Document title set/restored. Reserves `section#departments-charts-slot` anchor for 06-03.
- `src/App.tsx` — `<Route path="/departments" element={<DepartmentsPage />}>` registered inside the existing `<ProtectedRoute><DashboardLayout>` tree (mirrors `/trends` route registration).
- **34 new tests (all passing).** Full suite: **557 tests pass** (523 pre-existing + 34 new), 0 failed, 0 skipped. `npx tsc --noEmit` clean.

## Task Commits

Each task committed atomically as a RED → GREEN pair (TDD discipline):

1. **Task 1: DeptRankingMetricToggle + test**
   - RED: `3ebe282` (test — RED verified: module not found)
   - GREEN: `3ea6c93` (feat — 10 tests passing)
2. **Task 2: DepartmentRankingsTable + test**
   - RED: `6efadfe` (test — RED verified: module not found)
   - GREEN: `78b1325` (feat — 15 tests passing; combined with test-code-length adjustment ADEP/BDEP/CDEP for unambiguous role-query scoping)
3. **Task 3: DepartmentsPage + /departments route + integration test**
   - RED: `a02b608` (test — RED verified: module not found)
   - GREEN: `3073775` (feat — 9 tests passing; App.tsx route wired)

All commits used `--no-verify` per the parallel-executor protocol.

_TDD discipline: each RED commit was verified to fail (module not found at import) before writing the implementation; each GREEN commit was verified to pass before the next task began._

## Files Created/Modified

- `src/components/DeptRankingMetricToggle.tsx` (120 lines) — 3-option radiogroup with roving tabindex + arrow-key wrap
- `src/components/DeptRankingMetricToggle.test.tsx` (153 lines) — 10 tests (3 render + 2 keyboard wrap + 1 title + active-style + focus-ring + no-onchange-on-mount)
- `src/components/DepartmentRankingsTable.tsx` (311 lines) — TanStack Table v8 with null-last sort + custom global filter + 4 state branches + INTR-01 row highlight
- `src/components/DepartmentRankingsTable.test.tsx` (446 lines) — 15 tests (3 state branches + 3 rendering/sort + 2 filter + 4 selection + 3 edge cases)
- `src/pages/Departments.tsx` (107 lines) — page composition + state + cross-filter chip + chart-slot anchor
- `src/tests/departments-page.test.tsx` (226 lines) — 9 integration tests (mock useDepartmentRankings; exercises toggle / chip / metric / range forwarding)
- `src/App.tsx` (+2 lines) — import + `<Route path="/departments" ...>` registration

## Interface Signatures

```ts
// src/components/DeptRankingMetricToggle.tsx
export type RankingMetric = 'revenue' | 'sell_through' | 'lots_above_estimate';
export interface DeptRankingMetricToggleProps {
  value: RankingMetric;
  onChange: (next: RankingMetric) => void;
}
export function DeptRankingMetricToggle(props: DeptRankingMetricToggleProps): JSX.Element;

// src/components/DepartmentRankingsTable.tsx
export interface DepartmentRankingsTableProps {
  rows: readonly DepartmentRanking[];
  metric: RankingMetric;
  selectedDept: string | null;
  onToggleSelection: (deptCode: string) => void;
  isPending: boolean;
  isError: boolean;
  onRetry?: () => void;
}
export function DepartmentRankingsTable(props: DepartmentRankingsTableProps): JSX.Element;

// src/pages/Departments.tsx
export function DepartmentsPage(): JSX.Element;
```

## `selectedDept` Threading to 06-03 Charts

`DepartmentsPage` owns `selectedDept: string | null` in local `useState`. It's passed to `DepartmentRankingsTable` via the `selectedDept` prop (drives row highlight) and will be passed to the 06-03 chart components via the same mechanism. 06-03 will:

1. Add `<DepartmentRevenueLineChart ... selectedDept={selectedDept} />` inside `section#departments-charts-slot`.
2. Add `<DepartmentShareStackedBarChart ... selectedDept={selectedDept} />` also inside that section.
3. Add `<DepartmentChipBar ... selectedChipDepts={...} />` above the line chart (local `chipSelectedDepts` state lives there — distinct from `selectedDept`, per CONTEXT.md).

The page component needs no further state wiring for 06-03 — the slot is already provisioned and `selectedDept` is already in scope. The only page change 06-03 will make is rendering the chart children inside the slot and adding `chipSelectedDepts` state for the chip bar.

## Interaction Contract Traceability (DEPT-01 + INTR-01)

| Interaction | Covered By | Test |
|-------------|-----------|------|
| Click metric toggle option → resorts table DESC by new metric | DeptRankingMetricToggle onChange → setMetric → useEffect resets table sorting | departments-page T5 + DepartmentRankingsTable "changing metric prop resets" |
| Keyboard arrow keys on metric toggle → roving tabindex + onChange | DeptRankingMetricToggle handleKeyDown | DeptRankingMetricToggle T4 (ArrowRight wrap) + T5 (ArrowLeft wrap) |
| Click date-range preset → refetch rankings | DateRangeFilter onChange → setRange → useDepartmentRankings(range) re-keys | departments-page "calls useDepartmentRankings with Range carrying L12M preset" |
| Click rankings row → sets selectedDept; chip appears | DepartmentRankingsTable onClick → onToggleSelection → page setSelectedDept | departments-page T6 |
| Click same row again → clears selectedDept; chip disappears | toggleSelectedDept ternary (prev === code ? null : code) | departments-page T6 (second click) |
| Keyboard Enter/Space on row → toggles selection | DepartmentRankingsTable onKeyDown | DepartmentRankingsTable T10 + "Space on a focused row" |
| Click chip × button → clears selectedDept | Chip button onClick → setSelectedDept(null) | departments-page T7 |
| Matching row gets bg-accent/5 + border-l-2 | DepartmentRankingsTable rowClass composition | DepartmentRankingsTable T9 |
| Null display_name → falls back to department_code (no "null" text) | `{r.display_name ?? r.department_code}` cell | DepartmentRankingsTable T11 |
| Null avg_sell_through → em-dash cell + sorts last | Cell `v == null ? '—' : formatPercent(v)`; accessor null→undefined + sortUndefined:'last' | DepartmentRankingsTable "null avg_sell_through renders em-dash and sorts last" |

## Test Counts per Artifact

| Artifact | Test file | Cases |
|----------|-----------|-------|
| `DeptRankingMetricToggle.tsx` | `DeptRankingMetricToggle.test.tsx` | 10 |
| `DepartmentRankingsTable.tsx` | `DepartmentRankingsTable.test.tsx` | 15 |
| `DepartmentsPage` (`Departments.tsx`) | `src/tests/departments-page.test.tsx` | 9 |
| **Total** |  | **34** |

Full suite after 06-02: **557 passed** (523 pre-existing + 34 new), **0 failed**, **0 skipped**. `npx tsc --noEmit` clean. Plan grep checks: `grep -c 'path="/departments"' src/App.tsx` returns `1`; `grep -c 'DepartmentsPage' src/App.tsx` returns `2`.

## Requirement Traceability

| REQ-ID | Description | Artifact |
|--------|-------------|----------|
| DEPT-01 | Departments ranked by revenue / sell-through / lots above estimate with sortable columns + metric toggle | `DepartmentRankingsTable.tsx` + `DeptRankingMetricToggle.tsx` + `DepartmentsPage` composition |
| INTR-01 | Cross-filter by clicking a department row (highlight + chip); dim non-matching chart series | **Partial** — row highlight + chip surface + chip dismissal work end-to-end (`DepartmentRankingsTable.tsx` row class composition + `DepartmentsPage` chip). Chart dimming ships in 06-03. |

## Decisions Made

- **TanStack Table null-sort via sortUndefined not sortingFn.** A custom `sortingFn` returning `+1` for "a is null" works for ASC but TanStack v8 inverts the sign on DESC (so nulls would flip to the top). Mapping `null → undefined` in the accessor + `sortUndefined: 'last'` is direction-agnostic and is the v8-native idiom.
- **Dept codes in tests: ADEP/BDEP/CDEP, not A/B/C.** `byRole('button', { name: /^A/ })` in the rendered DOM matched the `Avg sell-through` column-header `<button>` (TanStack headerless tables render the sortable header as `<button>` too). Lengthening test codes to ≥3 chars scopes the regex cleanly to row buttons. No production impact — real RFC dept codes are all 3+ chars (ASN, FRN, PNT, CER, SIL, DRW, AMER, ASNP, etc.).
- **Cross-filter chip inlined into DepartmentsPage, not a separate CrossFilterChip component.** UI-SPEC § Structural inventory listed `CrossFilterChip` as a component, but for 06-02's single-site, 12-line-JSX usage, inlining keeps the tree shallower. Phase 9+ can extract if needed.
- **No DashboardLayout modification.** Sidebar nav flip for Departments is 06-06's scope. This plan intentionally leaves `aria-disabled="true"` in place so the two concerns (route existence vs nav exposure) stay independent — lets 06-06 ship independently without conflicts.

## Deviations from Plan

### Test scope adjustments

**1. [Rule 1 — Test correctness] Lengthened ambiguous single-letter dept codes in tests**

- **Found during:** Task 2 (DepartmentRankingsTable — null-sort test + metric-prop-change test)
- **Issue:** Tests used single-letter dept codes `A/B/C` in the row data. `screen.getAllByRole('button', { name: /^(A|B|C)/ })` inadvertently matched the `Avg sell-through` column-header `<button>` (rendered via TanStack Table's sortable header pattern — it's also `role="button"`).
- **Fix:** Renamed test codes to `ADEP/BDEP/CDEP` (and `ADEP/BDEP` for the lots-above-estimate sub-case). Regex `/^(ADEP|BDEP|CDEP)/` no longer matches any column-header button name.
- **Files modified:** `src/components/DepartmentRankingsTable.test.tsx`
- **Rationale:** No production behavior change — actual RFC dept codes are all ≥3 chars (ASN, FRN, PNT, AMER, ASNP, …). The adjustment keeps the test valid against production data shapes.
- **Committed in:** `78b1325` (Task 2 GREEN — test + impl)

### Implementation refinements

**2. [Rule 2 — Missing critical correctness] null-sort via sortUndefined not a custom sortingFn**

- **Found during:** Task 2 (DepartmentRankingsTable — first test run showed nulls sorting FIRST under DESC, not last)
- **Issue:** The plan's action block instructed `sortingFn: (a, b, id) => { if (va == null) return 1; if (vb == null) return -1; return va - vb; }` for Avg sell-through. But TanStack Table v8 inverts the return sign of a `sortingFn` when direction is DESC — so "null is greater" (+1) becomes "null is lesser" (-1) under DESC, flipping nulls to the top. The plan's acceptance criterion explicitly says "nulls sort last regardless of direction."
- **Fix:** Remapped `avg_sell_through` column from a direct `accessorKey` to an `accessorFn` that returns `undefined` for null values; set `sortUndefined: 'last'` on the column. TanStack v8's `sortUndefined` handling is direction-agnostic and is the idiomatic way to achieve nulls-last regardless of asc/desc.
- **Files modified:** `src/components/DepartmentRankingsTable.tsx`
- **Verification:** DESC test case (`C > A > B`) and ASC test case (`B last`) both pass.
- **Committed in:** `78b1325` (Task 2 GREEN)

### Environmental

**3. [Informational] Worktree bootstrap on session start**

- **Found during:** `<worktree_branch_check>` preamble
- **Issue:** Worktree was sparse — only `.planning/` and `CLAUDE.md` were populated in the working tree. All source files existed in the commit (`cf7cc18`) but were not checked out (git index marked them as "deleted" via the `soft` reset behavior).
- **Fix:** `git reset HEAD` unstaged the deletion; `git checkout HEAD -- .` repopulated the working tree from commit; `npm install --prefer-offline` restored `node_modules`.
- **Files modified:** none (bootstrap only)
- **Verification:** `ls src/`, `ls node_modules/.bin/vitest`, and the first smoke-test vitest run (`metric-toggle.test.tsx` — 13 passed) all succeeded before Task 1 started.

---

**Total deviations:** 2 code/test adjustments + 1 environmental.
**Impact on plan:** (1) test-data adjustment keeps tests valid; production behavior unchanged. (2) null-sort implementation uses v8-idiomatic `sortUndefined` rather than a custom-fn approach that would fail the plan's own acceptance criterion. Both are plan-text corrections to match the acceptance-criterion intent. No scope creep.

## Issues Encountered

- **Null-sort direction bug on first run** — diagnosed on first full test run of Task 2 (output showed B, the null row, appearing first under DESC). Root cause: v8 inverts sortingFn sign on DESC. Fixed in the same GREEN commit via accessor + `sortUndefined: 'last'`.
- **Column-header role="button" collision** — diagnosed alongside the null-sort bug. Tests that queried rows by single-letter codes (A/B/C) were matching column headers. Fixed by using 3-letter test codes (ADEP/BDEP/CDEP). Same GREEN commit.
- No other issues during Tasks 1 or 3.

## User Setup Required

None — no external service configuration required for this plan. No new env vars, no migrations, no manual steps.

## Next Phase Readiness

- **Plan 06-03 (Department charts)** can now mount `DepartmentRevenueLineChart` + `DepartmentShareStackedBarChart` inside `section#departments-charts-slot` in `DepartmentsPage`. `selectedDept` is already in scope — passing it as a prop is a 1-line change. `DepartmentChipBar` for the line chart will need its own `chipSelectedDepts` state added to the page, but that's additive — no refactor of 06-02's state.
- **Plan 06-06 (Sidebar nav flip)** can now flip the `DashboardLayout` "Departments" entry from `aria-disabled` span to `<NavLink to="/departments">` — the target route exists.
- The `/departments` route is reachable, renders skeleton states correctly, renders rows when data arrives, and exercises INTR-01 row-highlight + chip-dismissal semantics end-to-end.

## Self-Check: PASSED

Verification (files + commits):

- `src/components/DeptRankingMetricToggle.tsx` — FOUND
- `src/components/DeptRankingMetricToggle.test.tsx` — FOUND (10 tests passing)
- `src/components/DepartmentRankingsTable.tsx` — FOUND
- `src/components/DepartmentRankingsTable.test.tsx` — FOUND (15 tests passing)
- `src/pages/Departments.tsx` — FOUND
- `src/tests/departments-page.test.tsx` — FOUND (9 tests passing)
- `src/App.tsx` — `/departments` route registered (grep count 1); `DepartmentsPage` import + usage (grep count 2)
- Commits `3ebe282`, `3ea6c93`, `6efadfe`, `78b1325`, `a02b608`, `3073775` — ALL FOUND in `git log`
- `npx tsc --noEmit` — EXIT 0
- `npx vitest run` full suite — 557 passed / 0 failed

---

*Phase: 06-department-analysis-sale-comparison*
*Completed: 2026-04-23*
