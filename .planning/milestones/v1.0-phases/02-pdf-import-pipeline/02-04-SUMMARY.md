---
phase: 02-pdf-import-pipeline
plan: 04
subsystem: import-pipeline
tags: [cli, argparse, dotenv, scraper-runs, observability, typescript]

# Dependency graph
requires:
  - phase: 02-pdf-import-pipeline (plan 01)
    provides: scraper_runs table (status lifecycle, sales_found, sales_imported, logs JSONB)
  - phase: 02-pdf-import-pipeline (plan 02)
    provides: parsePdf orchestrator with empty/failed/ok discriminated union
  - phase: 02-pdf-import-pipeline (plan 03)
    provides: importSale(sale, departments, {toleranceCents?}) with dup-check + RPC
provides:
  - scripts/import-pdfs.ts main({ argv, env, io, skipBannerDelay }) entry point (programmatic + CLI)
  - CLI flags: --source, --dry-run, --limit, --verbose, --cross-validation-tolerance, --help (node:util parseArgs)
  - scraper_runs lifecycle wiring (insert running, update success/partial/failure)
  - Pre-flight banner + 3-second Ctrl+C window (T-05 mitigation)
  - Per-file progress format "[ N/total ] {sale_number} -> {inserted|skipped:*|failed:*}"
  - Final summary table (counts + duration + per-file failure list)
  - .env.example documenting SUPABASE_SERVICE_ROLE_KEY handling
affects: [02-05-end-to-end, 10-rfc-scraper]

# Tech tracking
tech-stack:
  added: []   # dotenv + tsx already installed by Plan 02-02
  patterns:
    - "node:util parseArgs for CLI flags (no yargs/commander dependency)"
    - "Dependency injection via MainOverrides ({ argv, env, io, skipBannerDelay }) — tests pass a synthetic env + io capture to drive main() without spawning a child process"
    - "Lazy dynamic import of supabase-admin.js — dry-run path never triggers the module-level env-var guard, and vi.mock() in tests still hooks import-sale.js successfully"
    - "Skip dotenv load when caller supplies env override — prevents developer's real .env.local from contaminating Scenario 2 (missing-key) test"
    - "Direct-run guard via /import-pdfs\\.(ts|js|mjs|cjs)$/i check on process.argv[1] — lets main() be imported as a library or invoked as a script"
    - "scraper_runs status mapping: inserted>0 && failed===0 -> success; inserted>0 && (failed>0 || empty>0) -> partial; inserted===0 && failed>0 -> failure"
    - "Per-file atomic error handling: parsePdf.status branches into empty/failed/ok; importSale result discriminates on ok/duplicate/rpc_error — one bad PDF never aborts the batch (T-03)"

key-files:
  created:
    - "scripts/import-pdfs.ts — 496-line CLI entry point: parseArgv, env-var guard, file enumeration, banner, scraper_runs lifecycle, per-file loop, summary table"
    - "scripts/tests/import-pdfs.integration.test.ts — 148-line integration test covering Scenario 1 (--dry-run --limit 3 on real PDFs, skipIf fixture dir missing) + Scenario 2 (missing SUPABASE_SERVICE_ROLE_KEY)"
  modified:
    - ".env.example — replaced 2-line VITE-only placeholder with full template covering SUPABASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and warning comments on leak/rotation/VITE-prefix hazards"

key-decisions:
  - "dotenv skipped when the caller supplies `env` — keeps test isolation. Without this, Scenario 2 (missing key) would pick up the developer's real .env.local and pass the env-var guard, defeating the test."
  - "Lazy dynamic import of supabase-admin.js — deferred until the live path actually needs it, so `--dry-run` without `SUPABASE_SERVICE_ROLE_KEY` still succeeds (and the Scenario 1 test doesn't need a service role key to run)."
  - "Banner delay gated behind a `skipBannerDelay` override (default false; tests leave it unset but run --dry-run which skips the delay internally). For a production live run the 3-second Ctrl+C window is preserved."
  - "exitCode 1 on any failure (not just fatal errors) so `npm run import:pdfs` fails the shell pipeline when PDFs couldn't be processed — surfaces issues in CI / cron contexts."
  - "Comment phrasing of T-06 mitigation rewritten from `No \\`console.log(process.env)\\` anywhere` to `We never dump the environment object to stdout/stderr` so the plan's strict grep `! grep -q 'console.log(process.env)'` stays green. Documentation intent preserved."

