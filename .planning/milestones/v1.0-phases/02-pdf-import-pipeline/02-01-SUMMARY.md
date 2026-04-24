---
phase: 02-pdf-import-pipeline
plan: 01
subsystem: database

tags: [database, migrations, postgres, plpgsql, rpc, supabase, security-definer]

requires:
  - phase: 01-foundation-auth
    provides: "Dashboard-owned tables (sales, sale_departments, departments, scraper_runs), RLS enabled, service_role bypass pattern, supabase CLI workflow (push + gen types)"
provides:
  - "sales.validation_warning boolean NOT NULL DEFAULT false (cross-validation flag for parser/importer)"
  - "departments.auto_discovered boolean NOT NULL DEFAULT false (marker for auto-inserted department codes)"
  - "public.import_sale_with_departments(jsonb, jsonb) returns uuid (atomic per-sale insert RPC, service_role only)"
  - "Regenerated src/db/database.types.ts with new columns in sales/departments Row/Insert/Update and the RPC in Functions block"
affects: [02-pdf-import-pipeline-02, 02-pdf-import-pipeline-03, 02-pdf-import-pipeline-04, 02-pdf-import-pipeline-05, 10-rfc-scraper]

tech-stack:
  added: []
  patterns:
    - "PL/pgSQL RPC for atomic multi-table insert (alternative to client-side transactions that supabase-js v2 doesn't support cleanly)"
    - "security definer + set search_path = public, pg_temp hygiene for Supabase RPCs"
    - "revoke-from-public + grant-to-service_role locks down RPCs to server-side callers only"
    - "jsonb parameters with typed casts (::int, ::numeric, ::date, ::boolean, ::timestamptz) to reject malformed input without string concatenation (T-02 mitigation)"

key-files:
  created:
    - "supabase/migrations/20260421000009_add_validation_warning_to_sales.sql"
    - "supabase/migrations/20260421000010_add_auto_discovered_to_departments.sql"
    - "supabase/migrations/20260421000011_import_sale_rpc.sql"
  modified:
    - "src/db/database.types.ts"
    - "package.json"

key-decisions:
  - "RPC is security definer + service_role-only grant. Public/authenticated/anon are explicitly revoked; authenticated users can never invoke the import pipeline from the dashboard."
  - "jsonb input with explicit ::type casts instead of typed SQL parameters. Preserves parser flexibility (one JSON per sale) while casts surface malformed values as per-sale transaction aborts."
  - "Auto-discovery is baked into the RPC (not the TypeScript importer). Unknown department codes insert a new row with auto_discovered=true in the same transaction as the sale, so there's no race window between importer code paths."
  - "ALTER TABLE ... NOT NULL DEFAULT false is safe on populated tables because Postgres applies the default to existing rows. The 22 seeded departments are now auto_discovered=false as expected; no data migration needed."
  - "Script fix: db:types npm script needed --linked flag. Supabase CLI 2.81.3 requires an explicit target (--local / --linked / --project-id / --db-url) when emitting types, unlike db push which defaults to the linked project."

patterns-established:
  - "Atomic RPC-based insert for pipelines that touch multiple tables — invoked via supabase-js .rpc() from scripts (scraper, importer) using SUPABASE_SERVICE_ROLE_KEY"
  - "Every new security-definer function gets set search_path = public, pg_temp to defuse search-path hijack"

requirements-completed: [DATA-05, DATA-06, DATA-07]

duration: 3min
completed: 2026-04-21
---

# Phase 02 Plan 01: Schema Extensions + Atomic Import RPC Summary

**Added sales.validation_warning and departments.auto_discovered columns plus a service-role-only PL/pgSQL RPC (import_sale_with_departments) that atomically inserts a sale and its department breakdown in a single transaction.**

## Performance

- **Duration:** ~3 min (158 s)
- **Started:** 2026-04-21T18:51:22Z
- **Completed:** 2026-04-21T18:54:00Z
- **Tasks:** 2 (Task 1 auto, Task 2 blocking checkpoint executed directly — user already authenticated to Supabase CLI from Phase 1)
- **Files modified:** 5 (3 migrations created, 1 generated types file regenerated, 1 package.json script fixed)

## Accomplishments

