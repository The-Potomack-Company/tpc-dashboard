import { describe, it, expect } from 'vitest';
import {
  STUCK_ITEMS_THRESHOLDS,
  STUCK_ITEMS_TONE,
  classifyStuckSeverity,
} from './severity';
import type { StuckSeverity } from './severity';

// Phase 3 / Plan 03-02 / D-22 — Stuck-Items severity classifier + tone
// constants. Source of truth: 03-UI-SPEC.md § Severity Tone Constants
// (lines 219-274). Tests assert verbatim invariants from must_haves.truths.

describe('STUCK_ITEMS_THRESHOLDS', () => {
  it('yellowCount === 5', () => {
    expect(STUCK_ITEMS_THRESHOLDS.yellowCount).toBe(5);
  });
  it('redAgeHours === 6', () => {
    expect(STUCK_ITEMS_THRESHOLDS.redAgeHours).toBe(6);
  });
});

describe('STUCK_ITEMS_TONE', () => {
  it('none.container uses the tpc-card token vocabulary (Phase 7)', () => {
    // Phase 7 unified-design: the "none" (quiet success) tone shifted from
    // raw `bg-white border border-gray-200` to the `.tpc-card` base class,
    // which resolves to var(--bg) + var(--rule) under both themes.
    expect(STUCK_ITEMS_TONE.none.container).toContain('tpc-card');
  });
  it('yellow.container includes bg-amber-50', () => {
    expect(STUCK_ITEMS_TONE.yellow.container).toContain('bg-amber-50');
  });
  it('red.container includes bg-red-50', () => {
    expect(STUCK_ITEMS_TONE.red.container).toContain('bg-red-50');
  });

  it('every tone has the 5 expected slots (container, leftBorder, icon, headline, body)', () => {
    for (const tone of ['none', 'yellow', 'red'] as const) {
      const t = STUCK_ITEMS_TONE[tone];
      expect(typeof t.container).toBe('string');
      expect(typeof t.leftBorder).toBe('string');
      expect(typeof t.icon).toBe('string');
      expect(typeof t.headline).toBe('string');
      expect(typeof t.body).toBe('string');
    }
  });
});

describe('classifyStuckSeverity', () => {
  it("count: 0 → 'none' (regardless of age)", () => {
    expect(
      classifyStuckSeverity({ count: 0, oldestAgeHours: 999 }),
    ).toBe<StuckSeverity>('none');
  });

  it("count: 100, oldestAgeHours: 6.5 → 'red' (age trumps count)", () => {
    expect(
      classifyStuckSeverity({ count: 100, oldestAgeHours: 6.5 }),
    ).toBe<StuckSeverity>('red');
  });

  it("count: 1, oldestAgeHours: 1 → 'yellow' (any N≥1 surfaces yellow)", () => {
    expect(
      classifyStuckSeverity({ count: 1, oldestAgeHours: 1 }),
    ).toBe<StuckSeverity>('yellow');
  });

  it("count: 5, oldestAgeHours: 6 → 'yellow' (boundary at exactly 6h stays yellow — strict >, not >=)", () => {
    expect(
      classifyStuckSeverity({ count: 5, oldestAgeHours: 6 }),
    ).toBe<StuckSeverity>('yellow');
  });

  it("count: 5, oldestAgeHours: 6.0001 → 'red' (fractional excess flips red)", () => {
    expect(
      classifyStuckSeverity({ count: 5, oldestAgeHours: 6.0001 }),
    ).toBe<StuckSeverity>('red');
  });

  it("count: 4, oldestAgeHours: 0.5 → 'yellow' (1≤N<5 still surfaces, per UI-SPEC decision note)", () => {
    expect(
      classifyStuckSeverity({ count: 4, oldestAgeHours: 0.5 }),
    ).toBe<StuckSeverity>('yellow');
  });
});
