---
phase: 05-trend-analysis
plan: 01
subsystem: ui
tags: [recharts, charts, typescript, react, tailwind, vitest]

# Dependency graph
requires:
  - phase: 04-kpi-landing-page
    provides: "src/lib/period.ts (Period / PeriodBounds / computePeriodBounds / toIsoDateLocal)"
  - phase: 03-sale-views
    provides: "src/lib/format.ts (formatCurrency/Percent/Count/Date) — reused by ChartTooltip consumers"
provides:
  - "recharts@^3.8.1 dependency installed and importable from src/"
  - "src/lib/chart-colors.ts — CHART_PALETTE (8 hex values) + 5 neutral constants"
  - "src/lib/period.ts — RangePreset / Range / rangeFromPreset / DEFAULT_RANGE_PRESET (Phase 4 Period API preserved unchanged)"
  - "src/components/ChartTooltip.tsx — Recharts custom tooltip content"
  - "src/components/ChartSkeleton.tsx — layout-stable shimmer placeholder"
  - "src/components/ChartCard.tsx — shared chart wrapper (title + subtitle + action + body slot)"
affects: [05-02-date-range-filter, 05-03-data-hooks, 05-04-net-revenue-chart, 05-05-estimate-accuracy-chart, 05-06-department-heat-map, 05-07-trends-page]

# Tech tracking
tech-stack:
  added: [recharts@^3.8.1]
  patterns:
    - "Categorical palette as indexed tuple — chart consumers import CHART_PALETTE[i] by semantic role"
    - "Range type uses yyyy-mm-dd strings (not Dates) so PostgREST .gte/.lte can receive them directly"
    - "null/null Range for 'all time' — hooks translate null into 'omit predicate'"
    - "ChartCard renders semantic <section>; no Recharts dependency so non-Recharts surfaces (heat map) can compose it"
    - "ChartTooltip decoupled from Recharts internals — active/label/payload typed as optional; consumers own formatters"

key-files:
  created:
    - src/lib/chart-colors.ts
    - src/components/ChartTooltip.tsx
    - src/components/ChartSkeleton.tsx
    - src/components/ChartCard.tsx
    - src/tests/chart-colors.test.ts
    - src/tests/chart-tooltip.test.tsx
    - src/tests/chart-skeleton.test.tsx
    - src/tests/chart-card.test.tsx
  modified:
    - package.json
    - package-lock.json
    - src/lib/period.ts
    - src/tests/period.test.ts

key-decisions:
  - "Keep chart-blue and --color-accent as two separate references to the same hex (#2563eb) so a future palette or accent shift in one role does not cascade to the other."
  - "Range.start/end use yyyy-mm-dd strings rather than Dates — the downstream hooks (plan 05-03) pass them directly to PostgREST .gte/.lte on the sale_date date column; pre-serializing here eliminates the UTC-drift class of bug (04-RESEARCH pitfall 2)."
  - "rangeFromPreset('all') returns { start: null, end: null, preset: 'all' } — plan 05-03 must translate null into 'omit predicate'."
  - "Export DEFAULT_RANGE_PRESET = 'l12m' as a single source of truth shared by the DateRangeFilter (plan 05-02) and the Trends page (plan 05-07) so the app-wide default cannot drift."
  - "ChartCard is a pure layout component — it does not import Recharts so the TRND-04 heat map (hand-authored CSS grid) can reuse the same wrapper."
  - "ChartTooltip does not import from 'recharts'; typing active/label/payload as optional mirrors Recharts' runtime-clone contract and lets Vitest render the component directly without booting a <LineChart>."

patterns-established:
  - "Pattern: Chart palette as readonly indexed tuple — `CHART_PALETTE[0]` (blue-600) wired by semantic role, not hex."
  - "Pattern: Range API coexists with Period API in src/lib/period.ts — Phase 4 exports untouched, Phase 5 additions appended."
  - "Pattern: ChartSkeleton shape matches ChartCard shape so skeleton→chart swap produces no layout shift."
  - "Pattern: Custom Recharts content components receive { active, label, payload } as optional props; consumers supply required formatters."

requirements-completed: [INTR-03]

# Metrics
duration: 10m
completed: 2026-04-22
---

# Phase 5 Plan 01: Chart Foundation Primitives Summary

