import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

// WR-08: Stable empty-array singleton. Returning `data ?? []` from the
// queryFn creates a fresh array on every refetch, breaking referential
// equality downstream (Object.is checks, useMemo dep arrays, etc). The
// singleton is frozen so accidental in-place mutation fails loudly.
const EMPTY_SALES: readonly Sale[] = Object.freeze([]) as readonly Sale[];

/**
 * Loads every row of `sales`, sorted newest-first by `sale_date`.
 *
 * Query key: `['sales']` — shared across the app; `queryClient.invalidateQueries`
 * on this key refetches the sales list. Stale-time is 5 minutes per
 * 03-CONTEXT.md (sales data churns rarely; a completed sale never changes).
 *
 * Errors from Supabase are thrown so TanStack Query's `isError` branch fires.
 * RLS is enforced server-side (admin-only SELECT on `sales` per Phase 1
 * migration 20260421000007). This hook relies on that policy for access
 * control; the Zustand `isAdmin` flag is advisory, not authoritative.
 */
export function useSales() {
  return useQuery<Sale[]>({
    queryKey: ['sales'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      // WR-08: Return the frozen singleton instead of an inline literal so
      // consumers that rely on reference stability (useMemo deps, selector
      // equality, etc.) don't thrash on every refetch.
      return data ?? (EMPTY_SALES as Sale[]);
    },
  });
}
