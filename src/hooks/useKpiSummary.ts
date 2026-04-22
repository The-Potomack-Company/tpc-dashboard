import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  computePeriodBounds,
  toIsoDateLocal,
  type Period,
} from '../lib/period';
import { kpiSummarySchema, type KpiSummary } from '../lib/kpi-schema';

/**
 * Loads the `{ current, previous }` KPI aggregates from `public.kpi_summary`.
 *
 * Query key: `['kpi', period]` — the period enum identifies the bounds at any
 * clock time. Including `now` in the key would thrash the cache on every
 * render. At 5-minute `staleTime` the rolling-window drift across a minute
 * near midnight is immaterial (04-RESEARCH.md § Pattern 3).
 *
 * TanStack Query v5: `placeholderData: keepPreviousData` preserves the
 * rendered cards while a period flip refetches. The prior v4 API
 * `keepPreviousData: true` was removed in v5 and TypeScript will silently
 * tolerate it — always use the imported helper (04-RESEARCH.md § Pitfall 4).
 *
 * Trust boundary (T-04-07): `kpiSummarySchema.parse(data)` narrows the
 * PostgREST `Json` return to `KpiSummary` at runtime. Without the parse,
 * downstream consumers access `.current.revenue` on opaque `Json` and lose
 * type safety — see 04-RESEARCH.md § Pitfall 1. Zod throws on malformed
 * payloads which TanStack Query surfaces as `isError`.
 *
 * Date serialization: `toIsoDateLocal` emits yyyy-mm-dd in the user's local
 * timezone. Do NOT substitute `toISOString().slice(0, 10)` — that emits UTC
 * which drifts a day near midnight in US East (04-RESEARCH.md § Pitfall 2).
 */
export function useKpiSummary(period: Period) {
  return useQuery<KpiSummary>({
    queryKey: ['kpi', period],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const bounds = computePeriodBounds(period);
      const { data, error } = await supabase.rpc('kpi_summary', {
        period_start: toIsoDateLocal(bounds.current.start),
        period_end: toIsoDateLocal(bounds.current.end),
        compare_start: toIsoDateLocal(bounds.previous.start),
        compare_end: toIsoDateLocal(bounds.previous.end),
      });
      if (error) throw error;
      return kpiSummarySchema.parse(data);
    },
  });
}
