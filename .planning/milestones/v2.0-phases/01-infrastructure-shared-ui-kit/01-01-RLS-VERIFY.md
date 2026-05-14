# Plan 01-01 Task 7 — Three-Client RLS Verification (RESOLVED: 5/5 pass)

**Generated:** 2026-04-28
**Continuation agent:** third resume (post-`05fb850` CHECK-drop fix); resolution appended after operator credential fix.
**Verifier:** `scripts/verify-analytics-rls.ts` (authored in plan 01-03; bug-fixed in this run — see § "Verifier Bugs Fixed")
**Outcome:** All 5 D-24 properties verified PASS against the live shared-prod `analytics_events` table after non-admin credential was corrected. Initial run was 4/5 PASS + 1 BLOCKED on a case-sensitivity typo in `TEST_NONADMIN_PASSWORD` — see § "Resolution" at end.

## Verifier output (verbatim)

```
WARN: non-admin signIn failed (Invalid login credentials); property (b) will be reported as BLOCKED.
=== PHASE 1 INFR-05 D-24 VERIFICATION ===
(a) admin SELECT: pass (returned 1 rows)
(b) non-admin SELECT: BLOCKED (non-admin signin failed: Invalid login credentials; populate TEST_NONADMIN_PASSWORD in scraper/.env with the actual password for josh@potomackco.com and re-run)
(c) anon INSERT: pass (status=201)
(d) admin SELECT round-trip: pass (saw id=aae3966a-8a36-440a-8c1f-edb03a95e0d8)
(e) cleanup: pass

1 step(s) BLOCKED (test-environment issue, not a policy bug).

4 of 5 steps passed; 1 BLOCKED. Resolve the BLOCKED prerequisite(s) and re-run for a full pass.
```

Exit code: **4** (reserved for blocked-but-not-failed; failure exits 3, full pass exits 0).

## Property-by-property analysis

### (a) admin SELECT — PASS

The admin client (signed in as `info@potomackco.com`, a `role=admin` profile) successfully SELECTed from `public.analytics_events` via the `analytics_admin_select` policy installed by `20260424120500`. The policy is wired correctly:

```
policyname              | permissive | roles           | cmd    | qual
------------------------|------------|-----------------|--------|------------------------------------------
analytics_admin_select  | PERMISSIVE | {authenticated} | SELECT | ( SELECT private.is_admin() AS is_admin)
```

`private.is_admin()` was installed by `20260421000006_rls_helper_functions.sql` (already applied in shared-prod by the TPC App side; recorded as applied in our tracker via the second-continuation shim repair). The `(select ...)` subquery wrapper is the TPC App pattern for statement-level caching (RESEARCH § "URL-State Hook Patterns" — well-documented).

### (b) non-admin SELECT — BLOCKED

Non-admin signin failed with "Invalid login credentials". The non-admin user `josh@potomackco.com` exists in `public.profiles` (verified via direct DB query):

```
   email                | role       | is_active
   -------------------- | ---------- | ---------
   josh@potomackco.com  | specialist | true
```

But the password in `scraper/.env` (`TESTER`) does not authenticate against `auth.users`. Either the password is stale or was never set to that value. Property (b) cannot run until this is resolved — see "Operator action required" below.

**Important:** the migration's RLS shape is independently verifiable as correct for this property. The policy `analytics_admin_select` targets `to authenticated` and gates on `private.is_admin()`. A non-admin `authenticated` session would call `private.is_admin()`, which returns `false` for any profile where `role != 'admin'`, so the SELECT would return zero rows. There is no `analytics_specialist_select` or `analytics_authenticated_select` policy that could leak rows. Property (b) is structurally correct; only the live credentialed run is blocked.

### (c) anon INSERT — PASS

The anon client (no signin — bare `apikey`) successfully INSERTed a fixture row via the `analytics_insert_anon` policy. The policy is wired correctly:

```
policyname              | permissive | roles  | cmd    | qual | with_check
------------------------|------------|--------|--------|------|-----------
analytics_insert_anon   | PERMISSIVE | {anon} | INSERT | NULL | true
```

The migration `drop policy if exists "analytics_insert_anon"` cleanly replaced the extension's pre-existing live policy (silent success — no NOTICE), then `create policy "analytics_insert_anon" ... with check (true)` reinstalled it with the documented `with check (true)` semantics. Anon has `INSERT` grant on the table (verified via `information_schema.role_table_grants`).

### (d) admin SELECT round-trip — PASS

After the anon INSERT, the admin client successfully SELECTed the fixture row by id. Confirms the admin SELECT policy returns ALL rows (not filtered by user_email or any per-row scope) — exactly the D-24 expectation.

### (e) cleanup — PASS

Service-role DELETE removed the fixture row. Service role bypasses RLS, so this is a sanity check that the table is reachable; confirmed.

## Verifier Bugs Fixed (Rule 1 deviation)

Two bugs in `scripts/verify-analytics-rls.ts` (authored in plan 01-03) were fixed inline as Rule 1 deviations during this run:

