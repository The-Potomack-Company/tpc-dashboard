// Cross-validation (DATA-05): compare department-level sums to the
// sale-level totals for a single auction profile and flag drift.
//
// Tolerance model (Pitfall 6 of 02-RESEARCH.md):
//   - Integer columns (lots_auctioned, lots_sold) require exact match —
//     count columns cannot legitimately drift.
//   - Monetary columns allow ±toleranceCents of accumulated rounding
//     drift from up to ~20 numeric(14,2) rows. Default (imposed by the
//     caller) is 25 cents = ±$0.25.
//   - All monetary comparisons happen in integer cents to avoid
//     floating-point compounding; we round each value with
//     Math.round(n * 100) once and compare integers.
//
// Columns NOT validated (Assumption A3 / A7): the sale-level net-revenue
// column is skipped because dept pages don't expose Referral Fees /
// Level Up / Other Charges, so any dept-sum comparison is structurally
// unfair. hammer_total, buyer_premium, seller_commission, insurance,
// lot_charges are likewise deferred — not all appear on every dept page
// (A7 — not a v1 blocker). total_unsold_value is derived per-sale and
// is not aggregated from dept rows.
//
// Mismatch strings are human-readable (used in scraper_runs.logs in
// Plan 02-04): `${col}: sum(dept)=$X.XX vs sale=$Y.YY` for monetary
// and `${col}: sum(dept)=N vs sale=M` for integers.
//
// Null-coercion (WR-03): when any department row has a null for a
// validated column, the reducer treats that null as 0 before summing.
// A reader of the mismatch message therefore cannot tell by the text
// alone whether `sum(dept)=$0.00` means "every dept parsed as zero"
// or "every dept failed to parse this column". To make the distinction
// surfacable to operator triage, any mismatch line that involves at
// least one null dept value is prefixed with "(PARSE-GAP) " so
// downstream tooling can branch on parse-gap vs arithmetic-drift
// without re-deriving it from the inputs.

import type { SaleRecord, SaleDepartmentRecord } from './schemas.js';

export interface CrossValidateInput {
  sale: SaleRecord;
  departments: SaleDepartmentRecord[];
  toleranceCents: number; // e.g., 25 for ±$0.25
}

export interface CrossValidateResult {
  passed: boolean;
  mismatches: string[];
}

export function crossValidate(input: CrossValidateInput): CrossValidateResult {
  const mismatches: string[] = [];
  const cents = (n: number | null | undefined): number =>
    n == null ? 0 : Math.round(n * 100);

  // Build column-projected arrays once so we can compute both the sum
  // (with null→0 coercion) and the "any null present" flag without
  // walking input.departments multiple times.
  const intCol = (pick: (d: SaleDepartmentRecord) => number | null) => {
    const values = input.departments.map(pick);
    return {
      sum: values.reduce<number>((s, v) => s + (v ?? 0), 0),
      hasNull: values.some((v) => v == null),
    };
  };
  const moneyCol = (pick: (d: SaleDepartmentRecord) => number | null) => {
    const values = input.departments.map(pick);
    return {
      sumDollars: values.reduce<number>((s, v) => s + (v ?? 0), 0),
      hasNull: values.some((v) => v == null),
    };
  };
  // WR-03: prefix mismatch with "(PARSE-GAP) " when the dept sum was
  // contaminated by at least one null value. The sale-side value may
  // legitimately be non-null and the drift numerically correct; the
  // tag tells the operator "this is a parse-coverage issue, not a
  // reconciliation issue."
  const tag = (hasNull: boolean): string => (hasNull ? '(PARSE-GAP) ' : '');

  // --- Integer columns: exact match required --------------------------
  const lotsAuctioned = intCol((d) => d.lots_auctioned);
  const saleLotsAuctioned = input.sale.lots_auctioned ?? 0;
  if (lotsAuctioned.sum !== saleLotsAuctioned) {
    mismatches.push(
      `${tag(lotsAuctioned.hasNull)}lots_auctioned: sum(dept)=${lotsAuctioned.sum} vs sale=${saleLotsAuctioned}`,
    );
  }

  const lotsSold = intCol((d) => d.lots_sold);
  const saleLotsSold = input.sale.lots_sold ?? 0;
  if (lotsSold.sum !== saleLotsSold) {
    mismatches.push(
      `${tag(lotsSold.hasNull)}lots_sold: sum(dept)=${lotsSold.sum} vs sale=${saleLotsSold}`,
    );
  }

  // --- Monetary columns: ±toleranceCents ------------------------------
  const checkMoney = (
    name: string,
    saleVal: number | null,
    deptSumDollars: number,
    hasNull: boolean,
  ): void => {
    const s = cents(saleVal);
    const d = Math.round(deptSumDollars * 100);
    if (Math.abs(s - d) > input.toleranceCents) {
      mismatches.push(
        `${tag(hasNull)}${name}: sum(dept)=$${(d / 100).toFixed(2)} vs sale=$${(s / 100).toFixed(2)}`,
      );
    }
  };

  const totalSoldValue = moneyCol((d) => d.total_sold_value);
  checkMoney(
    'total_sold_value',
    input.sale.total_sold_value,
    totalSoldValue.sumDollars,
    totalSoldValue.hasNull,
  );
  const lowEstimate = moneyCol((d) => d.low_estimate);
  checkMoney(
    'total_low_estimate',
    input.sale.total_low_estimate,
    lowEstimate.sumDollars,
    lowEstimate.hasNull,
  );
  const highEstimate = moneyCol((d) => d.high_estimate);
  checkMoney(
    'total_high_estimate',
    input.sale.total_high_estimate,
    highEstimate.sumDollars,
    highEstimate.hasNull,
  );
  const reserves = moneyCol((d) => d.reserves);
  checkMoney(
    'total_reserves',
    input.sale.total_reserves,
    reserves.sumDollars,
    reserves.hasNull,
  );

  return { passed: mismatches.length === 0, mismatches };
}
