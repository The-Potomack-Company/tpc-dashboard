---
phase: 06-department-analysis-sale-comparison
plan: 03
subsystem: ui, charts, cross-filter

tags:
  - react
  - typescript
  - recharts
  - vitest
  - tdd
  - cross-filter
  - wai-aria

# Dependency graph
requires:
  - phase: 05-trend-analysis
    provides: CHART_PALETTE, CHART_GRID_STROKE, CHART_AXIS_TICK_FILL; ChartCard, ChartTooltip, ChartSkeleton, EmptyState, ErrorState; Recharts Pattern (ResponsiveContainer + role='img' wrapper); formatDate / formatCurrency / formatPercent from src/lib/format.ts
  - plan: 06-01
    provides: useDepartmentRankings, useDepartmentRevenueSeries, useDepartmentShareSeries hooks + their types
  - plan: 06-02
    provides: DepartmentsPage skeleton + state threading (range, metric, selectedDept) + section#departments-charts-slot anchor + DepartmentRankingsTable

provides:
  - src/components/DepartmentChipBar.tsx — DEPT-02 multi-select chip bar (max-8 cap)
  - src/components/DepartmentRevenueLineChart.tsx — DEPT-02 multi-line chart body
  - src/components/DepartmentShareStackedBarChart.tsx — DEPT-03 100% stacked bar chart body
  - src/pages/Departments.tsx — composed page with both charts + chip bar + max-notice lifecycle + color assignment rule
  - INTR-01 end-to-end: row click in rankings table dims non-matching series in both charts

affects:
  - Plan 06-06 (Sidebar nav flip) — unchanged; /departments remains fully reachable, now feature-complete end-to-end
  - Phase 6 validation (06-VALIDATION.md) — DEPT-02 / DEPT-03 / INTR-01 / INTR-03 checklist items now have shipped artifacts

# Tech tracking
tech-stack:
  added: []  # no new packages
  patterns:
    - "Recharts cross-filter via CSS wrapper + strokeOpacity / fillOpacity on per-series attrs (Pattern 4). isAnimationActive=false on every Line/Bar so opacity changes snap at the Recharts layer; CSS transition-opacity duration-200 owns the fade"
    - "Color assignment by deterministic position: chipSelectedDepts.indexOf → CHART_PALETTE index; rankings-position fallback for top-N stacked segments not in the chip selection. All callers read via a memoized colorForCode(code) callback so identity stays stable across renders"
    - "Pitfall 8 guard: filter selectedDeptCodes to drop codes whose series is entirely null across the current data rows BEFORE mapping them to <Line> elements. Prevents Recharts runtime error on zero-point series; also surfaces an inline 'No revenue data for the selected departments in this range' notice when all selected codes yielded nulls"
    - "Pitfall 7 (null display_name) fallback: chip aria-label is `${code} — ${displayName}` when non-null, otherwise just `${code}` (never 'null'). Rendered text on the chip is always just the code; full name in aria-label + native title"
    - "Max-8 notice lifecycle in parent (not component): DepartmentChipBar fires onMaxExceeded; DepartmentsPage owns the setTimeout → maxNotice string → role='status' p. Repeat clicks within the 3-second window reset the timer; unmount clears the timer via useEffect cleanup"
    - "Chart-component test doubles: vi.mock swaps DepartmentRevenueLineChart + DepartmentShareStackedBarChart with divs that echo selectedDeptCodes / highlightedDept / topN via data-* attrs. Keeps page-integration assertions at composition level without booting Recharts under jsdom (consistent with Phase 5 'don't assert Recharts SVG internals' convention)"
    - "TDD discipline: Tasks 1-3 each committed as RED → GREEN pair. Task 4 is composition + augmented page integration, committed as a single GREEN because the new test doubles depend on the new chart imports — separating would temporarily fail the build"

