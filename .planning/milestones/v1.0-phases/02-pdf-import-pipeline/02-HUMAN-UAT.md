---
status: partial
phase: 02-pdf-import-pipeline
source: [02-VERIFICATION.md]
started: 2026-04-21T20:00:00Z
updated: 2026-04-21T20:00:00Z
---

## Current Test

[awaiting human testing — all 4 items gated on the live 457-PDF import run]

## Tests

### 1. Push follow-up migration + run full 457-PDF import (DATA-01)

expected: 457 files processed; scraper_runs row shows status='success' or 'partial'; sales_imported >= 370; sales_skipped_empty = ~62; failed <= 25.

result: [pending — deferred during Plan 02-05]

instructions:
1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (from Supabase dashboard → Settings → API → service_role)
2. `npx supabase db push` — applies migration `20260421000012_refine_import_sale_rpc.sql`
3. `npm run import:pdfs` — full 457-PDF import; confirm when prompted
4. Paste scraper_runs summary

### 2. Spot-check 10 imported sales (DATA-02, DATA-03, DATA-04)

expected: 10 sales round-trip correctly; up to 2 fields per sale may mismatch within tolerance (note them).

result: [pending]

instructions:
1. `SELECT sale_number FROM sales ORDER BY random() LIMIT 10;`
2. Open matching `{sale_number}_Profile_*.PDF` from `~/Projects/rfc_profiles/rfc_profiles/`
3. Compare: sale_date, lots_auctioned, lots_sold, hammer_total, net_revenue, at least one department row
4. Record pass/fail per sale

### 3. Review validation_warning sales (DATA-05)

expected: Any flagged sale has legitimate dept-sum drift vs total (not a parser bug).

result: [pending]

instructions:
1. `SELECT sale_number, validation_warning FROM sales WHERE validation_warning = true;`
2. Pick 2-3, inspect in Supabase Studio, compare to source PDF
3. Confirm drift is real (e.g., rounding in source data), not a parser regression

### 4. Idempotency re-run (DATA-07)

expected: Second run shows sales_imported=0, sales_skipped_duplicate=395 (approx), sales_skipped_empty=62, failed=0.

result: [pending]

instructions:
1. Immediately after step 1, run `npm run import:pdfs` again
2. Paste the second run's scraper_runs summary

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

- **DATA-01 (bulk import)** cannot be confirmed until the live run executes. All validations that depend on real-DB state (DATA-02 spot-checks, DATA-05 review, DATA-07 idempotency) cascade from this.
- Migration `20260421000012_refine_import_sale_rpc.sql` is unpushed — must be applied before the live run so the seeded-departments `display_name` refinement (WR-06 fix) takes effect.
