---
phase: 05-trend-analysis
plan: 06
subsystem: trends-heat-map
tags: [css-grid, tailwind, dept-heat-map, trnd-04, wave-3]
one_liner: "Hand-authored CSS grid TRND-04 heat map (22 dept rows × N sale cols) with 5-bucket blue-ramp quintile cells, metric-prop driven (sell-through vs revenue-share), no-data hatch, sticky first column."
dependency_graph:
  requires:
    - src/lib/period.ts#Range (Plan 05-01)
    - src/hooks/useDepartmentGrid.ts#useDepartmentGrid (Plan 05-03)
    - src/components/MetricToggle.tsx#HeatMapMetric (Plan 05-02)
    - src/components/ChartSkeleton.tsx (Plan 05-01)
    - src/components/ErrorState.tsx
    - src/components/EmptyState.tsx
    - src/lib/format.ts#formatPercent
  provides:
    - src/lib/heat-map-bucket.ts#SORTED_DEPT_CODES
    - src/lib/heat-map-bucket.ts#bucketClassFor
    - src/lib/heat-map-bucket.ts#NO_DATA_CELL_CLASS
    - src/lib/heat-map-bucket.ts#NO_DATA_CELL_STYLE
    - src/components/DepartmentHeatMap.tsx#DepartmentHeatMap
    - src/components/DepartmentHeatMap.tsx#DepartmentHeatMapProps
  affects:
    - Plan 05-07 (Trends page wires DepartmentHeatMap into ChartCard with MetricToggle in the action slot)
tech_stack:
  added: []
  patterns:
    - "Min-max normalized quintile bucketing with degenerate min===max → Q5 fallback"
    - "Frozen module-scope sorted dept codes (Object.freeze on a sorted copy of the raw seed list)"
    - "Controlled-prop component pattern — metric lives in parent state, no internal toggle"
    - "CSS grid with sticky-left column for scrollable wide grids"
    - "role=grid + columnheader/rowheader/gridcell to expose structure to AT without React-tooltip-per-cell bloat"
key_files:
  created:
    - src/lib/heat-map-bucket.ts
    - src/lib/heat-map-bucket.test.ts
    - src/components/DepartmentHeatMap.tsx
    - src/components/DepartmentHeatMap.test.tsx
  modified: []
decisions:
  - "SORTED_DEPT_CODES lives in src/lib/heat-map-bucket.ts (not a separate dept-codes module): the 22-code list is the row-axis contract that pairs 1:1 with the bucket math — splitting them into two files would require both to be imported together everywhere and risk drift between the canonical order and any alternate orderings."
  - "bucketClassFor returns the Q5 class when min === max (all cells equal). Rationale: visually 'all cells are at the top of the ramp' matches the intuition of 'everything is at the maximum observed value.' Returning Q3 (middle) would imply spread where none exists; returning Q1 would imply low where none exists."
  - "Metric toggle UI is NOT in this component — the Trends page (plan 05-07) places MetricToggle in ChartCard's action slot and passes `metric` as a prop. This keeps DepartmentHeatMap a pure controlled display, avoids duplicating the toggle pattern inside a chart body, and lets the toggle sit in the card header alongside the title as the UI-SPEC requires."
  - "revenue_share: null is returned when the denominator is 0 or the dept's revenue is null (T-05-06-DIVZERO mitigation). bucketClassFor is never called on null — the no-data treatment renders instead."
  - "Memoized prepareCells keyed on [data, metric]: metric changes re-run the computation because the numeric field switches; data changes obviously do. Range-only changes that yield the same `data` reference via TanStack Query keepPreviousData don't rebuild the map."
metrics:
  duration_seconds: 240
  tasks_completed: 2
  files_touched: 4
  commits: 4
  tests_added: 25
  test_files_added: 2
completed: 2026-04-22T17:55:57Z
---

# Phase 5 Plan 6: Department Performance Heat Map (TRND-04) Summary

## Objective

