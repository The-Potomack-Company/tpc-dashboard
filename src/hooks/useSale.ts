import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleDepartment = Database['public']['Tables']['sale_departments']['Row'] & {
  department?: Pick<
    Database['public']['Tables']['departments']['Row'],
    'code' | 'display_name' | 'auto_discovered'
  > | null;
};

/**
 * Discriminated union returned by {@link useSale}. Consumers should branch on
 * `status` before reading `sale` / `departments`.
 *
 * - `ok`        — the sale exists; `departments` is always an array (possibly empty).
 * - `not_found` — PostgREST returned no row; the URL param is invalid or the
 *                 sale has been removed. Page components render the 404 state.
 */
export type SaleDetail =
  | { status: 'ok'; sale: Sale; departments: SaleDepartment[] }
  | { status: 'not_found' };

/**
 * Loads a single sale and its department breakdown in one round trip using
 * PostgREST embedded resources. See 03-RESEARCH.md Pattern 3 (preferred
 * variant) for rationale — one cache entry keyed `['sale', saleNumber]`,
 * one HTTP call, native 404 via `.maybeSingle()`.
 *
 * Guards:
 *   - `enabled: Boolean(saleNumber)` — react-router's `useParams()` returns
 *     `Partial<T>`; never fire the query for an empty/undefined param.
 *   - RLS is admin-only (Phase 1 migration); the anon key cannot escalate.
 *   - `saleNumber` flows into `.eq('sale_number', …)` which PostgREST
 *     parameterizes — no SQL concat, no injection surface.
 */
export function useSale(saleNumber: string) {
  return useQuery<SaleDetail>({
    queryKey: ['sale', saleNumber],
    staleTime: 5 * 60_000,
    enabled: Boolean(saleNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(
          `
            *,
            sale_departments (
              *,
              department:departments ( code, display_name, auto_discovered )
            )
          `,
        )
        .eq('sale_number', saleNumber)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { status: 'not_found' };
      const { sale_departments, ...sale } = data as Sale & {
        sale_departments: SaleDepartment[] | null;
      };
      return { status: 'ok', sale, departments: sale_departments ?? [] };
    },
  });
}
