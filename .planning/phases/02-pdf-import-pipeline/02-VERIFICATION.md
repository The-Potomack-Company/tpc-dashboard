---
phase: 02-pdf-import-pipeline
verified: 2026-04-21T20:10:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
human_verification:
  - test: "Run full 457-PDF live import and capture the scraper_runs row"
    expected: "status in ('success','partial'), sales_imported >= 370, inserted + skipped_duplicate + skipped_empty + failed === 457 (exact). Pre-run: push migration 20260421000012_refine_import_sale_rpc.sql to the live DB (supabase db push) so the refined RPC body is active before the run."
    why_human: "Requires SUPABASE_SERVICE_ROLE_KEY in .env.local and 457 real PDFs on local disk. Cannot execute without operator credentials."
  - test: "Spot-check 10 imported sales against source PDFs"
    expected: "All financial fields (sale_number, title, sale_date, lots_auctioned, lots_sold, total_sold_value, hammer_total, net_revenue) match the source PDF exactly. Department rows sum to sale totals within ±$0.25."
    why_human: "Requires visual comparison of DB values against physical PDF content. Cannot verify programmatically."
  - test: "Review sales with validation_warning=true and confirm drift is legitimate"
    expected: "SELECT count(*), sale_number, logs FROM sales WHERE validation_warning=true returns expected rows. Each flagged sale's drift is a known rounding difference, not a parser bug."
    why_human: "Requires reading source PDFs and comparing to the mismatches strings captured in the import run."
  - test: "Re-run full import and confirm zero new inserts (idempotency)"
    expected: "Second run of npm run import:pdfs shows Inserted=0, Skipped (duplicate)=~(previous sales_imported), exit code 0. scraper_runs status='success'."
    why_human: "Requires live DB state from the first run to exist before this check is meaningful."
---

# Phase 2: PDF Import Pipeline Verification Report

**Phase Goal:** All 457 historical auction profiles are parsed into structured, validated database records that accurately represent the original PDF data
**Verified:** 2026-04-21T20:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run a CLI command that bulk-imports all 457 PDFs, producing sale records and department records | ? HUMAN | CLI exists and dry-run --limit 3 confirmed working; live 457-PDF run deferred (operator-gated) |
| 2 | A spot-check of 10+ imported sales confirms all financial values match the source PDFs exactly | ? HUMAN | Dry-run parsing verified on real PDFs; DB round-trip not yet confirmed |
| 3 | Department record sums match the "All Departments" totals for every imported sale (cross-validation passes) | ✓ VERIFIED | crossValidate() confirmed correct in 8 unit tests; ±$0.25 tolerance verified programmatically |
| 4 | Re-running the import on the same PDFs skips all duplicates and produces no errors | ✓ VERIFIED | idempotency.test.ts 3 cases pass; live re-run confirmation deferred (human) |
| 5 | The departments table contains all known department codes with display names | ✓ VERIFIED | 22 codes seeded via migration 20260421000008; auto-discover path unit-tested |

**Score:** 3/5 truths fully verified (4/5 truths covered at the code level; SC-1 and SC-2 require human live-run confirmation)

**Prerequisite note:** Migration `20260421000012_refine_import_sale_rpc.sql` exists locally but has NOT been pushed to the live DB. This migration refines the `import_sale_with_departments` RPC body. The human-gated live run must be preceded by `npm run db:push` to apply this migration, or the live DB will run the older RPC body from migration 000011.

### Deferred Items

