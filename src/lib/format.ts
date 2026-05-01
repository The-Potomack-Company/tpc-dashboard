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

/**
 * formatAge — relative-time formatter for "right-now" widgets.
 * Phase 3 / UI-SPEC § Numeric formatting conventions (Phase 3 NEW helper).
 *
 * Buckets: <1m (sub-minute), Xm (sub-hour), Xh (sub-day), Xd Yh (multi-day).
 * For days with zero remainder hours, returns just 'Xd'.
 *
 * Defensive: invalid dates and future timestamps return EMPTY ('—').
 *
 * Used by:
 *   - Active Sessions table age column
 *   - Stuck Items alert "oldest is 14h" body
 *   - Stuck Items page age column
 *
 * @example
 *   formatAge(new Date(Date.now() - 14 * 60 * 60 * 1000))         // '14h'
 *   formatAge(new Date(Date.now() - 45 * 60 * 1000))              // '45m'
 *   formatAge(new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000))   // '3d 12h'
 *   formatAge('invalid')                                           // '—'
 */
export function formatAge(createdAt: Date | string): string {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const ms = Date.now() - date.getTime();
  if (ms < 0) return EMPTY; // future timestamp = treat as no data (clock-skew defense)
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return '<1m';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainderHours = hours - days * 24;
  return remainderHours > 0 ? `${days}d ${remainderHours}h` : `${days}d`;
}
