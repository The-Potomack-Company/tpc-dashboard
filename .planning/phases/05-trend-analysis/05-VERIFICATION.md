---
phase: 05-trend-analysis
verified: 2026-04-23T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /trends in a browser with real Supabase data. Confirm the net revenue line chart renders a visible data series (solid blue-600 line) alongside a dashed cyan-600 rolling-3 trend overlay. Hover over data points and confirm the ChartTooltip shows sale date, sale number, and net revenue formatted as currency."
    expected: "Two distinct lines render; tooltip appears on hover with formatted values; no console errors."
    why_human: "Recharts SVG rendering, hover/pointer events, and tooltip display require a live DOM + real Supabase data. Tests mock ResponsiveContainer and assert role=img aria-label only."
  - test: "Open /trends. Confirm the sell-through chart renders a percent-formatted y-axis (0%–100%) with an emerald-600 series and a cyan-600 dashed trend. Hover a point and verify the tooltip shows sell-through as a percentage."
    expected: "Y-axis ticks show percent labels; emerald series + cyan dashed trend visible; tooltip correct."
    why_human: "Same as above — Recharts SVG + live data needed."
  - test: "Click each DateRangeFilter preset (YTD, L6M, L12M, L24M, All time) and confirm all five charts visibly update (or show EmptyState when no data). Click Custom, enter a valid start/end date pair, click Apply range, and confirm the charts update. Enter a start date later than the end date, click Apply, and confirm the inline error alert appears and charts do NOT change."
    expected: "Preset clicks update charts; custom range applies correctly; invalid range shows error copy 'Start date must be on or before end date.'"
    why_human: "Chart re-query side-effect after filter change requires live Supabase + browser rendering."
  - test: "Open /trends and scroll to the Department performance heat map. Confirm 22 department rows render alphabetically (AMER first, TXTL last) with N sale columns. Hover a colored cell and confirm the native tooltip shows '{dept_code} • {sale_number} — Sell-through: {pct}'. No-data cells should show a hatched gray pattern."
    expected: "Full 22-row × N-col grid; tooltip copy matches documented format; no-data hatch visible."
    why_human: "CSS grid layout, visual color ramp, native title tooltip, and 22-row render correctness require a real browser."
  - test: "On the department heat map, click 'Revenue share %' in the MetricToggle (top-right of the heat map card). Confirm the cell colors shift to reflect revenue share values and no-data cells remain hatched."
    expected: "Metric toggle switches cell values; color ramp updates; no JS errors."
    why_human: "Visual metric switch requires live DOM and real data."
  - test: "Verify the estimate accuracy stacked-area chart renders three distinct color bands (amber below, emerald within, rose above) that sum to ~100% at each x position. Hover and confirm tooltip shows per-band percentages."
    expected: "Three stacked area bands visible; stackOffset=expand normalization works; tooltip shows formatted percents."
    why_human: "Recharts AreaChart rendering + real sale_departments data required."
  - test: "Verify the bidder participation chart renders two separate y-axes (left for registered bidders in blue, right for winning buyers in orange) and that the scales differ visually when the two series have different magnitudes."
    expected: "Dual-axis renders correctly; both series visible; tooltip shows headcount (not percent)."
    why_human: "Recharts dual-YAxis layout requires a real browser + data with differing magnitudes."
---

# Phase 5: Trend Analysis Verification Report

