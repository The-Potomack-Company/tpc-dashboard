---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live Ops
status: defining_requirements
stopped_at: Milestone v2.0 started (/gsd-new-milestone). Requirements next.
last_updated: "2026-04-24T00:00:00.000Z"
last_activity: 2026-04-24
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen
**Current focus:** Milestone v2.0 Live Ops — defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-24 — Milestone v2.0 Live Ops started

## Performance Metrics

**Velocity:**

- Total plans completed: 31
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | ~95min (plans 1-4) + plan 5 | ~24min |
| 04 | 4 | - | - |
| 05 | 7 | - | - |
| 06 | 6 | - | - |

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
- [Phase 2]: PDF source path corrected to `$HOME/Projects/rfc_profiles/rfc_profiles/` (PROJECT.md context bullet updated; prior value `~/Desktop/rfc_profiles/` was a planning-doc typo — files were never at that path).
- [Phase 2]: Import pipeline uses a separate server-side admin client (`scripts/lib/supabase-admin.ts`) that reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. The frontend `src/lib/supabase.ts` (anon key + `VITE_` prefix) is never imported by scripts/, preventing service-role key leakage into the browser bundle.
- [Phase 2]: Per-sale atomicity is enforced via a security-definer Postgres RPC (`import_sale_with_departments`) with EXECUTE granted to `service_role` only. If any department row fails, the sale row rolls back with it. Reuse the same RPC for Phase 10 scraper — no client-side transaction logic needed.
- [Phase 2]: Cross-validation tolerance fixed at ±$0.25 (configurable via `--cross-validation-tolerance`). Chosen empirically to cover `numeric(14,2)` rounding drift across up to ~20 department rows per sale. Mismatches set `sales.validation_warning = true` but do NOT fail the insert — the flag is for later human review.
- [Phase 2]: Unknown department codes encountered during import are inserted into `departments` with `auto_discovered = true` and the display_name parsed from the PDF page footer. This avoids a mid-run failure on new codes and lets the team triage/rename later via a simple DB update.
- [Phase 2]: Empty-placeholder PDFs (1182-byte files with no extractable text — RFC's marker for withdrawn/cancelled sales, ~62 of the 457) are classified as `skipped: empty_placeholder` (NOT `failed`), so the CLI exit code + scraper_runs status reflect real failures only.
- [Phase 2]: Two-tier confirmation gates live writes: pre-flight banner (source dir + target Supabase URL + file count + mode) followed by a 3-second Ctrl+C window before any insert. Addresses T-05 (wrong-DB target) from the Plan 02-05 threat register.
- [Phase 2]: Live 457-PDF import (DATA-01 completion) is deferred pending operator adding the service role key to `.env.local`. All 7 DATA-XX requirements are currently marked `Partial (Phase 2)` in REQUIREMENTS.md — status will flip to `Complete` after the live run + 10-sale spot-check.

### Pending Todos

- [Phase 2 / DATA-01]: Operator to add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, then run `npm run import:pdfs` live against the 457 PDFs. After the run completes, spot-check 10 sales against source PDFs (5 `IT*` + 5 numeric, per Plan 02-05 Task 2), then flip DATA-01..07 from `Partial (Phase 2)` to `Complete` in REQUIREMENTS.md and close out ROADMAP.md Phase 2.

### Blockers/Concerns

- Phase 2 (PDF Import): Live 457-PDF run deferred pending operator adding `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. Pipeline is built, unit-tested, and integration-tested (dry-run against 3 real PDFs succeeded) — only the live write + spot-check remain. PDF format variance was validated on sampled files during Phases 02-01..02-04; full-corpus confirmation is what the pending live run provides.
- Phase 10 (RFC Scraper): RFC site structure, login flow, and session handling are complete unknowns -- research needed before planning
- Phase 7 (Team Activity): Extension analytics_events table depends on Cataloger Extension v2.0 shipping

## Session Continuity

Last session: 2026-04-21
Stopped at: Plan 02-05 Task 1 complete (README + PROJECT + REQUIREMENTS + STATE updated, SUMMARY written as `partial`). DATA-01 live 457-PDF import deferred pending operator adding SUPABASE_SERVICE_ROLE_KEY to .env.local.
Resume file: .planning/phases/02-pdf-import-pipeline/02-05-PLAN.md (Task 2 — human-verify live run + 10-sale spot-check)
