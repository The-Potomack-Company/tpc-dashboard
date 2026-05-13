---
phase: 01-infrastructure-shared-ui-kit
plan: 01
subsystem: database
tags: [supabase, postgres, rls, migration, schema-drift, analytics_events]

requires:
  - phase: v1.0 archive
    provides: pre-existing analytics_events table created by TPC AI Cataloger extension; private.is_admin() helper installed by TPC App migrations
  - phase: 01-02
    provides: scraper/lib/supabase-admin.getAdminClient() (service-role client); scripts/check-no-service-role-in-src.mjs prebuild guard
  - phase: 01-03
    provides: 20260424120500_create_analytics_events.sql migration body; scripts/verify-analytics-rls.ts three-client verifier; scripts/verify-migration-shape.mjs static linter
provides:
  - Live shared-prod schema in parity with local migration directory (16/16 Phase 1 migrations applied; zero orphans)
  - public.analytics_events with admin-only SELECT RLS (analytics_admin_select) preserving extension's anon INSERT policy
  - Regenerated src/db/database.types.ts with no v1.0 table references and full live analytics_events shape
  - Three operational artifacts (DRIFT-REPORT, PUSH-OUTPUT, RLS-VERIFY) documenting the live remediation
affects: [02-extension-analytics, 04-live-rfc-scraper, 06-vercel-production-deploy]

tech-stack:
  added: []
  patterns:
    - "Live-state validation before destructive db push: enumerate live data before applying CHECK constraints that mirror an upstream-owned schema"
    - "Cross-repo schema-mirror migrations should drop locally-authored constraints when the upstream app owns the vocabulary (D-22)"
    - "scraper/.env sourcing pattern (set -a; source scraper/.env; set +a) for credentialed CLI commands when SUPABASE_ACCESS_TOKEN cannot be exported in the parent shell"

key-files:
  created:
    - scripts/discover-drift.ts
    - supabase/migrations/20260424120000_drop_retired_v1_tables.sql
    - .planning/phases/01-infrastructure-shared-ui-kit/01-01-DRIFT-REPORT.md
    - .planning/phases/01-infrastructure-shared-ui-kit/01-01-PUSH-OUTPUT.md
    - .planning/phases/01-infrastructure-shared-ui-kit/01-01-RLS-VERIFY.md
    - .planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md
  modified:
    - supabase/migrations/20260424120500_create_analytics_events.sql (CHECK block dropped — D-22)
    - scripts/verify-analytics-rls.ts (two bug fixes: bare INSERT without RETURNING; non-admin signin failure no longer FATAL)
    - scripts/verify-migration-shape.mjs (assertion list updated for CHECK-drop)
    - src/db/database.types.ts (regenerated post-push)

key-decisions:
  - "Operator decision gate 1: db push approved against linked shared-prod"
  - "Operator decision gate 2: Path A — mark 3 TPC App shims (20260331000000, 20260421000000, 20260421000006) as `applied` in tracker (no SQL execution); preserves TPC App as source of truth for set_updated_at() and is_admin()"
  - "Operator decision gate 3: Path B — drop CHECK constraint on analytics_events.event_type; extension owns vocabulary (D-22); aligns with PROJECT.md read-only-analytics constraint"

patterns-established:
  - "Drop-CHECK pattern for cross-repo mirrored tables: when the dashboard mirrors a schema owned by another app, the dashboard's migration must NOT install constraints (CHECK, FK, ENUM) that drift between repos. Validation is the writer's responsibility."
  - "Three-decision gate pattern for destructive shared-prod pushes: each gate is recorded in operator-action artifacts (DRIFT-REPORT, PUSH-OUTPUT, RLS-VERIFY) so the audit trail survives multiple continuations."

requirements-completed: [INFR-02]

duration: 4 days (orchestrated across 4 continuations)
completed: 2026-04-28
---

# Plan 01-01: Schema Drift Repair + Analytics Events RLS

**Repaired the v1.0 → v2.0 schema drift on the linked shared-prod Supabase project by reverting 2 v1.0 orphan tracker rows, marking 3 TPC App shim migrations applied, dropping the dashboard's CHECK constraint that conflicted with extension-introduced event types, and verifying admin-only SELECT RLS works live with all 5 D-24 properties passing.**

