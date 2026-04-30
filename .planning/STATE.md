---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live Ops
status: executing
stopped_at: Phase 3 context gathered — CONTEXT.md + DISCUSSION-LOG.md committed; ready for /gsd-plan-phase 3
last_updated: "2026-04-30T15:31:17.591Z"
last_activity: 2026-04-30
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen
**Current focus:** Phase 02 — extension-analytics-extension

## Current Position

Phase: 03
Plan: Not started
Status: Executing Phase 02
Last activity: 2026-04-30

Progress: [██░░░░░░░░] 17%

## Performance Metrics

**Velocity:**

- Total plans completed: 40 (cumulative across v1.0)
- Average duration: --
- Total execution time: 0 hours (v2.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 Phase 1 | 5 | ~95min (plans 1-4) + plan 5 | ~24min |
| v1.0 Phase 04 | 4 | - | - |
| v1.0 Phase 05 | 7 | - | - |
| v1.0 Phase 06 | 6 | - | - |
| 02 | 9 | - | - |

**Recent Trend:**

- Last 5 plans: --
- Trend: --

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work (v1.0 carryovers retained; v2.0 decisions accrue as phases execute):

- [Phase 1 (v1.0)]: Access model is single-admin for v1 — specialist profiles reach the auth gate, authenticate, then see AccessDenied. AUTH-03 "specialist sees own activity only" is satisfied by denial in v1; specialist-restricted view deferred to v2. (Research Assumption A8)
- [Phase 1 (v1.0)]: Forbidden Supabase CLI commands (never run against shared prod): `supabase db pull`, `supabase db reset --linked`. Only `supabase db push` and `supabase gen types` are safe.
- [Phase 1 (v1.0)]: UI-SPEC `{profile.full_name}` token maps to `profile.display_name` in code (TPC App schema uses `display_name`).
- [Phase 1 (v1.0)]: Shared Supabase project with TPC App — dashboard reuses same env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and adds its own migrations without touching TPC App tables.
- [Phase 1 (v1.0)]: TPC App migration shims added to `supabase/migrations/` so `supabase db push` reconciles with the linked project without emitting `db pull` instructions.
- [Phase 2 (v1.0)]: Import pipeline uses a separate server-side admin client (`scripts/lib/supabase-admin.ts`) that reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. The frontend `src/lib/supabase.ts` (anon key + `VITE_` prefix) is never imported by scripts/, preventing service-role key leakage into the browser bundle. **Note for v2.0: `scripts/` deleted in pivot — new admin-client home required by INFR-06 (Phase 1).**
- [Phase 2 (v1.0)]: Per-sale atomicity was enforced via a security-definer Postgres RPC with EXECUTE granted to `service_role` only. Pattern is reusable for the v2.0 scraper's atomic lot-tick RPC (SCRP-10).
- [Roadmap v2.0]: Phase numbering reset to 1 for this milestone. v1.0 phase directories archived under `.planning/milestones/v1.0-phases/`.
- [Roadmap v2.0]: 6 phases derived from 51 v2.0 requirements (fine granularity). Phase order: Infra/UI kit → Extension Analytics → TPC App Activity → Live Scraper Infra → Live Sale UI → Vercel deploy. Extension first (smallest cross-repo slice); scraper before live UI; sale-monitor discuss gates the live schema (SCRP-15).
- [Phase 1 / 01-05]: Recharts ResponsiveContainer cannot render under JSDom (zero clientWidth/Height). Established test pattern: `vi.mock('recharts', ...)` replaces ResponsiveContainer with a div that injects explicit width/height into its chart child via `cloneElement`. Reusable for any future Recharts component test (Phase 2 charts, Phase 3 charts, Phase 5 sparklines).
- [Phase 1 / 01-05]: PayloadViewerModal copy test pattern — `userEvent.setup({ writeToClipboard: false })` MUST come before `Object.defineProperty(navigator, 'clipboard', ...)` because (a) JSDom 28+ exposes navigator.clipboard as read-only getter and (b) userEvent v14's clipboard fake otherwise masks the stub.
- [Phase 1 / 01-05]: KpiCard delta direction → color is semantic-neutral (`up=text-green-600`, `down=text-red-600`, `flat=text-gray-500`). Caller chooses direction based on metric semantics; KpiCard never inspects what the metric means.
- [Phase 1 / 01-05]: DateRangeFilter is fully URL-driven (no controlled props). Drop it under any router-wrapped tree and the URL becomes single source of truth via `useDateRange`.
- [Phase 1 / 01-06]: D-11 tree-shaking guarantee proven CI-grade. Pattern: `const KitPage = import.meta.env.DEV ? (await import('./pages/Kit')).KitPage : null;` at module scope. Vite substitutes the literal `false` in production; Rollup drops the dynamic-import branch. Post-build verifier `scripts/verify-no-kit-in-dist.mjs` greps `dist/` for `KitPage`, `routes/kit`, `"/kit"` — exits 1 on any leak. Reusable for future dev-only routes.
- [Phase 1 closeout]: INFR-03 fully closed by plans 01-05 (primitives) + 01-06 (demo + tree-shake guarantee). All 5 ROADMAP Phase 1 Success Criteria satisfied: schema-drift repair (01-01), service-role admin-client convention + prebuild guard (01-02), analytics_events admin-SELECT RLS verified three-client (01-03 + 01-01), useDateRange + useTimezone hooks (01-04), shared UI-kit primitives + /kit demo (01-05 + 01-06).
- [Phase 2 context]: Strict scoping `app_source = 'tpc-extension'` on every query — table is now multi-app (extension + TPC_App share via app_source discriminator); legacy NULL-source rows intentionally excluded.
- [Phase 2 context]: 5-event vocabulary at top level (catalog_single, catalog_batch, portal_upload, spreadsheet_transform, data_import). The 6th event type catalog_item (W2 child rows) is excluded from EXT-01/EXT-02/EXT-03/EXT-04 to avoid double-counting batch activity.
- [Phase 2 context]: Live feed = TanStack `refetchInterval: 10000`, NOT Supabase Realtime (mirrors Phase 4 SCRP-16 invalidate-driven precedent for high-volume INSERT tables). Pause sets refetchInterval=false; Resume re-enables + immediately refetches to latest 50.
- [Phase 2 context]: Page issues many TanStack queries (one per chart). Server-side bucketing via 4 new Postgres RPCs (`get_event_volume_daily`, `get_kpi_totals`, `get_error_rate_by_type`, `get_per_user_summary`) using `date_trunc(... AT TIME ZONE 'America/New_York')`. Non-aggregating queries (recent errors, live feed) use raw `.from().select()`.
- [Phase 2 context]: Filters are URL-driven, no Zustand. Reuses Phase 1 `useDateRange`; adds `useUserFilter` (`?users=`) and `useVersionFilter` (`?versions=`).
- [Phase 2 context]: Admin/dev surface split — email allowlist via `src/lib/devAccess.ts` exporting `isDevAccount(email)`. Initial allowlist: `['josh@potomackco.com']`. Inline collapsed `<DeveloperPanel>` at the bottom of `/extension` houses EXT-06 payload viewer triggers, EXT-09 extension_version filter + dominant-version badge, and EXT-10 cancellation-rate KPIs. Admin row click on EXT-05 / EXT-08 is a no-op; dev row click opens the payload viewer.
- [Phase 2 context]: Empty-state strategy — `useExtensionGate()` hook with `staleTime: Infinity` does a single `LIMIT 1` lifetime probe; when zero, the page renders a single full-page `<EmptyState>` ("waiting on TPC AI Cataloger v2.0"). When lifetime ≠ 0 but selected range is empty, charts/cards show per-card empty messages.
- [Phase 3 context]: Session Detail is a nested route `/activity/sessions/:id` (NOT a drawer or modal); preserves `?range=`/`?specialists=`/`?mode=` URL state across navigation; TanStack Table v8 item list; Photo Coverage panel (numeric only) above items; thumbnails render lazily on per-item row expansion (no mass thumbnail grid).
- [Phase 3 context]: Photo signed-URL strategy — new shared `src/hooks/useSignedPhotoUrl.ts`, lazy on item-row expansion, TTL=3600s + staleTime=50min + `refetchOnWindowFocus: true` (overrides global QueryClient default), `thumbnail_path` only. Tab-resume after 2h triggers focus event → query refetch → no broken-thumbnail flash. Photos with `upload_status='failed'` MUST NOT call `createSignedUrl`. Solves Success Criterion #5 without infra changes.
- [Phase 3 context]: Filter scope master rule — date range applies to `created_at`-based aggregates only (AI status donut APP-04, Export Pipeline APP-05, House-vs-Sale APP-12). "Right-now" widgets ignore range: Today KPI strip (APP-01) is anchored to today, Active Sessions (APP-02) is always-current, 14-day items chart (APP-03) is fixed-window, Stuck Items (APP-11) uses its own >2h rule. Specialist + mode filters apply to BOTH categories. Mode filter targets `sessions.mode` (canonical), not `items.mode`.
- [Phase 3 context]: Stuck Items affordance — dedicated route `/activity/stuck` (bookmarkable triage page). Alert card on `/activity` shows count + age-of-oldest + severity tone (yellow N≥5, red oldest>6h) + CTA. Quiet success state at N=0 prevents layout reflow. Server-side RPC `get_stuck_items(p_specialists text[], p_mode text)` with 2h threshold hard-coded inside the RPC (NOT a parameter, so card and page can never drift).
- [Phase 3 context]: Admin/dev surface split mirrors Phase 2 D-15/D-16 — same `isDevAccount(profile.email)` gate from `src/lib/devAccess.ts` (Phase 2 plan 02-02 ships it), render-conditional discipline. Dev surface adds: Raw Item Inspector inside Session Detail per-item disclosure, photo storage-path debugging, `/activity/stuck` deep-diagnostics columns, and `<DeveloperPanel>` at bottom of `/activity` housing Failed-AI Breakdown + `ui_interactions` panel.
- [Phase 3 context]: `ui_interactions` data source (TPC App migration `20260424000001_create_ui_interactions.sql`) hard-filtered to `app_source='tpc-app'` on every query (mirrors Phase 2 D-01 invariant). Sub-panels: top page_paths (`get_ui_top_pages`), top element_ids (`get_ui_top_elements`), walkthrough funnel (`get_walkthrough_funnel`, ignores date range), recent events feed (10s `refetchInterval`, mirrors Phase 2 EXT-08).
- [Phase 3 context]: All Phase 3 RPCs follow Phase 2 D-12/D-13 server-aggregation pattern — per-chart RPCs, server-side `date_trunc(... AT TIME ZONE 'America/New_York')` bucketing, shared filter signature `(p_from timestamptz, p_to timestamptz, p_specialists text[], p_mode text)`. Non-aggregating queries (Active Sessions list, Session Detail items, Stuck Items page rows) use raw `.from().select()` with embedded joins via PostgREST. Codebase layout: `src/services/activity/queries.ts` + `src/hooks/activity/`.

### Pending Todos

- [Phase 4 / SCRP-15]: Sale-monitor discuss session must happen BEFORE any `live_*` migration ships. Capture notes under `.planning/phases/04-*/discuss/`; raw RFC HTML snapshots captured during prototype runs so schema can be shaped around real monitor-relevant signals.
- [Phase 2 / EXT graceful degradation]: If the extension's `analytics_events` table is not populated in the shared Supabase project when Phase 2 ships, render a graceful "No events yet — waiting on extension v2.0" empty state instead of erroring. Do NOT block Phase 2 on the external repo schedule.

### Blockers/Concerns

- Phase 4 (RFC Scraper): RFC site structure, login flow, anti-bot behavior, and polling cadence tolerances are unknowns — a prototype/research sub-step within Phase 4 (before schema lock) is required.
- Phase 2 (Extension Analytics): `analytics_events` table depends on TPC AI Cataloger Extension Phases 28–31 shipping. Mitigation: build against the known schema; degrade gracefully if table is missing.
- Phase 1 (Infrastructure): v1.0 dropped dashboard tables out-of-band. `supabase db push` against a fresh project may not reproduce prod — repair migration needed (INFR-02).

## Session Continuity

Last session: 2026-04-30T00:00:00Z
Stopped at: Phase 3 context gathered — CONTEXT.md + DISCUSSION-LOG.md committed; ready for /gsd-plan-phase 3
Resume file: .planning/phases/03-tpc-app-activity-activity/03-CONTEXT.md
