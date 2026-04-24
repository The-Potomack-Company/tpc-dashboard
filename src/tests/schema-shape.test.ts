import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Database } from '../db/database.types';

// These tests guard INFR-04 at the type level: the dashboard-owned schema
// must contain all 5 tables the app depends on, monetary columns must be
// numeric (emitted by Supabase as `number | null` for numeric(14,2)), and
// shared surface like `profiles.role` must be typed (not `any`). TS fails at
// `tsc -b` if any assertion is false; the runtime `expect(true)` placeholders
// keep Vitest from treating the case as "no assertions".
describe('Database schema shape (INFR-04 type-level guard)', () => {
  it('has all five dashboard tables', () => {
    type Tables = keyof Database['public']['Tables'];
    expectTypeOf<
      'sales' | 'sale_departments' | 'departments' | 'scraper_runs' | 'saved_reports'
    >().toExtend<Tables>();

    const tableNames: Tables[] = [
      'sales',
      'sale_departments',
      'departments',
      'scraper_runs',
      'saved_reports',
    ];
    expect(tableNames.length).toBe(5);
  });

  it('sales monetary columns are number | null (numeric(14,2) maps to number)', () => {
    type SaleRow = Database['public']['Tables']['sales']['Row'];
    expectTypeOf<SaleRow['hammer_total']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['buyer_premium']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['seller_commission']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['insurance']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['lot_charges']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['referral_fees']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['net_revenue']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['total_sold_value']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['total_unsold_value']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['total_low_estimate']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['total_high_estimate']>().toEqualTypeOf<number | null>();
    expectTypeOf<SaleRow['total_reserves']>().toEqualTypeOf<number | null>();
    expect(true).toBe(true);
  });

  it('saved_reports.user_id is a uuid string (non-null)', () => {
    type SavedReportRow = Database['public']['Tables']['saved_reports']['Row'];
    expectTypeOf<SavedReportRow['user_id']>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });

  it('profiles table is present (confirms shared schema wiring)', () => {
    // `profiles` is owned by TPC App but must appear in the dashboard's
    // generated types so authStore can fetch and authorize by role.
    type ProfilesRow = Database['public']['Tables']['profiles']['Row'];
    expectTypeOf<ProfilesRow['role']>().not.toBeAny();
    expectTypeOf<ProfilesRow['role']>().toEqualTypeOf<string>();
    expectTypeOf<ProfilesRow['display_name']>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });
});
