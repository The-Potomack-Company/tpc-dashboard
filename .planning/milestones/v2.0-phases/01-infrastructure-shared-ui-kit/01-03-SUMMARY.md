---
phase: 01-infrastructure-shared-ui-kit
plan: 03
subsystem: analytics-events-rls
tags: [infrastructure, supabase, rls, migration, analytics, verification]
requires:
  - supabase/migrations/20260421000006_rls_helper_functions.sql (private.is_admin())
  - scraper/lib/supabase-admin.ts (authored in plan 01-02, parallel wave 1 agent)
provides:
  - supabase/migrations/20260424120500_create_analytics_events.sql (idempotent create + admin SELECT + anon INSERT RLS)
  - scripts/verify-analytics-rls.ts (three-client D-24 integration test)
  - scripts/verify-migration-shape.mjs (static SQL shape verifier)
affects:
  - Phase 2 (/extension) — unblocks analytics_events reads via admin policy
  - Plan 01-01 Task 5 ([BLOCKING] supabase db push applies this migration)
  - Plan 01-01 Task 7 (runs verify-analytics-rls.ts post-push)
tech-stack:
  added: []
  patterns:
    - idempotent-migration (create table if not exists + drop policy if exists / create policy)
    - DO-block-guarded-constraint-ADD (Pitfall 1: avoid duplicate-constraint error)
    - admin-RLS-subquery-wrapper ((select private.is_admin()) for statement-level caching, TPC App convention)
    - three-client-RLS-verification (admin + non-admin + anon separation; service-role for cleanup)
    - static-SQL-shape-check (regex-based presence + forbidden-content gating, sub-500ms)
key-files:
  created:
    - supabase/migrations/20260424120500_create_analytics_events.sql
    - scripts/verify-analytics-rls.ts
    - scripts/verify-migration-shape.mjs
  modified: []
decisions:
  - "Admin SELECT policy is TO authenticated (not TO anon, not TO public) — RESEARCH Pitfall 2."
  - "Admin SELECT USING clause uses (select private.is_admin()) subquery wrapper per TPC App pattern for statement-level caching."
  - "Anon INSERT policy uses drop-then-create idiom for idempotency, preserving the extension's live contract (to anon with check (true)) byte-for-byte."
  - "CHECK-constraint ADD is guarded by a DO-block pg_constraint existence check (Pitfall 1) so the migration is a no-op against the live table where extension migration 001 already installed the constraint."
  - "Columns limited to 28 (extension migration 001). Deliberately excluded: started_at, ended_at, item_index, item_status, catalog_item enum value (migrations 002/003/004 not applied; A1 in RESEARCH § Assumptions Log)."
  - "Verification harness uses three distinct Supabase clients (admin + non-admin + anon) with separate signInWithPassword calls; cleanup uses service-role getAdminClient to bypass any future row-scope DELETE policy."
metrics:
  completed: "2026-04-24T20:28:33Z"
  duration_minutes: 3
  tasks_completed: 3
  files_created: 3
  files_modified: 0
  commits: 3
---

# Phase 01 Plan 03: analytics_events Migration + RLS Verification Harness Summary

Authored the idempotent `public.analytics_events` provisioning migration (mirroring TPC AI Cataloger extension migration 001 byte-for-byte across 28 columns) plus an admin-only SELECT RLS policy gated on `private.is_admin()` and a preserved `anon INSERT` policy — then built two verification harnesses: a three-client runtime test (admin/non-admin/anon) proving D-24 compliance, and a sub-500ms static SQL shape checker asserting both required presence (all columns, both policies, CHECK guard, grants, index) and forbidden absence (migration-002/003/004 content). Migration authored + committed here; plan 01-01 Task 5 will execute the `supabase db push`.

## What Was Built

### 1. Migration: `supabase/migrations/20260424120500_create_analytics_events.sql`

- `create table if not exists public.analytics_events` with all 28 extension-migration-001 columns:
  `id, event_type, user_email, extension_version, created_at, error_message, receipt_number, category_id, detection_method, photo_count, generated_title, generated_description, field_mode, field_selection, session_id, total_items, success_count, skipped_count, error_count, execution_time_ms, cancelled, total_groups, total_photos, input_rows, output_rows, columns_mapped, import_mode, items_content`.