## Performance

- **Duration:** ~4 days (2026-04-24 → 2026-04-28; orchestrated across one parallel-wave executor + three serial continuations gated on operator decisions)
- **Started:** 2026-04-24 (initial parallel-wave dispatch alongside 01-04)
- **Completed:** 2026-04-28 (RLS verification 5/5 pass after non-admin password correction)
- **Tasks:** 7 of 7 plan tasks complete (Task 4 was a no-op per drift report)
- **Operator decision gates:** 3 (initial push approval; shim repair vs idempotent push; CHECK enum drift remediation)
- **Files modified:** 5 source files; 4 planning artifacts created/updated

## Accomplishments

- Live shared-prod schema in parity with local migration directory: 16/16 Phase 1 migrations applied, zero orphans, zero unapplied locals.
- `public.analytics_events` table preserved (extension is the writer) with the dashboard's two RLS policies installed:
  - `analytics_admin_select` — PERMISSIVE, `to authenticated`, `using (select private.is_admin())`
  - `analytics_insert_anon` — preserved verbatim from extension's existing policy (`with check (true)`).
- 6 retired v1.0 dashboard-owned tables (`import_runs`, `scraper_runs`, `saved_reports`, `sale_departments`, `sales`, `departments`) confirmed dropped (idempotent no-op against already-empty schema).
- `src/db/database.types.ts` regenerated with the full 35-column live `analytics_events` shape (extension migrations 002/003/004 added 7 columns post-mirror — exactly the D-21/D-22 forward-compat path).
- Three-client RLS verification: 5/5 properties PASS live against shared-prod (admin SELECT, non-admin SELECT zero rows, anon INSERT, admin round-trip, cleanup).

## Task Commits

Each task was committed atomically across 4 continuations. Full chain (most recent last):

### Wave 2 parallel-executor commits (01-01 partial)

1. **Task 1: Author scripts/discover-drift.ts** — `8fb4b3b` (feat)
2. **Task 3: Author drop migration for v1.0 tables** — `69cbb44` (feat)
3. **Worktree merge into feature/v2-pivot-reset** — `6171262` (chore: merge)
4. **Roadmap progress update** (orchestrator-owned) — `3ec18cf` (docs)

### First continuation (Task 2 — drift discovery + orphan repair)

5. **Task 2: Live drift discovery + 2 v1.0 orphan tracker rows reverted** — `7be7448` (docs: 01-01-DRIFT-REPORT.md)

### Second continuation (shim repair + partial push attempt)

6. **Pre-Task-5: 3 TPC App shims marked applied + initial push transaction (rolled back on CHECK violation)** — `f69c59e` (docs: 01-01-PUSH-OUTPUT.md initial)

### Third continuation (CHECK-drop + successful re-push)

7. **Diagnostic script committed as audit trail** — `5318632` (docs: scripts/enumerate-event-types.ts)
8. **Drop CHECK constraint from analytics_events migration** — `05fb850` (fix; D-22)
9. **Re-push successful: both migrations applied; live parity verified** — `80768fe` (docs: 01-01-PUSH-OUTPUT.md update)
10. **Task 6: Regenerate database.types.ts** — `5cc1739` (chore)
11. **Task 7: RLS verifier — 4/5 pass + 1 BLOCKED on credential** — `6881274` (test: 01-01-RLS-VERIFY.md initial; verifier bug fixes inline)

### Fourth resolution (operator credential correction)

12. **RLS verification 5/5 pass after `Tester` case-correction** — `1c0c6d7` (test: 01-01-RLS-VERIFY.md resolution)
13. **Remove one-shot diagnostic** — `da50d1d` (chore)
14. **Plan SUMMARY** — _this commit_ (docs)

## Files Created/Modified

### Source files

