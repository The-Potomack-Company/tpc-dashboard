// Phase 5 Plan 04 Task 1 — computeRollingMean contract tests. Contract
// locked by 05-04-PLAN.md <behavior> block and 05-CONTEXT.md § Required
// Charts (rolling-3 trend overlay on TRND-01 / TRND-02).
//
// Seven cases:
//   1. Happy path, window=3 over 5 numeric points.
//   2. Null in the sliding window poisons the mean (null output).
//   3. Empty input → empty output.
//   4. window > length → all nulls, not a throw.
//   5. window=1 is the identity case.
//   6. window < 1 throws.
//   7. Input is not mutated (frozen input must not explode).

import { describe, it, expect } from 'vitest';
import { computeRollingMean } from './rolling-avg';

describe('computeRollingMean', () => {
  it('returns nulls for the first (window - 1) positions, means thereafter', () => {
    // window=3 means i=0 and i=1 have insufficient history; i=2 onward is
    // the mean of the previous 3 values.
    expect(computeRollingMean([10, 20, 30, 40, 50], 3)).toEqual([
      null,
      null,
      20,
      30,
      40,
    ]);
  });

  it('emits null when any value inside the sliding window is null', () => {
    // Index 0: always null (insufficient history)
    // Index 1: always null (insufficient history)
    // Index 2: window [10, null, 30] → contains null → null
    // Index 3: window [null, 30, 40] → contains null → null
    // Index 4: window [30, 40, 50] → all non-null → 40
    expect(computeRollingMean([10, null, 30, 40, 50], 3)).toEqual([
      null,
      null,
      null,
      null,
      40,
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(computeRollingMean([], 3)).toEqual([]);
  });

  it('returns all nulls when window > length (graceful, not throw)', () => {
    expect(computeRollingMean([10, 20], 3)).toEqual([null, null]);
  });

  it('window=1 is the identity case — every position is its own mean', () => {
    expect(computeRollingMean([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });

  it('throws when window < 1', () => {
    expect(() => computeRollingMean([1, 2, 3], 0)).toThrow(
      'window must be >= 1',
    );
    expect(() => computeRollingMean([1, 2, 3], -2)).toThrow(
      'window must be >= 1',
    );
  });

  it('does not mutate the input (frozen array passes through)', () => {
    const frozen = Object.freeze([10, 20, 30, 40, 50]) as ReadonlyArray<number>;
    // If the implementation tries to mutate, the frozen array throws in
    // strict mode — so this test guards structurally rather than via equality.
    expect(() => computeRollingMean(frozen, 3)).not.toThrow();
    expect(frozen).toEqual([10, 20, 30, 40, 50]);
  });
});
