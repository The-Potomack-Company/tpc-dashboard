// Wave-2 data hook for Phase 5 Trend Analysis. Returns every `sales` row
// in `range` with its `sale_departments` children embedded via PostgREST's
// resource embedding syntax. Single query, one round trip.
//
// Contract sources:
//   - .planning/phases/05-trend-analysis/05-CONTEXT.md § Data Fetching
//   - .planning/phases/05-trend-analysis/05-03-PLAN.md <behavior> Task 2
//   - .planning/phases/05-trend-analysis/05-UI-SPEC.md § Layout Specifications
//
// Consumers:
//   - TRND-04 heat map (plan 05-06): cells use `sell_through_pct` (0..100)
//     or `revenue / total_sold_value` per dept depending on the metric toggle.
//   - TRND-05 estimate accuracy stacked area (plan 05-05): classifies each
//     dept row as below / within / above estimate using `total_sold_value`
//     compared to `low_estimate` / `high_estimate`, weights by dept-level
//     `lots_sold`, and normalizes by the sale-level `lots_sold` denominator.
//
// Why sale-level `lots_sold` is hoisted into the top-level select: TRND-05
// needs the SALE's total lots sold as the denominator when computing each
// dept's share of the sale. The generated Supabase Row type already
// surfaces the column; we just make sure PostgREST returns it alongside
// the embedded dept rows. The embedded `sale_departments(...).lots_sold`
// is the per-dept count used in the numerator and they are separate
// fields — one for the sale total, one per department. PostgREST returns
// them on the respective objects so there is no name collision at runtime.
//
// Why the return type is hand-authored instead of generated: the generated
// `Database['public']['Tables']['sales']['Row']` describes the sale ROW,
// not the PostgREST embedded shape. Supabase's typegen does not synthesize
// embed shapes. Declaring DeptGridRow / DeptGridDept here documents the
// exact runtime shape consumers can rely on and keeps the hook's external
// contract independent of any future schema changes that aren't used by
// this query.
//
// Empty-array singleton (WR-08): same rationale as useSalesInRange — a
// frozen module-scope array preserves referential equality across refetches
// and fails loudly on in-place mutation. Intentionally not shared with
// useSales / useSalesInRange so the three hooks stay decoupled.

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Range } from '../lib/period';

export interface DeptGridDept {
  department_code: string;
  sell_through_pct: number | null;
  revenue: number | null;
  total_sold_value: number | null;
  lots_sold: number | null;
  low_estimate: number | null;
  high_estimate: number | null;
}

export interface DeptGridRow {
  sale_number: string;
  sale_date: string | null;
  /** Sale-level total. TRND-05 uses this as the denominator. */
  lots_sold: number | null;
  sale_departments: DeptGridDept[];
}

// Exact select string; MUST list sale-level columns first and then the
// embedded relation. Changing the order or adding/removing columns will
// break TRND-04 / TRND-05 consumers — update this AND the hook tests
// AND the affected consumer tests together.
const DEPT_GRID_SELECT =
  'sale_number, sale_date, lots_sold, sale_departments(department_code, sell_through_pct, revenue, total_sold_value, lots_sold, low_estimate, high_estimate)';

// WR-08: module-scope frozen empty array. Not shared with
// useSalesInRange / useSales — see file header.
const EMPTY_GRID: readonly DeptGridRow[] = Object.freeze(
  [],
) as readonly DeptGridRow[];

/**
 * Loads sales + embedded department rows for `range`, sorted ASC by
 * `sale_date`. See file-level doc for the exact shape and consumer list.
 *
 * Query key: `['dept-grid', range.start, range.end]`. Primitive key for
 * cache stability.
 *
 * `placeholderData: keepPreviousData` — keeps the previous grid visible
 * while a range change refetches (UI-SPEC § Interaction Contract).
 *
 * Errors throw; RLS on `sales` + `sale_departments` (admin-only SELECT,
 * Phase 1 migration) remains the authoritative access check.
 * `range.start/end` flow into parameterized `.gte` / `.lte` — no injection
 * surface (T-05-03-INJ: mitigate).
 */
export function useDepartmentGrid(
  range: Range,
): UseQueryResult<DeptGridRow[], Error> {
  return useQuery<DeptGridRow[], Error>({
    queryKey: ['dept-grid', range.start, range.end],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from('sales').select(DEPT_GRID_SELECT);
      if (range.start) query = query.gte('sale_date', range.start);
      if (range.end) query = query.lte('sale_date', range.end);
      const { data, error } = await query.order('sale_date', {
        ascending: true,
        nullsFirst: false,
      });
      if (error) throw error;
      // Runtime cast: PostgREST returns the embedded shape, but the
      // generated types don't describe embeds. The hand-authored
      // DeptGridRow contract here is the documented runtime shape.
      // WR-08: frozen singleton on null data — preserves reference equality.
      return (
        (data as unknown as DeptGridRow[] | null) ??
        (EMPTY_GRID as DeptGridRow[])
      );
    },
  });
}
