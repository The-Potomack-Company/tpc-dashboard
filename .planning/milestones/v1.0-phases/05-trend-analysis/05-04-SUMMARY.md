---
phase: 05-trend-analysis
plan: 04
subsystem: trends-charts
tags: [trends, charts, recharts, rolling-average, tdd, accessibility]
requires:
  - 05-01   # ChartCard, ChartSkeleton, ChartTooltip, chart-colors, Range type
  - 05-03   # useSalesInRange hook
provides:
  - computeRollingMean helper (shared by TRND-01, TRND-02, + future consumers)
  - NetRevenueTrendChart component (TRND-01)
  - SellThroughTrendChart component (TRND-02)
affects:
  - Trends page composition (plan 05-07 wraps these in ChartCard)
tech-stack:
  added: []
  patterns:
    - "Rolling-mean helper isolated from chart components (shared arithmetic)"
    - "vi.hoisted + vi.mock for hook injection in component tests"
    - "role='img' + aria-label wrapper addresses Recharts SVG a11y gap"
    - "Animation suppressed during refetch and for prefers-reduced-motion users"
key-files:
  created:
    - src/lib/rolling-avg.ts
    - src/lib/rolling-avg.test.ts
    - src/components/NetRevenueTrendChart.tsx
    - src/components/NetRevenueTrendChart.test.tsx
    - src/components/SellThroughTrendChart.tsx
    - src/components/SellThroughTrendChart.test.tsx
  modified: []
decisions:
  - "Duplicate LineChart scaffolding between TRND-01 and TRND-02 rather than share a generic wrapper — the two charts have different tooltips, value formatters, y-axis domains, and series colors; a shared wrapper would force a prop explosion and blur the per-chart contract."
  - "role='img' wrapper is a <div>, not the <ResponsiveContainer> — the div carries the aria-label and role, and the ResponsiveContainer / chart tree live inside it. This matches UI-SPEC Accessibility Floor exactly and keeps Recharts' internal SVG structure untouched."
  - "Sell-through computed client-side from lots_sold / lots_auctioned (ratio in [0,1]) — the sales table has no sell_through column, and the sale_departments.sell_through_pct column is 0-100 (different shape, different source)."
  - "Rows with lots_auctioned=0 are filtered out, not treated as 0% sell-through — a zero-lot sale is operationally invalid in the trend context, and keeping it would divide-by-zero into Infinity / NaN."
requirements:
  - TRND-01
  - TRND-02
  - INTR-03
metrics:
  tasks_completed: 3
  tests_added: 19
  duration_minutes: 7
  completed_date: 2026-04-22
---

# Phase 5 Plan 04: Rolling-avg + NetRevenueTrendChart + SellThroughTrendChart Summary

Delivered `computeRollingMean` shared helper and the two above-the-fold
line-chart components (TRND-01 net revenue per sale, TRND-02 sell-through
per sale), each with a cyan dashed rolling-3 trend overlay.

## What Shipped

### `src/lib/rolling-avg.ts`

```ts
export function computeRollingMean(
  values: ReadonlyArray<number | null>,
  window: number,
): Array<number | null>;
```

Contract:
- Returns a new array the same length as `values` (does not mutate input).
- Positions `i < window - 1` are `null` (insufficient history).
- Positions `i >= window - 1` are the arithmetic mean of
  `values[i - window + 1 .. i]` when all entries are non-null; `null` when
  any entry in that window is null (nulls poison the window).
- `window > values.length` returns an all-null array of the same length
  (graceful — no throw for short inputs).
- `window < 1` throws `new Error('window must be >= 1')`.

7 Vitest cases: happy path, null poisoning, empty input, window >
length, window=1 identity, window < 1 throws, input immutability
(frozen input does not explode).

### `src/components/NetRevenueTrendChart.tsx`

```ts
export interface NetRevenueTrendChartProps { range: Range }
export function NetRevenueTrendChart(props: NetRevenueTrendChartProps): JSX.Element;
```

- Calls `useSalesInRange(range)`.
- Filters rows where `sale_date != null && net_revenue != null`.
- Computes rolling-3 mean on `net_revenue`.
- Renders:
  - pending (no cached data) → `<ChartSkeleton height="sm" />`
  - error → `<ErrorState heading="Couldn't load this chart" … onRetry={refetch}/>`
  - chartData.length === 0 → `<EmptyState heading="No sales in this range">…`
  - success → `<div role="img" aria-label="Net revenue per sale — N sales in range">` containing a Recharts `<LineChart>` with blue-600 primary + cyan-600 dashed trend.

