---
phase: 02-pdf-import-pipeline
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - scripts/import-pdfs.ts
  - scripts/lib/cross-validate.ts
  - scripts/lib/import-sale.ts
  - scripts/lib/parse-pdf.ts
  - scripts/lib/parsers/department-page.ts
  - scripts/lib/parsers/numeric.ts
  - scripts/lib/parsers/sale-page.ts
  - scripts/lib/schemas.ts
  - scripts/lib/supabase-admin.ts
  - supabase/migrations/20260421000009_add_validation_warning_to_sales.sql
  - supabase/migrations/20260421000010_add_auto_discovered_to_departments.sql
  - supabase/migrations/20260421000011_import_sale_rpc.sql
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-21
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 2 delivers the PDF import pipeline: parsers, schemas, a service-role
Supabase client, an atomic RPC, two migrations, and a CLI entry point with
integration tests. The high-risk surfaces (service-role key isolation,
SQL-injection via JSONB, RPC permissions) are handled well: the service-role
client is gated by a `typeof window` check, lives outside `src/` (which is
the only path Vite bundles per `tsconfig.app.json`), reads a non-`VITE_`-
prefixed env var, and is never referenced from `src/`. The RPC is
`security definer` with `set search_path = public, pg_temp`, revokes `public`,
and grants execute only to `service_role`. All JSONB values are extracted
with `->>` and explicitly cast — no string concatenation.

**No critical issues found.** The warnings below are real correctness or
robustness gaps that should be addressed before first production run.
The most important ones:

- **WR-01**: `parseMoneyRange` loses the decimal suffix on the high value
  because the regex doesn't require a `$` anchor on the parsed portion,
  combined with the range-separator ambiguity: `$30,000.00-50,000.00`
  parses fine, but `$30,000-0` (sentinel) works only because the regex
  happens to consume `0` as the full `high` token. This is fragile, not
  broken, but deserves a test pin.
- **WR-02**: `parseAuctionedLots` silently drops the `withdrawn` count
  from the returned object — it's computed but never propagated into
  the DB schema, so `(N Withdrawn)` data is lost after parsing. This
  is a likely product gap rather than a bug, but the parser's contract
  deserves a comment or a schema field.
- **WR-03**: Cross-validation's null handling treats "all-null dept
  column" identically to "all-zero dept column". If a sale reports
  `total_sold_value=$100,000` and every dept page is missing that
  field (all-null), the sum is `0` and the mismatch is reported. That's
  correct behaviour, but the threshold between "we couldn't parse it"
  and "we parsed it as zero" is important for operator triage.
- **WR-04**: The CLI's scraper_runs row uses `sales_found = files.length`
  (pre-filter count) but only updates `sales_imported = summary.inserted`.
  When the run has skipped/empty files, the `sales_found - sales_imported`
  gap is silently eaten — the `logs` jsonb has the breakdown, but the
  top-level counters misrepresent the run.

## Warnings

### WR-01: parseMoneyRange treats "$30,000-0" as sentinel but silently coerces decimals

**File:** `scripts/lib/parsers/numeric.ts:40-48`
**Issue:** The regex `/^\$?(?<low>[\d,]+(?:\.\d{1,2})?)\s*-\s*(?<high>[\d,]+(?:\.\d{1,2})?)$/`
works for the documented fixtures, but the "sentinel" branch
`high < low && low > 0 ? null : high` conflates two distinct inputs:

1. `$30,000-0` (RFC sentinel for "no upper bound") → `{low: 30000, high: null}` ✓
2. `$1,000-500` (a legitimate value where high is lower than low, which
   would be a PDF-data bug) → same result, `{low: 1000, high: null}`,
   swallowing the data-quality signal.

Case 2 is not observed in the 457-file corpus, but if it ever occurs the
parser will silently produce a plausible-looking value instead of a null
or warning. Also note: the regex does not allow whitespace inside either
operand, which is correct, but the doc comment says "low > 0 sentinel" —
a caller inspecting `{low: 0, high: 0}` cannot distinguish it from a
garbage string that happened to parse.