- `DO $$...END$$` guarded `alter table ... add constraint analytics_events_event_type_check` ensuring the CHECK is only added when absent (covers the live-table-already-has-it case where extension migration 001 installed it).
- CHECK enum values: `'catalog_single', 'catalog_batch', 'portal_upload', 'spreadsheet_transform', 'data_import'` (exactly 5 — `catalog_item` deliberately excluded per A1).
- `alter table ... enable row level security` (idempotent).
- Policy `analytics_insert_anon` — `for insert to anon with check (true)` (preserves extension contract verbatim, drop+create for idempotency).
- Policy `analytics_admin_select` — `for select to authenticated using ( (select private.is_admin()) )` (NEW — this plan's INFR-05 target).
- Explicit grants: `grant insert on public.analytics_events to anon; grant select on public.analytics_events to authenticated;`.
- Composite index `analytics_events_event_type_created_at_idx on (event_type, created_at desc)`.
- Committed as `7a5edd6`.

### 2. Runtime RLS Verification: `scripts/verify-analytics-rls.ts`

Three-client integration test covering D-24 steps (a)-(e):

- **(a)** Admin session `select id from analytics_events limit 1` → expect success.
- **(b)** Non-admin authenticated session `select id from analytics_events` → expect 0 rows (RLS blocks).
- **(c)** Anon session `insert { event_type: 'catalog_single', user_email: 'rls-verify@fixture.invalid', extension_version: '0.0.0-rls-verify', items_content: { __rls_verify__: true, ts } }` → expect success.
- **(d)** Admin session `select id, event_type, user_email where id = <fixture>` → expect the inserted row (round-trip confirmation).
- **(e)** Cleanup via `getAdminClient()` (service-role) `delete where id = <fixture>`.

Exit codes: 0 on all pass, 1 on missing env, 2 on auth failure, 3 on any step fail, 99 on unhandled exception. Fixture uses RFC-2606 invalid TLD + `__rls_verify__` marker so accidental retention is discoverable. Committed as `0aee749`.

### 3. Static SQL Shape Verifier: `scripts/verify-migration-shape.mjs`

Zero-DB-dependency file-content inspection that runs in <500ms (measured: ~60ms). Asserts 20 "must contain" checks (create table, all 28-spot-check columns, 5 CHECK enum values, DO-block guard, RLS enable, both policies with drop+create, correct roles, correct USING clause, both grants, composite index) and 5 "must NOT contain" checks (no `catalog_item`, no `started_at`, no `ended_at`, admin policy body does not target `to anon`, admin policy body does not target `to public`). Result: **25/25 pass, exit 0**. Committed as `fd2a1c4`.

## Execution Log

| Task | Name                                      | Commit  | Files Created                                                 | Verify Result |
| ---- | ----------------------------------------- | ------- | ------------------------------------------------------------- | ------------- |
| 1    | Author migration SQL                      | `7a5edd6` | `supabase/migrations/20260424120500_create_analytics_events.sql` | All 7 grep asserts pass (28 columns matched) |
| 2    | Author three-client RLS verify script     | `0aee749` | `scripts/verify-analytics-rls.ts`                             | All 5 grep asserts pass (imports, signInWithPassword, fixture marker) |
| 3    | Author static shape verifier + run on T1  | `fd2a1c4` | `scripts/verify-migration-shape.mjs`                          | 25/25 pass, exit 0, 60ms |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed over-broad regex in scripts/verify-migration-shape.mjs FORBIDDEN checks**

- **Found during:** Task 3 — initial run of `node scripts/verify-migration-shape.mjs` reported `FORBIDDEN CONTENT PRESENT: Admin SELECT must NOT target anon` despite the migration being correct.
- **Issue:** The plan-supplied regex `/analytics_admin_select[\s\S]+?to\s+anon/i` uses `[\s\S]+?` which spans across statement boundaries. Since the migration has the admin SELECT policy on line ~82-86 followed four lines later by `grant insert on public.analytics_events to anon;`, the regex matched the `grant ... to anon` as if it were inside the admin SELECT policy body. This would have made the verifier reject every correctly-authored migration — a high-severity bug since the script is intended to be a pre-push gate.
- **Fix:** Replaced `[\s\S]+?` with `[^;]*?` in both anon/public FORBIDDEN regexes, scoping the match to the policy-terminating semicolon. Added comment explaining the reasoning. Ran a node-one-liner negative-case test: `create policy "analytics_admin_select" ... to anon` → DETECTED (correct); current correct file → clean pass (correct). Also added `\b` word boundaries around `anon` / `public` for safety.
- **Files modified:** `scripts/verify-migration-shape.mjs`
- **Commit:** `fd2a1c4` (bundled with Task 3's initial commit — fix was applied before first commit of the file)

### Checkpoints / Auth Gates

None. All three tasks were `type="auto"` and ran fully autonomously.

## Known Stubs

None. No UI rendering or placeholder data introduced; all files are self-contained migrations/scripts.

## Threat Flags

None. The plan's `<threat_model>` already enumerates all relevant trust boundaries and threats for the analytics_events surface (T-1-RLS, T-1-INS, T-1-SCHEMA, T-1-COL-DRIFT, T-1-PII, T-1-VERIFY-DATA). No new attack surface introduced outside that model — mitigations implemented as specified: admin policy scoped to `authenticated`+`private.is_admin()`; anon INSERT preserved via drop+create idiom; CHECK-constraint ADD is DO-block guarded; verification fixture uses RFC-2606 invalid TLD + service-role-authenticated cleanup.

## Next Steps

This plan's artifacts are static — nothing runs against the database in wave 1. The runtime verification is deferred to plan 01-01:

1. **Plan 01-01 Task 5 (BLOCKING):** Operator runs `supabase db push` to apply this migration (and any other wave-1 migrations) to the shared Supabase project.
2. **Plan 01-01 Task 7:** Operator runs `npx tsx scripts/verify-analytics-rls.ts` with env vars set (SUPABASE_URL, SUPABASE_ANON_KEY, TEST_ADMIN_EMAIL/PASSWORD, TEST_NONADMIN_EMAIL/PASSWORD). Expect "All 5 steps passed." — that confirms ROADMAP Phase 1 SC4.
3. **Parallel wave-1 coupling:** `scripts/verify-analytics-rls.ts` imports `getAdminClient` from `../scraper/lib/supabase-admin`, which plan 01-02 is authoring in parallel. TypeScript resolution + `npx tsx` preflight will succeed once both wave-1 branches merge. (This agent did NOT attempt a live `npx tsx` run — that would fail-fast on the missing `scraper/lib/supabase-admin.ts` because plan 01-02 runs concurrently; the acceptance-criterion `npx tsx` check belongs to plan 01-01 post-merge.)

## Self-Check: PASSED

- FOUND: supabase/migrations/20260424120500_create_analytics_events.sql
- FOUND: scripts/verify-analytics-rls.ts
- FOUND: scripts/verify-migration-shape.mjs
- FOUND commit: 7a5edd6
- FOUND commit: 0aee749
- FOUND commit: fd2a1c4
- FOUND base: bced4f7 (expected base confirmed; 3 plan commits layered on top)
- Static verifier run: 25/25 pass, exit 0
