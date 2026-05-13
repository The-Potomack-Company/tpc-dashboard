---
phase: 03-tpc-app-activity-activity
plan: 08
subsystem: ui
tags: [react, react-router, tanstack-query, vitest, page-shell, routing, navigation, tdd]

# Dependency graph
requires:
  - phase: 03-tpc-app-activity-activity
    provides: 11 admin/dev components (Plans 03-04..03-07) + filter primitives (Plan 03-06) + hooks (Plan 03-03) + service queries (Plan 03-02) + RPCs (Plan 03-01)
  - phase: 02-extension-analytics-extension
    provides: page-shell pattern (Extension.tsx), DashboardLayout NAV_ITEMS structure
  - phase: 01-foundation
    provides: ProtectedRoute, BackLink, EmptyState, ErrorState, useTimezone, DateRangeFilter
provides:
  - "/activity main admin surface (8-card composition + filter row + dev panel)"
  - "/activity/sessions/:id detail page (metadata card + photo coverage + item list)"
  - "/activity/stuck dedicated triage page"
  - "DashboardLayout NAV_ITEMS Activity entry (D-03 nested-route active state)"
  - "App.tsx routes for all 3 new paths inside ProtectedRoute > DashboardLayout"
affects: [phase-03-09-smoke-test, future-activity-feature-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page shell = thin composition layer — no business logic, just imports + composition + URL state + document.title"
    - "TDD red/green per file: failing test commit → implementation commit"
    - "Pre-formatted ET timestamps passed from page → presentation component (SessionMetadataCard stays free of timezone concern per Plan 03-06)"
    - "BackLink params handling — D-03 (preserve search) vs D-23 (drop search) is encoded at page level via useLocation().search"
    - "NavLink active-state for nested routes: omit `end` prop so /activity/sessions/:id and /activity/stuck inherit the active highlight"

key-files:
  created:
    - "src/pages/Activity.tsx — /activity admin surface; 8-card composition per D-01"
    - "src/pages/Activity.test.tsx — 7 tests covering D-01 order, D-37 no-empty-gate, document.title, semantic outer"
    - "src/pages/SessionDetail.tsx — /activity/sessions/:id detail; pre-formats ET timestamps; D-03/D-04 layout"
    - "src/pages/SessionDetail.test.tsx — 11 tests covering :id flow, BackLink param preservation, loading/error/not-found, ET formatting"
    - "src/pages/StuckItems.tsx — /activity/stuck triage; no filter row; D-23 BackLink drops params"
    - "src/pages/StuckItems.test.tsx — 7 tests covering D-23 invariant + composition shape"
    - "src/layouts/DashboardLayout.test.tsx — 9 tests covering NAV_ITEMS export shape + D-03 nested active-state across 5 routes"
  modified:
    - "src/App.tsx — added 3 routes (/activity, /activity/sessions/:id, /activity/stuck) inside existing ProtectedRoute > DashboardLayout group; existing routes survive verbatim"
    - "src/layouts/DashboardLayout.tsx — exported NAV_ITEMS; appended Activity entry after Extension with Heroicons clipboard-document-list icon; D-03 honored via no-`end` NavLink"

key-decisions:
  - "ET timestamp formatting at page level — Plan 03-06's SessionMetadataCard is pure presentation (props-in, JSX-out); page wraps `query.data.created_at`/`updated_at` with `useTimezone().formatDateTime(new Date(...))` and passes formatted strings into the card. Avoids leaking timezone concern into a presentation component."
  - "BackLink param contract codified at page level: SessionDetail reads useLocation().search and prepends to /activity (D-03); StuckItems uses literal '/activity' regardless of current URL (D-23)."
  - "NavLink for /activity rendered without the `end` prop — react-router 7 default starts-with matching covers /activity/sessions/:id and /activity/stuck without a custom isActive callback."
  - "DeveloperPanel mounted unconditionally on ActivityPage (mirrors Phase 2) — internal `isDevAccount` self-gates per D-26."
  - "No full-page loading/empty gate on /activity (D-37 divergence from Phase 2 D-19) — every section owns its per-card states. Phase 2's full-page empty branch made sense because extension events are net-new; Phase 3's tables are populated from day one of TPC App use, so an empty page would mask a real anomaly."

patterns-established:
  - "Activity-page composition order is locked by D-01: TodayKpiStrip → ActiveSessionsTable → StuckItemsAlertCard → ItemsPerSpecialistChart → (AiStatusDonut + HouseSaleSplit paired) → ExportPipelineChart → DeveloperPanel"
  - "Route-level test pattern for nested routes: render `<MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={children} />` to make :id available via useParams()"
  - "DashboardLayout test pattern: stub authStore via `vi.mock('../stores/authStore')` and use a selector-aware factory so layout's useAuthStore(s => s.profile) calls work"

requirements-completed: [APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-07, APP-08, APP-09, APP-10, APP-11, APP-12]

# Metrics
duration: ~7 min
completed: 2026-05-01
---

# Phase 3 Plan 08: Page Composition + Routing Summary

**Three Phase 3 page shells (`/activity`, `/activity/sessions/:id`, `/activity/stuck`) wired through `App.tsx` and `DashboardLayout.tsx`, plus a colocated `DashboardLayout.test.tsx` locking the D-03 nested-route active-state invariant**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-01T21:19:00Z (approx)
- **Completed:** 2026-05-01T21:26:32Z
- **Tasks:** 3 (all type=auto, all tdd=true)
- **Files modified:** 9 (7 created + 2 modified)

## Accomplishments

- `/activity` page composes 11 admin components in D-01 locked order with the filter row (DateRangeFilter + SpecialistMultiSelect + ModeToggle) and unconditionally mounted DeveloperPanel
- `/activity/sessions/:id` page reads `useParams<{id}>()`, calls `useSessionDetail(id)`, pre-formats ET timestamps, and preserves `?range=`/`?specialists=`/`?mode=` URL params on the back link (D-03)
- `/activity/stuck` page renders a single `<StuckItemsTable>` below a header; back link to plain `/activity` (D-23 — own context)
- All 3 routes wired into `App.tsx` inside the existing `ProtectedRoute > DashboardLayout` group; `/login`, `/`, `/extension`, `/kit` (DEV), and `*` survive verbatim
- DashboardLayout NAV_ITEMS appended with Activity entry after Extension; NavLink rendered without `end` prop so `/activity/sessions/:id` and `/activity/stuck` keep Activity highlighted (D-03)
- `DashboardLayout.test.tsx` created — locks D-03 invariant across 5 route shapes (`/activity`, nested session, nested stuck, sibling Extension, root home)

## Task Commits

Each task followed the TDD red/green cycle with two commits per task:

1. **Task 1 (RED): Activity page composition test** — `feb6a01` (test)
2. **Task 1 (GREEN): Activity page shell** — `486f175` (feat)
3. **Task 2 (RED): SessionDetail + StuckItems failing tests** — `c074686` (test)
4. **Task 2 (GREEN): SessionDetail + StuckItems page shells** — `91a7eab` (feat)
5. **Task 3 (RED): DashboardLayout NAV_ITEMS + D-03 active-state failing tests** — `fcf707d` (test)
6. **Task 3 (GREEN): App.tsx routes + DashboardLayout NAV_ITEMS Activity entry** — `ccf2873` (feat)

## Verification Results

- **Page tests:** `Activity.test.tsx` (7), `SessionDetail.test.tsx` (11), `StuckItems.test.tsx` (7), `DashboardLayout.test.tsx` (9) — **34 new tests, all green**
- **Full test suite:** `npm run test` → 71 files / **582 tests passed** (no regressions)
- **Type check:** `npx tsc -b` exits 0
- **Prebuild verifiers (11):** all green
  - check-no-service-role-in-src
  - verify-extension-app-source-scope
  - verify-activity-rpc-shape (13 RPCs verified)
  - verify-activity-app-source-scope
  - verify-activity-bucket-tz
  - verify-activity-stuck-threshold-hardcoded
  - verify-activity-mode-filter-on-sessions
  - verify-activity-table-readonly
  - verify-activity-photos-ttl
  - verify-activity-filter-scope (16 hook files OK)
  - verify-activity-error-state-contract (24 files OK)
- **Production build:** `npm run build` succeeds (5.58s, 1201 modules transformed, 875 KB main chunk)

## Files Created/Modified

### Created (7 files)

- `src/pages/Activity.tsx` — `/activity` admin surface; 8-card composition per D-01; mounts DeveloperPanel unconditionally; sets `document.title = 'Activity — TPC Dashboard'` with cleanup; uses `<main>` semantic outer; no full-page empty gate (D-37)
- `src/pages/Activity.test.tsx` — 7 tests: heading/subtitle copy, filter-row order, D-01 section order, DeveloperPanel mount, document.title swap + cleanup, D-37 no-empty-gate, `<main>` outer
- `src/pages/SessionDetail.tsx` — `/activity/sessions/:id` shell; reads `:id` via `useParams`, calls `useSessionDetail(id)`; D-03 preserved-params back link via `useLocation().search`; D-04 grid layout (metadata `xl:col-span-2` + photo coverage `xl:col-span-1` + full-width items below); pre-formats `created_at`/`updated_at` with `useTimezone().formatDateTime(new Date(...))`; loading/error/not-found branches
- `src/pages/SessionDetail.test.tsx` — 11 tests: `:id` flow, BackLink preserved + dropped params, heading/breadcrumb/subtitle, document.title swap (loading + loaded + cleanup), composition + sessionId prop wiring, EmptyState on null, ErrorState retry button, ET-formatted timestamps reach SessionMetadataCard, loading skeleton
- `src/pages/StuckItems.tsx` — `/activity/stuck` triage shell; no filter row; back link to plain `/activity` (D-23 — own context); breadcrumb `Activity › Stuck items`; mounts a single `<StuckItemsTable>`; sets `document.title = 'Stuck items — TPC Dashboard'`
- `src/pages/StuckItems.test.tsx` — 7 tests: heading/subtitle copy, D-23 BackLink drops params, document.title swap + cleanup, single StuckItemsTable composition + `<main>` outer, no inheritance of `?specialists=`/`?mode=`, no filter row mounted, breadcrumb
- `src/layouts/DashboardLayout.test.tsx` — 9 tests across 2 describe blocks: NAV_ITEMS shape (Array, Activity entry shape, Extension survives, Activity index > Extension index) + Active-state highlighting at `/activity`, `/activity/sessions/:id`, `/activity/stuck`, `/extension`, `/`

### Modified (2 files)

- `src/App.tsx` — added 3 `<Route>` entries inside the existing `<Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}>` group: `/activity`, `/activity/sessions/:id`, `/activity/stuck`; existing routes (`/login`, `/`, `/extension`, `/kit` DEV-only, `*` wildcard) survive verbatim
- `src/layouts/DashboardLayout.tsx` — exported `NAV_ITEMS` array (was previously module-private); appended Activity entry after Extension with Heroicons `clipboard-document-list` outline icon; explanatory comment added above the array referencing D-03 and the `end`-prop convention

## Decisions Made

- **ET timestamp formatting at page level (not in `SessionMetadataCard`).** Plan 03-06 marked the card as pure presentation. The page wraps the raw ISO timestamp with `useTimezone().formatDateTime(new Date(query.data.created_at))` and spreads formatted strings into the card via `{...query.data, created_at: ..., updated_at: ...}`. SessionDetailRow's `created_at`/`updated_at` are typed `string` (ISO from PostgreSQL), so `new Date(...)` is required to satisfy `formatDateTime`'s `Date` parameter type.
- **BackLink to use `useLocation().search` directly (no parsing).** D-03 says preserve URL filter state on navigate-back from SessionDetail. The simplest correct implementation reads `location.search` (which already includes the leading `?` when params exist, falsy otherwise) and concatenates: `location.search ? '/activity' + location.search : '/activity'`. No URLSearchParams round-trip needed.
- **Activity NavLink rendered without `end` prop.** react-router 7's default behavior matches descendants — so `/activity/sessions/:id` and `/activity/stuck` inherit the active state on the `/activity` NavLink. Verified by 3 of the 9 DashboardLayout tests. No custom `isActive` callback required.
- **Default sort + filter row decisions inherited from underlying components.** Activity page does not override anything — `<TodayKpiStrip>` uses today/yesterday, `<ActiveSessionsTable>` uses age desc, `<StuckItemsTable>` uses age desc. Page is pure composition.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` sections provided complete code; minor adjustments:

1. **`(d: Date) => string` type signature on `formatDateTime`** — the plan's pseudocode passed `query.data.created_at` directly, but the type system requires `new Date(...)` because the DB returns ISO strings while `useTimezone` types its API around `Date` objects. This is a faithful interpretation, not a deviation — the same `new Date()` wrapping pattern appears elsewhere in the codebase (`ActiveSessionsTable.tsx`, `StuckItemsTable.tsx`).
2. **ErrorState test query selector** — initially used `getByRole('alert', { name: ... })` but the matcher pattern requires the `name` to be the accessible name; switched to `getByRole('alert')` + `textContent` regex, matching how the real ErrorState renders a heading-as-alert. Cleaner and more resilient. (RED → fix test → GREEN; no implementation change.)

**Total deviations:** 0 (none — minor test/typing refinements only)
**Impact on plan:** None.

## Issues Encountered

None.

## NavLink `end` prop note

The plan asked to verify whether `/activity` matches nested routes by default in react-router 7. **Confirmed:** `<NavLink to="/activity">` without the `end` prop matches `/activity`, `/activity/sessions/abc-123`, and `/activity/stuck` — the default matching is "starts-with" (path prefix). The `end` prop forces exact-match. The `DashboardLayout.test.tsx` tests explicitly assert this across all three URL shapes.

## `:id` URL Param Confirmation

`SessionDetail.tsx` reads `const { id } = useParams<{ id: string }>()` and the value flows to `useSessionDetail(id)` (Plan 03-03 hook). The hook's `enabled: !!sessionId` short-circuits the query when `id` is undefined (e.g. during route transition). The test `Test 1: reads :id param and calls useSessionDetail with that id` verifies this flow — `sessionDetailMock.toHaveBeenCalledWith('abc-123')` after rendering at `/activity/sessions/abc-123`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **Plan 03-09** (smoke test plan): all 3 routes resolve correctly, DashboardLayout active state honored, `npm run build` succeeds end-to-end. Phase 3 page surface is complete; the only remaining work is the comprehensive smoke test that exercises the real children + real router + real QueryClient against a mocked Supabase boundary.
- Manual smoke check via `npm run dev` not performed (executor agents do not run dev servers); the Plan 03-09 smoke test will provide the integration verification.

## Self-Check: PASSED

**Files verified to exist:**
- `src/pages/Activity.tsx` — FOUND
- `src/pages/Activity.test.tsx` — FOUND
- `src/pages/SessionDetail.tsx` — FOUND
- `src/pages/SessionDetail.test.tsx` — FOUND
- `src/pages/StuckItems.tsx` — FOUND
- `src/pages/StuckItems.test.tsx` — FOUND
- `src/layouts/DashboardLayout.test.tsx` — FOUND
- `src/App.tsx` — FOUND (modified)
- `src/layouts/DashboardLayout.tsx` — FOUND (modified)

**Commits verified:**
- `feb6a01` — FOUND (test: failing Activity test)
- `486f175` — FOUND (feat: Activity page)
- `c074686` — FOUND (test: failing SessionDetail + StuckItems tests)
- `91a7eab` — FOUND (feat: SessionDetail + StuckItems pages)
- `fcf707d` — FOUND (test: failing DashboardLayout tests)
- `ccf2873` — FOUND (feat: App.tsx routes + DashboardLayout NAV_ITEMS)

---
*Phase: 03-tpc-app-activity-activity*
*Completed: 2026-05-01*
