---
phase: 04-kpi-landing-page
plan: 01
subsystem: database
tags: [postgres, rpc, jsonb, security-definer, supabase, typescript-types]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: private.is_admin() helper + RLS admin-only policy on public.sales
  - phase: 02-pdf-import-pipeline
    provides: security-definer RPC precedent (import_sale_with_departments) and public.sales populated with net_revenue, lots_sold, lots_auctioned, sale_date
provides:
  - public.kpi_summary(date, date, date, date) returns jsonb — single-round-trip aggregate for current + previous windows
  - Database['public']['Functions']['kpi_summary'] TypeScript signature for browser callers
  - Divide-by-zero-safe weighted sell-through via NULLIF(SUM(lots_auctioned), 0)
  - Explicit admin gate (private.is_admin()) on the RPC entry point
affects: [04-kpi-landing-page Wave 2 (useKpiSummary hook + Zod schema), 05-charts, 06-department-kpis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aggregation RPCs: security definer + set search_path = public, pg_temp + explicit private.is_admin() gate + revoke public / grant authenticated"
    - "Divide-by-zero hygiene for weighted ratios: NULLIF(SUM(denominator), 0) → null path → JSON null → client em-dash"
    - "Both-window-in-one-payload aggregate pattern (current + previous CTEs combined via jsonb_build_object)"

key-files:
  created:
    - supabase/migrations/20260422000000_kpi_summary_rpc.sql
  modified:
    - src/db/database.types.ts

key-decisions:
  - "kpi_summary uses language plpgsql (not sql) so the admin gate can raise before the aggregate runs — small cost, clearer failure mode for non-admin callers"
  - "private.is_admin() called with no arguments (its actual signature — plan-level mention of is_admin(auth.uid()) was a planning-doc typo; the Phase 1 migration defines it as argumentless)"
  - "Granted EXECUTE to authenticated (not service_role) — this RPC is browser-facing unlike Phase 2's import RPC"

patterns-established:
  - "Browser-facing aggregate RPCs grant EXECUTE to authenticated role while keeping server-only RPCs scoped to service_role (see Phase 2 import RPC for contrast)"
  - "JSONB return shape is validated via Zod at the hook boundary (Wave 2) — generated database.types.ts types the Returns as generic Json"

requirements-completed: [KPI-01, KPI-02]

# Metrics
duration: ~15min
completed: 2026-04-22
---

# Phase 4 Plan 1: KPI Summary RPC Summary

**public.kpi_summary(date, date, date, date) Postgres RPC returning both current + previous window aggregates (revenue, weighted sell-through, lots_sold, sales_count) as a single JSONB payload, with divide-by-zero guard and admin-only gate; TypeScript types regenerated.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-22T16:10:00Z (approx, from execution context load)
- **Completed:** 2026-04-22T16:25:29Z
- **Tasks:** 3 (Task 1 auto, Task 2 human-action executed inline, Task 3 verification)
- **Files modified:** 2 (1 created, 1 regenerated)

## Accomplishments

- Authored `20260422000000_kpi_summary_rpc.sql` migration verbatim to Pattern 1 from `04-RESEARCH.md`, with plpgsql wrapper for the admin gate
- Applied the migration to the linked Supabase project via `npm run db:push` (also re-applied 20260421000012 which was pending — no-op on the function body)
- Regenerated `src/db/database.types.ts` via `npm run db:types`; `kpi_summary` signature now present under `Database['public']['Functions']`
- Existing `import_sale_with_departments` type entry preserved (no regression)
- Schema-shape test passes (4/4), lint reports no new errors (only pre-existing warnings in SalesTable.tsx and authStore.ts)

## Task Commits

1. **Task 1: Write kpi_summary migration** — `a7d7680` (feat)
2. **Task 2: Push migration + regenerate types** — `d84f031` (feat)
3. **Task 3: Verify type regeneration** — no new commit (verification-only; confirmed via grep inside Task 2)

_Task 2 was marked `checkpoint:human-action` in the plan but the operator had already authenticated the Supabase CLI (project remained linked from Phase 2). Invocation was executed inline per the orchestrator directive "Attempt the push — if auth fails, pause checkpoint." No auth failure occurred._

## Files Created/Modified

- `supabase/migrations/20260422000000_kpi_summary_rpc.sql` — CREATE. The RPC. See Decisions for signature details.
- `src/db/database.types.ts` — MODIFIED (regenerated; +9 lines). Added `kpi_summary` entry under `Functions`.

### Signature of the regenerated `Functions.kpi_summary` type (per plan output spec)

```typescript
kpi_summary: {
  Args: {
    compare_end: string
    compare_start: string
    period_end: string
    period_start: string
  }
  Returns: Json
}
```

## Decisions Made

- **plpgsql over pure sql:** RESEARCH.md § Pattern 1 shows a `language sql` body. The plan's acceptance criteria require an explicit `private.is_admin()` gate that raises `'Access denied'` before the aggregate runs — this is only possible from a plpgsql block (pure SQL can't `raise exception` conditionally). Switched `language sql` → `language plpgsql`, wrapped the CTE query in a `select ... into v_result` / `return v_result` pattern. Net perf delta is negligible at 457 rows.
- **Argumentless `private.is_admin()`:** The plan's task instructions mention `private.is_admin(auth.uid())`, but the actual Phase 1 migration (`20260421000006_rls_helper_functions.sql`) defines `private.is_admin()` with zero arguments — it reads `auth.uid()` internally. Called it argumentless to match the real signature; using `private.is_admin(auth.uid())` would have failed migration apply with `function private.is_admin(uuid) does not exist`. Matches every other call-site in the repo (every Phase 1 RLS policy at `20260421000007_rls_policies.sql` uses `(select private.is_admin())`).
- **COALESCE on lots_sold at the jsonb_build_object site:** Per Pattern 1, revenue is COALESCE'd inside each CTE but lots_sold is not — it's COALESCE'd once in the final jsonb_build_object call. Kept this split exactly to honor the client contract (revenue/lots_sold/sales_count never null; sell_through may be null).
- **Granted to `authenticated` (not `service_role`):** Phase 2's import RPC is service-role-only (scripts call it); this RPC is browser-called via `supabase.rpc` under the authenticated role. Explicit diverge from Phase 2 pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected private.is_admin() call signature**
- **Found during:** Task 1 (Write kpi_summary migration)
- **Issue:** Plan Task 1 instructions line 128 (and threat model T-04-03) specify `private.is_admin(auth.uid())`. The actual Phase 1 migration defines the function as `private.is_admin() returns boolean` (no arguments — reads `auth.uid()` inside its own body). Applying the plan verbatim would have produced a migration that fails to push with `function private.is_admin(uuid) does not exist`.
- **Fix:** Called `private.is_admin()` with no arguments. This is the form used by every Phase 1 RLS policy in `20260421000007_rls_policies.sql`, so it is already verified against the linked DB.
- **Files modified:** supabase/migrations/20260422000000_kpi_summary_rpc.sql
- **Verification:** Migration applied cleanly via `npm run db:push` — confirms the call signature matches the DB. Grep still shows 3 occurrences of `private.is_admin` (1 comment header, 1 gate call, 1 `comment on function` block), satisfying the "at least 1" acceptance criterion.
- **Committed in:** a7d7680 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Single signature correction; no scope change. Threat-model mitigation T-04-03 is satisfied by the argumentless form exactly as the plan intended — the plan's parenthetical was a planning-doc typo, not a design change.

