# Phase 5: Trend Analysis - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a `/trends` page with 5 visualizations backed by the existing `sales` + `sale_departments` tables. All charts share a single `<DateRangeFilter>` (presets: YTD / L6M / L12M / L24M / All time, plus custom). Tooltips show exact values on hover for every chart. First use of Recharts in the project.

Charts delivered:
- **TRND-01** net revenue per sale (line + rolling-3-point trend overlay)
- **TRND-02** sell-through per sale (line)
- **TRND-05** estimate accuracy over time (stacked area: below/within/above estimate, derived client-side)
- **TRND-06** bidder participation (dual-axis line: registered_bidders + winning_buyers)
- **TRND-04** department performance heat map (CSS grid, 22 rows × N sales cols, cell = sell_through % or revenue share % via metric toggle)

Out of scope: department comparison side-by-side (Phase 6), sale-vs-sale comparisons (Phase 6), custom chart builder (Phase 9), CSV export of chart data (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Charts Stack
- **Recharts ^3.8.1** (install now; already pinned in CLAUDE.md)
- 8-color categorical palette from Tailwind: `blue-600, emerald-600, amber-600, rose-600, violet-600, cyan-600, orange-600, lime-600`. Gray-400 for axes/grid. Never reuse the Phase 1 accent (`#2563eb`) for chart series — keep accent reservation intact.
- Custom `<ChartTooltip>` component that calls `formatCurrency` / `formatPercent` / `formatDate` (reuse from `src/lib/format.ts`) — dark background, light text, series-color dot + label + value rows
- Loading state: `<ChartSkeleton>` shimmer card at the target dimensions (no layout shift when chart mounts)
- Error state: reuse `<ErrorState>` primitive
- All charts wrapped in Recharts `<ResponsiveContainer width="100%" height={...}>` — fixed px heights per chart type

### Required Charts
- **TRND-01 net revenue line:** x-axis = sale_date, y-axis = net_revenue. Two `<Line>` series: data (solid blue-600) + rolling-3-point mean trend (dashed `strokeDasharray="4 2"`, cyan-600). Trend line derived client-side via simple moving average.
- **TRND-02 sell-through line:** x-axis = sale_date, y-axis = percent (0..100). Single emerald-600 `<Line>`. Same trend overlay pattern as TRND-01.
- **TRND-05 estimate accuracy stacked area:** for each sale, derive 3 values client-side from `sale_departments[]`:
  - above_estimate = `departments where total_sold_value > high_estimate` → count of their `lots_sold` divided by sale's total `lots_sold`
  - within = `departments where low_estimate <= total_sold_value <= high_estimate` → same denominator
  - below = `departments where total_sold_value < low_estimate` → same denominator
  Stacked area (100%) with rose-600/amber-600/emerald-600 bands. Legend at top.
- **TRND-06 bidder participation dual-axis:** `<Line>` for `registered_bidders` on left axis (blue-600), `<Line>` for `winning_buyers` on right axis (orange-600). X-axis = sale_date. Recharts supports `<YAxis yAxisId="left|right" orientation="left|right"/>` natively.

### TRND-04 Heat Map
- Custom CSS grid (not a chart lib). Rows: 22 seeded department codes sorted alphabetically. Cols: sales in range, sorted by sale_date ASC. Cell = `<div>` with `bg-blue-{50|100|200|...|900}` class computed from normalized metric value.
- Metric toggle: segmented control (Sell-through % / Revenue share %) above the heat map. Default: sell-through.
- Normalization: min-max over the cells actually rendered; cells with no data → `bg-gray-50` + hatched pattern
- Cell tooltip on hover: `{dept_code} • {sale_number} — {metric}: {value}`
- Max cols visible at once: scroll horizontally if > 20 sales; sticky first column (dept code) to preserve context on scroll

### Date Range Filter (TRND-03)
- New `<DateRangeFilter>` component at the top of `/trends`. Presets: YTD, L6M, L12M (default), L24M, All time. "Custom" opens two date inputs (native `<input type="date">`) with Apply / Reset buttons.
- Extends `src/lib/period.ts` with a new `Range` type (`{ start: string | null; end: string | null }`) and helper `rangeFromPreset(preset)`
- Filter state lives in the Trends page component; all charts read the same range

### Data Fetching
- **`useSalesInRange(range)`** — `.from('sales').select('*').gte('sale_date', start).lte('sale_date', end).order('sale_date', { ascending: true })` — returns all sales in range sorted chronologically. Used by TRND-01/02/06/05.
- **`useDepartmentGrid(range)`** — `.from('sales').select('sale_number, sale_date, sale_departments(department_code, sell_through_pct, revenue, total_sold_value)').gte('sale_date', start).lte('sale_date', end).order('sale_date', {ascending: true})` — single query embedding dept rows. Used by TRND-04 heat map and TRND-05 stacked area.
- Both hooks use TanStack Query with 5-min staleTime. Query keys: `['sales-range', range]`, `['dept-grid', range]`.
- Empty data (no sales in range): chart renders empty state card "No sales in this range — try expanding the date filter."

### Layout
- New route `/trends` under `<ProtectedRoute>` in App.tsx
- New page `src/pages/Trends.tsx`
- Sidebar "Trends" nav link flips to active (currently "Coming soon" in DashboardLayout)
- Page layout:
  - Header: h1 "Trends" + DateRangeFilter on the right
  - Row 1 (2-col on lg:): TRND-01 + TRND-02
  - Row 2 (1-col full-width): TRND-05 estimate accuracy
  - Row 3 (1-col full-width): TRND-06 bidder participation
  - Row 4 (1-col full-width): TRND-04 heat map with metric toggle
- Responsive: all charts stack to single column below `lg:`

### Claude's Discretion
- Exact Tailwind `bg-blue-{N}` color ramp thresholds for heat map cells (use equal-percentile buckets)
- Exact Recharts props for axis formatting (tick count, label format)
- Whether to add animation via `animationDuration` (Recharts default 1500ms is fine; can shorten to 400ms if feels sluggish)
- Whether rolling trend window is configurable (recommend no; fix at 3 points for v1)
- How to handle missing sale_date in TRND-01/02 data (filter out before charting)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/period.ts` — extend with `Range` type + `rangeFromPreset` (currently Period-only)
- `src/lib/format.ts` — currency/percent/date/delta formatters; chart tooltips reuse
- `src/lib/supabase.ts`, `src/db/database.types.ts`
- `src/hooks/useSales.ts` / `useSale.ts` — pattern reference
- `src/components/ErrorState.tsx`, `EmptyState.tsx`, `TableSkeleton.tsx` (shimmer pattern) — reuse
- `src/components/PeriodSelector.tsx` (Phase 4) — visual reference for segmented control
- `src/layouts/DashboardLayout.tsx` — sidebar nav; "Trends" link flips from Coming Soon to active NavLink at `/trends`

### Established Patterns
- TanStack Query v5 + `useMemo` derivation pattern
- Zustand not needed (filter state is local to Trends page)
- Hand-authored Tailwind v4, no shadcn
- Vitest + Testing Library — add `@testing-library/jest-dom` `toBeVisible`/`toHaveTextContent` assertions; Recharts tests generally rely on `getByRole('img')` and `data-*` attrs
- Security: RLS admin-only on `sales` + `sale_departments` (Phase 1) covers all Phase 5 queries

### Integration Points
- New dep: `recharts@^3.8.1` (CLAUDE.md pinned)
- DashboardLayout: flip Trends link to active
- App.tsx: add `/trends` route under ProtectedRoute

</code_context>

<specifics>
## Specific Ideas

- Components to create:
  - `src/components/DateRangeFilter.tsx`
  - `src/components/ChartTooltip.tsx`
  - `src/components/ChartSkeleton.tsx`
  - `src/components/NetRevenueTrendChart.tsx` (TRND-01)
  - `src/components/SellThroughTrendChart.tsx` (TRND-02)
  - `src/components/EstimateAccuracyChart.tsx` (TRND-05)
  - `src/components/BidderParticipationChart.tsx` (TRND-06)
  - `src/components/DepartmentHeatMap.tsx` (TRND-04)
- Hooks: `src/hooks/useSalesInRange.ts`, `src/hooks/useDepartmentGrid.ts`
- Lib: extend `src/lib/period.ts` with Range + helpers; new `src/lib/chart-colors.ts` (8-color palette constant)
- Page: `src/pages/Trends.tsx`

</specifics>

<deferred>
## Deferred Ideas

- Cross-chart brushing (select a date range in one chart → filters others): Phase 9
- Click a department row in the heat map → drill into `/sales/:n`: Phase 6 will add this
- Export chart PNG: Phase 8
- URL-persisted date range: nice-to-have; Phase 9 may address

</deferred>
