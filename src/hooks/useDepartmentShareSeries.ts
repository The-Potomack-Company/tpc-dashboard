// Phase 6 Plan 06-01 — TanStack Query hook for department_share_series RPC.
// REQ-ID: DEPT-03.
// RPC returns { rows: [...], top_codes: [...] } — top-N + 'other' aggregation.
// topCodes drives the legend order client-side so it matches the stacking
// order on the bar chart (consistent legend across sale-date sweep).
//
// Shape discipline: this RPC is the only one in Phase 6 that returns an
// object envelope (not an array). The shape guard asserts both 'rows' and
// 'top_codes' are present — an array payload OR a partial-object payload
// throws with a clear message so downstream consumers never dereference an
// undefined top_codes / rows and crash elsewhere.

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Range } from '../lib/period';

/**
 * Wide row keyed by sale_date + sale_number, with one key per top-N
 * department (value = share fraction in [0,1]) plus an `'other'` key that
 * aggregates every non-top-N department's share. The RPC computes shares as
 * revenue / per_sale_total with divide-by-zero guarded (nullif(total, 0) →
 * null → 0 in the output).
 */
export type DepartmentShareRow = {
  sale_date: string;
  sale_number: string;
} & Record<string, number | string>;

export interface DepartmentShareSeriesData {
  rows: readonly DepartmentShareRow[];
  topCodes: readonly string[];
}

// Nested freezes so both the envelope and the inner collections are
// referentially stable across refetches and can't be mutated in place.
const EMPTY_SHARE: DepartmentShareSeriesData = Object.freeze({
  rows: Object.freeze([]) as readonly DepartmentShareRow[],
  topCodes: Object.freeze([]) as readonly string[],
});

function isShareEnvelope(
  value: unknown,
): value is { rows: unknown; top_codes: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'rows' in value &&
    'top_codes' in value
  );
}

/**
 * Fetches top-N department share + 'other' aggregate time series for `range`.
 *
 * QueryKey: `['department-share-series', start, end, topN]`. topN is part of
 * the key because the server ranks depts by revenue — a different N produces
 * a different top-N list and thus different stacked segments.
 *
 * Response is reshaped from snake_case `top_codes` to camelCase `topCodes`
 * at this boundary so the rest of the UI stays in camelCase. This mirrors
 * how useSalesInRange leaves server shapes intact but adds typed surface.
 */
export function useDepartmentShareSeries(
  range: Range,
  topN: number,
): UseQueryResult<DepartmentShareSeriesData, Error> {
  return useQuery<DepartmentShareSeriesData, Error>({
    queryKey: [
      'department-share-series',
      range.start ?? 'null',
      range.end ?? 'null',
      topN,
    ],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('department_share_series', {
        range_start: range.start,
        range_end: range.end,
        top_n: topN,
      });
      if (error) throw new Error(error.message);
      if (!isShareEnvelope(data)) {
        throw new Error('Invalid department_share_series response shape');
      }
      const rowsIn = data.rows;
      const codesIn = data.top_codes;
      if (!Array.isArray(rowsIn) || !Array.isArray(codesIn)) {
        throw new Error('Invalid department_share_series response shape');
      }
      if (rowsIn.length === 0 && codesIn.length === 0) {
        return EMPTY_SHARE;
      }
      return {
        rows: rowsIn as unknown as readonly DepartmentShareRow[],
        topCodes: codesIn as readonly string[],
      };
    },
  });
}
