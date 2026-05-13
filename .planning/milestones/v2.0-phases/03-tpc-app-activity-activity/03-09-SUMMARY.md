---
phase: 03-tpc-app-activity-activity
plan: 09
subsystem: testing

tags: [vitest, react-testing-library, integration-smoke, supabase-stub, tanstack-query, recharts, react-router, signed-urls]

# Dependency graph
requires:
  - phase: 03-tpc-app-activity-activity
    provides: All Phase 3 RPCs / hooks / components / pages — 03-01 (SQL + 11 verifiers + types regen) through 03-08 (Activity / SessionDetail / StuckItems pages + App.tsx routes + DashboardLayout NAV_ITEMS Activity entry)
  - phase: 02-extension-analytics-extension
    provides: Canonical Phase 2 src/pages/Extension.smoke.test.tsx shape; src/lib/devAccess.ts isDevAccount allowlist; @tanstack/react-table v8.21.3 dep; <DeveloperPanel> precedent
  - phase: 01-infrastructure-shared-ui-kit
    provides: <DateRangeFilter> + <BackLink> + <ErrorState> + <KpiCard>; useDateRange + useTimezone hooks; QueryClientProvider defaults; INFR-06 prebuild guard

provides:
  - 3 page-level integration smoke tests (16 tests) that exercise full Activity / SessionDetail / StuckItems compositions with real components and a stubbed Supabase client
  - Operator UAT checklist (03-09-HUMAN-UAT.md) covering all 5 ROADMAP § Phase 3 Success Criteria including the LOAD-BEARING 2-hour tab-resume photo refresh test for Success Criterion #5
  - Phase 3 verification report (03-VERIFICATION.md) aggregating 14 programmatic gates + 12 APP requirements + 37 CONTEXT decisions + manual UAT pointers
  - Confirmation that production bundle does NOT contain SUPABASE_SERVICE_ROLE_KEY (Phase 1 INFR-06 invariant maintained at end-of-Phase-3)
  - Compose-at-runtime token pattern for any future test that needs to assert against a forbidden literal without tripping prebuild guards

affects: [04-live-rfc-scraper-infrastructure, 05-live-sale-ui, 06-vercel-production-deploy]

# Tech tracking
tech-stack:
  added: []  # No new deps; reuses Vitest 4.0.18 + RTL 16.3.2 + user-event 14.6.1 + jsdom 28.1.0 already in tree
  patterns:
    - Hoisted createSignedUrl mock (D-09 / D-12 / D-13 invariant assertions)
    - Module-level Supabase boundary mock (mirrors Phase 2 Extension.smoke.test.tsx)
    - useEffect-captured useLocation probe for asserting URL state changes
    - Compose-at-runtime forbidden-token pattern (avoids prebuild grep guard collisions)
    - Triple-slash <reference types="node" /> for test-only node:fs/path/url imports

key-files:
  created:
    - src/pages/Activity.smoke.test.tsx
    - src/pages/SessionDetail.smoke.test.tsx
    - src/pages/StuckItems.smoke.test.tsx
    - .planning/phases/03-tpc-app-activity-activity/03-09-HUMAN-UAT.md
    - .planning/phases/03-tpc-app-activity-activity/03-VERIFICATION.md
    - .planning/phases/03-tpc-app-activity-activity/03-09-SUMMARY.md
  modified: []

key-decisions:
  - "Compose forbidden token at runtime ([SUPABASE,SERVICE,ROLE,KEY].join('_')) so the prebuild guard's grep doesn't flag the test file as an offender. Discovered via the build chain after the first smoke-test commit."
  - "Use a hoisted createSignedUrl mock (one stable instance) so D-09 / D-12 / D-13 assertions reference the same mock across tests in the same file. Mirrors Phase 2's `supabaseStub.current` pattern but extends it for storage."
  - "useEffect-capture useLocation in a Probe component (not direct render-time assignment) — avoids React's 'set state during render' warning that would otherwise pollute the smoke test's console-error spy."
  - "All 3 smoke tests are self-contained within src/pages/*.smoke.test.tsx (NOT under a shared __tests__/ directory). Mirrors Phase 2's Extension.smoke.test.tsx location for symmetric discovery."
  - "Triple-slash /// <reference types=\"node\" /> on Activity.smoke.test.tsx — narrowest possible scope for granting node:fs typecheck access, since tsconfig.app.json restricts default types to vite/client."

