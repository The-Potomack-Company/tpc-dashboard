---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live Ops
status: in-progress
stopped_at: Plan 01-05 complete — UI-kit primitives shipped
last_updated: "2026-04-28T19:00:00Z"
last_activity: 2026-04-28 — Plan 01-05 complete (Sparkline / KpiCard / PayloadViewerModal / DateRangeFilter, 33 new Vitest specs)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 6
  completed_plans: 5
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen
**Current focus:** Milestone v2.0 Live Ops — Phase 1 (Infrastructure & Shared UI Kit) plans 01-01..01-05 complete; plan 01-06 (/kit demo + tree-shake verifier) remaining

## Current Position

Phase: 1 of 6 (Infrastructure & Shared UI Kit)
Plan: 5 of 6 complete (01-06 next)
Status: In progress — UI-kit primitives shipped, /kit demo route pending
Last activity: 2026-04-28 — Plan 01-05 complete (Sparkline / KpiCard / PayloadViewerModal / DateRangeFilter, 33 new Vitest specs across 4 colocated suites; recharts pinned at ^3.8.1)

Progress: [█░░░░░░░░░] 14%

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

### Pending Todos

- [Phase 4 / SCRP-15]: Sale-monitor discuss session must happen BEFORE any `live_*` migration ships. Capture notes under `.planning/phases/04-*/discuss/`; raw RFC HTML snapshots captured during prototype runs so schema can be shaped around real monitor-relevant signals.
- [Phase 2 / EXT graceful degradation]: If the extension's `analytics_events` table is not populated in the shared Supabase project when Phase 2 ships, render a graceful "No events yet — waiting on extension v2.0" empty state instead of erroring. Do NOT block Phase 2 on the external repo schedule.

### Blockers/Concerns

- Phase 4 (RFC Scraper): RFC site structure, login flow, anti-bot behavior, and polling cadence tolerances are unknowns — a prototype/research sub-step within Phase 4 (before schema lock) is required.
- Phase 2 (Extension Analytics): `analytics_events` table depends on TPC AI Cataloger Extension Phases 28–31 shipping. Mitigation: build against the known schema; degrade gracefully if table is missing.
- Phase 1 (Infrastructure): v1.0 dropped dashboard tables out-of-band. `supabase db push` against a fresh project may not reproduce prod — repair migration needed (INFR-02).

## Session Continuity

Last session: 2026-04-28T19:00:00Z
Stopped at: Plan 01-05 complete — UI-kit primitives shipped (recharts pinned, 4 components + 33 specs)
Resume file: .planning/phases/01-infrastructure-shared-ui-kit/01-06-PLAN.md (when authored)
