---
phase: 02-pdf-import-pipeline
plan: 02
subsystem: import-pipeline
tags: [pdf-parse, zod, typescript, parser, supabase, vitest, security]

# Dependency graph
requires:
  - phase: 02-pdf-import-pipeline (plan 01)
    provides: validation_warning column + auto_discovered column + import_sale_with_departments RPC + regenerated database.types.ts
provides:
  - pdf-parse/tsx/dotenv dependencies installed and pinned
  - scripts/lib/ parser module tree (numeric, sale-page, department-page, schemas, parse-pdf)
  - scripts/lib/supabase-admin.ts — isolated service-role client with browser-context guard
  - Zod schemas (SaleRecordSchema, SaleDepartmentRecordSchema) matching Database Insert shapes
  - Discriminated-union ParseResult: ok | empty | failed
  - Empty-placeholder fast path (62/457 cases detected, not counted as failures)
  - Vitest 4 projects config splitting src (jsdom) from scripts (node)
  - Text fixtures (IT254, IT254 FRN, 11ES) + 1182-byte binary empty fixture
affects: [02-03-cross-validation, 02-04-cli-importer, 10-rfc-scraper]

# Tech tracking
tech-stack:
  added:
    - "pdf-parse@^2.4.5 (PDF text extraction, v2 API — new PDFParse({data}).getText())"
    - "tsx@^4.21.0 (TypeScript script runner for npm run import:pdfs)"
    - "dotenv@^17.4.2 (Node-side .env.local loader since import.meta.env is Vite-only)"
  patterns:
    - "Three-layer PDF text parsing: tab-separated right column, inline label:value, positional left-column cluster"
    - "Positional value extraction with optional-parenthetical offset (the '(100% by value, ...)' line shifts indices by +1 when present)"
    - "Service-role client isolation: file outside src/, non-VITE env var, typeof window guard, type-only src/ import"
    - "Vitest projects API for multi-environment test suites (jsdom for React, node for scripts)"
    - "Discriminated-union parse results (ok | empty | failed) instead of throwing"

key-files:
  created:
    - "scripts/lib/parsers/numeric.ts — parseMoney, parseCount, parseMoneyRange, parseLotsSold, parseAuctionedLots"
    - "scripts/lib/parsers/sale-page.ts — parseSalePage(pageText, opts) → Omit<SaleRecord,'imported_at'>"
    - "scripts/lib/parsers/department-page.ts — parseDepartmentPage(pageText) → SaleDepartmentRecord"
    - "scripts/lib/schemas.ts — SaleRecordSchema, SaleDepartmentRecordSchema + types"
    - "scripts/lib/parse-pdf.ts — parsePdf(filePath) orchestrator returning ParseResult"
    - "scripts/lib/supabase-admin.ts — service-role SupabaseClient, browser-hostile"
    - "scripts/tests/numeric.test.ts — 21 assertions"
    - "scripts/tests/sale-page.test.ts — 17 assertions (IT254 + 11ES)"
    - "scripts/tests/department-page.test.ts — 8 assertions including $14,078.96 revenue formula"
    - "scripts/tests/empty-pdf.test.ts — 5 assertions (empty-placeholder behavior)"
    - "scripts/tests/fixtures/sale-page-IT254.txt — 1,458 bytes of extracted page-1 text"
    - "scripts/tests/fixtures/department-page-IT254-FRN.txt — 844 bytes of FRN page text"
    - "scripts/tests/fixtures/sale-page-11ES.txt — 1,352 bytes with $.NULL. edge cases"
    - "scripts/tests/fixtures/empty-pdf.bin — 1182-byte placeholder PDF"
  modified:
    - "package.json — +pdf-parse, +tsx, +dotenv, +import:pdfs script"
    - "vite.config.ts — switched to Vitest 4 projects API (src: jsdom, scripts: node)"

key-decisions:
  - "Revenue formula (Open Question #1) RESOLVED: revenue = Premium + Commission + Insurance + Lot Charges — verified against FRN fixture's printed $14,078.96 total"
  - "Left-column value cluster uses FIXED positional mapping (13 slots with optional parenthetical at index 4), not label-ordered mapping — determined empirically from IT254 + 11ES fixtures"
  - "Vitest 4 removed environmentMatchGlobs; used top-level projects config instead (plan had specified the removed API)"
  - "parseAuctionedLots added as a fifth named export in numeric.ts (not in RESEARCH Code Examples block, but required by Pitfall 8)"

patterns-established:
  - "Scripts-tree security invariants: (1) file outside src/, (2) no VITE_ prefix on service-role env var, (3) typeof window throw guard, (4) type-only import from src/"
  - "Test fixtures as committed .txt output of pdf-parse (not committed PDFs) — keeps the repo small and makes parser changes diff-reviewable"
  - "Positional-with-optional-offset extraction for cluster layouts where a parenthetical continuation line appears only in certain conditions"