**Fix:**
```typescript
// Tighten the sentinel: require high === 0 specifically, not any
// "high < low" case. Only treat "low-0" as "no upper bound" when
// low is clearly nonzero.
const isRfcSentinel = high === 0 && low > 0;
return { low, high: isRfcSentinel ? null : high };
```

Also add a regression test for `parseMoneyRange('$1,000-500')` that asserts
the behaviour you want (either `{low: 1000, high: 500}` preserving the data,
or `{low: null, high: null}` to flag it). The current behaviour of
`{low: 1000, high: null}` is the worst of both worlds.

### WR-02: parseAuctionedLots computes `withdrawn` but never exposes it to the DB

**File:** `scripts/lib/parsers/numeric.ts:68-83`, `scripts/lib/parsers/department-page.ts:119`, `scripts/lib/parsers/sale-page.ts:206`, `scripts/lib/schemas.ts:18-19,42-46`
**Issue:** `parseAuctionedLots` returns `{ count, withdrawn? }` but every caller
discards `withdrawn`:

- `department-page.ts:119` — `const auctioned = parseAuctionedLots(pick(0));`
  then only uses `auctioned.count` at `lots_auctioned: auctioned.count`.
- `sale-page.ts:206` — same pattern.

The `SaleRecordSchema` and `SaleDepartmentRecordSchema` have no
`withdrawn` field, so the RPC / DB never see it either. The
`parseAuctionedLots` signature invites a bug: a future edit that
writes `auctioned.withdrawn ?? 0` into `lots_auctioned` is subtly
wrong, because `count` already excludes withdrawals.

**Fix:** Either (a) drop the optional `withdrawn` from the return value
until the schema supports it, making the interface unambiguous:

```typescript
export function parseAuctionedLots(
  raw: string | null | undefined,
): { count: number | null } {
  // ...
}
```

or (b) add `lots_withdrawn` to both schemas and migrations so the
parsed data is preserved. A brief comment explaining why it's currently
stripped would also be acceptable if this is a deliberate v1 deferral.

### WR-03: crossValidate conflates null dept values with zero

**File:** `scripts/lib/cross-validate.ts:41-43, 45-48, 56-59, 83-98`
**Issue:** `const cents = (n) => n == null ? 0 : Math.round(n * 100)` and
all `reduce` calls use `(d.X ?? 0)`. If a dept page fails to parse a
monetary column (returns `null`), it's summed as `0`. For a sale where
`total_sold_value = $100,000` and every dept is null for that column,
the crossValidate reports a mismatch `$0 vs $100,000` — which is
correct, but it surfaces as a validation_warning with a misleading
"dept sum drift" framing rather than a "dept parse gap" message.

Conversely, if only one of five depts has a null `total_sold_value`,
the other four silently under-count and a real mismatch could be
masked if it happens to fall within tolerance.

**Fix:** When any dept has `null` for a validated column, emit a
distinct mismatch tag so downstream tooling can distinguish parse gaps
from arithmetic drift:

```typescript
const deptValues = input.departments.map((d) => d.total_sold_value);
const hasNull = deptValues.some((v) => v == null);
const deptSum = deptValues.reduce<number>((s, v) => s + (v ?? 0), 0);
// ... existing compare ...
if (Math.abs(s - d) > input.toleranceCents) {
  const reason = hasNull ? '(PARSE-GAP) ' : '';
  mismatches.push(
    `${reason}${name}: sum(dept)=$${(d/100).toFixed(2)} vs sale=$${(s/100).toFixed(2)}`,
  );
}
```

At minimum, document the null-coercion in the function header so
operators know that `sum(dept)=$0` in a mismatch message may mean
"every dept was null" rather than "parsed all zeros".

### WR-04: scraper_runs.sales_found is recorded pre-filter but logs/imported diverge

**File:** `scripts/import-pdfs.ts:193, 313-325`
**Issue:** The insert sets `sales_found: files.length`, where `files`
is the list AFTER `--limit` slicing (line 151-152). So
`sales_found = min(all_files, limit)`, not "sales in corpus". The
finaliser sets `sales_imported = summary.inserted`, which excludes:

- `skipped_duplicate` (already in DB from a prior run)
- `skipped_empty` (the 62/457 empty placeholders)
- `failed` (parse errors)

