// Phase 6 Plan 06-01 Task 4 — transformToWaterfall contract tests.
// Contract: 06-UI-SPEC.md § Waterfall color rules; 06-RESEARCH.md § Pattern 2
// + Pitfall 1 (step 1 / step 7 off-by-one; down-row base = lower floor;
// delta is always non-negative, direction encodes sign).
//
// Test inputs use Partial<Sale>-shaped fixtures cast through `as unknown as Sale`
// because transformToWaterfall only reads 7 of ~30 columns on `sales.Row`.
// Constructing a full 30-field Row per test would add noise with no value.

import { describe, it, expect } from 'vitest';
import { transformToWaterfall } from './waterfall';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

// Contrived values so the running-total trajectory exercises each direction
// without any intermediate going negative (not required by the chart, but keeps
// assertions simple).
const validSale = {
  hammer_total: 1000,
  buyer_premium: 250,
  seller_commission: 100,
  insurance: 20,
  lot_charges: 30,
  referral_fees: 50,
  net_revenue: 1050,
} as unknown as Sale;

describe('transformToWaterfall', () => {
  it('T1 — returns 7 rows; step 1 is the start bar and step 7 is the end bar', () => {
    const rows = transformToWaterfall(validSale);
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(7);
    // Step 1: Hammer — base=0, delta = full hammer value, direction='start'
    expect(rows![0]).toMatchObject({
      step: 'Hammer',
      base: 0,
      delta: 1000,
      direction: 'start',
    });
    // Step 7: Net revenue — base=0, delta = full net value, direction='end'
    expect(rows![6]).toMatchObject({
      step: 'Net revenue',
      base: 0,
      delta: 1050,
      direction: 'end',
    });
  });

  it('T2 — intermediate steps encode up (premium) and down (4 deductions)', () => {
    const rows = transformToWaterfall(validSale)!;
    expect(rows[1].direction).toBe('up'); // +Premium
    expect(rows[2].direction).toBe('down'); // -Commission
    expect(rows[3].direction).toBe('down'); // -Insurance
    expect(rows[4].direction).toBe('down'); // -Lot charges
    expect(rows[5].direction).toBe('down'); // -Referral
  });

  it('T3 — running totals: step 2 sums hammer+premium; step 6 equals input net_revenue', () => {
    const rows = transformToWaterfall(validSale)!;
    // After step 2 (+ buyer premium): 1000 + 250 = 1250
    expect(rows[1].runningTotal).toBe(1250);
    // Step 6 (last deduction) running total must equal the explicit net_revenue
    // in the input (validates that the deduction chain arithmetic aligns with
    // the separately stored net_revenue — Pitfall 1 sanity check).
    expect(rows[5].runningTotal).toBe(1050);
  });

  it('T4 — every down row has delta >= 0 (sign is encoded in direction, not in delta)', () => {
    const rows = transformToWaterfall(validSale)!;
    for (const row of rows) {
      if (row.direction === 'down') {
        expect(row.delta).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('T5 — returns null when a single required field is null (net_revenue)', () => {
    const sale = { ...validSale, net_revenue: null } as unknown as Sale;
    expect(transformToWaterfall(sale)).toBeNull();
  });

  it('T6 — returns null when every required field is null', () => {
    const sale = {
      hammer_total: null,
      buyer_premium: null,
      seller_commission: null,
      insurance: null,
      lot_charges: null,
      referral_fees: null,
      net_revenue: null,
    } as unknown as Sale;
    expect(transformToWaterfall(sale)).toBeNull();
  });

  it('T7 — does not throw on a frozen input (does not mutate the Sale)', () => {
    const frozen = Object.freeze({ ...validSale });
    expect(() => transformToWaterfall(frozen)).not.toThrow();
    // Re-run and confirm the frozen input was not mutated (structuralClone-free
    // assertion: compare against the validSale literal).
    const rows = transformToWaterfall(frozen);
    expect(rows).not.toBeNull();
    expect(frozen.hammer_total).toBe(1000);
    expect(frozen.net_revenue).toBe(1050);
  });

  it('T8 — step abbreviations match the x-axis labels in UI-SPEC exactly', () => {
    const rows = transformToWaterfall(validSale)!;
    const steps = rows.map((r) => r.step);
    expect(steps).toEqual([
      'Hammer',
      '+Premium',
      '-Commission',
      '-Insurance',
      '-Lot charges',
      '-Referral',
      'Net revenue',
    ]);
  });

  it('T9 — fullLabels match the tooltip header copy in UI-SPEC exactly', () => {
    const rows = transformToWaterfall(validSale)!;
    const labels = rows.map((r) => r.fullLabel);
    expect(labels).toEqual([
      'Hammer total',
      'Buyer premium',
      'Commission',
      'Insurance',
      'Lot charges',
      'Referral fees',
      'Net revenue',
    ]);
  });
});