## Issues Encountered

**Supabase CLI link state missing in worktree:** First `npm run db:push` attempt failed with `Cannot find project ref. Have you run supabase link?`. Cause: the linked-project cache lives in `supabase/.temp/` which is git-ignored, and git worktrees don't inherit ignored working-tree files from the parent. Fix: copied `C:/Users/maser/Projects/tpc-dashboard/supabase/.temp/` into the worktree's `supabase/.temp/`. This is purely a CLI session cache (contains `project-ref`, version info) — no secrets, no credentials. Second `db:push` attempt succeeded.

_Lesson for future worktree-based plan execution: if a plan runs Supabase CLI commands, the `.temp` directory must be seeded from the main workspace before the first CLI call. Consider adding this to the worktree spawn hook._

## User Setup Required

None — the migration was pushed and types were regenerated in-session.

## Next Phase Readiness

- Wave 2 (`04-02-PLAN` — period.ts + useKpiSummary hook + Zod schema) is unblocked. The hook can now type-check `supabase.rpc('kpi_summary', { period_start, period_end, compare_start, compare_end })` against the regenerated types.
- Wave 3 `<KpiCard>` + `<Dashboard>` rewrite depends on Wave 2 completing; no new blockers introduced here.
- Spot-check recommendation (Wave 2 + 3 will exercise this end-to-end, but callable now from psql as a smoke test): `select public.kpi_summary('2025-04-22', '2026-04-22', '2024-04-22', '2025-04-22');` should return a JSONB with both windows populated from the currently-imported 457 sales.

## Self-Check: PASSED

**Files:**
- FOUND: supabase/migrations/20260422000000_kpi_summary_rpc.sql
- FOUND: src/db/database.types.ts (+9 lines with kpi_summary)

**Commits:**
- FOUND: a7d7680 (feat(04-01): add kpi_summary RPC migration)
- FOUND: d84f031 (feat(04-01): regenerate database.types.ts with kpi_summary RPC)

**Grep verification:**
- `security definer` in migration: PRESENT
- `set search_path = public, pg_temp` in migration: PRESENT
- `nullif(sum(lots_auctioned), 0)` in BOTH CTEs: PRESENT (2 CTE occurrences + 1 in header comment = 3 total)
- `revoke all on function public.kpi_summary`: PRESENT
- `grant execute on function public.kpi_summary ... to authenticated`: PRESENT
- `private.is_admin()` gate call: PRESENT
- `kpi_summary` in src/db/database.types.ts Functions block: PRESENT
- `import_sale_with_departments` still present in database.types.ts: PRESENT (no regression)

**Test + lint:**
- `npm test -- src/tests/schema-shape.test.ts` → 4/4 passed
- `npm run lint` → 0 errors, 3 pre-existing warnings (unchanged)

---
*Phase: 04-kpi-landing-page*
*Completed: 2026-04-22*
