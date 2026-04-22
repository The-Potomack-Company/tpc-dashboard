---
phase: 05-trend-analysis
plan: 05
subsystem: ui
tags: [recharts, charts, trend-analysis, typescript, react, vitest]

# Dependency graph
requires:
  - plan: 05-01
    provides: "CHART_PALETTE / CHART_GRID_STROKE / CHART_AXIS_TICK_FILL; ChartTooltip; ChartSkeleton; Range type on period.ts"
  - plan: 05-03
    provides: "useDepartmentGrid (TRND-05 data source) and useSalesInRange (TRND-06 data source)"
provides:
  - "src/lib/estimate-accuracy.ts — computeAccuracyBands() + AccuracyBands type"
  - "src/components/EstimateAccuracyChart.tsx — TRND-05 stacked-area chart"
  - "src/components/BidderParticipationChart.tsx — TRND-06 dual-axis line chart"
affects: [05-07-trends-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function chart derivations live in src/lib and are tested independent of Recharts"
    - "useMemo keyed on query.data for chart-input derivation; empty-array frozen singleton from hook preserves reference stability across refetches"
    - "State-branch tests mock the data hook and Recharts ResponsiveContainer to pass-through so jsdom can mount the chart subtree"
    - "prefers-reduced-motion helper queries window.matchMedia lazily per render; guarded against jsdom's missing matchMedia"
    - "Chart animation is disabled during refetch so in-place data updates don't re-animate from zero"

key-files:
  created:
    - src/lib/estimate-accuracy.ts
    - src/lib/estimate-accuracy.test.ts
    - src/components/EstimateAccuracyChart.tsx
    - src/components/EstimateAccuracyChart.test.tsx
    - src/components/BidderParticipationChart.tsx
    - src/components/BidderParticipationChart.test.tsx
  modified: []

key-decisions:
  - "Bands are inclusive on both estimate bounds. A dept whose total_sold_value equals low_estimate OR high_estimate counts as within. Matches the TRND-05 contract (05-CONTEXT.md §) and eliminates boundary ambiguity that would otherwise split equal-to-bound depts arbitrarily."
  - "computeAccuracyBands returns null on three distinct no-value paths: null saleLotsSold, zero saleLotsSold (division guard T-05-05-DIVZERO), and every dept skipped due to null fields. Chart filters out null-band rows before rendering so Recharts never sees NaN/Infinity."
  - "Denominator is sale-level lots_sold — NOT the sum of included dept lots_sold. This preserves the 'some dept data was missing' fact in the raw ratios. stackOffset='expand' on Recharts renormalizes to 100% visually while the tooltip still surfaces the raw per-band share."
  - "Recharts ResponsiveContainer is mocked to a pass-through div in tests so the chart subtree mounts under jsdom. Tests assert the role='img' wrapper + state branches, not SVG internals — SVG rendering is verified manually during Phase 5 UAT."
  - "prefers-reduced-motion is queried per render (no state/memo). jsdom lacks window.matchMedia, so the helper guards for its absence; non-matching environments default to animation allowed."
  - "Co-locate helper + chart tests next to their source (src/lib/ and src/components/) rather than src/tests/. Explicit in plan 05-05 files_modified. Vitest's include pattern (src/**/*.test.{ts,tsx}) covers both locations — no config change needed."

patterns-established:
  - "Pattern: pure client-side derivation for shape-changing chart data lives in src/lib/<feature>.ts with its own test file"
  - "Pattern: chart state branches (pending / error / empty_data / empty_after_filter / success / refetch) covered by a 6-case mocked-hook suite"
  - "Pattern: ResponsiveContainer mocked to pass-through in tests that need the chart subtree but don't assert SVG internals"
  - "Pattern: prefersReducedMotion() helper co-located per-chart (until a second consumer warrants extracting to src/lib)"

requirements-completed: [TRND-05, TRND-06, INTR-03]

# Metrics
duration: 12m
completed: 2026-04-22
---

# Phase 5 Plan 05: Estimate Accuracy + Bidder Participation Summary

**Shipped TRND-05 (stacked-area estimate accuracy with client-side below/within/above band derivation) and TRND-06 (dual-axis line for registered_bidders vs winning_buyers), plus the pure-function computeAccuracyBands helper extracted so the band math is unit-tested independent of Recharts.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T13:53Z
- **Completed:** 2026-04-22T14:00Z
- **Tasks:** 3
- **Files created:** 6 (3 source + 3 test)
- **Files modified:** 0

## Accomplishments

- `computeAccuracyBands()` pure helper derives the three estimate-accuracy bands (below / within / above) per sale with inclusive bounds, null-safety on all four per-dept inputs, division guards on sale-level lots_sold, and a clean null return for every no-value path.
- `EstimateAccuracyChart` (TRND-05) renders a stacked-area chart with `stackOffset="expand"` normalizing the three bands to 100%; legend at top with the UI-SPEC palette (amber below / emerald within / rose above); full pending / error / two-empty / success / refetch state coverage.
- `BidderParticipationChart` (TRND-06) renders a dual-axis line (blue-600 registered_bidders on left, orange-600 winning_buyers on right) with connectNulls=false so missing participation doesn't connect across gaps.
- Full test suite: 45/45 files, 424/424 tests green. Vite build clean (436 kB JS). Typecheck clean.

## Task Commits

1. **Task 1: computeAccuracyBands helper + 8 tests** — `a425b2a` (feat)
2. **Task 2: EstimateAccuracyChart (TRND-05) + 6 tests** — `ccadb5d` (feat)
3. **Task 3: BidderParticipationChart (TRND-06) + 6 tests** — `f3591ca` (feat)

## Files Created/Modified

### Created

- `src/lib/estimate-accuracy.ts` — `computeAccuracyBands(depts, saleLotsSold): AccuracyBands | null`. Inclusive bounds; four-field null skip; three null return paths.
- `src/lib/estimate-accuracy.test.ts` — 8 Vitest cases covering happy path (3-dept classification), boundary equality (low and high), null-skip, null saleLotsSold, zero saleLotsSold, empty array, all-depts-skipped.
- `src/components/EstimateAccuracyChart.tsx` — AreaChart with three Area bands, stackOffset="expand", ChartTooltip with formatPercent values, ChartSkeleton/ErrorState/EmptyState branches, role="img" wrapper with row-count aria-label.
- `src/components/EstimateAccuracyChart.test.tsx` — 6 Vitest cases (pending / error + retry / empty data / empty after filter / success / refetch).
- `src/components/BidderParticipationChart.tsx` — LineChart with two Lines pinned to yAxisId left/right, connectNulls=false, formatCount for both axis and tooltip, same state-branch set as TRND-05 plus right-margin bump to 48 for right-axis tick room.
- `src/components/BidderParticipationChart.test.tsx` — 6 Vitest cases.

### Key export snippets

```ts
// src/lib/estimate-accuracy.ts
export interface AccuracyBands { below: number; within: number; above: number }
export function computeAccuracyBands(
  depts: ReadonlyArray<{
    total_sold_value: number | null;
    low_estimate: number | null;
    high_estimate: number | null;
    lots_sold: number | null;
  }>,
  saleLotsSold: number | null,
): AccuracyBands | null;
```

```ts
// src/components/EstimateAccuracyChart.tsx
export interface EstimateAccuracyChartProps { range: Range }
export function EstimateAccuracyChart(props: EstimateAccuracyChartProps): JSX.Element;

// src/components/BidderParticipationChart.tsx
export interface BidderParticipationChartProps { range: Range }
export function BidderParticipationChart(props: BidderParticipationChartProps): JSX.Element;
```

## Decisions Made

- **Inclusive estimate bounds.** A dept with `total_sold_value === low_estimate` (or `=== high_estimate`) classifies as within, not as an adjacent band. Eliminates boundary ambiguity.
- **Sale-level denominator.** Bands are expressed as shares of the sale's overall lots_sold — not the sum of included dept lots_sold. This preserves the "some dept data was missing" fact in the raw ratios. The chart's `stackOffset="expand"` renormalizes for display; the tooltip shows the raw per-band percent.
- **Null-skip per dept, null-return per sale.** A dept missing any of the four required fields is silently skipped. A sale where every dept is skipped — or where saleLotsSold is null/zero — yields null, and the chart filters null-band rows out of chartData so Recharts never sees NaN/Infinity.
- **Dual-axis in TRND-06.** registered_bidders and winning_buyers have wildly different magnitudes (hundreds vs tens); sharing a Y-axis would flatten winning_buyers into the baseline. Two YAxis components with yAxisId left/right give each series its own scale.
- **formatCount, not formatPercent, for TRND-06.** registered_bidders / winning_buyers are integer headcounts. Using formatPercent here would misleadingly suggest a ratio.
- **Recharts ResponsiveContainer mocked in tests.** jsdom has no layout, so the default ResponsiveContainer would render nothing. We mock it to a fixed-size pass-through so the chart subtree mounts and the role="img" wrapper is assertable. The Recharts SVG internals are out of scope for Wave 0 — they'll be exercised by Phase 5 UAT.
- **Tests co-located (src/lib/ and src/components/), not in src/tests/.** The 05-05-PLAN frontmatter explicitly names co-located paths. Vitest's include pattern `src/**/*.test.{ts,tsx}` covers both locations, so no config change is needed. This diverges slightly from the src/tests/ pattern established by Plan 05-01 (which centralized primitive tests); where subsequent plans agree on one location, the pattern will consolidate.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' behaviors, acceptance criteria, and test counts match 05-05-PLAN.md.

## Issues Encountered

- **Initial path confusion: wrote first test file to the main repo path instead of the worktree path.** The first `Write` for `src/lib/estimate-accuracy.test.ts` landed in the main repo root instead of the worktree. Detected immediately when `npx vitest` ran from the worktree and reported "No test files found." Removed the misplaced file and retried with the worktree-rooted absolute path. No code impact; caught before any commit.
- **Worktree missing node_modules for recharts.** The main repo's package.json pins `recharts@^3.8.1` but the main-repo `node_modules/` had never been refreshed since plan 05-01 added the dep in a separate worktree. First chart test run failed with "Failed to resolve import recharts." Resolved by running `npm install` in the main repo (which the worktree shares). Pre-existing infrastructure state, not caused by this plan.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05-06 (DepartmentHeatMap) is independent of this plan — uses useDepartmentGrid directly for cell values.
- Plan 05-07 (Trends page composition) can now import `EstimateAccuracyChart` and `BidderParticipationChart` from `../components/` and compose them inside `ChartCard` wrappers per UI-SPEC layout lines 509-517. Props on both charts are `{ range: Range }`.
- If additional charts need estimate-accuracy bands computed in another pass (e.g. an aggregate summary card in Phase 6), `computeAccuracyBands` is already positioned in `src/lib/` with full null-safety and unit coverage.

## Verification

- `npx vitest --run src/lib/estimate-accuracy.test.ts src/components/EstimateAccuracyChart.test.tsx src/components/BidderParticipationChart.test.tsx` — 3 files, 20 tests pass.
- `npx vitest --run` (full suite) — 45 files, 424 tests pass.
- `npx tsc -b` — clean.
- `npx vite build` — clean (436 kB JS, 31 kB CSS, 1.48s).

## Self-Check: PASSED

Commits verified:
- FOUND: a425b2a (Task 1)
- FOUND: ccadb5d (Task 2)
- FOUND: f3591ca (Task 3)

Files verified:
- FOUND: src/lib/estimate-accuracy.ts
- FOUND: src/lib/estimate-accuracy.test.ts
- FOUND: src/components/EstimateAccuracyChart.tsx
- FOUND: src/components/EstimateAccuracyChart.test.tsx
- FOUND: src/components/BidderParticipationChart.tsx
- FOUND: src/components/BidderParticipationChart.test.tsx

---
*Phase: 05-trend-analysis*
*Completed: 2026-04-22*
