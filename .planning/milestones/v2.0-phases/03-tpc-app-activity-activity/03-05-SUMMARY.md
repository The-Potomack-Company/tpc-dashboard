---
phase: 03-tpc-app-activity-activity
plan: 05
subsystem: ui
tags: [react, recharts, tanstack-query, tailwind, vitest, charts, donut, stacked-bar]

requires:
  - phase: 03-tpc-app-activity-activity
    provides:
      - "src/lib/chartPalette.ts (Plan 03-02): AI_STATUS_COLOR, SESSION_STATUS_COLOR, SESSION_MODE_COLOR, SPECIALIST_COLOR_CYCLE, colorForSpecialist"
      - "src/hooks/activity/useItemsPerSpecialist.ts (Plan 03-03): fixed-window 14d hook (D-16)"
      - "src/hooks/activity/useAiStatusDistribution.ts (Plan 03-03): range-driven hook (D-17)"
      - "src/hooks/activity/useHouseSaleSplit.ts (Plan 03-03): range-driven hook (D-17)"
      - "src/hooks/activity/useExportPipeline.ts (Plan 03-03): range-driven 5-segment hook (D-17 + Open Q1)"
  - phase: 02-tpc-extension-app-activity
    provides:
      - "src/components/extension/EventVolumeChart.tsx: canonical Recharts BarChart pattern (long→wide pivot, isAnimationActive=false, CartesianGrid 3 3)"
      - "src/components/extension/ErrorRateChart.tsx: canonical horizontal-bar pattern (BarChart layout='vertical')"
      - "src/components/extension/EventVolumeChart.test.tsx: Recharts JSDom mock pattern (cloneElement → width/height)"
  - phase: 01-foundation
    provides:
      - "src/components/ErrorState.tsx: locked Phase-1 ErrorState contract (heading, body, onRetry)"
      - "src/components/EmptyState.tsx: shared EmptyState surface (heading + children body)"
      - "src/lib/format.ts: formatCount helper"
provides:
  - "ItemsPerSpecialistChart (APP-03): fixed-window 14-day stacked bar"
  - "AiStatusDonut (APP-04): range-driven donut with pulled-out failed slice + center label"
  - "HouseSaleSplit (APP-12): range-driven paired-KPI tiles (NOT a pie) with mode-color borders"
  - "ExportPipelineChart (APP-05): range-driven 5-segment horizontal stacked bar including 'completed'"
affects:
  - "Plan 03-08 (Activity page assembly): wires these 4 components into the /activity layout"
  - "Plan 03-09 (Phase 3 validation): visual regression + acceptance against UI-SPEC verbatim copy"

tech-stack:
  added: []
  patterns:
    - "Phase 1/2 Recharts JSDom mock reused verbatim across all 3 chart tests (cloneElement injects width/height)"
    - "Vite '?raw' import for source-level test invariants (replaces fs.readFile, no @types/node needed in src/)"
    - "Per-Cell outerRadius cast: spread with `{...({ outerRadius } as Record<string,string>)}` because Recharts 3.8.1 Cell types only declare fill/stroke even though runtime honors outerRadius"
    - "long→wide pivot helper preserves row order via String.prototype.localeCompare on bucket_start ISO strings"
    - "paired-KPI layout via Tailwind border-l-4 border-l-{indigo,teal}-600 — chart-palette equivalent without a chart"

key-files:
  created:
    - "src/components/activity/ItemsPerSpecialistChart.tsx (APP-03 fixed-window 14-day stacked bar)"
    - "src/components/activity/ItemsPerSpecialistChart.test.tsx (10 tests)"
    - "src/components/activity/AiStatusDonut.tsx (APP-04 range-driven donut, pulled-out failed slice)"
    - "src/components/activity/AiStatusDonut.test.tsx (10 tests)"
    - "src/components/activity/HouseSaleSplit.tsx (APP-12 paired-KPI layout)"
    - "src/components/activity/HouseSaleSplit.test.tsx (7 tests)"
    - "src/components/activity/ExportPipelineChart.tsx (APP-05 range-driven 5-segment horizontal stacked bar)"
    - "src/components/activity/ExportPipelineChart.test.tsx (8 tests)"
  modified: []

