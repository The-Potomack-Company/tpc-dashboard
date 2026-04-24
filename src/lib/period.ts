// Period bounds math for the KPI landing page. Half-open intervals
// [start, end) matching the sale_date predicates in public.kpi_summary.
// All Dates are local-TZ — UTC serialization is done at the call site via
// toIsoDateLocal.
//
// Contract: .planning/phases/04-kpi-landing-page/04-RESEARCH.md § Pattern 2.
// Consumed by src/hooks/useKpiSummary.ts (Plan 04-03).

export type Period = 'ytd' | 'l6m' | 'l12m';

export interface PeriodBounds {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
}

/**
 * Adds `n` calendar months to `d`, wrapping the year when needed. Month-end
 * behavior relies on the browser's Date rollover — Jan 31 plus one month
 * yields Mar 3, not Feb 28. That drift is acceptable for analytics bounds
 * (RESEARCH Assumption A1) and is documented at the call sites.
 */
function addMonths(d: Date, n: number): Date {
  const result = new Date(d.getTime());
  result.setMonth(result.getMonth() + n);
  return result;
}

/**
 * Returns the half-open `[start, end)` bounds for `period` relative to `now`.
 *
 * - `ytd`  — current = [Jan 1 current year, now). previous = [Jan 1 previous year, Jan 1 current year).
 * - `l6m`  — current = [now - 6mo, now).         previous = [now - 12mo, now - 6mo).
 * - `l12m` — current = [now - 12mo, now).        previous = [now - 24mo, now - 12mo).
 *
 * Windows are contiguous: `previous.end === current.start` (by value) so no
 * sale row ever lives in both windows or in neither. This matches the SQL
 * `sale_date >= start AND sale_date < end` convention in public.kpi_summary.
 *
 * `now` is injectable so unit tests can pin a deterministic clock.
 */
export function computePeriodBounds(
  period: Period,
  now: Date = new Date(),
): PeriodBounds {
  if (period === 'ytd') {
    const currentStart = new Date(now.getFullYear(), 0, 1);
    const previousStart = new Date(now.getFullYear() - 1, 0, 1);
    return {
      current: { start: currentStart, end: now },
      previous: { start: previousStart, end: currentStart },
    };
  }
  if (period === 'l6m') {
    const currentStart = addMonths(now, -6);
    const previousStart = addMonths(now, -12);
    return {
      current: { start: currentStart, end: now },
      previous: { start: previousStart, end: currentStart },
    };
  }
  // l12m
  const currentStart = addMonths(now, -12);
  const previousStart = addMonths(now, -24);
  return {
    current: { start: currentStart, end: now },
    previous: { start: previousStart, end: currentStart },
  };
}

/**
 * Local-TZ `yyyy-mm-dd`. Do NOT substitute `d.toISOString().slice(0, 10)` —
 * that emits UTC and drifts a day near midnight US Eastern (RESEARCH Pitfall 2).
 * The RPC takes `date` (no TZ) so we match the user's wall clock, not UTC.
 */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// --------------------------------------------------------------------------
// Phase 5 — Range API for the Trends page DateRangeFilter.
//
// Contract: .planning/phases/05-trend-analysis/05-01-PLAN.md <behavior>,
// 05-UI-SPEC.md § Copywriting Contract → DateRangeFilter, and
// 05-CONTEXT.md § Date Range Filter (TRND-03).
//
// Shape note: Range.start / Range.end are yyyy-mm-dd strings (or null for the
// 'all' preset) — NOT Date objects. The Wave-2 data hooks (useSalesInRange,
// useDepartmentGrid) pass these values straight to PostgREST .gte() / .lte()
// on the sale_date column (a PG `date`). Pre-serializing here via
// toIsoDateLocal keeps the hook sites free of timezone bookkeeping and
// eliminates the "UTC drift" class of bug (04-RESEARCH Pitfall 2).
//
// Coexistence: the Period / PeriodBounds / computePeriodBounds API above is
// untouched. Phase 4's useKpiSummary still owns that surface. Phase 5 adds
// Range / rangeFromPreset without renaming or removing anything.
// --------------------------------------------------------------------------

/**
 * The five preset buckets surfaced by the DateRangeFilter (plus the implicit
 * 'custom' mode encoded on Range.preset, not here). Order matches the visual
 * order in UI-SPEC § Copywriting Contract → DateRangeFilter.
 */
export type RangePreset = 'ytd' | 'l6m' | 'l12m' | 'l24m' | 'all';

/**
 * A concrete date range with ISO-date strings that flow directly into
 * Supabase range predicates. `null` on start AND end signals "no bound" and
 * is used only by the 'all' preset — the hooks translate null into "omit the
 * gte/lte predicate entirely" so the query scans all sales.
 *
 * `preset` is `'custom'` only when the user has typed into the custom-range
 * inputs (plan 05-02). rangeFromPreset() never returns 'custom'.
 */
export interface Range {
  start: string | null;
  end: string | null;
  preset: RangePreset | 'custom';
}

/**
 * The app-wide default preset for the DateRangeFilter on first render.
 * Single source of truth so plan 05-02 (DateRangeFilter) and plan 05-07
 * (Trends page) can never drift. Contract: 05-UI-SPEC.md
 * § Copywriting Contract → DateRangeFilter → "Default selection: L12M".
 */
export const DEFAULT_RANGE_PRESET: RangePreset = 'l12m';

/**
 * Translates a preset label into a concrete Range anchored at `now`.
 *
 * - `ytd`  — start = Jan 1 of `now.getFullYear()`, end = `now`.
 * - `l6m`  — start = `now - 6mo`, end = `now`.
 * - `l12m` — start = `now - 12mo`, end = `now`.
 * - `l24m` — start = `now - 24mo`, end = `now`.
 * - `all`  — { start: null, end: null } — hooks MUST interpret null as
 *            "no gte/lte predicate" (no date filter applied).
 *
 * `now` is injectable so tests can pin a deterministic clock.
 *
 * Date serialization goes through `toIsoDateLocal` — never construct
 * `d.toISOString().slice(0, 10)` at a call site, because that emits UTC and
 * drifts a day near midnight US Eastern (04-RESEARCH Pitfall 2).
 */
export function rangeFromPreset(
  preset: RangePreset,
  now: Date = new Date(),
): Range {
  if (preset === 'all') {
    return { start: null, end: null, preset: 'all' };
  }
  if (preset === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1);
    return {
      start: toIsoDateLocal(start),
      end: toIsoDateLocal(now),
      preset: 'ytd',
    };
  }
  // Month-subtract presets share a single shape.
  const monthsBack: Record<Exclude<RangePreset, 'ytd' | 'all'>, number> = {
    l6m: -6,
    l12m: -12,
    l24m: -24,
  };
  const start = addMonths(now, monthsBack[preset]);
  return {
    start: toIsoDateLocal(start),
    end: toIsoDateLocal(now),
    preset,
  };
}
