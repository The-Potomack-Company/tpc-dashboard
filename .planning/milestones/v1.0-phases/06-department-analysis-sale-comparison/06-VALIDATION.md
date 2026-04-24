---
phase: 6
slug: department-analysis-sale-comparison
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Per-task map populated by the planner after the 6 PLAN.md files were authored.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (jsdom) + @testing-library/react + @testing-library/jest-dom |
| **Config file** | vite.config.ts (vitest inline config inherited from Phase 1) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~75 seconds (479 baseline + ~120 Phase 6 new tests) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --reporter=dot <file-under-test>`
- **After every plan wave:** `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green + `npx tsc --noEmit` green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 06-01 | 1 | DEPT-01/02/03, INFR-04 | T-06-01-01/02/03/04 | security-definer + search_path + admin-gate + revoke/grant | shell grep | `grep -c "set search_path" ... && grep -c "private.is_admin" ...` | ❌ W0 | ⬜ pending |
| 06-01-T2 | 06-01 | 1 | DEPT-01/02/03 | T-06-01-04 | live migration push + type regen | shell grep | `grep -c "department_rankings" src/db/database.types.ts` | ❌ W0 | ⬜ pending |
| 06-01-T3 | 06-01 | 1 | SALE-05 | — | pure helper | unit | `npx vitest run src/lib/delta.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-T4 | 06-01 | 1 | SALE-06 | — | pure helper | unit | `npx vitest run src/lib/waterfall.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-T5 | 06-01 | 1 | DEPT-01 | — | RPC adapter | unit | `npx vitest run src/hooks/useDepartmentRankings.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-T6 | 06-01 | 1 | DEPT-02/03 | — | RPC adapter | unit | `npx vitest run src/hooks/useDepartmentRevenueSeries.test.ts src/hooks/useDepartmentShareSeries.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-T7 | 06-01 | 1 | SALE-04 | T-06-04-02 | parameterized .in() | unit | `npx vitest run src/hooks/useSalesComparison.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-T1 | 06-02 | 2 | DEPT-01 | — | WAI-ARIA radiogroup | unit | `npx vitest run src/components/DeptRankingMetricToggle.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-T2 | 06-02 | 2 | DEPT-01, INTR-01 | T-06-02-01/02 | XSS via auto-escape + no-regex-filter | integration | `npx vitest run src/components/DepartmentRankingsTable.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-T3 | 06-02 | 2 | DEPT-01, INTR-01 | T-06-02-03 | ProtectedRoute | integration | `npx vitest run src/tests/departments-page.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-T1 | 06-03 | 2 | DEPT-02 | T-06-03-02 | max-8 cap enforcement | unit | `npx vitest run src/components/DepartmentChipBar.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-T2 | 06-03 | 2 | DEPT-02, INTR-01, INTR-03 | T-06-03-01 | tooltip escape + all-null filter | integration | `npx vitest run src/components/DepartmentRevenueLineChart.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-T3 | 06-03 | 2 | DEPT-03, INTR-01, INTR-03 | T-06-03-01 | tooltip escape + stack contract | integration | `npx vitest run src/components/DepartmentShareStackedBarChart.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-T4 | 06-03 | 2 | DEPT-02, DEPT-03, INTR-01 | — | composition + highlightedDept wiring | integration | `npx vitest run src/tests/departments-page.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-T1 | 06-04 | 2 | SALE-04 | T-06-04-01 | URL whitelist | unit | `npx vitest run src/lib/parse-sales-param.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-T2 | 06-04 | 2 | SALE-04 | T-06-04-05 | virtualizer preservation + getRowId + stopPropagation | integration | `npx vitest run src/tests/sales-table.test.tsx` | ✅ (augment) | ⬜ pending |
| 06-04-T3 | 06-04 | 2 | SALE-04 | — | disabled-state guard + programmatic nav | unit | `npx vitest run src/components/SaleSelectionFooter.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-T4 | 06-04 | 2 | SALE-04 | — | max-4 cap end-to-end | integration | `npx vitest run src/tests/sales-page.test.tsx` | ✅ (augment) | ⬜ pending |
| 06-04-T5 | 06-04 | 2 | SALE-04, SALE-05 | T-06-04-04/06 | adjacent-pair math + null-safe cells | integration | `npx vitest run src/components/ComparisonTable.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-T6 | 06-04 | 2 | SALE-04, SALE-05 | T-06-04-01/03 | invalid-URL branch + ProtectedRoute | integration | `npx vitest run src/tests/sale-compare-page.test.tsx` | ❌ W0 | ⬜ pending |
| 06-05-T1 | 06-05 | 2 | SALE-06, INTR-03 | T-06-05-01 | tooltip escape + empty-state null guard | integration | `npx vitest run src/components/RevenueWaterfallChart.test.tsx` | ❌ W0 | ⬜ pending |
| 06-05-T2 | 06-05 | 2 | SALE-06 | T-06-05-04 | collapse-by-default + aria-expanded | integration | `npx vitest run src/tests/sale-detail-page.test.tsx` | ✅ (augment) | ⬜ pending |
| 06-06-T1 | 06-06 | 3 | INTR-01 (nav activation) | T-06-06-01 | ProtectedRoute inheritance | integration | `npx vitest run src/tests/dashboard-layout.test.tsx` | ✅ (augment) | ⬜ pending |
| 06-06-T2 | 06-06 | 3 | all (smoke) | — | end-to-end flow | manual | — (checkpoint:human-verify) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Tests/fixtures that must exist before any task in this phase runs.

- [ ] `src/components/DepartmentRankingsTable.test.tsx` — DEPT-01 + INTR-01 row highlight
- [ ] `src/components/DepartmentRevenueLineChart.test.tsx` — DEPT-02 (line per selected dept, dim on cross-filter)
- [ ] `src/components/DepartmentShareStackedBarChart.test.tsx` — DEPT-03 (top-8 + Other, stack sums to 100)
- [ ] `src/components/DepartmentChipBar.test.tsx` — multi-select toggle, 8-max cap, non-blocking warning
- [ ] `src/components/ComparisonTable.test.tsx` — 2/3/4 columns, adjacent-pair deltas, metadata no-delta
- [ ] `src/components/SaleSelectionFooter.test.tsx` — hidden / 1-selected / 2-4 selected / max hint
- [ ] `src/components/RevenueWaterfallChart.test.tsx` — SALE-06 (step order, colors per direction, empty state)
- [ ] `src/components/DeptRankingMetricToggle.test.tsx` — segmented control toggles 3 metrics
- [ ] `src/hooks/useDepartmentRankings.test.ts` — mocked supabase RPC shape + empty-frozen singleton
- [ ] `src/hooks/useDepartmentRevenueSeries.test.ts` — mocked RPC, enabled gate on empty deptCodes, sorted queryKey
- [ ] `src/hooks/useDepartmentShareSeries.test.ts` — mocked RPC, rows + topCodes envelope
- [ ] `src/hooks/useSalesComparison.test.ts` — queryKey sort stability, input-order preservation, missing-sale throws
- [ ] `src/lib/delta.test.ts` — adjacent-pair delta math + color helper
- [ ] `src/lib/waterfall.test.ts` — 7-row transform + null guard + no-mutation
- [ ] `src/lib/parse-sales-param.test.ts` — discriminated-union coverage (empty/too-few/too-many/malformed/ok/IT*/dedupe)
- [ ] Augment: `src/tests/sales-table.test.tsx` — checkbox col + stopPropagation + max-4 + getRowId survival
- [ ] Augment: `src/tests/sales-page.test.tsx` — footer + nav + max-4 hint + clear
- [ ] Augment: `src/tests/sale-detail-page.test.tsx` — Revenue Breakdown collapsed-by-default + expand/collapse
- [ ] Augment: `src/tests/dashboard-layout.test.tsx` — Departments NavLink flip + other placeholders intact
- [ ] Augment: `src/tests/departments-page.test.tsx` (created in 06-02; further augmented in 06-03)
- [ ] Augment: `src/tests/sale-compare-page.test.tsx` — 5 URL branches + ProtectedRoute inheritance

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end sale comparison flow in real browser | SALE-04 | Sticky-footer + sidebar scroll interplay is layout-sensitive; jsdom lacks layout | 1) Open `/sales` 2) Check 3 sales 3) Click "Compare (3)" 4) Verify URL has `?sales=` 5) Verify deltas render 6) Uncheck to 1 sale — footer button disables 7) Try a 5th — inline hint appears |
| Cross-filter visual dim on `/departments` | INTR-01 | Opacity transition smoothness is perceptual | 1) Open `/departments` 2) Click a rankings row 3) Verify non-matching multi-line series dim to opacity 0.2 4) Verify non-matching stacked bar segments dim to opacity 0.3 5) Click row again → all restored |
| Revenue Waterfall rendering on Sale Detail | SALE-06 | SVG visual correctness (colors, step order, axis labels) | 1) Open a sale detail 2) Expand Revenue Breakdown 3) Verify 7 bars in order: Hammer blue → +Premium green → −Commission rose → −Insurance rose → −Lot charges rose → −Referral rose → Net blue 4) Hover each → tooltip shows signed delta + running total |
| Sidebar Departments NavLink active-state | INTR-01 (nav) | Active NavLink left-border indicator is visual | 1) Click sidebar `Departments` → URL changes to `/departments` and the sidebar entry shows the accent left-border indicator 2) Team/Reports/Custom Charts entries are still `Coming soon` |

(Covered by the Task 2 `checkpoint:human-verify` in Plan 06-06.)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner populated per-task map; executor confirms after implementation begins)
