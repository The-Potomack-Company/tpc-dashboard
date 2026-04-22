// Wave-2 data hook for Phase 5 Trend Analysis. Returns every `sales` row
// whose `sale_date` falls inside `range`, sorted chronologically so chart
// x-axes plot left-to-right in time order. Contract sources:
//
//   - .planning/phases/05-trend-analysis/05-CONTEXT.md § Data Fetching
//   - .planning/phases/05-trend-analysis/05-UI-SPEC.md § Interaction Contract
//   - .planning/phases/05-trend-analysis/05-03-PLAN.md <behavior>
//
// Consumers: TRND-01 (plan 05-04), TRND-02 (plan 05-04), TRND-06 (plan 05-05).
// TRND-04 / TRND-05 use the sibling `useDepartmentGrid` hook instead.
//
// Empty-array singleton (WR-08): returning `data ?? []` from the queryFn
// would mint a fresh array on every refetch, thrashing `useMemo` deps and
// selector equality checks downstream. The module-scope frozen array keeps
// reference stability across refetches and fails loudly on in-place
// mutation. This is deliberately NOT shared with `useSales.ts` — the two
// hooks should stay decoupled so a change in one (e.g. schema migration,
// shape tweak) can't silently break the other.
//
// Ordering note: ASCending by sale_date (opposite of `useSales`, which is
// DESC for the recent-first sales table). Recharts plots left-to-right by
// array index when `xAxis type='category'`, so charts need ASC order to
// avoid reversing every series at render time. `nullsFirst: false` keeps
// rows with null sale_date at the tail where they don't distort the plot.

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';
import type { Range } from '../lib/period';

type Sale = Database['public']['Tables']['sales']['Row'];

export type SalesInRange = Sale[];

// WR-08: module-scope frozen empty array. Never share with useSales's
// EMPTY_SALES — see file header.
const EMPTY_SALES_IN_RANGE: readonly Sale[] = Object.freeze(
  [],
) as readonly Sale[];

/**
 * Loads `sales` rows whose `sale_date` falls inside `range`, sorted ASC by
 * `sale_date` (nullsFirst: false). When `range.preset === 'all'` the
 * start/end bounds are null and no `.gte` / `.lte` predicate is applied —
 * the query scans every sale.
 *
 * Query key: `['sales-range', range.start, range.end]`. Using primitives
 * keeps the key stable and cheap to hash; two different presets that resolve
 * to the same start/end naturally share a cache entry (and that is the
 * correct behavior — they are the same query).
 *
 * `placeholderData: keepPreviousData` keeps the previously rendered series
 * visible while a range change triggers a refetch. UI-SPEC § Interaction
 * Contract locks the "no skeleton on refetch" behavior. Note: this is the
 * TanStack Query v5 API — the v4 `keepPreviousData: true` option was
 * removed, and TypeScript will silently accept the wrong form. Always use
 * the imported `keepPreviousData` sentinel (04-RESEARCH Pitfall 4).
 *
 * Errors from Supabase are thrown so `isError` fires. RLS (admin-only
 * SELECT on `sales`, Phase 1 migration) remains the authoritative access
 * control — this hook trusts the server.
 *
 * Range validation is the caller's responsibility (plan 05-02 Apply
 * handler). `range.start` / `range.end` flow into `.gte('sale_date', …)` /
 * `.lte('sale_date', …)` which supabase-js parameterizes — no injection
 * surface here (T-05-03-INJ: mitigate).
 */
export function useSalesInRange(
  range: Range,
): UseQueryResult<SalesInRange, Error> {
  return useQuery<SalesInRange, Error>({
    queryKey: ['sales-range', range.start, range.end],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from('sales').select('*');
      if (range.start) query = query.gte('sale_date', range.start);
      if (range.end) query = query.lte('sale_date', range.end);
      const { data, error } = await query.order('sale_date', {
        ascending: true,
        nullsFirst: false,
      });
      if (error) throw error;
      // WR-08: frozen singleton preserves referential equality across
      // refetches. Do not rewrite as `data ?? []`.
      return data ?? (EMPTY_SALES_IN_RANGE as Sale[]);
    },
  });
}
