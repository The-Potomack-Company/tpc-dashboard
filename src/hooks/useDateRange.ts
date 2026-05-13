import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { subDays, startOfDay, endOfDay, parse, isValid } from 'date-fns';
import { useTimezone } from './useTimezone';

// Phase 1 / INFR-04 — URL-state date-range hook.
// Single source of truth = URL (D-20). Default = 7d when `range` is absent (D-17).
// URL shape (D-16):
//   ?range=today|7d|30d|custom
//   when range=custom, also &from=YYYY-MM-DD&to=YYYY-MM-DD (no time, no TZ)
//
// All three write operations (range, from, to) collapse into a single
// setParams(prev => ...) closure body to sidestep React Router 7's
// non-batching setSearchParams quirk (RESEARCH Pitfall 5).

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRangeValue {
  range: DateRangePreset;
  from: Date;
  to: Date;
  setRange: (next: Exclude<DateRangePreset, 'custom'>) => void;
  setCustom: (from: Date, to: Date) => void;
}

function isPreset(v: string | null): v is DateRangePreset {
  return v === 'today' || v === '7d' || v === '30d' || v === 'custom';
}

function parseISODate(v: string | null): Date | null {
  if (!v) return null;
  const d = parse(v, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useDateRange(): DateRangeValue {
  const [params, setParams] = useSearchParams();
  const { nowET } = useTimezone();

  const rawRange = params.get('range');
  const range: DateRangePreset = isPreset(rawRange) ? rawRange : '7d'; // D-17 default

  const { from, to } = useMemo(() => {
    const now = nowET();
    if (range === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    if (range === '7d') {
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }; // inclusive of today
    }
    if (range === '30d') {
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    }
    // custom
    const parsedFrom = parseISODate(params.get('from'));
    const parsedTo = parseISODate(params.get('to'));
    if (parsedFrom && parsedTo) {
      return { from: startOfDay(parsedFrom), to: endOfDay(parsedTo) };
    }
    // Invalid custom → fall back to 7d behavior
    return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  }, [range, params, nowET]);

  const setRange = useCallback(
    (next: Exclude<DateRangePreset, 'custom'>) => {
      // Single-closure write (Pitfall 5): merge all three mutations into
      // one setParams call. Clears from/to when switching away from custom.
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          copy.set('range', next);
          copy.delete('from');
          copy.delete('to');
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const setCustom = useCallback(
    (f: Date, t: Date) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          copy.set('range', 'custom');
          copy.set('from', formatISODate(f));
          copy.set('to', formatISODate(t));
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { range, from, to, setRange, setCustom };
}
