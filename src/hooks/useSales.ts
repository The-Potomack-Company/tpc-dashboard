import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

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
      return data ?? [];
    },
  });
}
