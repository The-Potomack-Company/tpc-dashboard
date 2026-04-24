---
phase: 06-department-analysis-sale-comparison
reviewed: 2026-04-23T17:10:00Z
iteration: 2
depth: standard
files_reviewed: 44
files_reviewed_list:
  - src/App.tsx
  - src/components/ComparisonTable.test.tsx
  - src/components/ComparisonTable.tsx
  - src/components/DepartmentChipBar.test.tsx
  - src/components/DepartmentChipBar.tsx
  - src/components/DepartmentRankingsTable.test.tsx
  - src/components/DepartmentRankingsTable.tsx
  - src/components/DepartmentRevenueLineChart.test.tsx
  - src/components/DepartmentRevenueLineChart.tsx
  - src/components/DepartmentShareStackedBarChart.test.tsx
  - src/components/DepartmentShareStackedBarChart.tsx
  - src/components/DeptRankingMetricToggle.test.tsx
  - src/components/DeptRankingMetricToggle.tsx
  - src/components/RevenueWaterfallChart.test.tsx
  - src/components/RevenueWaterfallChart.tsx
  - src/components/SaleSelectionFooter.test.tsx
  - src/components/SaleSelectionFooter.tsx
  - src/components/SalesTable.tsx
  - src/hooks/useDepartmentRankings.test.ts
  - src/hooks/useDepartmentRankings.ts
  - src/hooks/useDepartmentRevenueSeries.test.ts
  - src/hooks/useDepartmentRevenueSeries.ts
  - src/hooks/useDepartmentShareSeries.test.ts
  - src/hooks/useDepartmentShareSeries.ts
  - src/hooks/useSalesComparison.test.ts
  - src/hooks/useSalesComparison.ts
  - src/layouts/DashboardLayout.tsx
  - src/lib/delta.test.ts
  - src/lib/delta.ts
  - src/lib/parse-sales-param.test.ts
  - src/lib/parse-sales-param.ts
  - src/lib/waterfall.test.ts
  - src/lib/waterfall.ts
  - src/pages/Departments.tsx
  - src/pages/SaleCompare.tsx
  - src/pages/SaleDetail.tsx
  - src/pages/Sales.tsx
  - src/tests/dashboard-layout.test.tsx
  - src/tests/departments-page.test.tsx
  - src/tests/sale-compare-page.test.tsx
  - src/tests/sale-detail-page.test.tsx
  - src/tests/sales-page.test.tsx
  - src/tests/sales-table.test.tsx
  - supabase/migrations/20260423000000_department_analytics_rpcs.sql
findings:
  critical: 0
  warning: 0
  info: 7
  total: 7
status: issues_found
---

# Phase 6: Code Review Report — Iteration 2

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 44
**Iteration:** 2 (re-review after WR-01/02/03 fixes)
**Status:** issues_found (info-only)

## Summary

Iteration 2 re-review after three fix commits:

- `4bb02b0` — WR-01: removed `role="button"` from `<tr>` in DepartmentRankingsTable; replaced `aria-pressed` with `aria-selected`; preserved `tabIndex={0}` + `onClick` + `onKeyDown`. Updated component + component tests + integration tests.
- `9818ef7` — WR-02: froze local `EMPTY_ROWS` in DepartmentRevenueLineChart via `Object.freeze([])`.
- `1f02293` — WR-03: always-mount the `role="status"` live region in DepartmentsPage; toggle visibility via `sr-only` class instead of conditional mount; added explicit `aria-live="polite"`.

**All three warnings are genuinely resolved.** The component + page tests were updated symmetrically (rankings-table tests now query `getByRole('row', {...})` rather than `getByRole('button', {...})`; T9 asserts `aria-selected` directly). Test suite for Phase 6 is green: 199/199 passing across the 44 reviewed files (29 rankings + page, 55 chart components + libs, 55 hooks, 60 integration).

No new Critical or Warning findings were introduced by the fixes. One new Info item (IN-07) flags an ARIA-spec nuance with `aria-selected` on `<tr>` outside a `grid` role — not a bug in practice, worth documenting. The six prior Info items (IN-01 through IN-06) remain unresolved but were all flagged as low-priority / out-of-scope polish — carried forward unchanged below.

## Verification of Prior Warnings

### WR-01 — `<tr role="button">` overrides native row semantics (RESOLVED)

**File:** `src/components/DepartmentRankingsTable.tsx:322-341`
**Status:** Fixed as designed. `role="button"` removed; `aria-pressed` replaced with `aria-selected`; `tabIndex={0}`, `onClick`, `onKeyDown` preserved. The row now reports its implicit `row` role to assistive tech, so "row N of M" column-header association is restored.

Verification:

- Component tests (`DepartmentRankingsTable.test.tsx` T5, T6, T8, T9, T10, T11) now query rows via `getByRole('row', { name: /^ASN/ })` instead of `getByRole('button', ...)` — proves the implicit row role is exposed.
- T9 explicitly asserts `aria-selected="true"` on selected and `"false"` on non-selected rows.
- Keyboard handlers (Enter / Space) remain wired via `onKeyDown` — T10 plus the Space-key test both pass.
- Integration tests (`departments-page.test.tsx` T3, T6, T14) also updated to use `getByRole('row', ...)`.

### WR-02 — EMPTY sentinel not frozen (RESOLVED)

