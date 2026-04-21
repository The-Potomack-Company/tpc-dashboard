---
phase: 2
slug: pdf-import-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 2 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (already installed in Phase 1) |
| **Config file** | `vite.config.ts` (must be extended to include `scripts/**/*.test.ts`) |
| **Quick run command** | `npm test -- scripts` |
| **Full suite command** | `npm test && npm run lint && npm run build` |
| **Estimated runtime** | ~3s (unit), ~15s with integration mocks |

## Sampling Rate

- **After every task commit:** `npm test -- scripts`
- **After every plan wave:** `npm test && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite green + manual spot-check of 10 imported sales against source PDFs
- **Max feedback latency:** 30 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-??-01 | migrations | 1 | — | schema | `test -f supabase/migrations/*validation_warning* && test -f supabase/migrations/*auto_discovered* && test -f supabase/migrations/*import_sale_with_departments*` | ❌ W0 | ⬜ pending |
| 02-??-01 | numeric | 2 | DATA-04 | unit | `npm test -- scripts/tests/numeric.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | sale-page | 2 | DATA-02 | unit | `npm test -- scripts/tests/sale-page.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | dept-page | 2 | DATA-03 | unit | `npm test -- scripts/tests/department-page.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | empty-pdf | 2 | — | unit | `npm test -- scripts/tests/empty-pdf.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | cross-validate | 3 | DATA-05 | unit | `npm test -- scripts/tests/cross-validate.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | auto-discover | 3 | DATA-06 | integration | `npm test -- scripts/tests/auto-discover.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | idempotency | 3 | DATA-07 | integration | `npm test -- scripts/tests/idempotency.test.ts` | ❌ W0 | ⬜ pending |
| 02-??-01 | integration | 4 | DATA-01 | integration | `npm test -- scripts/tests/import-pdfs.integration.test.ts --run --timeout 30000` (`--limit 3 --dry-run`) | ❌ W0 | ⬜ pending |
| (manual) | full-run | last | DATA-01, DATA-02, DATA-03, DATA-05 | E2E | run `npm run import:pdfs` against live DB; spot-check 10 sales vs source PDFs | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `scripts/` directory created (sibling of `src/`)
- [ ] `scripts/tests/fixtures/` with 3–4 text-format fixtures capturing pdf-parse output (preferred over committing PDFs)
- [ ] `scripts/tests/numeric.test.ts` — covers `$X,XXX.XX`, `$.NULL.`, `$-X,XXX.XX`, ranges `$X-Y`, `X (Y%)`, `(X Withdrawn)`
- [ ] `scripts/tests/sale-page.test.ts` — canonical sale fixture → expected `SaleRecord`
- [ ] `scripts/tests/department-page.test.ts` — canonical dept fixture → expected `SaleDepartmentRecord`
- [ ] `scripts/tests/empty-pdf.test.ts` — 1182-byte empty placeholder → `skipped: empty`
- [ ] `scripts/tests/cross-validate.test.ts` — ±$0.24 passes, ±$0.26 flags warning
- [ ] `scripts/tests/auto-discover.test.ts` — unknown code triggers `departments` insert with `auto_discovered=true` (mocked supabase-admin)
- [ ] `scripts/tests/idempotency.test.ts` — same sale_number existing → skip path (mocked)
- [ ] `scripts/tests/import-pdfs.integration.test.ts` — `--limit 3 --dry-run` returns parsed records for first 3 real PDFs
- [ ] `vite.config.ts` extended to discover `scripts/**/*.test.ts` alongside `src/**/*.test.*`

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full-run import of all 457 PDFs | DATA-01 | Real DB state + real PDFs; not containerizable in CI | `npm run import:pdfs` (not dry-run) and check scraper_runs summary: sales_inserted + sales_skipped + sales_failed = 457 |
| Spot-check 10+ sales against source PDFs | DATA-02 | Visual compare of financial fields | Open `{sale_number}_Profile_{hash}.PDF` in viewer; compare to `SELECT * FROM sales WHERE sale_number = '...'` + department rows. Verify all money values, percentages, ranges. |
| Cross-validation flags match reality | DATA-05 | Warning flag needs spot-inspection on real data | `SELECT sale_number FROM sales WHERE validation_warning = true;` — inspect each flagged sale manually and confirm whether the dept sums actually diverge from totals |
| `departments` table contains every observed code | DATA-06 | Schema-level fact | `SELECT code FROM departments ORDER BY code;` — confirm 22 seeded codes + any auto-discovered codes found during import |
| Re-run produces 0 new inserts | DATA-07 | Confirms idempotency end-to-end | Run `npm run import:pdfs` twice; second run's scraper_runs row shows `sales_skipped` = first run's `sales_inserted`, `sales_inserted` = 0 |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for unit tests
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
