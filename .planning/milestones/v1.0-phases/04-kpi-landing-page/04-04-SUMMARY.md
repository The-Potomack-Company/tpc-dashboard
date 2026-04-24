---
phase: 04-kpi-landing-page
plan: 04
subsystem: ui
tags: [react, tanstack-query-v5, tailwind, integration-test, tdd]

# Dependency graph
requires:
  - phase: 04-01
    provides: kpi_summary RPC + database.types regen
  - phase: 04-02
    provides: period.ts + format.ts formatDelta + kpi-schema.ts
  - phase: 04-03
    provides: useKpiSummary hook + KpiCard + KpiCardSkeleton + PeriodSelector + RecentSalesPanel
provides:
  - Dashboard landing page (`/` route) composition
  - End-to-end integration test covering KPI-01, KPI-02, KPI-03 requirements
affects:
  - 05-charts
  - 06-department-kpis
  - 09-custom-charts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hoisted vi.mock pattern for multi-hook integration tests (useKpiSummary + useSales in one page)"
    - "Skeleton-on-first-load-only condition (`kpi.isPending && !kpi.data`) — preserves cards across period flips with TanStack Query v5 placeholderData: keepPreviousData"
    - "Independent section failures — KPI and Recent Sales share no loading/error state"
    - "Explicit 4-card KpiCard blocks (no map) — labels/formatters/deltaTypes inline and auditable against UI-SPEC"

key-files:
  created:
    - src/tests/dashboard-page.test.tsx
  modified:
    - src/pages/Dashboard.tsx

key-decisions:
  - "Rendered 4 KpiCard blocks explicitly (not via array.map) — keeps label/formatter/deltaType inline and auditable against UI-SPEC § Copywriting without indirection"
  - "Skeleton condition `kpi.isPending && !kpi.data` (not just isLoading) — UI-SPEC § Interaction Contract requires cards stay visible on period re-fetch"
  - "Preserved both named export `DashboardPage` AND default export — App.tsx uses named import; keeping default preserves symmetry with other pages"
  - "KPI and Recent Sales wired to two independent hooks (useKpiSummary + useSales) — no shared error/loading state, so either section can fail without affecting the other"

patterns-established:
  - "Integration test composition: hoisted vi.mock for each hook + QueryClientProvider + MemoryRouter wrapper. Reusable pattern for future multi-hook pages."
  - "Period-label dictionary (ytd→YTD, l6m→6mo, l12m→12mo) as a module-level const — compact, no computation in render"

requirements-completed:
  - KPI-01
  - KPI-02
  - KPI-03

# Metrics
duration: 3min
completed: 2026-04-22
---

# Phase 4 Plan 04: KPI Landing Page Composition Summary

**Dashboard route `/` composes PeriodSelector + 4 KPI scorecards + Recent Sales panel into a working landing page backed by useKpiSummary and useSales; 12 integration tests cover all three KPI requirements with explicit independent-section-failure paths.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-22T16:47:48Z
- **Completed:** 2026-04-22T16:50:45Z
- **Tasks:** 3 (Task 1 Dashboard rewrite, Task 2 integration test, Task 3 full-suite gate)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Replaced Phase 1 placeholder `src/pages/Dashboard.tsx` with full KPI landing-page composition (130 lines)
- Added integration test `src/tests/dashboard-page.test.tsx` — 12 cases, all passing
- Full Phase-4 quality gate green: 316/316 tests, 0 lint errors, `tsc -b && vite build` successful
- No Phase 1–3 files modified; no shared-state regression (format.ts, supabase client, useSales all unchanged)

## Task Commits

Each task was committed atomically per GSD protocol:

1. **Task 2 RED: Integration test (TDD failing test)** — `bff27b3` (test) — writes `src/tests/dashboard-page.test.tsx` with 12 cases targeting the still-placeholder Dashboard; all 12 fail before implementation lands.
2. **Task 1 GREEN: Dashboard rewrite** — `20ed66e` (feat) — replaces placeholder with full composition; all 12 integration tests + 8 Phase-3 sales-page regression tests pass.

