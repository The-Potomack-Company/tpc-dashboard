# Roadmap: TPC Dashboard — v2.0 Internal Ops Console

## Overview

v2.0 pivots the dashboard from historical auction analytics (v1.0, retired) to an internal-ops console that surfaces two things the TPC team currently has no visibility into: how the voice Cataloger app is being used, and how the AI Cataloger Chrome extension is being used. Phase 1 repairs the v1.0→v2.0 schema drift and lands the shared UI primitives, hooks, and cross-cutting RLS/admin-client conventions every downstream phase needs. Phase 2 ships the smallest real-data slice (`/extension`) to prove the hook/query/Recharts pattern against a cross-repo table. Phase 3 stress-tests the pattern across five TPC App tables at `/activity`, including the photo signed-URL story. Phase 6 closes the milestone by shipping the dashboard to Vercel production (INFR-01 carryover from v1.0).

> **Phase numbering:** v2.0 resets to Phase 1. v1.0 phase directories are archived under `.planning/milestones/v1.0-phases/`. All v2.0 phase REQ-IDs are from `.planning/REQUIREMENTS.md` § v2.0 Requirements.

## Milestones

- ✅ **v1.0 Original thesis** — pivot-closed 2026-04-24, archived
- 🚧 **v2.0 Internal Ops Console** — Phases 1–3, 6 (this milestone)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure & Shared UI Kit** — Repair schema drift, ship shared UI primitives/hooks, establish RLS + admin-client conventions every downstream phase reuses
- [ ] **Phase 2: Extension Analytics (`/extension`)** — Ship the `/extension` route reading `analytics_events` with charts, filters, per-user/error tables, payload viewer, and live feed
- [ ] **Phase 3: TPC App Activity (`/activity`)** — Ship the `/activity` route across `profiles` / `sessions` / `items` / `photos` / `export_history` with KPI strip, specialist/mode filters, session detail + photo coverage
- [ ] **Phase 6: Vercel Production Deploy** — Ship the dashboard to a production Vercel URL with env vars configured (INFR-01 carryover)
- [ ] **Phase 7: Unified Design Migration** — *(INSERTED 2026-05-12)* Bring the dashboard onto the unified TPC design system shared with the cataloger + extension (OKLCH tokens, teal-blue accent, class-based dark mode, shared primitive library, ~50 SVG icons, DashboardAppIcon favicon). Pure visual treatment — no logic changes.

## Phase Details

### Phase 1: Infrastructure & Shared UI Kit
**Goal**: Repair v1.0→v2.0 schema drift and land the cross-cutting foundation (shared UI kit, date/timezone hooks, analytics_events admin-SELECT RLS, service-role admin-client convention) that every downstream phase reuses.
**Depends on**: Nothing (first phase)
**Requirements**: INFR-02, INFR-03, INFR-04, INFR-05, INFR-06
**Success Criteria** (what must be TRUE):
  1. A fresh developer can clone the repo and run `supabase db push` against a fresh Supabase project and reproduce the current prod schema with no drift errors and no orphaned v1.0 objects.
  2. A `<DateRangeFilter>` (Today / 7d / 30d / custom), `<Sparkline>`, `<KpiCard>`, and `<PayloadViewerModal>` render in a shared-kit Storybook/demo page with Tailwind v4 styling and typed props.
  3. `useDateRange` reflects filter state in the URL (refresh/back/forward preserves the range) and `useTimezone` formats all example timestamps in Eastern Time via `date-fns-tz`.
  4. An admin-only SELECT RLS policy is live on `public.analytics_events` — an admin dashboard user can SELECT rows, a non-admin gets zero rows, and the extension's existing `anon INSERT` policy still writes successfully (verified with a test insert).
  5. A service-role Supabase admin-client module exists outside `src/` (e.g. under `scraper/lib/` or `server/lib/`), is documented in CLAUDE.md Conventions, and a `grep -r SUPABASE_SERVICE_ROLE_KEY src/` returns nothing.
**Plans**: 6 plans
Plans:
- [x] 01-01-PLAN.md — INFR-02 schema drift repair: discovery script, migration-repair loop, drop migration, [BLOCKING] supabase db push applying both Phase 1 migrations, types regen, RLS verification execution
- [x] 01-02-PLAN.md — INFR-06 admin-client + scraper/ workspace scaffold + cross-platform prebuild grep guard + CLAUDE.md Conventions entry
- [x] 01-03-PLAN.md — INFR-05 analytics_events migration (mirrors extension migration 001) + admin SELECT RLS + three-client verification script + static migration-shape check
- [x] 01-04-PLAN.md — INFR-04 date-fns + date-fns-tz deps, useTimezone hook (ET formatters with DST tests), useDateRange hook (URL-state, single-closure-write pattern)
- [x] 01-05-PLAN.md — INFR-03 UI primitives: recharts install + Sparkline + KpiCard + PayloadViewerModal + DateRangeFilter (consumes useDateRange) with colocated Vitest suites
- [x] 01-06-PLAN.md — INFR-03 /kit demo route gated by import.meta.env.DEV, post-build tree-shake verifier, operator visual-verify checkpoint