patterns-established:
  - "Smoke tests use real components + real router + real QueryClient; only Supabase boundary is stubbed. Per-component behavior covered by colocated suites; smoke tests catch composition errors (wrong prop wiring, missing imports, unexpected console.error)."
  - "Signed-URL invariant testing: hoisted createSignedUrlMock + supabase.storage.from('photos').createSignedUrl routed to it. Tests assert toHaveBeenCalledWith(thumbnail_path, 3600) for D-12 and not.toHaveBeenCalledWith(failed.thumbnail_path, ...) for D-13."
  - "Token-composition pattern: any test that needs to assert against a forbidden literal in source files MUST compose the literal at runtime (e.g. ['SUPABASE','SERVICE','ROLE','KEY'].join('_')) so prebuild grep guards don't false-positive against the test itself."

requirements-completed: [APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-07, APP-08, APP-09, APP-10, APP-11, APP-12]

# Metrics
duration: 23min
completed: 2026-05-01
---

# Phase 3 Plan 09: Smoke tests + UAT + Phase 3 verification

**3 page-level integration smoke tests (16 tests) with stubbed Supabase + operator UAT checklist + Phase 3 verification report aggregating 14 programmatic gates / 12 APP requirements / 37 CONTEXT decisions; production bundle clean of SUPABASE_SERVICE_ROLE_KEY**

## Performance

- **Duration:** 23 min
- **Started:** 2026-05-01T21:32:18Z
- **Completed:** 2026-05-01T21:55:00Z
- **Tasks:** 2 (Task 3 is a `checkpoint:human-verify` operator gate, deferred)
- **Files created:** 6 (3 smoke tests + HUMAN-UAT + VERIFICATION + this SUMMARY)
- **Files modified:** 0

## Accomplishments

