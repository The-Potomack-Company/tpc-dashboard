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
