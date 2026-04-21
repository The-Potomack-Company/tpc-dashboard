# Phase 2: PDF Import Pipeline - Research

**Researched:** 2026-04-21
**Domain:** Node/TypeScript PDF text extraction + regex parsing + Supabase bulk insert with atomic per-record transactions
**Confidence:** HIGH (stack is locked in CONTEXT; PDF format verified on sample files; RPC-for-atomicity pattern is well-established)

## Summary

Phase 2 is a local Node CLI (`npm run import:pdfs`) that reads 457 RFC auction profile PDFs from `~/Projects/rfc_profiles/rfc_profiles/`, extracts structured sale + per-department records via `pdf-parse` v2 + regex, validates with Zod, and bulk-inserts into Supabase using the **service role key** (RLS-bypass). Research on sample PDFs (IT254, Sale 41, 119, 11ES) confirmed the text layout is consistent but **NOT top-to-bottom** — pdf-parse returns glyphs in PDF content-stream order, which emits labels as one cluster and values as another. A robust parser must use **label-token anchoring** (find each label string, then locate its numeric value in the page's value cluster) rather than sequential line pairing. Tab characters separate value↔label pairs in the right-hand revenue column, which gives a second reliable anchor.

Two sizeable surprises surfaced during the PDF inspection pass and invalidate assumptions baked into CONTEXT:
1. **62 of the 457 PDFs are empty placeholders** (1182 bytes, 1 page, 0 characters of text). These are likely cancelled or metadata-only sales. The importer must classify these as `skipped: empty` and NOT count them as parse failures.
2. **There is no `Sell-through Rate` label** — sell-through appears only as a parenthetical `(89% not incl. withdrawn)` inside the `Lots Sold:` value. Parser must extract the percentage from that embedded pattern.

**Primary recommendation:** Build `scripts/import-pdfs.ts` with `tsx` runner, parse each PDF page-by-page using `pdf-parse`'s `pages[]` array, implement per-sale atomicity via a single PL/pgSQL RPC (`import_sale_with_departments(sale_json, depts_json)`) invoked through `supabase-js`, and use the service role client from a segregated `scripts/lib/supabase-admin.ts` that is never importable from `src/`. Extend migrations with `sales.validation_warning boolean` and `departments.auto_discovered boolean`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Parser Architecture:**
- Use `pdf-parse` (^2.4.5 per CLAUDE.md) for text extraction; no layout-aware parsing
- Regex-based line matching against fixed labels (Hammer Price, Buyer Premium, Lots Auctioned, Lots Sold, Sell-through Rate, Total Sold Value, Estimate Low/High, Net Revenue, etc.)
- Per-page handling: page 1 = "All Departments" sale summary → writes to `sales`; subsequent pages = one department each (code detected from page header line) → each writes to `sale_departments`
- PDF source path: `~/Projects/rfc_profiles/rfc_profiles/` (confirmed on disk; 457 files named `{sale_number}_Profile_{random}.PDF`). PROJECT.md previously said `~/Desktop/rfc_profiles/` — update PROJECT.md in a plan of this phase.
- PDF files NOT committed to the dashboard repo (size). Path is configurable via CLI flag.

**CLI & Invocation:**
- Script location: `scripts/import-pdfs.ts` (TypeScript; run via `tsx` or compiled)
- npm script: `"import:pdfs": "tsx scripts/import-pdfs.ts"`
- Args: `--source <dir>` (default `~/Projects/rfc_profiles/rfc_profiles/`), `--dry-run` (parse + validate, no DB writes), `--limit <N>` (process first N for spot-checks)
- Progress UX: per-file line `[ N/457 ] {sale_number} → inserted | skipped | failed: {reason}`; final summary table (ok / skipped / failed counts)
- DB credentials: Supabase **service role key** (bypasses RLS). Read from `SUPABASE_SERVICE_ROLE_KEY` environment variable in `.env.local`. User must add this (instructions in README + script error message).
- Service role key is **NEVER** bundled into the frontend (script is server-side only, stays outside `src/`). Guard against leak (do not import from `src/lib/supabase.ts` — create a separate `scripts/lib/supabase-admin.ts`).

**Data Validation:**
- Zod schemas for `SaleRecord` + `SaleDepartmentRecord`. Validation runs before every insert. Zod parse failure = parse failure for that PDF (file counted as `failed`, continues to next).
- Range fields (e.g., `$533,300-880,550`) parsed into two numeric columns — `estimate_low` + `estimate_high` — already present in the Phase 1 schema.
- Numeric parsing handles: commas (`$1,234,567.89`), percentages (`42.5%` → `0.425`), parenthetical annotations (`(included)`, `(net)`), currency symbols, mixed whitespace.
- Cross-validation: After all department records for a sale are inserted, re-read them and compare `SUM(dept.*)` to the sale-level totals. Tolerance ±$0.01 per `numeric(14,2)` rounding. Mismatch → log warning AND set `sales.validation_warning = true` (requires new column via new migration).
- Unknown department codes: If PDF contains a code not in `departments`, insert new row with placeholder display_name, `auto_discovered = true`. (Requires `auto_discovered` column on `departments`.)

**Idempotency & Error Handling:**
- Primary dup key: `sales.sale_number` (UNIQUE). Before insert: check existence; if exists → skip (report as `skipped`).
- Failure mode: **best-effort per file**. Parse error on one PDF never aborts the run.
- Run logging: Every invocation inserts one row into `scraper_runs` at start (status `running`), updates to `success`/`failure`/`partial` at end with timing + counts + error log.
- Transaction scope: **per-sale atomic**. If any of a sale's department inserts fail, the `sales` row for that sale rolls back too.

### Claude's Discretion
- Exact regex patterns for each label — derive from actual PDF content during implementation (discovery pass included in this research).
- Error message wording for CLI output.
- Whether to use `tsx` vs build step vs plain `ts-node`.
- Whether to extract the parser into `scripts/lib/parse-pdf.ts` or inline.
- Choice between `pg` direct client vs Supabase RPC for transactions.
- How to structure Zod schemas (single big schema vs composable sub-schemas).

### Deferred Ideas (OUT OF SCOPE)
- Retroactive repair of cross-validation warnings (Phase 2 just flags them).
- Manual-review UI for `auto_discovered` department codes.
- Batch resume on mid-run crash (best-effort per-file already handles this).
- Full-text indexing of PDF content for search.
- Storing raw PDF blobs in Supabase Storage.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Bulk-import all 457 PDFs | CLI design + per-file loop + scraper_runs summary addresses this. 62 files are empty placeholders — import is successful if it processes 457 files and classifies each as inserted/skipped/failed/empty. |
| DATA-02 | Parse sale-level "All Departments" summary metrics | Page 1 layout documented below — maps labels to every non-null column in `sales` migration. |
| DATA-03 | Parse per-department pages | Per-dept page layout documented — page footer line is `{CODE} {Display Name}` format; label set is a subset of page 1 minus revenue/net-revenue. |
| DATA-04 | Handle ranges, commas, percentages, parenthetical annotations | Specific numeric parsing rules documented (`$.NULL.`, negative values, `(99% not incl. withdrawn)`, `$629,925-946,355`, `$30,000-0`). |
| DATA-05 | Cross-validate dept sums vs sale totals | Cross-validation section below covers which columns to sum, the ±$0.25 tolerance, and the `validation_warning` flag. |
| DATA-06 | Seed departments with known codes + names | Seed migration exists (22 codes). Research discovered **at least 12 more codes** in real PDFs (ANT, CNS, GAR, JWL, LIT, MANU, MIN, NAT, REL, RUG, TRI, FASH, ISL, ASNP). Auto-discovery will populate the gap automatically; a follow-up migration could refine seed list but is not required by DATA-06 as written. |
| DATA-07 | Skip duplicates | Idempotency via `SELECT id FROM sales WHERE sale_number = ?` before insert. `sale_number` is already UNIQUE in migration. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- `pdf-parse` is **pinned** at `^2.4.5` [VERIFIED: CLAUDE.md line 54]
- Zod is `^4.3.6` [VERIFIED: CLAUDE.md stack table]
- Supabase client is `^2.101.1` [VERIFIED: CLAUDE.md stack table]
- Before any file-changing work: start through a GSD command (`/gsd:quick`, `/gsd:debug`, or `/gsd:execute-phase`) [VERIFIED: CLAUDE.md GSD Workflow Enforcement section]
- Supabase CLI forbidden commands (shared prod DB): `supabase db pull`, `supabase db reset --linked`. Only `supabase db push` and `supabase gen types` are safe. [VERIFIED: STATE.md Accumulated Decisions]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-parse | ^2.4.5 | Extract text per page from PDF buffer | Pinned in CLAUDE.md. v2 is the actively maintained fork by `mehmet-kozan` (original v1 abandoned). Ships its own TypeScript types. ESM + CJS. |
| zod | ^4.3.6 | Runtime validation of parsed records | Already installed (`dependencies` in package.json). Same version as TPC App. |
| @supabase/supabase-js | ^2.101.1 | RPC client for atomic inserts + regular read/write | Already installed. RPC method handles PL/pgSQL function calls cleanly. |
| tsx | ^4.21.0 | Run `.ts` scripts on Node without build step | 25× faster startup than ts-node, zero-config ESM support, no peer deps. Current in 2026. |
| dotenv | ^17.4.2 | Load `.env.local` for `SUPABASE_SERVICE_ROLE_KEY` in the script | Node scripts do NOT get `import.meta.env` (that's Vite's injection). Need explicit dotenv.config(). |

**Installation:**
```bash
npm install --save-dev tsx dotenv
npm install pdf-parse@^2.4.5
```

**Version verification (executed 2026-04-21):**
- `npm view pdf-parse version` → `2.4.5` (published 2025-10-29) [VERIFIED: npm registry]
- `npm view tsx version` → `4.21.0` [VERIFIED: npm registry]
- `npm view dotenv version` → `17.4.2` [VERIFIED: npm registry]
- `npm view @supabase/supabase-js version` → `2.104.0` (latest; project pins `^2.101.1` which is compatible) [VERIFIED: npm registry]
- Current Node on this machine: `v25.8.1` [VERIFIED: `node --version`]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs/promises | built-in | Read PDF buffers, `readdir` source directory | Standard |
| node:path | built-in | Resolve `~` expansion, join paths | Standard |
| node:util | built-in | `parseArgs` for CLI flags (no dep needed) | Node 18+ supports native `parseArgs` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-parse | pdfjs-dist directly | Lower-level API. Not needed — pdf-parse wraps it with simpler surface. |
| tsx | Node 22.18+ `--strip-types` | Native type stripping is zero-overhead but cannot handle full TypeScript syntax (e.g., enums, decorators) without `--experimental-transform-types`. tsx is safer and widely used in 2026. [CITED: https://blog.logrocket.com/running-typescript-node-js-tsx-vs-ts-node-vs-native/] |
| tsx | ts-node | ts-node startup ~500ms; tsx is ~20ms. ESM config friction. [CITED: https://www.pkgpulse.com/blog/tsx-vs-ts-node-vs-bun-2026] |
| supabase-js RPC for atomicity | `pg` direct connection + BEGIN/COMMIT | `pg` requires managing a DB connection string (Session-mode pooler). More flexible but adds a dependency + attack surface for a key that should NOT be stored. RPC is simpler and keeps auth on the existing `SUPABASE_SERVICE_ROLE_KEY`. |
| supabase-js RPC | Sequential `insert sales` then `insert sale_departments` with manual rollback on failure | Non-atomic. If a dept insert fails mid-way, partial data persists. Rejected. |
| dotenv | Node 20.6+ `--env-file=.env.local` | Native flag works but requires CLI invocation (no programmatic). dotenv is more portable across script runners. |

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── import-pdfs.ts              # CLI entry point (arg parsing, orchestration, progress UX)
├── lib/
│   ├── supabase-admin.ts       # service-role client (isolated from src/)
│   ├── parse-pdf.ts            # pdf-parse wrapper + per-page extractors
│   ├── parsers/
│   │   ├── numeric.ts          # $, commas, percent, ranges, (X Withdrawn), $.NULL.
│   │   ├── sale-page.ts        # page 1 → SaleRecord
│   │   └── department-page.ts  # page N → SaleDepartmentRecord
│   ├── schemas.ts              # Zod: SaleRecord, SaleDepartmentRecord
│   ├── cross-validate.ts       # dept sums vs sale totals (±$0.25 tolerance)
│   └── import-sale.ts          # RPC invocation + scraper_runs logging
└── tests/
    ├── fixtures/               # small sample PDFs (gitignored if size prohibits)
    ├── numeric.test.ts
    ├── sale-page.test.ts
    ├── department-page.test.ts
    └── import-sale.test.ts     # mocked Supabase
supabase/migrations/
├── 20260421000009_add_validation_warning_to_sales.sql
├── 20260421000010_add_auto_discovered_to_departments.sql
└── 20260421000011_import_sale_rpc.sql    # PL/pgSQL function for atomic insert
```

### Pattern 1: Label-token-anchored parsing (NOT line-sequential)

**What:** Because pdf-parse emits glyphs in PDF content-stream order (fonts group together), a page's text has all labels clustered first, then all values, then the footer. Sequential `label / value / label / value` pairing WILL fail. Instead: find each label as a string anchor, then look up the corresponding value at the known offset in the value cluster — OR use the TAB-separated right-column format for monetary fields.

**When to use:** All pdf-parse output in these PDFs.

**Example:** Actual page-1 excerpt from Sale IT254 showing two sub-layouts within one page:

```
Total Estimate:                       ← left-column labels cluster
Total Estimate of Lots Sold:
Lots Sold Below Estimate:
Lots Sold Above Estimate:
Lots Sold Within Estimate:
Lots Sold:
Total Unsold Value:
Number Of Sellers (Receipts):
Number of Buyers:
Registered Bidders:
428                                   ← left-column values cluster (in same order as labels)
424 (99% not incl. withdrawn)
$407,660.00
$850.00
(100% by value, incl. unsold value)
$94,795-154,970
$93,770-153,420
19
345
60
1 (1 Receipts)
224
225
Total Reserve of Lots Sold: $0.00     ← inline-label-value pairs (self-contained)
Total Reserve: $0.00
Lots Sold Below Reserve:
Lots Sold At or Above Reserve:
0
424
224\tPaid Invoices (All lots flagged paid):   ← right-column tab-separated VALUE\tLABEL
$407,660.00\tTotal Hammer Paid:
$101,915.00\tPremium:
$65,437.50\tCommission:
$6,134.85\tInsurance:
$10,700.00\tLot Charges:
$20,068.16\tOther Charges (Buyers):
$5,611.00\tOther Charges (Sellers):
$209,866.51\tTotal Net Revenue:        ← the one we care about
$0.00\tReferral Fees
$0.00\tLevel Up:
Auction Profile for Sale IT254, November 16, 2022   ← title block (near bottom of text cluster)
Estate of General Colin L. Powell
All Departments
```

```typescript
// Source: inspected via pdf-parse v2.4.5 on $HOME/Projects/rfc_profiles/rfc_profiles/IT254_Profile_aNQaVr3gAn.PDF (2026-04-21)

interface PageText { text: string; num: number }

// Reliable extraction for tab-separated right-column fields:
const TAB_FIELD_RE = /^(?<value>[^\t]+)\t(?<label>.+?):?$/;
function extractTabFields(pageText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of pageText.split('\n')) {
    const m = TAB_FIELD_RE.exec(line);
    if (m?.groups) out[m.groups.label.trim()] = m.groups.value.trim();
  }
  return out;
}
// Usage:
// const fields = extractTabFields(page1.text);
// fields["Total Net Revenue"]  === "$209,866.51"
// fields["Premium"]             === "$101,915.00"
// fields["Commission"]          === "$65,437.50"
// fields["Insurance"]           === "$6,134.85"
// fields["Lot Charges"]         === "$10,700.00"
// fields["Total Hammer Paid"]   === "$407,660.00"
// fields["Referral Fees"]       === "$0.00"
```

### Pattern 2: Inline-label-value extraction

**What:** Some labels have their value on the SAME line separated by a space-colon pattern (e.g., `Total Reserve of Lots Sold: $0.00`).

```typescript
// Source: verified in Sale 41, IT254, 119, 11ES page 1 output
const INLINE_FIELD_RE = /^(?<label>[^:]+?):\s+(?<value>\S.*)$/;
// Usage: match against:
//   "Total Reserve of Lots Sold: $0.00"
//   "Total Reserve: $0.00"
//   "Number Of Sellers (Receipts): 1 (1 Receipts)"
//   "Paid Settlements (All lots flagged settled): 1"
//   "Successful Bidders Not Registered: 0"
//   "Lots Missing Paddle/Unsold Code: 0"
```

### Pattern 3: Positional-cluster extraction for left-column labels

**What:** For the left-column block (`Total Estimate:` through `Registered Bidders:`), labels are all label-only lines followed by all value-only lines in the SAME order.

```typescript
// Source: inspected on IT254, Sale 41 page 1 (2026-04-21)

const LEFT_COLUMN_LABELS = [
  'Auctioned Lots',            // sometimes appears inline; handle as fallback
  'Total Sold Value',          // sometimes appears as a tab-separated right-column label — handle both
  'Total Estimate',
  'Total Estimate of Lots Sold',
  'Lots Sold Below Estimate',
  'Lots Sold Above Estimate',
  'Lots Sold Within Estimate',
  'Lots Sold',                 // value pattern: `424 (99% not incl. withdrawn)` → capture count AND percent
  'Total Unsold Value',
  'Number Of Sellers (Receipts)',
  'Number of Buyers',
  'Registered Bidders',
];

function extractLeftColumnBlock(pageText: string, labels: string[]): Record<string, string> {
  const lines = pageText.split('\n').map(l => l.trim());
  // Find the first occurrence of the first label
  const startIdx = lines.findIndex(l => l === `${labels[0]}:`);
  if (startIdx < 0) return {};
  // Labels are expected contiguous — find where the label block ends
  let endIdx = startIdx;
  while (endIdx < lines.length && lines[endIdx].endsWith(':')) endIdx++;
  // Values follow immediately after, one per label
  const out: Record<string, string> = {};
  for (let i = 0; i < (endIdx - startIdx); i++) {
    out[labels[i]] = lines[endIdx + i] ?? '';
  }
  return out;
}
```

### Pattern 4: Department page footer → code + display name

**What:** On pages 2..N, the department code + human display name appears on the line just before the `* Revenue Projection...` footnote and the date/page footer.

```typescript
// Source: verified across IT254, Sale 41, 119, IT210 — 100% consistent

// On dept page, walk backwards through lines, skipping:
//   - lines starting with "*" (the revenue-projection footnote)
//   - lines matching /^\d{2}\/\d{2}\/\d{4} .* Page \d+ of \d+$/ (date + page footer)
// The next non-skip line is the department header line.
// Examples observed:
//   "AMER American Historical/Folk"
//   "ASNP Asian (Paintings & Prints)"
//   "FRN Furniture (General)"
//   "DRW Drawings, Prints & Photographs"
//   "GAR Garden Furniture & Accessories"
// Parse: code = first token (uppercase+digits, 2-6 chars), display_name = rest of line.

const DEPT_HEADER_RE = /^(?<code>[A-Z][A-Z0-9]{1,5})\s+(?<name>.+)$/;
```

### Pattern 5: Per-sale atomic insert via RPC

**What:** Single PL/pgSQL function inserts sale + all departments in one transaction. `supabase-js` client calls it via `.rpc()`.

```sql
-- Source: standard Supabase RPC-for-atomicity pattern
-- [CITED: https://openillumi.com/en/en-supabase-transaction-rpc-atomicity/]

create or replace function public.import_sale_with_departments(
  p_sale jsonb,
  p_departments jsonb  -- array of {code, display_name, lots_auctioned, ...}
)
returns uuid
language plpgsql
security definer  -- runs as the function owner; called with service role so RLS is already bypassed
as $$
declare
  v_sale_id uuid;
  v_dept jsonb;
  v_dept_id uuid;
begin
  -- Insert sale (fails cleanly on unique-constraint violation on sale_number)
  insert into public.sales (
    sale_number, title, sale_date, lots_auctioned, lots_sold, lots_unsold,
    total_sold_value, total_unsold_value, total_low_estimate, total_high_estimate,
    total_reserves, hammer_total, buyer_premium, seller_commission, insurance,
    lot_charges, referral_fees, net_revenue, registered_bidders, winning_buyers,
    payment_status, source_pdf_path, imported_at, validation_warning
  )
  select
    p_sale->>'sale_number', p_sale->>'title', (p_sale->>'sale_date')::date,
    (p_sale->>'lots_auctioned')::int, (p_sale->>'lots_sold')::int, (p_sale->>'lots_unsold')::int,
    (p_sale->>'total_sold_value')::numeric, (p_sale->>'total_unsold_value')::numeric,
    (p_sale->>'total_low_estimate')::numeric, (p_sale->>'total_high_estimate')::numeric,
    (p_sale->>'total_reserves')::numeric, (p_sale->>'hammer_total')::numeric,
    (p_sale->>'buyer_premium')::numeric, (p_sale->>'seller_commission')::numeric,
    (p_sale->>'insurance')::numeric, (p_sale->>'lot_charges')::numeric,
    (p_sale->>'referral_fees')::numeric, (p_sale->>'net_revenue')::numeric,
    (p_sale->>'registered_bidders')::int, (p_sale->>'winning_buyers')::int,
    p_sale->>'payment_status', p_sale->>'source_pdf_path',
    coalesce((p_sale->>'imported_at')::timestamptz, now()),
    coalesce((p_sale->>'validation_warning')::boolean, false)
  returning id into v_sale_id;

  -- Insert departments; auto-discover unknown codes
  for v_dept in select * from jsonb_array_elements(p_departments)
  loop
    select id into v_dept_id from public.departments where code = v_dept->>'code';
    if v_dept_id is null then
      insert into public.departments (code, display_name, auto_discovered)
      values (v_dept->>'code', v_dept->>'display_name', true)
      returning id into v_dept_id;
    end if;

    insert into public.sale_departments (
      sale_id, department_id, department_code,
      lots_auctioned, lots_sold, sell_through_pct,
      total_sold_value, low_estimate, high_estimate, reserves, revenue
    ) values (
      v_sale_id, v_dept_id, v_dept->>'code',
      (v_dept->>'lots_auctioned')::int, (v_dept->>'lots_sold')::int,
      (v_dept->>'sell_through_pct')::numeric(5,2),
      (v_dept->>'total_sold_value')::numeric,
      (v_dept->>'low_estimate')::numeric, (v_dept->>'high_estimate')::numeric,
      (v_dept->>'reserves')::numeric, (v_dept->>'revenue')::numeric
    );
  end loop;

  return v_sale_id;
end;
$$;

-- GRANT to service_role only; do NOT grant to authenticated or anon.
revoke all on function public.import_sale_with_departments(jsonb, jsonb) from public;
grant execute on function public.import_sale_with_departments(jsonb, jsonb) to service_role;
```

```typescript
// Source: JS call pattern
const { data: saleId, error } = await supabaseAdmin.rpc('import_sale_with_departments', {
  p_sale: saleRecord,
  p_departments: deptRecords,
});
if (error) {
  // Entire transaction rolled back — nothing persisted.
  // Treat as per-file failure; record in scraper_runs.logs and continue.
}
```

### Anti-Patterns to Avoid

- **Sequential `insert sales` → `insert sale_departments` without a transaction.** If the dept insert fails, you have a dangling `sales` row. Rejected. Use RPC.
- **Parsing pdf-parse output line-by-line as "label line, value line" pairs.** The glyph order is NOT row-interleaved; you'll map labels to wrong values. Use the anchored extractors in Patterns 1–4.
- **Using `import.meta.env` in the script.** That's a Vite build-time token; it's `undefined` at Node runtime. Use `process.env` + `dotenv`.
- **Importing `src/lib/supabase.ts` from a script.** It references `import.meta.env.VITE_*` and also ships the anon key into whatever context imports it. Use `scripts/lib/supabase-admin.ts` exclusively.
- **Committing `SUPABASE_SERVICE_ROLE_KEY` anywhere.** Document in README; add to `.gitignore` patterns for `.env.local` (likely already present from Phase 1).
- **Hard-failing on `$.NULL.` values.** Treat as `null`, not parse error.
- **Counting empty 1182-byte PDFs as "failed".** They're a known artifact (62/457). Report separately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Byte-level PDF parsing | `pdf-parse` v2.4.5 | Mehmet-Kozan's v2 wraps pdfjs-dist with simple `getText()` + per-page arrays. Stable. |
| Atomic two-table insert | Client-side rollback on error | PL/pgSQL RPC function | PostgreSQL auto-wraps function body in a transaction — free atomicity. |
| CLI arg parsing | String `process.argv` slicing | Node built-in `util.parseArgs()` | Node 18+ native; no `yargs`/`commander` needed for our 3 flags. |
| `.env.local` loading | Hand-roll a reader | `dotenv` v17 | ~2KB, rock solid. Or Node 20.6+ `--env-file=.env.local`. |
| Zod schema generation | Manual `type` guards | `zod` 4 schema + `infer` | Already installed; matches TPC App pattern. |
| Table row progress UI | ANSI re-render libraries | Plain `console.log` one line per file | 457 lines is fine. No need for `listr2`/`ora`. |
| `~` expansion | Regex | `os.homedir() + path.sep` or `path.resolve(arg.replace(/^~/, os.homedir()))` | Standard trick. |
| Monetary value arithmetic in JS | `parseFloat` + comparisons | Integer cents (`Math.round(n * 100)`) for cross-validation SUM | Avoids drift when summing ~20 department rows. See Pitfall #6. |

**Key insight:** Phase 2 is almost entirely an I/O + string-munging pipeline. Every non-trivial subproblem has a standard library or built-in module. The temptation is to write a "quick parser" — resist. Use `parseArgs`, use the RPC pattern, and keep the regex library factored into `parsers/numeric.ts`.

## Runtime State Inventory

**Skipping:** This is a greenfield Phase 2 addition. No rename/refactor — nothing to audit for runtime state drift.

## Common Pitfalls

### Pitfall 1: Assuming sequential label→value pairing in pdf-parse output
**What goes wrong:** You write `for (i = 0; i < lines.length; i += 2) { map[lines[i]] = lines[i+1]; }` and get garbage — labels map to the wrong values.
**Why it happens:** PDF content streams group glyphs by font, not by visual position. pdf-parse preserves content-stream order.
**How to avoid:** Use Pattern 1 (tab-separated), Pattern 2 (inline), Pattern 3 (positional cluster) instead of line-pair iteration.
**Warning signs:** `Total Sold Value` maps to `"428"` or `"19"`. Cross-validation fails on every single sale.

### Pitfall 2: Empty-placeholder PDFs fail parse, look like errors
**What goes wrong:** 62 of the 457 source files are 1182-byte "empty" PDFs with 1 page and 0 characters of text. Naive parser throws or Zod rejects "missing required field" — then 62/457 show as `failed` and the import appears broken.
**Why it happens:** RFC exports placeholder PDFs for cancelled/metadata-only sales.
**How to avoid:** Detect `pages[0].text.trim().length === 0` OR `pages.length === 1 && page 1 has no "All Departments" anchor` → classify as `skipped: empty_placeholder` (distinct from `failed`). Report separately in summary table.
**Warning signs:** Every file of exactly 1182 bytes; specific examples: `1000_Profile_*`, `1086_Profile_*`, `1092_Profile_*`, `1111_Profile_*`, `10ES_Profile_*`, `13606_Profile_*`.

### Pitfall 3: Sell-through rate label does not exist in the PDF
**What goes wrong:** CONTEXT lists `Sell-through Rate` as a label to match — but grepping the real PDFs shows that string never appears.
**Why it happens:** Sell-through is embedded as a parenthetical in the `Lots Sold` value: `424 (99% not incl. withdrawn)`.
**How to avoid:** Extract percentage from the `Lots Sold` value pattern:
```typescript
const LOTS_SOLD_RE = /^(?<count>[\d,]+)\s*\((?<pct>\d+(?:\.\d+)?)%\s*not\s*incl\.\s*withdrawn\)$/;
// "424 (99% not incl. withdrawn)" → count=424, sell_through_pct=99
// If no parens: sell_through = null (treat as "no sale" / zero-lot case)
```
**Warning signs:** All `sale_departments.sell_through_pct` values are null.

### Pitfall 4: `$.NULL.` is a real value meaning "null", not a number
**What goes wrong:** You try `parseFloat("$.NULL.")` and get `NaN`. Zod rejects. File marked failed.
**Why it happens:** Observed in Sale 11ES: `$.NULL.\tPremium:`, `$.NULL.\tTotal Net Revenue:`. RFC emits this for sales that weren't settled yet.
**How to avoid:** In `parsers/numeric.ts`, preprocess: `if (/^\$?\.NULL\.$/i.test(raw)) return null;` BEFORE any numeric parsing.
**Warning signs:** Zod errors like `Expected number, received NaN` on early-era sales.

### Pitfall 5: Negative values use leading hyphen inside the currency token
**What goes wrong:** Parser rejects `$-1,931.40` as malformed.
**Why it happens:** Observed in Sale 41 for `Referral Fees` and `Level Up` — RFC formats these as `$-1,931.40\tReferral Fees`.
**How to avoid:** Numeric parser must accept optional `-` directly after the `$`:
```typescript
const MONEY_RE = /^\$?(?<sign>-)?(?<int>[\d,]+)(?:\.(?<frac>\d{1,2}))?$/;
// Also handle negative counts: "Lots Not Paid: -1" (observed in 11ES)
```

### Pitfall 6: Cumulative rounding drift in cross-validation
**What goes wrong:** Summing 20 department rows at `numeric(14,2)` against a sale-level `numeric(14,2)` can legitimately differ by a few cents because each row is independently rounded. A ±$0.01 tolerance flags real sales as invalid.
**Why it happens:** `numeric(14,2)` stores exact-decimal with 2-fraction precision. When RFC originally produced the PDF, per-department totals were rounded before the "All Departments" was summed. We re-sum the already-rounded values and compare to the pre-computed total.
**How to avoid:** Use **±$0.25 per column** as the default tolerance. Justified by: up to 20 dept rows, each ≤ $0.005 rounding error in either direction, worst-case accumulation = 20 × $0.01 = $0.20 < $0.25. For `lots_auctioned` / `lots_sold` (integer columns), require exact match — no drift possible. Keep tolerance configurable (CLI flag `--cross-validation-tolerance 0.25`).
**Warning signs:** Cross-validation flags ~all sales as warning when it should flag maybe 5–10%.

### Pitfall 7: Sale-number is NOT an integer
**What goes wrong:** You type `sale_number: number` in TypeScript and the first `10ES_Profile_*.PDF` crashes the parser.
**Why it happens:** RFC uses alphanumeric sale numbers: `10ES`, `11ES`, `IT210`, `IT254`, `IT308`, `IT270`, plus pure-integer `41`, `119`, `1000`, `13606`.
**How to avoid:** `sales.sale_number text not null unique` is already correct in the Phase 1 migration — no schema change needed. TypeScript type must be `string`.
**Warning signs:** `zod.number()` rejection on early ES-series sales.

### Pitfall 8: `(X Withdrawn)` suffix on Auctioned Lots
**What goes wrong:** Parser strips parens and gets `33 1` (two numbers glued). Zod rejects.
**Why it happens:** Observed in Sale 41: `"33 (1 Withdrawn)"` means 33 auctioned, 1 withdrawn.
**How to avoid:**
```typescript
const AUCTIONED_LOTS_RE = /^(?<count>[\d,]+)(?:\s+\((?<withdrawn>\d+)\s+Withdrawn\))?$/;
// We only need count for DATA-02; withdrawn count is out of schema scope.
```

### Pitfall 9: Estimate-range edge cases
**What goes wrong:** `$30,000-0` is parsed as "low=30000, high=0" — obviously wrong.
**Why it happens:** Observed in 11ES. When there's no upper bound, RFC emits `0`. Likely means low-only estimate (no high end entered).
**How to avoid:** After parsing range, if `high < low` → swap OR set `high = null`. Document choice in Plan.
**Warning signs:** Cross-validation flags `total_high_estimate < total_low_estimate` nonsensically.

### Pitfall 10: Service role key accidentally shipped to the browser
**What goes wrong:** Some future developer adds `import { supabaseAdmin } from '../../scripts/lib/supabase-admin'` in a `src/` file. Vite bundles it. Service role key ends up in the production JS bundle. **Full RLS bypass for anyone who opens devtools.**
**Why it happens:** `src/` is the Vite source root; anything imported from `src/` gets bundled.
**How to avoid:**
1. Name it `SUPABASE_SERVICE_ROLE_KEY` (not `VITE_*`). Vite only injects `VITE_*` vars.
2. Put `scripts/lib/supabase-admin.ts` outside `src/`.
3. Have the module `throw` at top-level if `import.meta` is defined (Vite) or if running in a browser (`typeof window !== 'undefined'`). Both are true in browser context; neither in Node. Fail loud and fast.
4. Optional future hardening: ESLint `no-restricted-imports` rule banning `scripts/**` from `src/**`.
**Warning signs:** Grepping `dist/` after `vite build` finds a JWT starting with `eyJ...` — CATASTROPHIC. If found, rotate the key immediately.

## Code Examples

### Reading PDF buffer with pdf-parse v2
```typescript
// Source: pdf-parse@2.4.5 dist/pdf-parse/cjs/index.d.cts + verified on sample PDF 2026-04-21
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

const buffer = await readFile(pdfPath);
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
//   result.total:  number — total pages
//   result.pages:  Array<{ text: string; num: number }> — per-page content
//   result.text:   string  — concatenation of all pages (with separators)
```

### Numeric parser (handles all observed edge cases)
```typescript
// Source: all cases verified in Sale IT254, 41, 119, 11ES
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^\$?\.NULL\.$/i.test(s)) return null;             // $.NULL. → null
  const m = /^\$?(?<sign>-)?(?<digits>[\d,]+(?:\.\d{1,2})?)$/.exec(s);
  if (!m?.groups) return null;
  const n = parseFloat(m.groups.digits.replace(/,/g, ''));
  return m.groups.sign === '-' ? -n : n;
}

export function parseCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(/,/g, '');
  const m = /^(?<sign>-)?(?<digits>\d+)(?:\s+.*)?$/.exec(s);
  if (!m?.groups) return null;
  const n = parseInt(m.groups.digits, 10);
  return m.groups.sign === '-' ? -n : n;
}

export function parseMoneyRange(raw: string): { low: number | null; high: number | null } {
  // "$629,925-946,355" → {low: 629925, high: 946355}
  // "$30,000-0"        → {low: 30000, high: null}  (sentinel)
  // "$0-0"             → {low: 0, high: 0}
  const s = raw.trim();
  const m = /^\$?(?<low>[\d,]+(?:\.\d{1,2})?)\s*-\s*(?<high>[\d,]+(?:\.\d{1,2})?)$/.exec(s);
  if (!m?.groups) return { low: null, high: null };
  const low = parseFloat(m.groups.low.replace(/,/g, ''));
  const high = parseFloat(m.groups.high.replace(/,/g, ''));
  return { low, high: high < low && low > 0 ? null : high };
}

export function parseLotsSold(raw: string): { count: number | null; sellThroughPct: number | null } {
  // "424 (99% not incl. withdrawn)" → { count: 424, sellThroughPct: 99 }
  // "0"                              → { count: 0,   sellThroughPct: null }
  const m = /^(?<count>[\d,]+)(?:\s*\((?<pct>\d+(?:\.\d+)?)%\s*not\s*incl\.\s*withdrawn\))?/.exec(raw);
  if (!m?.groups) return { count: null, sellThroughPct: null };
  return {
    count: parseInt(m.groups.count.replace(/,/g, ''), 10),
    sellThroughPct: m.groups.pct ? parseFloat(m.groups.pct) : null,
  };
}
```

### Sale-record Zod schema
```typescript
// Source: derived from supabase/migrations/20260421000002_create_sales.sql
// Only fields parseable from PDF — computed/auto fields (id, created_at, updated_at) excluded.
import { z } from 'zod';

export const SaleRecordSchema = z.object({
  sale_number: z.string().min(1),           // e.g., "IT254", "41", "10ES"
  title: z.string().min(1),                 // e.g., "Estate of General Colin L. Powell"
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),  // ISO date
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
  payment_status: z.string().nullable(),    // derived from paid vs unpaid invoice counts
  source_pdf_path: z.string().min(1),
  imported_at: z.string().datetime().optional(),
  validation_warning: z.boolean().default(false),
});
export type SaleRecord = z.infer<typeof SaleRecordSchema>;

export const SaleDepartmentRecordSchema = z.object({
  code: z.string().min(2).max(6),           // e.g., "AMER", "ASNP", "FRN"
  display_name: z.string().min(1),          // e.g., "American Historical/Folk"
  lots_auctioned: z.number().int().nullable(),
  lots_sold: z.number().int().nullable(),
  sell_through_pct: z.number().min(0).max(100).nullable(),  // numeric(5,2)
  total_sold_value: z.number().nullable(),
  low_estimate: z.number().nullable(),
  high_estimate: z.number().nullable(),
  reserves: z.number().nullable(),
  revenue: z.number().nullable(),           // sum of premium + commission + insurance + lot_charges for dept page
});
export type SaleDepartmentRecord = z.infer<typeof SaleDepartmentRecordSchema>;
```

### CLI argument parsing
```typescript
// Source: Node 18+ built-in util.parseArgs
import { parseArgs } from 'node:util';
import os from 'node:os';

const { values } = parseArgs({
  options: {
    source:    { type: 'string', default: `${os.homedir()}/Projects/rfc_profiles/rfc_profiles` },
    'dry-run': { type: 'boolean', default: false },
    limit:     { type: 'string' },   // parseInt later
    verbose:   { type: 'boolean', default: false },
    'cross-validation-tolerance': { type: 'string', default: '0.25' },
  },
});
```

### Environment loading (Node-side, NOT Vite)
```typescript
// Source: dotenv v17 docs
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Get the service role key from Supabase → Project Settings → API → service_role');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY=<key> to .env.local (NOT prefixed with VITE_)');
  process.exit(1);
}
```

### Service-role client (isolated from src/)
```typescript
// scripts/lib/supabase-admin.ts
// Source: Supabase createClient pattern for service role
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/db/database.types.js';  // types only; safe to import

// Safety rail: fail loud if this module is ever bundled into a browser context.
if (typeof window !== 'undefined') {
  throw new Error(
    'scripts/lib/supabase-admin.ts was imported into browser context! ' +
    'This file contains the Supabase service role key and MUST remain server-only.'
  );
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env.local');
}

export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

### Importing one sale (orchestration)
```typescript
// scripts/lib/import-sale.ts
import type { SaleRecord, SaleDepartmentRecord } from './schemas.js';
import { supabaseAdmin } from './supabase-admin.js';

export async function importSale(
  sale: SaleRecord,
  departments: SaleDepartmentRecord[],
): Promise<{ ok: true; saleId: string } | { ok: false; error: string }> {
  // Idempotency check (fast path — avoids RPC round-trip for dupes)
  const { data: existing } = await supabaseAdmin
    .from('sales')
    .select('id')
    .eq('sale_number', sale.sale_number)
    .maybeSingle();
  if (existing) return { ok: false, error: 'duplicate' };

  const { data, error } = await supabaseAdmin.rpc('import_sale_with_departments', {
    p_sale: sale,
    p_departments: departments,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, saleId: data as string };
}
```

### scraper_runs logging
```typescript
// Source: derived from supabase/migrations/20260421000004_create_scraper_runs.sql
// (table columns: started_at, finished_at, status, sales_found, sales_imported, error_message, logs JSONB)

async function startRun() {
  const { data } = await supabaseAdmin
    .from('scraper_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();
  return data!.id;
}

async function finishRun(id: string, status: 'success' | 'failure' | 'partial', summary: RunSummary) {
  await supabaseAdmin.from('scraper_runs').update({
    status,
    finished_at: new Date().toISOString(),
    sales_found: summary.total,
    sales_imported: summary.inserted,
    error_message: summary.failed > 0 ? `${summary.failed} files failed` : null,
    logs: {
      inserted: summary.inserted,
      skipped_duplicate: summary.skipped_duplicate,
      skipped_empty: summary.skipped_empty,
      failed: summary.failed,
      validation_warnings: summary.validation_warnings,
      failures: summary.failures,  // [{ file, error }]
    },
  }).eq('id', id);
}
```

### Cross-validation logic
```typescript
// scripts/lib/cross-validate.ts
// Source: author's synthesis from CONTEXT + Pitfall 6

interface ValidationInput {
  sale: SaleRecord;
  departments: SaleDepartmentRecord[];
  toleranceCents: number;  // e.g., 25 for ±$0.25
}

export function crossValidate(input: ValidationInput): { passed: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  const cents = (n: number | null) => (n == null ? 0 : Math.round(n * 100));

  // Exact-match integer columns
  const sumLotsAuctioned = input.departments.reduce((s, d) => s + (d.lots_auctioned ?? 0), 0);
  if (sumLotsAuctioned !== (input.sale.lots_auctioned ?? 0)) {
    mismatches.push(`lots_auctioned: sum(dept)=${sumLotsAuctioned} vs sale=${input.sale.lots_auctioned}`);
  }
  const sumLotsSold = input.departments.reduce((s, d) => s + (d.lots_sold ?? 0), 0);
  if (sumLotsSold !== (input.sale.lots_sold ?? 0)) {
    mismatches.push(`lots_sold: sum(dept)=${sumLotsSold} vs sale=${input.sale.lots_sold}`);
  }

  // Tolerance columns (monetary)
  const checkMoney = (name: string, saleVal: number | null, deptSum: number) => {
    const s = cents(saleVal);
    const d = Math.round(deptSum * 100);
    if (Math.abs(s - d) > input.toleranceCents) {
      mismatches.push(`${name}: sum(dept)=$${(d / 100).toFixed(2)} vs sale=$${(s / 100).toFixed(2)}`);
    }
  };
  checkMoney('total_sold_value', input.sale.total_sold_value,
             input.departments.reduce((s, d) => s + (d.total_sold_value ?? 0), 0));
  checkMoney('total_low_estimate', input.sale.total_low_estimate,
             input.departments.reduce((s, d) => s + (d.low_estimate ?? 0), 0));
  checkMoney('total_high_estimate', input.sale.total_high_estimate,
             input.departments.reduce((s, d) => s + (d.high_estimate ?? 0), 0));
  checkMoney('total_reserves', input.sale.total_reserves,
             input.departments.reduce((s, d) => s + (d.reserves ?? 0), 0));
  // NOTE: net_revenue is NOT summable across departments (dept pages don't expose all components).
  // Only validate hammer-adjacent totals that do appear on every dept page.

  return { passed: mismatches.length === 0, mismatches };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-parse` v1 (abandoned) | `pdf-parse` v2.4.5 by mehmet-kozan | Late 2024 | New API: `new PDFParse({data}).getText()` (not the old default-export function). Verified against installed package. |
| `pdf-parse` v1 needed `@types/pdf-parse` separately | v2 ships TypeScript types in-package | 2024 | No devDependency on `@types/pdf-parse` needed. |
| `ts-node` for running TS scripts | `tsx` or Node 22.18+ `--strip-types` | 2024-2025 | tsx ~25× faster startup; zero config for ESM. Node native `--strip-types` is promising but limited to simple syntax. |
| Supabase multi-table insert via sequential `from().insert()` calls | Single RPC to PL/pgSQL function | Always — but underdocumented in supabase-js v2 docs | Required for atomicity. |
| Transaction Pooler (port 6543) for long scripts | Session Pooler (port 5432) for scripts needing prepared statements / `SET ROLE` / session state | Stable guidance in 2026 | If Phase 2 uses `pg` directly (rejected for this phase), port 5432 is correct. Not used here. |

**Deprecated/outdated:**
- `pdf-parse` v1.1.x (npm `latest` for years, last updated 2020). Do NOT install.
- `@types/pdf-parse` v1.1.5. Not compatible with v2 API. Do NOT install.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Every dept page's footer line is always `{CODE} {Name}` immediately preceding the `* Revenue Projection...` and date/page lines. | Pattern 4 | Department code/name extraction fails for outlier PDFs. Mitigation: fallback scan for any line matching `/^[A-Z][A-Z0-9]{1,5}\s+\S/` in the last 5 lines of the page. |
| A2 | ±$0.25 cross-validation tolerance is enough for up to 20 dept rows at `numeric(14,2)`. | Pitfall 6 | Too-tight → false-positive `validation_warning` on legit sales. Too-loose → real data corruption missed. Mitigate by making tolerance CLI-flag configurable; spot-check first 10 imports. |
| A3 | `net_revenue` is NOT summable across departments (department pages don't carry all revenue components — no `Referral Fees`, no `Level Up`, no `Other Charges`). | Cross-validation code example | If department pages DO contain net revenue and we skip it, we miss a validation opportunity. Verify on the first 5 imports whether dept pages have a `Total Net Revenue:` label; if they do, add it to the cross-validation set. |
| A4 | All 62 tiny (1182-byte) PDFs are empty placeholders — none has hidden content recoverable by alternate means. | Pitfall 2 | If they ARE recoverable (e.g., pdfjs-dist `getPageOperatorList` vs getText), we'd miss 62 sales. Low risk: these files are 1182 bytes — not enough room to encode 1 page of report data. Recommend: on the first run, print filenames of all skipped-empty and spot-check one manually. |
| A5 | `payment_status` can be derived from `Paid Invoices / UnPaid Invoices` inline labels (Pattern 2). The exact values to store (e.g., "paid" / "partial" / "unpaid") are not specified in CONTEXT. | SaleRecordSchema | If the planner needs a defined vocabulary, this must be decided in planning. Recommend: string like `"{paid} paid / {unpaid} unpaid / {total} total"` or a compact enum derived from counts. |
| A6 | Empty PDFs have NO sale number recoverable from PDF metadata either — the filename is the only source. | Pitfall 2 | If RFC embedded the sale number in PDF Info metadata, we could still import the empty sales as "known cancellations". Optional enhancement. Low priority. |
| A7 | Cross-validation only on the four monetary columns shown (`total_sold_value`, `total_low_estimate`, `total_high_estimate`, `total_reserves`) plus the two integer columns (`lots_auctioned`, `lots_sold`) — this is the useful subset; hammer/premium/etc. may appear on dept pages but require re-inspection. | Cross-validation code | Missing a cross-validation opportunity (premium, insurance). Easy to add after first dept-page verification. |
| A8 | The RPC function's `security definer` + `revoke all from public` + `grant execute to service_role` is the correct Supabase idiom for a script-only function. | Pattern 5 SQL | If wrong, either the function is callable by authenticated users (bad — it can write anything) OR the script can't call it (run fails). Verify by invoking with both service-role and anon-key clients during Wave 0 tests; anon-key call MUST fail. |

## Open Questions

1. **Does the "revenue" column on `sale_departments` have an expected formula?**
   - What we know: `sale_departments.revenue numeric(14,2)` exists in the Phase 1 migration. Department pages show `Premium:`, `Commission:`, `Insurance:`, `Lot Charges:` but NO single "Total Revenue" line.
   - What's unclear: Whether `revenue` should equal `Premium + Commission + Insurance + Lot Charges` (a derived sum) or a specific PDF line we haven't found.
   - Recommendation: Planner should add a task to inspect 3+ real PDFs via the `--verbose --limit 1` discovery mode and define the formula in a dedicated plan. If derived-sum, document it explicitly in a code comment + test.

2. **What vocabulary should `sales.payment_status` use?**
   - What we know: PDFs contain `Paid Invoices (All lots flagged paid): 224`, `UnPaid Invoices (Not all lots paid): 0`, `Paid Settlements: 1`, `Unpaid Settlements: 0`, `Lots Missing Paddle/Unsold Code: 0`.
   - What's unclear: Phase 3 will render this — does it want a text label or the raw counts?
   - Recommendation: Store the raw counts as a JSON string (`{"paid_invoices":224,"unpaid_invoices":0,"paid_settlements":1,"unpaid_settlements":0,"missing_paddle":0}`) and let Phase 3 render however it wants. Keep `payment_status` as a human label derived from the counts (e.g., `"paid"` if unpaid==0, else `"partial"`, else `"unpaid"`).

3. **What exactly IS the `title` field for a sale?**
   - What we know: Page 1 has `Auction Profile for Sale IT254, November 16, 2022` followed by `Estate of General Colin L. Powell` followed by `All Departments`.
   - What's unclear: Is `title` the sale's human name (`Estate of General Colin L. Powell`), or the full header line (`Auction Profile for Sale IT254, November 16, 2022`)?
   - Recommendation: Use the line BETWEEN `Auction Profile for Sale ...` and `All Departments` — that is the human-meaningful title. Fallback to the `Auction Profile` line if the middle line is missing.

4. **How to detect `sale_date` reliably?**
   - What we know: Date appears inside the `Auction Profile for Sale IT254, November 16, 2022` line.
   - What's unclear: Format is always `Month DD, YYYY` but needs `Date.parse`-compatible ISO output.
   - Recommendation: `new Date("November 16, 2022").toISOString().slice(0, 10)` → `2022-11-16`. Verify across 10+ PDFs in Wave 0. Fall back to `null` on parse failure rather than failing the record.

5. **Should the plan seed the missing department codes explicitly?**
   - What we know: Seed migration has 22 codes; research found at least 12 more (ANT, ASNP, CNS, FASH, GAR, ISL, JWL, LIT, MANU, MIN, NAT, REL, RUG, TRI).
   - What's unclear: Do we seed them up-front (an additional seed migration) or let auto-discovery populate them?
   - Recommendation: Let auto-discovery populate. Phase 2 DATA-06 is satisfied because (a) the 22 known codes are already seeded and (b) the import run will add ALL observed codes by the time it finishes. A follow-up "normalize display names" migration is cheap after first run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Running `tsx scripts/import-pdfs.ts` | Yes | 25.8.1 | — (Node 18+ supports `util.parseArgs`; Node 20.6+ supports `--env-file`) |
| npm | Install pdf-parse, tsx, dotenv | Yes | bundled with Node 25.8 | — |
| PDF source files | Reading input | Yes | 457 files at `~/Projects/rfc_profiles/rfc_profiles/` (62 empty placeholders, 395 with content) | — |
| Supabase project | RPC + DB writes | Yes | Already configured from Phase 1 | — |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS bypass for inserts | **Unknown (user-managed secret)** | — | User must set in `.env.local` before running. Script errors clearly if absent. |

**Missing dependencies with no fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — user-provided secret; script must print a clear error with recovery instructions.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (already installed from Phase 1) |
| Config file | `vite.config.ts` (project default — includes Vitest config) |
| Quick run command | `npm test -- scripts` |
| Full suite command | `npm test` |
| Test runner for TS scripts | tsx (scripts), Vitest (tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DATA-01 | Bulk import processes all 457 files, classifies each | integration | `npm test -- scripts/tests/import-pdfs.integration.test.ts` | Wave 0 |
| DATA-02 | Page 1 parser returns valid `SaleRecord` from a known text blob | unit | `npm test -- scripts/tests/sale-page.test.ts` | Wave 0 |
| DATA-03 | Dept page parser returns valid `SaleDepartmentRecord` from a known text blob | unit | `npm test -- scripts/tests/department-page.test.ts` | Wave 0 |
| DATA-04 | Numeric parser handles `$X,XXX.XX`, `$.NULL.`, `$-X`, `$X-Y`, `X (Y%)`, `(X Withdrawn)` | unit | `npm test -- scripts/tests/numeric.test.ts` | Wave 0 |
| DATA-05 | Cross-validation flags intentional dept-sum mismatch, passes on clean data | unit | `npm test -- scripts/tests/cross-validate.test.ts` | Wave 0 |
| DATA-06 | Unknown dept code auto-creates `departments` row with `auto_discovered=true` | integration | `npm test -- scripts/tests/auto-discover.test.ts` (mocked Supabase) | Wave 0 |
| DATA-07 | Running twice produces 0 new inserts second pass | integration | `npm test -- scripts/tests/idempotency.test.ts` | Wave 0 |
| — | Empty-placeholder PDFs (1182 bytes) classified as `skipped: empty` not `failed` | unit | `npm test -- scripts/tests/empty-pdf.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- scripts` (scripts-only tests, ~2s expected)
- **Per wave merge:** `npm test` (full suite including Phase 1 tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual spot-check of 10 imported sales against source PDFs

### Wave 0 Gaps
- [ ] `scripts/tests/fixtures/` directory — needs 3-4 anonymized sample PDFs OR 3-4 `.txt` files containing expected pdf-parse output (preferred — smaller, no binary files in git)
- [ ] `scripts/tests/numeric.test.ts` — covers DATA-04 with all documented edge cases
- [ ] `scripts/tests/sale-page.test.ts` — covers DATA-02 against a fixture
- [ ] `scripts/tests/department-page.test.ts` — covers DATA-03 against a fixture
- [ ] `scripts/tests/cross-validate.test.ts` — covers DATA-05; includes a "±$0.24 passes, ±$0.26 flags" test
- [ ] `scripts/tests/empty-pdf.test.ts` — covers the 62-file empty-placeholder classification
- [ ] `scripts/tests/idempotency.test.ts` — mocked Supabase; covers DATA-07
- [ ] `scripts/tests/auto-discover.test.ts` — mocked Supabase; covers DATA-06 auto-discovery logic
- [ ] `scripts/tests/import-pdfs.integration.test.ts` — end-to-end on `--limit 3 --dry-run`; covers DATA-01
- [ ] Vitest config update to include `scripts/**/*.test.ts` in test paths (currently defaults to `src/**`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Script is local-CLI only; no user-facing auth |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Service role key bypasses RLS — MUST be isolated (Pitfall 10). RPC function uses `security definer` with execute granted only to `service_role`. |
| V5 Input Validation | yes | Zod schemas on all parsed records; PL/pgSQL RPC casts JSONB to typed columns (rejects malformed values). |
| V6 Cryptography | no | No crypto in this pipeline. |
| V7 Error Handling & Logging | yes | scraper_runs.logs JSONB records per-file errors. Do NOT log the service key or full env. |
| V8 Data Protection | yes | `SUPABASE_SERVICE_ROLE_KEY` MUST NOT be committed, bundled, or logged. Pitfall 10 covers. |
| V14 Configuration | yes | `.env.local` must be in `.gitignore` (verify from Phase 1). |

### Known Threat Patterns for {Node CLI + Supabase service role}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service role key leaks into browser bundle | Information disclosure (catastrophic) | Named `SUPABASE_SERVICE_ROLE_KEY` (not `VITE_*`), lives outside `src/`, top-of-file `typeof window` guard in supabase-admin.ts, ESLint `no-restricted-imports` (deferred) |
| PDF-based RCE via malformed input | Tampering / DoS | pdf-parse wraps pdfjs-dist which sandboxes PDF parsing in JS. Low risk. Still: use try/catch around every `parser.getText()` call. |
| SQL injection through PDF text content | Tampering | JSONB parameters into RPC — PL/pgSQL casts to typed columns. No string concatenation. |
| Committing `.env.local` to git | Information disclosure | Verify `.gitignore` from Phase 1 covers `.env.local`. |
| Accidentally running `npm run import:pdfs` against prod with wrong data | Tampering | CLI prints source directory + sale count + confirmation prompt (interactive flag) before first insert when `--confirm` is not set. Alternatively, gate on `NODE_ENV` or explicit `--yes`. |
| Log exposure of the service role JWT | Information disclosure | Never `console.log(process.env)`. If verbose mode is added, explicitly allowlist non-sensitive keys. |

## Sources

### Primary (HIGH confidence)
- Real RFC PDF samples (inspected via `pdf-parse` v2.4.5 on `$HOME/Projects/rfc_profiles/rfc_profiles/`, 2026-04-21):
  - `1000_Profile_7JFjfvfg8s.PDF` — empty placeholder (1182 bytes, 0 chars)
  - `10ES_Profile_qbzQS24gs7.PDF` — empty placeholder
  - `11ES_Profile_FMcsBAcfT3.PDF` — small single-dept PDF, contains `$.NULL.` edge cases
  - `41_Profile_5W347sUfLx.PDF` — 28-page full sale, has negative values, withdrawn-lot annotations
  - `119_Profile_qwIsztpiZm.PDF` — 21-page sale
  - `IT254_Profile_aNQaVr3gAn.PDF` — 31-page sale, canonical layout
  - `IT210_Profile_BHKMe91nkA.PDF` — 29-page sale with FASH, ISL, NAT dept codes
- `supabase/migrations/20260421000002_create_sales.sql` — full sale column list [VERIFIED: read file]
- `supabase/migrations/20260421000003_create_sale_departments.sql` — dept column list [VERIFIED]
- `supabase/migrations/20260421000004_create_scraper_runs.sql` — logging table [VERIFIED]
- `supabase/migrations/20260421000008_seed_departments.sql` — 22 seeded codes [VERIFIED]
- `supabase/migrations/20260421000007_rls_policies.sql` — confirms no INSERT policies exist, so service role (RLS-bypass) is required [VERIFIED]
- `src/db/database.types.ts` — generated types [VERIFIED]
- `package.json` — confirms zod/supabase-js/react installed, confirms `tsx` + `pdf-parse` + `dotenv` NOT yet installed [VERIFIED]
- pdf-parse v2 type definitions (dist/pdf-parse/cjs/index.d.cts from installed package) [VERIFIED: file read]
- npm registry version queries (2026-04-21): `pdf-parse@2.4.5`, `tsx@4.21.0`, `dotenv@17.4.2`, `@supabase/supabase-js@2.104.0` [VERIFIED: `npm view` output]
- Node runtime version on target machine: `v25.8.1` [VERIFIED: `node --version`]

### Secondary (MEDIUM confidence)
- [Supabase Atomic RPC pattern](https://openillumi.com/en/en-supabase-transaction-rpc-atomicity/) — PL/pgSQL pattern for multi-table inserts. Cross-referenced with Supabase Database Functions docs.
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) — confirms PL/pgSQL auto-wraps in transaction.
- [tsx vs ts-node vs Bun 2026](https://www.pkgpulse.com/blog/tsx-vs-ts-node-vs-bun-2026) — tsx ~25× faster startup.
- [LogRocket: Running TypeScript in Node.js](https://blog.logrocket.com/running-typescript-node-js-tsx-vs-ts-node-vs-native/) — confirms tsx recommendation.
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — Session vs Transaction pooler modes (relevant if future phase adds direct `pg`).
- [Supabase Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI) — pooler guidance.

### Tertiary (LOW confidence)
- [Mark Collins: One API call to insert in multiple tables Supabase](https://medium.com/@markwillcollins/one-api-call-to-insert-in-multiple-tables-supabase-9123e4f7b234) — confirms the RPC pattern is the community standard; not an authoritative source.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every package version verified against npm registry on 2026-04-21; matches CLAUDE.md pins.
- PDF layout: **HIGH** — inspected 6 real PDFs across numeric/alphanumeric sale numbers and short/long page counts; labels and tab-separator patterns are consistent. Edge cases ($.NULL., negative values, empty placeholders) all observed in real files.
- Architecture (RPC + service role): **HIGH** — the pattern is explicit in the Supabase community, and the code example compiles against our actual migration schema.
- Cross-validation tolerance: **MEDIUM** — ±$0.25 is a mathematically defensible upper bound for 20 rows of `numeric(14,2)` drift but has not been empirically tested against all 395 non-empty PDFs. Recommend making CLI-configurable.
- Pitfalls: **HIGH** — every pitfall listed was observed in a real PDF or is a well-documented Supabase/Vite pattern.
- Security: **HIGH** — service-role isolation patterns are well-established.
- Open questions 1-5: **MEDIUM** — questions the planner should resolve by doing a targeted discovery pass against 5 real PDFs before locking the Zod schema contents.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack; PDF format is fixed-historical — won't change)