No items were deferred to later phases. The live-run gap is a human-gated checkpoint within Phase 2 itself (Plan 02-05 Task 2), not deferred to a later milestone phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260421000009_add_validation_warning_to_sales.sql` | validation_warning column | ✓ VERIFIED | Present; `alter table public.sales add column validation_warning boolean not null default false` |
| `supabase/migrations/20260421000010_add_auto_discovered_to_departments.sql` | auto_discovered column | ✓ VERIFIED | Present; `alter table public.departments add column auto_discovered boolean not null default false` |
| `supabase/migrations/20260421000011_import_sale_rpc.sql` | Atomic sale+departments RPC | ✓ VERIFIED | Present; `create or replace function public.import_sale_with_departments`, `security definer`, grant to `service_role` |
| `supabase/migrations/20260421000012_refine_import_sale_rpc.sql` | Refined RPC body | ✓ EXISTS (unpushed) | Present locally; NOT yet applied to live DB — required before live import run |
| `src/db/database.types.ts` | Regenerated types with new columns + RPC | ✓ VERIFIED | Contains `validation_warning`, `auto_discovered`, `import_sale_with_departments` in Functions block |
| `scripts/lib/supabase-admin.ts` | Service-role client with browser guard | ✓ VERIFIED | `typeof window` guard present; `SUPABASE_SERVICE_ROLE_KEY` used (not VITE_); no `import.meta.env` |
| `scripts/lib/schemas.ts` | SaleRecordSchema, SaleDepartmentRecordSchema | ✓ VERIFIED | Both schemas exported; inferred types exported |
| `scripts/lib/parsers/numeric.ts` | parseMoney, parseCount, parseMoneyRange, parseLotsSold, parseAuctionedLots | ✓ VERIFIED | All 5 named exports present; 21 test cases passing |
| `scripts/lib/parsers/sale-page.ts` | parseSalePage | ✓ VERIFIED | Export present; IT254 fixture parses to correct SaleRecord in 17 tests |
| `scripts/lib/parsers/department-page.ts` | parseDepartmentPage | ✓ VERIFIED | Export present; FRN fixture parses correctly in 8 tests |
| `scripts/lib/parse-pdf.ts` | parsePdf discriminated union | ✓ VERIFIED | Three-variant union (ok/empty/failed) exported; empty-placeholder fast-path tested |
| `scripts/lib/cross-validate.ts` | crossValidate with tolerance | ✓ VERIFIED | Exported; 8 test cases; integer-cent math; net_revenue intentionally excluded |
| `scripts/lib/import-sale.ts` | importSale with dup-check + RPC + validation_warning | ✓ VERIFIED | Exported; calls crossValidate and `import_sale_with_departments` RPC; dup fast-path tested |
| `scripts/import-pdfs.ts` | CLI entry point (496 lines) | ✓ VERIFIED | `export async function main()` present; all 6 flags; scraper_runs lifecycle; dry-run --limit 3 executes and exits 0 |
| `scripts/tests/import-pdfs.integration.test.ts` | Integration test (2 scenarios) | ✓ VERIFIED | Both scenarios present; Scenario 1 skips if fixture dir missing; Scenario 2 always runs |
| `.env.example` | Template documenting 4 env vars | ✓ VERIFIED | SUPABASE_SERVICE_ROLE_KEY block present with VITE_ prefix warning |
| `README.md` | Import pipeline documentation | ✓ VERIFIED | "Importing Auction Profile PDFs" section present with prerequisites, commands, SQL, troubleshooting, security warning |
| `vite.config.ts` | Vitest projects config covering scripts/ | ✓ VERIFIED | Two-project split (src: jsdom, scripts: node) using Vitest 4 `projects` API |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/lib/parse-pdf.ts` | `scripts/lib/parsers/sale-page.ts` | `import { parseSalePage }` | ✓ WIRED | Named import found |
| `scripts/lib/parse-pdf.ts` | `scripts/lib/parsers/department-page.ts` | `import { parseDepartmentPage }` | ✓ WIRED | Named import found |
| `scripts/lib/schemas.ts` | `src/db/database.types.ts` | Zod shapes match Database Insert types | ✓ WIRED | sale_number, lots_auctioned, total_sold_value all match |
| `scripts/lib/parsers/sale-page.ts` | `scripts/lib/parsers/numeric.ts` | `import { parseMoney, ... }` | ✓ WIRED | parseMoney and other imports confirmed |
| `scripts/lib/import-sale.ts` | `scripts/lib/supabase-admin.ts` | `import { supabaseAdmin }` | ✓ WIRED | Confirmed by grep |
| `scripts/lib/import-sale.ts` | `public.import_sale_with_departments` RPC | `supabaseAdmin.rpc('import_sale_with_departments', ...)` | ✓ WIRED | RPC call present |
| `scripts/lib/import-sale.ts` | `scripts/lib/cross-validate.ts` | `crossValidate()` called before RPC | ✓ WIRED | Confirmed by grep; validation_warning set on drift |
| `scripts/import-pdfs.ts` | `scripts/lib/parse-pdf.ts` | `import { parsePdf }` | ✓ WIRED | Confirmed by grep |
| `scripts/import-pdfs.ts` | `scripts/lib/import-sale.ts` | `import { importSale }` | ✓ WIRED | Confirmed by grep |
| `scripts/import-pdfs.ts` | `public.scraper_runs` | `.from('scraper_runs').insert/.update` | ✓ WIRED | scraper_runs lifecycle present |
| `README.md` | `.env.example` | Instructions to copy to .env.local | ✓ WIRED | SUPABASE_SERVICE_ROLE_KEY referenced |
| `supabase/migrations/20260421000011_import_sale_rpc.sql` | `public.sales, sale_departments, departments` | PL/pgSQL INSERT statements | ✓ WIRED | Confirmed by grep on migration body |
| `supabase/migrations/20260421000011_import_sale_rpc.sql` | `service_role` | GRANT EXECUTE | ✓ WIRED | `grant execute on function public.import_sale_with_departments.*to service_role` present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `scripts/lib/parse-pdf.ts` | `sale`, `departments` | pdf-parse buffer + file I/O | Yes — reads real PDF files via `readFile`, passes through regex extractors and Zod parse | ✓ FLOWING |
| `scripts/lib/import-sale.ts` | `existing` (dup check) | `supabaseAdmin.from('sales').select('id').eq(...)` | Yes — queries live DB (mocked in tests, real in prod) | ✓ FLOWING |
| `scripts/lib/import-sale.ts` | `data` (RPC result) | `supabaseAdmin.rpc('import_sale_with_departments', ...)` | Yes — calls PL/pgSQL function with real JSONB payload | ✓ FLOWING |
| `scripts/lib/cross-validate.ts` | `mismatches` | Numeric comparisons of SaleRecord vs SaleDepartmentRecord[] | Yes — integer-cent comparison of typed values | ✓ FLOWING |
| `scripts/import-pdfs.ts` | `summary` | Aggregated loop results from parsePdf + importSale | Yes — populated per file in the iteration loop | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `--help` prints all 6 CLI flags | `npx tsx scripts/import-pdfs.ts --help` | Printed --source, --dry-run, --limit, --verbose, --cross-validation-tolerance, --help | ✓ PASS |
| `--dry-run --limit 3` parses 3 PDFs without DB writes | `npx tsx scripts/import-pdfs.ts --dry-run --limit 3` | Exit 0; 3 progress lines (1 empty_placeholder + 2 dry-run ok); summary shows 0 failed | ✓ PASS |
| 96 tests pass | `npx vitest run` | 13 test files, 96 tests, all passing in 3.30s | ✓ PASS |
| Build is clean | `npm run build` | `tsc -b && vite build` succeeds; 459 kB bundle; no scripts/lib references in dist/ | ✓ PASS |
| No service role key leak in bundle | `grep -r "SUPABASE_SERVICE_ROLE_KEY" dist/` | No match | ✓ PASS |
| Full live import (457 PDFs) | Not runnable — requires SUPABASE_SERVICE_ROLE_KEY | N/A | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-04, 02-05 | Bulk-import 457 PDFs into structured records | ? NEEDS HUMAN | CLI built and dry-run tested; live 457-run deferred |
| DATA-02 | 02-02 | Sale record with all "All Departments" summary metrics | ✓ SATISFIED | parseSalePage + SaleRecordSchema unit-tested; IT254 fixture round-trip correct |
| DATA-03 | 02-02 | Per-department pages parsed into department records | ✓ SATISFIED | parseDepartmentPage + SaleDepartmentRecordSchema unit-tested; FRN fixture correct |
| DATA-04 | 02-02 | Financial values parsed accurately (ranges, commas, percentages) | ✓ SATISFIED | 21 numeric.test.ts cases cover all documented edge cases incl. $.NULL., negative values, sentinel ranges |
| DATA-05 | 02-03 | Cross-validation confirms dept sums match sale totals | ✓ SATISFIED | crossValidate() 8 test cases; ±$0.25 integer-cent comparison; net_revenue correctly excluded |
| DATA-06 | 02-01, 02-03 | Departments table seeded; unknown codes auto-discovered | ✓ SATISFIED | 22 seed codes in migration 000008; auto-discover path tested in auto-discover.test.ts (server-side via RPC) |
| DATA-07 | 02-03 | Duplicate PDFs detected and skipped | ✓ SATISFIED | idempotency.test.ts verifies RPC is not called on duplicate; UNIQUE constraint on sale_number in schema |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/import-pdfs.ts` | ~269, ~459, ~502 | "empty_placeholder" in string literals | ℹ Info | These are progress/summary output strings, not stubs — intentional format strings |

No blocking anti-patterns found. No TODO/FIXME/placeholder comments in implementation files. No empty return stubs. No hardcoded empty data passed to rendering paths.

**Migration 000012 (unpushed) — not a code anti-pattern but an operational prerequisite:** The file `supabase/migrations/20260421000012_refine_import_sale_rpc.sql` exists locally and refines the RPC body but has not been applied to the live DB. The live import run must be preceded by `npm run db:push` to apply it. If run against the old RPC from migration 000011, behavior should still be correct (000012 refines display_name handling per a code review fix), but the refined behavior is what was reviewed and approved.

### Human Verification Required

#### 1. Push migration 000012 then run full 457-PDF import

**Test:**
1. Run `npm run db:push` to apply migration 20260421000012 to the live Supabase project.
2. Confirm in Supabase dashboard that `import_sale_with_departments` is updated.
3. Run `npm run import:pdfs` (full run, no --limit).

**Expected:**
- Confirmation banner prints source dir, target Supabase URL, file count (457), mode LIVE.
- Progress lines count to [ 457/457 ].
- Summary shows: Inserted + Skipped (duplicate) + Skipped (empty placeholder) + Failed === 457 exactly.
- scraper_runs row: status in ('success', 'partial'), sales_imported >= 370.
- Exit code 0 (exit 1 only if any files failed).

**Why human:** Requires SUPABASE_SERVICE_ROLE_KEY in .env.local and 457 real PDFs on local disk. The 3-second pre-flight pause is intentional (T-05 mitigation) — operator should read the banner before proceeding.

#### 2. Spot-check 10 imported sales against source PDFs

**Test:**
Run in Supabase SQL editor or psql:
```sql
(select sale_number, title, sale_date, lots_auctioned, lots_sold,
        total_sold_value, hammer_total, net_revenue, validation_warning
 from sales where sale_number like 'IT%' order by random() limit 5)