Ship the TRND-04 department-performance heat map — the only non-Recharts visualization in Phase 5 — as a hand-authored CSS grid with 22 alphabetical department rows × N sale columns, cells colored via a 5-bucket min-max blue ramp. Keep the bucketing math and canonical row order in a standalone `src/lib/heat-map-bucket.ts` so the component stays presentation-only and the math is trivially unit-tested.

## What Was Built

### `src/lib/heat-map-bucket.ts`

Three exports:

**`SORTED_DEPT_CODES`** — frozen readonly 22-code array sorted alphabetically (ASCII compare === alphabetical order since every code is uppercase).

Final content in sorted order:

```
AMER, ASD, ASN, ASNP, BKS, CER, CLK, DEC, DRW, ENT,
FRN, GEN, GLS, MAP, MDF, MUS, PER, PND, PNT, SIL,
SPT, TXTL
```

Specifically `SIL` comes **before** `SPT` because `I (0x49) < P (0x50)` — a common gotcha when the seed migration lists them in the opposite order. `Object.freeze` blocks downstream mutation.

**`bucketClassFor(value, min, max)`** — returns one of 5 Tailwind class strings:

| Normalized (`n = (value - min) / (max - min)`) | Class |
|-----------------------------------------------|-------|
| `n < 0.2`              | `bg-blue-100 dark:bg-blue-900/40` |
| `0.2 <= n < 0.4`       | `bg-blue-300 dark:bg-blue-800/60` |
| `0.4 <= n < 0.6`       | `bg-blue-500 dark:bg-blue-700/80` |
| `0.6 <= n < 0.8`       | `bg-blue-700 dark:bg-blue-600` |
| `n >= 0.8`             | `bg-blue-900 dark:bg-blue-500` |
| `min === max` (degenerate) | Q5 (`bg-blue-900 dark:bg-blue-500`) — documented fallback |

**`NO_DATA_CELL_CLASS`** + **`NO_DATA_CELL_STYLE`** — class (`bg-gray-50 dark:bg-gray-800`) paired with an inline `backgroundImage` (`repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 5px)`) per UI-SPEC lines 274-283. The style is inline because Tailwind 4.2 can't express the repeating gradient via utility classes.

### `src/components/DepartmentHeatMap.tsx`

Props:

```ts
export interface DepartmentHeatMapProps {
  range: Range;
  metric: HeatMapMetric;  // 'sell_through' | 'revenue_share'
}
```

**Pipeline (memoized on `[data, metric]`):**

