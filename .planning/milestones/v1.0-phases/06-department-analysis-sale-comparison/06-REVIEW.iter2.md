---
phase: 06-department-analysis-sale-comparison
reviewed: 2026-04-23T00:00:00Z
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
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Phase 6 delivers department analytics (DEPT-01/02/03) and sale-comparison (SALE-04/05/06) features. Overall quality is high:

- **Supabase RPCs** (`20260423000000_department_analytics_rpcs.sql`) follow the Phase 4 `kpi_summary` security template exactly — `security definer` with pinned `search_path`, explicit `private.is_admin()` gate, revoke-from-public plus grant-to-authenticated. Parameters are strongly typed (`date`, `text[]`, `int`), and the `nullif(total, 0)` divide-by-zero guard in the share series is correct. **No critical security findings.**
- **TanStack Query hooks** use the frozen-empty-singleton pattern consistently, sort query-key array inputs on a copy (order-insensitive cache hits + tolerates frozen inputs), and include shape guards at the trust boundary before casting `Json → DomainType`.
- **Pure lib functions** (`delta.ts`, `waterfall.ts`, `parse-sales-param.ts`) have thoughtful edge-case handling (flat-threshold, divide-by-zero, null-guards, ordering of validation checks, whitelist-first malformed rejection).
- **Tests** cover both happy path and key edge cases (null avg_sell_through sort-last, empty-dept-codes disables fetch, frozen-input tolerance, round-trip missing sale → invalid URL).

Three warnings relate to accessibility (role override on `<tr>`), absent `aria-live` on a status hint, and a divergence between `DepartmentRevenueLineChart` and `useDepartmentRevenueSeries` that breaks the frozen-singleton stability guarantee. Six info items flag minor polish opportunities.

## Warnings

### WR-01: `<tr role="button">` overrides native row semantics in DepartmentRankingsTable

**File:** `src/components/DepartmentRankingsTable.tsx:322-336`
**Issue:** Each data row sets `role="button"` on the `<tr>` element. ARIA role override on `<tr>` strips the implicit `row` role, which removes the row/column association assistive tech uses to navigate tables. Screen readers will announce each row as a standalone button, losing the "row N of M" context and the "Department", "Sales", "Total revenue" column headers during cell-by-cell traversal. The behavior is visible in the tests themselves: `screen.getAllByRole('button', ...)` returns data rows, meaning no test could ever reach them via `getByRole('row')`.

The toggle-on-click requirement is legitimate (INTR-01 cross-filter), but the standard pattern preserves row semantics.

**Fix:** Keep `<tr>` as a normal row and move the interactive affordance into a leading cell with a button, or use `aria-pressed` + `onClick` on the row without the role override (some AT will still treat it as a row while respecting `aria-pressed`). Example keeping current event handling but preserving row semantics:

```tsx
<tr
  key={row.id}
  data-selected={isSelected}
  tabIndex={0}
  aria-selected={isSelected}
  onClick={() => onToggleSelection(code)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleSelection(code);
    }
  }}
  className={rowClass}
>
  {row.getVisibleCells().map((cell) => (/* … */))}
</tr>
```

If the toggle-as-button semantic is required, add a dedicated `<button>` in a leading cell (e.g. an icon-only "Filter by ASN" button) rather than overriding the row role. Update the tests to query `getByRole('row', { name: /ASN/ })` or the new button.

### WR-02: `DepartmentRevenueLineChart` EMPTY sentinel diverges from the hook's frozen singleton

**File:** `src/components/DepartmentRevenueLineChart.tsx:48`
**Issue:** The component declares a module-local `const EMPTY_ROWS: readonly DepartmentRevenueRow[] = [];` and uses `query.data ?? EMPTY_ROWS` to guard against `undefined`. Meanwhile `useDepartmentRevenueSeries` already returns `EMPTY_REVENUE_SERIES` (a `Object.freeze([])` singleton) for the empty-result case. The net effect is two different empty-array identities in play: `query.data` is the hook's frozen singleton when the query succeeded with zero rows, but `EMPTY_ROWS` is a local non-frozen array used only when `query.data === undefined` (pre-fetch). That mostly works, but:

1. `EMPTY_ROWS` is **not** frozen — a consumer that naively calls `data.push(...)` in a debug session would mutate it silently. Low impact in practice, but breaks the invariant the hook established.
2. Downstream `useMemo([selectedDeptCodes, data])` on line 83 gets two distinct references across a pending→success transition with empty results, triggering `renderableCodes` recomputation (negligible cost but undermines the whole "referential stability for empty results" pattern Phase 5 introduced as WR-08).

**Fix:** Either import the hook's singleton or freeze the local one.

```typescript
// Preferred — re-use the hook's singleton:
// (export EMPTY_REVENUE_SERIES from the hook file, or accept the local one frozen)
const EMPTY_ROWS: readonly DepartmentRevenueRow[] = Object.freeze(
  [],
) as readonly DepartmentRevenueRow[];
```

### WR-03: `maxNotice` status hint is not announced to assistive tech

**File:** `src/pages/Departments.tsx:211-218`
**Issue:** The max-notice paragraph renders `role="status"` but is conditionally mounted (`{maxNotice && (<p role="status">...)}`). Some screen readers (notably JAWS + older NVDA builds) will miss the first announcement when a `role="status"` element is inserted into the DOM after initial render — the region must be present at mount for the `aria-live="polite"` implicit on `status` to fire reliably. The equivalent pattern in `SalesPage` (`WR-03` comment at `Sales.tsx:111-123`) deliberately keeps the region always mounted with `sr-only` toggling.

**Fix:** Always mount the paragraph and toggle visibility via `sr-only` or opacity so AT sees the mutation as a content change rather than an insert.

```tsx
<p
  role="status"
  aria-live="polite"
  className={`text-sm text-gray-500 dark:text-gray-400 transition-opacity duration-200 ${
    maxNotice ? '' : 'sr-only'
  }`}
>
  {maxNotice ?? ''}
</p>
```

## Info

### IN-01: Waterfall transform treats negative-valued deductions as "up" in sign but "down" in color

**File:** `src/lib/waterfall.ts:140-169`
**Issue:** For deduction steps (`commission`, `insurance`, `lot_charges`, `referral_fees`), `signed = -raw`. When `raw` is negative (e.g. a refund recorded as `commission = -100`), `signed` becomes positive and `running` goes up, yet the row still renders with `direction='down'` and `fullLabel: 'Commission'`. The visual bar floor is set to the higher `nextRunning`, so the bar appears to hover above the baseline — visually it looks like a "down" step even though the financial effect was additive. In practice deductions are non-negative per domain convention (SELL fees are always >= 0), and the 457 existing PDFs validate this assumption, but the transform does not defend against the edge case.

**Fix:** Either assert non-negativity on deduction inputs (document as an invariant enforced by the import pipeline) or flip `direction` when `signed < 0` in a deduction column:

```typescript
const actualDirection =
  spec.kind === 'up'
    ? 'up'
    : signed >= 0
      ? 'down'
      : 'up'; // negative deduction → additive
```

Lowest-risk action: add a comment documenting the invariant and a `console.warn` path if a negative deduction slips through. This is a strict-mode correctness nit, not a real bug given current data.

### IN-02: `selectedSaleNumbers.join(',')` in SaleSelectionFooter is unsafe if a `sale_number` ever contains a comma

**File:** `src/components/SaleSelectionFooter.tsx:41-43`
**Issue:** The footer composes the CSV via `selectedSaleNumbers.join(CSV_SEPARATOR)` without validating that individual sale numbers match the `[A-Za-z0-9_-]+` whitelist enforced on the parsing side. If a DB row ever has `sale_number = "24-FALL,SPRING"`, the URL round-trip breaks: the parser splits the comma and sees three tokens instead of two. The failure mode is loud (`parseSalesParam` returns `malformed`), not a silent data corruption — but a nicer UX is to refuse to construct the URL or to percent-encode the separator.

