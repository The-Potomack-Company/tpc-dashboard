# Phase 6: Department Analysis & Sale Comparison - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship three user-visible capabilities that build on the Phase 3 sale tables and the Phase 5 chart system:

1. **`/departments` standalone page** — department rankings table + multi-line revenue-over-time chart + stacked 100% department-share bar chart. Covers DEPT-01, DEPT-02, DEPT-03. Shares the Phase 5 `<DateRangeFilter>` (L12M default).
2. **`/sales/compare?sales=...` page** — 2–4 sales compared side-by-side as a metrics-as-rows, sales-as-columns table with adjacent-pair color-coded deltas. Covers SALE-04 and SALE-05. Selection UI lives on the existing `/sales` table via row checkboxes + sticky "Compare (N)" footer.
3. **Revenue Waterfall** — new collapsible section on the existing Sale Detail page showing the path hammer → buyer premium → commission → insurance → lot charges → referral fees → net revenue. Covers SALE-06.
4. **INTR-01 cross-filtering** — scoped to the `/departments` page only for v1. Clicking a row in the ranked table dims non-matching series in the two charts on that page; clear via click-again or a "Clear filter" chip.
5. **Sidebar nav** — flip the "Departments" sidebar entry from Coming Soon to an active NavLink. Team / Reports / Custom Charts remain placeholders.

Out of scope: cross-filter propagation across `/trends`, `/sales`, or the dashboard home; custom chart builder (Phase 9); CSV/PDF export (Phase 8); any charts on the comparison page (v1 stays tabular).

</domain>

<decisions>
## Implementation Decisions

### Routing & Page Structure
- `/departments` — new standalone page under `<ProtectedRoute>` in `App.tsx`. Component: `src/pages/Departments.tsx`.
- `/sales/compare` — new standalone page under `<ProtectedRoute>`. Component: `src/pages/SaleCompare.tsx`. Reads `?sales=2024-01,2024-02,...` from `useSearchParams`. Shareable / bookmarkable.
- **Revenue Waterfall** — new section on `src/pages/SaleDetail.tsx` below the existing Department Table. Collapsible; collapsed by default. Title: "Revenue Breakdown". Fixed ~320px chart height when expanded.
- `DashboardLayout.tsx`: convert the "Departments" nav entry from an `aria-disabled` span into an active `NavLink to="/departments"` using the same pattern Phase 5 used for Trends. Team / Reports / Custom Charts remain Coming Soon placeholders.

### Department Analysis (DEPT-01, DEPT-02, DEPT-03)
- **Ranking metric selector** — reuse the Phase 5 `<MetricToggle>` pattern (segmented control styling) with three options: `Revenue` | `Sell-through` | `Lots above estimate`. Default: `Revenue`. Component: new `<DeptRankingMetricToggle>` in `src/components/`.
- **DEPT-01 rankings table** — TanStack Table v8 (headless). Columns: `Department` (code + display_name), `Sales count`, `Total revenue`, `Avg sell-through %`, `Lots above estimate`. Every numeric column sortable (toggle asc/desc/unsorted). Default sort: the currently-selected ranking metric DESC. Text filter on department name/code (reuse `<FilterInput>` from Phase 3). Reuse `<SortIndicator>` from Phase 3.
- **DEPT-02 multi-line chart** — Recharts `<LineChart>`. X-axis = `sale_date`, Y-axis = revenue per sale. One `<Line>` per selected department using the Phase 5 8-color palette (`src/lib/chart-colors.ts`). Department selection: chip-bar above the chart. Each chip is a clickable toggle; selected chips get a colored dot matching the line color. Default selection: top-5 by revenue in the current range. Max simultaneous: 8 (palette size); 9th chip click shows a non-blocking warning ("Max 8 departments — deselect one first"). Cap is a hard cap on palette reuse.
- **DEPT-03 stacked 100% bar chart** — Recharts `<BarChart>` with each `<Bar stackId="share">` summing to 100. X-axis = sale_date (ordered ASC), Y-axis = 0–100%. Colors from the 8-color palette. Render top-8 departments by revenue in the current range + an "Other" aggregated segment (gray-400) so the legend is legible. Legend at top.
- **Data hooks** — new hooks in `src/hooks/`:
  - `useDepartmentRankings(range, metric)` → returns one row per department with pre-aggregated `sales_count`, `total_revenue`, `avg_sell_through`, `lots_above_estimate` for sales in range. Uses `sales` + `sale_departments` joins via Supabase embedded select (mirrors `useDepartmentGrid` from Phase 5). **Per INFR-04 all aggregation runs server-side via Postgres RPCs** (not JS reduction over returned rows). New RPC `department_rankings(range_start, range_end)` added in a migration; policy-wrapped for `authenticated` role; uses the same admin-only RLS posture.
  - `useDepartmentRevenueSeries(range, deptCodes[])` → returns `{ sale_date, [dept_code]: revenue }[]` for the line chart. One RPC `department_revenue_series(range_start, range_end, dept_codes text[])`.
  - `useDepartmentShareSeries(range, topN)` → returns `{ sale_date, [dept_code|'other']: share_pct }[]` where `share_pct` is each dept's % of total sale revenue. One RPC `department_share_series(range_start, range_end, top_n int)`.
