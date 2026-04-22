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
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return EMPTY;
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
