// Phase 5 Plan 04 — rolling mean helper for TRND-01 / TRND-02 trend
// overlays. CONTRACT: .planning/phases/05-trend-analysis/05-04-PLAN.md
// <behavior> + 05-CONTEXT.md § Required Charts.
//
// Window = 3 in Phase 5; the function accepts any window >= 1 for future
// configurability (CONTEXT § Claude's Discretion — NOT user-configurable
// yet). A single shared implementation keeps TRND-01 and TRND-02 aligned
// with any future consumer and avoids drift between two local copies of
// the same arithmetic.
//
// Null semantics: any null inside the sliding window poisons the mean for
// that output position. This matches the display contract — a broken data
// point must NOT quietly distort the trend line. Callers filter rows up
// front (sale_date / metric non-null), so nulls here only appear when a
// downstream schema shift introduces them; in that case the trend line
// simply breaks at the gap rather than producing a wrong-looking average.

/**
 * Rolling arithmetic mean over a sliding window, preserving input length.
 *
 * Contract:
 *  - Returns a new array the same length as `values` — does NOT mutate input.
 *  - Positions `i < window - 1` are `null` (insufficient history).
 *  - Positions `i >= window - 1` are the arithmetic mean of
 *    `values[i - window + 1 .. i]` when all entries are non-null; `null`
 *    when any entry in that window is null.
 *  - `window > values.length` returns an all-null array of the same length
 *    (graceful — no throw for empty / short inputs).
 *  - `window < 1` throws `new Error('window must be >= 1')`.
 */
export function computeRollingMean(
  values: ReadonlyArray<number | null>,
  window: number,
): Array<number | null> {
  if (window < 1) throw new Error('window must be >= 1');

  const n = values.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (window > n) return out;

  for (let i = window - 1; i < n; i++) {
    let sum = 0;
    let anyNull = false;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j];
      if (v === null || v === undefined) {
        anyNull = true;
        break;
      }
      sum += v;
    }
    out[i] = anyNull ? null : sum / window;
  }
  return out;
}
