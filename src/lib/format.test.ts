import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatPercent,
  formatCount,
  formatTimestampShort,
  formatAge,
  EMPTY,
} from './format';

describe('formatPercent', () => {
  it('returns one-decimal percent by default', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
  });

  it('respects custom precision', () => {
    expect(formatPercent(12.345, 2)).toBe('12.35%');
    expect(formatPercent(0, 0)).toBe('0%');
  });

  it('returns EMPTY for null, undefined, and NaN', () => {
    expect(formatPercent(null)).toBe(EMPTY);
    expect(formatPercent(undefined)).toBe(EMPTY);
    expect(formatPercent(Number.NaN)).toBe(EMPTY);
  });
});

describe('formatCount', () => {
  it('comma-groups thousands in en-US locale', () => {
    expect(formatCount(1247)).toBe('1,247');
    expect(formatCount(1000000)).toBe('1,000,000');
    expect(formatCount(0)).toBe('0');
  });

  it('returns EMPTY for null/undefined/NaN', () => {
    expect(formatCount(null)).toBe(EMPTY);
    expect(formatCount(undefined)).toBe(EMPTY);
    expect(formatCount(Number.NaN)).toBe(EMPTY);
  });
});

describe('formatTimestampShort', () => {
  it('formats UTC ISO into MM/dd HH:mm in America/New_York (EDT in April)', () => {
    // 2026-04-29T18:15:00Z is 14:15 EDT (UTC-4)
    expect(formatTimestampShort('2026-04-29T18:15:00Z')).toBe('04/29 14:15');
  });

  it('formats UTC ISO during EST (January, UTC-5)', () => {
    // 2026-01-15T18:15:00Z is 13:15 EST
    expect(formatTimestampShort('2026-01-15T18:15:00Z')).toBe('01/15 13:15');
  });

  it('accepts Date and ISO string interchangeably for the same instant', () => {
    const iso = '2026-04-29T18:15:00Z';
    expect(formatTimestampShort(new Date(iso))).toBe(formatTimestampShort(iso));
  });
});

describe('EMPTY', () => {
  it('is the U+2014 em-dash character exactly', () => {
    expect(EMPTY).toBe('—');
    expect(EMPTY.charCodeAt(0)).toBe(0x2014);
  });
});

describe('formatAge (Phase 3 / UI-SPEC § Numeric formatting)', () => {
  // Use fake timers so Date.now() is deterministic across all tests.
  // Anchor to 2026-04-30T12:00:00Z — same anchor as Phase 3 planning artifacts.
  const NOW = new Date('2026-04-30T12:00:00Z').getTime();

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '<1m' for sub-minute age (UI-SPEC bucket)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatAge(new Date(NOW - 30_000))).toBe('<1m');
  });

  it("returns 'XXm' for sub-hour age (45 min)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatAge(new Date(NOW - 45 * 60 * 1000))).toBe('45m');
  });

  it("returns 'Xh' for sub-day age (14h)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatAge(new Date(NOW - 14 * 60 * 60 * 1000))).toBe('14h');
  });

  it("returns 'Xd Yh' for multi-day age (3d 12h)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const ms = (3 * 24 + 12) * 60 * 60 * 1000;
    expect(formatAge(new Date(NOW - ms))).toBe('3d 12h');
  });

  it("returns 'Xd' (no Yh suffix) when remainder hours = 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatAge(new Date(NOW - 2 * 24 * 60 * 60 * 1000))).toBe('2d');
  });

  it('returns EMPTY for invalid date string (defensive parse, never throws)', () => {
    expect(formatAge('invalid-date')).toBe(EMPTY);
  });

  it('accepts both Date and ISO string for the same instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 14 * 60 * 60 * 1000).toISOString();
    expect(formatAge(iso)).toBe(formatAge(new Date(iso)));
    expect(formatAge(iso)).toBe('14h');
  });

  it('returns EMPTY for future timestamp (negative ms — clock-skew defense)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatAge(new Date(NOW + 60_000))).toBe(EMPTY);
  });
});
