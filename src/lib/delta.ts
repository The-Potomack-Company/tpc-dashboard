// Phase 6 Plan 06-01 — adjacent-pair delta helper for SALE-05 (ComparisonTable).
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § delta.ts signature.
// REQ-ID: SALE-05.
// FLAT_THRESHOLD = 0.0005 (0.05%) — locked by UI-SPEC Color § flat direction.
//
// This module is distinct from src/lib/format.ts's formatDelta (Phase 4 KPI
// cards). format.ts's helper returns a 4-part glyph/text/direction/aria bundle
// for the scorecard context. computePairDelta here returns a 2-part
// text/direction pair tuned for dense comparison-table cells — the cell
// renderer pairs it with deltaColorClass(direction) to apply the Tailwind
// color atomically. Em-dash for "no data" is U+2014 (matches format.ts EMPTY).

export type DeltaDirection = 'up' | 'down' | 'flat' | 'none';

export interface PairDelta {
  text: string;
  direction: DeltaDirection;
}

/**
 * FLAT_THRESHOLD locked to 0.0005 (0.05%) per UI-SPEC Color section: any
 * |delta| below this renders as the flat/gray state. Values just above the
 * threshold render as '+0.1%' after toFixed(1) rounding; values exactly at
 * the threshold also round to that — this is fine, the gray/colored flip is
 * a visual affordance not a financial classification.
 */
const FLAT_THRESHOLD = 0.0005;

/**
 * `relative`     — `(current - previous) / previous`, rendered as `"+12.4%"`
 *                  / `"-8.1%"`. Used for currency + count columns.
 * `absolute_pp`  — `current - previous` where both values are ratios in
 *                  [0, 1], rendered as `"+3.2pp"` / `"-1.8pp"`. Used for the
 *                  sell-through comparison row because subtracting two
 *                  ratios already gives the absolute percentage-point delta
 *                  — applying the relative formula would double-divide.
 *
 * "None" states (em-dash, direction='none'):
 *   - current == null OR previous == null (any side missing)
 *   - relative mode AND previous === 0 (divide-by-zero guard)
 *
 * "Flat" state: |delta| < FLAT_THRESHOLD. Renders "0.0%" / "0.0pp" (no sign
 * prefix) so the zero reading is explicit; direction='flat' lets the cell
 * pick the gray color class.
 */
export function computePairDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  mode: 'relative' | 'absolute_pp' = 'relative',
): PairDelta {
  if (current == null || previous == null) {
    return { text: '—', direction: 'none' };
  }

  if (mode === 'relative') {
    if (previous === 0) {
      return { text: '—', direction: 'none' };
    }
    const ratio = (current - previous) / previous;
    if (Math.abs(ratio) < FLAT_THRESHOLD) {
      return { text: '0.0%', direction: 'flat' };
    }
    const pct = (ratio * 100).toFixed(1);
    return {
      // A negative ratio's toFixed(1) already carries the '-' sign; only
      // positives need an explicit '+' prefix.
      text: `${ratio > 0 ? '+' : ''}${pct}%`,
      direction: ratio > 0 ? 'up' : 'down',
    };
  }

  // absolute_pp — both inputs are ratios 0-1 (e.g. sell_through_pct / 100).
  const diff = current - previous;
  if (Math.abs(diff) < FLAT_THRESHOLD) {
    return { text: '0.0pp', direction: 'flat' };
  }
  const pp = (diff * 100).toFixed(1);
  return {
    text: `${diff > 0 ? '+' : ''}${pp}pp`,
    direction: diff > 0 ? 'up' : 'down',
  };
}

/**
 * Maps a delta direction to the Tailwind color class pair (light + dark).
 * 'flat' and 'none' share the gray class intentionally — both read as
 * "no meaningful movement" and the text content itself ("0.0%" vs "—")
 * is what distinguishes them to the reader.
 */
export function deltaColorClass(direction: DeltaDirection): string {
  switch (direction) {
    case 'up':
      return 'text-emerald-600 dark:text-emerald-500';
    case 'down':
      return 'text-rose-600 dark:text-rose-500';
    case 'flat':
    case 'none':
      return 'text-gray-400 dark:text-gray-500';
  }
}
