---
phase: 06-department-analysis-sale-comparison
fixed_at: 2026-04-23T13:00:00Z
review_path: .planning/phases/06-department-analysis-sale-comparison/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-04-23T13:00:00Z
**Source review:** .planning/phases/06-department-analysis-sale-comparison/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (all warnings; no criticals; info excluded per fix_scope=critical_warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `<tr role="button">` overrides native row semantics in DepartmentRankingsTable

**Files modified:** `src/components/DepartmentRankingsTable.tsx`, `src/components/DepartmentRankingsTable.test.tsx`, `src/tests/departments-page.test.tsx`
**Commit:** 4bb02b0
**Applied fix:** Removed `role="button"` from the data-row `<tr>` to preserve native row semantics. Swapped `aria-pressed` for `aria-selected` (the appropriate ARIA attribute for selected rows), keeping `tabIndex={0}` + `onClick` + `onKeyDown` for the toggle interaction. Updated all dependent tests in `DepartmentRankingsTable.test.tsx` (T5, T6, T7, T8, T9, T10, plus Space-key + null-display_name + null-avg_sell_through + metric-change tests) and `departments-page.test.tsx` (T3, T5, T6, T7, T14) to query rows via `getByRole('row', { name: /.../ })` instead of `getByRole('button', ...)`. Also updated T9 to assert `aria-selected` rather than `aria-pressed`. Added a clarifying code comment referencing WR-01 in both the component and the live-region tests. All 15 component tests + 14 page integration tests pass.

### WR-02: `DepartmentRevenueLineChart` EMPTY sentinel diverges from the hook's frozen singleton

**Files modified:** `src/components/DepartmentRevenueLineChart.tsx`
**Commit:** 9818ef7
**Applied fix:** Replaced `const EMPTY_ROWS: readonly DepartmentRevenueRow[] = [];` with an `Object.freeze([])` sentinel so (a) naive mutation surfaces loudly rather than silently corrupting referential stability, and (b) the identity matches the convention established by `useDepartmentRevenueSeries`'s own `EMPTY_REVENUE_SERIES` frozen singleton. Kept the local constant rather than importing the hook's, since `EMPTY_REVENUE_SERIES` is not currently exported — the local frozen singleton still covers the pre-fetch `query.data === undefined` branch. Added a comment explaining the rationale and linking the WR-02 finding. All 6 component tests pass.

### WR-03: `maxNotice` status hint is not announced to assistive tech

**Files modified:** `src/pages/Departments.tsx`
**Commit:** 1f02293
**Applied fix:** Replaced the conditionally mounted `{maxNotice && <p role="status">...}` block with an always-mounted `<p role="status" aria-live="polite">` that toggles `sr-only` based on `maxNotice`. Text content falls back to `''` when empty so the visual layout is unchanged. This mirrors the existing SalesPage pattern at `src/pages/Sales.tsx:111-123` (already documented as WR-03 there). Mounting the live region at initial render ensures JAWS and older NVDA builds reliably fire the first announcement. All 14 page integration tests pass (T13 "max-8 flow" exercises this region end-to-end).

## Regression Verification

Ran `npx vitest --run` (full test suite) after all three fixes were in place:
- **68 test files, 644 tests — all passing**
- No regressions in any component, page integration, hook, or lib test.

---

_Fixed: 2026-04-23T13:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