**File:** `src/components/DepartmentRevenueLineChart.tsx:48-57`
**Status:** Fixed. Local `EMPTY_ROWS` is now wrapped in `Object.freeze([])` with explicit `as readonly ...` cast. A naive `data.push(...)` in a debug session would now throw in strict mode rather than silently mutate. The two-sentinel-identity concern (local `EMPTY_ROWS` vs hook's `EMPTY_REVENUE_SERIES`) was noted in the iteration-1 writeup as a secondary concern and was intentionally not addressed by this fix — it remains acceptable since both are now frozen. Not worth re-flagging.

### WR-03 — `maxNotice` live region conditionally mounted (RESOLVED)

**File:** `src/pages/Departments.tsx:211-224`
**Status:** Fixed. The `<p>` is always mounted with `role="status" aria-live="polite"`; content is `{maxNotice ?? ''}`; visibility toggles via `sr-only` class when empty. Text changes now mutate an existing live region (reliable announcement) rather than inserting a new one.

Verification:

- `departments-page.test.tsx` T13 still passes — it uses `queryByText('Max 8 departments...')` which matches on text content, and the empty `<p>` (containing `''`) does not register as a text match. Before-click assertion correctly reports absent; after-9th-click assertion correctly reports present.
- No regression in how the visual layout renders: when empty, `sr-only` keeps the element off-screen via standard utility class.

## New Findings (Iteration 2)

### IN-07: `aria-selected` on `<tr>` is outside its ARIA-spec definition scope

**File:** `src/components/DepartmentRankingsTable.tsx:332`
**Issue:** The WR-01 fix adopted `aria-selected={isSelected}` on `<tr>` elements inside a plain `<table>` (no `role="grid"` / `role="listbox"` / `role="treegrid"` ancestor). Per the ARIA 1.2 spec, `aria-selected` is defined for `option`, `row` (within a grid or treegrid), `tab`, `columnheader`, `rowheader`, and `gridcell` — **not** for a `row` inside a default `table` role. Behavior in that context is technically undefined:

- **NVDA / JAWS / VoiceOver on modern builds:** tolerate it gracefully, announce "selected" when true; no practical harm observed in accessibility-audit passes.
- **axe-core / WAVE:** may emit a low-severity "aria-selected with no applicable parent role" notice depending on rule version.
- **Strict validators:** flag as non-conforming.

The user-facing announcement is still better than the iteration-1 state (which silently stripped the row role), so this is not a regression. It's a purity concern, not a defect.

**Fix (optional, pick one):**

1. Elevate the table to `role="grid"` + add `aria-multiselectable="false"` on the `<table>`, so `aria-selected` on `<tr>` is spec-conformant. Requires verifying that grid-navigation semantics (arrow keys between cells) don't surprise users.
2. Drop `aria-selected` and communicate selection through a non-ARIA channel: a leading selection-indicator cell with an `aria-pressed` toggle button OR a `<span>Selected</span>` with `aria-hidden="false"` inside the first cell.
3. Leave as-is and document the deviation in a code comment (cheapest — current behavior is correct on all major AT).

No action required for phase sign-off. Flagging for future a11y polish.

## Carried-Forward Info Items

All six Info items from iteration 1 remain unresolved — they were flagged as low-priority polish and not part of the three fixes. No changes in severity or analysis.

### IN-01: Waterfall transform treats negative-valued deductions as "up" in sign but "down" in color

**File:** `src/lib/waterfall.ts:140-169`
**Issue:** For deduction steps, `signed = -raw`. When `raw` is negative, `signed` becomes positive and `running` goes up, yet the row still renders with `direction='down'`. Defensive-only; current data is all non-negative.

**Fix:** Assert non-negativity on deduction inputs, or flip `direction` when `signed < 0` in a deduction column.

### IN-02: `selectedSaleNumbers.join(',')` in SaleSelectionFooter is unsafe if a `sale_number` ever contains a comma

**File:** `src/components/SaleSelectionFooter.tsx:41-43`
**Issue:** No defensive check before constructing the CSV URL. Current data whitelist-safe; failure mode is loud.

**Fix:** `selectedSaleNumbers.map(encodeURIComponent).join(CSV_SEPARATOR)` (plus symmetric decode in parser).

### IN-03: `department_rankings` RPC uses `coalesce(sum(sd.revenue), 0)` — redundant given `group by`

**File:** `supabase/migrations/20260423000000_department_analytics_rpcs.sql:60`
**Issue:** Defensive layering, not a bug.

**Fix:** Add a short SQL comment clarifying the coalesce guards the empty-group edge case.

### IN-04: `DepartmentChipBar` recomputes `selectedSet` every render

**File:** `src/components/DepartmentChipBar.tsx:58`
**Issue:** `const selectedSet = new Set(selected);` on every render. Trivial with N ≤ 8.

**Fix:** `React.useMemo(() => new Set(selected), [selected])`.

### IN-05: `SalesTable` checkbox max-check reads `rowSelection` from closure

**File:** `src/components/SalesTable.tsx:176-178`
**Issue:** Correct in practice because the column memo re-runs when `rowSelection` changes; future-fragile.

**Fix:** Prefer `Object.values(table.getState().rowSelection).filter(Boolean).length`.

### IN-06: `DepartmentRevenueLineChart` aria-label pluralization

**File:** `src/components/DepartmentRevenueLineChart.tsx:143` (also `DepartmentShareStackedBarChart.tsx:109`)
**Issue:** `1 departments · 1 sales` reads poorly for AT.

**Fix:** Guard pluralization with `length === 1 ? 'department' : 'departments'`. Also updates the DepartmentShareStackedBarChart test expectation at line 150.

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard, iteration 2_