### Phase 2: Extension Analytics (`/extension`)
**Goal**: Admin can open `/extension` and understand, at a glance, how the TPC AI Cataloger Chrome extension is being used — volume by event type, error rates, per-user usage, recent errors with payloads, and a live event feed — filtered by date range, user, and extension version.
**Depends on**: Phase 1 (admin-SELECT RLS on `analytics_events`, shared UI kit, `<DateRangeFilter>`, `useDateRange`, `useTimezone`, `<Sparkline>`, `<KpiCard>`, `<PayloadViewerModal>`)
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09, EXT-10
**Success Criteria** (what must be TRUE):
  1. Admin lands on `/extension` and sees a 14-day stacked bar chart of event volume by event_type plus five event-type KPI cards (one per event type) with counts, previous-period deltas, and sparklines.
  2. Admin can change the date range and user filter and every chart/table on the page updates to reflect the new selection, with the filter state reflected in the URL.
  3. Admin can see an error-rate bar chart per event type, a per-user table (count per event type, total errors, last-seen-at), and a Recent Errors table with a "view payload" action that opens the shared payload-viewer modal with pretty-printed JSON and copy-to-clipboard.
  4. Admin can watch a live event feed that tails `analytics_events` in near-real-time (5–10 s refetch or Realtime), shows the latest 50 events newest-first, has a working Pause button, and opens the payload viewer on row click.
  5. Admin can filter by extension version and see a dominant-version badge; admin sees cancellation-rate KPIs for `catalog_batch` (W2) and `portal_upload` (W3).
  6. If the extension's `analytics_events` table is not yet populated in the shared Supabase project, the `/extension` page renders a graceful "No events yet — waiting on extension v2.0" empty state instead of erroring.
**Plans**: 9 plans (5 waves)
Plans:

**Wave 1** *(no dependencies — runs first; Plan 02-01 contains a [BLOCKING] schema-push checkpoint)*
- [x] 02-01-PLAN.md — SQL migration: 6 RPCs (events volume / KPI totals / error rate / per-user / dominant version / cancellation rates) + supabase db push [BLOCKING] + types regen + static D-01 invariant verifier
- [x] 02-02-PLAN.md — URL filter hooks (useUserFilter, useVersionFilter), src/lib/devAccess (isDevAccount allowlist), src/lib/format extension (formatTimestampShort)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-03-PLAN.md — services/extension/queries.ts + 10 TanStack Query hooks (gate, eventVolume, kpiTotals, errorRate, perUserSummary, recentErrors, dominantVersion, cancellationRates, distinctVersions, liveFeed)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-04-PLAN.md — admin chart components: EventVolumeChart (EXT-01) + KpiStrip (EXT-02) + ErrorRateChart (EXT-03)
- [x] 02-05-PLAN.md — install @tanstack/react-table v8.21.3; UserMultiSelect, PerUserTable (EXT-04), RecentErrorsTable (EXT-05 + EXT-06 dev-gated payload viewer)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-06-PLAN.md — LiveEventFeed (EXT-08) — polled feed card with Pause/Resume + dev-gated row click
- [x] 02-07-PLAN.md — DeveloperPanel (D-15 render-gated) + ExtensionVersionFilter + DominantVersionBadge + CancellationRateKpis (EXT-09 + EXT-10)

**Wave 5** *(blocked on Wave 4 completion; Plan 02-09 contains a [BLOCKING] operator manual smoke checkpoint)*
- [x] 02-08-PLAN.md — page assembly: src/pages/Extension.tsx (empty-gate branch + section composition), App.tsx route, DashboardLayout NAV_ITEMS first entry
- [x] 02-09-PLAN.md — integration smoke test (real components + stubbed Supabase) + operator manual smoke checkpoint + 02-VERIFICATION.md

**Cross-cutting constraints** *(must_haves.truths shared across 2+ plans):*
- `app_source = 'tpc-extension'` invariant on every query (D-01) — enforced in 02-01 SQL, 02-03 services/hooks, 02-07 inline-free
- 5-event vocabulary (`catalog_single`, `catalog_batch`, `portal_upload`, `spreadsheet_transform`, `data_import`); `catalog_item` excluded from EXT-01..04 (D-02) — 02-01, 02-03, 02-04
- `<ErrorState>` locked contract `{ heading, body, onRetry }` — required by 02-04, 02-05, 02-06, 02-07; sibling Retry button forbidden
- Dev-gating via `isDevAccount(profile?.email)` — render-conditional (NOT display-hidden); used by 02-05 (RecentErrorsTable), 02-06 (LiveEventFeed), 02-07 (DeveloperPanel)
- D-05 previous-period math (`prev_from := p_from - (p_to - p_from), prev_to := p_from`) — applied identically in `get_kpi_totals` (02-01) and `get_cancellation_rates` (02-01)