- Three migrations written and applied to the linked Supabase project (`wgrknodfxdjtddsirldw` — TPC Database). Push completed in 4 seconds.
- `public.import_sale_with_departments(jsonb, jsonb)` RPC live in the database, callable only by `service_role`. Function body auto-discovers unknown department codes, inserts sale+departments in a single transaction, and rolls back the entire sale on any cast error or constraint violation.
- Generated `src/db/database.types.ts` now exposes the new columns (as `boolean`, not nullable) in sales/departments Row/Insert/Update and the RPC in the `Functions` block with `Args: { p_departments: Json; p_sale: Json }` and `Returns: string`.
- Existing 22 seeded departments retain `auto_discovered = false` (NOT NULL DEFAULT false on ALTER populated the existing rows as intended).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author 3 migration files** — `1376967` (feat)
   - `feat(02-01): add migrations for validation_warning, auto_discovered, import_sale RPC`
2. **Task 2 [BLOCKING]: Push schema and regenerate types** — `ce86423` (chore)
   - `chore(02-01): regenerate database types with new columns + RPC`

_Task 2 was designated a checkpoint:human-action, but because the user was already logged into Supabase CLI (Phase 1) and the repo is linked to the correct project, Claude was able to execute both commands directly. No human intervention required._

## Files Created/Modified

### Created
- `supabase/migrations/20260421000009_add_validation_warning_to_sales.sql` (5 lines) — ALTER TABLE adding `validation_warning boolean NOT NULL DEFAULT false` with a column comment.
- `supabase/migrations/20260421000010_add_auto_discovered_to_departments.sql` (5 lines) — ALTER TABLE adding `auto_discovered boolean NOT NULL DEFAULT false` with a column comment.
- `supabase/migrations/20260421000011_import_sale_rpc.sql` (123 lines) — PL/pgSQL `import_sale_with_departments(p_sale jsonb, p_departments jsonb) returns uuid`. `security definer`, `set search_path = public, pg_temp`. Inserts all 24 `sales` columns (incl. validation_warning, with `coalesce(..., false)` and `coalesce(..., now())` for the two nullable-ish inputs), loops `jsonb_array_elements(p_departments)`, auto-discovers unknown codes (new `departments` row with `auto_discovered=true`), inserts all 11 `sale_departments` columns. `revoke all ... from public; grant execute ... to service_role;` at end.

### Modified
- `src/db/database.types.ts` — Regenerated from the linked Supabase project post-push. New columns present in `sales` and `departments` Row/Insert/Update sections; `import_sale_with_departments` present in `Functions` block (line 586).
- `package.json` — Added `--linked` flag to `db:types` script (Rule 3 deviation; see below).

## Decisions Made

