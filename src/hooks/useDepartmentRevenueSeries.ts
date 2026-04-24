// Phase 6 Plan 06-01 — TanStack Query hook for department_revenue_series RPC.
// REQ-ID: DEPT-02.
// Wide-row shape: one row per sale, one column per dept_code plus sale_date +
// sale_number. Recharts consumes these rows directly as its <LineChart> data
// with `<Line dataKey={code}>` — no client-side pivot required.
//
// QueryKey sorts deptCodes for cache-hit stability (order-insensitive) so
// toggling chips in a different order than last time still hits the cache.
// enabled: deptCodes.length > 0 — empty selection does NOT hit the server.
// The RPC's `cardinality(dept_codes) = 0` branch means "all depts" — we
// deliberately do not invoke that from this hook because the UI treats an
// empty chip-bar as "show nothing," not "show everything."
//
// Contract: 06-01-PLAN.md Task 6, 06-RESEARCH.md Assumption A7 (wide-row
// shape via jsonb_object_agg).

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Range } from '../lib/period';

/**
 * Wide row keyed by sale_date + sale_number, with one key per department_code
 * whose value is that dept's revenue for the sale (number | null — null when
 * the dept had no rows for the sale, though the RPC inner-joins so null
 * typically shouldn't appear in practice).
 */
export type DepartmentRevenueRow = {
  sale_date: string;
  sale_number: string;
} & Record<string, number | null | string>;

const EMPTY_REVENUE_SERIES: readonly DepartmentRevenueRow[] = Object.freeze(
  [],
) as readonly DepartmentRevenueRow[];

/**
 * Fetches the revenue-per-dept time series for `range` restricted to the
 * departments in `deptCodes`.
 *
 * QueryKey: `['department-revenue-series', start, end, sortedJoinedDeptCodes]`.
 * The fourth slot is a comma-joined sorted string so `['FRN','ASN']` and
 * `['ASN','FRN']` share a cache entry — the visual chip order doesn't change
 * the query identity.
 *
 * `enabled` is false when deptCodes is empty so the chip-bar in "nothing
 * selected" state doesn't hammer the server — the UI renders an empty chart.
 *
 * Shape check asserts Array.isArray; the wide-row union type makes the cast
 * through `unknown` necessary because Json doesn't carry dept-code-keyed
 * structural information at compile time.
 */
export function useDepartmentRevenueSeries(
  range: Range,
  deptCodes: readonly string[],
): UseQueryResult<readonly DepartmentRevenueRow[], Error> {
  const sortedJoined = [...deptCodes].sort().join(',');
  return useQuery<readonly DepartmentRevenueRow[], Error>({
    queryKey: [
      'department-revenue-series',
      range.start ?? 'null',
      range.end ?? 'null',
      sortedJoined,
    ],
    enabled: deptCodes.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('department_revenue_series', {
        range_start: range.start,
        range_end: range.end,
        dept_codes: [...deptCodes],
      });
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) {
        throw new Error('Invalid department_revenue_series response shape');
      }
      if (data.length === 0) return EMPTY_REVENUE_SERIES;
      return data as unknown as DepartmentRevenueRow[];
    },
  });
}