- **Cross-filter state** — `useState<string | null>(selectedDept)` at the Departments page level. When non-null:
  - Rankings table row: matching row gets `bg-accent/5` + left border; other rows unchanged
  - Multi-line chart: matching line stays at `opacity=1`, others drop to `opacity=0.2`
  - Stacked bar: matching segment stays fully saturated, others drop to `opacity=0.3`
  - Clear UI: "Clear filter" chip beside the range filter, only visible when `selectedDept` is non-null. Clicking same row again also clears.

### Sale Comparison (SALE-04, SALE-05)
- **Selection UI on `/sales`** — add a leading checkbox column to the existing `<SalesTable>`. Selection state lives in the `SalesPage` component (local `useState<Set<string>>`). When ≥2 selected, a sticky footer bar appears at the bottom of the page with `Compare (N)` on the right (button, not a link — it navigates programmatically to `/sales/compare?sales=<csv>`) and a `Clear selection` text link on the left. Max 4: 5th click shows a non-blocking toast/inline hint "Max 4 sales"; the row does not become selected. Checkbox column does not break existing sort/filter behavior.
- **Comparison layout** — metrics as rows, sales as columns. Sticky first column = metric label + unit. Rows cover every All-Departments metric parsed from the PDF (mirror `<SaleSummaryCard>`): `Lots auctioned`, `Lots sold`, `Lots unsold`, `Sell-through %`, `Total sold value`, `Total unsold value`, `Low estimate`, `High estimate`, `Total reserves`, `Hammer total`, `Buyer premium`, `Commission`, `Insurance`, `Lot charges`, `Referral fees`, `Net revenue`, `Registered bidders`, `Winning buyers`. Plus a "Sale metadata" group at the top: `Sale date`, `Title`, `Payment status` (no delta on metadata rows).
- **Delta color coding (SALE-05)** — adjacent-pair deltas: column 2 shows `+12.4%` vs column 1, column 3 shows delta vs column 2, etc. (not "all vs baseline"). Green (`text-emerald-600`) for up, red (`text-rose-600`) for down, gray (`text-gray-400`) for equal-to-within-0.05%. Deltas render under the metric value in each cell (small text, tabular-nums). Only numeric metric rows get deltas; metadata rows do not.
- **Invalid URL handling** — if `?sales=` has <2 or >4 entries, or any sale_number fails a lookup, render an error card: "Invalid comparison. Select 2–4 sales from the sales page." with a `Back to sales` link.
- **Data hook** — `useSalesComparison(saleNumbers: string[])` → returns `{ sales: Sale[] }` ordered by the input array order. Single query: `.in('sale_number', saleNumbers)`. Uses TanStack Query with 5-min staleTime. Query key: `['sales-comparison', saleNumbers.slice().sort()]` (sorted for cache hit regardless of order).