- [scripts/discover-drift.ts](scripts/discover-drift.ts) — drift enumeration script consuming the admin client. **Has known defects** (see § Issues Encountered) — drift discovery for this plan was sourced via direct CLI per RESEARCH § Pitfall 3.
- [supabase/migrations/20260424120000_drop_retired_v1_tables.sql](supabase/migrations/20260424120000_drop_retired_v1_tables.sql) — idempotent drop migration; 6 v1.0 dashboard tables; commented placeholders for RPC/view drops were unused (no candidates discovered).
- [supabase/migrations/20260424120500_create_analytics_events.sql](supabase/migrations/20260424120500_create_analytics_events.sql) — CHECK block removed; replaced with single-line comment documenting D-22 policy decision.
- [scripts/verify-analytics-rls.ts](scripts/verify-analytics-rls.ts) — verifier with two bug fixes inline (see § Deviations).
- [scripts/verify-migration-shape.mjs](scripts/verify-migration-shape.mjs) — assertion list updated to match the post-CHECK-drop migration shape.
- [src/db/database.types.ts](src/db/database.types.ts) — regenerated; 35-column analytics_events shape; no v1.0 table references.

### Planning artifacts

- [.planning/phases/01-infrastructure-shared-ui-kit/01-01-DRIFT-REPORT.md](.planning/phases/01-infrastructure-shared-ui-kit/01-01-DRIFT-REPORT.md) — Task 2 outcome.
- [.planning/phases/01-infrastructure-shared-ui-kit/01-01-PUSH-OUTPUT.md](.planning/phases/01-infrastructure-shared-ui-kit/01-01-PUSH-OUTPUT.md) — full push audit trail (initial failure + re-push success).
- [.planning/phases/01-infrastructure-shared-ui-kit/01-01-RLS-VERIFY.md](.planning/phases/01-infrastructure-shared-ui-kit/01-01-RLS-VERIFY.md) — Task 7 outcome (resolved 5/5).
- [.planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md](.planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md) — out-of-scope discoveries (npm build issue, discover-drift.ts defects).

## Decisions Made

