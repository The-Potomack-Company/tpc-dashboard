// Phase 2 — extends Phase 1 conventions with formatTimestampShort.
// UI-SPEC § Typography "Numeric formatting conventions" locks these formats.
// All time-aware formatters operate in America/New_York (ET) — matches
// useTimezone.ts (Phase 1 INFR-04). Caller provides Date or ISO string;
// formatter handles the rest.

import { formatInTimeZone } from 'date-fns-tz';

const ET = 'America/New_York';

// U+2014 EM DASH — see UI-SPEC § Typography "Null / missing".
export const EMPTY = '—';

export function formatPercent(
  n: number | null | undefined,
  decimals = 1,
): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return `${n.toFixed(decimals)}%`;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return n.toLocaleString('en-US');
}

export function formatTimestampShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  // UI-SPEC § Typography "Date/time (ET, short — table cells)" → 'MM/DD HH:MM'.
  // date-fns-tz format tokens: MM/dd HH:mm (zero-padded month/day, 24h time).
  return formatInTimeZone(date, ET, 'MM/dd HH:mm');
}