So a run processing 100 files with 80 inserts, 15 dupes, 3 empty, 2
failed will show `sales_found=100, sales_imported=80` — a human
reading this will think 20 files are missing, when really only the
2 "failed" ones are. The `logs` jsonb has the breakdown, but top-level
counters lie.

Additionally, the `error_message` field is set to `"${N} files failed"`
when there are failures, but gives no indication that e.g. 15 dupes
were skipped. An operator inspecting a partial run can't tell
"healthy idempotency replay" from "serious parse regression" without
opening `logs`.

**Fix:** Either:

(a) Set `sales_found = allFiles.length` (pre-limit) so it matches
"what's in the corpus" rather than "what this run chose to process",
and split out `sales_processed = files.length` into the `logs` jsonb.

(b) Include skipped/failed counts in `error_message` for quick
operator glance:

```typescript
error_message:
  summary.failed > 0 || summary.skipped_empty > 0
    ? `${summary.failed} failed, ${summary.skipped_empty} empty, ${summary.skipped_duplicate} duplicates`
    : null,
```

### WR-05: supabaseAdmin throws at module load, poisoning any importer

**File:** `scripts/lib/supabase-admin.ts:29-40`, `scripts/import-pdfs.ts:214-225`
**Issue:** The module-level env-var guards throw synchronously when
`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing. The CLI
mitigates this by lazily importing the module (line 188), but the
dry-run path (lines 217-224) also does a lazy import of
`import-sale.js`, and `import-sale.ts` has a top-level
`import { supabaseAdmin } from './supabase-admin.js';`. So in a dev
environment where `.env.local` has no `SUPABASE_SERVICE_ROLE_KEY`, a
`--dry-run` invocation triggers:

1. `await import('./lib/import-sale.js')` (line 218)
2. which eagerly loads `supabase-admin.js`
3. which throws because the key is missing.

The catch block at line 220-223 silently swallows this and sets
`importSaleFn = null`, meaning `--dry-run` works, but the operator
sees no indication that the service-role key is missing. The `catch {}`
with no logging is the definition of debugging hell when a key is
misconfigured for the wrong reason.

**Fix:** Either (a) log a verbose-mode warning in the catch:

```typescript
} catch (err) {
  if (parsed.verbose) {
    io.err(
      `NOTE: admin client unavailable in dry-run (${
        err instanceof Error ? err.message : String(err)
      }). Live runs will fail if env is not fixed.`,
    );
  }
  importSaleFn = null;
}
```

or (b) convert `supabase-admin.ts` to a factory function so the module
itself never throws at import time, and callers decide when to
construct:

```typescript
export function createAdminClient(): SupabaseClient<Database> {
  // env checks here, throw only when called
}
```

The factory pattern is more robust and eliminates the lazy-import
dance in `import-pdfs.ts`.

### WR-06: RPC auto-discovery ignores display_name when code already exists

**File:** `supabase/migrations/20260421000011_import_sale_rpc.sql:79-91`
**Issue:** When an incoming dept row's code matches an existing
`departments` row, the RPC does `select id into v_dept_id from ... where code = ...`
and proceeds. It never compares or updates `display_name`. The seed
migration (`20260421000008_seed_departments.sql`) inserts the 22
known codes with `display_name = code` (e.g., `('FRN', 'FRN')`).

Department pages in PDFs include richer names like "FRN Furniture
(General)" — the parser's `DEPT_HEADER_RE` captures "Furniture
(General)" into `display_name`. But the RPC throws this away for
the 22 seeded codes: a row with `code=FRN, display_name=FRN` (from
seed) stays as-is forever, even though every imported PDF carries
the better name.

The comment on the `auto_discovered` column says
"eligible for display_name refinement", implying refinement
is expected to happen later. But because the RPC silently drops
the better name, the only place to recover it is by re-parsing
the PDFs. If seeded rows had `auto_discovered=false` (which they
do: the column defaults to `false`) and auto-discovered rows have
`auto_discovered=true`, a future "refine" pass needs access to at
least one parsed PDF's `display_name` per code — but that information
has been discarded by the RPC on every import after the first.

This may be deliberate ("don't overwrite an operator's manually-
edited name"), but the current code makes no distinction between
"seed row with code-as-name placeholder" and "operator-curated row".

**Fix:** Consider one of:

(a) On existing-row match, update display_name only when the stored
value equals the code (placeholder seed) AND the incoming value
differs:

```sql
update public.departments
set display_name = v_dept->>'display_name'
where id = v_dept_id
  and display_name = code
  and v_dept->>'display_name' is not null
  and v_dept->>'display_name' <> code;