### Bug 1: anon INSERT used `.select('id').single()`

PostgREST translates `.insert(row).select('id').single()` into `INSERT ... RETURNING id`. The `RETURNING` clause is checked against SELECT RLS, not INSERT RLS. Since the migration deliberately installs NO SELECT policy for anon (D-24 expects anon to be unable to SELECT), the RETURNING fails with PG error code 42501 ("new row violates row-level security policy"). The INSERT itself is allowed by `analytics_insert_anon`; only the read-back fails.

**Fix:** Replace `.insert(row).select('id').single()` with bare `.insert(row)` (no read-back). Look up the inserted id via the admin client (uses service-role grant to bypass anon's missing SELECT policy) by querying for the unique `user_email` we set on the fixture row. Documented inline with the PostgREST/PG quirk explanation so future readers understand why.

### Bug 2: non-admin signin failure FATAL-aborted the entire script

The script previously called `process.exit(2)` on non-admin signin failure, which prevented properties (a), (c), (d), (e) from running even though they don't depend on the non-admin client. Operationally this turned a "1 step BLOCKED" situation into an opaque FATAL error.

**Fix:** Defer the non-admin signin failure: record a `nonAdminAvailable` boolean and a `blocked` counter; report property (b) as BLOCKED with a clear remediation hint; continue running the other 4 properties; exit code 4 reserved for "blocked-but-not-failed" (vs exit 3 for actual failures and exit 0 for full pass).

## Operator action required

To complete property (b) and reach the full 5/5 D-24 verification, the operator must resolve the non-admin credential. Three paths:

| Path | Action | Mutation scope |
|------|--------|----------------|
| **A — Update `scraper/.env`** | Set `TEST_NONADMIN_PASSWORD` to the actual current password for `josh@potomackco.com` and re-run `npx tsx scripts/verify-analytics-rls.ts` | None (local only — `scraper/.env` is gitignored) |
| **B — Reset josh's password via service-role admin API** | Run a one-shot script that calls `supabase.auth.admin.updateUserById()` to set josh's password to `TESTER`, then re-run | Mutates live `auth.users` row for josh@potomackco.com |
| **C — Create a new dedicated test non-admin user** | Sign up a fresh non-admin user (e.g., `rls-tester@potomackco.com`) and update both `TEST_NONADMIN_EMAIL` and `TEST_NONADMIN_PASSWORD` in `scraper/.env`; ensure the new user has `role=specialist` (or any non-admin) and `is_active=true` in `public.profiles` | Mutates live `auth.users` and `public.profiles` |

**Recommendation:** Path A (no live mutation). The dashboard codebase has no record of which password was originally set for josh; this is something only the operator knows.

## Why this run does NOT fully complete plan 01-01

Per the orchestrator's `<destructive_action_safety>` guard:

> If RLS verifier (commit 5) fails, do NOT proceed to commits 6/7. Stop and report.

Property (b) is BLOCKED rather than FAILED, but the strict reading of the guard says "do NOT proceed." This artifact is committed; the diagnostic-script delete (commit 6) and SUMMARY.md (commit 7) are deferred until property (b) clears with a 5/5 pass.

## What this run modified (excluding pending operator action)

- Fixed `scripts/verify-analytics-rls.ts` bugs 1 + 2 (Rule 1 deviation).
- Wrote this artifact.
- Inserted + deleted one fixture row (`status=201` then service-role DELETE) — net zero rows added to live `public.analytics_events`.

No additional schema mutations. Migration tracker still shows 16/16 Phase 1 migrations in parity (per § Re-Push After CHECK Drop in `01-01-PUSH-OUTPUT.md`).

## Files referenced

- `scripts/verify-analytics-rls.ts` — verifier (modified this run; commit follows)
- `scripts/enumerate-event-types.ts` — diagnostic from prior commit (still present at HEAD; will be deleted in commit 6 once property (b) clears)
- `supabase/migrations/20260424120500_create_analytics_events.sql` — migration whose RLS policies are verified by 4/5 properties
- `scraper/.env` — must be updated by operator before property (b) can run (path A)

## Resolution (2026-04-28)

Operator chose Path A. Root cause: case-sensitivity typo — actual non-admin password is `Tester`, not `TESTER`. After correcting `TEST_NONADMIN_PASSWORD` in `scraper/.env`, the verifier was re-run:

```
=== PHASE 1 INFR-05 D-24 VERIFICATION ===
(a) admin SELECT: pass (returned 1 rows)
(b) non-admin SELECT: pass (0 rows)
(c) anon INSERT: pass (status=201)
(d) admin SELECT round-trip: pass (saw id=a18767a7-fcd7-4b56-90e3-90e780f3f399)
(e) cleanup: pass

All 5 steps passed.
```

Exit code: **0** (full pass). All five D-24 properties now verified live against shared-prod. Property (b) confirms the non-admin authenticated session sees zero rows from `analytics_events` — the `analytics_admin_select` policy correctly gates SELECT on `private.is_admin()` returning `false` for `role=specialist`. Plan 01-01 Task 7 fully complete.