requirements-completed: [DATA-02, DATA-03, DATA-04]

# Metrics
duration: ~28min
completed: 2026-04-21
---

# Phase 02 Plan 02: PDF Parser Layer Summary

**pdf-parse v2 + regex extractors + Zod schemas + security-isolated service-role client, turning 457 RFC auction profile PDFs into typed, validated SaleRecord / SaleDepartmentRecord values via a three-variant ParseResult.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-21T14:58:00Z
- **Completed:** 2026-04-21T15:07:30Z
- **Tasks:** 3 (all autonomous, TDD for tasks 2 and 3)
- **Files modified:** 2 (package.json, vite.config.ts)
- **Files created:** 14

## Accomplishments

- **51 unit/integration tests green** across 4 test files (numeric, sale-page, department-page, empty-pdf)
- **Full IT254 sale record parses correctly** — all 12 asserted fields match expected values
- **FRN revenue formula validated** against the PDF's own printed total ($14,078.96), resolving plan-checker Warning #6
- **11ES $.NULL. edge case** parses without throwing and preserves nulls through Zod
- **Empty-placeholder fast path** returns `{ status: 'empty' }` in <50ms for the 62/457 placeholder files
- **Service-role key isolation verified**: no scripts/lib reference in `dist/` after `vite build`, browser-context guard in place
- **Vitest multi-environment split** — scripts tests run under Node (pdf-parse works), src tests still run under jsdom (RTL works)

## Task Commits

Each task produced one or more atomic commits:

1. **Task 1: Install deps, extend Vitest config, scaffold scripts tree, capture fixtures** — `547e3cb` (chore)
2. **Task 2 RED: Failing tests for numeric / sale / dept parsers** — `31d01b4` (test)
3. **Task 2 GREEN: numeric + schema + parser libs** — `5ddcb68` (feat)
4. **Task 2 GREEN: supabase-admin service-role client** — `ce353aa` (feat)
5. **Task 3 RED: Empty-placeholder test** — `e1b34ee` (test)
6. **Task 3 GREEN: parse-pdf orchestrator** — `73fe2c1` (feat)
7. **Deviation fix: Vitest 4 projects API** — `ed4f080` (fix)

## IT254 Expected-vs-Actual (Sale Page)

All values match plan assertions and are verified by `scripts/tests/sale-page.test.ts`:

| Field | Expected | Actual | Source Pattern |
|---|---|---|---|
| `sale_number` | `IT254` | `IT254` | Header line regex (HEADER_RE) |
| `title` | `Estate of General Colin L. Powell` | same | Line following header |
| `sale_date` | `2022-11-16` | same | Header date → ISO-8601 slice |
| `lots_auctioned` | `428` | `428` | Left-col value[0] via parseAuctionedLots |
| `lots_sold` | `424` | `424` | Left-col value[1] via parseLotsSold |
| `hammer_total` | `407660.00` | `407660` | Tab-field "Total Hammer Paid" |
| `buyer_premium` | `101915.00` | `101915` | Tab-field "Premium" |
| `seller_commission` | `65437.50` | `65437.5` | Tab-field "Commission" |
| `insurance` | `6134.85` | `6134.85` | Tab-field "Insurance" |
| `lot_charges` | `10700.00` | `10700` | Tab-field "Lot Charges" |
| `referral_fees` | `0` | `0` | Tab-field "Referral Fees" (no trailing colon) |
| `net_revenue` | `209866.51` | `209866.51` | Tab-field "Total Net Revenue" |
| `source_pdf_path` | `/fake/IT254.PDF` | same | Injected via opts |
| `validation_warning` | `false` | `false` | Default from Zod schema |

## IT254 FRN Expected-vs-Actual (Department Page)

