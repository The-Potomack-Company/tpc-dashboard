// Per-sale import orchestration (DATA-06, DATA-07).
//
// Flow:
//   1. Check for a row in public.sales with the same sale_number.
//      If one exists, return { ok: false, reason: 'duplicate' } WITHOUT
//      calling the RPC (fast path; avoids any round-trip for dupes).
//   2. Run crossValidate against the dept array with a caller-configurable
//      tolerance (default 25 cents = ±$0.25). If drift is detected, clone
//      the sale with validation_warning=true so it lands in the DB flagged.
//   3. Invoke the public.import_sale_with_departments RPC, which inserts
//      sale + sale_departments atomically and auto-discovers unknown
//      department codes on the server side (see migration
//      20260421000011_import_sale_rpc.sql). JS never has to detect unknown
//      codes itself — it just forwards the payload.
//
// Return shape is a discriminated union so the caller (Plan 02-04 CLI)
// can bucket each file into inserted / skipped / failed without a try/catch.
//
// Threat model:
//   - T-02 (SQL injection via PDF content): RPC casts every field with
//     `->> '::type'`; this module never concatenates strings into SQL.
//   - T-07 (duplicate DoS loop): fast-path SELECT returns before any RPC call.

import { supabaseAdmin } from './supabase-admin.js';
import { crossValidate } from './cross-validate.js';
import type { SaleRecord, SaleDepartmentRecord } from './schemas.js';

export type ImportSaleResult =
  | {
      ok: true;
      saleId: string;
      validationWarning: boolean;
      mismatches?: string[];
    }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'rpc_error'; error: string };

export interface ImportSaleOptions {
  /** Monetary tolerance in integer cents. Default 25 (±$0.25). */
  toleranceCents?: number;
}

export async function importSale(
  sale: SaleRecord,
  departments: SaleDepartmentRecord[],
  opts: ImportSaleOptions = {},
): Promise<ImportSaleResult> {
  // --- Idempotency fast-path ------------------------------------------
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('sales')
    .select('id')
    .eq('sale_number', sale.sale_number)
    .maybeSingle();
  if (existErr) {
    return { ok: false, reason: 'rpc_error', error: existErr.message };
  }
  if (existing) {
    return { ok: false, reason: 'duplicate' };
  }

  // --- Cross-validation -----------------------------------------------
  const toleranceCents = opts.toleranceCents ?? 25;
  const validation = crossValidate({ sale, departments, toleranceCents });
  const saleToInsert: SaleRecord = validation.passed
    ? sale
    : { ...sale, validation_warning: true };

  // --- Atomic per-sale RPC --------------------------------------------
  const { data, error } = await supabaseAdmin.rpc(
    'import_sale_with_departments',
    {
      p_sale: saleToInsert,
      p_departments: departments,
    },
  );
  if (error) {
    return { ok: false, reason: 'rpc_error', error: error.message };
  }
  return {
    ok: true,
    saleId: data as unknown as string,
    validationWarning: !validation.passed,
    mismatches: validation.passed ? undefined : validation.mismatches,
  };
}