key-files:
  created:
    - src/components/DepartmentChipBar.tsx
    - src/components/DepartmentChipBar.test.tsx
    - src/components/DepartmentRevenueLineChart.tsx
    - src/components/DepartmentRevenueLineChart.test.tsx
    - src/components/DepartmentShareStackedBarChart.tsx
    - src/components/DepartmentShareStackedBarChart.test.tsx
  modified:
    - src/pages/Departments.tsx  # +chart imports, +chipSelectedDepts state, +maxNotice timer, +colorForCode, +displayNameByCode, +chipsAvailable, +toggleChip, +handleMaxExceeded; replaced placeholder section with 2 ChartCards
    - src/tests/departments-page.test.tsx  # +chart component mocks, +5 new tests (T10-T14)

key-decisions:
  - "Recharts opacity changes are snap-rendered (A2), CSS wrapper handles the fade. `isAnimationActive={false}` on every <Line> / <Bar> because Recharts 3.8.1 does not interpolate strokeOpacity / fillOpacity between prop-driven values; mixing Recharts animation + the CSS wrapper would double-transition and stutter. Pattern 4 locks this in."
  - "Max-8 notice is parent-owned, not component-owned. The plan explicitly noted this — keeping the 3-second setTimeout lifecycle outside DepartmentChipBar means the component stays pure (no ref-timers, no mount/unmount fade coordination). Parent also owns the timer cleanup so repeat clicks within the window reset the fade cleanly."
  - "Color assignment by chip position, with rankings-position fallback. Chip position is the primary index (what the user sees in the line chart). For the stacked bar chart, top-N codes may include a dept the user hasn't chipped — those fall back to the dept's rankings-DESC position mod 8 so every segment still has a stable color even as the user toggles chips. Same dept always gets the same slot for a given rankings order."
  - "Chart components mocked as test doubles in the page-integration test, NOT mocked hooks. Mocking at the component boundary lets assertions read the exact props the page sends (data-selected / data-highlighted), which is the right granularity for 'does the page wire the state correctly?' — without having to care about Recharts internals, ResponsiveContainer jsdom quirks, or hook cache invalidation."
  - "Stacked bar Y-axis domain is [0, 1], not [0, 100]. The RPC returns share as a fraction, not a percentage. formatPercent handles the 0.724 → '72.4%' conversion at the tick formatter. Keeps the data contract (0 ≤ share ≤ 1) consistent with how sell_through is handled elsewhere in the codebase."

patterns-established:
  - "Phase 6 chart composition: each chart body is a chrome-free component (no ChartCard internally). The page composes ChartCard → chart-body, matching Phase 5's NetRevenueTrendChart / EstimateAccuracyChart pattern. Lets the same chart mount inside other surfaces (comparison view v2, report export) without inheriting card styling."
  - "Cross-filter threading: page-local selectedDept → downstream children as `highlightedDept` prop. No lifted Recharts state, no Context, no Zustand. strokeOpacity (line) / fillOpacity (bar) / bg-accent-overlay (row) — three different visual dimensions, one shared state atom."
  - "Page-owned chip state + page-owned default (top-5 by revenue). The `useEffect` that seeds `chipSelectedDepts` runs once when rankings first populate — uses `chipSelectedDepts.length === 0` as the guard so user clicks don't retrigger the seed."

requirements-completed:
  - DEPT-02  # Multi-line revenue chart + chip-bar selection + cross-filter dimming
  - DEPT-03  # 100% stacked bar chart with top-N + Other aggregation + cross-filter dimming
  - INTR-01  # Complete end-to-end: row highlight (06-02) + chart dimming (06-03)
  - INTR-03  # Tooltip wiring on both new charts via existing ChartTooltip

# Metrics
duration: ~45m (Task 1 ~10m, Task 2 ~12m, Task 3 ~10m, Task 4 ~13m)
completed: 2026-04-23
---

# Phase 6 Plan 06-03: Department Charts Summary

**Ships DEPT-02 (multi-line revenue over time) + DEPT-03 (100% stacked share bar) + DepartmentChipBar + INTR-01 chart dimming end-to-end — `/departments` is now feature-complete for Phase 6.**

