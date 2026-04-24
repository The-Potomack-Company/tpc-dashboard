import { describe, it, expect } from 'vitest';
import {
  computePeriodBounds,
  toIsoDateLocal,
  rangeFromPreset,
  DEFAULT_RANGE_PRESET,
  type Period,
  type PeriodBounds,
  type Range,
  type RangePreset,
} from '../lib/period';

// Phase 4 Plan 02 Task 1 — period-bounds contract locked by
// .planning/phases/04-kpi-landing-page/04-RESEARCH.md § Pattern 2 and the
// plan's <behavior> block. All bounds are half-open [start, end) matching
// the sale_date predicates in public.kpi_summary.

// Deterministic fixed "now" — Apr 22 2026 12pm local. Tests never depend
// on real clock or timezone.
const fixedNow = new Date(2026, 3, 22, 12, 0, 0);

describe('computePeriodBounds — YTD', () => {
  it('current.start is Jan 1 of the same year (local TZ)', () => {
    const bounds = computePeriodBounds('ytd', fixedNow);
    expect(bounds.current.start.getFullYear()).toBe(2026);
    expect(bounds.current.start.getMonth()).toBe(0);
    expect(bounds.current.start.getDate()).toBe(1);
    expect(bounds.current.start.getHours()).toBe(0);
  });

  it('current.end equals the passed-in now', () => {
    const bounds = computePeriodBounds('ytd', fixedNow);
    expect(bounds.current.end.getTime()).toBe(fixedNow.getTime());
  });

  it('previous.start is Jan 1 of the prior year and previous.end equals current.start (contiguous)', () => {
    const bounds = computePeriodBounds('ytd', fixedNow);
    expect(bounds.previous.start.getFullYear()).toBe(2025);
    expect(bounds.previous.start.getMonth()).toBe(0);
    expect(bounds.previous.start.getDate()).toBe(1);
    expect(bounds.previous.end.getTime()).toBe(bounds.current.start.getTime());
  });
});

describe('computePeriodBounds — L6M', () => {
  it('current.start is 6 months before now', () => {
    const bounds = computePeriodBounds('l6m', fixedNow);
    // Apr 22 2026 - 6mo = Oct 22 2025
    expect(bounds.current.start.getFullYear()).toBe(2025);
    expect(bounds.current.start.getMonth()).toBe(9); // October (0-indexed)
    expect(bounds.current.start.getDate()).toBe(22);
  });

  it('current.end equals now, previous.start is 12 months before now, previous.end equals current.start', () => {
    const bounds = computePeriodBounds('l6m', fixedNow);
    expect(bounds.current.end.getTime()).toBe(fixedNow.getTime());
    // Apr 22 2026 - 12mo = Apr 22 2025
    expect(bounds.previous.start.getFullYear()).toBe(2025);
    expect(bounds.previous.start.getMonth()).toBe(3); // April
    expect(bounds.previous.start.getDate()).toBe(22);
    expect(bounds.previous.end.getTime()).toBe(bounds.current.start.getTime());
  });
});

describe('computePeriodBounds — L12M', () => {
  it('current.start is 12 months before now', () => {
    const bounds = computePeriodBounds('l12m', fixedNow);
    // Apr 22 2026 - 12mo = Apr 22 2025
    expect(bounds.current.start.getFullYear()).toBe(2025);
    expect(bounds.current.start.getMonth()).toBe(3);
    expect(bounds.current.start.getDate()).toBe(22);
  });

  it('previous.start is 24 months before now', () => {
    const bounds = computePeriodBounds('l12m', fixedNow);
    // Apr 22 2026 - 24mo = Apr 22 2024
    expect(bounds.previous.start.getFullYear()).toBe(2024);
    expect(bounds.previous.start.getMonth()).toBe(3);
    expect(bounds.previous.start.getDate()).toBe(22);
  });

  it('previous.end equals current.start (windows are contiguous, no gap, no overlap)', () => {
    const bounds = computePeriodBounds('l12m', fixedNow);
    expect(bounds.previous.end.getTime()).toBe(bounds.current.start.getTime());
  });
});

describe('computePeriodBounds — default now', () => {
  it('omitted now argument does not throw and returns a bounds object', () => {
    // Just verifying the default parameter path. Reading the wall clock is
    // inherently non-deterministic so we only assert structural shape.
    const bounds: PeriodBounds = computePeriodBounds('l12m');
    expect(bounds.current.start).toBeInstanceOf(Date);
    expect(bounds.current.end).toBeInstanceOf(Date);
    expect(bounds.previous.start).toBeInstanceOf(Date);
    expect(bounds.previous.end).toBeInstanceOf(Date);
  });
});

describe('computePeriodBounds — type narrowing', () => {
  it('accepts every documented Period literal', () => {
    const periods: Period[] = ['ytd', 'l6m', 'l12m'];
    for (const p of periods) {
      expect(() => computePeriodBounds(p, fixedNow)).not.toThrow();
    }
  });
});