```

(b) Add a column `departments.name_locked boolean default false`
that operators flip when they curate a display name, and only
update when not locked.

(c) Document that display_name refinement is explicitly a
post-import manual step and that the parser's display_name is
intentionally discarded on the seeded-code path. A code comment
next to the `select id` pointing to the decision matters here.

Option (a) gives the best default behaviour for v1.

## Info

### IN-01: Empty-placeholder detection silences all errors under 1200 bytes

**File:** `scripts/lib/parse-pdf.ts:40-52`
**Issue:** The fast-path branch `if (buffer.byteLength <= EMPTY_FAST_PATH_MAX_BYTES)`
catches `PDFParse` errors and returns `{ status: 'empty' }` (lines
47-51). A corrupt 500-byte PDF that happens to fall under the 1200
threshold is reported as "empty", not "failed". The comment
acknowledges this (`"treat as empty ... won't be in the 395 good
files"`), but the behaviour means a regression where auction profile
PDFs start arriving truncated below 1200 bytes would be invisible
in the summary.

**Fix:** Log the underlying error in verbose mode at minimum:
```typescript
} catch (err) {
  // Verbose diagnostic — operator can see why we're treating as empty.
  return { status: 'empty' };
}
```
or narrow the heuristic to require byte length equal to the observed
placeholder size (1182), not `<=`.

### IN-02: PDFParse error messages bypass sanitisation

**File:** `scripts/lib/parse-pdf.ts:35, 61, 90`
**Issue:** Error messages from `pdf-parse` are concatenated into
`parsedResult.error` and logged verbatim via `io.out` in `import-pdfs.ts:260`.
`pdf-parse` can emit file-path-containing messages (e.g. from an
underlying `fs` error). For a shared-logging context (`scraper_runs.logs`)
this surfaces absolute source paths to the DB. Not a security issue
on an operator-controlled local path, but if this ever runs in a
cloud function with a temp-dir path, the log will carry it.

**Fix:** Record only the sale_number and a sanitised error category in
`scraper_runs.logs`:

```typescript
const error = err instanceof Error ? err.message : String(err);
// Strip absolute paths before logging to DB
const sanitised = error.replace(/[A-Za-z]:[\\/][^\s'"]+/g, '<path>').replace(/\/[^\s'"]+\//g, '<path>/');
```

### IN-03: Commented-out RE constants in sale-page.ts

**File:** `scripts/lib/parsers/sale-page.ts:22-24, 151-153`
**Issue:** Three regex constants (`RANGE_LIKE_RE`, `MONEY_LIKE_RE`,
`LOTS_SOLD_VALUE_RE`) are declared, then suppressed with
`void RANGE_LIKE_RE; void MONEY_LIKE_RE; void LOTS_SOLD_VALUE_RE;`
at the bottom of the file to silence the unused-variable lint. If
they're not needed, delete them. If they document an alternative
parsing strategy, move them into a JSDoc block with an explanation.

**Fix:**
```typescript
// Delete lines 22-24 and 151-153 (RANGE_LIKE_RE, MONEY_LIKE_RE,
// LOTS_SOLD_VALUE_RE) — all three are unused and silenced with `void`.
```

### IN-04: parseArgv loses argv[0] / argv[1] positions on error

**File:** `scripts/import-pdfs.ts:342-385`
**Issue:** `parseArgs({ args: argv, ... strict: true, allowPositionals: false })`
will throw on unknown flags, but the thrown error mentions the
offending flag without the sale-number or file context. For a script
invoked by a cron job, "Unknown option: --foo" without a timestamp
or pid lands in logs without obvious provenance.

**Fix:** Low priority. If script is cron-invoked, wrap the banner
with a UTC timestamp so any stderr output has context.

### IN-05: Duplicate regex definitions across two parsers