## Performance

- **Duration:** ~45m total (Task 1 ~10m, Task 2 ~12m, Task 3 ~10m, Task 4 ~13m)
- **Started:** 2026-04-23 (after 06-02 GREEN)
- **Completed:** 2026-04-23 (same session)
- **Tasks:** 4 (3 TDD chart-component tasks + 1 composition task)
- **Files created:** 6 (3 components + 3 tests)
- **Files modified:** 2 (src/pages/Departments.tsx + src/tests/departments-page.test.tsx)

## Accomplishments

- `DepartmentChipBar` — multi-select row of clickable chips. Active chip shows an 8x8 color dot matching CHART_PALETTE; inactive chip hides the dot. Max-8 cap (equals palette size) enforced by parent-supplied `maxSelected` prop: clicking a 9th chip while 8 are already selected fires `onMaxExceeded` and DOES NOT call `onToggle`. Parent owns the "Max 8 departments — deselect one first" status line so the 3-second fade timer lives in page effect-cleanup land (not ref-timers inside the component). aria-label template is `${code} — ${displayName}` with null fallback to just `${code}` (Pitfall 7 — auto-discovered depts).
- `DepartmentRevenueLineChart` — chrome-free Recharts `<LineChart>` with one `<Line>` per `selectedDeptCodes` entry. Reads the wide-row `useDepartmentRevenueSeries` data directly (dataKey=code). Pitfall 8 guard filters out codes whose entire series is null across the current rows BEFORE mapping them to `<Line>` — Recharts would throw on a zero-point series otherwise. Wrapper div carries `transition-opacity duration-200`; each Line has `strokeOpacity={highlightedDept == null || highlightedDept === code ? 1 : 0.2}` and `isAnimationActive={false}`. Tooltip wired via the shared `ChartTooltip` with `headerFormatter` resolving `formatDate(sale_date) · Sale {sale_number}` and `valueFormatter` running `formatCurrency` on each row value.
- `DepartmentShareStackedBarChart` — chrome-free Recharts `<BarChart>` with `stackId="share"`. One `<Bar>` per `topCodes` entry (CHART_PALETTE color) + one 'Other' `<Bar>` (gray-400 `#9ca3af`). Y-axis domain `[0, 1]` with `formatPercent` tick formatter (the RPC returns fractions, not percentages). `fillOpacity={highlightedDept == null || highlightedDept === code ? 1 : 0.3}` on every bar; `isAnimationActive={false}`. `<Legend verticalAlign="top" />` at top.
- `DepartmentsPage` (modified) — replaced the placeholder `section#departments-charts-slot` with two ChartCards. Added `chipSelectedDepts` state (defaults to top-5 by revenue via a once-only seeding useEffect), `maxNotice` state + `maxNoticeTimerRef` for the 3s fade lifecycle, `colorForCode` callback (chip position primary, rankings position fallback), `displayNameByCode` lookup, `chipsAvailable` array, `toggleChip` + `handleMaxExceeded` callbacks. `selectedDept` threads into both charts as `highlightedDept`; `chipSelectedDepts` threads into the chip bar (as `selected`) and the line chart (as `selectedDeptCodes`).
- **25 new tests (8 + 6 + 6 + 5).** Full suite: **582 passed** (557 baseline + 25 new), 0 failed, 0 skipped. `npx tsc --noEmit` exit 0. Plan grep checks: DepartmentRevenueLineChart / DepartmentShareStackedBarChart / DepartmentChipBar each grep ≥ 2 in `src/pages/Departments.tsx` (import + render = exactly 2 each).

## Task Commits

Each chart component was a TDD RED → GREEN pair. Task 4 is a single GREEN because the new test doubles depend on the new chart imports — separating RED/GREEN would temporarily fail the build.

1. **Task 1: DepartmentChipBar + test**
   - RED: `a56b72c` (8 failing tests — module not found)
   - GREEN: `0ab18a7` (8 tests passing)
