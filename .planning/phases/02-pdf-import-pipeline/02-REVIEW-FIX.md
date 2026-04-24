---
phase: 02-pdf-import-pipeline
fixed_at: 2026-04-21T15:47:00Z
review_path: .planning/phases/02-pdf-import-pipeline/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-04-21T15:47:00Z
**Source review:** .planning/phases/02-pdf-import-pipeline/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01..WR-06; 0 Critical, 6 Warning)
- Fixed: 6
- Skipped: 0

No Critical findings existed; all 6 Warning findings were fixed. Info
findings (IN-01..IN-07) were out of scope for this pass (fix_scope =
critical_warning).

## Fixed Issues

### WR-01: parseMoneyRange treats "$30,000-0" as sentinel but silently coerces decimals

**Files modified:** `scripts/lib/parsers/numeric.ts`, `scripts/tests/numeric.test.ts`
**Commit:** 167eb12
**Applied fix:** Tightened the RFC no-upper-bound sentinel to require
`high === 0 && low > 0` specifically, instead of the prior `high < low
&& low > 0` which masked legitimate backwards ranges like
`$1,000-500`. Added a regression test pinning the new behavior
(`$1,000-500` now returns `{low: 1000, high: 500}` preserving the
data for downstream triage, rather than silently coercing high to
null as if it were a sentinel).

### WR-02: parseAuctionedLots computes `withdrawn` but never exposes it to the DB

**Files modified:** `scripts/lib/parsers/numeric.ts`
**Commit:** 2dfb7c8
**Applied fix:** Chose option (a) from the review — dropped the
`withdrawn?` field from the return shape entirely. The regex still
consumes the `(N Withdrawn)` suffix but no longer captures the
number, so the return type is unambiguous: `{ count: number | null }`.
A JSDoc comment now documents this as a deliberate v1 deferral and
explains the schema-migration scope required to re-introduce the
field if a future phase wants to preserve withdrawn counts.

Option (b) was rejected because it would require adding
`lots_withdrawn` columns to both the `sales` and `sale_departments`
tables (plus regenerating types), which is a larger scope than a
single Warning fix warrants and was not called out as a product
requirement.

### WR-03: crossValidate conflates null dept values with zero

**Files modified:** `scripts/lib/cross-validate.ts`, `scripts/tests/cross-validate.test.ts`
**Commit:** 2eb7c44
**Applied fix:** Added a per-column "hasNull" tracker computed once
alongside the sum reducer. Mismatch lines where any dept had a null
for that column are now prefixed with `(PARSE-GAP) `. Legitimate
arithmetic drift (no nulls involved) emits the untagged message
unchanged. Added two regression tests: one that verifies the tag
appears when all depts have null for `total_sold_value` but sale
claims $100k, and one that verifies the tag is absent on pure drift.
Refactored the reducer calls to go through helper closures
(`intCol`, `moneyCol`) so each column is walked once.

### WR-04: scraper_runs.sales_found is recorded pre-filter but logs/imported diverge

**Files modified:** `scripts/import-pdfs.ts`
**Commit:** 980c102
**Applied fix:** Three coupled changes (combining both option a and
option b from the review since they're small and complementary):

1. `sales_found = allFiles.length` (pre-limit) so it reflects the
   corpus size in the source directory, not this invocation's slice.
2. Added `processed` to the `logs` jsonb so the post-limit
   iterate-count is still recorded without overloading the top-level
   `sales_found` column.
3. Extracted a `buildErrorMessage` helper that includes failed +
   empty + duplicate counts in `scraper_runs.error_message` (not
   just failures), so an operator can distinguish "healthy
   idempotency replay" from "parse regression" at a glance.

### WR-05: supabaseAdmin throws at module load, poisoning any importer

**Files modified:** `scripts/import-pdfs.ts`
**Commit:** ebf0e4d
**Applied fix:** Chose option (a) from the review — log a verbose-mode
NOTE in the dry-run's previously-empty `catch {}` block. Operators
running with `--dry-run --verbose` now see why the admin module
failed to load (e.g., missing `SUPABASE_SERVICE_ROLE_KEY`) on stderr
with the caveat that live runs will still fail if the env is not
fixed.

Option (b) (converting supabase-admin to a factory function) was
rejected because it would change the contract of every caller
(import-sale.ts uses a top-level `import { supabaseAdmin }`) and is
a larger refactor than the single Warning warrants. The module-level
throw remains intact for the "loaded into browser" safety rail, and
the CLI's explicit env-var precheck already catches the common
live-run misconfiguration before the lazy load.

### WR-06: RPC auto-discovery ignores display_name when code already exists

**Files modified:** `supabase/migrations/20260421000011_import_sale_rpc.sql`
**Commit:** fc15187
**Applied fix:** Chose option (a) from the review — added an
`else` branch to the known-code path that UPDATEs `display_name` when
the stored value is still the placeholder (equal to `code`, as set
by the seed migration) AND the incoming value is non-null and
different. Rows where `display_name != code` are treated as
operator-curated and left alone.

Edited the migration file in place rather than adding a new
superseding migration because all Phase 2 migrations (009, 010, 011)
are only on this unpushed feature branch — editing keeps the history
clean for review. If this branch is ever rebased against a state
that has already pushed 011, a new migration with the UPDATE clause
should replace the in-place edit.

Option (b) (adding a `name_locked boolean` column) was noted but
rejected for v1 to avoid schema churn. A future phase can add
operator-curation tracking if/when the display-name editing workflow
lands.

## Verification

All fixes verified at three tiers:

- Tier 1: file re-read after Edit, confirmed intended text present
- Tier 2: `npx tsc --noEmit -p tsconfig.node.json` after each
  TypeScript change, `npx vitest --run` after every fix
- Tier 3 (final): `npx vitest --run` (96/96 passing), `npm run lint`
  (only pre-existing warning in `src/stores/authStore.ts`), `npm run
  build` (clean, 144 modules transformed)

No logic findings were present in this review pass, so no
`requires human verification` flag was needed. WR-03's (PARSE-GAP)
tag change has both positive and negative regression tests pinning
the new contract. WR-06's SQL change was verified by re-reading;
no pgTAP-style SQL test exists for this pathway (noted by the
reviewer as IN-06 item 4, explicitly out of scope for this fix
round).

---

_Fixed: 2026-04-21T15:47:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