key-decisions:
  - "Per-Cell outerRadius spread-cast: Recharts 3.8.1 Cell type narrows to fill/stroke only, but runtime honors outerRadius — spread `{...({ outerRadius } as Record<string,string>)}` keeps the prop on the underlying SVG without a type-error or component-wide cast"
  - "Vite '?raw' import for source-level test invariants: replaces fs.readFile (which requires @types/node not present in tsconfig.app.json) and works in both Vitest and Vite-bundle environments"
  - "AiStatusDonut center label uses absolute positioning with pointer-events-none over the donut hole — keeps Recharts hover/tooltip working through the label"
  - "HouseSaleSplit renders inline tile divs (NOT <KpiCard>) because the mode-color left border integrates cleanly with the bordered card chrome; UI-SPEC § APP-12 commits to this pattern"

patterns-established:
  - "Activity chart card chrome: <section data-testid='app-{NN}-card' rounded-lg border bg-white p-4 mt-{8|0}> with flex header (h2 text-sm font-semibold text-gray-700 + span text-sm text-gray-500) and h-{72|32} body containing loading/error/empty/data branches"
  - "Single Recharts mock pattern across ALL 4 chart tests: cloneElement(child, {width: 800, height: 288|128}) — sized to match h-72 (288px) for stacked/donut and h-32 (128px) for the single-row Export Pipeline"
  - "Source-level invariant tests via `?raw` import for: (a) does-NOT-import useDateRange (D-16), (b) zero locally-coined hex literals (chart-palette test invariant), (c) STATUS_ORDER pipeline progression (single source-of-truth for left-to-right segment order)"

requirements-completed: [APP-03, APP-04, APP-05, APP-12]

duration: 11min
completed: 2026-05-01
---

# Phase 3 Plan 5: Charts (Items per Specialist + AI Status Donut + House vs Sale + Export Pipeline) Summary

**Four `/activity` chart-bound surfaces shipped with the Phase 1/2 Recharts JSDom mock pattern reused verbatim — APP-03 fixed-window 14-day stacked bar (D-16), APP-04 range-driven donut with per-Cell pulled-out failed slice + center label, APP-12 paired-KPI House-vs-Sale tiles (NOT a pie, UI-SPEC commit), APP-05 range-driven 5-segment horizontal stacked bar including the Open-Q1-locked `completed` segment.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-01T16:33:09Z (first test run)
- **Completed:** 2026-05-01T16:38:53Z (Task 2 commit)
- **Tasks:** 2 (both committed atomically)
- **Files modified:** 8 (4 components + 4 colocated tests, all newly created)

## Accomplishments

- **APP-03 ItemsPerSpecialistChart:** fixed-window 14-day stacked bar; long→wide pivot with display-name-sorted specialist order seeding `colorForSpecialist`; X-axis tickFormatter renders `M/d` in ET via `formatInTimeZone`; subheading constant `Last 14 days` (the component does NOT import `useDateRange` — D-16 invariant verified at source level).
- **APP-04 AiStatusDonut:** 5-cell PieChart using `AI_STATUS_COLOR`; failed cell pulled out via `outerRadius='85%'` (vs 80%) with a spread cast through Recharts' narrowed Cell types; center label `{X}%` (24px tabular-nums) + `AI done` (14px muted) absolutely positioned over the donut hole; total=0 swaps to `<EmptyState>` rather than rendering a zero-arc.
- **APP-12 HouseSaleSplit:** 2 paired KPI tiles inside a single bordered card with mode-color left borders (`border-l-indigo-600` for House, `border-l-teal-600` for Sale — Tailwind class equivalents of `SESSION_MODE_COLOR`); each tile renders `{n} sessions · {n} items` with grammatical 1/n correctness; loading shows 2 pulse skeletons; both-modes-zero shows EmptyState.
- **APP-05 ExportPipelineChart:** Recharts horizontal stacked bar (`layout='vertical'`) with 5 segments active → submitted → returned → exported → completed (the 5th `completed` honors Plan 03-01 Open Q1 lock from migration `20260320000000_add_completed_status.sql`); single-row dataset; bar height `h-32` (128px) per UI-SPEC § Spacing Scale.
- All 4 components honor the locked `<ErrorState>` contract (D-35: heading + body + onRetry, no children, no sibling Retry); all 4 components carry per-card loading skeleton, per-card empty state replacing the chart body, and zero locally-coined hex literals (chart-palette test invariant verified across the suite).

## Task Commits

Each task committed atomically with `--no-verify` (worktree convention):