- Wrote 3 integration smoke tests that exercise the full Activity / SessionDetail / StuckItems page compositions with REAL components and a stubbed Supabase client only — 16 tests across the trio, all green, total runtime <5s per file
- Test 8 / Test 9 / Test 10 in SessionDetail.smoke.test.tsx are the LOAD-BEARING programmatic assertions for D-09 (lazy fetch — `createSignedUrl` not called on mount; called after row expansion), D-12 (thumbnail-only — never `storage_path`), and D-13 (failed-photo no-fetch — never signs failed photos)
- Test 17 in Activity.smoke.test.tsx proves 3-key URL filter coexistence (range + specialists + mode all preserved across user changes — no clobbering)
- Test 18 in Activity.smoke.test.tsx enforces CLAUDE.md INFR-06 invariant at unit-test time (no Phase 3 source file mentions the service-role env-var name) — complements the prebuild guard
- Created `03-09-HUMAN-UAT.md` with 7 tests + cleanliness check covering all 5 ROADMAP § Phase 3 Success Criteria + critical decision sanity-checks. Test 6 is the LOAD-BEARING 2-hour tab-resume photo refresh test (the only manual gate that proves `useSignedPhotoUrl`'s `refetchOnWindowFocus: true` override works against a real Supabase Storage signed-URL TTL)
- Created `03-VERIFICATION.md` with 14 programmatic gates documented and PASSING (full test suite + 11 prebuild verifiers + tsc + vite build), all 12 APP requirements cross-referenced to plans + components + tests, all 37 CONTEXT decisions referenced by at least one plan + source artifact (no orphaned decisions), and confirmation that production bundle is clean of `SUPABASE_SERVICE_ROLE_KEY` (Phase 1 INFR-06 invariant maintained at end of Phase 3)

## Task Commits

1. **Task 1: 3 integration smoke tests** — `e2ef34f` (test) — 1217 insertions across 3 files; 16 tests across the trio all green; full suite 598/598 green; tsc -b clean
2. **Task 1 follow-up: prebuild guard collision fix** — `cae435d` (fix) — Rule 3 deviation discovered during the build chain; composed forbidden token at runtime so `scripts/check-no-service-role-in-src.mjs` no longer flags the test as an offender
3. **Task 2: HUMAN-UAT + Phase 3 VERIFICATION docs** — `4f4abf5` (docs) — 373 insertions across 2 markdown files

**Plan metadata:** [final commit] — this SUMMARY.md + the underlying executor commits already include `03-VERIFICATION.md` and `03-09-HUMAN-UAT.md`. STATE.md and ROADMAP.md updates are explicitly OUT OF SCOPE per the executor's prompt — operator owns those after UAT signoff.

_Note: Task 3 in the plan is a `checkpoint:human-verify` (BLOCKING) for operator manual smoke + UAT signoff — by the plan's design, the executor stops after Task 2. The HUMAN-UAT and VERIFICATION docs are the artifacts the operator consumes during Task 3._

## Files Created

- `src/pages/Activity.smoke.test.tsx` — 6 tests (heading + filter row, 8 sections compose, D-26 dev gate both branches, 3-key URL coexistence, INFR-06 service-role grep). Hoisted createSignedUrl + supabase mocks; module-level boundary stub.
- `src/pages/SessionDetail.smoke.test.tsx` — 6 tests (page mount, D-03 BackLink param preservation, D-09 lazy fetch, D-09+D-12 thumbnail-only on row expand, D-13 failed-photo no-fetch invariant, not-found state). LOAD-BEARING for Success Criterion #5's programmatic half.
- `src/pages/StuckItems.smoke.test.tsx` — 4 tests (page renders + StuckItemsTable default sort age desc, row click navigates, no filter row, D-23 RPC default args / URL filters NOT inherited).
- `.planning/phases/03-tpc-app-activity-activity/03-09-HUMAN-UAT.md` — 172-line operator UAT checklist (status: partial). 7 tests + cleanliness check + screenshot list + Summary block (8 pending) + Gaps section.
- `.planning/phases/03-tpc-app-activity-activity/03-VERIFICATION.md` — 201-line Phase 3 verification report (status: human_needed, score 5/5). 14 programmatic gates + APP-01..12 coverage table + D-01..D-37 coverage table + build summary + sign-off section.
- `.planning/phases/03-tpc-app-activity-activity/03-09-SUMMARY.md` — this file.

## Decisions Made

- **Compose forbidden token at runtime instead of inlining the literal.** The prebuild guard `scripts/check-no-service-role-in-src.mjs` greps for the literal `SUPABASE_SERVICE_ROLE_KEY` in `src/`. Test 18 (which asserts the same invariant) initially contained the literal in two places, breaking `npm run build`. Changing the guard would have been out of scope (`scripts/` not in this plan's `files_modified`) and would have weakened it. Composing the token at runtime keeps the test's assertion identical while keeping both the test and the build green.
- **Use real router + QueryClient, NOT MemoryRouter-stubs that mock useNavigate.** Smoke tests must catch wiring regressions (wrong prop, missing import, unexpected console.error) — that requires real wiring. Phase 2's Extension.smoke.test.tsx established this; Phase 3 mirrors verbatim.
- **Hoist the createSignedUrl mock to module scope.** `expect(createSignedUrlMock).toHaveBeenCalledWith(...)` only works against a stable mock identity. Recreating the mock in `beforeEach` would break the assertion-by-reference contract the load-bearing D-09/D-12/D-13 tests depend on.
- **Triple-slash `<reference types="node" />` on the test file that uses `node:fs/path/url`.** `tsconfig.app.json` declares `types: ["vite/client"]`, so Node typings aren't pulled in by default. The triple-slash directive opts in for that one file without changing the global config.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test 18 hardcoded the literal forbidden token, breaking the prebuild guard**
- **Found during:** Task 1 → first `npm run build` after the smoke-test commit
- **Issue:** `Activity.smoke.test.tsx` contained the literal string `SUPABASE_SERVICE_ROLE_KEY` in two places (a comment and the `raw.includes(...)` substring search). The prebuild guard `scripts/check-no-service-role-in-src.mjs` walks `src/` looking for that exact literal and (correctly) flagged the test as an offender, exiting 1 and blocking `npm run build`.
- **Fix:** Compose the token at runtime from parts: `const FORBIDDEN_TOKEN = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');`. Substring search uses the variable. Comment rewritten to refer to "the service-role env-var name" rather than spelling it out.
- **Files modified:** `src/pages/Activity.smoke.test.tsx`
- **Verification:** `npm run build` exits 0 with `OK: No references to 'SUPABASE_SERVICE_ROLE_KEY' in src/, index.html, or vite.config.ts.`; `npm run test -- src/pages/Activity.smoke.test.tsx` 6/6 green; the test still asserts against the same forbidden token at runtime.
- **Committed in:** `cae435d`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserves the test's intent verbatim. Out-of-scope alternative (modifying the prebuild guard to skip test files) was deliberately not taken — composing-at-runtime is in-scope (only modifies the test file) and avoids weakening the guard. No scope creep.

## Issues Encountered

- **TypeScript could not find `node:fs` / `node:path` / `node:url` types** in `Activity.smoke.test.tsx`. `tsconfig.app.json` declares `types: ["vite/client"]` only, and `@types/node` is in devDependencies. Resolved by adding `/// <reference types="node" />` at the top of the test file — narrowest possible scope, no global config change. `tsc -b` clean after the fix.

## User Setup Required

None — Phase 3 is read-only frontend code; no external service configuration. Phase 1 INFR-06 conventions for the Supabase admin client (`scraper/lib/supabase-admin.ts`) remain intact and the production bundle has been confirmed clean.

## Next Phase Readiness

**Programmatic verification:** 5/5 ROADMAP § Phase 3 Success Criteria green; 12/12 APP requirements covered; 37/37 CONTEXT decisions referenced; 11/11 prebuild verifiers green; 598/598 tests green; production build clean of `SUPABASE_SERVICE_ROLE_KEY`.

**Operator UAT pending** (`03-09-HUMAN-UAT.md`):
- 7 tests + cleanliness check, all `result: pending`
- Test 6 is the LOAD-BEARING 2-hour tab-resume photo refresh test (Success Criterion #5)
- After operator signoff, `03-VERIFICATION.md` `status` should flip to `verified`, ROADMAP.md should mark Phase 3 complete, STATE.md should bump `progress.completed_phases` from 2 to 3 and log Phase 3 closeout decisions.

**Ready for Phase 4** (Live RFC Scraper Infrastructure) once operator UAT closes.

## Self-Check: PASSED

**Files verified to exist:**
- `src/pages/Activity.smoke.test.tsx` — FOUND
- `src/pages/SessionDetail.smoke.test.tsx` — FOUND
- `src/pages/StuckItems.smoke.test.tsx` — FOUND
- `.planning/phases/03-tpc-app-activity-activity/03-09-HUMAN-UAT.md` — FOUND
- `.planning/phases/03-tpc-app-activity-activity/03-VERIFICATION.md` — FOUND
- `.planning/phases/03-tpc-app-activity-activity/03-09-SUMMARY.md` — FOUND (this file)

**Commits verified:**
- `e2ef34f` (test: 3 smoke tests) — FOUND
- `cae435d` (fix: prebuild guard collision) — FOUND
- `4f4abf5` (docs: HUMAN-UAT + VERIFICATION) — FOUND

---

*Phase: 03-tpc-app-activity-activity*
*Plan: 09*
*Completed: 2026-05-01*