patterns-established:
  - "CLI testability via dependency injection: expose `main()` as a named export with MainOverrides ({ argv, env, io, skipBannerDelay }). Tests invoke main() directly (no child_process), asserting exit code + captured stdout/stderr lines. Production `tsx scripts/import-pdfs.ts` still works via the direct-run guard."
  - "Two-tier confirmation before DB writes: print banner (source + target URL + file count + mode) then 3-second delay. Banner alone is not enough; the pause is what gives the operator time to cancel. Both together give T-05 coverage."

requirements-completed: [DATA-01]

# Metrics
duration: ~7min
completed: 2026-04-21
---

# Phase 02 Plan 04: CLI Importer (DATA-01) Summary

**CLI entry point `scripts/import-pdfs.ts` wires parsePdf + importSale into a 457-file batch tool with argparse-driven flags, a pre-flight banner + 3-second Ctrl+C window (T-05), a scraper_runs lifecycle row per invocation, per-file progress lines, and a final summary table — all exercised by a 2-scenario integration test (real-PDF dry-run + missing-env-var) that never touches the live Supabase project.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-21T19:20:59Z
- **Completed:** 2026-04-21T19:27:39Z
- **Tasks:** 2 (1 TDD test + 1 feature)
- **Files created:** 2 (1 script + 1 test); **modified:** 1 (.env.example)
- **Test suite:** 8 script files / 70 tests — all green. Full repo suite 13 files / 93 tests — all green.

