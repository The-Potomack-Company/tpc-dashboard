# Plan 01-01 Task 2 — Live Drift Discovery + Migration Repair

**Generated:** 2026-04-24
**Linked project:** shared-prod (per `scraper/.env`)
**Operator:** info@potomackco.com

This report captures the results of running the drift-discovery flow (Task 2) against the linked shared-prod Supabase project on plan execution date. It is the artifact referenced by the SUMMARY.md and is the input to the Task 4 amendment decision.

## Executive Summary

- **Orphan migrations found:** 2 (`20260424000000`, `20260424000001`) — REPAIRED to `reverted` status.
- **Local-only migrations remaining unapplied:** 3 unexpected (`20260331000000_tpc_app_post_gap.sql`, `20260421000000_create_updated_at_trigger.sql`, `20260421000006_rls_helper_functions.sql`) — **GATE: per the orchestrator instructions, this is a Task-2/Task-4 gap that MUST be reported back to the operator before Task 5 (`db push`) executes.**
- **Discovery script status:** `scripts/discover-drift.ts` is BROKEN against shared-prod — see "Discovery script defect" below. The repair work was completed using `npx supabase migration list --linked` directly.

## Initial Linked-Project State

```
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260318000000 | 20260318000000 | 2026-03-18 00:00:00
   20260318000001 | 20260318000001 | 2026-03-18 00:00:01
   20260318000002 | 20260318000002 | 2026-03-18 00:00:02
   20260318000003 | 20260318000003 | 2026-03-18 00:00:03
   20260318000004 | 20260318000004 | 2026-03-18 00:00:04
   20260318000005 | 20260318000005 | 2026-03-18 00:00:05
   20260318000006 | 20260318000006 | 2026-03-18 00:00:06
   20260320000000 | 20260320000000 | 2026-03-20 00:00:00
   20260320100000 | 20260320100000 | 2026-03-20 10:00:00
   20260320200000 | 20260320200000 | 2026-03-20 20:00:00
   20260330000000 | 20260330000000 | 2026-03-30 00:00:00
   20260331000000 |                | 2026-03-31 00:00:00
   20260421000000 |                | 2026-04-21 00:00:00
   20260421000006 |                | 2026-04-21 00:00:06
                  | 20260424000000 | 2026-04-24 00:00:00
                  | 20260424000001 | 2026-04-24 00:00:01
   20260424120000 |                | 2026-04-24 12:00:00
   20260424120500 |                | 2026-04-24 12:05:00
```

### Drift classification

| Version          | Local | Remote | Classification                                      |
|------------------|:-----:|:------:|-----------------------------------------------------|
| 20260318*        | yes   | yes    | TPC App tables, in parity                           |
| 20260320*        | yes   | yes    | TPC App tables, in parity                           |
| 20260330000000   | yes   | yes    | TPC App specialist-delete-own-sessions, in parity   |
| **20260331000000** | yes | no    | Local-only **shim placeholder** (file is comments only) |
| **20260421000000** | yes | no    | Local-only `set_updated_at()` (idempotent `create or replace`) |
| **20260421000006** | yes | no    | Local-only `private.is_admin()` (idempotent `create or replace`) |
| **20260424000000** | no  | yes    | **REMOTE-ONLY ORPHAN** — repaired to `reverted`     |
| **20260424000001** | no  | yes    | **REMOTE-ONLY ORPHAN** — repaired to `reverted`     |
| 20260424120000   | yes   | no     | This plan's drop migration — expected, ready to push |
| 20260424120500   | yes   | no     | Plan 01-03's analytics_events migration — expected, ready to push |

## Repair Actions Executed

### 1. Orphan revert (Task 2 proper)

```
$ npx supabase migration repair --status reverted 20260424000000 20260424000001
Initialising login role...
Connecting to remote database...
Repaired migration history: [20260424000000 20260424000001] => reverted
Finished supabase migration repair.
```

**Result:** Both remote-only orphan rows now have a `reverted` status in `supabase_migrations.schema_migrations`. The CLI no longer treats them as "remote migrations not found in local migrations directory".

These two timestamp versions are the v1.0 dashboard table-creation migrations whose source files were deleted during the v1.0 → v2.0 pivot. The actual database tables they created (sales, sale_departments, departments, scraper_runs, saved_reports, import_runs) **remain on the live database** — they will be dropped by `20260424120000_drop_retired_v1_tables.sql` when Task 5 executes.

### 2. Local-only shims — STILL UNAPPLIED on remote (BLOCKER for Task 5)

Three local migrations are local-only with idempotent contents:

- **`20260331000000_tpc_app_post_gap.sql`** — pure no-op (file contains only SQL comments).
- **`20260421000000_create_updated_at_trigger.sql`** — `create or replace function public.set_updated_at()`. The TPC App side already has this function on the live DB (created by TPC App's own migration on a different timestamp).
- **`20260421000006_rls_helper_functions.sql`** — `create schema if not exists private; create or replace function private.is_admin()`. The TPC App side already has both on the live DB.

These are the historical shims that v1.0 Phase 1 created to align the local CLI's migration directory with the remote tracker. They were `migration repair --status applied` at v1.0 time, but the remote-side tracker rows for them have since been removed (likely during the v1.0 → v2.0 pivot's manual dashboard-table cleanup that also produced the orphans repaired in step 1).

