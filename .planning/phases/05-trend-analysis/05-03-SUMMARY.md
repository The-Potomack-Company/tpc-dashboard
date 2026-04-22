---
phase: 05-trend-analysis
plan: 03
subsystem: trends-data-hooks
tags: [tanstack-query, supabase, hooks, range-filter, wave-2]
one_liner: "Two TanStack Query v5 hooks (useSalesInRange, useDepartmentGrid) that back every Phase 5 chart — range-predicated, ASC-sorted, with keepPreviousData and frozen empty-array singletons."
dependency_graph:
  requires:
    - src/lib/period.ts#Range (Plan 05-01)
    - src/lib/supabase.ts
    - src/db/database.types.ts
  provides:
    - src/hooks/useSalesInRange.ts#useSalesInRange
    - src/hooks/useSalesInRange.ts#SalesInRange
    - src/hooks/useDepartmentGrid.ts#useDepartmentGrid
    - src/hooks/useDepartmentGrid.ts#DeptGridRow
    - src/hooks/useDepartmentGrid.ts#DeptGridDept
  affects:
    - Plan 05-04 (TRND-01 / TRND-02 charts — will consume useSalesInRange)
    - Plan 05-05 (TRND-05 estimate accuracy + TRND-06 bidder participation)
    - Plan 05-06 (TRND-04 heat map — will consume useDepartmentGrid)
    - Plan 05-07 (Trends page wiring)
tech_stack:
  added: []
  patterns:
    - "PostgREST resource embedding via .select('parent_col, relation(child_cols)')"
    - "TanStack Query v5 keepPreviousData (imported sentinel, not v4 boolean)"
    - "WR-08 frozen empty-array singleton for reference stability across refetches"
key_files:
  created:
    - src/hooks/useSalesInRange.ts
    - src/hooks/useSalesInRange.test.ts
    - src/hooks/useDepartmentGrid.ts
    - src/hooks/useDepartmentGrid.test.ts
  modified: []
decisions:
  - "Per-hook EMPTY_* singletons (not a shared module-level export): keeps useSales / useSalesInRange / useDepartmentGrid fully decoupled so a change in one can never silently break the others."
  - "Primitive queryKey ['{name}', range.start, range.end] instead of ['{name}', range]: cheaper to hash, and two presets that resolve to the same start/end correctly share a cache entry."
  - "Sale-level lots_sold hoisted into the top-level select for useDepartmentGrid: TRND-05 needs the SALE total as a denominator; the embedded sale_departments[].lots_sold is the per-dept numerator. PostgREST returns them on separate objects so no name collision at runtime."
  - "Hand-authored DeptGridRow / DeptGridDept types instead of re-using the generated Row type: Supabase typegen does not synthesize PostgREST embed shapes, so we document the runtime shape explicitly."
  - "Inline mock supabase chain in each test file instead of a shared helper: YAGNI — extract when a third consumer shows up (plans 05-04..07)."
metrics:
  duration_seconds: 186
  tasks_completed: 2
  files_touched: 4
  commits: 4
  tests_added: 11
completed: 2026-04-22T17:47:06Z
---

# Phase 5 Plan 3: Trends Data Hooks Summary

## Objective

Ship the two data hooks that back every Phase 5 chart so Wave-3 chart plans can consume a stable contract instead of re-implementing the range predicate logic in each chart component.

## What Was Built

### `useSalesInRange(range: Range) → UseQueryResult<Sale[], Error>`

- **File:** `src/hooks/useSalesInRange.ts`
- **Query key:** `['sales-range', range.start, range.end]`
- **Query:**
  ```ts
  let query = supabase.from('sales').select('*');
  if (range.start) query = query.gte('sale_date', range.start);
  if (range.end)   query = query.lte('sale_date', range.end);
  await query.order('sale_date', { ascending: true, nullsFirst: false });
  ```
- **Options:** `staleTime: 5 * 60_000`, `placeholderData: keepPreviousData`.
- **Empty data:** frozen `EMPTY_SALES_IN_RANGE` singleton (referential equality preserved across refetches).
- **Sort order:** ASCending by `sale_date` — chart x-axes plot left-to-right in time order. `nullsFirst: false` keeps rows with null `sale_date` at the tail so they do not distort the plot.
- **Consumers:** TRND-01 (plan 05-04), TRND-02 (plan 05-04), TRND-06 (plan 05-05).

### `useDepartmentGrid(range: Range) → UseQueryResult<DeptGridRow[], Error>`

- **File:** `src/hooks/useDepartmentGrid.ts`
- **Query key:** `['dept-grid', range.start, range.end]`
- **Select string (exact):**
  ```
  sale_number, sale_date, lots_sold, sale_departments(department_code, sell_through_pct, revenue, total_sold_value, lots_sold, low_estimate, high_estimate)
  ```
