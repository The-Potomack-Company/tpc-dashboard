---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live Ops
status: phase-1-complete
stopped_at: Phase 1 complete — INFR-02..06 all closed; ready to plan Phase 2 (/extension)
last_updated: "2026-04-28T22:00:00Z"
last_activity: 2026-04-28 — Plan 01-06 complete (/kit dev demo route + post-build tree-shake verifier; INFR-03 closed, Phase 1 closed)
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen
**Current focus:** Milestone v2.0 Live Ops — Phase 1 (Infrastructure & Shared UI Kit) **complete**; ready to plan Phase 2 (/extension — Extension Analytics)

## Current Position

Phase: 1 of 6 (Infrastructure & Shared UI Kit) — **COMPLETE**
Plan: 6 of 6 complete (Phase 1 done)
Status: Phase 1 complete — ready to plan Phase 2 (/extension)
Last activity: 2026-04-28 — Plan 01-06 complete (/kit dev demo gated by import.meta.env.DEV + top-level-await; post-build dist/-grep verifier proves zero kit references in production bundle; operator visual-verify approved). INFR-03 closed; Phase 1 fully shipped (INFR-02..06).

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

### Pending Todos

- [Phase 4 / SCRP-15]: Sale-monitor discuss session must happen BEFORE any `live_*` migration ships. Capture notes under `.planning/phases/04-*/discuss/`; raw RFC HTML snapshots captured during prototype runs so schema can be shaped around real monitor-relevant signals.
- [Phase 2 / EXT graceful degradation]: If the extension's `analytics_events` table is not populated in the shared Supabase project when Phase 2 ships, render a graceful "No events yet — waiting on extension v2.0" empty state instead of erroring. Do NOT block Phase 2 on the external repo schedule.

### Blockers/Concerns

- Phase 4 (RFC Scraper): RFC site structure, login flow, anti-bot behavior, and polling cadence tolerances are unknowns — a prototype/research sub-step within Phase 4 (before schema lock) is required.
- Phase 2 (Extension Analytics): `analytics_events` table depends on TPC AI Cataloger Extension Phases 28–31 shipping. Mitigation: build against the known schema; degrade gracefully if table is missing.
- Phase 1 (Infrastructure): v1.0 dropped dashboard tables out-of-band. `supabase db push` against a fresh project may not reproduce prod — repair migration needed (INFR-02).

## Session Continuity

Last session: 2026-04-28T22:00:00Z
Stopped at: Phase 1 complete — Plan 01-06 (/kit dev demo + tree-shake verifier) shipped; INFR-03 closed; ready to plan Phase 2 (/extension)
Resume file: .planning/phases/02-extension-analytics/ (to be created via /gsd:plan-phase or /gsd:execute-phase 2)