1. Call `useDepartmentGrid(range)`.
2. Filter rows with null `sale_date` (they can't live on the x-axis).
3. Sort ASC by `sale_date` defensively (hook already sorts).
4. Build a cell lookup `${dept}|${sale}` → number | null:
   - `sell_through`: `dept.sell_through_pct / 100` (0..100 → 0..1 ratio; null stays null).
   - `revenue_share`: sum sale's dept revenues → `dept.revenue / totalSaleRevenue` when denominator > 0; null otherwise (T-05-06-DIVZERO).
5. Compute `min` / `max` across non-null cell values in the same pass.

**States:**

| State | Render |
|-------|--------|
| Pending | `<ChartSkeleton height="lg" />` |
| Error | `<ErrorState heading="Couldn't load this chart" body="Something went wrong fetching department data for the selected range. Retry below, or try a different range." onRetry={refetch} />` |
| Empty (no date-bearing rows) | `<EmptyState heading="No department data in this range">Try expanding the date filter, or switch the metric above.</EmptyState>` |
| Success | `<div role="grid">` with 22 rows × N cols + legend |

**Grid structure:**

- Outer wrapper `overflow-x-auto` enables horizontal scroll when N > 20 sales exceed the card width.
- Inner grid: `inline-grid gap-1` with `gridTemplateColumns: 112px repeat(N, 32px)` and `gridTemplateRows: 24px repeat(22, 32px)`.
- Row 1: blank sticky-left cell + N columnheaders (sale_numbers, `h-6`, `text-xs`).
- Rows 2..23: sticky-left rowheader (dept code, `font-mono`) + N gridcells.
- Each cell has a native `title` attribute — no React tooltips (would bloat render for 22 × 450+ cells in worst case).
- Legend (below grid, right-aligned): `Low` + 5 abutting 16×8px swatches + `High` per the UI-SPEC *Corrected legend markup* block (no `gap-px`).

**Tooltip format (TRND-04 row in UI-SPEC § Tooltip format strings):**

```
{dept_code} • {sale_number} — {metric_label}: {value}
```

Example: `FRN • 2024-001 — Sell-through: 80.0%`. No-data cells render `... — Sell-through: —` (em-dash from `formatPercent(null)`).

**Where the metric toggle lives (by design, not here):** the Trends page (plan 05-07) places `<MetricToggle>` in the `<ChartCard action={...}>` slot and passes `metric` down via props. DepartmentHeatMap is a pure controlled display — no internal toggle state.

## TRND-04 Coverage Confirmation

REQ-ID TRND-04 is covered by this plan:

- 22 dept rows × N sale cols CSS grid rendered with `role="grid"` + `aria-label="Department performance heat map"`. ✓
- 5-bucket blue-ramp quintile cells, min-max normalized over visible non-null cells. ✓
- `sell_through` and `revenue_share` metrics supported via `metric` prop. ✓
- No-data cells: hatched `bg-gray-50` + em-dash title. ✓
- Sticky first column + `overflow-x-auto` on the wrapper. ✓
- Native `title` tooltip with the documented format string. ✓
- Pending / error / empty / success states all implemented. ✓

## Test Counts

- `src/lib/heat-map-bucket.test.ts` — 14 tests (22-code sort, frozen, 8 quintile boundaries, min===max edge, no-data class / style contract).
- `src/components/DepartmentHeatMap.test.tsx` — 11 tests (pending/error/empty states; role=grid + aria-label; 22 rowheaders alphabetical; sticky-left; N columnheaders; sell_through title string; revenue_share title string; no-data cell hatch + em-dash; rows-without-sale_date filtering).
- Total: **25 new tests**, all passing. Full suite: **429/429 pass**.

## Deviations from Plan

None — plan executed as written. Minor rendering tweaks:

- **Top-left blank cell**: tagged `aria-hidden="true"` (in addition to the sticky-left styling the plan specified). A blank cell with no role produced noise in test `aria`-selector queries; `aria-hidden` is the conventional signal for "this is a layout stub."
- **Legend swatches**: wrapped in `aria-hidden="true"` — they are a decorative color-ramp reference; the data is already surfaced via cell `title` attributes.

Both tweaks are a11y improvements within the UI-SPEC's spirit (cells are the data; legend is decoration) rather than contract changes.

## Verification

- `npx vitest --run src/lib/heat-map-bucket.test.ts src/components/DepartmentHeatMap.test.tsx` → 25/25 pass.
- `npx vitest --run` (full suite) → 429/429 pass, 44 files.
- `npm run build` → clean TS + Vite production build.

## Self-Check: PASSED

Files exist and are committed:
- FOUND: `src/lib/heat-map-bucket.ts` (commit `8bd9cb0`)
- FOUND: `src/lib/heat-map-bucket.test.ts` (commit `036d674`)
- FOUND: `src/components/DepartmentHeatMap.tsx` (commit `d71cc5d`)
- FOUND: `src/components/DepartmentHeatMap.test.tsx` (commit `9be40cc`)

Commits exist on the worktree branch:
- FOUND: `036d674` test(05-06): add failing tests for heat-map-bucket helper
- FOUND: `8bd9cb0` feat(05-06): implement heat-map-bucket helper
- FOUND: `9be40cc` test(05-06): add failing tests for DepartmentHeatMap
- FOUND: `d71cc5d` feat(05-06): implement DepartmentHeatMap (TRND-04)