- **Returned shape:**
  ```ts
  export interface DeptGridDept {
    department_code: string;
    sell_through_pct: number | null;
    revenue: number | null;
    total_sold_value: number | null;
    lots_sold: number | null;         // dept-level numerator
    low_estimate: number | null;
    high_estimate: number | null;
  }
  export interface DeptGridRow {
    sale_number: string;
    sale_date: string | null;
    lots_sold: number | null;          // sale-level denominator
    sale_departments: DeptGridDept[];
  }
  ```
- **Options:** `staleTime: 5 * 60_000`, `placeholderData: keepPreviousData`.
- **Empty data:** frozen `EMPTY_GRID` singleton.
- **Consumers:** TRND-04 heat map (plan 05-06), TRND-05 estimate accuracy (plan 05-05).

## How Consumers Should Destructure

Both hooks follow the same shape — consumers should prefer:

```ts
const { data, isPending, isError, error } = useSalesInRange(range);

if (isPending && !data) return <ChartSkeleton />;  // initial load only
if (isError) return <ErrorState error={error} />;
if (!data || data.length === 0) return <EmptyState />;
return <Chart data={data} />;
```

- `isPending && !data` — show skeleton only on the very first load. During a range flip, `placeholderData: keepPreviousData` keeps the prior series rendered so users never see a blank chart.
- `data.length === 0` — distinguish "no rows in this range" (empty-state card) from "still loading" (skeleton).
- `data` is a frozen empty array when Supabase returns null, so `data.length` is always safe.

## Test Counts

- `src/hooks/useSalesInRange.test.ts` — **5 tests**, all pass.
- `src/hooks/useDepartmentGrid.test.ts` — **6 tests**, all pass.
- Full suite after commit: **370 tests across 40 files**, all green. No regressions in any Phase 3/4 hook tests.

## Deviations from Plan

None — plan executed exactly as written. The Task-2 read_first referenced `src/hooks/useSale.ts` (correct path; plan had a typo `useSale.ts` vs `useSales.ts` — both files exist and both were consulted for the embedded-relation select pattern). No behavioral or contractual deviations.

## Commits

| Task       | Type     | Message                                                              | Hash    |
| ---------- | -------- | -------------------------------------------------------------------- | ------- |
| 1 (RED)    | test     | test(05-03): add failing tests for useSalesInRange hook              | e8bba1f |
| 1 (GREEN)  | feat     | feat(05-03): implement useSalesInRange hook                          | 1d87626 |
| 2 (RED)    | test     | test(05-03): add failing tests for useDepartmentGrid hook            | 6c09bc9 |
| 2 (GREEN)  | feat     | feat(05-03): implement useDepartmentGrid hook                        | 3916451 |

## Verification Evidence

- `npx vitest --run src/hooks/useSalesInRange.test.ts` → 5/5 pass
- `npx vitest --run src/hooks/useDepartmentGrid.test.ts` → 6/6 pass
- `npx vitest --run` → 370/370 pass across 40 files
- `npm run build` → passes (tsc + vite build, 251 modules)

## Security / Threat Notes

- **T-05-03-INJ (mitigate):** `range.start` / `range.end` flow into parameterized supabase-js `.gte('sale_date', value)` / `.lte('sale_date', value)` calls — column name is a literal, value is a parameter. No string concatenation into SQL.
- **T-05-03-RBAC (mitigate):** RLS admin-only SELECT on `sales` + `sale_departments` (Phase 1 migration `20260421000007`) is the authoritative access control. Hooks trust the server.
- **T-05-03-DESTRUCTIVE (accept):** Both hooks are SELECT-only — no INSERT / UPDATE / DELETE surface introduced.
- No new threat surface beyond what the plan's threat_model documented; no threat flags to raise.

## Self-Check: PASSED

- `src/hooks/useSalesInRange.ts` — FOUND
- `src/hooks/useSalesInRange.test.ts` — FOUND
- `src/hooks/useDepartmentGrid.ts` — FOUND
- `src/hooks/useDepartmentGrid.test.ts` — FOUND
- Commit `e8bba1f` (test useSalesInRange) — FOUND
- Commit `1d87626` (feat useSalesInRange) — FOUND
- Commit `6c09bc9` (test useDepartmentGrid) — FOUND
- Commit `3916451` (feat useDepartmentGrid) — FOUND

## Known Stubs

None — both hooks are fully wired to Supabase and consumed via TanStack Query. No placeholder data, no TODOs, no empty-component patterns.