2. **Task 2: DepartmentRevenueLineChart + test**
   - RED: `9f50c91` (6 failing tests — module not found)
   - GREEN: `c63a315` (6 tests passing)
3. **Task 3: DepartmentShareStackedBarChart + test**
   - RED: `5cea046` (6 failing tests — module not found)
   - GREEN: `c877d83` (6 tests passing)
4. **Task 4: Compose + augmented page test**
   - GREEN: `084434b` (14 tests passing — 9 existing + 5 new)

All commits used `--no-verify` per the parallel-executor protocol.

## Files Created/Modified

- `src/components/DepartmentChipBar.tsx` (125 lines) — multi-select chip bar; active/inactive/disabled states + 9th-click guard
- `src/components/DepartmentChipBar.test.tsx` (200 lines) — 8 tests (rendering / aria-checked / color dot / click / 9th-click / null aria-label / keyboard Space)
- `src/components/DepartmentRevenueLineChart.tsx` (186 lines) — DEPT-02 multi-line chart; Pitfall 8 filter + 6 state branches
- `src/components/DepartmentRevenueLineChart.test.tsx` (193 lines) — 6 tests (pending / error / empty-selection / empty-data / success / opacity wrapper)
- `src/components/DepartmentShareStackedBarChart.tsx` (171 lines) — DEPT-03 stacked bar; top-N + Other with 4 state branches
- `src/components/DepartmentShareStackedBarChart.test.tsx` (195 lines) — 6 tests (pending / error / empty / success / stack-sum contract / opacity wrapper)
- `src/pages/Departments.tsx` — replaced placeholder section; added chart composition, chip bar, colorForCode + displayNameByCode, chipSelectedDepts + maxNotice state, toggleChip + handleMaxExceeded callbacks
- `src/tests/departments-page.test.tsx` — added chart-component mocks + 5 new tests (T10-T14)

## Interface Signatures

```ts
// src/components/DepartmentChipBar.tsx
export interface DepartmentChip { code: string; displayName: string | null; }
export interface DepartmentChipBarProps {
  available: readonly DepartmentChip[];
  selected: readonly string[];
  onToggle: (code: string) => void;
  maxSelected?: number;              // default 8
  onMaxExceeded?: () => void;
  colorForCode: (code: string) => string;
}
export function DepartmentChipBar(props: DepartmentChipBarProps): JSX.Element;

// src/components/DepartmentRevenueLineChart.tsx
export interface DepartmentRevenueLineChartProps {
  range: Range;
  selectedDeptCodes: readonly string[];
  highlightedDept: string | null;
  displayNameByCode: Readonly<Record<string, string | null>>;
  colorForCode: (code: string) => string;
}
export function DepartmentRevenueLineChart(props: DepartmentRevenueLineChartProps): JSX.Element;

// src/components/DepartmentShareStackedBarChart.tsx
export interface DepartmentShareStackedBarChartProps {
  range: Range;
  topN?: number;                     // default 8
  highlightedDept: string | null;
  displayNameByCode: Readonly<Record<string, string | null>>;
  colorForCode: (code: string) => string;
}
export function DepartmentShareStackedBarChart(props: DepartmentShareStackedBarChartProps): JSX.Element;
```

## Color Assignment Rule

```ts
// Deterministic per dept code:
//   1. If code is in chipSelectedDepts: CHART_PALETTE[chipSelectedDepts.indexOf(code) % 8]
//   2. Else if code is in rankings:    CHART_PALETTE[rankings.indexOf(code) % 8]
//   3. Else:                           CHART_PALETTE[0] (fallback; should never fire in practice)
```

Chip position is the primary index (users see it in the line-chart legend + tooltip). Rankings-position fallback covers the stacked-bar-only case where a top-N code isn't in the user's chip selection — those segments still get a stable color across renders.

## Max-8 Cap Lifecycle

