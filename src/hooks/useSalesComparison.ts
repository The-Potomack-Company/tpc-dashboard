// Phase 6 Plan 06-01 — TanStack Query hook fetching 2–4 sales by sale_number.
// REQ-ID: SALE-04, SALE-05.
// QueryKey sorts saleNumbers (cache-hit stability). Returned rows reordered
// to match caller input order so column indexing in ComparisonTable is stable.
// Missing sale → throws so the page renders the invalid-URL error card.
//
// Why the sort-a-copy discipline matters: the caller's array is consumed both
// here and downstream by the ComparisonTable (column order). Mutating it in
// place would reverse the on-screen column order compared to the URL. We sort
// a COPY for the cache key and pass the original through for display ordering.
//
// Why missing sale_number throws rather than silently dropping: 06-RESEARCH
// Open Question #3 locks "any missing sale → fully invalid" so the invalid-URL
// card renders uniformly. Partial comparisons would be misleading (e.g. "3 of 4"
// compared when the user asked for 4 specific sales).

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

// Module-scope singleton for the empty-result return. Kept separate from
// other hooks' singletons (each file owns its shape) so a schema change in
// sales doesn't silently ripple.
const EMPTY_SALES: readonly Sale[] = Object.freeze([]) as readonly Sale[];
// Satisfy TypeScript: EMPTY_SALES is returned when the enabled-gate blocks
// the fetch and we want a stable reference for downstream consumers. Even
// though TanStack Query's `data` is undefined in the disabled state, the
// Sale[] typing is used by the reordering Map below and callers.
void EMPTY_SALES;

/**
 * Fetches a set of sales by `sale_number`, enabled only for [2, 4] inputs.
 *
 * QueryKey: `['sales-comparison', sortedSaleNumbersArray]`. The sort is on a
 * COPY (`[...saleNumbers].sort()`) so a caller that passes a frozen array
 * doesn't explode, and so the displayed column order (from the original
 * `saleNumbers`) is preserved. Two requests for the same set of sale numbers
 * in different orders share a cache entry — which is correct: they are the
 * same query semantically.
 *
 * Post-fetch reorder: PostgREST doesn't guarantee result order for `.in()`,
 * so we build a Map keyed by sale_number and look up each caller-supplied
 * number. If any is missing we throw with a `missing: a, b, c` message; the
 * SaleCompare page catches this and renders the invalid-URL card.
 *
 * Gates:
 *   - `enabled: saleNumbers.length >= 2 && <= 4` — matches the URL contract
 *     (comparison requires 2-4 sales). Fewer / more → invalid URL, caller
 *     short-circuits to the error card before calling this hook.
 *
 * Trust boundary (T-06-01-05): `saleNumbers` is already whitelisted to
 * `[A-Za-z0-9-_]+` by plan 06-04's parseSalesParam helper before reaching
 * this hook. We pass the validated array through to `.in('sale_number',…)`
 * which supabase-js parameterizes — no string concat into SQL.
 */
export function useSalesComparison(
  saleNumbers: readonly string[],
): UseQueryResult<readonly Sale[], Error> {
  // Sort a copy for the cache key; preserve the original for display order.
  const sortedKey = [...saleNumbers].sort();
  return useQuery<readonly Sale[], Error>({
    queryKey: ['sales-comparison', sortedKey],
    enabled: saleNumbers.length >= 2 && saleNumbers.length <= 4,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .in('sale_number', [...saleNumbers]);
      if (error) throw new Error(error.message);
      if (!data) return EMPTY_SALES;

      // Reorder server rows into the caller's requested order. Using a Map
      // keeps this O(n) instead of O(n²) (important when callers pass up
      // to 4 numbers and the server returns up to 4 rows — tiny N, but the
      // pattern scales).
      const byNumber = new Map<string, Sale>(
        (data as Sale[]).map((r) => [r.sale_number, r]),
      );
      const ordered: Sale[] = [];
      const missing: string[] = [];
      for (const n of saleNumbers) {
        const row = byNumber.get(n);
        if (row == null) missing.push(n);
        else ordered.push(row);
      }

      if (missing.length > 0) {
        throw new Error(
          `One or more sale numbers not found: ${missing.join(', ')}`,
        );
      }
      return ordered;
    },
  });
}
