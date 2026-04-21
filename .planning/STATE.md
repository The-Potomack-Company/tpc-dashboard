# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Give the TPC team a single place to see how their auctions are performing over time
**Current focus:** Phase 1: Foundation & Auth

## Current Position

Phase: 1 of 10 (Foundation & Auth)
Plan: 5 of 5 (complete)
Status: Phase 1 complete (pending final human QA)
Last activity: 2026-04-21 -- Phase 1 executed; auth gate + schema live

Progress: [█░░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | ~95min (plans 1-4) + plan 5 | ~24min |

**Recent Trend:**
- Last 5 plans: --
- Trend: --

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Data-first build order -- nothing before PDF import is verified
- [Roadmap]: Scraper last (Phase 10) -- manual import covers interim; scraper is highest complexity/lowest urgency
- [Roadmap]: Fine granularity (10 phases) -- natural delivery boundaries preserved
- [Phase 1]: Access model is single-admin for v1 -- specialist profiles reach the auth gate, authenticate, then see AccessDenied. AUTH-03 "specialist sees own activity only" is satisfied by denial in v1; specialist-restricted view deferred to v2. (Research Assumption A8)
- [Phase 1]: Forbidden Supabase CLI commands (never run against shared prod): `supabase db pull`, `supabase db reset --linked`. Only `supabase db push` and `supabase gen types` are safe.
- [Phase 1]: UI-SPEC `{profile.full_name}` token maps to `profile.display_name` in code (TPC App schema uses `display_name`).
- [Phase 1]: Shared Supabase project with TPC App -- dashboard reuses same env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and adds its own migrations (9 dashboard migrations starting at 20260421000000) without touching TPC App tables.
- [Phase 1]: All monetary columns are `numeric(14,2)` (satisfies INFR-04); server-side aggregations only.
- [Phase 1]: TPC App migration shims added to supabase/migrations/ so `supabase db push` reconciles with the linked project without emitting `db pull` instructions.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 (PDF Import): PDF format variance across 457 files is unverified at scale -- research needed during planning
- Phase 10 (RFC Scraper): RFC site structure, login flow, and session handling are complete unknowns -- research needed before planning
- Phase 7 (Team Activity): Extension analytics_events table depends on Cataloger Extension v2.0 shipping

## Session Continuity

Last session: 2026-04-21
Stopped at: Plan 01-05 Task 1 complete (docs updated); awaiting human QA + Vercel deploy at Task 2 checkpoint
Resume file: .planning/phases/01-foundation-auth/01-05-PLAN.md
