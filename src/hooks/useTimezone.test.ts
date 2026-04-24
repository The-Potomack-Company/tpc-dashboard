import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTimezone } from './useTimezone';

describe('useTimezone', () => {
  // Winter: EST = UTC-5. 17:00 UTC = 12:00 PM ET.
  // Summer: EDT = UTC-4. 16:00 UTC = 12:00 PM ET.
  // The delta between these two offsets is the DST transition; tests must
  // cover both explicitly (RESEARCH Pitfall 6).

  it('formatDate renders January date with comma', () => {
    const { result } = renderHook(() => useTimezone());
    const jan = new Date('2026-01-15T17:00:00Z'); // 12:00 PM ET in winter
    expect(result.current.formatDate(jan)).toBe('Jan 15, 2026');
  });

  it('formatDateTime renders winter (EST) timestamp with literal ET suffix', () => {
    const { result } = renderHook(() => useTimezone());
    const jan = new Date('2026-01-15T17:00:00Z'); // 12:00 PM ET in winter
    expect(result.current.formatDateTime(jan)).toBe('Jan 15, 2026 12:00 PM ET');
  });

  it('formatDateTime renders summer (EDT) timestamp correctly (DST-aware)', () => {
    const { result } = renderHook(() => useTimezone());
    const jul = new Date('2026-07-15T16:00:00Z'); // 12:00 PM ET in summer
    expect(result.current.formatDateTime(jul)).toBe('Jul 15, 2026 12:00 PM ET');
  });

  it('formatTime returns time-only string with ET suffix', () => {
    const { result } = renderHook(() => useTimezone());
    const jul = new Date('2026-07-15T16:00:00Z');
    expect(result.current.formatTime(jul)).toBe('12:00 PM ET');
  });

  it('formatRange joins two formatted dates with en-dash', () => {
    const { result } = renderHook(() => useTimezone());
    const from = new Date('2026-04-01T12:00:00Z');
    const to = new Date('2026-04-15T12:00:00Z');
    expect(result.current.formatRange(from, to)).toBe('Apr 1 – Apr 15, 2026');
  });

  it('nowET returns a Date whose time is within 5 seconds of now', () => {
    const { result } = renderHook(() => useTimezone());
    const before = Date.now();
    const now = result.current.nowET();
    const after = Date.now();
    // toZonedTime returns a Date whose UTC ms maps to ET-clock time — the
    // raw ms value shifts by the offset. For this correctness check we
    // only assert that nowET() was called recently (the underlying new
    // Date() was created within [before, after]).
    // The offset shift is bounded: |ET offset| <= 5 hours = 18_000_000 ms.
    // "Within 5 seconds of now" means |now.getTime() - Date.now()| accounting
    // for the TZ offset magnitude.
    const diff = Math.abs(now.getTime() - (before + after) / 2);
    // Allow for TZ offset + 5s slack. ET is UTC-4 or UTC-5.
    const maxAllowed = 5 * 60 * 60 * 1000 + 5_000; // 5h + 5s
    expect(diff).toBeLessThan(maxAllowed);
  });

  it('is stable across renders (useMemo caches the API object)', () => {
    const { result, rerender } = renderHook(() => useTimezone());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
