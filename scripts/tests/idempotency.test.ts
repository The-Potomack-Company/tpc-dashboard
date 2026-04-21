// Idempotency (DATA-07): importSale must skip (no RPC call) when a row
// with the same sale_number already exists.
//
// Mock strategy: vi.mock('../lib/supabase-admin.js') returns a supabaseAdmin
// object whose .from() returns a chain (.select/.eq/.maybeSingle) and whose
// .rpc() is a spy. Each test primes maybeSingle's resolved value, calls
// importSale, and asserts both the return value and whether rpc was invoked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SaleRecord, SaleDepartmentRecord } from '../lib/schemas.js';

const maybeSingleMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: maybeSingleMock,
        })),
      })),
    })),
    rpc: rpcMock,
  },
}));

// Import AFTER vi.mock so the module picks up the mocked supabaseAdmin.
const { importSale } = await import('../lib/import-sale.js');

function makeSale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    sale_number: 'IT254',
    title: 'Estate Sale',
    sale_date: '2026-03-01',
    lots_auctioned: 10,
    lots_sold: 9,
    lots_unsold: 1,
    total_sold_value: 10000,
    total_unsold_value: 500,
    total_low_estimate: 8000,
    total_high_estimate: 12000,
    total_reserves: 7000,
    hammer_total: 10000,
    buyer_premium: 2500,
    seller_commission: 1500,
    insurance: 100,
    lot_charges: 50,
    referral_fees: 0,
    net_revenue: 4150,
    registered_bidders: 20,
    winning_buyers: 10,
    payment_status: 'paid',
    source_pdf_path: '/fixtures/IT254.pdf',
    validation_warning: false,
    ...overrides,
  };
}

function makeDept(code: string): SaleDepartmentRecord {
  return {
    code,
    display_name: code,
    lots_auctioned: 2,
    lots_sold: 2,
    sell_through_pct: 100,
    total_sold_value: 2000,
    low_estimate: 1600,
    high_estimate: 2400,
    reserves: 1400,
    revenue: 800,
  };
}

function makeCleanDepts(): SaleDepartmentRecord[] {
  return [
    makeDept('AMER'),
    makeDept('ASNP'),
    makeDept('FRN'),
    makeDept('DEC'),
    makeDept('FAR'),
  ];
}

describe('importSale — idempotency (DATA-07)', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    rpcMock.mockReset();
  });

  it('returns { ok: false, reason: "duplicate" } when sale_number already exists', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'existing-uuid' },
      error: null,
    });

    const result = await importSale(makeSale(), makeCleanDepts());

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('does NOT invoke the RPC when a duplicate is detected', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'existing-uuid' },
      error: null,
    });

    await importSale(makeSale(), makeCleanDepts());

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('surfaces an rpc_error when the existence check itself errors', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    const result = await importSale(makeSale(), makeCleanDepts());

    expect(result).toEqual({
      ok: false,
      reason: 'rpc_error',
      error: 'connection refused',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