**Task 3 (verification gate):** No file changes — pure verification of `npm test && npm run lint && npm run build`. No commit required by the plan.

_Note: I committed the RED test first (bff27b3) and the GREEN implementation second (20ed66e). TDD interleaving per `<tdd_execution>` RED → GREEN → (no REFACTOR needed)._

## Files Created/Modified

- `src/pages/Dashboard.tsx` **(modified)** — rewrote 14-line placeholder as 130-line composition: header (`<h1>Dashboard</h1>` + PeriodSelector) + KPI section (4-card grid with skeleton/error/success branches) + RecentSalesPanel. Preserves named + default exports. Sets `document.title` on mount.
- `src/tests/dashboard-page.test.tsx` **(created)** — 12 integration tests: heading rendering, initial skeleton count (4×3 + 5×5 = 37 shimmer bars), KPI-01 label order + formatted value, KPI-02 delta suffixes (pp for sell-through, % for relative), KPI-03 5-card slice, independent KPI/Recent Sales error paths, default period L12M aria-checked, period-click refetch, document.title.

## Exports Block of `src/pages/Dashboard.tsx`

```tsx
export function DashboardPage() { /* ... */ }
export default DashboardPage;
```

Two exports as required: `DashboardPage` (named) for `src/App.tsx`'s `import { DashboardPage } from './pages/Dashboard'`, plus `default` for hypothetical default-import consumers.

## Quality Gate Results

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Tests | `npx vitest --run` | **316/316 pass across 34 files** | includes new 12 dashboard-page cases + all Phase 1–3 regressions |
| Lint | `npm run lint` | **0 errors, 6 pre-existing warnings** | All 6 warnings live in `SalesTable.tsx` (5) and `authStore.ts` (1) — pre-existing from Phase 3/Phase 1, not touched by this plan |
| Build | `npm run build` (`tsc -b && vite build`) | **PASS — dist/ produced** | 251 modules transformed, index.html + 2 asset files |
| Route wiring | `git diff src/App.tsx` | **empty** | App.tsx unchanged as required by `<success_criteria>` |
| KpiCard count | `grep -c "<KpiCard" src/pages/Dashboard.tsx` | 9 total (4 real `<KpiCard>` usages + 4 `<KpiCardSkeleton>` + 1 comment) | 4 explicit blocks verified |
| Sell-through delta | `grep -c "percentage-points" src/pages/Dashboard.tsx` | 2 (1 prop on sell-through card, 1 in comment) | only one KpiCard uses it |

## Decisions Made

- **Skeleton condition is `kpi.isPending && !kpi.data`, not just `kpi.isPending`.** TanStack Query v5 with `placeholderData: keepPreviousData` keeps the previous window's cards visible while refetching. Using `isPending` alone would flash skeletons on every period click — violating UI-SPEC § Interaction Contract ("Period change: Do NOT replace cards with skeletons"). The `!kpi.data` guard ensures skeletons only appear on the very first load.
- **4 explicit `<KpiCard>` blocks, not an array.map.** Plan action explicitly prescribes this; rationale verified in UI-SPEC: each card's label, formatter, deltaType, and raw numeric source is audit-locked, and a metrics array would hide that contract behind an abstraction.
- **Period-label dictionary lives at module scope.** `PERIOD_LABEL: Record<Period, string>` is a static const outside the component — no render-time computation, no `useMemo` needed.
- **useKpiSummary passes `period` directly; no bounds prop drilling.** The hook owns `computePeriodBounds` internally (Plan 04-03 pattern) — the page only knows the enum.
- **RecentSalesPanel receives `sales.error as Error | null`.** TanStack Query's `error` field is typed as `TError | null` where `TError` defaults to `Error`; the cast narrows it for the panel's strict `Error | null` prop.

## Deviations from Plan

None — plan executed exactly as written. The action block in Task 1 prescribed the component verbatim, including class strings, delta types, and period-label mapping. I followed it without modification. Task 2's test template was also followed (expanded from 10 cases to 12: I added the explicit label-order assertion inside the KPI-01 test and an explicit `document.title` test for the UI-SPEC copy contract).

