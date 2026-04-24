# Phase 2: PDF Import Pipeline - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse all 457 historical RFC auction profile PDFs into structured, validated database records. Deliver a local Node CLI script (`npm run import:pdfs`) that: reads PDFs from a configurable source directory, extracts sale-level + per-department metrics via pdf-parse + regex, Zod-validates, inserts into `sales` + `sale_departments` via the Supabase service role key, logs each invocation to `scraper_runs`, and is idempotent (skips existing `sale_number`).

Out of scope for Phase 2: scheduling, network scraping, UI for triggering imports, retroactive repair of already-imported records. Those live in Phase 10 (RFC Scraper) and later maintenance work.

</domain>

<decisions>
## Implementation Decisions

### Parser Architecture
- Use `pdf-parse` (^2.4.5 per CLAUDE.md) for text extraction; no layout-aware parsing
- Regex-based line matching against fixed labels (e.g., `Hammer Price`, `Buyer Premium`, `Lots Auctioned`, `Lots Sold`, `Sell-through Rate`, `Total Sold Value`, `Estimate Low / High`, `Net Revenue`)
- Per-page handling: page 1 = "All Departments" sale summary → writes to `sales`; subsequent pages = one department each (code detected from page header line) → each writes to `sale_departments`
- **PDF source path:** `~/Projects/rfc_profiles/rfc_profiles/` (confirmed on disk; 457 files named `{sale_number}_Profile_{random}.PDF`). PROJECT.md previously said `~/Desktop/rfc_profiles/` — update PROJECT.md in Plan 05 of this phase.
- PDF files are NOT committed to the dashboard repo (size). Path is configurable via CLI flag.

### CLI & Invocation
- Script location: `scripts/import-pdfs.ts` (TypeScript; run via `tsx` or compiled)
- npm script: `"import:pdfs": "tsx scripts/import-pdfs.ts"`
- Args: `--source <dir>` (default `~/Projects/rfc_profiles/rfc_profiles/`), `--dry-run` (parse + validate, no DB writes), `--limit <N>` (process first N for spot-checks)
- Progress UX: per-file line `[ N/457 ] {sale_number} → inserted | skipped | failed: {reason}`; final summary table (ok / skipped / failed counts)
- **DB credentials:** Use Supabase **service role key** (bypasses RLS — required for bulk inserts). Read from `SUPABASE_SERVICE_ROLE_KEY` environment variable in `.env.local`. User must add this (instructions go in README + script error message).
- Service role key is **NEVER** bundled into the frontend (script is server-side only, stays outside `src/`). Plan 02 of this phase must guard against leak (e.g., do not import from `src/lib/supabase.ts` — create a separate `scripts/lib/supabase-admin.ts`).

### Data Validation
- Zod schemas for `SaleRecord` + `SaleDepartmentRecord`. Validation runs before every insert. Zod parse failure = parse failure for that PDF (file counted as `failed`, continues to next).
- Range fields (e.g., `$533,300-880,550`) parsed into two numeric columns — `estimate_low` + `estimate_high` — already present in the Phase 1 schema. Schema confirmed via `database.types.ts`.
- Numeric parsing handles: commas (`$1,234,567.89`), percentages (`42.5%` → `0.425`), parenthetical annotations (`(included)`, `(net)`), currency symbols, mixed whitespace.
- **Cross-validation:** After all department records for a sale are inserted, re-read them and compare `SUM(dept.*)` to the sale-level totals (hammer, lots sold/auctioned — EXCLUDING net_revenue which is not summable across departments). Tolerance **±$0.25** per `numeric(14,2)` rounding across up to ~20 department rows (updated after RESEARCH Pitfall 6 analysis; superseded earlier ±$0.01 value which did not account for cumulative rounding drift). Mismatch → log warning AND set `sales.validation_warning = true` (requires new column added via new migration).
- **Unknown department codes:** If a PDF contains a code not in `departments`, insert a new row with `code = <NEW>` and `display_name = <NEW>` placeholder, `auto_discovered = true`. Log for later manual review. (Requires `auto_discovered` column on `departments`.)