**Recharts 3.8.1 installed plus 8-color categorical palette, yyyy-mm-dd Range API on period.ts, and three layout-stable chart primitives (ChartTooltip / ChartSkeleton / ChartCard) with 34 new tests — the foundation every Phase 5 chart depends on.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-22T17:30:00Z (approx)
- **Completed:** 2026-04-22T17:40:38Z
- **Tasks:** 3
- **Files modified:** 12 (6 created, 4 updated, 2 lockfile / manifest)

## Accomplishments
- Recharts 3.8.1 pinned and installed (CLAUDE.md → package.json aligned).
- `CHART_PALETTE` + 5 neutral constants codify UI-SPEC § Chart Palette.
- `period.ts` extended with `RangePreset`, `Range`, `rangeFromPreset`, `DEFAULT_RANGE_PRESET` without disturbing the Phase 4 Period API.
- Three layout primitives (ChartTooltip / ChartSkeleton / ChartCard) shipped with 34 tests covering behavior + surface classes + a11y.
- Full suite 359/359 green; `tsc -b && vite build` clean.

## Task Commits

1. **Task 1: Install recharts + chart-colors.ts + period.ts Range API** — `785983b` (feat)
2. **Task 2: ChartTooltip primitive + 11 tests** — `fa5b255` (feat)
3. **Task 3: ChartCard and ChartSkeleton primitives + 15 tests** — `3b2285a` (feat)

## Files Created/Modified

### Created
- `src/lib/chart-colors.ts` — `CHART_PALETTE` (8-hex tuple) + `CHART_GRID_STROKE` / `CHART_AXIS_TICK_FILL` / `CHART_TOOLTIP_BG` / `CHART_TOOLTIP_TEXT` / `CHART_TOOLTIP_LABEL`.
- `src/components/ChartTooltip.tsx` — dark-surface chip with header + color-dot/label/value rows. Returns null when inactive/empty (Recharts convention). `aria-live="polite"` for SR hover announcements.
- `src/components/ChartSkeleton.tsx` — three motion-safe pulse bars inside a card shell matching ChartCard exactly. `height: 'sm'|'lg'` picks h-80 vs h-[400px]. Body carries `aria-label="Loading chart"`.
- `src/components/ChartCard.tsx` — semantic `<section>` with `<header>` (title / optional subtitle / optional action slot) and body wrapper at `mt-4 h-80|h-[400px]`. Pure layout — no Recharts dependency.
- `src/tests/chart-colors.test.ts` — 8 assertions pinning every hex value.
- `src/tests/chart-tooltip.test.tsx` — 11 assertions (render, null on inactive/empty, default valueFormatter, color dot, surface classes, aria-live).
- `src/tests/chart-skeleton.test.tsx` — 5 assertions (default height, lg height, pulse count, aria-label).
- `src/tests/chart-card.test.tsx` — 10 assertions (title, subtitle present/absent, action present/absent, height variants, children placement, surface classes, section tag).

### Modified
- `package.json` / `package-lock.json` — `recharts@^3.8.1` + transitive deps.
- `src/lib/period.ts` — appended `RangePreset`, `Range`, `rangeFromPreset`, `DEFAULT_RANGE_PRESET`. Existing Period / PeriodBounds / computePeriodBounds / toIsoDateLocal untouched.
- `src/tests/period.test.ts` — appended 11 new cases for all 5 presets + type narrowing + DEFAULT_RANGE_PRESET + a regression guard confirming Phase 4 bounds math is unchanged.

### Key export snippets

```ts
// src/lib/period.ts (additions)
export type RangePreset = 'ytd' | 'l6m' | 'l12m' | 'l24m' | 'all';
export interface Range {
  start: string | null;
  end: string | null;
  preset: RangePreset | 'custom';
}
export const DEFAULT_RANGE_PRESET: RangePreset = 'l12m';
export function rangeFromPreset(preset: RangePreset, now?: Date): Range;
```

```ts
// src/components/ChartTooltip.tsx
export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name: string;
    value: number | string;
    dataKey: string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  headerFormatter: (
    label: string | number | undefined,
    firstRow: ChartTooltipProps['payload'] extends Array<infer R> | undefined ? R : never,
  ) => string;
  valueFormatter?: (row: NonNullable<ChartTooltipProps['payload']>[number]) => string;
}
```