**UI hint**: yes

### Phase 3: TPC App Activity (`/activity`)
**Goal**: Admin can open `/activity` and see who on the TPC team is cataloging what — today's numbers, active sessions, items per specialist, AI-status health, export pipeline, photo coverage, house-vs-sale split, and stuck-item alerts — with specialist / mode / date-range filters and a session-detail drilldown.
**Depends on**: Phase 1 (shared UI kit, date-range hooks, admin auth gate already validated in v1.0)
**Requirements**: APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-07, APP-08, APP-09, APP-10, APP-11, APP-12
**Success Criteria** (what must be TRUE):
  1. Admin lands on `/activity` and sees a Today KPI strip (sessions created, items created, items exported, % items with `ai_status='done'`) with previous-period deltas, plus an Active Sessions table sortable by age and specialist.
  2. Admin can change date range, specialist multi-select, and session-mode (house / sale / all) filters and every chart/table on the page updates; filter state is reflected in the URL.
  3. Admin sees a 14-day items-per-specialist stacked bar, an AI-status donut with a visually distinct "failed" slice, an Export Pipeline horizontal stacked bar, a House-vs-Sale split, and a Stuck-Items alert card (items with `ai_status IN ('processing','queued')` older than 2 hours, linked to a filtered list).
  4. Admin can click any session row and open Session Detail (route or drawer) showing session metadata + an item list with receipt_number, title, ai_status, and photo count — all read-only, no writes to TPC App tables.
  5. Inside Session Detail, admin sees a Photo Coverage panel (≥1 photo vs 0 photos), a `photos.upload_status` breakdown, a callout if any photos are in `failed` state, and photo thumbnails render correctly on first load and after a 2-hour tab-resume (signed-URL strategy proven).
**Plans**: 9 plans (5 waves)
Plans:

**Wave 1** *(no dependencies — runs in parallel; Plan 03-01 contains a [BLOCKING] schema-push checkpoint)*
- [ ] 03-01-PLAN.md — SQL migration: 13 RPCs (today/active/14d/ai-status/export-pipeline/house-sale/stuck/failed-ai/session-detail/photo-coverage/ui-top-pages/ui-top-elements/walkthrough-funnel) + supabase db push [BLOCKING] + types regen + 6 static verifiers (app-source / bucket-tz / stuck-threshold / mode-filter / rpc-shape / table-readonly)
- [ ] 03-02-PLAN.md — URL filter hooks (useSpecialistFilter, useModeFilter), load-bearing useSignedPhotoUrl with refetch-on-focus override, src/lib/severity (severity classifier), src/lib/chartPalette (4 chart palettes including 'completed' status), src/lib/format extension (formatAge), 2 prebuild verifiers (photos-ttl, filter-scope JSDoc)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 03-03-PLAN.md — services/activity/queries.ts (17 builders) + 15+ TanStack Query hooks across activity feature (all RPC wrappers + raw selects + live-tail useUiRecentEventsFeed mirroring Phase 2 useLiveFeed)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 03-04-PLAN.md — right-now admin surfaces: TodayKpiStrip (APP-01) + ActiveSessionsTable (APP-02) + StuckItemsAlertCard (APP-11)
- [ ] 03-05-PLAN.md — chart admin surfaces: ItemsPerSpecialistChart (APP-03 fixed-window) + AiStatusDonut (APP-04) + HouseSaleSplit (APP-12) + ExportPipelineChart (APP-05)
- [ ] 03-06-PLAN.md — top-level shared filter controls (SpecialistMultiSelect, ModeToggle) + Session Detail surface (SessionMetadataCard, PhotoCoveragePanel, ThumbnailTile, SessionItemDisclosure, RawItemInspector, SessionItemList) + StuckItemsTable

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 03-07-PLAN.md — render-conditional DeveloperPanel (D-26) + FailedAiBreakdown + UiInteractionsPanel composing 4 sub-sub-panels (UiTopPagesTable, UiTopElementsTable, WalkthroughFunnel, UiRecentEventsFeed mirroring Phase 2 LiveEventFeed)

**Wave 5** *(blocked on Wave 4 completion; Plan 03-09 contains a [BLOCKING] operator manual smoke checkpoint)*
- [ ] 03-08-PLAN.md — page assembly: src/pages/Activity.tsx (D-01 layout order) + src/pages/SessionDetail.tsx (D-03 nested filter preservation) + src/pages/StuckItems.tsx (D-23 independent context) + App.tsx routes + DashboardLayout NAV_ITEMS Activity entry
- [ ] 03-09-PLAN.md — integration smoke tests (real components + stubbed Supabase) for all 3 pages + operator manual smoke checkpoint + 03-09-HUMAN-UAT.md + 03-VERIFICATION.md

