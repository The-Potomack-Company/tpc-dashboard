// Phase 5 Plan 05-05 — TRND-05 estimate accuracy derivation tests.
// Contract: .planning/phases/05-trend-analysis/05-05-PLAN.md Task 1 <behavior>.
//
// Classification rules (per-department):
//   - total_sold_value < low_estimate             → below
//   - low_estimate <= total_sold_value <= high    → within
//   - total_sold_value > high_estimate            → above
// Numerator: sum of dept-level `lots_sold` per bucket.
// Denominator: sale-level `lots_sold` (NOT the sum of included depts).
//
// Null / zero paths:
//   - saleLotsSold null or 0 → return null
//   - every dept skipped (missing any of the four fields) → return null
//   - empty depts array → return null

import { describe, it, expect } from 'vitest';
import { computeAccuracyBands } from './estimate-accuracy';

describe('computeAccuracyBands', () => {
  it('computes below/within/above shares against sale-level lots_sold', () => {
    const depts = [
      // above: total_sold_value (500) > high_estimate (300)
      { total_sold_value: 500, low_estimate: 100, high_estimate: 300, lots_sold: 5 },
      // within: 100 <= 200 <= 300
      { total_sold_value: 200, low_estimate: 100, high_estimate: 300, lots_sold: 10 },
      // below: 50 < 100
      { total_sold_value: 50, low_estimate: 100, high_estimate: 300, lots_sold: 3 },
    ];
    const bands = computeAccuracyBands(depts, 20);
    expect(bands).not.toBeNull();
    expect(bands!.below).toBeCloseTo(3 / 20, 5);
    expect(bands!.within).toBeCloseTo(10 / 20, 5);
    expect(bands!.above).toBeCloseTo(5 / 20, 5);
  });

  it('classifies total_sold_value exactly on low_estimate as within', () => {
    const bands = computeAccuracyBands(
      [{ total_sold_value: 100, low_estimate: 100, high_estimate: 300, lots_sold: 4 }],
      10,
    );
    expect(bands).not.toBeNull();
    expect(bands!.within).toBeCloseTo(4 / 10, 5);
    expect(bands!.below).toBe(0);
    expect(bands!.above).toBe(0);
  });

  it('classifies total_sold_value exactly on high_estimate as within', () => {
    const bands = computeAccuracyBands(
      [{ total_sold_value: 300, low_estimate: 100, high_estimate: 300, lots_sold: 7 }],
      10,
    );
    expect(bands).not.toBeNull();
    expect(bands!.within).toBeCloseTo(7 / 10, 5);
    expect(bands!.below).toBe(0);
    expect(bands!.above).toBe(0);
  });

  it('skips depts missing any of the four fields and computes from the remainder', () => {
    const depts = [
      // skipped — null low_estimate
      { total_sold_value: 200, low_estimate: null, high_estimate: 300, lots_sold: 5 },
      // skipped — null total_sold_value
      { total_sold_value: null, low_estimate: 100, high_estimate: 300, lots_sold: 5 },
      // skipped — null high_estimate
      { total_sold_value: 200, low_estimate: 100, high_estimate: null, lots_sold: 5 },
      // skipped — null lots_sold
      { total_sold_value: 200, low_estimate: 100, high_estimate: 300, lots_sold: null },
      // classifies: within
      { total_sold_value: 200, low_estimate: 100, high_estimate: 300, lots_sold: 6 },
    ];
    const bands = computeAccuracyBands(depts, 20);
    expect(bands).not.toBeNull();
    expect(bands!.below).toBe(0);
    expect(bands!.within).toBeCloseTo(6 / 20, 5);
    expect(bands!.above).toBe(0);
  });

  it('returns null when saleLotsSold is null', () => {
    const depts = [
      { total_sold_value: 200, low_estimate: 100, high_estimate: 300, lots_sold: 6 },
    ];
    expect(computeAccuracyBands(depts, null)).toBeNull();
  });

  it('returns null when saleLotsSold is zero (division guard)', () => {
    const depts = [
      { total_sold_value: 200, low_estimate: 100, high_estimate: 300, lots_sold: 6 },
    ];
    expect(computeAccuracyBands(depts, 0)).toBeNull();
  });

  it('returns null when the depts array is empty', () => {
    expect(computeAccuracyBands([], 20)).toBeNull();
  });

  it('returns null when every dept is skipped due to null data', () => {
    const depts = [
      { total_sold_value: 200, low_estimate: null, high_estimate: 300, lots_sold: 5 },
      { total_sold_value: null, low_estimate: 100, high_estimate: 300, lots_sold: 5 },
    ];
    expect(computeAccuracyBands(depts, 20)).toBeNull();
  });
});
