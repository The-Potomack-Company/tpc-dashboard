# Phase 6: Department Analysis & Sale Comparison — Research

**Researched:** 2026-04-22
**Domain:** Postgres RPCs (server-side aggregation), Recharts v3 composite charts, TanStack Table v8 row selection, React Router v7 search params
**Confidence:** HIGH (stack + patterns locked by Phases 1–5; only two surfaces — waterfall pattern + URL-search validation — need fresh verification, both completed below)

## Summary

Phase 6 is a composition phase: every new capability builds directly on existing Phase 1/3/4/5 primitives. The stack is frozen (React 19.2, Recharts 3.8.1, TanStack Query v5, TanStack Table v8, React Router v7, Supabase RPC via `supabase.rpc()`), and the project constraint INFR-04 ("aggregations happen in Postgres, not JS") dictates that the three new data-fetching surfaces must be backed by Postgres RPCs — not by `.select(...)` + JS reduction. The existing `import_sale_with_departments` (Phase 2) and `kpi_summary` (Phase 4) RPCs give us two template shapes for security-definer functions; Phase 6 reuses the `kpi_summary` shape for read aggregates.

Three areas need explicit attention the executor would get wrong without guidance: (1) Recharts lacks native waterfall — the canonical workaround is a transparent-padding `<Bar>` stacked with a visible delta `<Bar>`, and there is a known negative-value edge case we avoid by construction; (2) TanStack Table v8 + `@tanstack/react-virtual` row selection must not break the fixed-height virtualizer invariant (`translateY(vRow.start - index * vRow.size)`) already in `SalesTable`; (3) React Router v7's `useSearchParams` returns a live `URLSearchParams` — parsing the comma-separated `?sales=` list and distinguishing "invalid URL" from "empty URL" from "valid but sale not found" requires a 3-state result, not a boolean.

**Primary recommendation:** Mirror the `kpi_summary` RPC template (security definer + `set search_path = public, pg_temp` + explicit `private.is_admin()` gate + `grant execute … to authenticated`) for all three new RPCs. Extend `SalesTable` with a leading checkbox column via a new `enableSelection` prop + controlled `rowSelection` state; virtualizer math is unaffected because the column addition doesn't change row height. Render the waterfall with a client-side `transformToWaterfall()` helper in `src/lib/waterfall.ts` that emits `{ step, base, delta, direction }` rows — the visible `<Bar dataKey="delta">` uses per-cell colors via `<Cell>`, not a single `fill`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Routing & Page Structure**
- `/departments` — new standalone page under `<ProtectedRoute>` in `App.tsx`. Component: `src/pages/Departments.tsx`.
- `/sales/compare` — new standalone page under `<ProtectedRoute>`. Component: `src/pages/SaleCompare.tsx`. Reads `?sales=2024-01,2024-02,...` from `useSearchParams`. Shareable / bookmarkable.
- **Revenue Waterfall** — new section on `src/pages/SaleDetail.tsx` below the existing Department Table. Collapsible; collapsed by default. Title: "Revenue Breakdown". Fixed ~320px chart height when expanded.
- `DashboardLayout.tsx`: convert the "Departments" nav entry from `aria-disabled` span into an active `NavLink to="/departments"` using the same pattern Phase 5 used for Trends.

**Department Analysis (DEPT-01, DEPT-02, DEPT-03)**
- Ranking metric selector reuses the Phase 5 `<MetricToggle>` pattern (segmented control) with `Revenue` | `Sell-through` | `Lots above estimate`. Default: `Revenue`. New component: `<DeptRankingMetricToggle>`.
- DEPT-01 rankings table = TanStack Table v8 with columns `Department` / `Sales count` / `Total revenue` / `Avg sell-through %` / `Lots above estimate`. Text filter reuses `<FilterInput>`. Sort reuses `<SortIndicator>`. Default sort = selected ranking metric DESC.
- DEPT-02 multi-line chart = Recharts `<LineChart>`, one `<Line>` per selected department, 8-color Phase 5 palette. Chip-bar above the chart for selection. Default: top-5 by revenue. Hard cap 8 (palette size); 9th click → non-blocking "Max 8" warning.
- DEPT-03 stacked 100% bar = Recharts `<BarChart>` with `stackId="share"`, top-8 departments + an aggregated "Other" gray-400 segment. Legend at top.
- Data hooks: **three new Postgres RPCs** — `department_rankings(range_start, range_end)`, `department_revenue_series(range_start, range_end, dept_codes text[])`, `department_share_series(range_start, range_end, top_n int)`. Policy-wrapped for `authenticated`; admin-gated via `private.is_admin()`.
- Cross-filter state = `useState<string | null>(selectedDept)` page-local. Non-null → matching row `bg-accent/5` + left border; other lines `opacity=0.2`; other stack segments `opacity=0.3`; "Clear filter" chip beside the range filter.

**Sale Comparison (SALE-04, SALE-05)**
- Leading checkbox column on `<SalesTable>`. Selection state lives in `SalesPage`: `useState<Set<string>>`. Sticky footer appears when `selected.size ≥ 1`; left = `Clear selection`; right = `Compare (N)` button navigating to `/sales/compare?sales=<csv>`. Hard cap 4.
- Comparison layout = metrics as rows, sales as columns; sticky first column. Rows match `<SaleSummaryCard>` metrics plus a "Sale metadata" group at top.
- Delta = adjacent-pair relative %; column 2 vs column 1, column 3 vs column 2, … (not "all vs baseline"). Emerald-600 up / rose-600 down / gray-400 flat (|delta| < 0.05%).
- Invalid URL (<2, >4, or unresolved sale_number) → error card "Invalid comparison. Select 2–4 sales from the sales page." + `Back to sales`.
- Data hook = `useSalesComparison(saleNumbers[])`; single `.in('sale_number', ...)` query; TanStack Query 5-min staleTime; query key sorts `saleNumbers` for cache-hit stability.

**Revenue Waterfall (SALE-06)**
- Recharts `<BarChart>` with transparent-padding-bar pattern. 7 steps: Hammer total, + Buyer premium, − Commission, − Insurance, − Lot charges, − Referral fees, Net revenue.
- Wrapped in `<ChartCard title="Revenue Breakdown">`; collapse/expand toggle in header action slot; collapsed by default; `h-80` (320px) body when expanded.
- Consumes existing `sale` object from `useSale(saleNumber)` — no new data fetching.