### Revenue Waterfall (SALE-06)
- **Chart implementation** — Recharts `<BarChart>` with the standard "invisible padding" pattern. Each step has a transparent `<Bar dataKey="base">` + visible `<Bar dataKey="delta">`, both with `stackId="waterfall"`. Client-side running-total derivation is straightforward; no library needed. Seven steps for v1:
  1. `Hammer total` (positive total, blue-600)
  2. `+ Buyer premium` (positive step, emerald-600)
  3. `− Commission` (negative step, rose-600)
  4. `− Insurance` (negative step, rose-600)
  5. `− Lot charges` (negative step, rose-600)
  6. `− Referral fees` (negative step, rose-600)
  7. `Net revenue` (positive total, blue-600)
  - Tooltips via existing `<ChartTooltip>` showing step name + delta amount + running total. X-axis labels abbreviated ("Hammer", "+Premium", "-Commission", ...); full names in tooltip.
- **Waterfall rendering** — new section on `src/pages/SaleDetail.tsx`, ordered after the Department Table. Wrapped in `<ChartCard title="Revenue Breakdown">` with a collapse/expand toggle button in the header action slot (chevron icon + `aria-expanded`). Collapsed by default. Height: 320px when expanded. New component: `src/components/RevenueWaterfallChart.tsx`. No new data fetching — consumes the existing `sale` object already loaded by `useSale(saleNumber)`.

