---
phase: 06-department-analysis-sale-comparison
plan: 06
subsystem: navigation, layout-shell

tags:
  - sidebar
  - navlink
  - layout
  - intr-01
  - wave-3
  - phase-6-complete

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: src/layouts/DashboardLayout.tsx (sidebar shell with NAV_ITEMS) + src/components/ProtectedRoute.tsx
  - phase: 05-trend-analysis
    provides: Plan 05-07 precedent for flipping a disabled sidebar entry to an active NavLink
  - phase: 06-02
    provides: /departments route registration in App.tsx + DepartmentsPage component
  - phase: 06-03
    provides: Departments table/chart wiring + cross-filter interaction
  - phase: 06-04
    provides: /sales/compare route + SaleCompare page

provides:
  - Active sidebar NavLink to /departments (accent reservation #3 activated for Departments)
  - End-to-end Phase 6 navigation surface — users can now reach the Departments page from the global sidebar

affects:
  - Phase 6 delivery — every preceding plan (06-01..06-05) gains a live entry-point via the sidebar
  - Future phases 7-9 — only Team, Reports, and Custom Charts remain as disabled placeholders

# Tech tracking
tech-stack:
  added: []  # no new packages — pure NAV_ITEMS config tweak
  patterns:
    - "NAV_ITEMS declarative config — adding `to: '/departments'` to the Departments entry is sufficient; the `NAV_ITEMS.map(item => item.to ? <NavLink> : <span aria-disabled>)` branch already in DashboardLayout handles the active-link rendering automatically"
    - "Test renderLayout registers child routes for /sales, /trends, /departments so active-state className assertions work (a route must match for the parent layout Route to mount under MemoryRouter)"
    - "Plan 05-07 precedent reused verbatim — same NavLink className builder (isActive ? 'text-accent border-l-2 border-accent bg-accent/5' : 'text-gray-700 ... hover:bg-gray-100 ...'), same comment-block update pattern, same test retrofit pattern (drop label from disabledLabels array, add positive href assertion)"

key-files:
  created: []
  modified:
    - src/layouts/DashboardLayout.tsx (comment header + NAV_ITEMS Departments entry)
    - src/tests/dashboard-layout.test.tsx (3 new tests + renderLayout route additions + disabledLabels update + icon-count comment)

decisions:
  - "Test renderLayout was extended to register /trends + /departments routes. Without them, rendering the layout at those paths produced an empty body because React Router v7 requires a matching route for the parent layout Route's element to mount. This is a test-infrastructure change with no production code impact."
  - "Frontmatter key_links expected JSX form `to=\"/departments\"` but the repo's NAV_ITEMS pattern (established by Sales and Trends) expresses the route in an object literal as `to: \"/departments\"` consumed by `<NavLink to={item.to}>`. Both are semantically identical — the rendered NavLink has `href=\"/departments\"` (asserted by test) — but the literal grep count for `to=\"/departments\"` in source is 0 while `\"/departments\"` is 1. Followed the established repo convention, not the frontmatter's JSX-literal phrasing. This matches the 05-07 Trends pattern which uses the same NAV_ITEMS object form."

metrics:
  duration: ~5 min (Task 1 only; Task 2 checkpoint deferred to operator)
  completed: 2026-04-23

# Requirement traceability
requirements: [INTR-01]
---

# Phase 6 Plan 06-06: Activate Departments Sidebar NavLink Summary

Flipped the `Departments` entry in `DashboardLayout`'s `NAV_ITEMS` config from an `aria-disabled="true"` span with `· Coming soon` aside into an active `<NavLink to="/departments">` — mirroring the Plan 05-07 transition for Trends. The existing `NAV_ITEMS.map(item => item.to ? <NavLink> : <span aria-disabled>)` branch in DashboardLayout automatically picks up the new route; no JSX changes were required outside the config object. Augmented `dashboard-layout.test.tsx` with three new tests (NavLink href, accent active-state styling, no aria-disabled + no Coming soon aside) and a regression guard asserting exactly 3 "Coming soon" asides remain (Team, Reports, Custom Charts). Phase 6's user-visible navigation surface is now complete — all Phase 6 deliverables (06-01 data layer, 06-02/06-03 Departments page, 06-04 Sale Compare, 06-05 Revenue Breakdown) are reachable from the global sidebar.

## Files

### Modified
- `src/layouts/DashboardLayout.tsx` — (1) updated the top-of-file comment block to note "Departments joined in Phase 6 plan 06-06 (/departments)"; (2) changed the `NAV_ITEMS` Departments entry from `{ label: "Departments", Icon: IconBuildingLibrary }` to `{ label: "Departments", to: "/departments", Icon: IconBuildingLibrary }`; (3) updated the comment above `NAV_ITEMS` to say "Sales is active from Phase 3; Trends joined in Phase 5 (plan 05-07); Departments joined in Phase 6 (plan 06-06). Phases 7-9 activate the rest."
- `src/tests/dashboard-layout.test.tsx` — (1) expanded `renderLayout` to register child routes for `/sales`, `/trends`, `/departments`, `/`; (2) dropped `"Departments"` from the `disabledLabels` array in the "renders disabled nav entries" test, with an inline comment explaining plan 06-06's flip; (3) added 3 new tests: "renders Departments as an active NavLink to /departments", "Departments NavLink uses accent active-state styling when current route" (renderLayout('/departments')), "Departments entry is NOT aria-disabled and has no Coming soon aside"; (4) added a regression guard "exactly 3 Coming soon asides remain (Team, Reports, Custom Charts)"; (5) refreshed the icon-count test comment to reflect "3 active NavLinks Sales/Trends/Departments + 3 disabled spans Team/Reports/Custom Charts".

### Created
- None.

## Commits

| Commit | Type | Message |
| ------ | ---- | ------- |
| `0034b3e` | feat | feat(06-06): activate Departments sidebar NavLink |

## Integration Test Coverage

`src/tests/dashboard-layout.test.tsx` — 12 tests, all passing (3 new + 9 existing, with 1 existing retrofitted):

1. Sales renders as an active NavLink to /sales (existing — accent active-state assertion).
2. Disabled nav entries present for Team / Reports / Custom Charts (existing — **retrofitted** to drop Departments; now matches the pattern 05-07 established for Trends).
3. Trends renders as an active NavLink to /trends (existing — Phase 5 plan 05-07).
4. **NEW:** Departments renders as an active NavLink to /departments.
5. **NEW:** Departments NavLink uses accent active-state styling when `renderLayout('/departments')` mounts it on the current route.
6. **NEW:** Departments entry is NOT aria-disabled and the link textContent does NOT include "Coming soon".
7. **NEW (regression guard):** Exactly 3 "Coming soon" asides render — one for each of Team, Reports, Custom Charts; Departments is no longer in this set.
8. Root container has responsive sidebar grid classes (existing).
9. User-menu avatar button renders (existing — Phase 1 regression guard).
10. Nav-item labels hidden at md, visible at lg (existing).
11. Disabled nav items keep a Coming soon aside at lg (existing — still passes; assertion is `asides.length > 0`, the new T-new-3 tightens to `=== 3`).
12. Each nav item has an inline SVG icon (existing — still ≥ 6 icons; the 6 nav entries break down as 3 active NavLinks + 3 disabled spans now).

## Verification Results

- `npx vitest run src/tests/dashboard-layout.test.tsx --reporter=dot` — **12/12 pass**.
- `npx vitest run` (full suite) — **644/644 pass across 68 test files**. No regressions in any Phase 1-6 tests.
- `npx tsc --noEmit` — clean (exit code 0).
- `grep -c '"/departments"' src/layouts/DashboardLayout.tsx` — returns `1` (the NAV_ITEMS object literal).
- `grep -o "Coming soon" src/layouts/DashboardLayout.tsx | wc -l` — returns `3` (Team, Reports, Custom Charts — NOT Departments).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] renderLayout in test harness needed /departments + /trends routes registered**
- **Found during:** Task 1 automated verification (the new "Departments NavLink uses accent active-state styling" test failed with "no accessible roles; body is empty" because `renderLayout('/departments')` produced no route match, which caused React Router v7 to not mount the parent layout Route's `element={<DashboardLayout />}` at all).
- **Issue:** Under React Router v7 + `MemoryRouter`, the parent Route's `element` is only rendered when a matching child route exists for the current URL. The existing harness only registered `/sales` and `/`, so rendering at `/trends` or `/departments` mounted nothing.
- **Fix:** Added `<Route path="/trends" element={<div>Trends Content</div>} />` and `<Route path="/departments" element={<div>Departments Content</div>} />` to `renderLayout`'s inner `<Routes>`. No production-code effect — these are test-only fixtures.
- **Files modified:** `src/tests/dashboard-layout.test.tsx`.
- **Commit:** `0034b3e` (included atomically with the feature change).

### Grep literal pattern interpretation

The plan frontmatter's `key_links.pattern` expected the literal `to="/departments"` (JSX attribute form). The repo convention established by Plan 05-07 for Trends expresses the route in the `NAV_ITEMS` object literal as `to: "/departments"` consumed by `<NavLink to={item.to}>`. Both render the same `href="/departments"` anchor — the functional test asserts `toHaveAttribute('href', '/departments')` which passes. Followed the established repo convention. This matches the pattern used for every active NavLink in the sidebar (Sales, Trends).

### Pre-plan state vs. aria-disabled count

The plan's verification clause `grep -c 'aria-disabled="true"' src/layouts/DashboardLayout.tsx decreases by 1 compared to pre-plan state (one less disabled span)` was written under the assumption that each disabled entry is a separate JSX element in source. The actual implementation uses a single JSX template inside `NAV_ITEMS.map(item => item.to ? ... : <span aria-disabled="true">...)` — the count in source is 1 pre-plan and 1 post-plan. Runtime renders 4 pre-plan → 3 post-plan disabled spans, which is what the test at-rest assertion "exactly 3 Coming soon asides" verifies. No action needed.

### No architectural deviations

No Rule 4 triggers. No new routes, components, services, or framework changes. No auth gates.

## Phase 6 Exit Status — Task 2 Checkpoint Deferred

This plan has two tasks. Task 1 (flip + test augmentation) is complete and committed. **Task 2 is a `checkpoint:human-verify` that executes the 7-flow browser walkthrough in PLAN lines 145-191.** Per parallel-executor conventions (the operator performs browser smoke checks in a live session, not inside a headless agent invocation), Task 2 is **deferred to the operator**.

### When Task 2 is run

The operator should:
1. Start `npm run dev` in the project root with `.env.local` Supabase credentials + the 457-PDF import completed.
2. Walk through the 7 flows in `06-06-PLAN.md` Task 2 `<how-to-verify>`:
   - Flow 1: Sidebar navigation (click Departments → /departments).
   - Flow 2: /departments page — table + metric toggle + date filter + chip bar + line chart + stacked bar chart + cross-filter dimming + max-8 status.
   - Flow 3: /sales selection flow — checkboxes + sticky footer + max-4 + Compare button.
   - Flow 4: /sales/compare — heading, metric-group rows, delta color-coding, pp suffix for sell-through.
   - Flow 5: Invalid URL handling (`/sales/compare?sales=only-one`, no params, malformed).
   - Flow 6: Revenue Breakdown waterfall on Sale Detail — chevron toggle, 7-bar order, tooltip signs, per-sale collapse state.
   - Flow 7: Cross-regression — Trends still loads, Sales still works, auth still gates.
3. Respond `approved` if all 7 pass; list failing flow numbers otherwise.
4. On approval: mark `INTR-01` complete in `.planning/REQUIREMENTS.md` and update the Phase 6 row in `.planning/ROADMAP.md` (phase status → complete).

### Phase 6 requirement coverage

| Requirement | Source | Backing plan(s) | Status |
| ----------- | ------ | --------------- | ------ |
| DEPT-01 Department rankings table | /departments page | Plan 06-02 (rankings table + hook) | Implementation complete; UAT pending |
| DEPT-02 Department revenue over time (line chart) | /departments page | Plan 06-03 (line chart + chip bar) | Implementation complete; UAT pending |
| DEPT-03 Department share of sale (stacked bar) | /departments page | Plan 06-03 (stacked bar chart) | Implementation complete; UAT pending |
| SALE-04 Sale selection + Compare flow | /sales + sticky footer | Plan 06-04 (SaleSelectionFooter + /sales/compare route) | Implementation complete; UAT pending |
| SALE-05 Sale comparison table | /sales/compare | Plan 06-04 (ComparisonTable + useSalesComparison) | Implementation complete; UAT pending |
| SALE-06 Revenue breakdown (waterfall) | /sales/:saleNumber | Plan 06-05 (RevenueWaterfallChart + collapsible section) | Implementation complete; UAT pending |
| INTR-01 Cross-filter dim-non-matching | /departments page | Plan 06-03 (selectedDept threading) + **this plan** (sidebar activation unlocks the surface) | Implementation complete; UAT pending |

Every Phase 6 requirement now has a complete implementation path. Task 2 browser walkthrough is the only gate before Phase 6 is closed.

## Known Stubs

None. The NavLink is wired to a live route (`/departments`) backed by a fully functional `DepartmentsPage` (Plan 06-02 + 06-03). No placeholder text, no mock data, no deferred wiring.

## Threat Flags

None. Confirmed alignment with plan's `<threat_model>`:
- **T-06-06-01 (Info Disclosure):** The NavLink lives inside `DashboardLayout`, which only mounts under `<ProtectedRoute>` (verified by inspection of `src/App.tsx` — the entire `<Route element={<DashboardLayout />}>` block is wrapped in `<ProtectedRoute>`). Unauthenticated users never reach the sidebar. No new authorization surface.
- **T-06-06-02 (Tampering):** `to="/departments"` is a hardcoded string literal in the `NAV_ITEMS` array — no user input, no concatenation.
- **T-06-06-03 (Accessibility):** React Router v7's `<NavLink>` renders an `<a>` tag (keyboard-accessible) and automatically sets `aria-current="page"` on the active link (verified indirectly — the existing Sales/Trends NavLinks inherit this). Active-state visual indicator (border-l-2 border-accent + text-accent) reuses the accent reservation #3 convention established in Phase 1 UI-SPEC.

## Self-Check: PASSED

Files verified present (in worktree):
- FOUND: `src/layouts/DashboardLayout.tsx` (contains `to: "/departments"` at NAV_ITEMS[2])
- FOUND: `src/tests/dashboard-layout.test.tsx` (contains 3 new Departments tests + updated disabledLabels)

Commits verified on branch `worktree-agent-aebbada6`:
- FOUND: `0034b3e` — `feat(06-06): activate Departments sidebar NavLink`

Verification assertions:
- `npx vitest run src/tests/dashboard-layout.test.tsx` → 12/12 pass
- `npx vitest run` (full suite) → 644/644 pass, 68 files
- `npx tsc --noEmit` → exit 0
- `grep -c '"/departments"' src/layouts/DashboardLayout.tsx` → 1
- `grep -o "Coming soon" src/layouts/DashboardLayout.tsx | wc -l` → 3
