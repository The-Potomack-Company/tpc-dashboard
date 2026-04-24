// Phase 6 Plan 06-01 — SALE-06 Revenue waterfall transform.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § Waterfall color rules.
// REQ-ID: SALE-06.
// Step 1 (Hammer) and Step 7 (Net revenue) are terminal bars: base=0, delta=full value.
// Intermediate steps: base = running-total floor, delta = |signedValue|, direction encodes sign.
//
// This helper exists so RevenueWaterfallChart (Plan 06-05) stays a pure render
// of `{ step, base, delta, direction }` rows — the per-cell Recharts <Cell>
// color mapping just consumes `row.direction`. All running-total math happens
// here, once, outside the render path.
//
// Input contract: a sales.Row from database.types. Seven fields are required
// (hammer_total, buyer_premium, seller_commission, insurance, lot_charges,
// referral_fees, net_revenue). If ANY are null the chart has no meaningful
// series to draw, so we return null and the caller renders an empty state.

import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

export type WaterfallDirection = 'start' | 'up' | 'down' | 'end';

export interface WaterfallRow {
  /** Short x-axis label (matches UI-SPEC exactly). */
  step: string;
  /** Full tooltip header. */
  fullLabel: string;
  /**
   * Height of the transparent padding bar that offsets the visible delta bar
   * to the correct vertical floor. For 'start' and 'end' rows this is 0
   * (terminal bars draw from the baseline). For 'up' rows, the floor is the
   * running total BEFORE this step. For 'down' rows, the floor is the
   * running total AFTER this step (the lower value — see Pitfall 1).
   */
  base: number;
  /**
   * Height of the visible delta bar. Always non-negative — direction='down'
   * still has a positive `delta`; the `direction` field communicates the sign.
   * Recharts bar heights must be positive; we encode the semantics orthogonally.
   */
  delta: number;
  /** Cumulative total AFTER applying this step. Step 7 echoes `net_revenue`. */
  runningTotal: number;
  /** Which color the <Cell> picks: blue (start/end), emerald (up), rose (down). */
  direction: WaterfallDirection;
}

type DeductionKey =
  | 'seller_commission'
  | 'insurance'
  | 'lot_charges'
  | 'referral_fees';

interface StepSpec {
  key: 'buyer_premium' | DeductionKey;
  step: string; // x-axis abbreviation
  fullLabel: string; // tooltip header
  kind: 'up' | 'down';
}

// Intermediate steps 2..6 only. Step 1 (Hammer) and step 7 (Net revenue) are
// terminal bars handled separately below.
const INTERMEDIATE_STEPS: readonly StepSpec[] = [
  {
    key: 'buyer_premium',
    step: '+Premium',
    fullLabel: 'Buyer premium',
    kind: 'up',
  },
  {
    key: 'seller_commission',
    step: '-Commission',
    fullLabel: 'Commission',
    kind: 'down',
  },
  {
    key: 'insurance',
    step: '-Insurance',
    fullLabel: 'Insurance',
    kind: 'down',
  },
  {
    key: 'lot_charges',
    step: '-Lot charges',
    fullLabel: 'Lot charges',
    kind: 'down',
  },
  {
    key: 'referral_fees',
    step: '-Referral',
    fullLabel: 'Referral fees',
    kind: 'down',
  },
];

/**
 * Transforms a `sales.Row` into the 7 rows the Recharts waterfall consumes.
 *
 * Returns `null` when any of the 7 required columns is null — the chart has
 * nothing useful to render in that case and the caller branches to an empty
 * state rather than plotting a partial series.
 *
 * Does NOT mutate its input. Frozen objects are safe.
 */
export function transformToWaterfall(sale: Sale): WaterfallRow[] | null {
  // Required-field guard. If any is null → empty-state signal.
  const hammer = sale.hammer_total;
  const premium = sale.buyer_premium;
  const commission = sale.seller_commission;
  const insurance = sale.insurance;
  const lotCharges = sale.lot_charges;
  const referral = sale.referral_fees;
  const net = sale.net_revenue;
  if (
    hammer == null ||
    premium == null ||
    commission == null ||
    insurance == null ||
    lotCharges == null ||
    referral == null ||
    net == null
  ) {
    return null;
  }

  const rows: WaterfallRow[] = [];

  // Step 1: Hammer total — terminal start bar. base=0, delta=full value.
  rows.push({
    step: 'Hammer',
    fullLabel: 'Hammer total',
    base: 0,
    delta: hammer,
    runningTotal: hammer,
    direction: 'start',
  });
  let running = hammer;

  // Steps 2..6 — each intermediate step.
  for (const spec of INTERMEDIATE_STEPS) {
    const raw = sale[spec.key] as number; // guarded above
    const signed = spec.kind === 'up' ? raw : -raw;
    const nextRunning = running + signed;

    if (spec.kind === 'up') {
      // Rising bar: base sits at the current floor, delta is the signed rise.
      rows.push({
        step: spec.step,
        fullLabel: spec.fullLabel,
        base: running,
        delta: signed,
        runningTotal: nextRunning,
        direction: 'up',
      });
    } else {
      // Falling bar: base sits at the lower floor (nextRunning), delta is the
      // absolute magnitude. Pitfall 1 guard — if we set base=running and
      // delta=signed (negative), Recharts would render the bar growing upward
      // from the floor, which is backwards.
      rows.push({
        step: spec.step,
        fullLabel: spec.fullLabel,
        base: nextRunning,
        delta: Math.abs(signed),
        runningTotal: nextRunning,
        direction: 'down',
      });
    }
    running = nextRunning;
  }

  // Step 7: Net revenue — terminal end bar, same treatment as step 1.
  // We use the stored net_revenue explicitly (not `running`) because the
  // database column is the authoritative value — any arithmetic drift from
  // the deduction chain is a data issue we do not want to silently paper over.
  rows.push({
    step: 'Net revenue',
    fullLabel: 'Net revenue',
    base: 0,
    delta: net,
    runningTotal: net,
    direction: 'end',
  });

  return rows;
}