### `src/components/SellThroughTrendChart.tsx`

```ts
export interface SellThroughTrendChartProps { range: Range }
export function SellThroughTrendChart(props: SellThroughTrendChartProps): JSX.Element;
```

Mirrors TRND-01 with:
- Filter: `sale_date != null && lots_auctioned != null && lots_auctioned > 0 && lots_sold != null`.
- Data derivation: `sell_through = lots_sold / lots_auctioned` (ratio in [0, 1]).
- Y-axis: `tickFormatter={formatPercent}`, `domain={[0, 1]}`, `width={64}`.
- Primary series: emerald-600.
- aria-label: `Sell-through per sale — N sales in range`.

## How Trends Page (plan 05-07) Composes Them

Per UI-SPEC § Layout Specifications `/trends`, plan 05-07 wraps each chart
in a `<ChartCard>`:

```tsx
<ChartCard
  title="Net revenue per sale"
  subtitle="Net revenue with 3-sale rolling trend"
>
  <NetRevenueTrendChart range={range} />
</ChartCard>

<ChartCard
  title="Sell-through per sale"
  subtitle="Lots sold as a share of lots auctioned, with 3-sale rolling trend"
>
  <SellThroughTrendChart range={range} />
</ChartCard>
```

The chart body component is intentionally chrome-free — `ChartCard`
provides title/subtitle/h-80 body slot; the chart component supplies the
`<ResponsiveContainer>` and its `role='img'` accessibility wrapper.

## Test Coverage

| File | Cases | Coverage |
|------|-------|----------|
| `src/lib/rolling-avg.test.ts` | 7 | Contract edges: null poisoning, empty input, window extremes, immutability. |
| `src/components/NetRevenueTrendChart.test.tsx` | 6 | pending / error / empty / empty-from-nulls / success (role=img wrapper + aria-label) / refetching-with-data. |
| `src/components/SellThroughTrendChart.test.tsx` | 6 | pending / error / empty / empty-from-nulls-and-zero-lots / success / refetching-with-data. |
| **Total** | **19** | |

All 19 new tests pass. Full suite `npx vitest --run` passes 423/423 (zero
regression). `npm run build` passes.

## Requirement Coverage

- **TRND-01** — NetRevenueTrendChart satisfies the TRND-01 acceptance
  criteria (net revenue per sale line chart with rolling-3 trend overlay).
- **TRND-02** — SellThroughTrendChart satisfies the TRND-02 acceptance
  criteria (sell-through per sale line chart with rolling-3 trend overlay,
  YAxis domain [0, 1]).
- **INTR-03** — Both charts consume `ChartTooltip` via Recharts'
  `<Tooltip content={<ChartTooltip .../>} />`, piping
  `formatDate/formatCurrency/formatPercent` through the `headerFormatter`
  and `valueFormatter` hooks (partial coverage; remaining charts in plans
  05-05 and 05-06 complete INTR-03).

## Deviations from Plan

None — plan executed exactly as written.

The plan's `verify` block references `npm test -- --run <path>`. In
Vitest 4 + npm-script argument-passthrough, this expands to
`vitest --run --run <path>` which errors (duplicate `--run`). Verified
with `npx vitest --run <path>` instead — same intent, same binary. No
source change, just a test-driver note for future plans.

## Known Stubs

None. Both chart components consume live `useSalesInRange` data (no mock
data paths in production code). The TanStack Query wrapper at the app
root (plan 05-01 era) provides real Supabase responses in development and
production.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | `f84f5c4` | test(05-04): add failing test for computeRollingMean helper |
| 1 GREEN | `3da6838` | feat(05-04): implement computeRollingMean helper |
| 2 RED | `2f69122` | test(05-04): add failing test for NetRevenueTrendChart (TRND-01) |
| 2 GREEN | `43f0c35` | feat(05-04): implement NetRevenueTrendChart (TRND-01) |
| 3 RED | `a72a955` | test(05-04): add failing test for SellThroughTrendChart (TRND-02) |
| 3 GREEN | `896852a` | feat(05-04): implement SellThroughTrendChart (TRND-02) |

## Self-Check: PASSED

All 6 files created, all 6 commits present in `git log --all`. Full
Vitest suite 423/423 passes. `npm run build` passes. TypeScript `tsc -b`
passes with zero errors.
