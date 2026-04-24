// Phase 5 Plan 05-05 — TRND-05 estimate accuracy derivation.
// Contract: .planning/phases/05-trend-analysis/05-CONTEXT.md § TRND-05 and
// 05-05-PLAN.md Task 1 <behavior>. Pure function — no React, no DB. Lives in
// src/lib so it can be unit-tested independent of Recharts / jsdom / fetch.
//
// Per-sale classification: for each `sale_departments` row, compare
// `total_sold_value` to `[low_estimate, high_estimate]` and accumulate
// `lots_sold` into one of three buckets (below / within / above). Express the
// buckets as shares of the sale-level `lots_sold` denominator passed in by
// the caller (not the sum of included dept lots_sold — see NOTE below).
//
// NOTE on denominator. The three ratios may NOT sum to 1.0 when some depts
// are skipped due to null data: the denominator is the sale-level total
// (which includes the skipped depts). This is intentional — the ratios
// preserve the "some dept data is missing" fact. The TRND-05 chart wraps
// the stack in `stackOffset="expand"` which renormalizes the three bands
// visually, while the raw tooltip values surface the genuine per-band share.
//
// Null / zero paths (return null — no meaningful computation):
//   1. `saleLotsSold == null` — no denominator.
//   2. `saleLotsSold === 0` — division guard (T-05-05-DIVZERO).
//   3. Every dept skipped — nothing classifiable.
//
// Bounds are inclusive on BOTH sides (`low <= v <= high` → within). This
// matches the TRND-05 contract: a sale that lands exactly on an estimate
// bound is "within" the range, not straddling a boundary.

export interface AccuracyBands {
  below: number;
  within: number;
  above: number;
}

interface DeptInput {
  total_sold_value: number | null;
  low_estimate: number | null;
  high_estimate: number | null;
  lots_sold: number | null;
}

/**
 * Derives the below / within / above estimate-accuracy bands for a single
 * sale. Returns null when a share cannot be meaningfully computed — see the
 * module header for the three null paths.
 *
 * The `depts` input is `ReadonlyArray` so callers can't accidentally rely on
 * mutation semantics. Consumers pass the embedded `sale_departments` rows
 * straight from `useDepartmentGrid` (plan 05-03) — the fields align 1:1 with
 * `DeptGridDept`, but the signature is narrowed to the four fields this
 * function actually reads.
 */
export function computeAccuracyBands(
  depts: ReadonlyArray<DeptInput>,
  saleLotsSold: number | null,
): AccuracyBands | null {
  if (saleLotsSold == null || saleLotsSold === 0) return null;

  let below = 0;
  let within = 0;
  let above = 0;
  let any = false;

  for (const d of depts) {
    if (
      d.total_sold_value == null ||
      d.low_estimate == null ||
      d.high_estimate == null ||
      d.lots_sold == null
    ) {
      continue;
    }
    any = true;
    if (d.total_sold_value < d.low_estimate) {
      below += d.lots_sold;
    } else if (d.total_sold_value > d.high_estimate) {
      above += d.lots_sold;
    } else {
      within += d.lots_sold;
    }
  }

  if (!any) return null;

  return {
    below: below / saleLotsSold,
    within: within / saleLotsSold,
    above: above / saleLotsSold,
  };
}
