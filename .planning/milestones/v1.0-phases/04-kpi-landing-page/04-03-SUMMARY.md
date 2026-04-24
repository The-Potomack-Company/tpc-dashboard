---
phase: 04-kpi-landing-page
plan: 03
subsystem: kpi-landing-page
tags: [tanstack-query-v5, radiogroup, tailwind, tdd]
requires:
  - 04-01  # kpi_summary RPC + database.types regen
  - 04-02  # period.ts, format.ts formatDelta, kpi-schema.ts
provides:
  - useKpiSummary
  - KpiCard
  - KpiCardSkeleton
  - PeriodSelector
  - RecentSaleCard
  - RecentSaleCardSkeleton
  - RecentSalesPanel
affects:
  - src/hooks/
  - src/components/
  - src/tests/
tech-stack:
  added: []
  patterns:
    - "TanStack Query v5 placeholderData: keepPreviousData for non-flashing period flips"
    - "WAI-ARIA radiogroup (fieldset + role=radio + roving tabIndex + ArrowL/R/Home/End)"
    - "useMemo on .slice(0, n) for reference stability across parent re-renders"
    - "Zod schema.parse() in queryFn as the PostgREST Json → typed-domain trust boundary"
key-files:
  created:
    - src/hooks/useKpiSummary.ts
    - src/components/KpiCard.tsx
    - src/components/KpiCardSkeleton.tsx
    - src/components/PeriodSelector.tsx
    - src/components/RecentSaleCard.tsx
    - src/components/RecentSaleCardSkeleton.tsx
    - src/components/RecentSalesPanel.tsx
    - src/tests/use-kpi-summary.test.tsx
    - src/tests/kpi-card.test.tsx
    - src/tests/period-selector.test.tsx
    - src/tests/recent-sale-card.test.tsx
    - src/tests/recent-sales-panel.test.tsx
  modified: []
decisions:
  - "Use explicit named Period type alias in the useKpiSummary rerender test so TS doesn't narrow initialProps.period to a single literal and reject subsequent rerender({ period: 'ytd' }) calls under tsc -b."
metrics:
  tasks: 5
  files-created: 12
  duration-minutes: ~9
  completed-at: 2026-04-22
---

# Phase 4 Plan 03: Wave 3 Hook + Display Components Summary

**One-liner:** Landed the TanStack Query v5 `useKpiSummary` hook plus 6 UI components (KpiCard/Skeleton, PeriodSelector with WAI-ARIA radiogroup, RecentSaleCard/Skeleton, RecentSalesPanel) — each with its own Wave 0 test file — all ready for Plan 04-04 to compose into the Dashboard page.

## Scope

Wave 3 of Phase 4: the hook + display layer for the KPI landing page. No routing changes (Plan 04-04 composes), no new infrastructure (uses existing Supabase client, TanStack Query provider, react-router).

Wave 0 gaps from VALIDATION.md closed: every component + hook landed with its own dedicated test file.

## Deliverables

| Artifact | Purpose | Tests |
|---|---|---|
| `src/hooks/useKpiSummary.ts` | TanStack Query v5 hook wrapping `supabase.rpc('kpi_summary', …)` with `placeholderData: keepPreviousData` | `src/tests/use-kpi-summary.test.tsx` — 7 cases |
| `src/components/KpiCard.tsx` | Display-only KPI scorecard (label + value + delta + suffix) | `src/tests/kpi-card.test.tsx` — 12 cases |
| `src/components/KpiCardSkeleton.tsx` | Shimmer placeholder, 1:1 dimension match | (same file) |
| `src/components/PeriodSelector.tsx` | YTD / L6M / L12M segmented control, WAI-ARIA radiogroup | `src/tests/period-selector.test.tsx` — 16 cases |
| `src/components/RecentSaleCard.tsx` | Compact navigable card wrapped in react-router `<Link>` | `src/tests/recent-sale-card.test.tsx` — 14 cases |
| `src/components/RecentSaleCardSkeleton.tsx` | Shimmer placeholder, 1:1 dimension match | (same file) |
| `src/components/RecentSalesPanel.tsx` | Section heading + grid + loading/empty/error states | `src/tests/recent-sales-panel.test.tsx` — 9 cases |

**Total:** 12 new files (7 source + 5 test). **58 new test cases** added; full suite at 304 passing across 33 files.

## Confirmation checks (per plan §output)

### Test file `it()` counts
- `use-kpi-summary.test.tsx` — **7** (rpc args shape, rekey on period change, Zod narrowing number type, null sell_through, rpc error, malformed payload Zod fail, refetch exposure)
- `kpi-card.test.tsx` — **12** (up/down/no-baseline × render + container classes + not-interactive + skeleton)
- `period-selector.test.tsx` — **16** (render order, role/title/aria-label, active/inactive state, dividers, click, Arrow/Home/End/Enter, focus ring)
- `recent-sale-card.test.tsx` — **14** (Link href, container classes, each row, null / 0 lots_auctioned, null net_revenue / sale_date, skeleton)
- `recent-sales-panel.test.tsx` — **9** (loading, empty + col-span-full, error + col-span-full + retry, 10→5 slice, 3→3 no-pad, grid classes, heading)

