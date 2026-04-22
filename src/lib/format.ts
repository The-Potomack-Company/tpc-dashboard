// Shared formatters for Phase 3 Sale Views.
// Contract: .planning/phases/03-sale-views/03-UI-SPEC.md § Typography
// numeric formatting table + Plan 03-01 <behavior> block.
//
// Implementation principles:
//   - Intl.NumberFormat / Intl.DateTimeFormat instances are allocated once at
//     module load for performance.
//   - Every formatter is null/undefined-safe and returns the shared EMPTY
//     em-dash constant — never "", never "N/A", never a hyphen.

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const countFormatter = new Intl.NumberFormat('en-US');

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Placeholder string for null / missing values. U+2014 em-dash exactly —
 * do NOT substitute a hyphen or the U+2013 en-dash used by formatEstimateRange.
 */
export const EMPTY = '—';

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return currencyFormatter.format(value);
}

/**
 * Accepts a ratio in the range [0, 1] (e.g. `0.684` → `"68.4%"`).
 *
 * The `sales` list view computes sell-through as `lots_sold / lots_auctioned`,
 * which is already a ratio. The `sale_departments.sell_through_pct` column is
 * stored as 0-100; divide by 100 at the caller before passing here.
 */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null) return EMPTY;
  return percentFormatter.format(ratio);
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return countFormatter.format(value);
}

/**
 * Formats an ISO date-only string ("YYYY-MM-DD") as `"Mon D, YYYY"` without
 * a UTC → local-TZ shift. Appending `T00:00:00` pins the parse to local time.
 *
 * WR-06: Shape-validate with a regex before concatenating `T00:00:00` so
 * non-date-only inputs (e.g. full ISO timestamps, freeform strings) render
 * as EMPTY rather than silently producing an `Invalid Date`.
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return EMPTY;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return EMPTY;
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return EMPTY;
  return dateFormatter.format(d);
}

/**
 * Formats an estimate range as `"$low – $high"` with a U+2013 en-dash
 * separator — distinct from the U+2014 em-dash used by EMPTY. Falls back to
 * single-sided currency formatting when only one bound is present.
 */
export function formatEstimateRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (low == null && high == null) return EMPTY;
  if (low == null || high == null) return formatCurrency(low ?? high);
  return (
    currencyFormatter.format(low) + ' – ' + currencyFormatter.format(high)
  );
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

/**
 * Maps the bare `sales.payment_status` enum to its human-friendly label.
 *
 * Defensive by design: anything outside the three known values (including
 * null, undefined, empty string, or a future enum value we haven't seen
 * yet) renders as EMPTY rather than leaking a raw enum token into the UI.
 * See UI-SPEC § KPI summary card → Payment status resolution.
 */
export function formatPaymentStatus(
  value: string | null | undefined,
): string {
  if (value == null) return EMPTY;
  return PAYMENT_STATUS_LABELS[value] ?? EMPTY;
}

// Phase 4 — formatDelta helper for KPI scorecards.
// Locked by 04-UI-SPEC.md § Copywriting Contract → Delta semantics (lines 249–264)
// and 04-RESEARCH.md § Pattern 5. Returns a structured object (not a string)
// so the KpiCard can apply the color class to the whole glyph+text span
// atomically.

export type DeltaDirection = 'up' | 'down' | 'none';

/**
 * `relative`            — `(current - previous) / previous * 100`, suffix `%`.
 *                         Used for currency and count KPIs (revenue, lots sold,
 *                         sales count).
 * `percentage-points`   — `(current - previous) * 100`, suffix `pp`. Used for
 *                         the sell-through card only — both values are already
 *                         ratios 0–1, so subtracting gives absolute pp change.
 */
export type DeltaType = 'relative' | 'percentage-points';

export interface FormattedDelta {
  glyph: '▲' | '▼' | '—';
  text: string;
  direction: DeltaDirection;
  aria: string;
}

const NO_BASELINE: FormattedDelta = {
  glyph: '—',
  text: '',
  direction: 'none',
  aria: 'No baseline comparison',
};

/**
 * Formats a period-over-period change as a glyph + text + direction + aria
 * bundle. Returns a structured object (not a string) so the KpiCard can color
 * the whole `{glyph} {text}` span atomically.
 *
 * No-baseline cases (direction === 'none', glyph `—`, empty text):
 *   - `current == null` OR `previous == null` (either side missing)
 *   - `type === 'relative'` AND `previous === 0` (divide-by-zero guard)
 *   - `delta === 0` (flat period; Assumption A2 — reads identically to no baseline)
 *
 * See UI-SPEC § Copywriting Contract → Delta semantics for the full copy
 * contract. KpiCard prepends `{periodLabel}` to the aria after this helper.
 */
export function formatDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  type: DeltaType,
): FormattedDelta {
  if (current == null || previous == null) return NO_BASELINE;
  if (type === 'relative' && previous === 0) return NO_BASELINE;

  const delta =
    type === 'relative'
      ? ((current - previous) / previous) * 100
      : (current - previous) * 100;

  if (delta === 0) return NO_BASELINE;

  const abs = Math.abs(delta).toFixed(1);
  const suffix = type === 'relative' ? '%' : 'pp';
  const text = `${abs}${suffix}`;

  if (delta > 0) {
    return {
      glyph: '▲',
      text,
      direction: 'up',
      aria: `Up ${text} versus previous`,
    };
  }
  return {
    glyph: '▼',
    text,
    direction: 'down',
    aria: `Down ${text} versus previous`,
  };
}
