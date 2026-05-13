---
phase: 01-foundation-auth
plan: 05
subsystem: infra
tags: [readme, vercel, deploy, qa, documentation]

requires:
  - phase: 01-foundation-auth
    provides: Working auth UI, dashboard shell, and migrated Supabase schema (Plans 01-01 through 01-04)
provides:
  - README.md at repo root documenting stack, setup, scripts, forbidden commands, deploy steps, phase history
  - REQUIREMENTS.md AUTH-03 traceability row annotated with v1 single-admin interpretation (specialist view deferred to v2)
  - STATE.md decision log with 6 Phase 1 locked decisions (single-admin, forbidden CLI, display_name token, shared Supabase, numeric(14,2), TPC App migration shims)
  - VALIDATION.md flipped to nyquist_compliant=true, wave_0_complete=true
  - Manual QA (browser flow + SQL RLS checks) confirmed by user
affects: [02-pdf-import, 03-sale-views, 10-rfc-scraper]

tech-stack:
  added: [README.md]
  patterns:
    - "Vercel deploy deferred from Phase 1 — marked as Pending on INFR-01 until user ships"

key-files:
  created:
    - "README.md"
    - ".planning/phases/01-foundation-auth/01-05-SUMMARY.md"
  modified:
    - ".planning/REQUIREMENTS.md (AUTH-03 row)"
    - ".planning/STATE.md (Phase 1 decision log + position)"
    - ".planning/phases/01-foundation-auth/01-VALIDATION.md (frontmatter flipped)"

key-decisions:
  - "Vercel deploy deferred to a later cycle at user's request; INFR-01 stays Pending in REQUIREMENTS traceability."
  - "Phase 1 manual QA (browser login flow + SQL RLS checks) confirmed by user; no gaps surfaced."

patterns-established: []

requirements-completed: [INFR-01-partial, AUTH-03]

duration: 50min
completed: 2026-04-21
---

# Phase 01 Plan 05 Summary

**Phase 1 shipped with docs, decision log, and manual-QA gate passed; Vercel deploy deferred to a later cycle per user direction.**

## Performance

- **Duration:** ~50 min (incl. user QA time + automated suite)
- **Tasks:** 2/2 (Task 1 autonomous, Task 2 user-verified)
- **Files modified:** 5 (README.md, REQUIREMENTS.md, STATE.md, VALIDATION.md, 01-05-SUMMARY.md)

## Accomplishments

- **Docs landed:** README.md at repo root covers tech stack, setup, scripts (`dev / build / lint / test / preview / db:push / db:types`), env vars, Supabase CLI link flow, forbidden commands (`supabase db pull`, `supabase db reset --linked`), single-admin access model, and Vercel deploy steps.
- **REQUIREMENTS.md:** AUTH-03 row annotated — v1 interpretation is "specialist blocked at auth gate (single-admin access model per CONTEXT.md). Specialist-restricted view deferred to v2." Aligns with Research Assumption A8.
- **STATE.md:** 6 Phase 1 decisions logged (single-admin access, forbidden Supabase commands, display_name vs full_name, shared Supabase project, numeric(14,2) money columns, TPC App migration shims rationale).
- **Manual QA passed:** user confirmed browser QA (login → dashboard → signout flow + AccessDenied screen) and SQL RLS checks (anon cannot SELECT sales, relrowsecurity=true on all 5 tables, 22 departments seeded).
- **Vercel deferred:** user chose to postpone deploy; INFR-01 stays Pending in REQUIREMENTS traceability until a future cycle.
- **Automated gate (post-QA):** `npm run lint` exits 0, `npm run build` exits 0 (458.84 kB JS / 134.95 kB gzipped), `npx vitest --run` 5 files / 22 tests pass (supabase-client + auth-store + schema-shape + login-page + protected-route).

## Task Commits

1. **Task 1:** Docs — README.md + REQUIREMENTS.md (AUTH-03) + STATE.md (decisions) — `ffe6d12`
2. **Task 2:** Manual QA checkpoint + VALIDATION finalization — this commit

## Decisions Made

- **Vercel deploy deferred.** User chose the "QA passed, Vercel deferred" path after Part A/B confirmed local dev + RLS working. INFR-01 stays Pending. Recommendation: revisit before Phase 2 ships to avoid coupling Phase 2 import work to a non-deployed dashboard.
- **Stale worktree cleanup required for clean vitest runs.** After Waves 1–5 merged, `.claude/worktrees/agent-*/` directories persisted on disk (git worktree remove only cleans git metadata, not the filesystem) and vitest's default test glob was picking them up (78 duplicate tests). Cleaned them by `rm -rf .claude/worktrees` post-merge. **Future waves:** orchestrator should add a worktree fs-cleanup step after `git worktree remove`.

## Deviations from Plan

### Auto-fixed Issues

**1. `npm run db:types` script points at global `supabase` binary**
- **Found during:** Plan 01-02 Task 3 type regeneration, re-surfaced in README validation.
- **Issue:** On Windows without a global `supabase` install, `supabase gen types ...` fails because the CLI is only installed as a devDependency.
- **Fix:** README documents canonical invocation as `npx supabase gen types ...`. The package.json script remains as-is for parity with TPC App; users following the README use `npx`.
- **Verification:** README contains `npx supabase` usage examples.
- **Committed in:** `ffe6d12`.

**2. Stale worktree directories inflated vitest discovery**
- **Found during:** Plan 01-05 Task 2 automated gate.
- **Issue:** `git worktree remove --force` cleans `.git/worktrees/*` metadata but leaves `.claude/worktrees/agent-*/` on disk. Vitest's default glob `**/*.test.*` then re-discovers the artifact directories, inflating the run to 18 files / 78 tests.
- **Fix:** `rm -rf .claude/worktrees` post-merge. Not checking this into git (directory didn't exist in tree). Future cleanup belongs in the worktree cleanup bash block in execute-phase.md.
- **Verification:** After cleanup, `npx vitest --run` shows 5 files / 22 tests as expected.
- **Committed in:** none — filesystem-only operation.

---

**Total deviations:** 2 auto-fixed (both Windows/Vitest tooling workarounds).

## Issues Encountered

None critical. See "Stale worktree directories" above for a recurring-pattern concern the orchestrator should address.

## User Setup Required

`.env.local` is populated (by orchestrator during Plan 01-02). Vercel setup deferred to later cycle — tracked in REQUIREMENTS.md INFR-01 as Pending.

## Next Phase Readiness

- Phase 2 (PDF Import Pipeline) unblocked: all 5 dashboard tables exist with RLS, auth flow works, `numeric(14,2)` money columns ready for financial data.
- Recommendation: deploy to Vercel before Phase 2 ships or before user-acceptance testing starts, to close INFR-01.
- Specialist-restricted-view deferred to v2 per AUTH-03 annotation.

---
*Phase: 01-foundation-auth*
*Completed: 2026-04-21*
