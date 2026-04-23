// Phase 6 Plan 06-01 — TanStack Query hook for department_rankings RPC.
// REQ-ID: DEPT-01.
// INFR-04 satisfied via server-side aggregation (RPC).
// Frozen-empty singleton prevents referential instability across refetches
// (mirror useSalesInRange's EMPTY_SALES_IN_RANGE pattern).
//
// Contract: 06-01-PLAN.md Task 5, 06-RESEARCH.md Pattern 1 (RPC return shape).
// Consumers: 06-02 Departments page (DepartmentRankingsTable).
//
// Range bounds flow straight to the RPC as date strings (or null). The RPC
// uses `coalesce(range_start, '0001-01-01'::date)` + `coalesce(range_end,
// '9999-12-31'::date)` so null on either side means "unbounded" — which is
// how the 'all' preset works without extra logic on the client side.

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Range } from '../lib/period';

/**
 * Shape of a single ranking row returned by `public.department_rankings`.
 *
 * - `department_code` — canonical code (e.g. 'ASN', 'FRN'). Never null.
 * - `display_name`    — nullable: auto-discovered codes may arrive without a
 *                       curated label until a human fills it in.
 * - `sales_count`     — distinct sale_ids this dept appeared in, in range.
 * - `total_revenue`   — sum of sd.revenue in range, numeric(14,2). Zero when
 *                       the dept had rows but no revenue (never null; server
 *                       coalesces).
 * - `avg_sell_through` — mean sell_through_pct across dept-rows, filtering
 *                        out null rows. Null when no dept-rows had a value.
 * - `lots_above_estimate` — sum of lots_sold where total_sold_value >
 *                            high_estimate (assumption A1 definition).
 */
export interface DepartmentRanking {
  department_code: string;
  display_name: string | null;
  sales_count: number;
  total_revenue: number;
  avg_sell_through: number | null;
  lots_above_estimate: number;
}

// Module-level frozen singleton. Using Object.freeze + a readonly type gives
// both runtime (Object.isFrozen === true) and compile-time guarantees against
// in-place mutation. Do not share this with the other dept hooks' singletons —
// keeping them decoupled means a shape change in one doesn't silently affect
// the others.
const EMPTY_RANKINGS: readonly DepartmentRanking[] = Object.freeze(
  [],
) as readonly DepartmentRanking[];

/**
 * Fetches department rankings for `range`. Returns `readonly DepartmentRanking[]`
 * sorted by `total_revenue DESC` (server-side — see RPC `order by` clause).
 *
 * QueryKey: `['department-rankings', start, end]`. Null → 'null' sentinel so
 * React Query's JSON-key hashing treats 'all' as a distinct stable entry.
 *
 * Shape check: the RPC returns `jsonb` typed as `Json` on the client.
 * We assert Array.isArray before casting to DepartmentRanking[] — an object
 * payload (e.g. `{ bogus: true }`) would fall through to the downstream
 * consumers and crash later with no diagnostic trail; the throw here flips
 * TanStack Query's `isError` flag with a clear message.
 *
 * Empty-array case returns the frozen module-singleton so downstream
 * `useMemo` / selector dependencies stay referentially stable across
 * refetches (WR-08 pattern from Phase 5).
 */
export function useDepartmentRankings(
  range: Range,
): UseQueryResult<readonly DepartmentRanking[], Error> {
  return useQuery<readonly DepartmentRanking[], Error>({
    queryKey: ['department-rankings', range.start ?? 'null', range.end ?? 'null'],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('department_rankings', {
        range_start: range.start,
        range_end: range.end,
      });
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) {
        throw new Error('Invalid department_rankings response shape');
      }
      if (data.length === 0) return EMPTY_RANKINGS;
      return data as unknown as DepartmentRanking[];
    },
  });
}