```ts
// src/components/ChartCard.tsx
interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  height?: 'sm' | 'lg';
  children: ReactNode;
}
```

```ts
// src/components/ChartSkeleton.tsx
interface ChartSkeletonProps { height?: 'sm' | 'lg'; }
```

## Decisions Made

- **Two references to one hex.** `CHART_PALETTE[0]` (#2563eb, chart-blue) and `--color-accent` (#2563eb) are kept as separate symbols despite matching hex, so a future palette or accent change in one role doesn't cascade to the other.
- **yyyy-mm-dd on Range.** Start / end are strings, not Dates — the data hooks pass them straight to PostgREST `.gte / .lte`. Pre-serializing here removes all timezone reasoning from the call sites.
- **null/null for 'all'.** `rangeFromPreset('all')` returns `{ start: null, end: null }`. Plan 05-03 must translate null into "omit predicate" so the query scans the full archive.
- **DEFAULT_RANGE_PRESET exported.** Prevents 'l12m' defaulting from drifting between the DateRangeFilter (plan 05-02) and the Trends page (plan 05-07).
- **ChartCard has no Recharts import.** This keeps the TRND-04 heat map (hand-authored CSS grid, plan 05-06) eligible to reuse the same card wrapper.
- **ChartTooltip decoupled from Recharts internals.** `active / label / payload` typed as optional — mirrors Recharts' runtime-clone contract and lets Vitest render the component directly without mounting a chart.

## Deviations from Plan

None — plan executed exactly as written. All three task behaviors and acceptance criteria are satisfied as specified by 05-01-PLAN.md.

## Issues Encountered

- **Initial tool-call path confusion.** The first `Write` call for `chart-colors.test.ts` and initial `Edit` of `period.test.ts` were sent with the main-repo absolute path instead of the worktree absolute path, which placed one file in the main repo and left the worktree unchanged. Detected immediately when `vitest` reported "14 tests" instead of "24". Reverted the main-repo modification (`git checkout`), removed the misplaced file, and retried each operation with the worktree-rooted path. No code impact; caught before any commit.

## User Setup Required

None — no external service configuration required. This plan ships pure frontend primitives (npm package + TypeScript / TSX files).

## Next Phase Readiness

- Wave-1 Plan 05-02 (DateRangeFilter) can now import `RangePreset`, `Range`, `rangeFromPreset`, `DEFAULT_RANGE_PRESET` from `src/lib/period.ts`.
- Wave-2 Plan 05-03 (data hooks) will consume `Range` directly as its query input; null-start/end translation to "omit predicate" is the contract documented above.
- Wave-3 chart plans (05-04 / 05-05 / 05-06) can import `CHART_PALETTE`, `CHART_GRID_STROKE`, `CHART_AXIS_TICK_FILL` from `src/lib/chart-colors.ts`, and compose `ChartCard` / `ChartSkeleton` / `ChartTooltip` without further primitive work.

## Verification

- `npx vitest --run` — 38 test files / 359 tests passed (34 new in this plan).
- `npm run build` — `tsc -b && vite build` clean (436 kB JS / 31 kB CSS).
- `npm run lint` — 0 errors. 3 pre-existing warnings in unrelated files (DepartmentTable, SalesTable, authStore) — out of scope per SCOPE BOUNDARY; logged but not modified.
- `npm list recharts` — `recharts@3.8.1`.

## Self-Check: PASSED

Commits verified:
- FOUND: 785983b (Task 1)
- FOUND: fa5b255 (Task 2)
- FOUND: 3b2285a (Task 3)

Files verified:
- FOUND: src/lib/chart-colors.ts
- FOUND: src/lib/period.ts (extended)
- FOUND: src/components/ChartTooltip.tsx
- FOUND: src/components/ChartSkeleton.tsx
- FOUND: src/components/ChartCard.tsx
- FOUND: src/tests/chart-colors.test.ts
- FOUND: src/tests/chart-tooltip.test.tsx
- FOUND: src/tests/chart-skeleton.test.tsx
- FOUND: src/tests/chart-card.test.tsx
- FOUND: src/tests/period.test.ts (extended)

---
*Phase: 05-trend-analysis*
*Completed: 2026-04-22*
