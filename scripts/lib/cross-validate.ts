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

  // --- Integer columns: exact match required --------------------------
  const sumLotsAuctioned = input.departments.reduce(
    (s, d) => s + (d.lots_auctioned ?? 0),
    0,
  );
  const saleLotsAuctioned = input.sale.lots_auctioned ?? 0;
  if (sumLotsAuctioned !== saleLotsAuctioned) {
    mismatches.push(
      `lots_auctioned: sum(dept)=${sumLotsAuctioned} vs sale=${saleLotsAuctioned}`,
    );
  }

  const sumLotsSold = input.departments.reduce(
    (s, d) => s + (d.lots_sold ?? 0),
    0,
  );
  const saleLotsSold = input.sale.lots_sold ?? 0;
  if (sumLotsSold !== saleLotsSold) {
    mismatches.push(`lots_sold: sum(dept)=${sumLotsSold} vs sale=${saleLotsSold}`);
  }

  // --- Monetary columns: ±toleranceCents ------------------------------
  const checkMoney = (
    name: string,
    saleVal: number | null,
    deptSum: number,
  ): void => {
    const s = cents(saleVal);
    const d = Math.round(deptSum * 100);
    if (Math.abs(s - d) > input.toleranceCents) {
      mismatches.push(
        `${name}: sum(dept)=$${(d / 100).toFixed(2)} vs sale=$${(s / 100).toFixed(2)}`,
      );
    }
  };

  checkMoney(
    'total_sold_value',
    input.sale.total_sold_value,
    input.departments.reduce((s, d) => s + (d.total_sold_value ?? 0), 0),
  );
  checkMoney(
    'total_low_estimate',
    input.sale.total_low_estimate,
    input.departments.reduce((s, d) => s + (d.low_estimate ?? 0), 0),
  );
  checkMoney(
    'total_high_estimate',
    input.sale.total_high_estimate,
    input.departments.reduce((s, d) => s + (d.high_estimate ?? 0), 0),
  );
  checkMoney(
    'total_reserves',
    input.sale.total_reserves,
    input.departments.reduce((s, d) => s + (d.reserves ?? 0), 0),
  );

  return { passed: mismatches.length === 0, mismatches };
}