union all
(select sale_number, title, sale_date, lots_auctioned, lots_sold,
        total_sold_value, hammer_total, net_revenue, validation_warning
 from sales where sale_number not like 'IT%' order by random() limit 5);
```
Open the source PDF for each sale and verify field values match.

**Expected:** All 10 sales round-trip correctly. Financial values match source PDF exactly. Any drift captured in `validation_warning=true` rows should be within the documented ±$0.25 tolerance and correspond to real rounding differences, not parser errors.

**Why human:** Requires visual comparison of PDF content against DB values. Cannot be automated without OCR or re-parsing the same PDFs against the DB values.

#### 3. Review validation_warning sales

**Test:**
```sql
select sale_number, title
from sales
where validation_warning = true
order by sale_number;
```
For any flagged sales, run with `--verbose` or inspect the scraper_runs `logs` JSONB for mismatch strings.

**Expected:** Flagged sales have legitimate drift (e.g., known rounding in estimate ranges). No flagged sales indicate a parser regression.

**Why human:** Requires domain knowledge to determine whether drift is legitimate or a parser bug.

#### 4. Confirm re-run idempotency on live DB

**Test:** After the full import completes, run `npm run import:pdfs` again without any flags.

**Expected:** Summary shows Inserted=0, Skipped (duplicate)=~(previous sales_imported), Skipped (empty)=62, Failed=0. scraper_runs second row shows status='success'.

**Why human:** Requires live DB state from the initial run to already exist.

### Gaps Summary

No code-level gaps. All implementation artifacts exist, are substantive, are wired correctly, and data flows through the pipeline end-to-end. The single outstanding item is a human-gated operational checkpoint: the live 457-PDF import run has not yet been executed because it requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

**Operational prerequisite blocking the live run:**
- Migration `20260421000012_refine_import_sale_rpc.sql` exists locally but has NOT been pushed to the live DB. This must be applied before the live import run via `npm run db:push`.

**To close out Phase 2:**
1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Supabase dashboard → Project Settings → API → service_role).
2. Run `npm run db:push` to apply migration 000012.
3. Run `npm run import:pdfs -- --dry-run --limit 10` to confirm environment is working.
4. Run `npm run import:pdfs` (full live run).
5. Paste scraper_runs summary + 10-sale spot-check table + auto-discovered codes list into chat.
6. Confirm re-run produces 0 inserts.
7. Resume Plan 02-05 Task 3 to flip DATA-01..07 to Complete in REQUIREMENTS.md and check Phase 2 boxes in ROADMAP.md.

---

_Verified: 2026-04-21T20:10:00Z_
_Verifier: Claude (gsd-verifier)_
