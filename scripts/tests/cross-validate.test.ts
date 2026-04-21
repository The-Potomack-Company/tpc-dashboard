// Tests for scripts/lib/cross-validate.ts (DATA-05).
//
// Tolerance model (from 02-RESEARCH.md Pitfall 6, Assumption A3, A7):
//   - Integer columns (lots_auctioned, lots_sold) require exact match.
//   - Monetary columns compare sum(dept) to sale-level using ±toleranceCents.
//   - Default tolerance is 25 cents (±$0.25) — sized for up to 20 dept rows
//     of numeric(14,2) rounding drift.
//   - net_revenue is NOT validated: dept pages don't expose Referral Fees,
//     Level Up, or Other Charges so the dept sum is structurally incomplete.

import { describe, it, expect } from 'vitest';
import { crossValidate } from '../lib/cross-validate.js';
import type { SaleRecord, SaleDepartmentRecord } from '../lib/schemas.js';

// --- Fixture helpers -----------------------------------------------------

function makeSale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    sale_number: 'T001',
    title: 'Test Sale',
    sale_date: '2026-01-15',
    lots_auctioned: 100,
    lots_sold: 90,
    lots_unsold: 10,
    total_sold_value: 100000,
    total_unsold_value: 5000,
    total_low_estimate: 80000,
    total_high_estimate: 120000,
    total_reserves: 70000,
    hammer_total: 100000,
    buyer_premium: 25000,
    seller_commission: 15000,
    insurance: 1500,
    lot_charges: 500,
    referral_fees: 0,
    net_revenue: 42000,
    registered_bidders: 50,
    winning_buyers: 30,
    payment_status: 'paid',
    source_pdf_path: '/fixtures/T001.pdf',
    validation_warning: false,
    ...overrides,
  };
}

function makeDept(
  code: string,
  overrides: Partial<SaleDepartmentRecord> = {},
): SaleDepartmentRecord {
  return {
    code,
    display_name: code,
    lots_auctioned: 20,
    lots_sold: 18,
    sell_through_pct: 90,
    total_sold_value: 20000,
    low_estimate: 16000,
    high_estimate: 24000,
    reserves: 14000,
    revenue: 8000,
    ...overrides,
  };
}

// 5 depts that sum exactly to the default sale totals:
//   lots_auctioned: 5×20 = 100
//   lots_sold:      5×18 = 90
//   total_sold_value:  5×20000 = 100000
//   total_low_estimate: 5×16000 = 80000
//   total_high_estimate: 5×24000 = 120000
//   total_reserves:    5×14000 = 70000
function makeCleanDepts(): SaleDepartmentRecord[] {
  return [
    makeDept('AMER'),
    makeDept('ASNP'),
    makeDept('FRN'),
    makeDept('DEC'),
    makeDept('FAR'),
  ];
}

// --- Tests ---------------------------------------------------------------

describe('crossValidate — clean input', () => {
  it('passes when 5 depts sum exactly to sale-level totals', () => {
    const result = crossValidate({
      sale: makeSale(),
      departments: makeCleanDepts(),
      toleranceCents: 25,
    });
    expect(result.passed).toBe(true);
    expect(result.mismatches).toEqual([]);
  });
});

describe('crossValidate — integer columns require exact match', () => {
  it('fails when lots_auctioned sum differs by 1', () => {
    const depts = makeCleanDepts();
    depts[0] = makeDept('AMER', { lots_auctioned: 21 }); // sum now 101
    const result = crossValidate({
      sale: makeSale(), // sale.lots_auctioned still 100
      departments: depts,
      toleranceCents: 25,
    });
    expect(result.passed).toBe(false);
    expect(result.mismatches.some((m) => m.includes('lots_auctioned'))).toBe(true);
  });

  it('fails when lots_sold sum differs', () => {
    const depts = makeCleanDepts();
    depts[1] = makeDept('ASNP', { lots_sold: 17 }); // sum now 89
    const result = crossValidate({
      sale: makeSale(), // sale.lots_sold still 90
      departments: depts,
      toleranceCents: 25,
    });
    expect(result.passed).toBe(false);
    expect(result.mismatches.some((m) => m.includes('lots_sold'))).toBe(true);
  });
});

describe('crossValidate — monetary tolerance', () => {
  it('passes when total_sold_value drifts by $0.24 at toleranceCents=25 (within ±$0.25)', () => {
    const depts = makeCleanDepts();
    // Shift one dept by $0.24 so sum = 100000 - 0.24 = 99999.76
    depts[0] = makeDept('AMER', { total_sold_value: 20000 - 0.24 });
    const result = crossValidate({
      sale: makeSale(), // 100000
      departments: depts,
      toleranceCents: 25,
    });
    expect(result.passed).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it('fails when total_sold_value drifts by $0.26 at toleranceCents=25 (beyond ±$0.25)', () => {
    const depts = makeCleanDepts();
    depts[0] = makeDept('AMER', { total_sold_value: 20000 - 0.26 });
    const result = crossValidate({
      sale: makeSale(),
      departments: depts,
      toleranceCents: 25,
    });
    expect(result.passed).toBe(false);
    expect(result.mismatches.some((m) => m.includes('total_sold_value'))).toBe(true);
  });

  it('passes with a $0.30 drift when tolerance is raised to 50 cents', () => {
    const depts = makeCleanDepts();
    depts[0] = makeDept('AMER', { low_estimate: 16000 - 0.3 });
    const result = crossValidate({
      sale: makeSale(),
      departments: depts,
      toleranceCents: 50,
    });
    expect(result.passed).toBe(true);
    expect(result.mismatches).toEqual([]);
  });
});

describe('crossValidate — net_revenue exclusion', () => {
  it('ignores net_revenue mismatch (dept pages miss Referral/Level Up/Other)', () => {
    // Set sale.net_revenue to 100 and dept.revenue sum to 50 (5 × 10).
    // All other columns align → should still pass because net_revenue
    // is intentionally not validated.
    const depts = makeCleanDepts().map((d) => ({ ...d, revenue: 10 }));
    const result = crossValidate({
      sale: makeSale({ net_revenue: 100 }),
      departments: depts,
      toleranceCents: 25,
    });
    expect(result.passed).toBe(true);
    expect(result.mismatches).toEqual([]);
    // Paranoia guard: the module should not even mention net_revenue.
    expect(result.mismatches.some((m) => m.toLowerCase().includes('net_revenue'))).toBe(
      false,
    );
  });
});

describe('crossValidate — null handling', () => {
  it('treats null dept values as 0 when summing', () => {
    // 4 depts with lots_auctioned=20 + 1 dept with null → sum should be 80,
    // and a sale with lots_auctioned=80 should pass.
    const depts = makeCleanDepts();
    depts[4] = makeDept('FAR', {
      lots_auctioned: null,
      lots_sold: null,
      total_sold_value: null,
      low_estimate: null,
      high_estimate: null,
      reserves: null,
    });
    const result = crossValidate({
      sale: makeSale({
        lots_auctioned: 80,
        lots_sold: 72,
        total_sold_value: 80000,
        total_low_estimate: 64000,
        total_high_estimate: 96000,
        total_reserves: 56000,
      }),
      departments: depts,
      toleranceCents: 25,
    });
    expect(result.passed).toBe(true);
    expect(result.mismatches).toEqual([]);
  });
});
