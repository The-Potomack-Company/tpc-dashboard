---
phase: 03
status: human_needed
score: 5/5 ROADMAP success criteria verified programmatically
verified: 2026-05-01T21:55:00Z
test_count: 598
test_files: 74
new_smoke_tests: 16
prebuild_verifiers: 11
build_status: passed
dist_clean_of_service_role: true
---

# Phase 3: TPC App Activity (`/activity`) — Verification Report

**Phase Goal:** Admin can open `/activity` and see who on the TPC team is cataloging what — today's numbers, active sessions, items per specialist, AI-status health, export pipeline, photo coverage, house-vs-sale split, and stuck-item alerts — with specialist / mode / date-range filters and a session-detail drilldown.

**Verified:** 2026-05-01T21:55:00Z
**Status:** `human_needed` — all 5 ROADMAP success criteria are programmatically verified; 7 manual UAT items remain pending in `03-09-HUMAN-UAT.md` (including the load-bearing 2-hour tab-resume photo refresh test for Success Criterion #5).

---

## Programmatic verification

| Gate | Command | Status |
|------|---------|--------|
| Full test suite | `npm run test` | PASS — 598/598 across 74 files |
| Static verifier 1 — service-role key not in src/ | `node scripts/check-no-service-role-in-src.mjs` | PASS — `OK: No references to 'SUPABASE_SERVICE_ROLE_KEY' in src/, index.html, or vite.config.ts.` |
| Static verifier 2 — Phase 2 extension RPC scope | `node scripts/verify-extension-app-source-scope.mjs` | PASS — `OK — 6 RPCs, all invariants satisfied.` |
| Static verifier 3 — Phase 3 activity RPC shape | `node scripts/verify-activity-rpc-shape.mjs` | PASS — `OK — 13 RPCs, all security invoker, all granted to authenticated.` |
| Static verifier 4 — activity ui_interactions app_source (D-33) | `node scripts/verify-activity-app-source-scope.mjs` | PASS — `OK — 3 app_source filters, 3 ui_interactions RPCs verified.` |
| Static verifier 5 — activity ET bucketing (D-30) | `node scripts/verify-activity-bucket-tz.mjs` | PASS — `OK — 7 3-arg date_trunc calls, no AT TIME ZONE / 2-arg leaks.` |
| Static verifier 6 — stuck threshold hard-coded (D-24) | `node scripts/verify-activity-stuck-threshold-hardcoded.mjs` | PASS — `OK — get_stuck_items hard-codes interval '2 hours' and signature has no threshold parameter.` |
| Static verifier 7 — mode filter on sessions (D-20) | `node scripts/verify-activity-mode-filter-on-sessions.mjs` | PASS — `OK — 11 canonical "sessions.mode = p_mode" filters, no items.mode leaks.` |
| Static verifier 8 — table-readonly (Phase Boundary) | `node scripts/verify-activity-table-readonly.mjs` | PASS — `OK — no INSERT/UPDATE/DELETE/ALTER/TRUNCATE/DROP/policy ops against any TPC App table (6 checked).` |
| Static verifier 9 — photos TTL (D-08 + D-11) | `node scripts/verify-activity-photos-ttl.mjs` | PASS — `OK — useSignedPhotoUrl D-08 + D-11 invariants present (TTL=3600s, refetchOnWindowFocus=true, staleTime=50min, gcTime=10min, retry=1).` |
| Static verifier 10 — filter scope JSDoc (D-14..D-21) | `node scripts/verify-activity-filter-scope.mjs` | PASS — `OK — 16 hook file(s) scanned; every file carries @filterScope JSDoc tag.` |
| Static verifier 11 — ErrorState contract (D-35) | `node scripts/verify-activity-error-state-contract.mjs` | PASS — `OK — 24 files scanned; every <ErrorState> has heading + body + onRetry; no sibling Retry siblings detected.` |
| TypeScript check | `tsc -b` (inside `npm run build`) | PASS — clean, no diagnostics |
| Production build | `npm run build` | PASS — `dist/index.html` (0.47 kB), `dist/assets/index-l-edLrDN.js` (875.45 kB / 253.04 kB gzip), `dist/assets/index-DfcV6PEA.css` (43.94 kB / 8.36 kB gzip); built in 11.54s |
| Production bundle clean of service-role key (INFR-06) | `grep -rl 'SUPABASE_SERVICE_ROLE_KEY' dist/` | PASS — exit code 1 (no matches across `dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`) |

All 11 prebuild verifiers green. Production bundle does NOT contain any occurrence of the service-role env-var name.

---

## ROADMAP § Phase 3 Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Today KPI strip + Active Sessions table | VERIFIED | `src/components/activity/TodayKpiStrip.tsx` (testid `app-01-card`) + `src/components/activity/ActiveSessionsTable.tsx` (testid `app-02-card`); SQL: `get_today_kpis` + `get_active_sessions` RPCs in `supabase/migrations/20260430120000_create_activity_rpcs.sql`; smoke `Activity.smoke.test.tsx` Test 2 confirms both testids present. |
| 2 | Filter URL state (range + specialists + mode) updates every chart/table | VERIFIED | `useDateRange` (Phase 1) + `useSpecialistFilter` + `useModeFilter` (Plan 03-02) all use `useSearchParams`; chart hooks fold sorted filters into queryKey; smoke `Activity.smoke.test.tsx` Test 17 proves 3-key URL coexistence (range=30d + specialists + mode all preserved across changes); D-21 default = 7d + mode=all carryover. |
| 3 | Charts (14d stacked / AI status donut / Export Pipeline / House-vs-Sale) + Stuck Items alert | VERIFIED | `ItemsPerSpecialistChart` (APP-03) + `AiStatusDonut` (APP-04) + `ExportPipelineChart` (APP-05) + `HouseSaleSplit` (APP-12) + `StuckItemsAlertCard` (APP-11) all render in D-01 order; smoke Test 2 confirms testids `app-03-card` / `app-04-card` / `app-05-card` / `app-11-card` / `app-12-card`; D-22 severity classification covered by `src/lib/severity.test.ts`. |
| 4 | Session Detail (route, metadata + items list, read-only) | VERIFIED | `src/pages/SessionDetail.tsx` (D-02 nested route `/activity/sessions/:id`); `SessionMetadataCard` + `SessionItemList` (TanStack Table v8); read-only enforced by static verifier 8 (`verify-activity-table-readonly.mjs`); smoke `SessionDetail.smoke.test.tsx` Tests 6/7 confirm metadata + items list render and BackLink preserves URL params. |
| 5 | Photo Coverage panel + signed-URL strategy (lazy + 2h tab-resume) | VERIFIED PROGRAMMATICALLY / PENDING (operator 2h tab-resume) | `PhotoCoveragePanel` (APP-10) + `useSignedPhotoUrl` (D-08/D-09/D-10/D-11) + `ThumbnailTile` (D-12/D-13); smoke Tests 8/9/10 prove D-09 lazy fetch (zero `createSignedUrl` on mount, ≥1 after row expansion), D-12 thumbnail-only, D-13 failed-photo no-fetch; static verifier 9 enforces TTL=3600s + refetchOnWindowFocus + staleTime=50min + retry=1. The 2-hour tab-resume gate (LOAD-BEARING) requires manual UAT — Test 6 in `03-09-HUMAN-UAT.md`. |

**Score:** 5/5 truths verified programmatically. 1 truth (#5) has a human-needed component (the 2-hour tab-resume).

---

## Requirements coverage (APP-01..12)

| ID | Description (truncated) | Plans | Test files | Status |
|----|------------------------|-------|------------|--------|
| APP-01 | Today KPI strip (sessions / items / exports / % AI done + delta) | 03-01 (RPC) + 03-03 (hook) + 03-04 (component) | `TodayKpiStrip.test.tsx` + `Activity.smoke.test.tsx` | SATISFIED |
| APP-02 | Active sessions table (sortable by age + specialist) | 03-01 + 03-03 + 03-04 | `ActiveSessionsTable.test.tsx` + `Activity.smoke.test.tsx` | SATISFIED |
| APP-03 | 14-day stacked bar (items per specialist) | 03-01 + 03-03 + 03-05 | `ItemsPerSpecialistChart.test.tsx` + `Activity.smoke.test.tsx` | SATISFIED |
| APP-04 | AI status donut (5 slices, failed pulled out) | 03-01 + 03-03 + 03-05 | `AiStatusDonut.test.tsx` + `Activity.smoke.test.tsx` | SATISFIED |
| APP-05 | Export pipeline horizontal stacked bar | 03-01 + 03-03 + 03-05 | `ExportPipelineChart.test.tsx` + `Activity.smoke.test.tsx` | SATISFIED |
| APP-06 | Session Detail with metadata + items list (read-only) | 03-01 + 03-03 + 03-06 + 03-08 | `SessionItemList.test.tsx` + `SessionMetadataCard.test.tsx` + `SessionDetail.smoke.test.tsx` | SATISFIED |
| APP-07 | Date range filter; URL state | 03-08 (consumes Phase 1 `<DateRangeFilter>` + `useDateRange`) | `Activity.smoke.test.tsx` Test 17 | SATISFIED |
| APP-08 | Specialist multi-select | 03-02 + 03-03 + 03-06 | `SpecialistMultiSelect.test.tsx` + `useActiveSpecialists.test.tsx` + `Activity.smoke.test.tsx` Test 17 | SATISFIED |
| APP-09 | Mode filter (house / sale / all) | 03-02 + 03-06 | `ModeToggle.test.tsx` + `useModeFilter.test.tsx` | SATISFIED |
| APP-10 | Photo coverage panel (numeric + failed callout) | 03-01 + 03-03 + 03-06 | `PhotoCoveragePanel.test.tsx` + `SessionDetail.smoke.test.tsx` | SATISFIED |
| APP-11 | Stuck items alert + dedicated `/activity/stuck` page | 03-01 + 03-03 + 03-04 + 03-06 + 03-08 | `StuckItemsAlertCard.test.tsx` + `StuckItemsTable.test.tsx` + `severity.test.ts` + `StuckItems.smoke.test.tsx` | SATISFIED |
| APP-12 | House-vs-Sale split | 03-01 + 03-03 + 03-05 | `HouseSaleSplit.test.tsx` + `Activity.smoke.test.tsx` | SATISFIED |

All 12 APP requirements SATISFIED at the programmatic level. No orphaned requirements.

---

## CONTEXT decision coverage (D-01..D-37)

Every CONTEXT decision is referenced by at least one plan in the phase. Source: 03-01 through 03-09 plan/summary documents.

| Decision | Plans referencing | Source of truth | Status |
|----------|-------------------|-----------------|--------|
| D-01 page composition (D-01 layout order) | 03-08 | `src/pages/Activity.tsx` D-01 comment | REFERENCED |
| D-02 SessionDetail dedicated route | 03-08 | `src/pages/SessionDetail.tsx` + `src/App.tsx` route | REFERENCED |
| D-03 nested filter preservation | 03-08 + 03-09 | BackLink `to={location.search ? ...}`; smoke Test 7 | REFERENCED |
| D-04 SessionDetail layout (metadata + coverage + items) | 03-08 | `src/pages/SessionDetail.tsx` xl:col-span layout | REFERENCED |
| D-05 TanStack Table v8 | 03-06 | `src/components/activity/SessionItemList.tsx` + `StuckItemsTable.tsx` | REFERENCED |
| D-06 row expansion (lazy disclosure) | 03-06 + 03-09 | `SessionItemList.tsx` getExpandedRowModel; smoke Test 9 | REFERENCED |
| D-07 dedicated `/activity/stuck` route | 03-08 | `src/pages/StuckItems.tsx` + `src/App.tsx` route | REFERENCED |
| D-08 refetch on focus (signed URLs) | 03-02 | `src/hooks/useSignedPhotoUrl.ts` + verifier 9 | REFERENCED |
| D-09 lazy fetch | 03-06 + 03-09 | `SessionItemDisclosure.tsx` mount-on-expand; smoke Tests 8/9 | REFERENCED |
| D-10 useSignedPhotoUrl location | 03-02 | `src/hooks/useSignedPhotoUrl.ts` (shared, NOT under hooks/activity/) | REFERENCED |
| D-11 cache parameters (TTL/staleTime/gcTime) | 03-02 | `useSignedPhotoUrl` constants + verifier 9 | REFERENCED |
| D-12 thumbnail_path only | 03-06 + 03-09 | `ThumbnailTile.tsx` passes `thumbnail_path`; smoke Test 9 | REFERENCED |
| D-13 failed photos no-fetch | 03-02 + 03-06 + 03-09 | `ThumbnailTile.tsx` `enabled: !isFailed`; smoke Test 10 | REFERENCED |
| D-14 today rule (right-now) | 03-01 + 03-04 | `get_today_kpis` RPC + `useTodayKpis` filterScope JSDoc | REFERENCED |
| D-15 active sessions rule (right-now) | 03-01 + 03-04 | `get_active_sessions` RPC body | REFERENCED |
| D-16 14-day fixed-window | 03-01 + 03-03 + 03-05 | `get_items_per_specialist_14d` RPC body | REFERENCED |
| D-17 range-driven trio (donut + export + house-sale) | 03-01 + 03-03 + 03-05 | RPC bodies; range-driven hook JSDoc tags | REFERENCED |
| D-18 stuck rule (>2h) | 03-01 + 03-04 | `get_stuck_items` RPC + verifier 6 | REFERENCED |
| D-19 specialist source (active + role=specialist) | 03-01 + 03-03 + 03-06 | `fetchActiveSpecialists` builder + `useActiveSpecialists` | REFERENCED |
| D-20 mode on sessions (NEVER items.mode) | 03-01 (verifier 7) | `get_*` RPC bodies + verifier 7 | REFERENCED |
| D-21 default range (7d) | 03-02 | `useDateRange` + `useModeFilter` defaults | REFERENCED |
| D-22 severity tone (yellow/red) | 03-02 + 03-04 | `src/lib/severity.ts` + `StuckItemsAlertCard.tsx` | REFERENCED |
| D-23 stuck independent context | 03-08 + 03-09 | `src/pages/StuckItems.tsx` no filter row; smoke Test 14/15 | REFERENCED |
| D-24 stuck threshold hard-coded | 03-01 (verifier 6) | `get_stuck_items` RPC + verifier 6 | REFERENCED |
| D-25 staleTime defaults | 03-03 | `src/main.tsx` QueryClient + activity hook overrides | REFERENCED |
| D-26 isDevAccount gate (render-conditional) | 03-07 + 03-09 | `DeveloperPanel.tsx` `if (!isDevAccount(email)) return null`; smoke Tests 3/4 | REFERENCED |
| D-27 admin surface | 03-04 + 03-05 + 03-06 + 03-08 | All `app-XX-card` testid components | REFERENCED |
| D-28 dev surface | 03-06 + 03-07 | `RawItemInspector` + `FailedAiBreakdown` + `UiInteractionsPanel` | REFERENCED |
| D-29 Failed-AI Breakdown | 03-01 + 03-03 + 03-07 | `FailedAiBreakdown.tsx` + `get_failed_ai_breakdown` RPC | REFERENCED |
| D-30 RPC convention (per-chart + ET bucketing + shared filter signature) | 03-01 (verifier 5) | All Phase 3 RPCs + verifier 5 | REFERENCED |
| D-31 panel placement (bottom of /activity) | 03-07 | `Activity.tsx` mounts `<DeveloperPanel />` last | REFERENCED |
| D-32 ui_interactions sub-panels | 03-01 + 03-07 | `UiInteractionsPanel.tsx` + 3 RPCs + 1 raw select | REFERENCED |
| D-33 app_source filter on every ui_interactions query | 03-01 (verifier 4) + 03-03 + 03-07 | RPC bodies + `fetchUiRecentEvents.eq('app_source', ...)` + verifier 4 | REFERENCED |
| D-34 dev panel filter scope (range applies, specialist/mode don't) | 03-03 + 03-07 | `useUiTopPages` + `useUiTopElements` JSDoc tags | REFERENCED |
| D-35 ErrorState contract | 03-04 + 03-05 + 03-06 + 03-07 | All component error branches + verifier 11 | REFERENCED |
| D-36 no Suspense | 03-08 | `Activity.tsx` no `<Suspense>` boundary | REFERENCED |
| D-37 no full-page empty | 03-08 | `Activity.tsx` no top-level empty gate | REFERENCED |

All 37 CONTEXT decisions are referenced by at least one plan + at least one source artifact. No orphaned decisions.

---

## Required artifacts

| Artifact | Expected | Status |
|----------|----------|--------|
| `supabase/migrations/<ts>_create_activity_rpcs.sql` | 13 RPC functions | VERIFIED — Plan 03-01 SUMMARY confirms 13 RPCs deployed; verifier 3 passes (`13 RPCs, all security invoker`) |
| `src/db/database.types.ts` | Function definitions for all 13 RPCs | VERIFIED — `get_today_kpis`, `get_active_sessions`, `get_items_per_specialist_14d`, `get_ai_status_distribution`, `get_export_pipeline`, `get_house_sale_split`, `get_stuck_items`, `get_failed_ai_breakdown`, `get_session_detail`, `get_photo_coverage`, `get_ui_top_pages`, `get_ui_top_elements`, `get_walkthrough_funnel` all present |
| 11 prebuild verifier scripts | 11 NEW scripts under `scripts/` | VERIFIED — all 11 scripts run as part of `npm run prebuild`, all exit 0 |
| `src/services/activity/queries.ts` | 17 query/RPC builders | VERIFIED — Plan 03-03 SUMMARY confirms 17 builders; D-30 invariant honored (per-chart RPCs + raw selects) |
| `src/hooks/activity/*.ts` | 15+ TanStack Query hooks | VERIFIED — 19 hook files in `src/hooks/activity/`, all carry `@filterScope` JSDoc tag (verifier 10) |
| `src/hooks/useSignedPhotoUrl.ts` | Per-photo signed URL hook (D-08..D-11) | VERIFIED — TTL=3600s, refetchOnWindowFocus=true, staleTime=50min, retry=1 (verifier 9) |
| `src/hooks/useSpecialistFilter.ts` + `useModeFilter.ts` | URL-state filter hooks | VERIFIED — both URL-driven via `useSearchParams`, single-closure write idiom |
| `src/lib/severity.ts` + `chartPalette.ts` + `format.ts` extension | Phase 3 lib utilities | VERIFIED — Plan 03-02 SUMMARY confirms; `severity.test.ts`, `chartPalette.test.ts`, `format.test.ts` colocated |
| 11 admin components + 7 dev components | 18 components in `src/components/activity/` | VERIFIED — 19 component files (admin + dev) under `src/components/activity/`, all colocated tests |
| `src/pages/Activity.tsx` | Page shell with D-01 composition | VERIFIED — D-01 order: header → TodayKpiStrip → ActiveSessionsTable → StuckItemsAlertCard → ItemsPerSpecialistChart → AiStatusDonut + HouseSaleSplit (paired) → ExportPipelineChart → DeveloperPanel |
| `src/pages/SessionDetail.tsx` | Page shell with D-03 nested filter preservation | VERIFIED — `BackLink to={location.search ? '/activity' + search : '/activity'}` |
| `src/pages/StuckItems.tsx` | Page shell with D-23 independent context | VERIFIED — no filter row, BackLink to plain `/activity` |
| `src/App.tsx` | 3 new routes registered | VERIFIED — `/activity`, `/activity/sessions/:id`, `/activity/stuck` all inside `<ProtectedRoute>` + `<DashboardLayout>` |
| `src/layouts/DashboardLayout.tsx` | Sidebar `Activity` entry | VERIFIED — Plan 03-08 SUMMARY confirms NAV_ITEMS append |
| `src/pages/Activity.smoke.test.tsx` | Integration smoke (6 tests) | VERIFIED — 6/6 passing (heading + filter row, 8 sections compose, D-26 dev gate both branches, 3-key URL filter coexistence, INFR-06 service-role grep) |
| `src/pages/SessionDetail.smoke.test.tsx` | Integration smoke (6 tests) | VERIFIED — 6/6 passing (mount + composition, D-03 BackLink, D-09 lazy fetch on mount, D-09+D-12 thumbnail-only after expand, D-13 failed-photo no-fetch, not-found state) |
| `src/pages/StuckItems.smoke.test.tsx` | Integration smoke (4 tests) | VERIFIED — 4/4 passing (page renders + default sort, row click navigation, no filter row, D-23 RPC default args) |
| `.planning/phases/03-tpc-app-activity-activity/03-09-HUMAN-UAT.md` | Operator UAT checklist | VERIFIED — exists with `status: partial` frontmatter, 7 tests + cleanliness check, all `result: pending` |

---

## Manual verification

| Check | Document | Status |
|-------|----------|--------|
| Operator UAT (5 ROADMAP Success Criteria + critical decisions) | 03-09-HUMAN-UAT.md Tests 1–7 | PENDING — operator |
| 2-hour tab-resume photo refresh (Success Criterion #5 LOAD-BEARING) | 03-09-HUMAN-UAT.md Test 6 | PENDING — operator |
| Severity tone classification feels right to operator | 03-09-HUMAN-UAT.md Test 7(e) | PENDING — operator |
| Production-cleanliness invariant (no writes to TPC App tables) | 03-09-HUMAN-UAT.md § Production-cleanliness | PENDING — operator (statically backed by verifier 8) |

---

## Test summary

```
Test Files  74 passed (74)
      Tests  598 passed (598)
   Duration  ~45s (full suite)
```

Phase 3 added 16 new integration smoke tests (Activity 6 + SessionDetail 6 + StuckItems 4) on top of the unit tests delivered by Plans 03-01 through 03-08. No regressions on Phase 1 or Phase 2 tests (74 files green).

---

## Build summary

```
prebuild  : 11 verifiers, all green
tsc -b    : clean, no diagnostics
vite build: 1201 modules transformed, 875.45 kB main bundle (253.04 kB gzip), built in 11.54s
dist/     : index.html (0.47 kB) + assets/index-*.js (875.45 kB) + assets/index-*.css (43.94 kB)
```

`grep -rl 'SUPABASE_SERVICE_ROLE_KEY' dist/` exits 1 (no matches) — Phase 1 INFR-06 invariant maintained in production bundle.

---

## Sign-off

- [x] All 14 programmatic gates green (full test suite + 11 verifiers + tsc + vite build)
- [x] All 12 APP requirements (APP-01..12) covered with tests + components + RPCs
- [x] All 37 CONTEXT decisions (D-01..D-37) referenced by at least one plan + source artifact
- [ ] Operator UAT (`03-09-HUMAN-UAT.md`) signed off — PENDING
- [ ] Phase 3 marked complete in ROADMAP.md — PENDING (deferred to operator after UAT signoff)
- [ ] STATE.md updated with Phase 3 completion — PENDING (deferred to operator after UAT signoff)

**Phase 3 verified by:** Claude (gsd-executor) — programmatic verification only; operator UAT pending in `03-09-HUMAN-UAT.md`
**Date:** 2026-05-01