- **Gate 2 — Shim repair (Path A):** Three TPC App shim migrations (`20260331000000_tpc_app_post_gap.sql` pure comments, `20260421000000_create_updated_at_trigger.sql` `set_updated_at()`, `20260421000006_rls_helper_functions.sql` `private.is_admin()`) appeared in the post-orphan-repair dry-run apply list. Operator chose tracker-only `migration repair --status applied` over executing the SQL — preserves TPC App as source of truth for these objects, matches the documented v1.0 Phase 1 pattern, and is reversible.
- **Gate 3 — CHECK drop (Path B / D-22):** Plan 01-03 mirrored extension migration 001 verbatim, hardcoding a 5-value CHECK on `event_type`. Live shared-prod has 5 distinct values too — but the set differs: live has `catalog_item` (15 rows, dominant) which post-dates migration 001; the extension renamed `catalog_batch` → `catalog_item`. Live diagnostic confirmed 24 rows split across {catalog_item: 15, portal_upload: 3, spreadsheet_transform: 3, catalog_single: 2, data_import: 1}. Operator chose to drop the CHECK rather than expand it — extension owns the vocabulary, dashboard reads what's there. Aligns with PROJECT.md "read-only analytics" constraint and avoids ongoing cross-repo migration coupling.
- **Resolution — credential correction:** Property (b) BLOCKED on a case-sensitivity typo in `TEST_NONADMIN_PASSWORD` (`TESTER` vs actual `Tester`). Operator-supplied correction; no auth.users mutation needed. The diagnostic distinguishing "blocked" from "failed" (verifier bug fix #2) was load-bearing — without it, the operator would have seen a FATAL signin error rather than a "1 step BLOCKED, here's the fix" report.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dropped CHECK constraint after live data violated migration's hardcoded enum**
- **Found during:** Task 5 (initial db push)
- **Issue:** The migration's `add constraint analytics_events_event_type_check check (event_type in (...))` listed 5 hardcoded values mirroring extension migration 001. Live shared-prod has 5 different values (`catalog_item` replaced `catalog_batch`). SQLSTATE 23514 raised; transaction rolled back.
- **Fix:** Drop the entire CHECK block from the migration. Replace with a single comment line documenting the policy decision (D-22). Update `scripts/verify-migration-shape.mjs` to remove the CHECK assertion from its REQUIRED list.
- **Files modified:** `supabase/migrations/20260424120500_create_analytics_events.sql`, `scripts/verify-migration-shape.mjs`
- **Verification:** Re-push succeeded; both migrations applied; live parity confirmed via `migration list --linked`. Static shape verifier passes 24/24.
- **Committed in:** `05fb850` (fix); operator-approved (Gate 3 Path B).

**2. [Rule 1 - Bug] verify-analytics-rls.ts anon INSERT used `.select('id').single()` which forces RETURNING and triggers SELECT RLS**
- **Found during:** Task 7 (RLS verification, property c)
- **Issue:** PostgREST translates `.insert(row).select('id').single()` into `INSERT ... RETURNING id`. The RETURNING clause is checked against SELECT RLS, not INSERT RLS. The migration deliberately installs NO SELECT policy for anon (D-24), so RETURNING failed with PG 42501 — even though the INSERT itself was permitted.
- **Fix:** Replace with bare `.insert(row)` (no read-back). Look up the inserted id via the admin client's service-role grant, querying for the unique `user_email` set on the fixture row.
- **Files modified:** `scripts/verify-analytics-rls.ts`
- **Verification:** Property (c) PASS in commit `6881274` and confirmed in commit `1c0c6d7`.
- **Committed in:** `6881274` (Task 7 commit).

**3. [Rule 1 - Bug] verify-analytics-rls.ts FATAL-aborted on non-admin signin failure**
- **Found during:** Task 7 (RLS verification, property b initial run)
- **Issue:** The script called `process.exit(2)` on non-admin signin failure, short-circuiting properties (a), (c), (d), (e) which don't depend on the non-admin client. This turned a "1 step BLOCKED on credential" situation into an opaque FATAL error.
- **Fix:** Defer non-admin signin failure: track a `nonAdminAvailable` boolean and `blocked` counter; report property (b) as BLOCKED with a clear remediation hint; continue running the other 4 properties; reserve exit code 4 for "blocked-but-not-failed" (vs exit 3 for actual failures, exit 0 for full pass).
- **Files modified:** `scripts/verify-analytics-rls.ts`
- **Verification:** Initial run produced "1 BLOCKED, 4 PASS" report (commit `6881274`); after credential fix, exit 0 with "All 5 steps passed" (commit `1c0c6d7`).
- **Committed in:** `6881274` (Task 7 commit).

---

**Total deviations:** 3 auto-fixed (1 schema drift fix from Gate-3 operator decision; 2 verifier bugs from plan 01-03 surfaced by live execution).
**Impact on plan:** All three were necessary for correctness. Deviation #1 was operator-approved at Gate 3. Deviations #2 and #3 are bug fixes to plan 01-03's verifier — flagged here in 01-01's history because they were surfaced by exercising the verifier against live data, which 01-03's static shape verifier could not catch. Per operator direction (post-Gate-3 question), the fixes stay in 01-01 commit history; 01-03's SUMMARY (already committed) does not need a follow-up plan.

## Issues Encountered

### 1. Plan 01-03 assumption A1 violated by reality (CRITICAL — informs future cross-repo plans)

Plan 01-03 documented assumption A1: "extension migrations 002/003/004 are not yet applied to shared-prod." Live state proved this false — the extension shipped event_type changes (`catalog_batch` → `catalog_item`) and additional columns post-migration-001. The "mirror migration 001 verbatim" approach captured a stale snapshot, and the static migration-shape verifier (`scripts/verify-migration-shape.mjs`) cannot detect this because it doesn't query live state.

**Recommendation for future cross-repo migration mirrors:** Add a "live-state validation" step to RESEARCH/PLAN: enumerate distinct values for any column that gets a CHECK constraint, run against shared-prod BEFORE pushing. If divergence is found, decide between (a) dropping the constraint, (b) updating to match live, or (c) inserting a coordinating migration in the upstream repo first. The diagnostic at the now-deleted `scripts/enumerate-event-types.ts` (commit `5318632` → `da50d1d`) is the template for this pattern.

### 2. scripts/discover-drift.ts has two defects (non-blocking — Task 2 was sourced via direct CLI)

(a) **PostgREST PGRST106 — `Invalid schema: information_schema`.** PostgREST does not expose `information_schema` even to service-role over REST. The script's `admin.schema('information_schema').from('tables').select(...)` calls all fail. Drift discovery for this plan was performed using `npx supabase migration list --linked` directly, per RESEARCH § Pitfall 3 fallback. To fix: add a security-definer wrapper RPC in `public` (e.g. `public.list_public_objects()`) that the admin client calls via `admin.rpc(...)`, OR switch the script to use the `pg` driver against the Postgres connection string.

(b) **Migration-list parser regex mismatch.** The script's remote-only-migration regex uses Unicode `│` (U+2502), but the Supabase CLI on Windows outputs ASCII `|`. Even if defect (a) were fixed, the parser would return 0 remote-only migrations on a drifted Windows project. Fix: replace `│` with `[│|]` or detect line-format dynamically.

Both defects are non-blocking for plan 01-01 since the operator and continuation agents used the CLI directly. Both should be addressed before this script is needed again (e.g., a Phase 6 pre-deploy schema-parity check). Logged in `deferred-items.md`.

### 3. npm run build fails — date-fns/date-fns-tz missing from node_modules (non-blocking — Plan 01-04 follow-up)

After Task 6 regenerated types, `npm run build` exited non-zero because `date-fns` and `date-fns-tz` (declared in `package.json` by plan 01-04 commit `837186a`) are not present in the working tree's `node_modules`. Likely cause: the worktree-merge flow merged `package.json`/`package-lock.json` changes from 01-04 but didn't run `npm install` in the merged main working tree. Fix: `npm install` from the repo root. Logged in `deferred-items.md`.

This does NOT affect the live db push outcome — the migration applies independently of the frontend build.

### 4. SUPABASE_ACCESS_TOKEN unavailable to subprocesses (operational note)

The PAT was set in the user's PowerShell session AFTER Claude Code launched, so subprocesses spawned by the orchestrator could not see it. Resolved by appending `SUPABASE_ACCESS_TOKEN=...` to `scraper/.env` (gitignored) and using a `set -a; source scraper/.env; set +a; <cmd>` sourcing pattern for every credentialed CLI command. This is the documented convention going forward — see CLAUDE.md and `01-01-PUSH-OUTPUT.md`.

## User Setup Required

None for this plan. The credential setup performed during execution (populating `scraper/.env` with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`/`TEST_*`/`SUPABASE_ACCESS_TOKEN`) is operational and was completed mid-flight. The file is gitignored; future fresh-clone setup is covered by `scraper/.env.example` and the conventions documented in `CLAUDE.md` (added by plan 01-02).

## Next Phase Readiness

- **Phase 1 INFR-02 requirement is met:** schema drift repaired, both v2.0 migrations applied, live parity verified.
- **Phase 1 INFR-05 requirement is met:** admin-only SELECT RLS live and verified end-to-end via three-client test.
- **Wave 3 (plan 01-05) ready to execute:** the UI-kit primitives plan does not depend on this plan's outputs, but `database.types.ts` is now in its final shape so any kit component that imports DB types (`<PayloadViewerModal>` payload typing) will see correct schema.
- **Phase 2 (extension analytics) ready:** the `/extension` route can read `analytics_events` via the admin SELECT policy; types are in place; `private.is_admin()` is verified live.
- **Carry-over to deferred-items.md:** discover-drift.ts defects (non-blocking) and npm build issue (Plan 01-04 follow-up).

## Self-Check

- [x] All 7 plan tasks complete (Task 4 confirmed no-op per drift report)
- [x] All 5 D-24 RLS properties verified PASS live against shared-prod
- [x] Both v2.0 migrations applied; live parity confirmed via `migration list --linked`
- [x] No retired v1.0 tables remain in `database.types.ts`
- [x] All commits atomic and properly scoped to single tasks
- [x] STATE.md and ROADMAP.md NOT modified by this plan (orchestrator owns those writes)
- [x] Three operator decision gates documented with chosen path and rationale
- [x] All deviations are bug fixes or operator-approved policy changes — no scope creep
- [x] Open issues logged in deferred-items.md for non-blocking follow-ups

---
*Phase: 01-infrastructure-shared-ui-kit*
*Plan: 01-01*
*Completed: 2026-04-28*
