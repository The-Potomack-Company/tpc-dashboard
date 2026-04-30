---
phase: 02-extension-analytics-extension
plan: 01
subsystem: database
tags: [postgres, supabase, rpc, sql, rls, security-invoker, date-trunc, tanstack-query, prebuild-guard]

requires:
  - phase: 01-infrastructure-shared-ui-kit
    provides: "analytics_events table + admin-SELECT RLS (analytics_admin_select), private.is_admin() helper, prebuild service-role guard convention, useTimezone ET formatters that the SQL bucketing must align with"
provides:
  - "6 aggregation RPCs powering EXT-01..EXT-04 + EXT-09 + EXT-10 (get_event_volume_daily, get_kpi_totals, get_error_rate_by_type, get_per_user_summary, get_dominant_version, get_cancellation_rates)"
  - "Static SQL grep verifier (scripts/verify-extension-app-source-scope.mjs) enforcing D-01 / D-02 / D-13 / Pitfall 1 / Pitfall 9 invariants at build time"
  - "Extended npm prebuild chain (Phase 1 service-role guard + new D-01 verifier)"
affects: [02-03 services-hooks, 02-04 admin-charts, 02-05 tables-user-multi-select, 02-07 developer-panel, 02-09 smoke-tests]

tech-stack:
  added: []
  patterns:
    - "Server-side bucketing via 3-arg date_trunc(unit, ts, 'America/New_York') so buckets line up with useTimezone ET formatting (D-13)"
    - "Empty-array filter idiom (cardinality(p_users) = 0 OR x = any(p_users)) preserves Pitfall 2 invariant from Postgres trinary logic"
    - "Single-RPC current+previous+sparkline (Pattern 2) avoids 5×3 = 15 round trips per render; previous-period is computed inside the RPC via prev_from = p_from - (p_to - p_from)"
    - "Cancellation rates returned in two stable rows via VALUES left-join trick so the UI 2-card slot does not silently shrink to one card when one event_type has zero rows"
    - "Static SQL grep verifier wired into prebuild chain — D-01/D-02/D-13 invariants enforced even on future plans"

key-files:
  created:
    - "supabase/migrations/20260429120000_create_extension_rpcs.sql — 6 RPC functions + grant execute statements"
    - "scripts/verify-extension-app-source-scope.mjs — static SQL grep verifier"
  modified:
    - "package.json — extended prebuild chain to run the new D-01 verifier after the Phase 1 service-role guard"

key-decisions:
  - "Functions are language sql stable security invoker — RLS analytics_admin_select governs row visibility through the calling JWT; anon and non-admin authenticated users get zero rows"
  - "p_bucket positional arg (default 'day', accepts 'hour') chosen over a sibling get_event_volume_hourly RPC; keeps EXT-01 hook bound to one RPC name and lets D-08 today-range hourly bucketing reuse the same code path"
  - "get_cancellation_rates extended beyond the original D-07 spec with previous_rate (D-05 prev-period CTE mirrored from get_kpi_totals) so EXT-10 KPI cards can render a prev-period delta; NULLIF(prev_total, 0) makes denominator-zero return SQL NULL → JS sees null → CancellationRateKpis omits the chip"
  - "Both catalog_batch and portal_upload always appear in get_cancellation_rates output via a 2-row VALUES table left-joined to cur/prev — even when one period has zero rows, the UI shows two stable cards"
  - "Static verifier strips line comments before counting invariant occurrences so the migration's invariant header block cannot mask a missing real-code occurrence (planner grep gate hygiene rule)"

patterns-established:
  - "Aggregation RPC scaffold: bounds CTE → types CTE (fixed 5-event vocab) → scoped CTE (D-01 + D-02 + filter idioms + range predicate) → totals/sparks/etc. → left-join from types to ensure stable output cardinality. Reusable shape for any future analytics RPC."
  - "Multi-line static SQL grep verifier: read migration → strip line comments → run named regex checks → emit one [verify-...] error per failure → exit 1 on any. Mirror style established by scripts/verify-migration-shape.mjs."
  - "prebuild chain extension: append `&& node scripts/verify-<name>.mjs` to npm prebuild rather than overwriting; future Phase 2/3/4 verifiers stack the same way."

requirements-completed: []  # Pending — Task 2 is BLOCKING; EXT-01..EXT-10 cannot be marked complete until the migration is applied to the live shared project AND all downstream plans (02-03..02-09) consume the RPCs.

duration: ~5min (partial — Tasks 1 + 3 done; Task 2 paused at BLOCKING checkpoint)
completed: pending-checkpoint-resolution
---

# Phase 2 Plan 01: Aggregation RPCs Summary

**6 PostgreSQL aggregation RPCs (Pattern 1 + 2 + Q5 verbatim, plus get_dominant_version and get_cancellation_rates with previous_rate) committed to the migration tree; static D-01/D-02/D-13 verifier wired into npm prebuild. Awaiting human-action checkpoint for `npm run db:push` + `npm run db:types`.**

