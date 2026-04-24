# Phase 4: KPI Landing Page - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 1 Dashboard placeholder at `/` with a performance snapshot: 4 KPI scorecards (Total revenue, Avg sell-through, Total lots sold, Total sales count) with period-over-period change, a segmented period selector (YTD / L6M / L12M, default L12M), and a Recent Sales panel (5 most-recent cards below the KPI row). Data is backed by a new Supabase RPC that returns both-period aggregates in one call. Recent sales reuse `useSales()` from Phase 3.

Out of scope for Phase 4: charts (Phase 5), department KPIs (Phase 6), custom date ranges (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### KPI Scorecards (KPI-01, KPI-02)
- 4 metrics in fixed order:
  1. **Total revenue** — `SUM(net_revenue)` over period
  2. **Avg sell-through rate** — `SUM(lots_sold) / SUM(lots_auctioned)` (weighted by lots, not arithmetic mean of per-sale rates)
  3. **Total lots sold** — `SUM(lots_sold)`
  4. **Total sales count** — `COUNT(*)` sales in period
- Default period: **Last 12 months rolling** (`sale_date >= now() - interval '12 months'`)
- Compare period: **Previous 12 months** (`sale_date >= now() - interval '24 months' AND sale_date < now() - interval '12 months'`)
- Period selector: segmented control with 3 options — YTD, L6M, L12M (default L12M)
- Change indicator: arrow + percentage. `▲ 12.4%` when current > previous (green), `▼ 8.1%` when current < previous (red), `—` / gray when previous period has no sales (no baseline)
- Colors: use Tailwind `green-600` / `red-600` + `gray-500` — NOT Phase 1 accent. These are semantic indicators, not CTAs. Accent reservation from Phase 1 UI-SPEC remains intact.
- Data source: **Single Supabase RPC** `public.kpi_summary(period_start date, period_end date, compare_start date, compare_end date) returns jsonb`. Returns `{ current: { revenue, sell_through, lots_sold, sales_count }, previous: { ... } }`. Written as a new migration in Wave 1.
- RPC is `security definer`, granted SELECT to authenticated admin (matches Phase 1 RLS pattern)

### Recent Sales Panel (KPI-03)
- Show 5 most-recent sales (sorted `sale_date DESC`)
- Each rendered as a compact card: sale_number, title, formatted date, net_revenue, sell-through %
- Click/Enter → navigate to `/sales/:saleNumber` (reuse Phase 3 detail page)
- Data source: **Reuse `useSales()`** + `.slice(0, 5)` — shares TanStack Query cache with `/sales` (5-min staleTime). No new hook.
- Empty state: "No sales yet — run the PDF import" (matches Phase 3 SalesTable empty copy verbatim)
- Loading: 5 skeleton cards using the Phase 3 skeleton pattern

### Layout + Routing
- Replace `src/pages/Dashboard.tsx` placeholder (currently "Your KPIs land here." stub) with the full landing page. Keep the component name `Dashboard` to avoid route-table churn — App.tsx already routes `/` to `<Dashboard />`.
- Page layout:
  - Page header: "Dashboard" h1 + period selector on the right
  - KPI row: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` (responsive collapse)
  - Recent Sales section below: section heading + 5 cards `grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4`
- Loading strategy: show full skeleton layout while either query pending; avoid layout shift
- Errors: inline `<ErrorState>` (reuse Phase 3 primitive) in each section that fails independently

### Claude's Discretion
- Exact segmented-control styling (Tailwind-native; match Phase 1 input rhythm)
- Whether to memoize period boundaries with `useMemo` vs recompute per render
- Exact weighted-sell-through formula handling when `SUM(lots_auctioned) = 0` (return null, render `—`)
- Loading vs error precedence when both queries fail
- Whether each KPI card is its own component (`<KpiCard label value delta>`) or inline JSX — recommend extracting for Phase 5 chart re-use

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phases 1-3)
- `src/pages/Dashboard.tsx` — current placeholder; gets a full rewrite
- `src/hooks/useSales.ts` — reuse for Recent Sales (no new hook)
- `src/lib/format.ts` — `formatCurrency`, `formatPercent`, `formatDate` — cover all KPI formatting needs; add a `formatDelta(percent)` helper for `▲ 12.4%` / `▼ 8.1%` rendering
- `src/components/TableSkeleton.tsx` — skeleton shimmer pattern; Phase 4 adds `KpiCardSkeleton` that matches
- `src/components/ErrorState.tsx` — reuse for KPI query errors
- `src/components/EmptyState.tsx` — reuse for Recent Sales empty
- Phase 3 UI-SPEC tokens (2 weights, 4 sizes, spacing 4/8/16/24/32/48/64, accent reservation) — extend without change; KPI card typography = Label (14/600) + Display (24/600) + small delta (14/400)
- `src/lib/supabase.ts` — anon client (RLS admin-only enforcement)

### Established Patterns
- TanStack Query for all data fetching (QueryClientProvider in main.tsx)
- Migrations via Supabase CLI in `supabase/migrations/{timestamp}_*.sql`
- RPCs use `security definer` + `revoke/grant` (pattern from Phase 2 `import_sale_with_departments`)
- Regenerate `src/db/database.types.ts` via `npm run db:types` after every migration push
- Hand-authored Tailwind v4, no shadcn

### Integration Points
- Route `/` in App.tsx — already points to `<Dashboard />`; only the component body changes
- DashboardLayout sidebar — no change (Home link at `/` already active)
- New migration + RPC → Wave 1 `[BLOCKING] supabase db push` + types regen
- `useKpiSummary(period)` new hook in Wave 2

</code_context>

<specifics>
## Specific Ideas

- New components: `src/components/KpiCard.tsx`, `src/components/KpiCardSkeleton.tsx`, `src/components/PeriodSelector.tsx`, `src/components/RecentSalesPanel.tsx`
- New hook: `src/hooks/useKpiSummary.ts` — accepts `Period` enum (`'ytd'|'l6m'|'l12m'`), computes date bounds in JS, calls `supabase.rpc('kpi_summary', {...})`, returns `{ current, previous }`
- New lib: `src/lib/period.ts` — `computePeriodBounds(period: Period)` → `{ current: [start, end], previous: [start, end] }` pure function, unit-tested
- New migration: `supabase/migrations/20260422000000_kpi_summary_rpc.sql` — `kpi_summary(date, date, date, date) returns jsonb`, `security definer`, `grant execute to authenticated`
- Keep `Dashboard.tsx` as the route component (rewrite body, don't rename)

</specifics>

<deferred>
## Deferred Ideas

- Custom date ranges (Phase 9 — Custom Charts already covers general range picking)
- Additional KPI tiles (estimate accuracy, bidder counts, revenue per dept) — Phase 5/6
- Trend sparkline on each KPI card — Phase 5
- Per-department KPI drill-downs — Phase 6

</deferred>
