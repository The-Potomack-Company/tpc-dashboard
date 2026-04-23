// Phase 6 Plan 06-01 Task 3 — computePairDelta + deltaColorClass contract tests.
// Contract: 06-UI-SPEC.md § Typography → delta.ts signature and § Color →
// Comparison-table delta color rules.
//
// 14 cases covering: relative mode (up/down/flat), absolute_pp mode,
// null / zero-baseline guards, the 0.0005 (0.05%) flat threshold, and the
// four color-class mappings.

import { describe, it, expect } from 'vitest';
import { computePairDelta, deltaColorClass } from './delta';

describe('computePairDelta', () => {
  it('T1 — returns +10.0% / up for a 10% relative gain', () => {
    expect(computePairDelta(110, 100)).toEqual({
      text: '+10.0%',
      direction: 'up',
    });
  });

  it('T2 — returns -10.0% / down for a 10% relative loss', () => {
    expect(computePairDelta(90, 100)).toEqual({
      text: '-10.0%',
      direction: 'down',
    });
  });

  it('T3 — returns 0.0% / flat when current equals previous', () => {
    expect(computePairDelta(100, 100)).toEqual({
      text: '0.0%',
      direction: 'flat',
    });
  });

  it('T4 — returns em-dash / none when current is null', () => {
    expect(computePairDelta(null, 100)).toEqual({
      text: '—',
      direction: 'none',
    });
  });

  it('T5 — returns em-dash / none when previous is null', () => {
    expect(computePairDelta(100, null)).toEqual({
      text: '—',
      direction: 'none',
    });
  });

  it('T6 — returns em-dash / none when previous is zero (divide-by-zero guard)', () => {
    expect(computePairDelta(100, 0)).toEqual({
      text: '—',
      direction: 'none',
    });
  });

  it('T7 — returns +3.2pp / up for an absolute percentage-point gain', () => {
    expect(computePairDelta(0.684, 0.652, 'absolute_pp')).toEqual({
      text: '+3.2pp',
      direction: 'up',
    });
  });

  it('T8 — returns -3.2pp / down for an absolute percentage-point loss', () => {
    expect(computePairDelta(0.652, 0.684, 'absolute_pp')).toEqual({
      text: '-3.2pp',
      direction: 'down',
    });
  });

  it('T9 — returns 0.0pp / flat when absolute_pp diff is zero', () => {
    expect(computePairDelta(0.5, 0.5, 'absolute_pp')).toEqual({
      text: '0.0pp',
      direction: 'flat',
    });
  });

  it('T10 — just-below flat threshold (ratio = 0.0004) → 0.0% / flat', () => {
    // 100.04 / 100 - 1 = 0.0004; abs(0.0004) < 0.0005 → flat
    expect(computePairDelta(100.04, 100)).toEqual({
      text: '0.0%',
      direction: 'flat',
    });
  });

  it('T11 — just-above flat threshold (ratio = 0.0006) → up / +0.1% prefix', () => {
    // 100.06 / 100 - 1 = 0.0006; abs(0.0006) >= 0.0005 → up
    const result = computePairDelta(100.06, 100);
    expect(result.direction).toBe('up');
    expect(result.text.startsWith('+0.1%')).toBe(true);
  });
});

describe('deltaColorClass', () => {
  it('T12 — up returns emerald-600 class', () => {
    expect(deltaColorClass('up')).toContain('emerald-600');
  });

  it('T13 — down returns rose-600 class', () => {
    expect(deltaColorClass('down')).toContain('rose-600');
  });

  it('T14 — flat and none both return gray-400 class', () => {
    expect(deltaColorClass('flat')).toContain('gray-400');
    expect(deltaColorClass('none')).toContain('gray-400');
  });
});