## Status

**PARTIAL** — paused at Task 2, the [BLOCKING] human-action checkpoint. Tasks 1 and 3 are complete and committed atomically; Task 2 (`supabase db push` against the linked shared project + types regen) is operator-gated and was NOT attempted by the executor per plan frontmatter `autonomous: false` and the orchestrator's checkpoint contract.

## Performance

- **Duration so far:** ~5 min (Tasks 1 + 3 only)
- **Started:** 2026-04-30T13:25:52Z
- **Paused at checkpoint:** 2026-04-30T13:30:10Z (approx)
- **Tasks completed:** 2 of 3 (Task 1, Task 3)
- **Tasks pending:** 1 (Task 2 — BLOCKING checkpoint)
- **Files created/modified:** 3

## Accomplishments

- All 6 RPCs authored verbatim from RESEARCH.md Pattern 1 / Pattern 2 / Q5 sketches with the planner's extensions:
  - `get_event_volume_daily(timestamptz, timestamptz, text[], text[], text)` — Pattern 1 with `p_bucket` positional arg toggling day/hour for D-08
  - `get_kpi_totals(timestamptz, timestamptz, text[], text[], text)` — Pattern 2 verbatim, sparkline buckets respect `p_bucket`
  - `get_error_rate_by_type(timestamptz, timestamptz, text[], text[])` — Q5 sketch verbatim
  - `get_per_user_summary(timestamptz, timestamptz, text[], text[])` — Q5 sketch verbatim
  - `get_dominant_version(timestamptz, timestamptz, text[], text[])` — single-row dominant version with semver tie-break
  - `get_cancellation_rates(timestamptz, timestamptz, text[], text[])` — extended with `previous_rate` per planner's Checker BLOCKER #1 fix; D-05 prev-period semantics mirrored from `get_kpi_totals`
- All 6 functions: `language sql stable security invoker`. All 6 followed by explicit `grant execute on function public.<name>(<arg_types>) to authenticated`.
- D-01 invariant honored: `app_source = 'tpc-extension'` appears 7 times in the migration (one per scoped CTE plus header invariant note).
- D-02 invariant honored: 5-event vocabulary literal appears 7 times (4 RPC scoped CTEs + 2 types-CTE unnest blocks + 1 header).
- D-13 invariant honored: 3-arg `date_trunc(unit, ts, 'America/New_York')` used throughout; `AT TIME ZONE 'America/New_York'` does NOT appear (Pitfall 1).
- D-22 honored: no new columns or policies added to `public.analytics_events`.
- Static verifier `scripts/verify-extension-app-source-scope.mjs` runs all six checks (function presence, D-01, D-02, D-13, language/security clause, grant execute) and is wired into `npm run prebuild`.
- `npm run build` runs the prebuild chain (Phase 1 service-role guard + new D-01 verifier) → `tsc -b` → `vite build` end-to-end with exit code 0.
- Negative-case test: corrupting all `app_source = 'tpc-extension'` literals causes the verifier to exit 1 with the precise D-01 error message; restoring returns to exit 0.

## Task Commits

1. **Task 1: Author the 6 RPC functions in a single timestamped migration file** — `9fec0c9` (feat)
2. **Task 2: Push the migration to the linked Supabase project + regenerate database types** — PENDING (BLOCKING checkpoint, operator action required)
3. **Task 3: Add a static SQL grep verifier enforcing the D-01 / D-02 / D-13 invariants** — `07029f6` (feat)

## Files Created/Modified

- `supabase/migrations/20260429120000_create_extension_rpcs.sql` — created. 437 lines. 6 `create or replace function public.get_*` blocks; each `language sql stable security invoker`; each followed by a matching `grant execute on function ...`.
- `scripts/verify-extension-app-source-scope.mjs` — created. 113 lines. ESM Node script with six static SQL grep checks; mirrors the style of `scripts/check-no-service-role-in-src.mjs` and `scripts/verify-migration-shape.mjs`.
- `package.json` — modified. `prebuild` script changed from `node scripts/check-no-service-role-in-src.mjs` to `node scripts/check-no-service-role-in-src.mjs && node scripts/verify-extension-app-source-scope.mjs`.

## Decisions Made

- **Tasks executed out of plan order (Task 3 before Task 2).** Task 2 is the BLOCKING human-action checkpoint and Task 3 is autonomous + only depends on Task 1's migration file. Running Task 3 first meant the orchestrator + user got a fully-validated invariant guard before the destructive `db push`, and the verifier could be tested against Task 1's output during this same agent invocation. The plan task order was preserved in commit ordering (T1 → T3 commits land in sequence), and Task 2 still gates resumption per the original plan contract.
- **`get_dominant_version` ordering.** The plan sketch said `string_to_array(extension_version, '.') desc nulls last` after `count(*) desc`. I retained that exactly. PostgreSQL compares text arrays element-wise: `string_to_array('2.0.10', '.')` returns `['2','0','10']` — pure lexicographic, so `'10'` sorts before `'2'`. The plan calls this out as acceptable per Open Question 5 ("lexicographic fallback for non-numeric suffixes is acceptable"). Filed as a known limitation; revisit only if multiple versions tie on count and the lex ordering returns the wrong winner in real data.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 3. Task 2 is intentionally not executed per plan `autonomous: false` and the orchestrator's `<checkpoint_handling>` contract.