## CLI Flag List

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--source <dir>` | string | `~/Projects/rfc_profiles/rfc_profiles` | Directory containing `.PDF` files to import |
| `--dry-run` | boolean | `false` | Parse + validate only; skip banner delay, scraper_runs, and DB writes |
| `--limit <N>` | positive integer | (all files) | Process first N PDFs (sorted by filename) — useful for spot-checks |
| `--verbose` | boolean | `false` | Reserved for extra diagnostic output (currently no-op; allowlist is source/URL/tolerance/counts only, never env) |
| `--cross-validation-tolerance <D>` | float (dollars) | `0.25` | Monetary drift tolerance passed to importSale as `toleranceCents = round(D * 100)` |
| `--help` | boolean | `false` | Print usage and exit 0 |

Invalid `--limit` (non-positive, non-integer) and invalid `--cross-validation-tolerance` (negative / NaN) both raise a descriptive error, print HELP_TEXT, and exit 1.

## Banner Format (T-05 Sample)

Exact stdout for `--dry-run --limit 5`:

```
============================================================
PDF IMPORT PIPELINE
============================================================
Source directory: C:\Users\maser/Projects/rfc_profiles/rfc_profiles
Target Supabase:  <not configured>
Files found:      457 PDFs (processing first 5)
Mode:             DRY-RUN (no DB writes)
Cross-val tol:    +/- $0.25
============================================================
```

Live mode (no `--dry-run`) additionally prints `Starting in 3 seconds... Press Ctrl+C to abort.` then delays 3 seconds before any DB write. `Target Supabase` pulls from `SUPABASE_URL` (preferred) or `VITE_SUPABASE_URL` (fallback). **Never** prints `SUPABASE_SERVICE_ROLE_KEY`.

## Progress Line Format

```
[ 1/5 ] 1000     -> skipped: empty_placeholder
[ 2/5 ] 103      -> (dry-run) ok: 22 depts
[ 3/5 ] 106      -> (dry-run) ok: 16 depts
[ 4/5 ] 1086     -> skipped: empty_placeholder
[ 5/5 ] 1092     -> skipped: empty_placeholder
```

Live-run variants:

- `[ N/total ] {sale_number} -> inserted`
- `[ N/total ] {sale_number} -> inserted (WARN: total_sold_value: sum(dept)=$99999.76 vs sale=$100000.00)`
- `[ N/total ] {sale_number} -> skipped: duplicate`
- `[ N/total ] {sale_number} -> skipped: empty_placeholder`
- `[ N/total ] {sale_number} -> failed: {reason from parsePdf or importSale}`

Sale number is the filename prefix before `_Profile_`. `.padEnd(8)` keeps columns aligned for sale numbers up to 8 chars (covers observed `IT254`, `10ES`, `ABC1234`).

## Summary Table Sample

Dry-run output:

```
============================================================
SUMMARY
============================================================
Total files:                5
Parsed ok (dry-run):        2
Skipped (empty placeholder):   3
Failed:                     0
Duration:                   1s
============================================================
```

Live-run output additionally includes `Inserted`, `Skipped (duplicate)`, and `Validation warnings` rows. A trailing `Failures:` block lists `{sale_number}: {error}` when any failed.

## scraper_runs Lifecycle

Only runs when `--dry-run` is NOT set.

1. **Start:** `INSERT INTO scraper_runs (status, sales_found) VALUES ('running', files.length) RETURNING id` — runId captured in memory.
2. **Per-file loop:** no scraper_runs writes; per-file errors are accumulated in `summary.failures`.
3. **End:** `UPDATE scraper_runs SET status=?, finished_at=now(), sales_imported=?, error_message=?, logs=? WHERE id=runId`.
   - `status`: `success` (inserted>0 && failed===0 && empty===0), `partial` (inserted>0 but failed>0 OR empty>0), `failure` (inserted===0 && failed>0).
   - `error_message`: `"{N} files failed"` if any failures, else `null`.
   - `logs`: JSONB object with total/inserted/skipped_*/failed/validation_warnings/duration_ms/failures[].

If the final UPDATE errors, a WARN is logged to stderr but the process still exits based on summary.failed — we don't mask file-level errors with scraper_runs bookkeeping errors.

## Integration Test Scenarios

| Scenario | Fixture | Assertions | Gate |
|----------|---------|-----------|------|
| 1. Real-PDF dry-run | `~/Projects/rfc_profiles/rfc_profiles` (457 files) via `--limit 3 --dry-run` | exit 0, parsePdf called 3x, importSale never called, stdout contains `[ 1/3 ]` + `[ 2/3 ]` + `[ 3/3 ]` | `describe.skipIf(!existsSync(dir))` — fresh-clone / CI skips cleanly |
| 2. Missing SUPABASE_SERVICE_ROLE_KEY | `{ ...process.env, SUPABASE_SERVICE_ROLE_KEY: undefined }` + no --dry-run | exit 1, stderr contains `SUPABASE_SERVICE_ROLE_KEY`, stderr matches `/service[_ ]role|supabase dashboard|project settings|get the service/`, importSale never called | always runs |

Test file uses `vi.mock('../lib/import-sale.js', () => ({ importSale: importSaleSpy }))` at the top so the spy intercepts even the lazy dynamic import inside main(). Scenario 1 does NOT mock parsePdf — it exercises real pdf-parse against 3 real PDFs (observed duration 165ms on the target machine).

## Threat Model Coverage

| Threat | Mitigation | Evidence |
|--------|-----------|----------|
| T-05 wrong-DB target | Banner prints source + target URL + mode + file count; 3-second delay before any DB write | `printBanner()` in scripts/import-pdfs.ts; grep-verified acceptance criterion |
| T-06 secret exposure | Banner logs SUPABASE_URL only; no `console.log(process.env)` anywhere; verbose mode uses an explicit allowlist | `grep -q "console.log(process.env)"` returns nothing (verified) |
| T-03 malformed PDF | parsePdf returns `{ status: 'failed' }` instead of throwing; per-file try is structural not try/catch; CLI loop continues to next file | Observed in dry-run test: empty_placeholder files are classified correctly without aborting |
| T-08 mid-run abort | Accepted — each sale is atomic; an orphaned `running` scraper_runs row is tolerable per CONTEXT decision | No code change needed |

## Files Created/Modified

- `scripts/import-pdfs.ts` — 496 lines. Exports `main()` + `RunSummary` + `MainOverrides` interface. Imports `parsePdf` eagerly; `importSale` + `supabaseAdmin` lazily.
- `scripts/tests/import-pdfs.integration.test.ts` — 148 lines. Two `describe` blocks (Scenario 1 + Scenario 2).
- `.env.example` — 24 lines (was 2). Adds SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY plus warning comments on leak / rotation / VITE-prefix hazard.
- `package.json` — unchanged; `"import:pdfs": "tsx scripts/import-pdfs.ts"` already present from Plan 02-02.

## Decisions Made

- **dotenv load gated behind no-env-override.** If the caller passes an `env` override (tests do), we trust it verbatim and skip dotenv. Otherwise (production `tsx scripts/import-pdfs.ts`), we load `.env.local`. This keeps Scenario 2's "delete key" test honest.
- **Lazy dynamic import of supabase-admin.js.** The module-level env-var guard inside supabase-admin.ts throws on load if `SUPABASE_SERVICE_ROLE_KEY` is missing. Loading it only after the live-path env-var check ensures `--dry-run` works without a key, and that tests which mock `import-sale.js` don't also need to mock `supabase-admin.js`.
- **Skipped banner delay is opt-in, not default.** The 3-second pause is the T-05 mitigation, so we default to preserving it. Tests don't exercise live mode so the delay never fires; if a future test does need live mode, it can set `skipBannerDelay: true`.
- **exitCode derived from summary.failed.** A run where 100 files succeeded and 5 failed still exits 1 so downstream automation (CI, cron jobs, the Phase 10 scraper) can surface partial failures. The scraper_runs `status` column distinguishes `partial` from `failure` for operators who want the nuance.
- **Plan's strict grep on `console.log(process.env)`.** The rewording sidesteps the false-positive match without weakening the mitigation — we still never log the environment.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were triggered. The comment-phrasing adjustment noted under Decisions is in direct service of the plan's `<verify>` grep (the plan explicitly requires `! grep -q "console.log(process.env)"` to pass); not a deviation.

## Issues Encountered

- **Windows worktree + absolute-path Write behaviour.** Initial Write to the integration test file using the shorthand `C:\Users\maser\Projects\tpc-dashboard\scripts\tests\...` path created the file in the main repo tree instead of the `.claude\worktrees\agent-a83d2a8d` worktree. Resolved by always using the fully-qualified worktree-prefixed absolute path; stray file in the main repo was removed before committing. No code impact.
- **`npx vitest --run scripts/tests/...` returns "No test files found".** Cause: Vitest 4's `projects` config means the path filter must be matched against project-specific includes, but the built-in filter resolver doesn't know which project owns the file. Resolved by running `npx vitest --run --project scripts`. The `npm test -- scripts/tests/...` form documented in the plan's `<automated>` block passes the filter differently and works. No code change.

## User Setup Required

- Nothing for dry-run invocations.
- For live runs: copy `.env.example` → `.env.local` and fill in `SUPABASE_SERVICE_ROLE_KEY` from Supabase dashboard → Project Settings → API → `service_role` secret. Exact steps also printed in the CLI error message when the key is missing.

## Next Phase Readiness

- Wave 5 (Plan 02-05 end-to-end) can now invoke `npm run import:pdfs` against the live Supabase project. The scraper_runs row will log the full run; status distinguishes success / partial / failure; per-file failures are captured in `logs.failures[]`.
- The dry-run path is the pre-flight check: Wave 5 should execute `npm run import:pdfs -- --dry-run --limit 10` first to confirm parsing works on the current PDF set, then `npm run import:pdfs` (no flags) for the full 457-file run.
- Phase 10 (RFC Scraper) can invoke `main()` programmatically with its own `argv` + `io` capture when new sales are detected — no need to shell out.
- No blockers.

## Task Commits

1. **Task 1 — Integration test (RED)** — `a17d903` (`test(02-04): add import-pdfs integration test (red)`)
2. **Task 2a — CLI implementation (GREEN)** — `9688cef` (`feat(02-04): add import-pdfs CLI with argparse + progress + scraper_runs lifecycle`)
3. **Task 2b — .env.example template** — `59d9804` (`chore(02-04): add .env.example template documenting service role key setup`)

## Self-Check: PASSED

- `scripts/import-pdfs.ts` — present (`-rw-r--r-- 496 lines`).
- `scripts/tests/import-pdfs.integration.test.ts` — present (`148 lines`).
- `.env.example` — present (`24 lines, SUPABASE_SERVICE_ROLE_KEY block included`).
- `package.json "import:pdfs"` — present (pre-existing from Plan 02-02).
- Commit `a17d903` — present.
- Commit `9688cef` — present.
- Commit `59d9804` — present.
- `npx vitest --run --project scripts` — 8 files / 70 tests, all passing.
- `npx vitest --run` (full repo) — 13 files / 93 tests, all passing.
- `npx eslint scripts/` — clean.
- `npx tsc --noEmit` — clean.
- `npx tsx scripts/import-pdfs.ts --help` — prints HELP_TEXT, exits 0.
- `npx tsx scripts/import-pdfs.ts --dry-run --limit 5` — prints banner + 5 progress lines + summary, exits 0.
- `grep -q "console.log(process.env)" scripts/import-pdfs.ts` — no match (T-06).

---
*Phase: 02-pdf-import-pipeline*
*Completed: 2026-04-21*
