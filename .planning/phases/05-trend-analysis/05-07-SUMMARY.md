---
phase: 05-trend-analysis
plan: 07
subsystem: trends-page
tags: [page-composition, routing, sidebar, trnd-01, trnd-02, trnd-03, trnd-04, trnd-05, trnd-06, intr-03, wave-4]
one_liner: "Trends page composes DateRangeFilter + 5 ChartCard wrappers (TRND-01/02/05/06/04) into /trends under ProtectedRoute, flips sidebar Trends entry to active NavLink, closes Phase 5 wiring."
dependency_graph:
  requires:
    - src/lib/period.ts#Range (Plan 05-01)
    - src/lib/period.ts#DEFAULT_RANGE_PRESET (Plan 05-01)
    - src/lib/period.ts#rangeFromPreset (Plan 05-01)
    - src/components/ChartCard.tsx (Plan 05-01)
    - src/components/DateRangeFilter.tsx (Plan 05-02)
    - src/components/MetricToggle.tsx#MetricToggle (Plan 05-02)
    - src/components/MetricToggle.tsx#HeatMapMetric (Plan 05-02)
    - src/components/NetRevenueTrendChart.tsx (Plan 05-04)
    - src/components/SellThroughTrendChart.tsx (Plan 05-04)
    - src/components/EstimateAccuracyChart.tsx (Plan 05-05)
    - src/components/BidderParticipationChart.tsx (Plan 05-05)
    - src/components/DepartmentHeatMap.tsx (Plan 05-06)
    - src/components/ProtectedRoute.tsx (Phase 1)
    - src/layouts/DashboardLayout.tsx (Phase 1, Phase 3 Wave 4)
  provides:
    - src/pages/Trends.tsx#TrendsPage
    - /trends route under ProtectedRoute + DashboardLayout
    - Active sidebar NavLink to /trends (accent reservation #3 activated)
  affects:
    - Phase 5 delivery — every plan 05-01..06 artifact now has a live rendering surface
    - Phase 6 Department comparison — can extend /trends or add sibling /departments route using same shell
    - Phase 9 URL-persisted range state — Trends page owns local range state; Phase 9 may lift into searchParams
tech_stack:
  added: []
  patterns:
    - "useState(() => rangeFromPreset(...)) — compute initial Range once on mount, avoid rerender-time Date construction"
    - "Hoisted chart component mocks (vi.hoisted + vi.mock) re-emit props as data-* attributes for prop-flow assertions"
    - "Action-slot pattern — MetricToggle lives in ChartCard.action for TRND-04, keeping toggle visually bound to its chart"
    - "flex-wrap gap-4 header — DateRangeFilter wraps below the h1 on narrow viewports without overflow"
    - "Declarative composition — no useEffect refetch orchestration; TanStack Query re-keys via queryKey on range change"
key_files:
  created:
    - src/pages/Trends.tsx
    - src/tests/trends-page.test.tsx
  modified:
    - src/App.tsx
    - src/layouts/DashboardLayout.tsx
    - src/tests/dashboard-layout.test.tsx
decisions:
  - "Test file path: src/tests/trends-page.test.tsx (repo convention: page tests live in src/tests/, not beside the page). Frontmatter in PLAN mentioned src/pages/Trends.test.tsx but existing repo pattern (dashboard-page.test.tsx, sales-page.test.tsx, sale-detail-page.test.tsx) lives under src/tests/. Followed convention."
  - "Kept DateRangeFilter + MetricToggle real (not mocked) in the integration test so keyboard + click flow is exercised end-to-end; only the 5 chart components are mocked (Recharts does not render cleanly in jsdom)."
  - "Added a positive assertion to dashboard-layout.test.tsx (Trends renders as a NavLink to /trends) alongside removing 'Trends' from the disabled-nav set — guards against future accidental regression to 'Coming soon'."
  - "Metric isolation test: toggling MetricToggle must not re-serialize Range into the line/area chart mocks. Guards against a future refactor that accidentally lifts metric into useSalesInRange or similar."
metrics:
  duration: "~5 minutes (Task 1 only; Task 2 checkpoint deferred)"
  completed: 2026-04-22
requirements: [TRND-01, TRND-02, TRND-03, TRND-04, TRND-05, TRND-06, INTR-03]
---

# Phase 5 Plan 05-07: Trends Page Composition Summary

Composed the `/trends` route — `TrendsPage` renders `DateRangeFilter` (right-aligned in the page header) plus five `ChartCard` wrappers in the UI-SPEC-locked order: TRND-01 and TRND-02 as a two-column row, then TRND-05, TRND-06, and TRND-04 (heat map with `MetricToggle` in the header action slot) each full-width. Registered the route under `ProtectedRoute` + `DashboardLayout` in `src/App.tsx` and flipped the sidebar "Trends · Coming soon" entry to an active `NavLink` pointing to `/trends`. Range state defaults to L12M; metric state defaults to `sell_through`. Both flow as props to the chart children — no Zustand, no URL persistence.

## Files

### Created
- `src/pages/Trends.tsx` — `TrendsPage` component (default + named export).
- `src/tests/trends-page.test.tsx` — 10 integration tests with hoisted chart mocks.

### Modified
- `src/App.tsx` — imported `TrendsPage` and added `<Route path="/trends" element={<TrendsPage />} />` inside the `DashboardLayout` group.
- `src/layouts/DashboardLayout.tsx` — updated the `NAV_ITEMS` "Trends" entry from `{ label: "Trends", Icon: IconChartBar }` to `{ label: "Trends", to: "/trends", Icon: IconChartBar }`. Updated the comment above `NAV_ITEMS` to reflect Phase 5 activation.
- `src/tests/dashboard-layout.test.tsx` — removed "Trends" from the disabled-nav test and added a positive assertion that Trends renders as a NavLink to `/trends`.

## Commits

| Commit | Type | Message |
| ------ | ---- | ------- |
| `182e961` | test | test(05-07): add failing integration test for Trends page composition |
| `1732de2` | feat | feat(05-07): compose TrendsPage, add /trends route, activate sidebar link |

## Integration Test Coverage

`src/tests/trends-page.test.tsx` — 10 tests, all passing:

1. Renders `<h1>Trends</h1>`.
2. Renders the `DateRangeFilter` fieldset (`group` role with accessible name `Select date range`).
3. Renders all 5 `ChartCard` `<h2>` titles in the UI-SPEC-locked order (Net revenue per sale → Sell-through per sale → Estimate accuracy over time → Bidder participation → Department performance).
4. Renders the `MetricToggle` fieldset (`group` role with accessible name `Select heat map metric`) inside the heat-map card.
5. Default range preset is `l12m` on first render (asserted via the `data-range` attribute of the mocked `NetRevenueTrendChart`).
6. Clicking the `YTD` preset radio propagates `range.preset === 'ytd'` to all 5 chart mocks.
7. Default metric is `sell_through` (asserted via `data-metric` on the mocked `DepartmentHeatMap`).
8. Clicking `Revenue share %` flips the heat-map metric to `revenue_share`.
9. Toggling metric does NOT mutate the `range` prop on the line/area charts — guards against accidental re-keying if a future refactor lifts metric into a shared hook.
10. `document.title` becomes `Trends — TPC Dashboard` after mount.

`src/tests/dashboard-layout.test.tsx` updated — one test retrofitted (`disabledLabels` dropped `Trends`), one new positive assertion added (Trends renders as a NavLink to `/trends`). All 7 layout tests pass.

## Verification Results

- `npx vitest --run src/tests/trends-page.test.tsx` — 10/10 pass.
- `npx vitest --run` (full suite) — 479/479 pass across 51 test files (no regressions in Dashboard, Sales, SaleDetail, Login, ProtectedRoute, or any Wave 0-3 Phase 5 unit tests).
- `npm run build` — `tsc -b` clean (no TS errors), `vite build` emits 835 kB JS / 31 kB CSS. Pre-existing chunk-size warning for Recharts is unchanged.
- `npx eslint src/pages/Trends.tsx src/App.tsx src/layouts/DashboardLayout.tsx src/tests/trends-page.test.tsx src/tests/dashboard-layout.test.tsx` — clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing dashboard-layout test expected Trends in the disabled set**
- **Found during:** Task 1 regression run.
- **Issue:** `src/tests/dashboard-layout.test.tsx`'s "renders disabled (aria-disabled) nav entries for not-yet-built phases" test hardcoded `['Trends', 'Departments', 'Team', 'Reports', 'Custom Charts']`. Once the Trends entry flipped to an active NavLink, this test failed because `closest('[aria-disabled]')` returned `null`.
- **Fix:** Dropped `'Trends'` from the `disabledLabels` list, added a comment explaining the Phase 5 plan 05-07 flip, and added a new assertion that Trends renders as a NavLink to `/trends`.
- **Files modified:** `src/tests/dashboard-layout.test.tsx`.
- **Commit:** `1732de2` (included in the GREEN commit since the regression test + the sidebar flip are a single atomic unit of "activate Trends nav").

### Test file location

Planned path was `src/pages/Trends.test.tsx` (per the PLAN frontmatter), but the repo convention is `src/tests/<kebab>.test.tsx` for page-level integration tests (precedents: `dashboard-page.test.tsx`, `sales-page.test.tsx`, `sale-detail-page.test.tsx`). Followed the repo convention: `src/tests/trends-page.test.tsx`. Documented in decisions above. This also matches the user's explicit success criterion in the executor prompt.

### No architectural deviations

No Rule 4 triggers. No new tables, services, or framework changes. No auth gates.

## Known Stubs

None. Every chart component receives live props (`range` and, for the heat map, `metric`) from local state controlled by real UI widgets. The 5 chart components render against live Supabase data via their own TanStack Query hooks (`useSalesInRange`, `useDepartmentGrid`).

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced by this plan. The `/trends` route reuses the existing `ProtectedRoute` gate (Phase 1) and the existing RLS admin-only policy on `sales` + `sale_departments` (Phase 1 + plan 02-01/02-02 migrations). STRIDE dispositions in the PLAN's `<threat_model>` are all `mitigate` or `accept`; every `mitigate` is honored:

- T-05-07-XSS — All rendered strings are hard-coded literals in `TrendsPage` and the children auto-escape via JSX.
- T-05-07-RBAC — Route wrapped by `ProtectedRoute`; data hooks inherit Phase 1 RLS.
- T-05-07-A11Y — `<h1>` + five `<h2>` landmarks preserved; `aria-current` from `NavLink` propagates to the sidebar entry.
- T-05-07-NAVSTATE — Accepted; Trends link visible to all authenticated users, data visibility gated by RLS only.
- T-05-07-DESTRUCTIVE — Accepted; read-only composition, zero mutations.

## Phase 5 Exit Status — Task 2 Checkpoint Deferred

This plan has two tasks. Task 1 (composition + routing + sidebar + integration test) is complete. **Task 2 is a `checkpoint:human-verify` that executes the 15-step browser walkthrough in PLAN lines 319-363.** Per the executor prompt ("do full docs/integration work of Task 1, then pause at checkpoint"), Task 2 is **deferred to a live operator session** and is not run in this executor invocation.

### When Task 2 is run

The operator should:
1. Start `npm run dev` on a machine with `.env.local` Supabase credentials + the 457-PDF import completed.
2. Walk through the 15 checks in `05-07-PLAN.md` § Task 2 `<how-to-verify>`.
3. Respond `approved` if all 15 pass; list failing check numbers otherwise.
4. On approval: mark TRND-01..TRND-06 + INTR-03 complete in `.planning/REQUIREMENTS.md` and update the Phase 5 row in `.planning/ROADMAP.md`.

### Current phase-requirement coverage

| Requirement | Status | Backing commits |
| ----------- | ------ | --------------- |
| TRND-01 Net revenue per sale | Implementation ready; awaiting Task 2 sign-off | Plan 05-04 + this plan |
| TRND-02 Sell-through per sale | Implementation ready; awaiting Task 2 sign-off | Plan 05-04 + this plan |
| TRND-03 Date range filter | Implementation ready; awaiting Task 2 sign-off | Plan 05-02 + this plan |
| TRND-04 Department heat map | Implementation ready; awaiting Task 2 sign-off | Plan 05-06 + this plan |
| TRND-05 Estimate accuracy over time | Implementation ready; awaiting Task 2 sign-off | Plan 05-05 + this plan |
| TRND-06 Bidder participation | Implementation ready; awaiting Task 2 sign-off | Plan 05-05 + this plan |
| INTR-03 Tooltips on hover | Implementation ready; awaiting Task 2 sign-off | Plans 05-04/05 + this plan |

## Self-Check: PASSED

Files verified present:
- FOUND: `src/pages/Trends.tsx`
- FOUND: `src/tests/trends-page.test.tsx`
- FOUND: `src/App.tsx` (contains `<Route path="/trends"`)
- FOUND: `src/layouts/DashboardLayout.tsx` (contains `to: "/trends"`)

Commits verified on branch `worktree-agent-af9a4909`:
- FOUND: `182e961` — `test(05-07): add failing integration test for Trends page composition`
- FOUND: `1732de2` — `feat(05-07): compose TrendsPage, add /trends route, activate sidebar link`