### placeholderData: keepPreviousData — imported helper, not v4 flag

```ts
// src/hooks/useKpiSummary.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
…
export function useKpiSummary(period: Period) {
  return useQuery<KpiSummary>({
    queryKey: ['kpi', period],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    …
```

Grep confirms zero `keepPreviousData: true` outside JSDoc anti-pattern comments, zero `toISOString` in `useKpiSummary.ts` outside JSDoc.

### PeriodSelector active background — bg-gray-50, not accent

Active-state class string (from `src/components/PeriodSelector.tsx`):

```ts
isActive
  ? 'font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
  : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
```

No `bg-accent` anywhere in the file. `focus-visible:ring-accent` is the only accent usage (reservation #2 — focus rings — inherited from Phase 1).

### RecentSalesPanel uses useMemo

```ts
// src/components/RecentSalesPanel.tsx
const recent = useMemo(
  () => (sales ? sales.slice(0, SKELETON_COUNT) : []),
  [sales],
);
```

Dependency array is `[sales]`, so the sliced array reference is stable per identity of the input (research Pitfall 5 — slice thrash avoidance).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] useKpiSummary rerender test — TS literal narrowing**
- **Found during:** Final `npm run build` verification at end of Task 5.
- **Issue:** Passing `initialProps: { period: 'l12m' as const }` into `renderHook` narrowed the `period` generic to the literal `'l12m'`, which made the later `rerender({ period: 'ytd' })` call fail `tsc -b` (error TS2322).
- **Fix:** Introduced an explicit `type Period = 'ytd' | 'l6m' | 'l12m'` alias in the test and pinned `initialProps: { period: Period }` so all three values are assignable on rerender. Test still passes.
- **Files modified:** `src/tests/use-kpi-summary.test.tsx`.
- **Commit:** `51c3b3d`.

### Rule-4 architectural changes
None.

### UI-SPEC class-string deviations
None. All container class strings (KpiCard, KpiCardSkeleton, PeriodSelector, RecentSaleCard, RecentSaleCardSkeleton, RecentSalesPanel grid/heading) match UI-SPEC § Layout Specifications verbatim.

### Out-of-scope items (deferred — not fixed)
Pre-existing lint warnings from Phase 3 (`src/components/SalesTable.tsx` — TanStack Table `useReactTable` return memoization, and `src/stores/authStore.ts` — unused eslint-disable). These are not introduced by Plan 04-03 and fall outside its file-scope.

## Authentication Gates
None. Plan is pure frontend / test work — no auth flow touched.

## Threat Surface Scan

### Mitigations in register (unchanged, per plan `<threat_model>`)
- **T-04-07 (Tampering — RPC response)** mitigated by `kpiSummarySchema.parse(data)` inside `useKpiSummary.ts` queryFn. Test case "raises a Zod failure into isError when the RPC payload is malformed" exercises this path.
- **T-04-08 (XSS — sale.title / sale_number rendering)** mitigated by React JSX auto-escape of text children and attribute values. No `dangerouslySetInnerHTML` anywhere in the plan's files. Grep confirms zero matches.
- **T-04-09 (RBAC bypass)** — server-side gate (private.is_admin + RLS on sales) remains authoritative; frontend hook is purely within ProtectedRoute. No change.

### Threat flags
None. No new network endpoints, no new file-access patterns, no schema changes introduced.

## Final Verification

- `npx vitest --run` — **33 files passing, 304 tests passing** (58 new).
- `npm run build` — `tsc -b` + `vite build` green (988 ms).
- `npm run lint` — 0 errors; 3 warnings, all pre-existing (SalesTable, authStore) and out of scope.
- Grep checks (from plan `<verification>`):
  - `grep -rn "keepPreviousData: true" src/` → 1 hit (JSDoc anti-pattern comment only; no code use).
  - `grep -n "toISOString" src/hooks/useKpiSummary.ts` → 1 hit (JSDoc anti-pattern comment only).
  - `grep -cn 'role="radio"' src/components/PeriodSelector.tsx` → 1 match (JSX).
  - `grep -cn 'useMemo' src/components/RecentSalesPanel.tsx` → 5 matches.

## Commits (in dependency order)

| Hash | Message |
|---|---|
| `941f86f` | feat(04-03): add useKpiSummary hook with TanStack v5 keepPreviousData |
| `83d0bc8` | feat(04-03): add KpiCard + KpiCardSkeleton per UI-SPEC § Layout Specifications |
| `972b3bc` | feat(04-03): add PeriodSelector segmented control with WAI-ARIA radiogroup |
| `2196abd` | feat(04-03): add RecentSaleCard + RecentSaleCardSkeleton per UI-SPEC |
| `51c3b3d` | fix(04-03): widen useKpiSummary rerender initialProps type to Period union |
| `0e770a4` | feat(04-03): add RecentSalesPanel composing cards + skeletons + empty/error |

## Next

Plan 04-04 composes these seven artifacts into `src/pages/Dashboard.tsx` — the landing page replacement, period state, both-queries-independent loading/error handling. No component-level design work remaining.

## Self-Check: PASSED

All 13 listed files verified on disk (7 source + 5 test + this SUMMARY). All 6 per-task commits present in `git log`.
