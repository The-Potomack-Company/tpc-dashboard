# Plan 01-01 Task 5 — Shim Repair + supabase db push (PARTIAL FAILURE)

**Generated:** 2026-04-24
**Continuation agent:** second resume (post-7be7448 / first sub-checkpoint)
**Operator-approved scope:** 2-migration push (`20260424120000_drop_retired_v1_tables.sql`, `20260424120500_create_analytics_events.sql`) after marking 3 v1.0 shims `applied`.
**Outcome:** Drop migration applied successfully; analytics_events migration FAILED on CHECK-constraint ADD; partial state requires operator decision before resumption.

---

## 1. Step 0 — Shim Repair (Operator Option A — applied)

Marked 3 local-only v1.0 shims as `applied` in the remote tracker (no SQL executed; tracker-only operation). All three are idempotent and the live functions/schema already exist on remote (TPC App's own migrations).

```
$ npx supabase migration repair --status applied 20260331000000 20260421000000 20260421000006
Initialising login role...
Connecting to remote database...
Repaired migration history: [20260331000000 20260421000000 20260421000006] => applied
Finished supabase migration repair.
```

Result: tracker now shows these 3 shims with both Local + Remote populated.

---

## 2. Final Pre-Push Dry-Run (post-shim-repair)

Apply list reduced from 5 to exactly the 2 expected migrations as required by the operator's approval scope.

```
$ npx supabase db push --dry-run
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would push these migrations:
 • 20260424120000_drop_retired_v1_tables.sql
 • 20260424120500_create_analytics_events.sql
Finished supabase db push.
```

Verified: apply list matches operator-approved scope exactly. Step 0 complete.

---

## 3. Live Push — Partial Failure

Command:

```bash
yes | npx supabase db push --include-all
```

### 3.1 Migration 1 of 2 — `20260424120000_drop_retired_v1_tables.sql` — APPLIED

```
Applying migration 20260424120000_drop_retired_v1_tables.sql...
NOTICE (00000): table "import_runs" does not exist, skipping
NOTICE (00000): table "scraper_runs" does not exist, skipping
NOTICE (00000): table "saved_reports" does not exist, skipping
NOTICE (00000): table "sale_departments" does not exist, skipping
NOTICE (00000): table "sales" does not exist, skipping
NOTICE (00000): table "departments" does not exist, skipping
```

**Important observation:** All 6 dashboard-owned v1.0 tables had ALREADY been dropped from the live database before this push. The migration was a clean idempotent no-op for all 6 statements (each returned "table does not exist, skipping"). The `if exists ... cascade` guard worked exactly as designed.

**Tracker effect:** `20260424120000` is now recorded in BOTH Local and Remote columns. Drift on this migration is fully resolved.

### 3.2 Migration 2 of 2 — `20260424120500_create_analytics_events.sql` — FAILED

```
Applying migration 20260424120500_create_analytics_events.sql...
NOTICE (42P07): relation "analytics_events" already exists, skipping
ERROR: check constraint "analytics_events_event_type_check" of relation "analytics_events" is violated by some row (SQLSTATE 23514)
At statement: 1
-- CHECK constraint — guarded to avoid duplicate-constraint error when
-- extension migration 001 already installed it (RESEARCH Pitfall 1).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'analytics_events_event_type_check'
      and conrelid = 'public.analytics_events'::regclass
  ) then
    alter table public.analytics_events
      add constraint analytics_events_event_type_check
      check (event_type in (
        'catalog_single',
        'catalog_batch',
        'portal_upload',
        'spreadsheet_transform',
        'data_import'
      ));
  end if;
end$$
```

**Failure analysis:**

The migration assumed the live `public.analytics_events` table ALREADY had a CHECK constraint named `analytics_events_event_type_check` installed by extension migration 001. Under that assumption the DO-block would be a no-op (constraint exists → if-not-exists branch skipped).

Reality: the live table does NOT have a constraint with that name. The DO-block therefore took the ADD-CONSTRAINT branch and tried to apply the 5-value enum to existing rows. At least one existing row has an `event_type` value NOT in `{catalog_single, catalog_batch, portal_upload, spreadsheet_transform, data_import}`.

This matches plan 01-03's assumption A1 footnote: **"Columns limited to 28 (extension migration 001). Deliberately excluded: started_at, ended_at, item_index, item_status, catalog_item enum value (migrations 002/003/004 not applied)"** — but on shared-prod, extension migrations 002/003/004 HAVE been applied (or rows have been inserted with newer event_types regardless). The live data violates the 5-value enum.

The transaction was rolled back; analytics_events is unchanged. RLS policies (admin SELECT, anon INSERT preservation), index, grants — none of these were applied, since `do $$ ... end$$` is statement 1 and the migration aborted there.

**Tracker effect:** `20260424120500` is in Local-only (NOT applied) — see post-push migration list below.

---

## 4. Post-Push Migration List (parity check)

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
   20260331000000 | 20260331000000 | 2026-03-31 00:00:00
   20260421000000 | 20260421000000 | 2026-04-21 00:00:00
   20260421000006 | 20260421000006 | 2026-04-21 00:00:06
   20260424120000 | 20260424120000 | 2026-04-24 12:00:00
   20260424120500 |                | 2026-04-24 12:05:00
```

Drift fully repaired EXCEPT for the analytics_events migration. Every other Phase 1 migration is in parity (15/16). The remaining gap is exactly one migration (`20260424120500`) which is local-only because its first statement aborted.

---

## 5. STOP — Operator Decision Required (Rule 4)

Per the destructive_action_safety guard ("If the live push errors out mid-apply ... do NOT retry inside this agent, and report"), this run halts here. The CHECK-constraint mismatch between the migration's enum and live data is an **architectural decision** (Rule 4) — fixing it requires either expanding the enum (need to know the full live event_type set) or removing the CHECK ADD entirely, which changes the migration's contract.

### Recommended next-agent investigation steps

1. **Enumerate live event_type values on shared-prod analytics_events:**
   ```sql
   select distinct event_type, count(*)
   from public.analytics_events
   group by event_type
   order by count(*) desc;
   ```
   Use `getAdminClient()` from `scraper/lib/supabase-admin.ts` to query the `public.analytics_events` table directly via the JS client (do NOT shell out — the admin client works for table-level queries).

2. **Three primary remediation paths (operator chooses):**

   | Path | Action | Pros | Cons |
   |------|--------|------|------|
   | A — Expand enum | Amend `20260424120500_create_analytics_events.sql` to include all live event_type values + the 5 originals | Preserves the CHECK contract; maximally explicit | Requires knowing the full live set; couples the dashboard migration to the extension's evolution |
   | B — Drop CHECK from this migration | Remove the entire `do $$ ... end$$` block from `20260424120500_create_analytics_events.sql`; the extension owns the CHECK constraint going forward | Decouples dashboard from extension event_type vocabulary; aligns with D-22 ("Extension-owned evolution lands via future extension migrations") | Loses validation gate at the dashboard layer; if the extension never installs a CHECK, none exists |
   | C — Use `not valid` | Change the DO-block to `add constraint ... not valid` so existing rows are exempted but new inserts are validated | Compromise: existing data preserved, future inserts gated | Complicates the migration; `not valid` constraints don't validate retroactively without explicit `validate constraint` |

   Path B is most consistent with plan 01-03's stated decisions (decision item: extension-owned evolution lands via future extension migrations). Path A is most consistent with the migration's apparent intent (enforce a known enum).

3. **Once the migration is amended, the next agent CAN safely re-push** — `create table if not exists` + `drop policy if exists / create policy` + `create index if not exists` make the entire migration idempotent for the live state. The drop migration is already applied; only `20260424120500` needs to be re-run.

### What this run did NOT modify

- Local migration files: untouched (no amendment to `20260424120500_create_analytics_events.sql`).
- `src/db/database.types.ts`: NOT regenerated (Task 6 cannot run until Task 5 succeeds).
- RLS verification: NOT run (Task 7 requires the migration to apply first).
- `scripts/discover-drift.ts` defects: NOT addressed (deferred per drift-report).

### State at this commit

- Tracker: 15/16 Phase 1 migrations in parity; only `20260424120500` is local-only (failed apply).
- Schema: live `public.analytics_events` is unchanged from pre-push state (transaction rolled back).
- Working tree: clean except this artifact.

---

## 6. Files Affected by This Run

- Created: `.planning/phases/01-infrastructure-shared-ui-kit/01-01-PUSH-OUTPUT.md` (this file)

No source files modified. The drop migration applied to remote but is already committed in the tree (`7be7448`'s base contained it). The analytics_events migration is unchanged in both tree and remote.
