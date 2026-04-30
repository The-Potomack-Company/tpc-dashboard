import type { KpiDelta } from '../kit/KpiCard';

// Phase 2 / EXT-10 — FLIPPED delta semantics for CancellationRateKpis.
//
// Direction is FLIPPED relative to KpiStrip (UI-SPEC § Color):
//   higher cancel rate = bad → increase renders as 'down' (red)
//   lower cancel rate  = good → decrease renders as 'up' (green)
//   equal              = 'flat' (gray)
//
// Returns undefined when previousRate is null/undefined — the RPC returns
// previous_rate=NULL when prev-period denominator was 0 (D-05 NULLIF
// semantics). We never fake a direction in that case.
//
// Extracted to its own module so:
//  (a) react-refresh/only-export-components is happy (CancellationRateKpis
//      then exports only its React component);
//  (b) the helper can be unit-tested without mounting a component.

export function computeFlippedDelta(
  currentRate: number,
  previousRate: number | null | undefined,
): KpiDelta | undefined {
  if (previousRate == null) return undefined;
  if (currentRate === previousRate) {
    return { value: '0pp', direction: 'flat', label: 'vs prev period' };
  }
  // Percentage-point diff (rates are 0..1).
  const diffPp = (currentRate - previousRate) * 100;
  const sign = diffPp > 0 ? '+' : '';
  return {
    value: `${sign}${diffPp.toFixed(1)}pp`,
    // FLIPPED — increase in cancellation = bad (red), decrease = good (green).
    direction: diffPp > 0 ? 'down' : 'up',
    label: 'vs prev period',
  };
}