| Field | Expected | Actual | Source |
|---|---|---|---|
| `code` | `FRN` | `FRN` | Backwards-walking footer scan |
| `display_name` | `Furniture (General)` | same | Same scan, name token after code |
| `lots_auctioned` | positive int | `38` | Left-col value[0] |
| `lots_sold` | — | `37` | Left-col value[1] |
| `sell_through_pct` | — | `97` | parseLotsSold from value[1] |
| `total_sold_value` | — | `30685` | Left-col value[2] |
| `low_estimate` | — | `8795` | parseMoneyRange on value[5] |
| `high_estimate` | — | `14050` | same, high bound |
| `revenue` (Warning #6) | `14078.96` | `14078.96` | Premium + Commission + Insurance + Lot Charges |

## 11ES Edge Case

- `sale_number` → `11ES` (alphanumeric, per Pitfall 7)
- `buyer_premium` → `null` (from `$.NULL.\tPremium:`, per Pitfall 4)
- `net_revenue` → `null` (from `$.NULL.\tTotal Net Revenue:`)
- `hammer_total` → `30000` (present in this fixture; other fixtures in the wild will have this null too)
- Parse does NOT throw; Zod validation succeeds.

## Regex Patterns Used (all from RESEARCH.md, with one empirical adjustment)

- `TAB_FIELD_RE = /^(?<value>[^\t]+)\t(?<label>.+?):?$/` — right-column tab-separated VALUE\tLABEL
- `INLINE_FIELD_RE = /^(?<label>[^:]+?):\s+(?<value>\S.*)$/` — "Label: Value" single lines
- `HEADER_RE = /^Auction Profile for Sale\s+(?<sale>\S+),\s+(?<date>[A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s*$/`
- `DEPT_HEADER_RE = /^(?<code>[A-Z][A-Z0-9]{1,5})\s+(?<name>.+)$/` — page-footer dept header
- `DATE_FOOTER_RE = /^\d{2}\/\d{2}\/\d{4}\s+.*Page\s+\d+\s+of\s+\d+$/` — footer skip-line
- `PARENTHETICAL_RE = /^\(.*\)$/` — detect the "(100% by value, incl. unsold value)" continuation

**Empirical adjustment (deviation from plan's naive "left-column labels == values" mapping):**
The label block on a sale page has 10 labels (`Total Estimate:` through `Registered Bidders:`) but the following value cluster has 12 values (no parenthetical) or 13 values (with parenthetical). The values do NOT map positionally 1:1 to the 10 visible labels — they follow a fixed 13-slot schema (see sale-page.ts extractLeftColumnValues comment). This was the single biggest parser-logic fork from RESEARCH.md's Pattern 3 pseudo-code; both IT254 and 11ES fixtures agree on the 13-slot layout.

## npm Deps Added

| Package | Type | Version | Rationale |
|---|---|---|---|
| `pdf-parse` | dependency | `^2.4.5` | PDF text extraction — pinned in CLAUDE.md |
| `tsx` | devDependency | `^4.21.0` | TypeScript script runner (zero-config, 25× faster startup than ts-node) |
| `dotenv` | devDependency | `^17.4.2` | Load .env.local in Node scripts (import.meta.env is Vite-only) |

Also added npm script `"import:pdfs": "tsx scripts/import-pdfs.ts"` (the target file is created in Plan 04; script entry is safe to add early — running it before then just errors harmlessly).

## Decisions Made

- **Revenue formula locked in**: `revenue = parseMoney(Premium) + parseMoney(Commission) + parseMoney(Insurance) + parseMoney(LotCharges)` — verified empirically against FRN fixture's printed $14,078.96 total (line 36 of the fixture matches 7671.25 + 4996.25 + 461.46 + 950.00 = 14078.96 exactly). Documented in schemas.ts and enforced in department-page.test.ts.
- **Left-column fixed-slot layout**: chose positional extraction against a known 13-slot schema (with optional parenthetical at index 4) instead of trying to follow the visible 10-label order. Documented inline in sale-page.ts.
- **Vitest 4 API drift**: the plan specified `environmentMatchGlobs` which Vitest 4 removed. Used `projects` (the Vitest 4 replacement) while keeping the same behavior: scripts under node, src under jsdom.
- **`parseAuctionedLots` as the fifth numeric export**: needed for Pitfall 8 (`"33 (1 Withdrawn)"`) even though RESEARCH.md's Code Examples section only showed four. Added per plan's action step 2 note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest 4 removed `environmentMatchGlobs`**
- **Found during:** Task 3 post-verification (`npm run build` surfaced a TS error, and the src/ tests started failing under the new test config).
- **Issue:** The plan (Task 1 Step 2) specified `test.environmentMatchGlobs` — a Vitest 3 API removed in Vitest 4. With the plan's literal config, both TypeScript refused to compile vite.config.ts AND the src/ React tests stopped getting jsdom (11/74 tests failed).
- **Fix:** Replaced `environmentMatchGlobs` with the Vitest 4 replacement — top-level `projects` — split into two projects (src: jsdom, scripts: node). Kept the same behavioral contract: src tests still use jsdom + jest-dom setupFiles, scripts tests use Node so pdf-parse works.
- **Files modified:** vite.config.ts
- **Verification:** `npx vitest --run` now shows 9 test files / 74 tests all passing. `npm run build` succeeds. Both individual projects run cleanly: `--project src` (23 tests) and `--project scripts` (51 tests).
- **Committed in:** `ed4f080` (fix commit, separate from task commits for clarity)

---

**Total deviations:** 1 auto-fixed (blocking tool/API change)
**Impact on plan:** Functionally equivalent to what the plan intended; the plan's `environmentMatchGlobs` API was accurate for Vitest 3 but the project is on Vitest 4. Zero scope creep.

## Issues Encountered

- CRLF line-ending warnings from Git on Windows for the new .ts files. Verified via `git ls-files --eol` that both index and working copy are `lf`, so the warning is about future Git touches only — no behavior impact. No action taken.
- The plan's outline of `parseSalePage` assumed left-column values map positionally to the visible labels, but empirical reading of both IT254 and 11ES fixtures showed otherwise (13 value slots for 10 visible labels). Adjusted the extraction strategy to a fixed 13-slot schema and documented inline. Not classified as a deviation because the plan's action block says "derive from actual PDF content during implementation" and "Use Pattern 3 from RESEARCH.md" — Pattern 3's pseudo-code in RESEARCH.md does use a 12-element LEFT_COLUMN_LABELS list (pre-pending `Auctioned Lots` and `Total Sold Value`), which supports this direction.

## Security Invariants Verified

- `grep -q "typeof window" scripts/lib/supabase-admin.ts` → match found (browser guard in place)
- `grep -q SUPABASE_SERVICE_ROLE_KEY scripts/lib/supabase-admin.ts` → match found (non-VITE env var)
- `grep "VITE_SUPABASE_SERVICE" scripts/lib/supabase-admin.ts` → no match (no VITE_-prefixed service key anywhere)
- `grep "import.meta.env" scripts/lib/supabase-admin.ts` → no match (process.env only)
- `grep -r "scripts/lib" src/` → no match (no src/ file reaches into scripts/)
- `grep -r "supabase-admin\|SUPABASE_SERVICE_ROLE_KEY\|scripts/lib" dist/` after `vite build` → no match (service-role key not in production bundle)

## User Setup Required

None — no new external service configuration required by this plan. Plan 04 (importer CLI) will document `.env.local` additions for `SUPABASE_SERVICE_ROLE_KEY`.

## Next Phase Readiness

- Wave 3 (Plan 02-03: cross-validation + import-sale.ts) can now `import { parsePdf } from '../lib/parse-pdf.js'` and `import { supabaseAdmin } from '../lib/supabase-admin.js'` without further scaffolding.
- Wave 3 can reuse `SaleRecordSchema` / `SaleDepartmentRecordSchema` for validation at the RPC boundary.
- Wave 4 (CLI) can additionally consume `parsePdf` and the discriminated-union return — status-based switch already handles the 62/457 empty-placeholder case cleanly.

## Self-Check: PASSED

Verification performed 2026-04-21 after all commits:

- Files exist:
  - `scripts/lib/supabase-admin.ts` — FOUND
  - `scripts/lib/schemas.ts` — FOUND
  - `scripts/lib/parsers/numeric.ts` — FOUND
  - `scripts/lib/parsers/sale-page.ts` — FOUND
  - `scripts/lib/parsers/department-page.ts` — FOUND
  - `scripts/lib/parse-pdf.ts` — FOUND
  - `scripts/tests/numeric.test.ts` — FOUND
  - `scripts/tests/sale-page.test.ts` — FOUND
  - `scripts/tests/department-page.test.ts` — FOUND
  - `scripts/tests/empty-pdf.test.ts` — FOUND
  - `scripts/tests/fixtures/sale-page-IT254.txt` (1,458 bytes) — FOUND
  - `scripts/tests/fixtures/department-page-IT254-FRN.txt` (844 bytes, contains "FRN") — FOUND
  - `scripts/tests/fixtures/sale-page-11ES.txt` (1,352 bytes, contains "$.NULL.") — FOUND
  - `scripts/tests/fixtures/empty-pdf.bin` (exactly 1182 bytes) — FOUND
- Commits exist (verified via `git log --oneline 560e5b1..HEAD`):
  - `547e3cb` (chore task 1) — FOUND
  - `31d01b4` (test RED task 2) — FOUND
  - `5ddcb68` (feat parsers + schemas) — FOUND
  - `ce353aa` (feat supabase-admin) — FOUND
  - `e1b34ee` (test RED task 3) — FOUND
  - `73fe2c1` (feat parse-pdf) — FOUND
  - `ed4f080` (fix Vitest projects) — FOUND
- Test suite: `npx vitest --run scripts/tests` → 4 files, 51 tests, all pass (<1s)
- Full suite: `npx vitest --run` → 9 files, 74 tests, all pass
- Build: `npm run build` → `tsc -b && vite build` succeeds, dist/ contains no scripts/lib references

---
*Phase: 02-pdf-import-pipeline*
*Plan: 02*
*Completed: 2026-04-21*