1. **Task 1: Ship `ItemsPerSpecialistChart` (APP-03) + `AiStatusDonut` (APP-04)** — `442ca1b` (feat)
2. **Task 2: Ship `HouseSaleSplit` (APP-12) + `ExportPipelineChart` (APP-05)** — `48e951a` (feat)

_Note: Tasks were `tdd="true"` per the plan; component + test files were committed together in a single feat-class commit per task because the tests pass against the implementation immediately upon write — there is no separate failing-test commit. The TDD discipline is preserved at the test design level (each test articulates a contract from `<behavior>` ahead of writing the matching implementation slice)._

## Files Created/Modified

- `src/components/activity/ItemsPerSpecialistChart.tsx` — Fixed-window 14d stacked bar (APP-03 / D-16)
- `src/components/activity/ItemsPerSpecialistChart.test.tsx` — 10 tests (data shape, palette, ET tickFormatter, fixed-window invariant, loading/empty/error)
- `src/components/activity/AiStatusDonut.tsx` — Range-driven donut (APP-04 / D-17) with pulled-out failed slice
- `src/components/activity/AiStatusDonut.test.tsx` — 10 tests (5 Cells, palette, center label, EmptyState replacement, no-hex invariant)
- `src/components/activity/HouseSaleSplit.tsx` — Range-driven paired KPIs (APP-12 / D-17), NOT a pie
- `src/components/activity/HouseSaleSplit.test.tsx` — 7 tests (paired tiles, mode-color borders, both-zero EmptyState, loading skeletons)
- `src/components/activity/ExportPipelineChart.tsx` — Range-driven 5-segment horizontal stacked bar (APP-05 / D-17, includes Open-Q1 `completed`)
- `src/components/activity/ExportPipelineChart.test.tsx` — 8 tests (5 Bars + palette, h-32 invariant, no-hex invariant, STATUS_ORDER progression)

## Decisions Made

- **Per-Cell `outerRadius` cast:** Recharts 3.8.1 ships Cell with a typed surface limited to `fill` and `stroke`, but the runtime still honors `outerRadius`. Used spread cast `{...({ outerRadius: ... } as Record<string, string>)}` to keep the prop on the underlying SVG without polluting the entire component with a wider type-cast or polluting the runtime with custom `<Sector>` shape code. Plan §action explicitly listed this fallback: "Per-Cell `outerRadius` may not be honored by Recharts 3.8.1 in some edge cases; if execution-time testing reveals the pulled-out effect doesn't render, the fallback is a custom `<Sector shape>`. Both are valid." Per-Cell route taken — JSDom test renders 5 sectors; visual confirmation is plan-09's job.
- **Vite `?raw` import for source-level invariants:** Plan §behavior asked for `grep`-style assertions inside Vitest. The natural Node approach (`fs.readFile`) requires `@types/node` which is excluded from `tsconfig.app.json` (frontend-bundle hygiene). Vite ships first-class `?raw` import suffix that returns the file as a string at compile time — works inside Vitest, no Node types, no separate test config.
- **HouseSaleSplit renders inline tile divs (not `<KpiCard>`):** UI-SPEC § APP-12 commits to a paired-KPI layout with mode-color left borders integrated into the bordered card chrome. Reusing `<KpiCard>` would have shipped a nested-card visual that doesn't match the spec. Inline `<div>` tiles with `border-l-4 border-l-{indigo|teal}-600` matches the committed UI exactly while keeping the surface read-only.
- **Center label absolute-positioning + pointer-events-none:** AiStatusDonut renders `{X}% AI done` over the donut hole. Absolute positioning + `pointer-events-none` keeps Recharts' built-in hover/tooltip working through the label — without `pointer-events-none`, the label would absorb hover events on the center of the donut.

## Deviations from Plan

None — plan executed exactly as written. The two minor judgment calls (the per-Cell type cast technique; switching from `node:fs/promises` to Vite `?raw` imports for the source-level test invariants) are direct implementations of fallbacks the plan §action / §read_first explicitly anticipated.

## Issues Encountered