describe('toIsoDateLocal', () => {
  it('returns yyyy-mm-dd for Jan 31 in local TZ (NOT shifted to UTC Jan 30)', () => {
    // This is the signature "UTC drift" regression guard — Pitfall 2 in RESEARCH.md.
    // new Date(2026, 0, 31).toISOString() in US-East TZ yields "2026-01-31T05:00:00Z"
    // whose .slice(0,10) is '2026-01-31' at noon but '2026-01-30' just after midnight.
    // Our local-TZ serializer must ignore UTC entirely.
    expect(toIsoDateLocal(new Date(2026, 0, 31))).toBe('2026-01-31');
  });

  it('zero-pads single-digit month and day', () => {
    expect(toIsoDateLocal(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('handles December (month-index 11 → "12")', () => {
    expect(toIsoDateLocal(new Date(2026, 11, 1))).toBe('2026-12-01');
  });

  it('handles two-digit month and day without extra padding', () => {
    expect(toIsoDateLocal(new Date(2026, 10, 30))).toBe('2026-11-30');
  });
});

// Phase 5 Plan 01 Task 1 — Range + rangeFromPreset contract locked by
// .planning/phases/05-trend-analysis/05-01-PLAN.md <behavior> block.
// Range.start/end are yyyy-mm-dd strings (or null for 'all') because the hooks
// pass them directly to PostgREST .gte()/.lte() on the sale_date date column.

// Apr 22 2026 12pm local — deterministic clock for all preset math.
const phase5FixedNow = new Date(2026, 3, 22, 12, 0, 0);

describe('rangeFromPreset — YTD', () => {
  it('returns { start: "YYYY-01-01", end: <now as local ISO>, preset: "ytd" }', () => {
    const range = rangeFromPreset('ytd', phase5FixedNow);
    expect(range).toEqual({
      start: '2026-01-01',
      end: '2026-04-22',
      preset: 'ytd',
    });
  });
});

describe('rangeFromPreset — L6M', () => {
  it('start is 6 months before now (Oct 22 2025), end is now', () => {
    const range = rangeFromPreset('l6m', phase5FixedNow);
    expect(range).toEqual({
      start: '2025-10-22',
      end: '2026-04-22',
      preset: 'l6m',
    });
  });
});

describe('rangeFromPreset — L12M', () => {
  it('start is 12 months before now (Apr 22 2025), end is now', () => {
    const range = rangeFromPreset('l12m', phase5FixedNow);
    expect(range).toEqual({
      start: '2025-04-22',
      end: '2026-04-22',
      preset: 'l12m',
    });
  });
});

describe('rangeFromPreset — L24M', () => {
  it('start is 24 months before now (Apr 22 2024), end is now', () => {
    const range = rangeFromPreset('l24m', phase5FixedNow);
    expect(range).toEqual({
      start: '2024-04-22',
      end: '2026-04-22',
      preset: 'l24m',
    });
  });
});

describe('rangeFromPreset — All time', () => {
  it('returns { start: null, end: null, preset: "all" } — hooks translate null → no predicate', () => {
    const range = rangeFromPreset('all', phase5FixedNow);
    expect(range).toEqual({
      start: null,
      end: null,
      preset: 'all',
    });
  });

  it('all-time works without a `now` argument', () => {
    const range = rangeFromPreset('all');
    expect(range.start).toBeNull();
    expect(range.end).toBeNull();
    expect(range.preset).toBe('all');
  });
});

describe('rangeFromPreset — type narrowing', () => {
  it('accepts every documented RangePreset literal', () => {
    const presets: RangePreset[] = ['ytd', 'l6m', 'l12m', 'l24m', 'all'];
    for (const p of presets) {
      const r: Range = rangeFromPreset(p, phase5FixedNow);
      expect(r.preset).toBe(p);
    }
  });
});

describe('DEFAULT_RANGE_PRESET', () => {
  it('is "l12m" — matches CONTEXT.md decision (L12M is app-wide default)', () => {
    expect(DEFAULT_RANGE_PRESET).toBe('l12m');
  });
});

describe('regression — Phase 4 Period API still intact', () => {
  it('computePeriodBounds("ytd", …) returns the same bounds after adding Range API', () => {
    const bounds = computePeriodBounds('ytd', phase5FixedNow);
    expect(bounds.current.start.getFullYear()).toBe(2026);
    expect(bounds.current.start.getMonth()).toBe(0);
    expect(bounds.current.start.getDate()).toBe(1);
    expect(bounds.current.end.getTime()).toBe(phase5FixedNow.getTime());
  });

  it('toIsoDateLocal still returns local-TZ yyyy-mm-dd', () => {
    expect(toIsoDateLocal(phase5FixedNow)).toBe('2026-04-22');
  });
});
