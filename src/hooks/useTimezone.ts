import { useMemo } from 'react';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// Phase 1 / INFR-04 — fixed Eastern-Time formatters via date-fns-tz.
// Hard-coded to America/New_York per D-19 — no context provider, no
// switchable zone. If multi-TZ ever needed, it's a v2.1+ refactor.

const ET = 'America/New_York';

export interface TimezoneApi {
  formatDate: (d: Date) => string;               // 'MMM d, yyyy'       → "Apr 24, 2026"
  formatDateTime: (d: Date) => string;           // 'MMM d, yyyy h:mm a ET'
  formatTime: (d: Date) => string;               // 'h:mm a ET'
  formatRange: (from: Date, to: Date) => string; // 'MMM d – MMM d, yyyy'
  nowET: () => Date;
}

export function useTimezone(): TimezoneApi {
  return useMemo<TimezoneApi>(
    () => ({
      formatDate: (d) => formatInTimeZone(d, ET, 'MMM d, yyyy'),
      formatDateTime: (d) => formatInTimeZone(d, ET, "MMM d, yyyy h:mm a 'ET'"),
      formatTime: (d) => formatInTimeZone(d, ET, "h:mm a 'ET'"),
      formatRange: (from, to) =>
        formatInTimeZone(from, ET, 'MMM d') +
        ' – ' +
        formatInTimeZone(to, ET, 'MMM d, yyyy'),
      nowET: () => toZonedTime(new Date(), ET),
    }),
    [],
  );
}