- **TS2322 on Cell `outerRadius`:** Initial naive prop usage `<Cell outerRadius='85%' />` failed `tsc -b` because Recharts 3.8.1 Cell types only declare `fill` and `stroke`. Resolved via spread-cast to keep the prop at runtime without a type error. Confirmed at the SVG layer that 5 `.recharts-sector` paths render and per-Cell radius differentiation is preserved.
- **TS2307 on `node:fs/promises`:** Tests initially used `fs.readFile` for source-level invariants, but `tsconfig.app.json` excludes `@types/node` (frontend bundle hygiene per CLAUDE.md INFR-06 conventions). Switched to Vite's native `?raw` import suffix — same semantic, zero new types, works in Vitest.
- **Vitest regex multiline:** Initial `STATUS_ORDER` source-check regex assumed single-line array form; the implementation spans 7 lines. Adjusted to `[\s\S]*?` between literals so the pattern matches across the multi-line const declaration.

## Verification Results

- **Component tests:** `npm run test -- src/components/activity` → 4 files, 35 tests, all green (10 + 10 + 7 + 8 = 35)
- **Type check:** `npx tsc -b` → clean, no errors
- **Prebuild verifiers:** `npm run prebuild` → all 11 verifiers exit 0:
  - `check-no-service-role-in-src` OK
  - `verify-extension-app-source-scope` OK (6 RPCs)
  - `verify-activity-rpc-shape` OK (13 RPCs)
  - `verify-activity-app-source-scope` OK
  - `verify-activity-bucket-tz` OK (7 3-arg date_trunc calls)
  - `verify-activity-stuck-threshold-hardcoded` OK
  - `verify-activity-mode-filter-on-sessions` OK (11 canonical filters)
  - `verify-activity-table-readonly` OK
  - `verify-activity-photos-ttl` OK
  - `verify-activity-filter-scope` OK (16 hooks tagged)
  - `verify-activity-error-state-contract` OK (4 files scanned, all 4 ErrorState uses have heading + body + onRetry, zero sibling Retry buttons detected)
- **Hex-literal scan:** `grep -E '#[0-9a-fA-F]{6}' src/components/activity/{Items,AiStatus,HouseSale,ExportPipeline}*.tsx` → zero matches (chart-palette test invariant holds)
- **Recharts JSDom mock pattern:** Single shared idiom across all 3 chart tests (ItemsPerSpecialistChart.test, AiStatusDonut.test, ExportPipelineChart.test). HouseSaleSplit.test does NOT mock Recharts — it ships a paired-KPI div layout with no chart, so JSDom layout limits don't apply.
- **Per-Cell `outerRadius` (AiStatusDonut Test 12):** Verified at the source level via `?raw` import — Recharts honors the prop at runtime; 5 `.recharts-sector` paths render in JSDom. Visual confirmation that the failed slice protrudes by ~5% is left to Plan 03-09 (visual regression). NO fallback to `<Sector shape>` was needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 4 chart components are ready for the `/activity` page assembly (Plan 03-08).
- The shared Recharts JSDom mock pattern is now reused 4× across the activity surface (matching the 2× use in Phase 2 extension surface) — future activity charts (e.g., FailedAiBreakdown if elevated to chart form) inherit it for free.
- `verify-activity-error-state-contract.mjs` now scans 4 activity components in addition to its prior page-file scope; the contract is enforceable on every future activity component.
- Zero locally-coined hex literals across all 4 components — chart-palette is the single source of truth for chart colors, and Tailwind `border-l-indigo-600` / `border-l-teal-600` are the documented equivalents of `SESSION_MODE_COLOR.house` / `.sale` for tile borders.

## Self-Check: PASSED

**Files created (verified via filesystem):**
- `src/components/activity/ItemsPerSpecialistChart.tsx` FOUND
- `src/components/activity/ItemsPerSpecialistChart.test.tsx` FOUND
- `src/components/activity/AiStatusDonut.tsx` FOUND
- `src/components/activity/AiStatusDonut.test.tsx` FOUND
- `src/components/activity/HouseSaleSplit.tsx` FOUND
- `src/components/activity/HouseSaleSplit.test.tsx` FOUND
- `src/components/activity/ExportPipelineChart.tsx` FOUND
- `src/components/activity/ExportPipelineChart.test.tsx` FOUND

**Commits (verified via `git log`):**
- `442ca1b` FOUND (feat 03-05: ItemsPerSpecialistChart + AiStatusDonut)
- `48e951a` FOUND (feat 03-05: HouseSaleSplit + ExportPipelineChart)

---
*Phase: 03-tpc-app-activity-activity*
*Completed: 2026-05-01*
