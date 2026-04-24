import { z } from 'zod';

// Zod schema for the public.kpi_summary RPC payload. Bridges the PostgREST
// `Json` return type to a typed `KpiSummary` the UI can rely on.
//
// Contract: .planning/phases/04-kpi-landing-page/04-RESEARCH.md § Pattern 4
// and § Pitfall 1 (why a runtime schema instead of a `as KpiSummary` cast).
// Consumed by src/hooks/useKpiSummary.ts (Plan 04-03) — `parse(data)` is the
// T-04-05 trust boundary between PostgREST response and typed render code.

/**
 * Accepts either a JS number OR a string that coerces to a finite number.
 *
 * PostgREST serializes `numeric(14,2)` values as strings when they exceed
 * JavaScript's safe integer range to preserve precision. The RPC's current
 * revenue values fit inside `Number.MAX_SAFE_INTEGER` comfortably, but the
 * schema is defensive so downstream math is always typed `number`.
 *
 * Non-numeric strings (e.g. "bogus", "null") fail the parse — `Number('null')`
 * is NaN which is caught by the `.refine` predicate.
 */
const numericLike = z
  .union([
    z.number(),
    z
      .string()
      .transform((s) => Number(s))
      .refine((n) => Number.isFinite(n), {
        message: 'expected a finite numeric string',
      }),
  ])
  .refine((n) => typeof n === 'number' && Number.isFinite(n), {
    message: 'expected a finite number',
  });

const windowSchema = z.object({
  // COALESCE'd server-side → never null
  revenue: numericLike,
  // NULLIF(SUM(lots_auctioned), 0) can emit null when no lots auctioned
  sell_through: numericLike.nullable(),
  // COALESCE'd server-side → never null
  lots_sold: numericLike,
  // COUNT(*) → never null
  sales_count: numericLike,
});

export const kpiSummarySchema = z.object({
  current: windowSchema,
  previous: windowSchema,
});

export type KpiWindow = z.infer<typeof windowSchema>;
export type KpiSummary = z.infer<typeof kpiSummarySchema>;