**File:** `scripts/lib/parsers/sale-page.ts:17-18`, `scripts/lib/parsers/department-page.ts:17-18`
**Issue:** `TAB_FIELD_RE` and `INLINE_FIELD_RE` are copy-pasted
between `sale-page.ts` and `department-page.ts`. Any fix to one
(e.g., handling a new label format) must be duplicated. The same
pattern extraction block at `sale-page.ts:178-188` also reappears
at `department-page.ts:51-61`.

**Fix:** Extract to a shared helper module
`scripts/lib/parsers/field-extractor.ts`:

```typescript
export const TAB_FIELD_RE = /^(?<value>[^\t]+)\t(?<label>.+?):?$/;
export const INLINE_FIELD_RE = /^(?<label>[^:]+?):\s+(?<value>\S.*)$/;

export function extractFields(lines: string[]): {
  tabFields: Record<string, string>;
  inlineFields: Record<string, string>;
} {
  const tabFields: Record<string, string> = {};
  const inlineFields: Record<string, string> = {};
  for (const line of lines) {
    const tabM = TAB_FIELD_RE.exec(line);
    if (tabM?.groups) {
      tabFields[tabM.groups.label.trim()] = tabM.groups.value.trim();
      continue;
    }
    const inlineM = INLINE_FIELD_RE.exec(line);
    if (inlineM?.groups) {
      inlineFields[inlineM.groups.label.trim()] = inlineM.groups.value.trim();
    }
  }
  return { tabFields, inlineFields };
}
```

### IN-06: Test coverage gaps

**File:** (cross-cutting)
**Issue:** Test files exist for numeric parsers, empty-PDF
handling, cross-validate, idempotency, auto-discover, and CLI
integration. Not present:

1. **sale-page.ts full-parse test with a real fixture.** `sale-page.test.ts`
   and `department-page.test.ts` exist (confirmed via glob) but their
   contents were not reviewed here. Confirm they exercise at least
   one real PDF's first page through the full `parseSalePage`
   function, not just the helpers.
2. **cross-validate `toleranceCents = 0` edge case.** The existing
   tests cover `tolerance=25` and `tolerance=50`. If a strict-mode
   operator passes `--cross-validation-tolerance 0`, even a 1-cent
   drift must fail. Worth a regression test.
3. **supabase-admin browser guard.** `typeof window !== 'undefined'`
   throw path has no test. A jsdom unit test that imports the module
   and asserts it throws would lock down the T-01 mitigation.
4. **RPC SQL injection.** No pgTAP / SQL-side test exercises the
   JSONB→cast chain against adversarial strings (e.g., sale_number
   containing `'; DROP TABLE sales;--`). The casts make this safe
   in theory, but a test doing `select import_sale_with_departments(
   '{"sale_number": "\\u0027; DROP TABLE sales; --", ...}'::jsonb, ...)`
   and verifying the `sales` table still exists would pin the
   defence explicitly.
5. **Parse gap handling.** The WR-03 null-coercion path has no
   direct test — cross-validate has a `makeCleanDepts()` null test
   (lines 181-208 of cross-validate.test.ts) but the mismatch path
   (sale claims total, depts all null) is untested.

**Fix:** Add cases for items 2, 3, 4, 5 as standalone tests. Item 1
likely already exists — verify during next review.

### IN-07: `ParsedArgs.verbose` is parsed but never used

**File:** `scripts/import-pdfs.ts:77, 165, 382`
**Issue:** The `--verbose` flag is defined in `parseArgs`, threaded
through `ParsedArgs.verbose`, passed into `BannerInput.verbose`, but
never read anywhere: `printBanner` receives it but doesn't branch on
it. Neither does the per-file loop or the summary. The flag is
documented in `HELP_TEXT` (line 77) but is a no-op today.

**Fix:** Either (a) delete the flag from the help text and options
until it's implemented, or (b) wire it into at least one diagnostic —
the most valuable would be per-file dept count + validation detail
on success:

```typescript
if (parsed.verbose && result.ok) {
  io.out(`       ${parsedResult.departments.length} depts, ` +
         `lots: ${parsedResult.sale.lots_auctioned}, ` +
         `sold: $${parsedResult.sale.total_sold_value?.toFixed(2)}`);
}
```

---

_Reviewed: 2026-04-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