### Idempotency & Error Handling
- Primary dup key: `sales.sale_number` (UNIQUE). Before insert: `SELECT id FROM sales WHERE sale_number = ?`; if exists → skip (report as `skipped`).
- Failure mode: **best-effort per file**. Parse error on one PDF never aborts the run. End-of-run summary lists `failed` files with per-file error messages.
- **Run logging:** Every `npm run import:pdfs` invocation inserts one row into `scraper_runs` at start (status `running`), updates to `completed` | `failed` at end with: `started_at`, `finished_at`, `sales_attempted`, `sales_inserted`, `sales_skipped`, `sales_failed`, `error_log` (JSONB array of `{sale_number, error}` objects).
- Transaction scope: **per-sale atomic**. If any of a sale's department inserts fail, the `sales` row for that sale rolls back too. Use a DB transaction (supabase-js v2 does not support client-side TX well → use PostgREST RPC that wraps insert in PL/pgSQL, OR use `pg` directly with service role connection string).

### Claude's Discretion
- Exact regex patterns for each label — derive from actual PDF content during implementation (may need a discovery pass)
- Error message wording for CLI output
- Whether to use `tsx` vs build step vs plain `ts-node`
- Whether to extract the parser into `scripts/lib/parse-pdf.ts` or inline
- Choice between `pg` direct client vs Supabase RPC for transactions
- How to structure Zod schemas (single big schema vs composable sub-schemas)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1)
- `src/db/database.types.ts` — generated types with `Database['public']['Tables']['sales'|'sale_departments'|'departments'|'scraper_runs']` — scripts import these for type-safe inserts
- `src/lib/supabase.ts` — client-side only (uses anon key). Scripts must NOT reuse this file (would leak service role key into frontend bundle if ever imported there). Create `scripts/lib/supabase-admin.ts` separately.
- Phase 1 migration pattern — `supabase/migrations/{timestamp}_{name}.sql` with RLS enable + policies. Phase 2 adds migrations for: `sales.validation_warning boolean default false`, `departments.auto_discovered boolean default false`.

### Established Patterns
- Zod schemas live in `src/lib/` in TPC App; Phase 2 should put them in `scripts/lib/schemas.ts` since they're server-side only
- `numeric(14,2)` for all monetary columns — Phase 2 parsing must produce JavaScript `number` values that fit in DECIMAL(14,2) (max ±$999,999,999,999.99 per field — plenty of headroom)
- Supabase migrations ordered by timestamp
- package.json scripts match TPC App where parallel

### Integration Points
- Writes to `sales`, `sale_departments`, `scraper_runs` (dashboard-owned) — bypasses RLS via service role key
- Reads/writes `departments` (auto-discover new codes)
- Does NOT read/write TPC App tables (`profiles`, `sessions`, `items`, `export_history`, `photos`)
- Will be triggered by Phase 10 (RFC Scraper) in addition to manual invocation

</code_context>

<specifics>
## Specific Ideas

- Add a `scripts/` directory at repo root (sibling of `src/`). Include `scripts/import-pdfs.ts`, `scripts/lib/parse-pdf.ts`, `scripts/lib/schemas.ts`, `scripts/lib/supabase-admin.ts`.
- Surface a "schema discovery" helper mode (e.g., `--sample 1 --verbose`) that prints the extracted text + matched fields for one PDF, to accelerate regex tuning.
- Two new migrations required:
  - `sales.validation_warning boolean not null default false`
  - `departments.auto_discovered boolean not null default false`
- Update PROJECT.md to correct the PDF source path.

</specifics>

<deferred>
## Deferred Ideas

- Retroactive repair of cross-validation warnings (set up later; Phase 2 just flags them)
- Manual-review UI for `auto_discovered` department codes (out of scope for Phase 2; REQUIREMENTS does not require it in v1 — the dashboard can render auto-discovered codes using the placeholder display_name)
- Batch resume on mid-run crash (best-effort per-file handles this — each file's success is committed before the next starts, so re-running picks up where it stopped)
- Full-text indexing of PDF content for search (not a v1 requirement)
- Storing raw PDF blobs in Supabase Storage (not in v1; source files stay on the user's disk and/or get re-fetched by Phase 10 scraper)

</deferred>
