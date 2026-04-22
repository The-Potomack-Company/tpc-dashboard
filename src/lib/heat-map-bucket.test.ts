// Phase 5 Plan 05-06 Task 1 — heat-map-bucket contract locked by
// .planning/phases/05-trend-analysis/05-UI-SPEC.md § Heat-map color ramp
// (lines 245-283) and § Color → Quintile thresholds (lines 260-266).
//
// Asserts the 22 seeded dept codes (migration 20260421000008_seed_departments)
// sort alphabetically and bucketClassFor bins the 5 quintiles correctly.

import { describe, it, expect } from 'vitest';
import {
  SORTED_DEPT_CODES,
  bucketClassFor,
  NO_DATA_CELL_CLASS,
  NO_DATA_CELL_STYLE,
} from './heat-map-bucket';

const Q1 = 'bg-blue-100 dark:bg-blue-900/40';
const Q2 = 'bg-blue-300 dark:bg-blue-800/60';
const Q3 = 'bg-blue-500 dark:bg-blue-700/80';
const Q4 = 'bg-blue-700 dark:bg-blue-600';
const Q5 = 'bg-blue-900 dark:bg-blue-500';

describe('SORTED_DEPT_CODES', () => {
  it('has exactly 22 codes', () => {
    expect(SORTED_DEPT_CODES.length).toBe(22);
  });

  it('is alphabetically sorted with AMER first and TXTL last', () => {
    expect(SORTED_DEPT_CODES[0]).toBe('AMER');
    expect(SORTED_DEPT_CODES[21]).toBe('TXTL');
    for (let i = 0; i < SORTED_DEPT_CODES.length - 1; i += 1) {
      expect(
        SORTED_DEPT_CODES[i].localeCompare(SORTED_DEPT_CODES[i + 1]),
      ).toBeLessThan(0);
    }
    // Specifically: SIL comes BEFORE SPT (SIL < SPT by ASCII — I < P).
    const silIdx = SORTED_DEPT_CODES.indexOf('SIL');
    const sptIdx = SORTED_DEPT_CODES.indexOf('SPT');
    expect(silIdx).toBeGreaterThan(-1);
    expect(sptIdx).toBeGreaterThan(-1);
    expect(silIdx).toBeLessThan(sptIdx);
  });

  it('is frozen so downstream consumers cannot mutate the canonical order', () => {
    expect(Object.isFrozen(SORTED_DEPT_CODES)).toBe(true);
  });
});

describe('bucketClassFor — quintiles over [0, 100]', () => {
  it('value=10 → Q1 (normalized=0.1)', () => {
    expect(bucketClassFor(10, 0, 100)).toBe(Q1);
  });

  it('value=30 → Q2 (normalized=0.3)', () => {
    expect(bucketClassFor(30, 0, 100)).toBe(Q2);
  });

  it('value=50 → Q3 (normalized=0.5)', () => {
    expect(bucketClassFor(50, 0, 100)).toBe(Q3);
  });

  it('value=70 → Q4 (normalized=0.7)', () => {
    expect(bucketClassFor(70, 0, 100)).toBe(Q4);
  });

  it('value=90 → Q5 (normalized=0.9)', () => {
    expect(bucketClassFor(90, 0, 100)).toBe(Q5);
  });

  it('value=100 (upper bound) → Q5', () => {
    expect(bucketClassFor(100, 0, 100)).toBe(Q5);
  });

  it('value=0 (lower bound) → Q1', () => {
    expect(bucketClassFor(0, 0, 100)).toBe(Q1);
  });

  it('value=20 at the Q1/Q2 boundary → Q2 (spec uses `>= 0.2`)', () => {
    expect(bucketClassFor(20, 0, 100)).toBe(Q2);
  });
});

describe('bucketClassFor — degenerate min===max', () => {
  it('all cells equal → Q5 (documented edge case)', () => {
    expect(bucketClassFor(50, 50, 50)).toBe(Q5);
  });
});

describe('NO_DATA_CELL_CLASS / NO_DATA_CELL_STYLE', () => {
  it('exposes the documented no-data class string', () => {
    expect(NO_DATA_CELL_CLASS).toBe('bg-gray-50 dark:bg-gray-800');
  });

  it('exposes the 45deg hatch pattern as a backgroundImage style', () => {
    expect(NO_DATA_CELL_STYLE).toHaveProperty('backgroundImage');
    expect(NO_DATA_CELL_STYLE.backgroundImage).toContain(
      'repeating-linear-gradient(45deg',
    );
    // Hatch color: gray-400 @ 30% opacity (UI-SPEC lines 274-283).
    expect(NO_DATA_CELL_STYLE.backgroundImage).toContain(
      'rgba(156, 163, 175, 0.3)',
    );
  });
});