### Claude's Discretion
- TanStack Table styling details (header padding, row hover) — match Phase 3
- Chart animation durations (use ~400ms Phase 5 norm, not Recharts' 1500ms default)
- Whether to memoize adjacent-pair delta computation (yes — 4 cols × 20 rows, referential stability helps downstream)
- Exact sticky-footer styling (match Phase 3 `border-t` + shadow treatment)
- Collapsible state persistence — recommend NO persistence for v1 (default collapsed)
- RPC parameter naming — align with Phase 2/4 convention (`range_start` / `range_end` matching `kpi_summary`'s `period_start` / `period_end`)
- Cross-filter transition — `transition-opacity duration-200`

### Deferred Ideas (OUT OF SCOPE)
- Cross-filter propagation across `/trends`, `/sales`, dashboard home (v1 scopes to `/departments`)
- Charts on the comparison page (per-sale mini-waterfall, mini-donut)
- URL-persisted cross-filter on `/departments`
- Saving comparison sets ("my comparisons") — Phase 8 may subsume
- Animating comparison column additions / removals
- Column drag-reorder on the comparison page
- Waterfall drill-down (click step to see contributing departments)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPT-01 | Departments ranked by revenue / avg sell-through / lots above estimate | RPC `department_rankings` design (§ Standard Stack → New RPCs); ranking-table + `<MetricToggle>` pattern (inherited from Phase 5) |
| DEPT-02 | Multi-line chart of selected departments' revenue over time | RPC `department_revenue_series` (wide-row shape); Recharts `<LineChart>` with N `<Line>` components from 8-color palette; chip-bar selector (§ Code Examples) |
| DEPT-03 | Stacked 100% bar chart of department share per sale | RPC `department_share_series` (top-N + Other); Recharts `<BarChart>` with `stackId="share"` (§ Code Examples) |
| SALE-04 | Compare 2–4 sales side-by-side, metrics in columns | URL-driven `useSalesComparison` + sticky-column table; selection UI via TanStack Table row-selection extension (§ Pattern 3) |
| SALE-05 | Comparison highlights deltas with color coding | New `src/lib/delta.ts` — pure `computePairDelta(current, previous, mode)` → `{ text, direction }` + `deltaColorClass(direction)`; adjacent-pair mode (§ Code Examples) |
| SALE-06 | Revenue waterfall chart (hammer → net revenue) | Recharts transparent-padding-bar workaround + `src/lib/waterfall.ts` transform (§ Pattern 2, § Common Pitfalls) |
| INTR-01 | Clicking a department filters other views on the page | Page-level `selectedDept` state threading into three components; per-`<Line>` / per-segment `strokeOpacity` / `fillOpacity` overrides; `transition-opacity duration-200` class on wrapper (§ Pattern 4) |

## Standard Stack

### Core (all already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | `^3.8.1` | Multi-line, stacked 100%, waterfall charts | [VERIFIED: package.json] Phase 5 lock; component API matches React 19 patterns; `<Cell>` supports per-bar color for waterfall step encoding |
| @tanstack/react-table | `^8.21.3` | Rankings table + selection column on SalesTable | [VERIFIED: package.json] Phase 3 lock; headless; `rowSelection` state built in |
| @tanstack/react-virtual | `^3.13.24` | Existing SalesTable virtualizer | [VERIFIED: package.json] Extending SalesTable must preserve its fixed-row-height invariant |
| @tanstack/react-query | `^5.99.2` | `useSalesComparison` + the three new dept hooks | [VERIFIED: package.json] Phase 1–5 lock; `keepPreviousData` pattern reused |
| @supabase/supabase-js | `^2.101.1` | `supabase.rpc('department_rankings', ...)` call path | [VERIFIED: package.json] `kpi_summary` template proven in Phase 4 |
| react-router | `^7.13.1` | `/sales/compare` route + `useSearchParams` | [VERIFIED: package.json] v7 API is the current major; `useSearchParams` hook is stable |
| zod | `^4.3.6` | Optional: RPC return shape validation for the three new hooks | [VERIFIED: package.json] Phase 4 `kpi_summary` hook used `zod` for a Zod-parsed trust boundary — same pattern applies here if the RPC returns `jsonb` |

### Supporting (files to create, not packages)

| File | Purpose | Consumers |
|------|---------|-----------|
| `src/lib/waterfall.ts` | `transformToWaterfall(sale)` → `{ step, base, delta, direction, color }[]` | `RevenueWaterfallChart` |
| `src/lib/delta.ts` | `computePairDelta(current, previous, mode)` + `deltaColorClass(direction)` | `ComparisonTable` cells |
| `src/hooks/useDepartmentRankings.ts` | `supabase.rpc('department_rankings', { range_start, range_end })` | `Departments` page |
| `src/hooks/useDepartmentRevenueSeries.ts` | `supabase.rpc('department_revenue_series', { range_start, range_end, dept_codes })` | `DepartmentRevenueLineChart` |
| `src/hooks/useDepartmentShareSeries.ts` | `supabase.rpc('department_share_series', { range_start, range_end, top_n })` | `DepartmentShareStackedBarChart` |
| `src/hooks/useSalesComparison.ts` | `supabase.from('sales').select('*').in('sale_number', ...)` | `SaleCompare` page |
| `supabase/migrations/20260422XXXXXX_department_analytics_rpcs.sql` | Three RPCs + grants (single migration file) | — |

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Three RPCs (one per hook) | Single RPC that returns a jsonb envelope | Three hooks have three different cache-key lifecycles (rankings is range-only; series depends on deptCodes; share depends on topN). A merged RPC would over-fetch on every filter change. Three hooks match three TanStack Query cache keys cleanly. |
| Transparent-padding waterfall | Custom SVG `<path>` + Recharts `<Customized>` | Pattern is widely verified and already used across industry [CITED: spin.atomicobject.com/stacked-bar-charts-recharts]; custom SVG doubles implementation cost for an additive UX feature |
| URL search params for comparison | Zustand comparison store | Shareable / bookmarkable comparisons were an explicit decision; Zustand would break the "copy the URL and send it" flow |
| Row-selection as new TanStack Table feature | Keep SalesTable as-is, build a parallel selection table | Would duplicate virtualization logic and drift over time; TanStack Table v8 ships `rowSelection` state natively [CITED: tanstack.com/table/v8/docs/guide/row-selection] |
| JS aggregation over `sale_departments` for rankings | Postgres RPC | Blocked by INFR-04 ("all financial aggregations happen in PostgreSQL, not in JavaScript") — this is a project constraint, not a preference |

### Version verification

All package versions taken from `package.json` (read directly). No new packages are being added; no `npm view` checks required. If the executor reaches for a new package during implementation, the plan has deviated from the locked stack and must halt.

### Installation

None — every dependency is installed at the correct version.

## Architecture Patterns

### Pattern 1: Postgres RPC mirroring `kpi_summary`

**What:** All three Phase 6 server-side aggregates follow the exact shape of `public.kpi_summary` (migration `20260422000000_kpi_summary_rpc.sql`).

**Why:** This template has already passed a Phase 4 threat review (T-01 search-path hijack, T-02 SQL-injection via typed params, T-04 defense-in-depth RBAC gate). Using the same template means the new RPCs inherit those mitigations for free.

**When to use:** Every new read-aggregate RPC in this codebase until a different requirement appears.

**Example — skeleton for `department_rankings`:**

```sql
-- supabase/migrations/20260422XXXXXX_department_analytics_rpcs.sql
-- Source: adapted from supabase/migrations/20260422000000_kpi_summary_rpc.sql

create or replace function public.department_rankings(
  range_start date,
  range_end   date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- Admin-only gate (defense-in-depth; sale_departments RLS is admin-only already).
  if not private.is_admin() then
    raise exception 'Access denied: department_rankings requires admin role';
  end if;

  -- Aggregate per department across sales in [range_start, range_end].
  -- NOTE: half-open interval [start, end) matching kpi_summary convention:
  --   where sale_date >= range_start and sale_date < range_end
  -- When range_start/range_end are NULL (the 'all' preset), the caller MUST
  -- pass a sentinel far-past / far-future date — or we add a NULL branch here.
  -- Recommendation: handle NULL inline via `coalesce(range_start, '0001-01-01'::date)`
  -- so the call site stays simple.

  with scoped_sales as (
    select s.id, s.sale_number, s.sale_date
    from public.sales s
    where (range_start is null or s.sale_date >= range_start)
      and (range_end   is null or s.sale_date <  range_end)
  ),
  dept_agg as (
    select
      sd.department_code,
      count(distinct sd.sale_id)::bigint                                           as sales_count,
      coalesce(sum(sd.revenue), 0)::numeric(14,2)                                  as total_revenue,
      avg(sd.sell_through_pct) filter (where sd.sell_through_pct is not null)::numeric   as avg_sell_through,
      -- "Lots above estimate" per CONTEXT.md is ambiguous (see Assumptions Log A1).
      -- Provisional definition: sum of lots_sold on dept-rows where
      -- total_sold_value > high_estimate. Flag as an open question.
      coalesce(sum(case
        when sd.total_sold_value > sd.high_estimate then sd.lots_sold else 0
      end), 0)::bigint                                                             as lots_above_estimate
    from public.sale_departments sd
    where sd.sale_id in (select id from scoped_sales)
    group by sd.department_code
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'department_code',     d.department_code,
      'display_name',        dep.display_name,
      'sales_count',         d.sales_count,
      'total_revenue',       d.total_revenue,
      'avg_sell_through',    d.avg_sell_through,
      'lots_above_estimate', d.lots_above_estimate
    ) order by d.total_revenue desc
  ), '[]'::jsonb)
  into v_result
  from dept_agg d
  left join public.departments dep on dep.code = d.department_code;

  return v_result;
end;
$$;

revoke all on function public.department_rankings(date, date) from public;
grant execute on function public.department_rankings(date, date) to authenticated;

comment on function public.department_rankings(date, date) is
  'DEPT-01 rankings aggregate. Returns jsonb array of { department_code, display_name, sales_count, total_revenue, avg_sell_through, lots_above_estimate } for sales in [range_start, range_end). Admin-only via explicit private.is_admin() gate + grant to authenticated.';
```

**Critical rules (from Phase 2 decision log — do not violate):**

1. `security definer` is REQUIRED on aggregate RPCs; `security invoker` would re-run admin-only RLS per row and is the wrong tool for aggregates that already gate via `private.is_admin()`.
2. `set search_path = public, pg_temp` is **mandatory** on every security-definer function. Omitting it is a T-01 search-path hijack vulnerability.
3. All date params MUST be typed `date` (not `text`) — Postgres casts invalid strings to a clear error at boundary, not inside the query body. This is the T-02 mitigation for SQL-injection.
4. `revoke all … from public` + `grant execute … to authenticated` is the exact grant pattern. No grant to `anon`; no grant to `service_role` (service role bypasses RLS anyway).
5. **Never run `supabase db pull` or `supabase db reset --linked`** against the shared prod project (STATE.md, Phase 1 decision). Only `supabase db push` + `supabase gen types` are safe.

### Pattern 2: Recharts waterfall with transparent padding

**What:** A waterfall chart in Recharts v3.x is built from two stacked `<Bar>` components per data row: a transparent `base` bar (the vertical offset) and a visible `delta` bar (the step's magnitude). Per-bar color for the delta bar is achieved via `<Cell>` children keyed to each row's direction.

**Why:** Recharts has no native waterfall type and [CITED: github.com/recharts/recharts/issues/7010] the feature request is still open as of 2026. The transparent-padding-bar pattern is the canonical community solution [CITED: medium.com/2359media/tutorial-how-to-create-a-waterfall-chart-in-recharts].

**When to use:** For the Revenue Breakdown section only. No other Phase 6 surface needs this.

**Example:**

```typescript
// src/lib/waterfall.ts
// Transforms a Sale row into the 7 waterfall rows: Hammer → net revenue.
// Running-total math computed client-side (cheap; one pass).

import type { Database } from '../db/database.types';
type Sale = Database['public']['Tables']['sales']['Row'];

export type WaterfallDirection = 'start' | 'up' | 'down' | 'end';

export interface WaterfallRow {
  step: string;             // abbreviated x-axis label
  fullLabel: string;        // tooltip header
  base: number;             // transparent padding bar height
  delta: number;            // visible bar height (always positive; sign is in `direction`)
  runningTotal: number;
  direction: WaterfallDirection;
}

const STEPS = [
  { key: 'hammer_total',     abbr: 'Hammer',       label: 'Hammer total',  kind: 'start' },
  { key: 'buyer_premium',    abbr: '+Premium',     label: 'Buyer premium', kind: 'up'    },
  { key: 'seller_commission',abbr: '-Commission',  label: 'Commission',    kind: 'down'  },
  { key: 'insurance',        abbr: '-Insurance',   label: 'Insurance',     kind: 'down'  },
  { key: 'lot_charges',      abbr: '-Lot charges', label: 'Lot charges',   kind: 'down'  },
  { key: 'referral_fees',    abbr: '-Referral',    label: 'Referral fees', kind: 'down'  },
  // Net revenue is computed, not a step delta
] as const;

export function transformToWaterfall(sale: Sale): WaterfallRow[] | null {
  // Required fields — if any null, bail and render empty-state.
  const required: (keyof Sale)[] = [
    'hammer_total', 'buyer_premium', 'seller_commission',
    'insurance', 'lot_charges', 'referral_fees', 'net_revenue',
  ];
  for (const f of required) {
    if (sale[f] == null) return null;
  }

  const hammer = sale.hammer_total as number;
  let running = 0;
  const rows: WaterfallRow[] = [];

  // Step 1: hammer total (starts from 0, full height)
  rows.push({
    step: 'Hammer', fullLabel: 'Hammer total',
    base: 0, delta: hammer,
    runningTotal: hammer,
    direction: 'start',
  });
  running = hammer;

  // Steps 2-6: deltas
  for (let i = 1; i < STEPS.length; i++) {
    const s = STEPS[i];
    const raw = sale[s.key] as number;
    // Premium adds; commission/insurance/lot_charges/referral subtract.
    const signed = s.kind === 'up' ? raw : -raw;
    const nextRunning = running + signed;

    if (s.kind === 'up') {
      // Rising bar: base = running (the current floor), delta = signed
      rows.push({
        step: s.abbr, fullLabel: s.label,
        base: running, delta: signed,
        runningTotal: nextRunning,
        direction: 'up',
      });
    } else {
      // Falling bar: base = nextRunning (the lower floor), delta = |signed|
      rows.push({
        step: s.abbr, fullLabel: s.label,
        base: nextRunning, delta: Math.abs(signed),
        runningTotal: nextRunning,
        direction: 'down',
      });
    }
    running = nextRunning;
  }

  // Step 7: net revenue (full-height terminal bar, same treatment as step 1)
  const net = sale.net_revenue as number;
  rows.push({
    step: 'Net revenue', fullLabel: 'Net revenue',
    base: 0, delta: net,
    runningTotal: net,
    direction: 'end',
  });

  return rows;
}
```

```tsx
// src/components/RevenueWaterfallChart.tsx (sketch)
// Pattern: transparent <Bar dataKey="base" /> + colored <Bar dataKey="delta" />,
// both with stackId="waterfall". Per-bar color via <Cell>.

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer } from 'recharts';
import { CHART_PALETTE, CHART_GRID_STROKE, CHART_AXIS_TICK_FILL } from '../lib/chart-colors';
import { transformToWaterfall } from '../lib/waterfall';
import { ChartTooltip } from './ChartTooltip';

const COLOR_BY_DIRECTION = {
  start: CHART_PALETTE[0], // blue-600
  up:    CHART_PALETTE[1], // emerald-600
  down:  CHART_PALETTE[3], // rose-600
  end:   CHART_PALETTE[0], // blue-600
} as const;

export function RevenueWaterfallChart({ sale }: { sale: Sale }) {
  const rows = transformToWaterfall(sale);
  if (rows == null) return <EmptyState heading="No revenue breakdown available">…</EmptyState>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
        <XAxis dataKey="step" tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: CHART_AXIS_TICK_FILL }} width={80} />
        <Tooltip content={<ChartTooltip headerFormatter={...} valueFormatter={...} />} />
        {/* Transparent padding — lifts the visible bar to the correct running-total floor */}
        <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
        {/* Visible delta — per-cell color encodes direction */}
        <Bar dataKey="delta" stackId="waterfall" isAnimationActive={!prefersReducedMotion()}>
          {rows.map((row, i) => (
            <Cell key={i} fill={COLOR_BY_DIRECTION[row.direction]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Critical:** `isAnimationActive={false}` on the transparent `<Bar>` — animating a transparent bar is wasted work and Recharts' animation can cause a visible "grow from 0" flash on the first frame.

### Pattern 3: TanStack Table v8 row selection over an existing virtualized table

**What:** Add an `enableSelection` prop + controlled `rowSelection` state to `SalesTable`. Lift the selection Set to `SalesPage`. The checkbox column is the first column; its width is 48px (UI-SPEC). Virtualizer math is UNAFFECTED because row height is unchanged.

**Why:** [CITED: tanstack.com/table/v8/docs/guide/row-selection] TanStack Table v8 ships `rowSelection` state with `getRowId` / `enableRowSelection` / `onRowSelectionChange` hooks. Using it means we don't invent a parallel selection mechanism.

**When to use:** Any time a table needs multi-select on top of sort/filter/virtualization.

**Example:**

```tsx
// src/components/SalesTable.tsx (diff sketch — additive)
interface SalesTableProps {
  sales: Sale[];
  filterText: string;
  // NEW — optional so existing callers (there are none yet outside SalesPage) don't break
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  maxSelection?: number;  // UI-SPEC: 4
}

// Inside the component:
const selectionColumn: ColumnDef<Sale> = {
  id: '_select',
  size: 48,
  header: () => null,   // UI-SPEC: header cell is blank (intentional)
  cell: ({ row }) => (
    <input
      type="checkbox"
      aria-label={`Select sale ${row.original.sale_number}`}
      checked={row.getIsSelected()}
      onChange={(e) => {
        e.stopPropagation();       // don't navigate to /sales/:saleNumber
        // Enforce max-4 BEFORE flipping state
        const nextCount = e.target.checked
          ? Object.values(rowSelection ?? {}).filter(Boolean).length + 1
          : 0;
        if (e.target.checked && nextCount > (maxSelection ?? 4)) {
          // Fire a non-blocking notice; do NOT set state
          onMaxExceeded?.();
          return;
        }
        row.toggleSelected();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  ),
};

const columns = React.useMemo<ColumnDef<Sale>[]>(
  () => (onRowSelectionChange ? [selectionColumn, ...existingColumns] : existingColumns),
  [onRowSelectionChange, existingColumns],
);

const table = useReactTable({
  data: sales,
  columns,
  state: { sorting, globalFilter: filterText, rowSelection: rowSelection ?? {} },
  onSortingChange: setSorting,
  onRowSelectionChange,                        // NEW
  getRowId: (row) => row.sale_number,           // NEW — stable ID by sale_number
  enableRowSelection: !!onRowSelectionChange,   // NEW
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: 'includesString',
  enableMultiSort: false,
});
```

```tsx
// src/pages/Sales.tsx (diff sketch)
const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
const selectedSaleNumbers = React.useMemo(
  () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
  [rowSelection],
);

return (
  <div className="flex flex-col flex-1 min-h-0">
    …
    <SalesTable
      sales={sales}
      filterText={deferredFilter}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      maxSelection={4}
    />
    {selectedSaleNumbers.length >= 1 && (
      <SaleSelectionFooter
        selectedSaleNumbers={selectedSaleNumbers}
        onClear={() => setRowSelection({})}
      />
    )}
  </div>
);
```

**Critical rules (to avoid breaking SalesTable's virtualizer):**

1. Row height must stay 44px (`h-11`). Adding the checkbox column doesn't change this — checkboxes fit comfortably.
2. Do NOT adjust `estimateSize: () => ROW_HEIGHT`. The `translateY(vRow.start - index * vRow.size)` invariant (documented in SalesTable L206-216) requires fixed-height rows.
3. `row.getIsSelected()` + `row.toggleSelected()` are TanStack Table v8 APIs — do not reimplement.
4. `getRowId: (row) => row.sale_number` — otherwise selection keys are integer row indexes that shift under sort/filter, producing wrong selections.
5. Checkbox `onClick` and `onChange` MUST call `e.stopPropagation()` — the `<tr>` has `onClick={() => navigate(…)}`. Without stopPropagation, selecting a row navigates away.

### Pattern 4: INTR-01 cross-filter via opacity (no state lifted into Recharts)

**What:** Page-level `selectedDept: string | null`. Each consumer (multi-line chart, stacked bar chart, rankings table) reads `selectedDept` and dims non-matching series via `strokeOpacity` (line) / `fillOpacity` (bar) / `className` (row). CSS `transition-opacity duration-200` on the wrapper handles the fade.

**Why:** Recharts does NOT support interpolated transitions on `strokeOpacity` or `fillOpacity` between renders — it re-renders the SVG on prop change, and the opacity value is applied as a static SVG attribute [ASSUMED — Recharts 3.x docs don't document animated transitions between prop-driven opacities; production experience confirms the re-render-then-snap behavior]. Because the SVG element attributes change on each render, a CSS transition on the parent wrapper `<div>` smooths the perceived change. The alternative (Recharts `<Area isAnimationActive={true}>`) only animates mount, not prop changes.

**When to use:** For cross-filter dimming in Phase 6 only. Do NOT propagate this pattern to `/trends` or `/sales` — that's an explicit deferred idea.

**Example:**

```tsx
// src/components/DepartmentRevenueLineChart.tsx (sketch)
export function DepartmentRevenueLineChart({
  range, selectedDeptCodes, highlightedDept,
}: {
  range: Range;
  selectedDeptCodes: string[];
  highlightedDept: string | null;   // cross-filter from the page
}) {
  const { data } = useDepartmentRevenueSeries(range, selectedDeptCodes);

  return (
    <div className="h-full w-full transition-opacity duration-200">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={…}>
          {selectedDeptCodes.map((code, i) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
              strokeWidth={2}
              strokeOpacity={
                highlightedDept == null ? 1
                : highlightedDept === code ? 1
                : 0.2
              }
              dot={false}
              isAnimationActive={false}
            />
          ))}
          …
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

```tsx
// src/components/DepartmentShareStackedBarChart.tsx (sketch)
// Same pattern; use fillOpacity on each <Bar>.
<Bar
  key={deptCode}
  dataKey={deptCode}
  stackId="share"
  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
  fillOpacity={
    highlightedDept == null ? 1
    : highlightedDept === deptCode ? 1
    : 0.3
  }
/>
```

### Pattern 5: React Router v7 `useSearchParams` → parsed 3-state result

**What:** Parse `?sales=2024-01,2024-02` into a discriminated union: `{ kind: 'ok', saleNumbers: string[] }` | `{ kind: 'invalid', reason: 'empty' | 'too-few' | 'too-many' | 'malformed' }`. The `SaleCompare` page branches on `kind`.

**Why:** Invalid URL handling is in CONTEXT.md (error card for <2 or >4 entries, or failed lookup). The hook layer distinguishes URL-malformed from "URL looks fine, but some sale numbers don't exist" — those get different error copy.

**Example:**

```tsx
// src/pages/SaleCompare.tsx (sketch)
import { useSearchParams } from 'react-router';

type ParsedSales =
  | { kind: 'ok'; saleNumbers: string[] }
  | { kind: 'invalid'; reason: 'empty' | 'too-few' | 'too-many' | 'malformed' };

function parseSalesParam(raw: string | null): ParsedSales {
  if (raw == null || raw.trim() === '') return { kind: 'invalid', reason: 'empty' };
  // Split on comma, trim, drop empties, dedupe
  const list = Array.from(new Set(raw.split(',').map((s) => s.trim()).filter(Boolean)));
  // Sale numbers are "YYYY-NNNN" or "IT*" codes — be permissive here and let the
  // DB lookup fail for actually-bad numbers (distinguishes "invalid URL" from
  // "URL looks fine but sale doesn't exist"). Only block obviously malformed chars.
  if (list.some((s) => !/^[A-Za-z0-9-_]+$/.test(s))) {
    return { kind: 'invalid', reason: 'malformed' };
  }
  if (list.length < 2) return { kind: 'invalid', reason: 'too-few' };
  if (list.length > 4) return { kind: 'invalid', reason: 'too-many' };
  return { kind: 'ok', saleNumbers: list };
}

export function SaleComparePage() {
  const [searchParams] = useSearchParams();
  const parsed = parseSalesParam(searchParams.get('sales'));

  if (parsed.kind === 'invalid') {
    return <InvalidComparisonCard reason={parsed.reason} />;
  }

  const { data, isPending, isError } = useSalesComparison(parsed.saleNumbers);
  // Branch: pending → skeleton; error → error card; data missing some sale_numbers → invalid
  …
}
```

**Critical rules:**

1. `useSearchParams` returns a live `URLSearchParams`; always use `.get('sales')` rather than iterating. The `setSearchParams` setter triggers a navigation — we don't need that for Phase 6 (the user lands on this page with the param pre-set).
2. The comma-separation strategy ("2024-01,2024-02") must match what `SaleSelectionFooter` emits when navigating. Lock the separator in one place: `const CSV_SEPARATOR = ',' as const;` in a shared helper, consumed by both the footer and the parse.
3. URL length: with 4 sale numbers × ~8 chars + commas, `?sales=` stays under 50 chars — well within any URL length limit.

### Recommended Project Structure

No new top-level folders. Everything sits in existing directories:

```
src/
├── components/
│   ├── DeptRankingMetricToggle.tsx      (NEW)
│   ├── DepartmentRankingsTable.tsx      (NEW)
│   ├── DepartmentRevenueLineChart.tsx   (NEW)
│   ├── DepartmentShareStackedBarChart.tsx (NEW)
│   ├── DepartmentChipBar.tsx            (NEW)
│   ├── ComparisonTable.tsx              (NEW)
│   ├── SaleSelectionFooter.tsx          (NEW)
│   ├── RevenueWaterfallChart.tsx        (NEW)
│   └── SalesTable.tsx                   (MODIFIED — selection column)
├── hooks/
│   ├── useDepartmentRankings.ts         (NEW)
│   ├── useDepartmentRevenueSeries.ts    (NEW)
│   ├── useDepartmentShareSeries.ts      (NEW)
│   └── useSalesComparison.ts            (NEW)
├── lib/
│   ├── waterfall.ts                     (NEW)
│   └── delta.ts                         (NEW)
├── pages/
│   ├── Departments.tsx                  (NEW)
│   ├── SaleCompare.tsx                  (NEW)
│   ├── Sales.tsx                        (MODIFIED — selection state + footer)
│   └── SaleDetail.tsx                   (MODIFIED — waterfall section)
├── layouts/
│   └── DashboardLayout.tsx              (MODIFIED — Departments nav flip)
└── App.tsx                              (MODIFIED — 2 new routes)

supabase/migrations/
└── 20260422XXXXXX_department_analytics_rpcs.sql  (NEW — 3 RPCs + grants)
```

### Anti-Patterns to Avoid

- **Hand-rolled currency summing in JS for rankings.** INFR-04 blocks this. Route everything through Postgres.
- **Shared frozen-empty-array across new hooks.** Phase 5's `useSalesInRange` / `useDepartmentGrid` established "each hook owns its own frozen singleton" to prevent cross-hook coupling. Follow that rule — `const EMPTY_RANKINGS: readonly DeptRankingRow[] = Object.freeze([]) as …;` per hook file.
- **`keepPreviousData: true` (v4 option).** TanStack Query v5 only accepts the imported `keepPreviousData` sentinel; TypeScript won't flag the v4 form. Every existing hook uses the correct pattern — copy it.
- **Building a "smart" `<ComparisonCell>` that knows about its column index.** Pass previous column's value as a prop; keep the cell component oblivious to adjacency. Adjacency math belongs in the parent `<ComparisonTable>` that renders the grid.
- **Animating cross-filter opacity via Recharts props.** Use a CSS wrapper; see Pattern 4.
- **Writing `search_path` on the three new RPCs differently from kpi_summary.** All three MUST be `set search_path = public, pg_temp`. Anything else is a security regression.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-column sort on rankings table | Custom sort reducer | TanStack Table v8 `getSortedRowModel()` + `enableMultiSort: false` | Phase 3 SalesTable already proves this pattern works for clickable headers + `<SortIndicator>` |
| Row selection state on SalesTable | `useState<Set<string>>` inside table + imperative API | TanStack Table v8 `rowSelection` state + `getRowId` | Native v8 feature; surviving sort/filter requires `getRowId` which is built-in |
| Waterfall chart | Custom SVG | Recharts transparent-padding-bar pattern | Well-known workaround; Cell-based coloring fits the pattern naturally |
| Stacked 100% bar | Manual percentage math | Recharts `<Bar stackId="share">` + server-returns-percentages | Server returns pct already; Recharts handles the stack visual natively |
| Delta color decision logic | Ternaries inside JSX cells | `computePairDelta(a, b, mode)` in `src/lib/delta.ts` → `deltaColorClass(direction)` | Pure function is unit-testable; JSX stays declarative |
| URL parsing for comparison | Regex in the component | `parseSalesParam(raw)` discriminated-union helper | Error states diverge (empty vs too-few vs too-many vs malformed); discriminated union makes branches explicit |
| Date range math | New range preset | Existing `rangeFromPreset` / `DEFAULT_RANGE_PRESET` from `src/lib/period.ts` | Already used by Phase 5 Trends — reuse exactly |
| Server aggregation for rankings / series / share | `.select('*')` + JS `.reduce()` | Three Postgres RPCs | INFR-04 project constraint; JS reduction blows up floating-point precision on currency |

**Key insight:** Phase 6 is a composition phase. Every line of custom code is a potential drift from Phase 1-5 conventions. When in doubt, **copy the shape of the closest existing primitive** before writing anything new.

## Runtime State Inventory

Phase 6 is a **greenfield feature phase** (new pages, new RPCs, new components) with no rename, refactor, or migration of existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no existing columns or tables are renamed, and the three new RPCs read existing data via new aggregations. No new stored entities beyond what Phase 1-2 already ship. | None |
| Live service config | None — no Vercel cron, no Supabase edge function, no external service changes. | None |
| OS-registered state | None — purely in-app feature work. | None |
| Secrets/env vars | None — no new env vars. Existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` flow through. | None |
| Build artifacts | `src/db/database.types.ts` must be regenerated **after** the new migration lands via `npm run db:types`. Otherwise the three new RPCs are not typed in `supabase.rpc('...')` calls. | Add a post-migration task to the plan that runs `npm run db:types` before the hooks are implemented. |

## Common Pitfalls

### Pitfall 1: Waterfall chart renders an "empty" bar at step 1
**What goes wrong:** The transparent-padding-bar pattern starts `hammer_total` with `base=0, delta=hammer`. If the transform code computes `base=hammer, delta=0` for the first row (a common off-by-one), the first bar renders as a flat line at the y=hammer mark.
**Why it happens:** The invariant "step N's base = running total AFTER step N-1" breaks at step 1 because there's no step 0.
**How to avoid:** Treat step 1 and step 7 (Hammer, Net revenue) as `kind: 'start'` / `kind: 'end'` — both use `base=0, delta=<full value>`. See `src/lib/waterfall.ts` sketch above.
**Warning signs:** First bar is invisible or lies flat at y=net_revenue in the rendered chart.

### Pitfall 2: Virtualized `SalesTable` row click navigates away when clicking checkbox
**What goes wrong:** User clicks the selection checkbox; the row's `onClick={() => navigate(…)}` fires; they land on the sale detail page; their selection is wiped (because the user leaves the page).
**Why it happens:** Event bubbling — the `<td>` containing the checkbox sits inside the `<tr>` with a click handler.
**How to avoid:** Checkbox `onChange` AND `onClick` both call `e.stopPropagation()`. See Pattern 3 sketch.
**Warning signs:** Clicking the checkbox navigates instead of toggling selection.

### Pitfall 3: Adjacent-pair deltas computed against the wrong column
**What goes wrong:** "Column 2 vs column 1, column 3 vs column 2" is easy to mis-implement as "column 2 vs column 1, column 3 vs column 1" (all-vs-baseline). CONTEXT.md Section "Sale Comparison" locks adjacent-pair.
**Why it happens:** Common chart-library defaults use "vs baseline"; developers pattern-match without reading the spec.
**How to avoid:** Pass `previousColumn` explicitly as a prop to each cell. The adjacency computation lives in `<ComparisonTable>` where the columns array is in scope — not inside the cell. Unit test: 4-column table; row with values `[100, 110, 100, 150]` → deltas `[—, +10%, -9.1%, +50%]`.
**Warning signs:** Column 3's delta shows "+0%" when column 3 equals column 1 (signals baseline math).

### Pitfall 4: RPC returns `jsonb` but hook consumers expect a row array
**What goes wrong:** `supabase.rpc('department_rankings', …)` returns `jsonb` — in the JS client this comes back as the PARSED object (a JS array), NOT as a string, but the TypeScript type is `Json` (from the generated types). Downstream consumers cast it to `any[]` and lose type safety.
**Why it happens:** The `kpi_summary` hook side-stepped this by Zod-parsing the return. Without Zod, the return is opaque `Json`.
**How to avoid:** Either (a) declare hand-authored `DeptRankingRow` interface + runtime cast (pattern used in `useDepartmentGrid`), or (b) Zod schema like `useKpiSummary` does. Recommend (a) for simple array-of-object returns, (b) if validation logic is non-trivial.
**Warning signs:** Property access on the hook's return yields `any`; TypeScript can't catch a spelling error in field names.

### Pitfall 5: URL search param round-trip mismatches on sorted-vs-unsorted sale numbers
**What goes wrong:** Two users share the same comparison but with different URL orders (`?sales=2024-02,2024-01` vs `?sales=2024-01,2024-02`). TanStack Query caches both separately because the queryKey encodes the exact array, bloating cache and wasting requests.
**Why it happens:** `['sales-comparison', [a, b]]` and `['sales-comparison', [b, a]]` are different keys.
**How to avoid:** CONTEXT.md locks this: sort the sale_numbers for the cache key but preserve input order for the rendered columns. Key shape: `['sales-comparison', [...saleNumbers].sort()]`; data transform re-orders results by input array to match column order.
**Warning signs:** Swapping the URL order refetches instead of reusing the cache.

### Pitfall 6: "Lots above estimate" definition ambiguity
**What goes wrong:** The phrase appears in DEPT-01 without a precise mathematical definition. Implementer picks one interpretation; user sees a different number than they expected; trust in the dashboard erodes.
**Why it happens:** "Lots above estimate" could mean (a) individual lot-level comparison (we don't have that granularity — DATA is department-aggregated), (b) department-lot-count where `total_sold_value > high_estimate`, (c) sum across sales where the department beat its high estimate in aggregate.
**How to avoid:** Treat (b) as the provisional definition (matches the column in the RPC sketch above); flag for user confirmation during /gsd-discuss or a follow-up clarification task. See Assumptions Log A1.
**Warning signs:** User asks "why is ASN showing 47 lots above estimate when I expected closer to 12?"

### Pitfall 7: Auto-discovered department codes with `display_name = NULL` break the chip-bar aria-labels
**What goes wrong:** Phase 2 auto-discovers unknown department codes and inserts rows with `display_name = NULL`. The chip-bar aria-label template `"{dept_code} — {display_name}"` renders as "XYZ — null" or "XYZ — " for auto-discovered codes with no name yet.
**Why it happens:** UI-SPEC copy assumes every department has a populated display_name.
**How to avoid:** Chip-bar aria-label: `${dept_code}${display_name ? ` — ${display_name}` : ''}`. Rankings-table display: fall back to `department_code` in monospace when `display_name` is null (matches Phase 3 DepartmentTable convention).
**Warning signs:** Screen reader announces "X Y Z null".

### Pitfall 8: Recharts `<Line>` series with zero data points throws a runtime error
**What goes wrong:** User selects a department via chip, but the `department_revenue_series` RPC returns rows with that column populated only for some sales, and the first sale in the range has `null` for that dept. Recharts plots fine with nulls inside a series; it breaks when the entire series is all-null.
**Why it happens:** Edge case in `<Line connectNulls={false}>` + entirely-null series.
**How to avoid:** Filter `selectedDeptCodes` client-side: drop any code whose series is all-null in the current range. Emit a subtle inline notice if all selections drop out.
**Warning signs:** White / empty chart with a non-empty legend.

## Code Examples

See Pattern 1 (RPC skeleton), Pattern 2 (waterfall transform + chart), Pattern 3 (selection column), Pattern 4 (cross-filter opacity), Pattern 5 (URL parsing) above. One more worth calling out:

### Delta helper (referenced by UI-SPEC line 187-197)

```typescript
// src/lib/delta.ts
// Pure module — no React, no imports from components. Unit-tested in isolation.

export type DeltaDirection = 'up' | 'down' | 'flat' | 'none';

export interface PairDelta {
  text: string;           // "+12.4%" | "-8.1%" | "0.0%" | "—"
  direction: DeltaDirection;
}

const FLAT_THRESHOLD = 0.0005;  // 0.05% — locked in UI-SPEC

export function computePairDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  mode: 'relative' | 'absolute_pp' = 'relative',
): PairDelta {
  if (current == null || previous == null) return { text: '—', direction: 'none' };

  if (mode === 'relative') {
    if (previous === 0) return { text: '—', direction: 'none' };
    const ratio = (current - previous) / previous;
    if (Math.abs(ratio) < FLAT_THRESHOLD) return { text: '0.0%', direction: 'flat' };
    const pct = (ratio * 100).toFixed(1);
    return {
      text: `${ratio > 0 ? '+' : ''}${pct}%`,
      direction: ratio > 0 ? 'up' : 'down',
    };
  }

  // absolute_pp — both values are ratios 0-1 (e.g. sell_through)
  const diff = current - previous;
  if (Math.abs(diff) < FLAT_THRESHOLD) return { text: '0.0pp', direction: 'flat' };
  const pp = (diff * 100).toFixed(1);
  return {
    text: `${diff > 0 ? '+' : ''}${pp}pp`,
    direction: diff > 0 ? 'up' : 'down',
  };
}

export function deltaColorClass(direction: DeltaDirection): string {
  switch (direction) {
    case 'up':   return 'text-emerald-600 dark:text-emerald-500';
    case 'down': return 'text-rose-600 dark:text-rose-500';
    case 'flat':
    case 'none': return 'text-gray-400 dark:text-gray-500';
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON path queries in client code | Postgres `jsonb_build_object` on server; client receives typed shape | Phase 4 `kpi_summary` | Phase 6 hooks copy the pattern |
| TanStack Query v4 `keepPreviousData: true` | v5 `placeholderData: keepPreviousData` sentinel | Phase 4 | Phase 6 hooks use the v5 form; existing hooks already do |
| Recharts v2 `<BarChart syncId=...>` for linked charts | v3 per-chart state, lifted to page | Phase 5 | INTR-01 cross-filter lifts state to the page, not Recharts |
| Checkbox columns as a separate table component | TanStack Table v8 native `rowSelection` | v8 release (2023) | Phase 6 uses native API on the existing SalesTable |

**Deprecated / outdated:**
- Recharts `<Line dot={(props) => …custom React…}>` function-as-dot pattern: v3 deprecated in favor of `<Dot>` components. Not used in Phase 6.
- `supabase.from('sales').rpc(…)`: the builder form is `supabase.rpc('fn', params)` (v2). We use v2 throughout.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Lots above estimate" = department-lot count in sales where `total_sold_value > high_estimate`, summed over dept rows in range | Pattern 1 RPC skeleton; DEPT-01 | User sees a different number than expected. Alternative definitions: (a) per-lot grain (impossible — we don't store per-lot data), (b) count of (sale, dept) pairs where the dept beat its high estimate. Recommendation: confirm with user during /gsd-discuss before building, OR ship with a tooltip on the column header explaining the exact math. |
| A2 | Recharts 3.8.1 does not interpolate between prop-driven `strokeOpacity` values — opacity change is a snap-render. The CSS `transition-opacity` wrapper fade is the idiomatic smoothing layer. | Pattern 4 | If Recharts v3 actually DOES animate opacity via `<Line animationDuration>`, the double-transition (Recharts + CSS) could produce a visible stutter. Mitigation: `isAnimationActive={false}` on the `<Line>` components to force the snap, let CSS handle the fade. Locked in pattern. |
| A3 | URL length with 4 sale numbers × 8 chars + commas stays <50 chars, well within browser / server limits | Pattern 5 | None at realistic sale_number length; a 5-char-longer scheme would still be safe |
| A4 | The 8-department chip cap equals palette size exactly; no plan exists to shift chart colors across more than 8 simultaneous series | Standard Stack; Pattern 4 | If a 9th series is needed later, palette needs a 9th color OR the cap becomes 7 and we reserve one for "Other" — both are refactors of `src/lib/chart-colors.ts` |
| A5 | Waterfall steps never have negative hammer_total (hammer is always positive for real sales). Negative commission / insurance / etc. would also be nonsense. Plan does NOT add guards for these; we trust DATA-05 cross-validation. | Pattern 2 | If a malformed sale row has a negative hammer_total, the waterfall would render inverted. Acceptance: Phase 2's cross-validation + `validation_warning` flag surface this class of data issue; the banner on the sale detail page gives the user a signal before they expand the waterfall. |
| A6 | Auto-discovered departments with `display_name = NULL` will appear in rankings and chip-bar. The chip-bar's aria-label fallback to just the code is acceptable. | Pitfall 7 | If users find the code-only display confusing, a future task adds a "name this department" UI on the Departments page itself — v2 scope. |
| A7 | `department_revenue_series` and `department_share_series` RPCs return wide rows (one column per dept_code), keyed by sale_date. Recharts' `<Line dataKey={code}>` / `<Bar dataKey={code}>` consume this shape directly. | Pattern 1 extension | If the RPC returns narrow rows (`{sale_date, dept_code, revenue}`), the hook or the component must pivot to wide on the client — extra complexity. Recommend wide rows from the RPC using `jsonb_object_agg(department_code, revenue)` inside a per-sale CTE. |
| A8 | Recharts v3.8.1's `<Cell>` child inside `<Bar>` correctly assigns per-row colors when data rows are in the same order as the `<Cell>` array children. | Pattern 2 | If data is re-sorted by Recharts (it shouldn't be), cell-to-row correspondence breaks. Mitigation: never sort after building `rows` in `transformToWaterfall`. |
| A9 | Phase 6 does not introduce a new `search_path`, does not require new RLS policies, and does not affect service_role paths (no new server-side writers). All three RPCs are read-only aggregates. | Security Domain | If the plan later adds a write RPC, it needs its own threat model — flag at plan time. |

## Open Questions

1. **How should "Lots above estimate" be defined precisely?**
   - What we know: CONTEXT.md and UI-SPEC both use the phrase without math.
   - What's unclear: We don't have lot-level data, so "lots" here must refer to department-rows. The RPC sketch uses `sum(case when total_sold_value > high_estimate then lots_sold else 0)` — a reasonable interpretation, but not the only one.
   - Recommendation: Surface this in the plan's `<behavior>` block as an explicit contract; optionally add a tooltip on the column header explaining the math. If a user-facing change is needed after review, it's a 1-line RPC edit.

2. **Should `department_rankings` return ALL departments in range or only those with at least one non-null metric?**
   - What we know: A department code can exist in the seed table but have no sale_departments rows in a given range.
   - What's unclear: Render such departments as empty rows (all zeros / em-dashes)? Or filter them out of the table?
   - Recommendation: Filter out entirely (inner join to dept_agg). Empty rows clutter the ranking without information. Flag in plan.

3. **What happens when the comparison page is loaded with 2-4 valid-looking sale_numbers that match 0 DB rows?**
   - What we know: CONTEXT.md covers "any sale_number fails lookup" as invalid. It doesn't specify whether a partial mismatch (3 requested, 2 found) is "fully invalid" or "show what we have + warn".
   - Recommendation: Treat ANY missing sale_number as fully invalid. Simpler UX, and the selection-footer flow guarantees valid numbers at the point of navigation — the missing-row case only arises from hand-crafted URLs or deleted sales.

4. **Does the Revenue Breakdown collapsed/expanded state need to persist across renders (e.g. across sale navigation)?**
   - What we know: CONTEXT.md recommends "no persistence for v1 — default collapsed, don't persist."
   - What's unclear: Whether "don't persist" means component-local state (persists across tab switches if SaleDetail stays mounted) or truly reset on every render.
   - Recommendation: Component-local `useState(false)`; resets on navigation to a new sale (different `saleNumber` key) because the whole SaleDetail tree re-renders. Good enough for v1.

## Environment Availability

Phase 6 is a code-only feature phase. External dependencies are already provisioned:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (`supabase db push`, `supabase gen types`) | New migration + types regen | ✓ | ^2.81.3 (package.json) | — |
| Node / npm | Running tests + dev server | ✓ | Phase 1 baseline | — |
| Shared Supabase project | RPC migration target | ✓ | Phase 1 connected | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Note: `supabase db pull` and `supabase db reset --linked` are **forbidden** per Phase 1 decision (STATE.md line 69). Only `supabase db push` + `supabase gen types` are safe against the shared prod project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom 28 |
| Config file | `vite.config.ts` / `vitest.config.ts` (inherited — no changes for Phase 6) |
| Quick run command | `npx vitest --run <glob>` |
| Full suite command | `npx vitest --run` (currently 479/479 passing) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPT-01 | Rankings table renders per-dept rows, sorts on each numeric column, filters by name/code, cross-filter highlight on row click | integration | `npx vitest --run src/components/DepartmentRankingsTable.test.tsx` | ❌ Wave 0 |
| DEPT-02 | Multi-line chart renders one `<Line>` per selected dept; chip-bar toggles add/remove series; cross-filter dims non-matching lines | integration | `npx vitest --run src/components/DepartmentRevenueLineChart.test.tsx` | ❌ Wave 0 |
| DEPT-03 | Stacked bar renders top-8 + Other; stack sums to 100 per x-point; cross-filter dims non-matching segments | integration | `npx vitest --run src/components/DepartmentShareStackedBarChart.test.tsx` | ❌ Wave 0 |
| SALE-04 | ComparisonTable renders metric rows × sale columns for 2/3/4 columns; sticky first column; metadata rows show no delta | integration | `npx vitest --run src/components/ComparisonTable.test.tsx` | ❌ Wave 0 |
| SALE-05 | Adjacent-pair delta colors: emerald up / rose down / gray flat / em-dash none | unit | `npx vitest --run src/lib/delta.test.ts` | ❌ Wave 0 |
| SALE-05 | ComparisonTable renders delta cells with the correct color class | integration | (same as SALE-04 file) | ❌ Wave 0 |
| SALE-06 | Waterfall transform produces 7 rows; running totals match net_revenue; up/down/start/end colors correct | unit + integration | `npx vitest --run src/lib/waterfall.test.ts src/components/RevenueWaterfallChart.test.tsx` | ❌ Wave 0 |
| INTR-01 | Clicking a rankings row sets `selectedDept`; clicking same row clears; "Clear filter" chip clears | integration | `npx vitest --run src/pages/Departments.test.tsx` (or src/tests/departments-page.test.tsx per repo convention) | ❌ Wave 0 |
| — | Selection footer appears at ≥1 selection, Compare button enables at ≥2, 5th click blocked | integration | `npx vitest --run src/tests/sales-page.test.tsx` (augment existing) | ✅ (augment) |
| — | `useSalesComparison` sorts queryKey regardless of input order | unit | `npx vitest --run src/hooks/useSalesComparison.test.ts` | ❌ Wave 0 |
| — | `useDepartmentRankings` parses RPC jsonb response into typed rows | unit | `npx vitest --run src/hooks/useDepartmentRankings.test.ts` | ❌ Wave 0 |
| — | SaleCompare page routes: empty / too-few / too-many / malformed / ok | integration | `npx vitest --run src/tests/sale-compare-page.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest --run <files-touched-in-task>` — under 5 seconds for unit files; ~10s per component integration file.
- **Per wave merge:** `npx vitest --run src/components/Department*.test.tsx src/components/Comparison*.test.tsx src/components/Revenue*.test.tsx src/hooks/useDepartment*.test.ts src/hooks/useSalesComparison.test.ts src/lib/waterfall.test.ts src/lib/delta.test.ts src/tests/departments-page.test.tsx src/tests/sale-compare-page.test.tsx` — the Phase 6 surface in isolation.
- **Phase gate:** `npx vitest --run` green; `npm run build` green; `npx eslint .` clean (baseline has 3 pre-existing warnings from earlier phases — do not introduce new ones).

### Wave 0 Gaps

- [ ] `src/lib/waterfall.test.ts` — unit tests for transform (7-row output, running-total math, null-guard returning null)
- [ ] `src/lib/delta.test.ts` — unit tests for `computePairDelta` (relative, absolute_pp, flat threshold, null/undefined, zero baseline)
- [ ] `src/hooks/useSalesComparison.test.ts` — queryKey sort stability; result order matches input order
- [ ] `src/hooks/useDepartmentRankings.test.ts` + `useDepartmentRevenueSeries.test.ts` + `useDepartmentShareSeries.test.ts` — mocked `supabase.rpc` returns; type assertion stability
- [ ] `src/components/DepartmentRankingsTable.test.tsx` — sort per column, filter, highlight-on-click
- [ ] `src/components/DepartmentRevenueLineChart.test.tsx` — line per dept, dim on cross-filter
- [ ] `src/components/DepartmentShareStackedBarChart.test.tsx` — top-8 + Other, stack sums to 100
- [ ] `src/components/DepartmentChipBar.test.tsx` — chip toggles, max-8 enforcement
- [ ] `src/components/ComparisonTable.test.tsx` — 2/3/4-column; delta colors; metadata rows skip delta
- [ ] `src/components/RevenueWaterfallChart.test.tsx` — step order, color per direction, collapse default state
- [ ] `src/components/SaleSelectionFooter.test.tsx` — appears at ≥1 selection, Compare enabled at ≥2, nav on click
- [ ] `src/tests/departments-page.test.tsx` — integration: range filter + metric toggle + cross-filter wiring across 3 mocked children
- [ ] `src/tests/sale-compare-page.test.tsx` — integration: all 5 URL branches (ok / empty / too-few / too-many / malformed)
- [ ] Augment `src/tests/sales-page.test.tsx` — selection column + footer + navigation to `/sales/compare?sales=…`
- [ ] Augment `src/tests/dashboard-layout.test.tsx` — flip Departments from disabled to NavLink (mirror Phase 5 plan 05-07 pattern)

**Framework install:** None. Vitest is present.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuse Phase 1 Supabase auth + `<ProtectedRoute>` — no changes |
| V3 Session Management | yes | Supabase JWT in cookie, no new session state |
| V4 Access Control | yes | Existing admin-only RLS on `sales` + `sale_departments`; three new RPCs gate via `private.is_admin()` + `grant execute to authenticated` |
| V5 Input Validation | yes | `?sales=` param: character whitelist `[A-Za-z0-9-_]+` in `parseSalesParam`; all date params typed `date` at the RPC boundary (T-02 mitigation inherited from Phase 4) |
| V6 Cryptography | no | No new cryptographic surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via RPC date params | Tampering | Typed `date` params — Postgres casts invalid strings to a clear error before the function body runs (Phase 4 `kpi_summary` threat model, inherited) |
| search_path hijack on security-definer function | Elevation of Privilege | `set search_path = public, pg_temp` on every new RPC (Phase 2/4 mandatory hygiene) |
| RBAC bypass — non-admin calling an aggregate RPC | Elevation of Privilege | Explicit `if not private.is_admin() then raise exception …` at the top of every new RPC body — defense-in-depth on top of RLS |
| XSS via reflected URL search param | Tampering | `?sales=` never lands in DOM as markup; it passes through character whitelist + flows into PostgREST `.in('sale_number', array)` parameterized query. JSX auto-escapes sale_number text children. |
| XSS via department name / display_name | Tampering | JSX auto-escape — display_name renders as React text child in chips, tables, tooltip |
| ReDoS on comparison / ranking filter input | DoS | TanStack Table `globalFilterFn: 'includesString'` — no regex compilation from user input (Phase 3 established mitigation) |
| CSRF on comparison navigation | Tampering | Read-only client-side navigation; no mutations in Phase 6 |

### Phase-specific notes

- All three new RPCs inherit the Phase 4 `kpi_summary` threat disposition.
- No new writes (no mutations). Phase 1 RLS has no INSERT/UPDATE/DELETE policies on `sales` or `sale_departments`; Phase 6 doesn't need them.
- The comparison page's `.in('sale_number', [...])` query is parameterized — the sale_number array is serialized by supabase-js, not concatenated into a query string.

## Project Constraints (from CLAUDE.md)

Extracted directives the planner MUST preserve in every task:

1. **Match TPC App stack exactly** — React 19.2, TS 5.9.3, Vite 7.3.1, Tailwind 4.2.1, Supabase JS 2.101.1, Zustand 5.0.11, Zod 4.3.6, React Router 7.13.1. No new frameworks; no stack divergence.
2. **Tailwind v4, no shadcn** — locked by Phases 1/3/4/5. Phase 6 does not initialize shadcn.
3. **TanStack Query v5 for server state, Zustand for client state** — Phase 6 uses Zustand **only if needed** (not needed per CONTEXT.md: page-local state for cross-filter and selection).
4. **Recharts for charts** — no Nivo, no Tremor, no Chart.js.
5. **TanStack Table for data tables** — no AG Grid, no MUI DataGrid.
6. **Server-side aggregation for all financial math** — INFR-04 is a project-wide constraint. Any JS `.reduce()` over currency fields is a spec violation.
7. **Supabase CLI forbidden commands** — never run `supabase db pull` or `supabase db reset --linked` against the shared prod project. Only `supabase db push` + `supabase gen types`.
8. **`security_definer` RPCs must set `search_path = public, pg_temp`** — mandatory hygiene from Phase 2 decision log. Non-negotiable.
9. **No direct repo edits outside a GSD workflow** — enforced at the user level, not the plan level; surface in the plan as a reminder to use `/gsd:execute-phase`.
10. **Desktop-first responsive** — INFR-03 project constraint. Phase 6 pages should collapse gracefully on tablet but don't need mobile-optimized layouts. The sticky footer + sticky first column assume 1280px+.

## Sources

### Primary (HIGH confidence)
- `package.json` — installed library versions (read directly)
- `CLAUDE.md` — project stack + constraints (provided in initial context)
- `.planning/REQUIREMENTS.md` — DEPT-01/02/03, SALE-04/05/06, INTR-01, INFR-04 definitions (read directly)
- `.planning/PROJECT.md` — out-of-scope list (read directly)
- `.planning/STATE.md` — Phase 1/2 decisions: forbidden Supabase commands, shared Supabase project, numeric(14,2) + server-side aggregation posture (read directly)
- `.planning/phases/06-department-analysis-sale-comparison/06-CONTEXT.md` — all locked decisions (read directly)
- `.planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md` — visual contract, delta helper signature, waterfall color mapping, copywriting (read directly)
- `supabase/migrations/20260422000000_kpi_summary_rpc.sql` — RPC template this phase mirrors (read directly)
- `supabase/migrations/20260421000011_import_sale_rpc.sql` — secondary RPC template, shows jsonb input pattern (read directly)
- `supabase/migrations/20260421000007_rls_policies.sql` — RLS posture (read directly)
- `src/hooks/useSalesInRange.ts`, `useDepartmentGrid.ts`, `useKpiSummary.ts` — hook patterns (frozen-empty singleton, keepPreviousData, queryKey shape) (read directly)
- `src/components/SalesTable.tsx`, `EstimateAccuracyChart.tsx`, `NetRevenueTrendChart.tsx`, `DepartmentHeatMap.tsx`, `DepartmentTable.tsx` — chart + table patterns (read directly)
- `src/lib/chart-colors.ts`, `period.ts`, `format.ts` — shared primitives (read directly)
- `src/db/database.types.ts` — schema types for sales + sale_departments (read directly)

### Secondary (MEDIUM confidence)
- [Recharts waterfall pattern — Atomic Object](https://spin.atomicobject.com/stacked-bar-charts-recharts/) — confirms transparent-padding-bar is the canonical workaround
- [Recharts native waterfall request (GitHub issue #7010)](https://github.com/recharts/recharts/issues/7010) — confirms no native support as of 2026

### Tertiary (LOW confidence)
- TanStack Table v8 row-selection docs — API surface described from memory of v8's documented `rowSelection` state + `getRowId` / `enableRowSelection`. Matches how the feature works in practice across v8.x; recommend verifying against `https://tanstack.com/table/latest/docs/guide/row-selection` during execution if edge cases appear.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package already installed, versions verified from package.json, patterns proven across Phases 1–5
- Architecture (RPCs, hooks, components): HIGH — direct templates exist for each (kpi_summary for RPCs, useDepartmentGrid for RPC-backed hooks, EstimateAccuracyChart for stacked Recharts, DepartmentTable for TanStack Table)
- Waterfall pattern: MEDIUM — canonical community pattern, verified via web search; not verified in this codebase yet (Phase 6 is the first consumer)
- Cross-filter opacity transition: MEDIUM — Pattern 4's CSS-wrapper smoothing is the idiomatic React+Recharts solution, but the "Recharts does not interpolate opacity" claim is marked A2 in Assumptions Log; if it turns out wrong, the mitigation (set `isAnimationActive={false}`) still works
- Pitfalls: HIGH — drawn from Phase 1-5 execution history (SalesTable virtualizer math, v4→v5 keepPreviousData, XSS via JSX auto-escape already exercised)
- Open questions: "Lots above estimate" definition is the most material — recommend explicit user confirmation before execution

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days; stack is stable, no major Recharts / TanStack / Supabase releases expected in that window)