**Phase Goal:** Users can visualize how auction performance changes over time across multiple dimensions — net revenue per sale with a rolling-3 trend overlay, sell-through per sale, estimate accuracy bands (below/within/above), bidder participation dual-axis, and a department performance heat map — all filterable via a shared L12M-default DateRangeFilter with presets + custom range and tooltips showing exact values on hover.
**Verified:** 2026-04-23
**Status:** human_needed
**Re-verification:** No — initial verification (retroactive)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view net revenue per sale over time as a line chart with a visible trend line | VERIFIED | `src/components/NetRevenueTrendChart.tsx` — Recharts LineChart with `dataKey="net_revenue"` (CHART_PALETTE[0] solid) + `dataKey="rolling_avg_3"` (CHART_PALETTE[5] dashed, strokeDasharray="4 2") computed via `computeRollingMean(values, 3)`. Wired to `useSalesInRange(range)` with live Supabase query. 6 tests in `src/components/NetRevenueTrendChart.test.tsx` + 7 tests in `src/lib/rolling-avg.test.ts` — all 644 suite tests pass. |
| 2 | User can view sell-through rate over time as a line chart | VERIFIED | `src/components/SellThroughTrendChart.tsx` — Recharts LineChart with client-side derived `lots_sold / lots_auctioned` ratio (CHART_PALETTE[1] emerald, domain=[0,1]) + rolling-3 trend overlay (CHART_PALETTE[5] dashed). Wired to `useSalesInRange(range)`. 6 tests pass. |
| 3 | User can filter all trend views by date range using presets (YTD, L12M, L24M, all time) or a custom range picker | VERIFIED | `src/components/DateRangeFilter.tsx` — 5-preset WAI-ARIA radiogroup (YTD/L6M/L12M/L24M/All time) + Custom disclosure panel with `<input type="date">` start/end, Apply/Reset buttons, and inline `<p role="alert">` validation. State lives in `src/pages/Trends.tsx` as `useState<Range>(() => rangeFromPreset(DEFAULT_RANGE_PRESET))` (defaults to l12m). Flows as `range` prop to all 5 chart components simultaneously. 21 tests in `src/tests/date-range-filter.test.tsx` pass. |
| 4 | User can view a department performance heat map (rows = departments, columns = sales, color intensity = sell-through or revenue) | VERIFIED | `src/components/DepartmentHeatMap.tsx` — CSS grid with `SORTED_DEPT_CODES` (22 alphabetical rows) × N sale columns, cells colored via `bucketClassFor()` 5-bucket blue-ramp from `src/lib/heat-map-bucket.ts`. MetricToggle in ChartCard action slot switches between `sell_through` (pct/100) and `revenue_share` (dept.revenue/totalSaleRevenue). Native `title` tooltips. Wired to `useDepartmentGrid(range)`. 25 tests pass. |
| 5 | Charts display tooltips with exact values on hover | VERIFIED | `src/components/ChartTooltip.tsx` — custom Recharts Tooltip content component with dark-surface styling, color-dot + label + formatted value rows. Used by NetRevenueTrendChart (formatCurrency), SellThroughTrendChart (formatPercent), EstimateAccuracyChart (formatPercent), BidderParticipationChart (formatCount). Heat map uses native `title` attributes. `ChartTooltip` tested by 11 cases in `src/tests/chart-tooltip.test.tsx`. INTR-03 covered across all 5 charts. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/chart-colors.ts` | CHART_PALETTE (8 hex) + 5 constants | VERIFIED | Exports `CHART_PALETTE` (8-element const tuple), `CHART_GRID_STROKE`, `CHART_AXIS_TICK_FILL`, `CHART_TOOLTIP_BG`, `CHART_TOOLTIP_TEXT`, `CHART_TOOLTIP_LABEL`. 8 tests pin every hex value. |
| `src/lib/period.ts` | Range + rangeFromPreset + DEFAULT_RANGE_PRESET added; Phase 4 exports preserved | VERIFIED | Exports `RangePreset`, `Range`, `rangeFromPreset`, `DEFAULT_RANGE_PRESET = 'l12m'`. Phase 4 exports (`Period`, `PeriodBounds`, `computePeriodBounds`, `toIsoDateLocal`) untouched. 11 new period tests + regression guard pass. |
| `src/components/ChartCard.tsx` | Semantic section wrapper with title/subtitle/action/height slots | VERIFIED | `<section>` with `<header>` containing `<h2>`, optional subtitle `<p>`, and action slot. `height='sm'` → `h-80`; `'lg'` → `h-[400px]`. No Recharts import. 10 tests pass. |
| `src/components/ChartTooltip.tsx` | Recharts custom tooltip with dark surface | VERIFIED | Returns null when `!active` or payload empty. Header via `headerFormatter` prop. Color-dot + label + value rows. `aria-live="polite"`. 11 tests pass. |
| `src/components/ChartSkeleton.tsx` | Pulse shimmer matching ChartCard height | VERIFIED | `height='sm'` → `h-80`; `'lg'` → `h-[400px]`. Three pulse bars including body with `aria-label="Loading chart"`. `motion-safe:animate-pulse`. 5 tests pass. |
| `src/components/DateRangeFilter.tsx` | 5-preset radiogroup + Custom disclosure | VERIFIED | Controlled; 5 preset radios (WAI-ARIA) + Custom toggle (aria-expanded + aria-haspopup="dialog") + disclosure panel with date inputs, Apply/Reset, inline alert. 21 tests pass. |
| `src/components/MetricToggle.tsx` | 2-option radiogroup for heat map metric | VERIFIED | Exports `HeatMapMetric = 'sell_through' \| 'revenue_share'`. 2-option WAI-ARIA radiogroup, keyboard nav. 13 tests pass. |
| `src/hooks/useSalesInRange.ts` | TanStack Query hook with range predicates | VERIFIED | Query key `['sales-range', range.start, range.end]`. Conditional `.gte`/`.lte` predicates (null → omit). `keepPreviousData`, `staleTime: 5min`. Frozen empty-array singleton. 5 tests pass. |
| `src/hooks/useDepartmentGrid.ts` | TanStack Query hook with embedded sale_departments | VERIFIED | PostgREST select embeds `sale_departments(...)`. `DeptGridRow`/`DeptGridDept` types hand-authored. Same query options as useSalesInRange. 6 tests pass. |
| `src/lib/rolling-avg.ts` | computeRollingMean helper | VERIFIED | Window-3 arithmetic mean with null-poisoning semantics, immutability, throws on window<1. 7 tests covering edge cases pass. |
| `src/lib/estimate-accuracy.ts` | computeAccuracyBands pure function | VERIFIED | Returns `AccuracyBands \| null`. Inclusive estimate bounds; null paths for null/zero saleLotsSold and all-skipped depts. 8 tests pass. |
| `src/lib/heat-map-bucket.ts` | bucketClassFor + SORTED_DEPT_CODES | VERIFIED | 22 alphabetical dept codes (frozen); `bucketClassFor` 5-bucket min-max ramp; `NO_DATA_CELL_CLASS`/`NO_DATA_CELL_STYLE`. 14 tests pass including boundary cases. |
| `src/components/NetRevenueTrendChart.tsx` | TRND-01 line chart with trend overlay | VERIFIED | Two Line series (solid blue-600 + dashed cyan-600). `useSalesInRange` + `computeRollingMean(values, 3)`. ChartTooltip with formatCurrency. role="img" wrapper. 6 tests pass. |
| `src/components/SellThroughTrendChart.tsx` | TRND-02 sell-through line chart | VERIFIED | Client-side `lots_sold / lots_auctioned` ratio. Emerald-600 + cyan-600 dashed trend. domain=[0,1]. formatPercent tooltip. 6 tests pass. |
| `src/components/EstimateAccuracyChart.tsx` | TRND-05 stacked-area estimate accuracy | VERIFIED | AreaChart with stackOffset="expand", three Area bands (amber/emerald/rose). `computeAccuracyBands` via `useDepartmentGrid`. ChartTooltip with formatPercent. Legend. 6 tests pass. |
| `src/components/BidderParticipationChart.tsx` | TRND-06 dual-axis bidder participation | VERIFIED | LineChart with two YAxis (left/right), blue-600 registered_bidders + orange-600 winning_buyers. formatCount. connectNulls=false. 6 tests pass. |
| `src/components/DepartmentHeatMap.tsx` | TRND-04 CSS grid heat map | VERIFIED | role="grid" with 22 dept rowheaders + N sale columnheaders. 5-bucket blue ramp. Metric-prop controlled. Sticky first column + overflow-x-auto. Native title tooltips. 11 tests pass. |
| `src/pages/Trends.tsx` | /trends page composing all 5 charts | VERIFIED | `TrendsPage` with `DateRangeFilter` + 5 `ChartCard` wrappers in UI-SPEC order (TRND-01/02 two-column row, then TRND-05/06/04 full-width). MetricToggle in ChartCard action slot. 10 integration tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/Trends.tsx` | `src/App.tsx` | `<Route path="/trends" element={<TrendsPage />}>` under `ProtectedRoute` | WIRED | `src/App.tsx` line 22: `<Route path="/trends" element={<TrendsPage />} />` inside ProtectedRoute + DashboardLayout group |
| `src/pages/Trends.tsx` | `src/layouts/DashboardLayout.tsx` | Sidebar NavLink `to: "/trends"` | WIRED | `DashboardLayout.tsx` line 82: `{ label: "Trends", to: "/trends", Icon: IconChartBar }` — "Coming soon" variant removed per plan 05-07 |
| `src/components/NetRevenueTrendChart.tsx` | `src/hooks/useSalesInRange.ts` | `useSalesInRange(range)` import | WIRED | Import at top; called in component body with `range` prop |
| `src/components/SellThroughTrendChart.tsx` | `src/hooks/useSalesInRange.ts` | `useSalesInRange(range)` import | WIRED | Same pattern as TRND-01 |
| `src/components/BidderParticipationChart.tsx` | `src/hooks/useSalesInRange.ts` | `useSalesInRange(range)` import | WIRED | Same pattern |
| `src/components/EstimateAccuracyChart.tsx` | `src/hooks/useDepartmentGrid.ts` | `useDepartmentGrid(range)` import | WIRED | Import + call wired; bands derived via `computeAccuracyBands` |
| `src/components/DepartmentHeatMap.tsx` | `src/hooks/useDepartmentGrid.ts` | `useDepartmentGrid(range)` import | WIRED | Import + call wired; cell values via `prepareCells(data, metric)` |
| `src/components/DateRangeFilter.tsx` | `src/lib/period.ts` | `rangeFromPreset + Range type` | WIRED | Import at line 19: `from '../lib/period'` — confirmed in source |
| `src/components/NetRevenueTrendChart.tsx` | `src/components/ChartTooltip.tsx` | `<Tooltip content={<ChartTooltip .../>}>` | WIRED | ChartTooltip imported and composed as Recharts Tooltip content prop |
| `src/hooks/useSalesInRange.ts` | Supabase `sales` table | `.from('sales').select('*').gte/.lte/.order` | WIRED | Real DB query; conditional predicates for range.start/end |
| `src/hooks/useDepartmentGrid.ts` | Supabase `sales`+`sale_departments` | PostgREST embedded select | WIRED | Real DB query with embedded relation string |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NetRevenueTrendChart` | `chartData` (ChartRow[]) | `useSalesInRange` → Supabase `sales` `.select('*')` | Yes — parameterized .gte/.lte on `sale_date`; returns real rows | FLOWING |
| `SellThroughTrendChart` | `chartData` (ChartRow[]) | `useSalesInRange` → same query | Yes | FLOWING |
| `EstimateAccuracyChart` | `chartData` (AccuracyPoint[]) | `useDepartmentGrid` → Supabase embedded query on `sales + sale_departments` | Yes — real DB rows with `total_sold_value`, `low_estimate`, `high_estimate` | FLOWING |
| `BidderParticipationChart` | `chartData` (ParticipationPoint[]) | `useSalesInRange` → same sales query | Yes — `registered_bidders`, `winning_buyers` fields | FLOWING |
| `DepartmentHeatMap` | `cells` (Record<string, number\|null>) | `useDepartmentGrid` → same embedded query | Yes — `sell_through_pct` / `revenue` fields | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Phase 5 delivers a browser-rendered React app. No runnable CLI entry points or API endpoints are independently checkable without a running dev server and Supabase credentials. Visual and data-flow behaviors are routed to human verification above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRND-01 | 05-04-PLAN | User can view net revenue per sale over time as a line chart with trend line | SATISFIED | `NetRevenueTrendChart.tsx` — two Line series (primary + rolling-3); wired to `useSalesInRange`. Tests 43f0c35. |
| TRND-02 | 05-04-PLAN | User can view sell-through rate per sale over time as a line chart | SATISFIED | `SellThroughTrendChart.tsx` — client-side `lots_sold/lots_auctioned` ratio + trend; wired to `useSalesInRange`. Tests 896852a. |
| TRND-03 | 05-02-PLAN | User can filter all trend views by date range (presets + custom) | SATISFIED | `DateRangeFilter.tsx` — 5 preset radios + Custom disclosure panel; state flows to all 5 charts via Trends page; `DEFAULT_RANGE_PRESET = 'l12m'`. Tests be39dfb. |
| TRND-04 | 05-06-PLAN | User can view a department performance heat map | SATISFIED | `DepartmentHeatMap.tsx` — 22-row × N-col CSS grid; 5-bucket blue ramp; metric toggle (sell_through / revenue_share); sticky first col. Tests d71cc5d. |
| TRND-05 | 05-05-PLAN | User can view estimate accuracy over time (stacked area) | SATISFIED | `EstimateAccuracyChart.tsx` — AreaChart stackOffset="expand" with below/within/above bands via `computeAccuracyBands`. Tests ccadb5d. |
| TRND-06 | 05-05-PLAN | User can view bidder participation trends (registered bidders + winning buyers) | SATISFIED | `BidderParticipationChart.tsx` — dual-axis LineChart; left/right YAxis; blue-600 + orange-600. Tests f3591ca. |
| INTR-03 | 05-01-PLAN / 05-04/05 | Charts display tooltips with exact values on hover | SATISFIED | `ChartTooltip.tsx` used by all 4 Recharts charts; `DepartmentHeatMap` uses native `title` attribute. ChartTooltip tests fa5b255; chart-level tests assert role=img presence. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODOs, FIXME, placeholder comments, empty implementations, or hardcoded empty arrays that reach rendering in any Phase 5 production file. All `return []` occurrences are initial-load guards before data arrives, not persistent stubs. | — | — |

Anti-pattern scan notes:
- `return []` in chart components' `useMemo` callbacks are guarded by `if (!hook.data) return []` — these are initial-load-only states, not stubs. Each hook uses `keepPreviousData` so the empty path only fires on first mount before data arrives.
- Frozen empty-array singletons (`EMPTY_SALES_IN_RANGE`, `EMPTY_GRID`) in hooks follow the WR-08 reference-stability pattern, not placeholder stubs — they are replaced by real data once the Supabase query resolves.
- No `console.log`-only implementations found.
- No hardcoded empty props at call sites.

### Human Verification Required

See frontmatter `human_verification` section above for the full list. Summary:

1. **Net revenue chart visual rendering + tooltip** — browser + real data needed to confirm SVG renders and hover tooltip works
2. **Sell-through chart visual rendering + tooltip** — same
3. **DateRangeFilter end-to-end flow** — all 5 preset clicks update charts; custom range apply/reset work; invalid date alert fires
4. **Department heat map 22-row grid + cell tooltips** — visual grid layout, color ramp, native title tooltip copy
5. **MetricToggle switches heat map metric** — visual cell-color update on sell_through ↔ revenue_share
6. **Estimate accuracy stacked area** — three bands visible, stackOffset=expand normalization, tooltip percents
7. **Bidder participation dual-axis** — two YAxis render at different scales, correct formatCount tooltip

These items require a live browser session with Supabase credentials and the Phase 2 PDF import completed (at least some sales data present).

### Gaps Summary

No automation-detectable gaps. All 5 success criteria are implemented and wired:

1. Net revenue line chart with trend line: NetRevenueTrendChart — VERIFIED
2. Sell-through rate line chart: SellThroughTrendChart — VERIFIED
3. Date range filter (L12M default, presets, custom): DateRangeFilter + period.ts Range API — VERIFIED
4. Department heat map: DepartmentHeatMap — VERIFIED
5. Tooltips with exact values on hover: ChartTooltip used by all charts — VERIFIED

The `human_needed` status reflects that 7 browser-level visual/interaction behaviors cannot be verified programmatically. These are normal UAT items for a charting page — the 644-test automated suite covers all testable logic (chart state branches, data derivations, filter validation, routing, integration).

The phase 05-07 SUMMARY notes that "Task 2" (a 15-step browser walkthrough) was explicitly deferred to a live operator session. This verification confirms the code is fully implemented and wired; the outstanding work is that browser UAT session.

---

_Verified: 2026-04-23_
_Verifier: Claude (gsd-verifier) — retroactive audit_