**Cross-cutting constraints** *(must_haves.truths shared across 2+ plans):*
- `app_source = 'tpc-app'` invariant on every `ui_interactions` query (D-33) — enforced in 03-01 SQL, 03-03 services/hooks, 03-07 inline-free
- Mode filter ALWAYS targets `sessions.mode` — NEVER `items.mode` (D-20) — enforced statically in 03-01 verifier; honored by 03-03 services
- Stuck threshold (`interval '2 hours'`) hard-coded inside `get_stuck_items` body — NEVER a parameter (D-24) — enforced statically in 03-01 verifier; consumed by 03-04 alert card and 03-08 stuck page
- Photo signed URLs: TTL=3600s + staleTime=50min + refetchOnWindowFocus=true (D-08, D-11) — enforced statically in 03-02 verifier; consumed by 03-06 ThumbnailTile
- D-13 invariant: failed-upload photos NEVER call createSignedUrl — enforced via `enabled` flag on useSignedPhotoUrl, asserted in 03-02 unit test + 03-09 smoke test
- Filter scope discipline (D-14..D-21): right-now / range-driven / fixed-window / live-tail / one-shot classification — enforced via `@filterScope` JSDoc tag on every src/hooks/activity/*.ts (verifier from 03-02)
- Render-conditional dev gate via `isDevAccount(profile?.email)` (D-26) — render-conditional (NOT display-hidden); enforced inside DeveloperPanel itself (03-07)
- `<ErrorState>` locked contract `{ heading, body, onRetry }` — required by 03-04, 03-05, 03-06, 03-07; sibling Retry button forbidden
- Phase Boundary read-only — NO INSERT/UPDATE/DELETE/ALTER on TPC App tables — enforced statically in 03-01 verifier

**UI hint**: yes

### Phase 6: Vercel Production Deploy
**Goal**: The TPC Dashboard is live on a production Vercel URL (same org as TPC App) with production env vars set, accessible to admins, and ready for the team to use day-to-day.
**Depends on**: Phase 1 (schema drift repaired so `supabase db push` against prod is safe). Phases 2/3 don't block — Vercel deploy is orthogonal — but in practice this phase runs at end-of-milestone to ship a cohesive v2.0.
**Requirements**: INFR-01
**Success Criteria** (what must be TRUE):
  1. A production Vercel deployment of the dashboard is accessible at a stable production URL (same Vercel org as TPC App).
  2. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as Vercel production environment variables and a TPC-App admin can log in via the existing Supabase auth flow and reach `/activity` and `/extension`.
  3. The frontend build pipeline (`tsc -b && vite build`) produces a bundle that does NOT contain any occurrence of `SUPABASE_SERVICE_ROLE_KEY` or any server-only dependency (verified with a grep/audit step in the deploy plan).
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Shared UI Kit | 6/6 | Complete | 2026-04-28 |
| 2. Extension Analytics (`/extension`) | 9/9 | In Progress (human_needed) | - |
| 3. TPC App Activity (`/activity`) | 9/9 | In Progress (human_needed) | - |
| 6. Vercel Production Deploy | 0/TBD | Not started | - |
| 7. Unified Design Migration | 8/8 | Complete (human_needed) | - |

**Phase 2 status note (reconciled 2026-05-12):** All 9 plans have SUMMARY.md and 02-VERIFICATION.md reports `human_needed` status — 6/6 ROADMAP success criteria verified programmatically (254/254 tests pass, all prebuild verifiers green), but 10 operator UAT steps remain pending in `phases/02-extension-analytics-extension/02-09-HUMAN-UAT.md` (live-feed timing, payload viewer with real data, dev-panel DOM verification, production-cleanliness SQL, URL filter sharing). Phase will flip to Complete after operator UAT against the live shared Supabase project.

**Phase 3 status note:** All 9 plans have SUMMARY.md and 03-VERIFICATION.md reports `human_needed` status — 5/5 ROADMAP success criteria verified programmatically (598/598 tests pass, 11 prebuild verifiers green), but 7 manual UAT items remain pending in `phases/03-tpc-app-activity-activity/03-09-HUMAN-UAT.md` (including load-bearing 2-hour tab-resume photo refresh test).

---

*Roadmap created: 2026-04-24 — v2.0 Internal Ops Console milestone, phases reset to 1 (v1.0 archived under `.planning/milestones/v1.0-phases/`). Phases 4 (Live RFC Scraper) and 5 (Live Sale UI) removed 2026-05-12 — live-ops narrative abandoned.*
