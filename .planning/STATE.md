---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live Ops
status: phase-2-planned
stopped_at: Phase 2 planned — 9 PLANs in 5 waves verified by gsd-plan-checker (iteration 2/3, all 8 issues resolved); ready for /gsd-execute-phase 2
last_updated: "2026-04-29T00:00:00Z"
last_activity: 2026-04-29 — Phase 2 plan-phase complete. 9 plans across 5 waves. Wave 1 (02-01 SQL+RPCs+[BLOCKING] db push, 02-02 URL hooks+devAccess+format). Wave 2 (02-03 services/hooks). Wave 3 (02-04 admin charts, 02-05 tables+UserMultiSelect). Wave 4 (02-06 LiveFeed, 02-07 DeveloperPanel). Wave 5 (02-08 page assembly+route, 02-09 smoke+[BLOCKING] operator checkpoint). All 10 EXT-IDs covered; all 21 D-NN locked decisions referenced in plans.
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 15
  completed_plans: 6
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen
**Current focus:** Milestone v2.0 Live Ops — Phase 1 (Infrastructure & Shared UI Kit) **complete**; Phase 2 (/extension — Extension Analytics) **planned** (9 PLANs in 5 waves); ready to execute.

## Current Position

Phase: 2 of 6 (Extension Analytics — `/extension`) — **Planned**
Plan: 0 of 9 (execution next)
Status: Phase 2 planning complete — ready for /gsd-execute-phase 2
Last activity: 2026-04-29 — Phase 2 plan-phase. 9 PLAN.md files written (one per plan, 5 waves). Plan-checker iteration 2/3 returned VERIFICATION PASSED after 1 revision cycle (resolved 2 BLOCKERs: cancellation rate `previous_rate` extension to honor D-05; non-destructive App.tsx route insertion preserving `/login`, KitPage ternary, `*` wildcard. Plus 6 WARNINGs: shared sibling-hooks smoke test, centralized `useDistinctVersions`, locked `<ErrorState>` `{heading, body, onRetry}` contract, verified `KpiDelta` export, end-to-end filter-change smoke, no production-write smoke instructions). Cross-cutting must_haves include the D-01 `app_source = 'tpc-extension'` invariant on every query; D-02 5-event vocabulary excluding `catalog_item`; D-15 render-conditional `<DeveloperPanel>`; D-19 page-level empty gate.

Progress: [██░░░░░░░░] 17%

## Performance Metrics

**Velocity:**

- Total plans completed: 31 (cumulative across v1.0)
- Average duration: --
- Total execution time: 0 hours (v2.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 Phase 1 | 5 | ~95min (plans 1-4) + plan 5 | ~24min |
| v1.0 Phase 04 | 4 | - | - |
| v1.0 Phase 05 | 7 | - | - |
| v1.0 Phase 06 | 6 | - | - |

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

### Pending Todos

- [Phase 4 / SCRP-15]: Sale-monitor discuss session must happen BEFORE any `live_*` migration ships. Capture notes under `.planning/phases/04-*/discuss/`; raw RFC HTML snapshots captured during prototype runs so schema can be shaped around real monitor-relevant signals.
- [Phase 2 / EXT graceful degradation]: If the extension's `analytics_events` table is not populated in the shared Supabase project when Phase 2 ships, render a graceful "No events yet — waiting on extension v2.0" empty state instead of erroring. Do NOT block Phase 2 on the external repo schedule.

### Blockers/Concerns

- Phase 4 (RFC Scraper): RFC site structure, login flow, anti-bot behavior, and polling cadence tolerances are unknowns — a prototype/research sub-step within Phase 4 (before schema lock) is required.
- Phase 2 (Extension Analytics): `analytics_events` table depends on TPC AI Cataloger Extension Phases 28–31 shipping. Mitigation: build against the known schema; degrade gracefully if table is missing.
- Phase 1 (Infrastructure): v1.0 dropped dashboard tables out-of-band. `supabase db push` against a fresh project may not reproduce prod — repair migration needed (INFR-02).

## Session Continuity

Last session: 2026-04-29T00:00:00Z
Stopped at: Phase 2 context gathered — CONTEXT.md + DISCUSSION-LOG.md committed; ready for /gsd-plan-phase 2
Resume file: .planning/phases/02-extension-analytics-extension/02-CONTEXT.md