(One minor verifier regex-fix happened during this same task block: my first `dateTruncRe` used `[^)]*` which fails to span the inner `(select unit from bucket_unit)` subquery; rewrote to `[\s\S]*?` for newline tolerance. Caught immediately by the verifier itself failing on a known-good migration. No commit churn — the fix landed inside the same Task 3 commit.)

## Issues Encountered

- **Worktree base mismatch.** The orchestrator's prompt referenced base commit `984d3cef9efe2d28c2f7d50f23df47c79bd1f7d4`, but the actual feature/v2-pivot-reset HEAD is `984d3cee069107ba85e96c60b345e9fa2e99b48c` (one character difference — likely a typo in the dispatch). Worktree opened on `main` (a5b76a7); fetched `feature/v2-pivot-reset` and reset to the actual feature-branch HEAD. Documented for the orchestrator.

## Threat Flags

None new. The plan's threat model (T-02-01..T-02-06) is fully covered by:
- T-02-01 (Tampering of array args) — RPC defaults to `array[]::text[]`; supabase-js parameterized layer handles serialization.
- T-02-02 (EoP via RPC body) — explicit `security invoker` on every function (verified by Check 5 in the verifier).
- T-02-03 (Information Disclosure via missing app_source filter) — verified by D-01 ≥6 occurrences check.
- T-02-04 (DoS via unbounded scan) — accepted per plan; index `analytics_events_event_type_created_at_idx` shipped Phase 1.
- T-02-05 (Information Disclosure via items_content) — RPCs do NOT return `items_content`; payload viewer goes through a separate dev-gated raw select (Plan 02-05).
- T-02-06 (PostgREST schema cache lag) — accepted per plan; documented in Task 2 verification step 4.

## Awaiting (Task 2 BLOCKING checkpoint)

The user must run, from the repo root, on a machine with the Supabase CLI authenticated against the shared linked project:

```
npm run db:push
npm run db:types
```

Expected outcomes:
1. `db:push` applies `20260429120000_create_extension_rpcs.sql` to the live linked project; output ends with "Finished supabase db push." and zero errors.
2. `db:types` rewrites `src/db/database.types.ts` with `Database['public']['Functions']` entries for all 6 RPCs. `get_cancellation_rates` Returns block must list `previous_rate: number | null` (5 columns total).
3. `grep -E "get_(event_volume_daily|kpi_totals|error_rate_by_type|per_user_summary|dominant_version|cancellation_rates):" src/db/database.types.ts` must return 6 matching lines.

Forbidden alternatives (per STATE.md Phase 1 v1.0 decision and CONTEXT canonical_refs): `supabase db pull`, `supabase db reset --linked`. Only `db push` and `gen types` are safe against the shared project.

After the user runs the two commands, the resume signal is "pushed" plus a paste of `git diff --stat src/db/database.types.ts`. The downstream plans (02-03 services-hooks onward) depend on the regenerated types for strong-typed RPC signatures; without them, plan 02-03 cannot type-check.

## Next Phase Readiness

- The migration is committed and verifier-validated. The file is safe for `db push`; the static verifier guarantees the D-01 / D-02 / D-13 invariants are intact.
- Plan 02-02 (Wave 1 sibling, URL hooks + devAccess + format) runs in parallel; it does NOT depend on this plan.
- Plans 02-03 and onward (Waves 2+) DO depend on:
  - The migration being applied to the live DB (so PostgREST exposes the RPCs).
  - `src/db/database.types.ts` being regenerated (so `supabase.rpc('get_kpi_totals', ...)` is strongly typed).
  Both of those happen in Task 2.

## Self-Check: PASSED

Verified:
- Migration file present: `supabase/migrations/20260429120000_create_extension_rpcs.sql` — FOUND
- Verifier file present: `scripts/verify-extension-app-source-scope.mjs` — FOUND
- Task 1 commit: `9fec0c9` — FOUND in git log
- Task 3 commit: `07029f6` — FOUND in git log
- prebuild script chain: confirmed in package.json (both verifiers)
- Full `npm run build` exit 0 (prebuild → tsc -b → vite build)
- Static verifier exits 0 against the migration; exits 1 with D-01 error when `app_source = 'tpc-extension'` is corrupted (negative-case verified)

---
*Phase: 02-extension-analytics-extension*
*Plan: 01*
*Status: paused at Task 2 BLOCKING checkpoint — awaiting operator-driven `npm run db:push` + `npm run db:types`*
