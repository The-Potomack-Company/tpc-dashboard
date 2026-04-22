---
phase: 6
slug: department-analysis-sale-comparison
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The planner will populate the per-task map; this template locks the infrastructure + sampling cadence.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (jsdom) + @testing-library/react + @testing-library/jest-dom |
| **Config file** | vite.config.ts (vitest inline config inherited from Phase 1) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds (current baseline; Phase 6 adds ~15 new test files) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot <file-under-test>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + `npx tsc --noEmit` must pass
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Populated by the planner during plan generation. Each task in each PLAN.md MUST map to a row here. See 06-RESEARCH.md § Validation Architecture for the canonical coverage derivation.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | unit/integration | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Tests/fixtures that must exist before any task in this phase runs. The planner will enumerate the full list from RESEARCH § Wave 0.

- [ ] `src/components/DepartmentRankingsTable.test.tsx` — stubs for DEPT-01 + INTR-01 cross-filter
- [ ] `src/components/DepartmentRevenueLineChart.test.tsx` — stubs for DEPT-02 (line per selected dept, dim on cross-filter)
- [ ] `src/components/DepartmentShareStackedBarChart.test.tsx` — stubs for DEPT-03 (top-8 + Other, stack sums to 100)
- [ ] `src/components/DepartmentChipBar.test.tsx` — multi-select toggle, 8-max cap, non-blocking warning
- [ ] `src/components/ComparisonTable.test.tsx` — stubs for SALE-04 / SALE-05 (2/3/4 columns, adjacent-pair deltas)
- [ ] `src/components/SaleSelectionFooter.test.tsx` — stubs for footer states (hidden / 1-selected / 2-4 selected / max hint)
- [ ] `src/components/RevenueWaterfallChart.test.tsx` — stubs for SALE-06 (step order, running total = net_revenue, up/down colors)
- [ ] `src/components/DeptRankingMetricToggle.test.tsx` — segmented control toggles 3 metrics
- [ ] `src/hooks/useDepartmentRankings.test.ts` — mocked supabase RPC shape, sort stability
- [ ] `src/hooks/useDepartmentRevenueSeries.test.ts` — mocked RPC, selected-dept filter, empty range
- [ ] `src/hooks/useDepartmentShareSeries.test.ts` — mocked RPC, top-N + Other aggregation contract
- [ ] `src/hooks/useSalesComparison.test.ts` — ordering preservation, sorted query-key cache parity
- [ ] `src/lib/delta.test.ts` — adjacent-pair delta math + color class helper (emerald/rose/gray + 0.05% equality tolerance)
- [ ] `src/lib/waterfall.test.ts` — running-total transform, 7-step order, start/end terminal handling
- [ ] `src/lib/parse-sales-param.test.ts` — discriminated union (ok/invalid), too-few, too-many, malformed, partial mismatch
- [ ] Augment: `src/components/SalesTable.test.tsx` — add row-selection prop tests (checkbox stopPropagation, 4-max cap)
- [ ] Augment: `src/pages/SaleDetail.test.tsx` — Revenue Breakdown collapsed-by-default, expand/collapse, aria-expanded

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end sale comparison flow in real browser | SALE-04 | Sticky-footer + sidebar scroll interplay is layout-sensitive; jsdom does not lay out correctly | 1) Open `/sales` 2) Check 3 sales 3) Click "Compare (3)" 4) Verify URL has `?sales=` 5) Verify deltas render correctly 6) Uncheck to 1 sale — footer button disables 7) Try a 5th — inline hint appears |
| Cross-filter visual dim on `/departments` | INTR-01 | Opacity transition smoothness is perceptual | 1) Open `/departments` 2) Click a rankings row 3) Verify non-matching multi-line series dim to opacity 0.2 4) Verify non-matching stacked bar segments dim to opacity 0.3 5) Click row again → all restored |
| Revenue Waterfall rendering on Sale Detail | SALE-06 | SVG visual correctness (colors, step order, axis labels) | 1) Open a sale detail page 2) Expand Revenue Breakdown 3) Verify 7 bars in order: Hammer blue → +Premium green → −Commission rose → −Insurance rose → −Lot charges rose → −Referral rose → Net blue 4) Hover each → tooltip shows running total matching PDF |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
