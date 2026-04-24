// Zod schemas for parsed RFC auction profile records.
// Shapes match Database['public']['Tables']['sales']['Insert'] and
// Database['public']['Tables']['sale_departments']['Insert'] from src/db/database.types.ts.
// Only fields parseable from PDF — DB-computed fields (id, created_at, updated_at) excluded.
// Source: supabase/migrations/20260421000002_create_sales.sql +
//         supabase/migrations/20260421000003_create_sale_departments.sql +
//         Plan 02-01 migrations (validation_warning, auto_discovered).

import { z } from 'zod';

export const SaleRecordSchema = z.object({
  sale_number: z.string().min(1), // e.g., "IT254", "41", "10ES" — alphanumeric
  title: z.string().min(1), // e.g., "Estate of General Colin L. Powell"
  sale_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(), // ISO date
  lots_auctioned: z.number().int().nullable(),
  lots_sold: z.number().int().nullable(),
  lots_unsold: z.number().int().nullable(),
  total_sold_value: z.number().nullable(),
  total_unsold_value: z.number().nullable(),
  total_low_estimate: z.number().nullable(),
  total_high_estimate: z.number().nullable(),
  total_reserves: z.number().nullable(),
  hammer_total: z.number().nullable(),
  buyer_premium: z.number().nullable(),
  seller_commission: z.number().nullable(),
  insurance: z.number().nullable(),
  lot_charges: z.number().nullable(),
  referral_fees: z.number().nullable(),
  net_revenue: z.number().nullable(),
  registered_bidders: z.number().int().nullable(),
  winning_buyers: z.number().int().nullable(),
  payment_status: z.string().nullable(), // derived from paid vs unpaid invoice counts
  source_pdf_path: z.string().min(1),
  imported_at: z.string().datetime().optional(),
  validation_warning: z.boolean().default(false),
});
export type SaleRecord = z.infer<typeof SaleRecordSchema>;

export const SaleDepartmentRecordSchema = z.object({
  code: z.string().min(2).max(6), // e.g., "AMER", "ASNP", "FRN"
  display_name: z.string().min(1), // e.g., "American Historical/Folk"
  lots_auctioned: z.number().int().nullable(),
  lots_sold: z.number().int().nullable(),
  sell_through_pct: z.number().min(0).max(100).nullable(), // numeric(5,2)
  total_sold_value: z.number().nullable(),
  low_estimate: z.number().nullable(),
  high_estimate: z.number().nullable(),
  reserves: z.number().nullable(),
  // revenue = parseMoney(Premium) + Commission + Insurance + Lot Charges
  // (RESOLVED Open Question #1 — verified against FRN fixture $14,078.96).
  revenue: z.number().nullable(),
});
export type SaleDepartmentRecord = z.infer<typeof SaleDepartmentRecordSchema>;
