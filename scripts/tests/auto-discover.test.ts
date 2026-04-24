// Auto-discovery (DATA-06): the JS side of importSale must pass unknown
// department codes through to the RPC unchanged. The RPC (defined in
// supabase/migrations/20260421000011_import_sale_rpc.sql) is responsible
// for inserting a new departments row with auto_discovered=true on the
// server side; JS just routes the payload.
//
// This test verifies:
//   1. When no duplicate exists, importSale calls the RPC.
//   2. The RPC receives the full sale payload (not mutated away from the input).
//   3. The RPC's p_departments array includes the unknown code.
//   4. When the RPC returns a uuid, importSale resolves { ok: true, ... }.

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

const { importSale } = await import('../lib/import-sale.js');

function makeSale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    sale_number: 'IT300',
    title: 'Discovery Test Sale',
    sale_date: '2026-03-15',
    lots_auctioned: 5,
    lots_sold: 5,
    lots_unsold: 0,
    total_sold_value: 5000,
    total_unsold_value: 0,
    total_low_estimate: 4000,
    total_high_estimate: 6000,
    total_reserves: 3500,
    hammer_total: 5000,
    buyer_premium: 1250,
    seller_commission: 750,
    insurance: 50,
    lot_charges: 25,
    referral_fees: 0,
    net_revenue: 2075,
    registered_bidders: 12,
    winning_buyers: 5,
    payment_status: 'paid',
    source_pdf_path: '/fixtures/IT300.pdf',
    validation_warning: false,
    ...overrides,
  };
}

function makeUnknownDept(): SaleDepartmentRecord {
  return {
    code: 'ZZZ',
    display_name: 'Brand New Department',
    lots_auctioned: 5,
    lots_sold: 5,
    sell_through_pct: 100,
    total_sold_value: 5000,
    low_estimate: 4000,
    high_estimate: 6000,
    reserves: 3500,
    revenue: 2000,
  };
}

describe('importSale — auto-discovery (DATA-06)', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    rpcMock.mockReset();
    // No duplicate: existence check returns data: null.
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it('returns { ok: true, saleId } when the RPC succeeds', async () => {
    rpcMock.mockResolvedValue({ data: 'new-sale-uuid', error: null });

    const result = await importSale(makeSale(), [makeUnknownDept()]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saleId).toBe('new-sale-uuid');
      expect(result.validationWarning).toBe(false);
    }
  });

  it('invokes rpc("import_sale_with_departments", ...) exactly once', async () => {
    rpcMock.mockResolvedValue({ data: 'new-sale-uuid', error: null });

    await importSale(makeSale(), [makeUnknownDept()]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe('import_sale_with_departments');
  });

  it('passes the unknown department code through to the RPC unmutated', async () => {
    rpcMock.mockResolvedValue({ data: 'new-sale-uuid', error: null });

    const dept = makeUnknownDept();
    await importSale(makeSale(), [dept]);

    const payload = rpcMock.mock.calls[0][1] as {
      p_sale: SaleRecord;
      p_departments: SaleDepartmentRecord[];
    };
    expect(payload.p_departments).toHaveLength(1);
    expect(payload.p_departments[0].code).toBe('ZZZ');
    expect(payload.p_departments[0].display_name).toBe('Brand New Department');
    // RPC body will INSERT into departments with auto_discovered=true when
    // it cannot find a row for this code — the JS caller never sets this
    // field itself.
  });

  it('passes the full sale payload through unmutated (when cross-validation passes)', async () => {
    rpcMock.mockResolvedValue({ data: 'new-sale-uuid', error: null });

    const sale = makeSale();
    // Cross-validation passes when dept sums equal sale totals.
    const matchingDept: SaleDepartmentRecord = {
      ...makeUnknownDept(),
      code: 'NEW_DEPT_XYZ',
      display_name: 'Exactly Matching Dept',
      lots_auctioned: sale.lots_auctioned,
      lots_sold: sale.lots_sold,
      total_sold_value: sale.total_sold_value,
      low_estimate: sale.total_low_estimate,
      high_estimate: sale.total_high_estimate,
      reserves: sale.total_reserves,
    };

    await importSale(sale, [matchingDept]);

    const payload = rpcMock.mock.calls[0][1] as {
      p_sale: SaleRecord;
      p_departments: SaleDepartmentRecord[];
    };
    expect(payload.p_sale.sale_number).toBe(sale.sale_number);
    expect(payload.p_sale.title).toBe(sale.title);
    expect(payload.p_sale.validation_warning).toBe(false);
    expect(payload.p_departments[0].code).toBe('NEW_DEPT_XYZ');
  });

  it('flags validation_warning=true in the RPC payload when cross-validation fails', async () => {
    rpcMock.mockResolvedValue({ data: 'new-sale-uuid', error: null });

    // Sale claims 5 lots_auctioned, dept sum is 99 → integer mismatch.
    const driftedDept = makeUnknownDept();
    driftedDept.lots_auctioned = 99;

    const result = await importSale(makeSale(), [driftedDept]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validationWarning).toBe(true);
      expect(result.mismatches).toBeDefined();
      expect(result.mismatches!.some((m) => m.includes('lots_auctioned'))).toBe(true);
    }
    const payload = rpcMock.mock.calls[0][1] as { p_sale: SaleRecord };
    expect(payload.p_sale.validation_warning).toBe(true);
  });

  it('returns { ok: false, reason: "rpc_error" } when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'invalid input syntax for type numeric' },
    });

    const result = await importSale(makeSale(), [makeUnknownDept()]);

    expect(result).toEqual({
      ok: false,
      reason: 'rpc_error',
      error: 'invalid input syntax for type numeric',
    });
  });
});