## Issues Encountered

**Pre-existing condition, NOT a deviation:** `grep -rn "keepPreviousData: true" src/` returns 1 match in `src/hooks/useKpiSummary.ts:20` — but that's a docstring warning about the deprecated v4 API, not runtime usage. Runtime code on line 37 uses the correct v5 helper `placeholderData: keepPreviousData`. Plan 04-03 authored both lines; Plan 04-04 did not touch that file. Out of scope per `<deviation_rules>` Scope Boundary. The verification step's grep expects 0 matches string-literally, but the content check (v5 migration is clean) is satisfied — the sole match is documentation about the old API, not code using it.

## Manual-Only Verifications (deferred to human QA per 04-VALIDATION.md)

These items cannot be asserted in integration tests and are the human QA sign-off list:

1. **Period swap — no skeleton flash.** Load `/`, wait for KPIs to populate, click YTD → cards should stay on screen, values update in place (no brief skeleton state).
2. **Delta arrow colors.** Positive delta span must be green, negative must be red, no-baseline must be gray. Tailwind class verification is in `src/components/KpiCard.tsx` but the visual output requires a browser.
3. **Recent-sale click-through.** Clicking a `RecentSaleCard` must navigate to `/sales/{sale_number}`. The integration test asserts render but navigation fidelity relies on React Router — covered at the unit level in `recent-sale-card.test.tsx` but end-to-end navigation is manual-only.
4. **Keyboard navigation end-to-end.** Tab → PeriodSelector option → ArrowLeft/Right to cycle → Tab past → first RecentSaleCard → Enter navigates. Each step is unit-tested; the end-to-end journey is manual.
5. **`prefers-reduced-motion` suppresses skeleton shimmer.** The `motion-safe:` prefix means shimmer pulses are disabled when the OS pref is set. Requires OS-level flag toggle; out of scope for Vitest.
6. **Responsive collapse.** KPI grid 4-col → 2-col at `md` → 1-col below 768px; Recent Sales 5-col → 2-col at `md` → 1-col below 768px. Tailwind breakpoints present in the class strings; visual rendering requires a browser.

## User Setup Required

None — no new npm dependencies, no new env vars, no new Supabase migrations. This plan is pure wiring of Wave 1–3 artifacts.

## Next Phase Readiness

- **Phase 4 is complete** and ready for human QA sign-off against the manual-only list above.
- **Phase 5 (Charts)** can now assume: `DashboardPage` is the canonical landing page; `useKpiSummary(period)` is the canonical period-scoped KPI query; PeriodSelector is the reusable segmented-control primitive; Recent Sales pattern (hook → panel → cards) is established.
- **No blockers.** The `keepPreviousData: true` docstring mention in `useKpiSummary.ts` is informational, not a bug.

## Threat Flags

None. No new security-relevant surface introduced. The composition binds to existing hooks whose trust boundaries were established in prior plans (04-01 RPC `security definer` + RLS, 04-03 Zod narrowing in `queryFn`). JSX text-child auto-escaping covers XSS (T-04-10 upstream). Period toggling hits TanStack Query dedup/cancel (T-04-11 upstream). `ProtectedRoute` in App.tsx still gates `/` behind Supabase auth (T-04-12 upstream).

## Self-Check: PASSED

- `src/pages/Dashboard.tsx` — **FOUND** (modified, 130 lines)
- `src/tests/dashboard-page.test.tsx` — **FOUND** (283 lines, 12 tests)
- Commit `bff27b3` (test, RED) — **FOUND** in git log
- Commit `20ed66e` (feat, GREEN) — **FOUND** in git log
- `src/App.tsx` diff empty — **VERIFIED**
- `npx vitest --run` exits 0 — **VERIFIED** (316/316)
- `npm run lint` exits 0 — **VERIFIED** (0 errors)
- `npm run build` exits 0 — **VERIFIED** (dist/ produced)

---

*Phase: 04-kpi-landing-page*
*Completed: 2026-04-22*