- `DepartmentChipBar` enforces the cap visually (disabled state when `selected.length >= maxSelected && !isActive`) and behaviorally (9th click fires `onMaxExceeded`, NOT `onToggle`).
- `DepartmentsPage` owns the notice lifecycle: `handleMaxExceeded` sets `maxNotice` to "Max 8 departments — deselect one first" + starts a 3-second `setTimeout` that clears it. Repeat calls within the window clear the prior timer and restart (no multiple overlapping timers). `useEffect` cleanup on unmount clears the timer.
- Notice renders as a `<p role="status" className="transition-opacity duration-200">` inside the Department Revenue ChartCard, directly below the chip bar.

## Reduced-Motion Treatment

- `transition-opacity duration-200` on both chart wrappers + the max-notice paragraph. Users with `prefers-reduced-motion: reduce` honor CSS's motion-safe subset; the chart opacity snap-change still happens, but the 200ms ease-out is suppressed by the user-agent's reduced-motion policy (Tailwind's `transition-opacity` is already motion-safe by default — no extra class needed).
- Recharts animation is fully disabled via `isAnimationActive={false}` on every `<Line>` and `<Bar>` regardless of the user's motion preference. Cross-filter opacity is NOT animated at the Recharts layer — the CSS wrapper is the only fade surface.

## INTR-01 Cross-Filter End-to-End

| Interaction | Source | Target → Effect |
|---|---|---|
| Click rankings-table row | `DepartmentRankingsTable onToggleSelection` → `toggleSelectedDept` | `selectedDept === code` → rankings row highlight (bg-accent/5 + border) + `<DepartmentRevenueLineChart highlightedDept={code}>` → non-matching lines strokeOpacity=0.2 + `<DepartmentShareStackedBarChart highlightedDept={code}>` → non-matching segments fillOpacity=0.3 |
| Click same rankings row again | same handler (toggle) | `selectedDept === null` → all lines strokeOpacity=1, all segments fillOpacity=1 |
| Click the "×" on the Filtering chip | chip button onClick | `selectedDept === null` → same clear effect |
| CSS wrapper | `transition-opacity duration-200` on both chart wrappers | Smooth fade as the strokeOpacity / fillOpacity snap-changes are CSS-transitioned by the parent div |

Verified end-to-end in T14 of `departments-page.test.tsx` (click ASN row → both charts receive `data-highlighted="ASN"`; click again → both receive `""`).

## Test Counts per Artifact

| Artifact | Test file | Cases |
|---|---|---|
| `DepartmentChipBar.tsx` | `DepartmentChipBar.test.tsx` | 8 |
| `DepartmentRevenueLineChart.tsx` | `DepartmentRevenueLineChart.test.tsx` | 6 |
| `DepartmentShareStackedBarChart.tsx` | `DepartmentShareStackedBarChart.test.tsx` | 6 |
| `DepartmentsPage` (augmented) | `src/tests/departments-page.test.tsx` | 14 (9 existing + 5 new) |
| **Total new (this plan)** |  | **25** |

Full suite after 06-03: **582 passed** (557 baseline + 25 new), **0 failed**, **0 skipped**. `npx tsc --noEmit` clean.

## Requirement Traceability

| REQ-ID | Description | Artifact |
|---|---|---|
| DEPT-02 | Multi-line revenue chart with chip-bar selection; cross-filter dims non-matching lines | `DepartmentChipBar.tsx` + `DepartmentRevenueLineChart.tsx` + `DepartmentsPage` composition (line chart inside first ChartCard) |
| DEPT-03 | 100% stacked bar chart with top-N + Other; cross-filter dims non-matching segments | `DepartmentShareStackedBarChart.tsx` + `DepartmentsPage` composition (stacked chart inside second ChartCard) |
| INTR-01 | Clicking a department row dims non-matching series in both charts (and highlights the rankings row) | Complete end-to-end: `selectedDept` threads from `DepartmentRankingsTable.onToggleSelection` → `DepartmentsPage.toggleSelectedDept` → `highlightedDept` prop on both charts → strokeOpacity 0.2 / fillOpacity 0.3 for non-matching series + transition-opacity wrapper |
| INTR-03 | Tooltip shows dept name + exact value on hover | Both charts use `<Tooltip content={<ChartTooltip headerFormatter valueFormatter />}>`; line chart formats currency, stacked bar formats percent with display-name resolution via `displayNameByCode` |

## Decisions Made

- **Recharts opacity changes are snap-rendered; CSS wrapper handles the fade.** Per Pattern 4 + Assumption A2 in 06-RESEARCH, Recharts 3.8.1 does not interpolate between prop-driven `strokeOpacity` / `fillOpacity` values. Setting `isAnimationActive={false}` on every `<Line>` and `<Bar>` keeps the attribute change instant at the Recharts layer; the `transition-opacity duration-200` CSS wrapper on the chart div does the smoothing. Mixing Recharts animation with the CSS wrapper would double-transition and stutter.
- **Max-8 notice lives in DepartmentsPage, not DepartmentChipBar.** The component stays pure — it fires `onMaxExceeded()` and returns. The page owns `maxNotice` state + the setTimeout + the role="status" paragraph. Rapid repeat 9th-clicks clear the prior timer and restart; unmount clears via useEffect cleanup. Keeps the component testable without ref timers and keeps timer cleanup alongside the rest of the page's effect lifecycle.
- **Color assignment by chip position, with rankings-position fallback.** Chip position drives the primary color (what the user sees in the line chart's legend). For the stacked bar chart, top-N codes may include a dept the user hasn't chipped — those fall back to `rankings.indexOf(code)`-based slot assignment so every segment has a deterministic color across renders. Same dept always gets the same slot for a given rankings order.
- **Stacked bar Y-axis domain is [0, 1], not [0, 100].** The RPC returns share as a fraction. `formatPercent(0.724) → '72.4%'` handles the conversion at the tick formatter. Matches how sell_through is handled elsewhere in the codebase.
- **Chart components mocked as test doubles in the page integration test.** Instead of mocking hooks, the page test mocks `DepartmentRevenueLineChart` + `DepartmentShareStackedBarChart` with divs that echo `selectedDeptCodes` / `highlightedDept` / `topN` via `data-*` attributes. Keeps assertions at page-composition level (prop propagation) without Recharts/ResponsiveContainer jsdom quirks. DepartmentChipBar remained real so the max-8 flow is exercised end-to-end.

## Deviations from Plan

### Test implementation refinement

**1. [Rule 1 — Test correctness] jsdom normalizes inline hex colors to rgb()**

- **Found during:** Task 1 (DepartmentChipBar T3 — color-dot assertion)
- **Issue:** The plan's test hint suggested asserting `[style*="background-color"]` or a hex substring. jsdom normalizes `style="background-color: #2563eb"` to `style="background-color: rgb(37, 99, 235);"` in the DOM's `getAttribute('style')` output, so the substring `#2563eb` never matches.
- **Fix:** Assert `asnDot.style.backgroundColor === 'rgb(37, 99, 235)'`. jsdom's `.style.backgroundColor` getter returns the same rgb() form regardless of how the value was set, so the test is stable.
- **Files modified:** `src/components/DepartmentChipBar.test.tsx`
- **Rationale:** No production behavior change — the inline style actually carries the hex; only the jsdom mirror normalizes it. Real browsers emit computed rgb() from `getComputedStyle` and both are acceptable.
- **Committed in:** `0ab18a7` (Task 1 GREEN — fix applied same commit as the impl landed)

### Plan-text wording adjustment

**2. [Informational] Augmented test numbering runs T10-T14 (not T8-T12)**

- **Found during:** Task 4
- **Issue:** The plan lists the augmented tests as "T8-T12" counting 1-indexed within the new additions, but the existing 06-02 test file already has 9 tests (numbered T1-T7 plus two unnumbered "sets document.title" and "calls useDepartmentRankings" cases). Renumbering existing tests would churn the file unnecessarily.
- **Fix:** New tests numbered T10-T14 in-source (continuing from 9 existing), with a section comment marking the 06-03 boundary. Count is still 5 new tests matching the plan's intent.
- **Files modified:** `src/tests/departments-page.test.tsx`
- **Rationale:** Test numbering is a cosmetic labeling choice; no impact on coverage or semantics.

### Environmental

**3. [Informational] Worktree bootstrap on session start**

- **Found during:** `<worktree_branch_check>` preamble
- **Issue:** Worktree working tree was sparse — only `.planning/`, `.claude/`, `CLAUDE.md`, and `.git` were populated. All source files existed in HEAD (`817a60d`) but were not checked out. `node_modules/` was missing.
- **Fix:** `git checkout HEAD -- .` to repopulate the working tree from commit; `npm install --prefer-offline --no-audit --no-fund` to restore node_modules.
- **Files modified:** none (bootstrap only)
- **Verification:** `ls src/pages/` showed all pages; smoke-test vitest run (`src/tests/departments-page.test.tsx` baseline — 9 passed) confirmed the tree was healthy before Task 1 started.

---

**Total deviations:** 1 test-assertion adjustment + 2 informational.
**Impact on plan:** Zero scope change. The T3 color-dot assertion is a jsdom normalization detail — the production behavior (inline hex → browser rgb) is unaffected. Test numbering is cosmetic.

## Issues Encountered

- **Hex color normalization in jsdom** — diagnosed on first test run of Task 1 (expected `#2563eb` substring, got `rgb(37, 99, 235)`). Fixed by switching to `.style.backgroundColor` accessor + explicit rgb comparison. Same GREEN commit as the impl.
- No issues during Tasks 2, 3, or 4 — all tests passed on first run of the GREEN implementation.

## User Setup Required

None — no external service configuration needed. No new env vars, no migrations, no manual steps. Charts consume data from the 3 RPCs shipped in 06-01 (no new migrations this plan).

## Next Phase Readiness

- **Plan 06-04 (Sale Comparison page)** is independent of 06-03 and unblocked.
- **Plan 06-06 (Sidebar nav flip)** is unblocked and the `/departments` route is now feature-complete. When 06-06 flips the sidebar nav from `aria-disabled` span to `<NavLink to="/departments">`, users will be able to reach the full Departments experience (rankings table + cross-filter + both charts + chip bar).
- **Post-Phase-6 validation** — 06-VALIDATION.md can now check DEPT-02 / DEPT-03 / INTR-01 / INTR-03 off the matrix for the Departments page.

## Known Stubs

None. All chart components consume real hooks from 06-01; no placeholder data, no empty arrays flowing to UI, no "coming soon" text.

## Self-Check: PASSED

Verification (files + commits):

- `src/components/DepartmentChipBar.tsx` — FOUND
- `src/components/DepartmentChipBar.test.tsx` — FOUND (8 tests passing)
- `src/components/DepartmentRevenueLineChart.tsx` — FOUND
- `src/components/DepartmentRevenueLineChart.test.tsx` — FOUND (6 tests passing)
- `src/components/DepartmentShareStackedBarChart.tsx` — FOUND
- `src/components/DepartmentShareStackedBarChart.test.tsx` — FOUND (6 tests passing)
- `src/pages/Departments.tsx` — modified; `grep -c DepartmentRevenueLineChart` = 2, `grep -c DepartmentShareStackedBarChart` = 2, `grep -c DepartmentChipBar` = 2
- `src/tests/departments-page.test.tsx` — modified; 14 tests passing (9 existing + 5 new)
- Commits `a56b72c`, `0ab18a7`, `9f50c91`, `c63a315`, `5cea046`, `c877d83`, `084434b` — ALL FOUND in `git log`
- `npx tsc --noEmit` — EXIT 0
- `npx vitest run` full suite — 582 passed / 0 failed / 0 skipped

---

*Phase: 06-department-analysis-sale-comparison*
*Completed: 2026-04-23*