## Post-Repair State (current)

```
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260318000000 | 20260318000000 | 2026-03-18 00:00:00
   20260318000001 | 20260318000001 | 2026-03-18 00:00:01
   20260318000002 | 20260318000002 | 2026-03-18 00:00:02
   20260318000003 | 20260318000003 | 2026-03-18 00:00:03
   20260318000004 | 20260318000004 | 2026-03-18 00:00:04
   20260318000005 | 20260318000005 | 2026-03-18 00:00:05
   20260318000006 | 20260318000006 | 2026-03-18 00:00:06
   20260320000000 | 20260320000000 | 2026-03-20 00:00:00
   20260320100000 | 20260320100000 | 2026-03-20 10:00:00
   20260320200000 | 20260320200000 | 2026-03-20 20:00:00
   20260330000000 | 20260330000000 | 2026-03-30 00:00:00
   20260331000000 |                | 2026-03-31 00:00:00
   20260421000000 |                | 2026-04-21 00:00:00
   20260421000006 |                | 2026-04-21 00:00:06
   20260424120000 |                | 2026-04-24 12:00:00
   20260424120500 |                | 2026-04-24 12:05:00
```

## Dry-Run Apply List (after orphan repair)

```
$ npx supabase db push --dry-run
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would push these migrations:
 • 20260331000000_tpc_app_post_gap.sql
 • 20260421000000_create_updated_at_trigger.sql
 • 20260421000006_rls_helper_functions.sql
 • 20260424120000_drop_retired_v1_tables.sql
 • 20260424120500_create_analytics_events.sql
Finished supabase db push.
```

## Why this is a CHECKPOINT — Operator decision required

The orchestrator instructions for this continuation explicitly state:

> The expected apply list MUST be exactly two migrations:
> - `20260424120000_drop_retired_v1_tables.sql` (this plan, Task 3)
> - `20260424120500_create_analytics_events.sql` (plan 01-03)
>
> If any other migrations appear in the apply list (the v1.0 shim migrations `20260318*`, `20260320*`, `20260330*`, `20260331*`, `20260421000000`), STOP — that's the D-05 drift Task 1 was supposed to surface. Investigate before allowing the push to proceed. If discovery missed it, the orphan migration tracker may have an inconsistency; report it as a Task-2/Task-4 gap rather than re-running Task 5 blindly.

The dry-run shows 5 migrations, three of which are unexpected per the operator's prior approval:
`20260331000000`, `20260421000000`, `20260421000006`.

**Operator must explicitly approve a 5-migration push, OR the three shims must be marked applied via `migration repair --status applied 20260331000000 20260421000000 20260421000006` before re-running dry-run.**

### Two paths forward

| Path | Action | Effect | Risk |
|------|--------|--------|------|
| A — mark shims applied | `npx supabase migration repair --status applied 20260331000000 20260421000000 20260421000006` then re-dry-run | Tracker says "applied"; actual SQL is NOT executed; dry-run reduces to the 2 expected migrations | LOW — all three are idempotent and the live functions/schema already exist on remote (TPC App's own migrations). No DB change. |
| B — apply all 5 | Operator approves a 5-migration push | All 5 SQL files execute; the 3 shims run idempotently (no-ops); the 2 expected migrations apply | LOW (idempotent) but exceeds operator's recorded approval scope |

**Recommendation:** Path A. The three local-only files exist precisely to model the live remote schema state without re-creating it; marking them `applied` is the documented v1.0 Phase 1 pattern (recorded in STATE.md "Decisions" section). This restores the invariant the orchestrator expected (apply list = 2 migrations) and keeps the operator's approval scope intact.

## Discovery Script Defect (Rule 1 — Bug)

`scripts/discover-drift.ts` failed with:

```
[drift] FATAL: {
  code: 'PGRST106',
  details: null,
  hint: 'Only the following schemas are exposed: public, graphql_public',
  message: 'Invalid schema: information_schema'
}
```

**Root cause:** The script attempts `admin.schema('information_schema').from('tables')` etc. Supabase PostgREST refuses to expose `information_schema` even to the service role over the REST API — only `public` and `graphql_public` are exposed by default. The script's strategy of querying system schemas via the JS client cannot work without first creating a security-definer wrapper function in `public` (which would be a separate migration).

**Secondary defect (would have surfaced if PostgREST had let it through):** the migration-list parser uses a Unicode `│` character regex, but the CLI on Windows outputs ASCII `|`. Even on a parity remote, the parser would have returned 0 remote-only migrations — false-clean.

**Decision:** This report does not amend `scripts/discover-drift.ts` — that's a Phase 1 follow-up. The drift discovery for THIS plan was performed using the CLI directly (`npx supabase migration list --linked` + visual inspection + `db push --dry-run`), which is the documented Pitfall 3 fallback in 01-RESEARCH.md. The plan's success criterion is to repair drift before push, not to make the discovery script bullet-proof; we tracked the script defect in the SUMMARY's "Issues Encountered" section so it is not lost.

## Files Affected By This Task

- Created: `.planning/phases/01-infrastructure-shared-ui-kit/01-01-DRIFT-REPORT.md` (this file)

No source files modified — Task 2 mutates only the remote `supabase_migrations.schema_migrations` tracker.