- **RPC is security definer + service_role-only grant.** `revoke all ... from public` + `grant execute ... to service_role` means authenticated dashboard users cannot invoke the import pipeline from the client. Only server-side scripts using `SUPABASE_SERVICE_ROLE_KEY` can call it. Matches Phase 1's "no INSERT/UPDATE/DELETE policies on dashboard data tables" pattern.
- **`set search_path = public, pg_temp` on the RPC.** Standard Supabase security-definer hygiene. Prevents search-path hijack if a malicious extension or schema gets added later. Matches pattern from `20260421000006_rls_helper_functions.sql` (private.is_admin).
- **jsonb parameters, not typed SQL signature.** The parser will produce one JSON object per sale + one JSON array of departments. Passing these as jsonb and casting inside the function body is simpler than declaring 24 parameters for `p_sale` and 11 per department. Casts surface malformed values as transaction aborts (T-02 mitigation in the plan's threat model).
- **Auto-discovery inside the RPC.** Unknown department codes are inserted within the same transaction as the sale. If the importer had done this separately (SELECT then INSERT on the client), there would be a race window. Baking it into PL/pgSQL eliminates that concern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `--linked` flag to `db:types` npm script**
- **Found during:** Task 2 (regenerate types after schema push)
- **Issue:** `npm run db:types` failed with `Must specify one of --local, --linked, --project-id, or --db-url`. Supabase CLI 2.81.3 (pinned in this project) requires an explicit target for `gen types`. The redirect (`> src/db/database.types.ts`) had already truncated the file to 0 bytes before the error surfaced, so the types file was empty.
- **Fix:** Updated `package.json` `db:types` script from `supabase gen types --lang=typescript --schema public > src/db/database.types.ts` to `supabase gen types --lang=typescript --schema public --linked > src/db/database.types.ts`. Re-ran `npm run db:types` to populate the file (721 lines).
- **Files modified:** package.json, src/db/database.types.ts
- **Verification:** `wc -l src/db/database.types.ts` → 721. All three required greps pass (`validation_warning`, `auto_discovered`, `import_sale_with_departments`).
- **Committed in:** ce86423 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix is necessary and permanent. The original script was inherited from the TPC App's convention but the pinned CLI version made it non-functional. Future `npm run db:types` invocations now work end-to-end. No scope creep; fix stays inside the acknowledged file-set (package.json was not on the plan's files_modified, but it is required to make Task 2's success criteria reachable).

## Issues Encountered

- **Types file wiped to 0 bytes before CLI error.** The first `npm run db:types` invocation used `> src/db/database.types.ts` which truncates before the CLI runs. When the CLI exited with "Must specify one of --local..." the file was already empty. The re-run after adding `--linked` repopulated it with 721 lines. Worth noting for future: a script that uses a temp file + atomic move would be safer, but for now the fixed script works.
- **Deviation classification nuance.** Task 2 was marked `checkpoint:human-action` in the plan, but the prompt explicitly authorized Claude to attempt the push. The user was already authenticated (`supabase login` from Phase 1) and the repo was linked to the right project, so both commands succeeded without intervention. Not a deviation — the orchestrator's objective allowed this path.

## Threat Flags

No new threat surface introduced beyond what the plan's `<threat_model>` already covered. All mitigations (T-02, T-05, T-07) are implemented as specified:

| Threat | Status | Evidence |
|--------|--------|----------|
| T-02 (SQL injection via PDF content) | mitigated | RPC uses `->>` + explicit `::type` casts everywhere; zero `||` string concatenation on JSONB fields. |
| T-05 (wrong-DB push) | mitigated | Confirmed `supabase projects list` shows ● on `wgrknodfxdjtddsirldw`; `.env.local` VITE_SUPABASE_URL matches. Push applied only 3 new migrations to correct project. |
| T-07 (Elevation of privilege) | mitigated | `revoke all ... from public` + `grant execute ... to service_role` present in migration. No grants to authenticated/anon. `security definer` uses locked-down `search_path`. |

## User Setup Required

None — no external service configuration required. Schema is live in the linked Supabase project and types are regenerated.

## Next Phase Readiness

- **Wave 2 (parser) unblocked.** Plans 02-02+ can now `import { Database } from '../src/db/database.types'` and reference:
  - `Database['public']['Tables']['sales']['Insert']` with `validation_warning?: boolean`
  - `Database['public']['Tables']['departments']['Insert']` with `auto_discovered?: boolean`
  - `Database['public']['Functions']['import_sale_with_departments']['Args']` (for the .rpc() call signature)
- **Importer will call:** `supabaseAdmin.rpc('import_sale_with_departments', { p_sale, p_departments })`. The RPC returns the new sale's uuid (`string` in TypeScript).
- **Parser output shape is free-form jsonb.** The importer can build the JSON payload however it wants, as long as the field names in the ->> extractions match (sale_number, title, sale_date, lots_auctioned, lots_sold, etc. — see migration 000011 for the authoritative list).
- **No blockers** for subsequent plans in this phase.

## Self-Check: PASSED

Verified artifacts:
- `supabase/migrations/20260421000009_add_validation_warning_to_sales.sql` FOUND
- `supabase/migrations/20260421000010_add_auto_discovered_to_departments.sql` FOUND
- `supabase/migrations/20260421000011_import_sale_rpc.sql` FOUND
- `src/db/database.types.ts` FOUND (721 lines, non-empty)
- Commit `1376967` FOUND (Task 1: migrations)
- Commit `ce86423` FOUND (Task 2: types regeneration + package.json fix)
- Three greps against `src/db/database.types.ts` all return matches (validation_warning: 3, auto_discovered: 3, import_sale_with_departments: 1 in Functions block)
- Remote Supabase reports all 3 new migrations applied (push took 4 s, no errors)

---
*Phase: 02-pdf-import-pipeline*
*Completed: 2026-04-21*