**Fix:** Either add a defensive check before navigation, or URL-encode the tokens individually:

```typescript
const csv = selectedSaleNumbers.map(encodeURIComponent).join(CSV_SEPARATOR);
```

Also update `parseSalesParam` symmetrically if you adopt encoding. Low priority — current sale numbers (22OCT, 2024-01, IT-001) are all whitelist-safe, and no data path writes commas into sale_number today.

### IN-03: `department_rankings` RPC uses `coalesce(sum(sd.revenue), 0)` but `sd.revenue` appears to be non-nullable

**File:** `supabase/migrations/20260423000000_department_analytics_rpcs.sql:60`
**Issue:** The aggregate `coalesce(sum(sd.revenue), 0)::numeric(14,2) as total_revenue` coalesces after sum — which is correct for the "no matching rows" case (sum of empty set is null in Postgres). However, the hook consumer `useDepartmentRankings` says `total_revenue` is "Zero when the dept had rows but no revenue (never null; server coalesces)." The coalesce there is redundant because the `group by department_code` guarantees at least one row per group, but it's defensive and not wrong. Flagging only to confirm the intent was "group-level sum never null" and not to add input-level coalesce.

**Fix:** No code change; consider a short SQL comment clarifying that the coalesce guards the empty-group edge case (impossible here) + defensive layering. Otherwise leave as-is.

### IN-04: `DepartmentChipBar` recomputes `selectedSet` every render

**File:** `src/components/DepartmentChipBar.tsx:58`
**Issue:** `const selectedSet = new Set(selected);` runs on every render. With N ≤ 8 this is trivial, but the parent (`DepartmentsPage`) re-renders frequently (range changes, chip toggles, row clicks). A `useMemo([selected])` would bring the cost to zero on stable inputs.

**Fix:**

```typescript
const selectedSet = React.useMemo(() => new Set(selected), [selected]);
```

Low impact; only worth doing if the memo policy is applied uniformly across the bar.

### IN-05: `SalesTable` checkbox max-check reads `rowSelection` from closure rather than from table state

**File:** `src/components/SalesTable.tsx:176-178`
**Issue:** The `onChange` handler computes `currentCount = Object.values(rowSelection ?? {}).filter(Boolean).length` — reading the *prop* that was captured in the column memo, not the latest `table.getState().rowSelection`. Because the column definition is memoized against `rowSelection` in the deps array (line 199), the closure re-captures on every parent re-render, so this is correct in practice. The risk is non-obvious and relies on the caller always treating `rowSelection` as "controlled state" from a React perspective. If a future refactor ever passes a stale `rowSelection` snapshot (e.g. via a `useRef` without rerender), the max-check will silently miscount.

**Fix:** Prefer `Object.values(table.getState().rowSelection).filter(Boolean).length` which is always the live truth. Add a brief comment either way — "currentCount is correct because the column memo re-runs when rowSelection changes".

### IN-06: `DepartmentRevenueLineChart` aria-label says "departments" / "sales" in plural without guarding for 1

**File:** `src/components/DepartmentRevenueLineChart.tsx:134`
**Issue:** `${renderableCodes.length} departments · ${data.length} sales in range` always pluralizes — aria-label will read "1 departments · 1 sales in range" when there's exactly one series and one sale. Same issue in `DepartmentShareStackedBarChart.tsx:109` and the test expectation at `DepartmentShareStackedBarChart.test.tsx:150` enforces `2 departments plus Other · 1 sales in range`. This is locked in by the test, so a fix would require updating copy + the test. Purely cosmetic for AT readout.

**Fix:**

```typescript
const deptWord = renderableCodes.length === 1 ? 'department' : 'departments';
const saleWord = data.length === 1 ? 'sale' : 'sales';
const ariaLabel = `Department revenue over time — ${renderableCodes.length} ${deptWord} · ${data.length} ${saleWord} in range`;
```

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