### Claude's Discretion
- Exact TanStack Table styling details (header padding, row hover) — match Phase 3 conventions
- Chart animation durations (Recharts default 1500ms; consider shortening to ~400ms to match Phase 5 norms if that's what Phase 5 settled on)
- Whether to memo-ize the adjacent-pair delta computation (likely yes for 4 columns × ~20 rows)
- Exact sticky-footer styling for the `/sales` selection bar (match Phase 3 sidebar language and `border-t`/shadow treatment)
- Whether the collapsible "Revenue Breakdown" state persists in URL/localStorage (recommend no for v1 — default collapsed, don't persist)
- Server-side RPC parameter naming conventions (align with Phase 2's `import_sale_with_departments` style)
- Animation / transition on cross-filter opacity changes (recommend `transition-opacity duration-200`)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phases 1–5)
- `src/lib/supabase.ts` — admin client + lazy proxy
- `src/lib/format.ts` — `formatCurrency`, `formatPercent`, `formatDate`, `formatDelta`
- `src/lib/period.ts` — `Range` type, `rangeFromPreset`, `DEFAULT_RANGE_PRESET` (L12M)
- `src/lib/chart-colors.ts` — 8-color categorical palette (use exactly the same order so department colors remain stable across screens)
- `src/components/DateRangeFilter.tsx` — drop into the `/departments` page header
- `src/components/ChartCard.tsx` — standard chart wrapper (supports `title`, `subtitle`, `height`, `actions` slot)
- `src/components/ChartTooltip.tsx` — reuse for waterfall + multi-line
- `src/components/ChartSkeleton.tsx` — loading state
- `src/components/EmptyState.tsx`, `ErrorState.tsx` — page-level error/empty handling
- `src/components/MetricToggle.tsx` — direct reference for the ranking metric segmented control
- `src/components/SortIndicator.tsx`, `src/components/FilterInput.tsx` — rankings table sort/filter UI
- `src/components/SalesTable.tsx` — extend with selection checkboxes (leading column)
- `src/components/DepartmentTable.tsx` — layout reference; NOT extended because departments ranking is cross-sale, not per-sale
- `src/hooks/useSales.ts`, `useSale.ts`, `useSalesInRange.ts`, `useDepartmentGrid.ts` — hook pattern reference (TanStack Query v5, 5-min staleTime, typed Row return)
- `src/db/database.types.ts` — regenerate after adding the 3 new RPCs so they're typed

### Established Patterns
- TanStack Query v5 + `useMemo` client derivation where cheap; server-side aggregation via Postgres RPC where INFR-04 requires it
- Zustand not needed for Phase 6 — cross-filter state is local to `/departments` page; selection state is local to `/sales` page
- Hand-authored Tailwind v4; no shadcn
- Vitest + Testing Library; Recharts tests query `data-*` attrs or use `container.querySelector` on SVG
- Security: existing admin-only RLS on `sales` + `sale_departments` (Phase 1) covers all reads. New RPCs must be defined with `security_invoker` OR explicitly grant `EXECUTE` to `authenticated` so RLS flows through.
- Migrations: additive only. New RPCs in a single migration under `supabase/migrations/`.

### Integration Points
- `src/App.tsx` — add `/departments` and `/sales/compare` routes under `<ProtectedRoute>` → `<DashboardLayout>`
- `src/layouts/DashboardLayout.tsx` — flip "Departments" entry from Coming Soon to active NavLink
- `src/pages/SalesPage.tsx` (via `SalesTable`) — add selection checkbox col + sticky footer
- `src/pages/SaleDetail.tsx` — append collapsible Revenue Breakdown section
- `src/db/database.types.ts` — regenerated via `supabase gen types` after the RPC migration lands

</code_context>

<specifics>
## Specific Ideas

### New files (Phase 6)
- `src/pages/Departments.tsx` (`/departments` page)
- `src/pages/SaleCompare.tsx` (`/sales/compare` page)
- `src/components/DeptRankingMetricToggle.tsx`
- `src/components/DepartmentRankingsTable.tsx`
- `src/components/DepartmentRevenueLineChart.tsx` (DEPT-02)
- `src/components/DepartmentShareStackedBarChart.tsx` (DEPT-03)
- `src/components/DepartmentChipBar.tsx` (multi-select chips above DEPT-02)
- `src/components/ComparisonTable.tsx`
- `src/components/SaleSelectionFooter.tsx` (sticky footer on /sales)
- `src/components/RevenueWaterfallChart.tsx`
- `src/hooks/useDepartmentRankings.ts`
- `src/hooks/useDepartmentRevenueSeries.ts`
- `src/hooks/useDepartmentShareSeries.ts`
- `src/hooks/useSalesComparison.ts`
- `src/lib/waterfall.ts` (running-total + transparent-padding transform)
- `src/lib/delta.ts` (adjacent-pair delta + color class helper)

### Modified files
- `src/App.tsx` — 2 new routes
- `src/layouts/DashboardLayout.tsx` — Departments nav flip
- `src/components/SalesTable.tsx` — selection checkbox column + exposed `selected` + `onSelectionChange` props
- `src/pages/Sales.tsx` — own selection state, render `<SaleSelectionFooter>` when count ≥ 1
- `src/pages/SaleDetail.tsx` — append Revenue Breakdown section

### New migration
- `supabase/migrations/<timestamp>_department_analytics_rpcs.sql` — three RPCs (`department_rankings`, `department_revenue_series`, `department_share_series`), plus EXECUTE grant to `authenticated` + `service_role`

### Tests (Vitest + RTL, co-located)
- `DepartmentRankingsTable.test.tsx` — sort per-column, text filter, row highlight on click (cross-filter)
- `DepartmentRevenueLineChart.test.tsx` — renders one `<Line>` per selected dept, dims when cross-filter active
- `DepartmentShareStackedBarChart.test.tsx` — renders top-8 + Other, stack sums to 100
- `ComparisonTable.test.tsx` — 2/3/4-column cases, delta colors for each direction, metadata rows show no delta
- `RevenueWaterfallChart.test.tsx` — step order, running total matches net_revenue, up/down colors correct
- `delta.test.ts`, `waterfall.test.ts` — pure-function unit tests
- `useDepartmentRankings.test.ts` — mocked supabase RPC return + sort stability

</specifics>

<deferred>
## Deferred Ideas

- Cross-filter propagation across `/trends`, `/sales`, and dashboard home (scope limit v1 to `/departments`)
- Charts on the comparison page (per-sale mini-waterfall, mini-donut) — revisit post-v1 based on user feedback
- URL-persisted cross-filter selected department on `/departments` — v2
- Saving comparison sets ("my comparisons") — Phase 8 reporting may subsume this
- Animating comparison column additions/removals (fade-in new columns) — v2 polish
- Column reorder (drag-and-drop sales between columns) on the comparison page — out of scope for v1
- Waterfall drill-down (click a step to see contributing departments) — v2

</deferred>
