# Phase 3: Sale Views - Research

**Researched:** 2026-04-21
**Domain:** React data tables (sortable + filterable + virtualized), TanStack Query against Supabase, React Router v7 detail routes, desktop-first responsive shell
**Confidence:** HIGH

## Summary

Phase 3 is a two-screen data-viewer layered on top of the Phase 1 shell and the Phase 2 schema. Every library needed is either already installed (@tanstack/react-query v5, @supabase/supabase-js v2, react-router v7, zod v4) or is a brand-name TanStack addition (`@tanstack/react-table@^8.21.3` + `@tanstack/react-virtual@^3.13.24`). CLAUDE.md pins both at `^8` and `^3` respectively and the CONTEXT/UI-SPEC lock every visual decision, so this research is narrow: **confirm the wiring, not the choice of library**.

The one hazard that materially affects planning is a **documentation drift between the Phase 3 UI-SPEC and the Phase 2 shipped code**: `sales.payment_status` in the live database is a bare enum string (`'paid' | 'partial' | 'unpaid' | null`), not "a derived label + compact JSON" as the UI-SPEC describes. Phase 3 planning must either (a) render the enum as-is, or (b) add a Phase 2 follow-up migration to store counts. Option (a) is the simple v1 path and matches the production data today.

**Primary recommendation:** Install `@tanstack/react-table@^8.21.3` + `@tanstack/react-virtual@^3.13.24`, follow the official TanStack fixed-row-height virtualization example (single `<tbody>` with `translateY(virtualRow.start - index * virtualRow.size)`), and wrap every Supabase query in a TanStack Query `useQuery` with `.throwOnError()` on the Supabase builder. Render `payment_status` as the enum string (falling back to `EMPTY`) and flag the UI-SPEC drift in the planner for user confirmation.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sales List Page (SALE-01):**
- Dense sortable TanStack Table (not card grid) — 457-row dataset needs efficient scanning
- Columns: `sale_number`, `title`, `sale_date`, `lots_auctioned`, `lots_sold`, `sell_through_%` (computed), `total_sold_value`, `net_revenue`
- Default sort: `sale_date` DESC (newest first)
- Client-side rendering — all 457 rows returned by one query; react-window or TanStack Virtual for smooth scroll
- Debounced text filter (~200ms) across `title` + `sale_number` (case-insensitive, client-side)
- Column sort toggles (asc/desc/unsorted) via TanStack Table built-ins
- Empty state: "No sales imported yet. Run `npm run import:pdfs` — see README." (graceful when Phase 2 live run is deferred)
- Loading skeleton: 10 shimmer rows matching column widths

**Sale Detail Page (SALE-02):**
- Route: `/sales/:saleNumber` (human-readable URL; `sale_number` is unique per schema)
- Layout: two stacked sections, both full-width:
  - Summary card at top: title, sale_date, then a 4×3 grid of KPIs covering every "All Departments" metric
  - Department breakdown table below
- `validation_warning=true` → amber banner above summary card with link to reload
- 404 handling: unknown `sale_number` → "Sale not found" page with "Back to sales" link
- Back button: link to `/sales`

**Department Table (SALE-03, INTR-02):**
- TanStack Table v8 (headless, Tailwind-styled)
- Columns: Department (code + display_name), Lots Auctioned, Lots Sold, Sell-through %, Sold Value, Estimate Range (low–high), Reserves, Revenue
- Default sort: `revenue` DESC
- Per-column filters in header (text filters on department; numeric filters are range-less v1 — just sort columns)
- Rows are read-only; no selection UI
- Footer row: totals (sum across all dept rows) — purely visual, intentionally NOT asserting equality with sale-level totals

**Data Fetching + Responsive:**
- TanStack Query hooks:
  - `useSales()` — returns `sales[]` sorted by `sale_date DESC`; query key `['sales']`; `staleTime: 5 * 60_000`
  - `useSale(saleNumber)` — returns `{ sale, departments[] }`; query key `['sale', saleNumber]`; `staleTime: 5 * 60_000`
- Both hooks go through `src/lib/supabase.ts` (anon client) — RLS admin-only policies enforce access
- Loading states: skeletons on both pages (not spinners) to prevent layout shift
- Error states: inline error card with retry button
- Responsive breakpoints: `lg:` (1024px+) is the target; `md:` (768-1023) collapses the Phase 1 sidebar to an icon rail; below 768 out of scope (INFR-03 desktop-first)
- Router: integrate Sales + Sale Detail into the Phase 1 `App.tsx` routes table, under the existing `<ProtectedRoute>` gate

### Claude's Discretion

- Exact table cell formatting (currency: `$1,234,567.89` with Intl.NumberFormat; percentages: `42.5%`; dates: `Nov 16, 2022`) — **UI-SPEC has since locked these verbatim in `src/lib/format.ts`**
- Whether to extract a shared `DataTable` component vs inline each table
- Skeleton row count and shimmer animation choice — **UI-SPEC has since locked 10 rows / 6 rows / `motion-safe:animate-pulse`**
- How to handle the `payment_status` column rendering (it's a derived label + compact JSON per Phase 2 decisions — render the label + tooltip-expand counts on hover OR just show label in v1) — **see Open Question #1 below; the Phase 2 shipped code stores enum string ONLY, not label + JSON**

### Deferred Ideas (OUT OF SCOPE)

- Client-side CSV export of the sales list (Phase 8)
- Multi-select to compare sales (Phase 6)
- Revenue waterfall chart on sale detail (Phase 6, SALE-06)
- Department-level drill-down page (post-v1)
- URL-persisted filters/sort (nice-to-have, can be added later without schema changes)
- Saved searches / favorites (not in v1)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SALE-01 | User can browse all imported sales in a searchable, sortable list (by date, sale number, title) | `useSales()` TanStack Query hook + `SalesTable` with TanStack Table sort state + TanStack Virtual for 457 rows + debounced globalFilter (see Pattern 1, 2, 3) |
| SALE-02 | User can view a sale detail page with the complete auction profile (all metrics from the PDF) | `useSale(saleNumber)` hook with parallel Supabase queries (`sales` + `sale_departments`) + `SaleSummaryCard` 4×N KPI grid + React Router v7 `useParams` (see Pattern 4, 5) |
| SALE-03 | Sale detail page includes a sortable department breakdown table | `DepartmentTable` — same TanStack Table v8 primitives as `SalesTable`, no virtualization needed (typical 8–20 rows, see Pattern 1) |
| INFR-03 | Desktop-first responsive layout (graceful collapse on tablet, not mobile-optimized) | Tailwind `md:`/`lg:` breakpoints, sidebar icon-rail fallback on `md`, `overflow-x-auto` on table containers (see Pattern 6) |
| INTR-02 | All data tables support column sorting and text/numeric filtering | TanStack Table v8 `getSortedRowModel` + `getFilteredRowModel` + `globalFilterFn: 'includesString'` built-in (see Pattern 3) |

## Project Constraints (from CLAUDE.md)

- **Stack lock:** React 19, TypeScript 5.9.3, Vite 7.3.1, Tailwind v4, React Router v7.13.1, Supabase JS v2, Zod v4, TanStack Query v5, Zustand v5 — all versions are exact matches with TPC App. Phase 3 MUST NOT deviate.
- **TanStack Table version:** `^8` (headless, Tailwind-styled, no AG Grid / MUI DataGrid)
- **GSD workflow:** Use `/gsd:execute-phase` for Phase 3. No ad-hoc edits outside a GSD workflow.
- **No CSS custom maintenance:** Utility-first Tailwind only. Phase 3 UI-SPEC declares zero new `@theme` tokens.
- **TPC App visual parity:** Phase 3 UI-SPEC explicitly preserves the Phase 1 token set (no new accents, no new spacing values).
- **Financial accuracy:** All monetary columns are `numeric(14,2)` server-side; the client must never perform rounding or floating-point arithmetic on money. Display-only formatting is fine; aggregation is server-side (INFR-04, already satisfied by Phase 2).

## Phase 1/2 Alignment

- `src/lib/supabase.ts` — Proxy lazy client; use for all Phase 3 queries. [VERIFIED: read file]
- `src/db/database.types.ts` — `Database['public']['Tables']['sales'|'sale_departments'|'departments']` Row types. Schema confirmed to include `validation_warning boolean`, `payment_status text | null`, all money columns nullable. [VERIFIED: read file]
- `src/stores/authStore.ts` — auth gate already enforces admin-only; Phase 3 pages live behind `ProtectedRoute` in `App.tsx`. No authStore changes needed. [VERIFIED: read file]
- `src/layouts/DashboardLayout.tsx` — sidebar currently renders 6 `<span aria-disabled="true">` placeholders with "Coming soon" aside. Phase 3 must replace the Sales entry with an active `<NavLink>`; no existing NavLink precedent exists in the repo. [VERIFIED: read file]
- `src/main.tsx` — `QueryClient` is module-scoped and wraps `<App/>` via `QueryClientProvider`; `staleTime: 60_000` default, `refetchOnWindowFocus: false`, `retry: 1`. Phase 3 hooks inherit this but can override `staleTime` per query. [VERIFIED: read file]
- `src/App.tsx` — current routes: `/login`, `/` (Dashboard), catch-all redirect to `/`. Phase 3 adds `/sales` and `/sales/:saleNumber` as siblings of `/` inside `<ProtectedRoute>` → `<DashboardLayout>`. [VERIFIED: read file]
- `src/index.css` — two tokens only: `--color-accent` (#2563eb), `--color-accent-hover`. No new tokens for Phase 3. [VERIFIED: read file]
- **Phase 2 shipped `payment_status` as bare enum** (`'paid'` | `'partial'` | `'unpaid'` | `null`). The Phase 2 RESEARCH doc proposed "enum string + compact JSON" but the shipped `derivePaymentStatus()` returns only the enum. [VERIFIED: read `scripts/lib/parsers/sale-page.ts:155-165` + schema `scripts/lib/schemas.ts:35`]

---

## Standard Stack

### Core (to install in Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.21.3 | Headless table: sort, filter, column defs | Pinned by CLAUDE.md; zero runtime deps beyond React; peers `react >=16.8`. Fully headless — we own the DOM and Tailwind classes. Latest stable, published 2026-04-18. [VERIFIED: `npm view @tanstack/react-table version` → 8.21.3, modified 2026-04-18T02:45:58Z] |
| @tanstack/react-virtual | ^3.13.24 | Row virtualization (457 rows) | Same maintainer as Table; explicit peer `react ^19.0.0` support; latest stable, published 2026-04-17. Headless — we own the DOM. [VERIFIED: `npm view @tanstack/react-virtual version` → 3.13.24, modified 2026-04-17T11:51:34Z] |

### Already installed (reuse, do not re-install)

| Library | Version | Purpose |
|---------|---------|---------|
| @tanstack/react-query | ^5.99.2 | Server state + caching — `useQuery`, `useQueryClient`, query invalidation for reload button |
| @tanstack/react-query-devtools | ^5.99.2 | Already wired in `main.tsx` behind `import.meta.env.DEV` |
| @supabase/supabase-js | ^2.101.1 | `supabase.from('sales').select('*')` — the Phase 2 schema is generated into `database.types.ts` |
| react-router | ^7.13.1 | `useParams`, `<Link>`, `<NavLink>`, `<Route path="/sales/:saleNumber">` |
| react | ^19.2.0 | useState, useMemo, useDeferredValue, useTransition |
| tailwindcss | ^4.2.1 | Styling |
| zustand | ^5.0.11 | Not needed in Phase 3 — filter state is local to `SalesPage`; no cross-page state. |
| zod | ^4.3.6 | Not needed at the read-boundary. Phase 2 already validates on insert; read path trusts DB types. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | AG Grid | Heavy, enterprise-licensed features. TanStack is free + headless (CLAUDE.md alternative). |
| TanStack Table | MUI DataGrid | Pulls in Material UI. We use Tailwind. (CLAUDE.md alternative.) |
| TanStack Virtual | react-window | Works but different maintainer. TanStack Virtual integrates more smoothly with TanStack Table and supports React 19. CONTEXT.md says "react-window or TanStack Virtual" — we choose TanStack Virtual for same-maintainer ergonomics. |
| TanStack Virtual | none (render all 457 rows) | DOM-heavy: 457 × ~8 cells = 3,656 DOM nodes in the tbody plus Tailwind class bloat. Measurably slower on `hover:bg-gray-100` repaints. CONTEXT locks virtualization. |
| TanStack Table `getFilteredRowModel` | Pre-filter data with `useMemo` + `includes` | Simpler for single-text filter, but (a) TanStack Table has `globalFilterFn: 'includesString'` built-in, (b) keeping filter state on the table means the filter-count readout (`23 of 457 sales`) comes directly from `table.getFilteredRowModel().rows.length`, and (c) INTR-02 applies to BOTH tables — using the same mechanism twice is less code. **Use `getFilteredRowModel()` + globalFilter.** |

### Version verification

All versions verified against npm registry on 2026-04-21:

```bash
# Verified live:
npm view @tanstack/react-table version  # → 8.21.3 (published 2026-04-18)
npm view @tanstack/react-virtual version # → 3.13.24 (published 2026-04-17)
npm view @heroicons/react version        # → 2.2.0 (unused — we inline SVG per UI-SPEC)
```

### Installation

```bash
npm install @tanstack/react-table@^8.21.3 @tanstack/react-virtual@^3.13.24
```

No new devDependencies. Types ship with both packages.

---

## Architecture Patterns

### Recommended File Structure (extends existing repo)

```
src/
├── components/
│   ├── SalesTable.tsx              # TanStack Table + Virtual; 457-row list
│   ├── DepartmentTable.tsx         # TanStack Table (no virtual); sale detail
│   ├── SaleSummaryCard.tsx         # 4×N KPI tile grid
│   ├── ValidationWarningBanner.tsx # Amber banner with Reload button
│   ├── FilterInput.tsx             # Debounced text input + clear button
│   ├── SortIndicator.tsx           # Chevron icons (up/down/updown)
│   ├── TableSkeleton.tsx           # Shimmer rows
│   ├── EmptyState.tsx              # Generic heading + body wrapper
│   ├── ErrorState.tsx              # Heading + body + Retry button
│   ├── BackLink.tsx                # ← label link
│   └── (existing) ProtectedRoute.tsx, AccessDenied.tsx
├── hooks/
│   ├── useSales.ts                 # TanStack Query: list
│   └── useSale.ts                  # TanStack Query: detail (sale + departments)
├── lib/
│   ├── format.ts                   # Intl-based formatters + EMPTY const
│   └── (existing) supabase.ts
├── pages/
│   ├── Sales.tsx                   # /sales route
│   ├── SaleDetail.tsx              # /sales/:saleNumber route
│   └── (existing) Dashboard.tsx, Login.tsx
├── layouts/
│   └── (modify) DashboardLayout.tsx  # flip Sales nav entry from placeholder to NavLink
├── tests/
│   ├── sales-table.test.tsx
│   ├── department-table.test.tsx
│   ├── sales-page.test.tsx
│   ├── sale-detail-page.test.tsx
│   ├── format.test.ts
│   └── (existing) *
└── App.tsx                         # add two routes
```

### Pattern 1: TanStack Table v8 — fixed-row-height + virtualization (457-row list)

This is the wiring for `SalesTable`. Uses the **fixed-row-height** variant of the official TanStack example (our rows are a fixed 44px per UI-SPEC) which keeps the JSX structure as a semantic `<table>` rather than forcing CSS grid on the table element.

```tsx
// src/components/SalesTable.tsx
// Source: https://github.com/TanStack/virtual/blob/main/examples/react/table/src/main.tsx
// (Fixed-height table virtualization — simpler than the dynamic-row-height example
//  and exactly right for Phase 3's locked `h-11` row height.)

import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Database } from '../db/database.types';
import { formatCurrency, formatCount, formatDate, formatPercent, EMPTY } from '../lib/format';

type Sale = Database['public']['Tables']['sales']['Row'];

interface SalesTableProps {
  sales: Sale[];
  filterText: string;   // already-debounced value from FilterInput
}

const ROW_HEIGHT = 44;  // UI-SPEC h-11

export function SalesTable({ sales, filterText }: SalesTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'sale_date', desc: true },  // UI-SPEC default sort
  ]);

  const columns = React.useMemo<ColumnDef<Sale>[]>(() => [
    { accessorKey: 'sale_number', header: 'Sale #', size: 100 },
    { accessorKey: 'title',       header: 'Title',  size: 280 },
    {
      accessorKey: 'sale_date',
      header: 'Date',
      cell: (info) => formatDate(info.getValue<string | null>()),
      size: 120,
    },
    {
      accessorKey: 'lots_auctioned',
      header: 'Lots',
      cell: (info) => formatCount(info.getValue<number | null>()),
      size: 80,
    },
    {
      accessorKey: 'lots_sold',
      header: 'Sold',
      cell: (info) => formatCount(info.getValue<number | null>()),
      size: 80,
    },
    {
      id: 'sell_through',
      header: 'Sell-through',
      accessorFn: (row) =>
        row.lots_auctioned && row.lots_sold
          ? row.lots_sold / row.lots_auctioned
          : null,
      cell: (info) => formatPercent(info.getValue<number | null>()),
      size: 120,
    },
    {
      accessorKey: 'total_sold_value',
      header: 'Sold value',
      cell: (info) => formatCurrency(info.getValue<number | null>()),
      size: 140,
    },
    {
      accessorKey: 'net_revenue',
      header: 'Net revenue',
      cell: (info) => formatCurrency(info.getValue<number | null>()),
      size: 140,
    },
  ], []);

  const table = useReactTable({
    data: sales,
    columns,
    state: { sorting, globalFilter: filterText },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',  // case-insensitive, built-in
    enableMultiSort: false,            // UI-SPEC single-column sort
  });

  const { rows } = table.getRowModel();

  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,  // UI-SPEC
  });

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto max-h-[calc(100dvh-16rem)] rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-[1] border-b border-gray-200 dark:border-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-11">
                {headerGroup.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDir === 'asc' ? 'ascending'
                        : sortDir === 'desc' ? 'descending'
                        : 'none'
                      }
                      style={{ width: header.getSize() }}
                      className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-4 text-left"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIndicator state={sortDir} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {virtualizer.getVirtualItems().map((vRow, index) => {
              const row = rows[vRow.index];
              return (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => navigate(`/sales/${row.original.sale_number}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/sales/${row.original.sale_number}`);
                    }
                  }}
                  style={{
                    height: `${vRow.size}px`,
                    transform: `translateY(${vRow.start - index * vRow.size}px)`,
                  }}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset outline-none"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Why `virtualRow.start - index * virtualRow.size`:** In a semantic `<table>`, rows are naturally laid out top-to-bottom by the browser. Absolute positioning each row (as the dynamic-row-height example does) requires switching the table element to `display: grid`, which loses some semantic and default-styling benefits. The fixed-row-height approach keeps semantic HTML and compensates for the "natural" position of each row by subtracting `index * rowHeight` from the translate. This matches the official TanStack Virtual Table example verbatim. [VERIFIED: source fetched from github.com/TanStack/virtual/main/examples/react/table]

**When to consider the dynamic-row-height variant:** Only if rows need variable height (e.g., wrapping long titles). UI-SPEC locks `h-11` (44px) with no wrap — we don't need dynamic measurement. Stick with fixed-height.

### Pattern 2: Department table (TanStack Table without virtualization)

Same component conventions as `SalesTable`, minus `useVirtualizer`. Typical sale has 8–20 dept rows; virtualization adds no value and adds DOM complexity. Also: no row click handler, no tabIndex, no focus ring (UI-SPEC: "rows are read-only"). Includes a `<tfoot>` totals row computed in React (sum across `departments` array), intentionally not asserting equality with sale-level totals.

```tsx
// Simplified structure
<table>
  <thead>{/* same sort-aware th pattern as SalesTable */}</thead>
  <tbody>{table.getRowModel().rows.map(...)}</tbody>
  <tfoot>
    <tr className="bg-gray-50 dark:bg-gray-800 font-semibold border-t-2 border-gray-300">
      <td className="px-4 text-sm">Totals</td>
      <td>{formatCount(sumBy(departments, 'lots_auctioned'))}</td>
      {/* ... */}
    </tr>
  </tfoot>
</table>
```

### Pattern 3: TanStack Query + Supabase — `useSales` and `useSale`

Both hooks use the **`.throwOnError()` pattern** recommended by makerkit — without it, Supabase returns errors in the response object rather than throwing, so TanStack Query never sees the error and its `isError` state is wrong. [CITED: makerkit.dev/blog/saas/supabase-react-query]

```ts
// src/hooks/useSales.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

export function useSales() {
  return useQuery<Sale[]>({
    queryKey: ['sales'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

```ts
// src/hooks/useSale.ts — parallel fetch, one query key
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleDepartment = Database['public']['Tables']['sale_departments']['Row'];

export type SaleDetail =
  | { status: 'ok'; sale: Sale; departments: SaleDepartment[] }
  | { status: 'not_found' };

export function useSale(saleNumber: string) {
  return useQuery<SaleDetail>({
    queryKey: ['sale', saleNumber],
    staleTime: 5 * 60_000,
    enabled: Boolean(saleNumber),
    queryFn: async () => {
      const saleResult = await supabase
        .from('sales')
        .select('*')
        .eq('sale_number', saleNumber)
        .maybeSingle();
      if (saleResult.error) throw saleResult.error;
      if (!saleResult.data) return { status: 'not_found' };

      const deptResult = await supabase
        .from('sale_departments')
        .select('*, department:departments(code, display_name, auto_discovered)')
        .eq('sale_id', saleResult.data.id)
        .order('revenue', { ascending: false, nullsFirst: false });
      if (deptResult.error) throw deptResult.error;

      return {
        status: 'ok',
        sale: saleResult.data,
        departments: deptResult.data ?? [],
      };
    },
  });
}
```

**Why two queries instead of one with a join:** Supabase supports embedded resources (`'*, sale_departments(*)'`) but inserting the join into a single query means the Query Devtools and `staleTime` apply to the whole graph atomically — which is fine, but it couples caching granularity. The two-query sequence above keeps `['sale', saleNumber]` as a single cache entry while still being serial (sale row first, then its departments). Alternative: a single `supabase.from('sales').select('*, sale_departments(*, department:departments(*))').eq('sale_number', saleNumber).maybeSingle()` call — **one round trip**, and returns `null` if sale is missing. This is strictly better for Phase 3 (one round trip, one cache entry, cleaner 404 handling). Recommend this variant:

```ts
// Preferred: single round trip
queryFn: async () => {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      sale_departments (
        *,
        department:departments ( code, display_name, auto_discovered )
      )
    `)
    .eq('sale_number', saleNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'not_found' };
  const { sale_departments, ...sale } = data;
  return { status: 'ok', sale, departments: sale_departments ?? [] };
},
```

This is the recommended implementation.

### Pattern 4: React Router v7 — `useParams` + 404 handling

`useParams()` in React Router v7 is generic-typed but **the return type is `Partial<T>`** — the generic is not a guarantee, it's a hint. You still need a runtime check. [CITED: reactrouter.com/api/hooks/useParams]

```tsx
// src/pages/SaleDetail.tsx
import { useParams, Link } from 'react-router';
import { useSale } from '../hooks/useSale';

export function SaleDetailPage() {
  const { saleNumber } = useParams<{ saleNumber: string }>();

  if (!saleNumber) {
    // Defensive — React Router should never land us here with an empty param
    // since the route is /sales/:saleNumber, but the type is Partial<T>.
    return <NotFoundState saleNumber="" />;
  }

  const query = useSale(saleNumber);

  if (query.isLoading) return <SaleDetailSkeleton />;
  if (query.isError)  return <ErrorState ... />;
  if (query.data?.status === 'not_found') return <NotFoundState saleNumber={saleNumber} />;

  const { sale, departments } = query.data!;
  // render summary card + dept table + (sale.validation_warning && <ValidationWarningBanner/>)
}
```

**Route registration in App.tsx** (add two routes inside the existing ProtectedRoute → DashboardLayout block):

```tsx
<Route element={<ProtectedRoute />}>
  <Route element={<DashboardLayout />}>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/sales" element={<SalesPage />} />
    <Route path="/sales/:saleNumber" element={<SaleDetailPage />} />
  </Route>
</Route>
```

### Pattern 5: Debounced filter input with React 19

UI-SPEC requires 200ms debounce on the sales list filter. Two viable options:

**Option A (recommended) — `useDeferredValue` (React 19 built-in):**
```tsx
const [input, setInput] = React.useState('');
const deferredFilter = React.useDeferredValue(input);
// pass deferredFilter to SalesTable; React schedules the expensive re-render
// after typing settles. No explicit timer.
```

Pros: zero dependencies, built into React 19, automatically adapts to device speed. Cons: not strictly 200ms — React decides.

**Option B — manual `setTimeout` debounce:**
```tsx
React.useEffect(() => {
  const id = setTimeout(() => setDebounced(input), 200);
  return () => clearTimeout(id);
}, [input]);
```

Pros: hits the UI-SPEC "~200ms" exactly. Cons: hand-rolled timer, needs cleanup, harder to test.

**Recommendation:** Use `useDeferredValue` — the UI-SPEC says "~200ms" not "exactly 200ms", and `useDeferredValue` is the React-19-idiomatic answer. For the filter match count (`{n} of {total}`) to update immediately while the table re-renders lazily, pass `input` to the count and `deferredFilter` to the table. Fall back to Option B only if planner wants deterministic timing for test assertions.

### Pattern 6: Sidebar icon-rail at `md` breakpoint

The Phase 1 `DashboardLayout` renders the sidebar as `<aside>` with static 240px width (`grid-cols-[15rem_1fr]`). Phase 3 UI-SPEC adds: collapse to 64px icon rail at `md` (768–1023px).

**Implementation approach:**

```tsx
// Sidebar: full width on lg+, icon-rail width on md
<aside className="flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 w-16 md:w-16 lg:w-60 transition-[width]">
  {/* Logo: full on lg, initial on md */}
  <div className="h-12 flex items-center justify-center lg:justify-start lg:px-6 text-base font-semibold">
    <span className="hidden lg:inline">TPC Dashboard</span>
    <span className="lg:hidden">TPC</span>
  </div>
  {/* Nav: icons only on md, icon+label on lg */}
  <nav className="mt-2 flex flex-col">
    {NAV_LINKS.map((link) => (
      <NavLink
        key={link.label}
        to={link.to}
        title={link.label}
        aria-label={link.label}
        className={({ isActive }) =>
          `flex items-center h-11 gap-3 px-3 lg:px-6 text-sm ${
            isActive
              ? 'text-accent border-l-2 border-accent bg-accent/5'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`
        }
      >
        <link.Icon className="w-5 h-5 shrink-0" />
        <span className="hidden lg:inline">{link.label}</span>
      </NavLink>
    ))}
  </nav>
</aside>
```

**Change to parent grid:** `grid-cols-[15rem_1fr]` (Phase 1) becomes `grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr]`. The sidebar itself owns its width class; the grid column just tracks it.

**Nav disabled entries:** Phases 4–9 links are still "Coming soon" but they must now render an icon (for the icon-rail) AND stay non-clickable. Keep `<span aria-disabled="true">` for them, render the icon + (on lg) label + (on lg) "Coming soon" aside. Only Sales becomes an active `<NavLink>`.

**Heroicons needed (inline SVG — no package dep per Phase 1 precedent):**
- `table-cells` — Sales (active now)
- `chart-bar` — Trends
- `building-library` — Departments
- `users` — Team
- `document-text` — Reports
- `chart-pie` — Custom Charts
- `chevron-up`, `chevron-down`, `chevron-up-down` — sort indicators (table headers)
- `exclamation-triangle` — validation banner
- `x-mark` — filter input clear button
- `arrow-left` (optional) — back link on detail page

All sourced from heroicons.com (MIT). Copy the outline SVG markup directly. Per UI-SPEC, stroke-width 1.5.

### Anti-Patterns to Avoid

- **Don't mix `globalFilter` with per-column `columnFilters` for the same filter UX.** UI-SPEC locks the sales list to a single text filter; use `globalFilter` only. Per-column filtering is not needed in v1 — the department table gets "filters" per the SALE-03 bullet, but the UI-SPEC Interaction contract doesn't render filter inputs for the dept table, only sort. Treat "filters" as satisfied by sort + column filtering-capable API for future phases.
- **Don't fetch sale + departments serially in two `useQuery` hooks.** Two cache entries with separate loading states means the UI flickers (summary card appears, then dept table appears). Use the single embedded-resource query from Pattern 3.
- **Don't use `JSON.parse(payment_status)`.** The Phase 2 shipped value is a bare enum string. See Open Question #1. If you render `payment_status` as a tile value, use `sale.payment_status ?? EMPTY`.
- **Don't render 457 rows without virtualization "because it's fast enough."** It probably IS fast enough in terms of scroll latency, but the UI-SPEC Interaction contract requires `max-h-[calc(100dvh-16rem)]` on the scroll container with sticky header — meaning the container MUST scroll, not the page. The tbody rendering-height decision is locked.
- **Don't convert the table to CSS grid.** The UI-SPEC Layout Specifications explicitly use semantic `<table>`, `<thead>`, `<tbody>`. The fixed-row-height virtualization pattern (Pattern 1) keeps semantic HTML; the dynamic-row-height pattern forces `display:grid` on the table. Avoid the latter.
- **Don't compute derived columns at rendering time when the value is needed for sorting.** `sell_through` is computed from `lots_sold / lots_auctioned`. Use `accessorFn` on the column definition so TanStack Table sees the numeric value for sorting, then format it in the `cell` renderer. If you format first, the column sorts lexicographically on `"68.4%"` strings — broken.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable column headers | Custom `useState` + click handler + sorted-data recomputation | TanStack Table `getSortedRowModel()` + `table.getToggleSortingHandler()` | Handles multi-column sort state, tri-state cycle (asc/desc/none), numeric vs string coercion. Hand-rolled loses tri-state and type coercion. |
| Row virtualization | Calculate scroll offset manually + slice rows | `@tanstack/react-virtual` `useVirtualizer` | Handles scroll events, resize observer, overscan, dynamic heights. Hand-rolled won't correctly measure the scroll container on tab focus. |
| Case-insensitive text filter across columns | Custom `.filter(sale => sale.title.toLowerCase().includes(...) \|\| sale.sale_number.toLowerCase().includes(...))` | TanStack Table `globalFilterFn: 'includesString'` | Built-in is case-insensitive, searches all columns, integrates with the row model (so `table.getFilteredRowModel().rows.length` gives the count readout). Hand-rolled fragments filter state across components. |
| Number / currency / date formatting | Manual `.toFixed(2)` + string concatenation (`"$" + value.toLocaleString()`) | `Intl.NumberFormat` / `Intl.DateTimeFormat` in `src/lib/format.ts` | `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` handles grouping, decimal rules, locale. UI-SPEC locks the implementation calls. |
| Debounced input state | `setTimeout` + `clearTimeout` + effect cleanup | React 19 `useDeferredValue` | Built-in, zero-overhead, automatically time-scales with device. |
| Query caching / retry | Manual `useEffect` + state flags | TanStack Query `useQuery` | Already provided by Phase 1 `QueryClientProvider`. |
| Query invalidation on Reload button | Rebuild fetch function | `queryClient.invalidateQueries({ queryKey: ['sale', saleNumber] })` | One line; built-in. |
| 404 page | Separate route + server-side check | Client-side `status: 'not_found'` marker returned by `useSale` | Supabase `.maybeSingle()` returns `null` for missing row; turn that into a discriminated union and branch in the page component. |
| Nav active state | Manual `window.location.pathname` check | React Router v7 `<NavLink>` with render-prop `className` | Built-in, handles subpath matching, a11y-friendly. |

**Key insight:** Every single "custom" capability you might be tempted to write in Phase 3 already exists in the stack that's pinned by CLAUDE.md. The right Phase 3 mindset: **compose**, don't construct.

---

## Common Pitfalls

### Pitfall 1: `useVirtualizer` returns 0 visible items when scroll container height is 0 on first paint

**What goes wrong:** The `max-h-[calc(100dvh-16rem)]` scroll container renders its initial height inside the flex/grid layout. If the virtualizer runs during the first render pass before the scroll container has layout, `getScrollElement()` returns an element with `clientHeight === 0`, and `getVirtualItems()` returns `[]`. The table appears empty even though data loaded.

**Why it happens:** `useVirtualizer` uses a `ResizeObserver` on the scroll element. The observer fires after first paint, which triggers a re-render with the correct visible items. But if the parent container's own layout depends on a conditional render (skeleton → table transition), the transition frame can leave the table with zero visible rows.

**How to avoid:**
1. Give the scroll container a **fixed or min-height** in the CSS (UI-SPEC's `max-h-[calc(100dvh-16rem)]` + the rounded-lg border + the `tbody` `height: getTotalSize()` already do this once data exists).
2. Gate the table render on `sales.length > 0` so the virtualizer never instantiates with count 0 on an empty array.
3. Use the table skeleton (not the table itself) during `isLoading` — the skeleton component doesn't need the virtualizer.

**Warning signs:** Sales page shows "457 sales imported" subtitle but the table body is blank. Scrolling doesn't populate rows. DevTools shows `<tbody>` with `height: 20108px` (correct total) but zero child `<tr>` elements.

**Reference:** [CITED: github.com/TanStack/virtual/issues/604 — "getVirtualItems returns 0 elements when table rows has one data entry"]

### Pitfall 2: `.throwOnError()` vs manual `if (error)` in Supabase queries

**What goes wrong:** Writing a queryFn like `const { data } = await supabase.from('sales').select('*'); return data;` swallows errors silently. TanStack Query's `isError` stays `false` while `data` is `null`, and UI shows "No sales imported yet" instead of the error state.

**How to avoid:** Either (a) chain `.throwOnError()` on the Supabase builder [CITED: makerkit.dev/blog/saas/supabase-react-query], which causes Supabase to throw on error instead of returning `{ error }`, OR (b) write `const { data, error } = await ...; if (error) throw error;` — the pattern used in `scripts/lib/import-sale.ts` already. We use pattern (b) for consistency with Phase 2 code.

**Warning signs:** Empty state rendering when network is offline. Query `isSuccess === true` but page is blank.

### Pitfall 3: `accessorFn` vs `accessorKey` for derived columns

**What goes wrong:** Phase 3 has `sell_through_pct` on the sales list — it doesn't exist as a column on `sales` (only on `sale_departments`). If you write `{ accessorKey: 'sell_through', cell: ... }` with no matching field on the row, TanStack Table reads `undefined`, and sorts the column lexicographically on `"—"` strings.

**How to avoid:** Use `accessorFn: (row) => row.lots_sold && row.lots_auctioned ? row.lots_sold / row.lots_auctioned : null` with an explicit `id: 'sell_through'`. The accessor returns a number (or null), which TanStack sorts numerically. The `cell` renderer applies `formatPercent`.

**Warning signs:** Clicking the Sell-through column header reorders rows like a dictionary, not numerically.

### Pitfall 4: `ColumnDef<T>` strictness with `null` row values

**What goes wrong:** TypeScript strict mode complains about `info.getValue<number>()` when the accessor can return `null`. `getValue<number>()` narrows to `number`, but the actual value includes `null`.

**How to avoid:** Type the accessor explicitly: `info.getValue<number | null>()`. The formatters in `src/lib/format.ts` accept `number | null` and return the `EMPTY` constant for null.

**Warning signs:** TypeScript build fails in Phase 3 with "Type 'null' is not assignable to type 'number'".

### Pitfall 5: Sticky header z-index collision with DashboardLayout header

**What goes wrong:** `DashboardLayout.tsx` has `<header className="... sticky top-0 ... z-10">`. The Phase 3 table uses `sticky top-0 z-[1]` on its `<thead>`. When the table scrolls within its own container, the dashboard header stays on top — good. But if anyone later introduces an intermediate positioned ancestor, stacking contexts can break.

**How to avoid:** Keep the table's sticky header at `z-[1]` (UI-SPEC). Do NOT raise it to `z-10` or above — that could cover the DashboardLayout header's user menu dropdown. If adding focus rings or hover effects at higher z, scope them to the cell, not the row.

**Warning signs:** Table column headers appear over the user menu dropdown when the menu is open.

### Pitfall 6: TanStack Query's default `retry: 1` swallows transient network errors

**What goes wrong:** Phase 1 `main.tsx` sets `retry: 1` in defaultOptions. A query that fails with a transient 503 retries once and then surfaces the error. For real-user testing this is fine, but for Vitest integration tests that mock `supabase.from(...)` to reject, the retry doubles the test execution time or causes timing-dependent flakes.

**How to avoid:** In tests for the error-state branch of `useSales` / `useSale`, create a test-local `QueryClient` with `defaultOptions: { queries: { retry: false } }` and wrap the component in a `<QueryClientProvider client={testClient}>`. This is the standard TanStack Query testing pattern.

**Warning signs:** Tests timeout at 5s with `Unable to find role="alert"`.

### Pitfall 7: React Router `useParams` generic is a hint, not a guarantee

**What goes wrong:** Writing `const { saleNumber } = useParams<{ saleNumber: string }>()` makes the TypeScript type `string | undefined` (because the return type is `Partial<T>`), not `string`. If you pass it to a function typed `(saleNumber: string)`, TS will complain.

**How to avoid:** Defensive narrow: `if (!saleNumber) return <NotFound .../>;`. Route-level guarantees (`/sales/:saleNumber`) don't help TypeScript — the generic is `Partial<T>`. [CITED: reactrouter.com/api/hooks/useParams]

**Warning signs:** "Type 'string | undefined' is not assignable to type 'string'" when passing `saleNumber` to `useSale()`.

### Pitfall 8: The `payment_status` field does NOT contain JSON

**What goes wrong:** The CONTEXT and UI-SPEC both describe `payment_status` as "derived label + compact JSON". The Phase 2 shipped parser (`scripts/lib/parsers/sale-page.ts:155-165`) returns only the enum string (`'paid' | 'partial' | 'unpaid' | null`). If you write `const { counts } = JSON.parse(sale.payment_status)` as the UI-SPEC tooltip suggests, it will throw.

**How to avoid:** Render `payment_status` as the enum string. For the tile `title` tooltip, show the same enum string (there are no counts available in the shipped schema). **Flag this as Open Question #1 for planner review**: decide (a) live with enum-only in Phase 3 and update the UI-SPEC, OR (b) Phase 2 follow-up adds `payment_status_paid_count` / `payment_status_unpaid_count` integer columns and re-runs the importer.

**Warning signs:** `SaleSummaryCard` throws `SyntaxError: Unexpected token p in JSON at position 0` on any sale with `payment_status === 'paid'`.

### Pitfall 9: Zebra striping + hover state collision

**What goes wrong:** UI-SPEC specifies zebra via `[&>tr:nth-child(even)]:bg-gray-50` on tbody, plus `hover:bg-gray-100` on rows. Tailwind applies both — but with virtualization, each `<tr>` has an explicit `transform: translateY(...)`. Browsers render absolute-positioned or transformed children in stacking order; the zebra background lands correctly only if the zebra selector applies to the actual rendered row, not the virtual index.

**How to avoid:** With the fixed-row-height virtualization pattern (no `display: grid` on the table), zebra selectors work normally — the tbody children retain their normal "child of tbody" relationship. Verify via a Vitest snapshot that alternating rows have the even background. If it breaks (it shouldn't), fall back to applying even/odd via `vRow.index % 2 === 0 ? 'bg-gray-50' : ''` on the row element.

**Warning signs:** All rows have the same background, no zebra visible.

### Pitfall 10: `validation_warning` column may not exist on legacy sale rows

**What goes wrong:** The `sales` table has `validation_warning boolean NOT NULL DEFAULT false` per Phase 2 migrations. If Phase 3 reads a sale that was inserted by an older migration path (pre-Phase-2) — won't happen in this project, but worth confirming — the column might be null. Our typed `Database['public']['Tables']['sales']['Row']['validation_warning']` is `boolean` (not nullable).

**How to avoid:** [VERIFIED: `src/db/database.types.ts:410`] — the generated type confirms `validation_warning: boolean` (non-nullable). No defensive coalesce needed. The migration ran before any rows were inserted, so every row has the default value.

**Warning signs:** None expected; documenting for completeness.

---

## Runtime State Inventory

**Not applicable — Phase 3 is a greenfield read-only UI layer. No renames, no data migrations, no OS-registered state.** Section intentionally omitted for Phase 3.

---

## Code Examples

### Example 1: `src/lib/format.ts` — shared formatters (UI-SPEC locked)

```ts
// src/lib/format.ts
// All formatting conventions for Phase 3. Locked by 03-UI-SPEC.md § Typography.

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const countFormatter = new Intl.NumberFormat('en-US');

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const EMPTY = '\u2014'; // em-dash, per UI-SPEC

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return currencyFormatter.format(value);
}

export function formatPercent(ratio: number | null | undefined): string {
  // Accepts a *ratio* (0.684) not a percentage (68.4). Sales list sell-through
  // is computed as lots_sold / lots_auctioned — already a ratio. Dept table
  // sell_through_pct is stored as 0-100 numeric in the schema; divide by 100
  // before calling this, or add a separate formatPercentFromPct if needed.
  if (ratio == null) return EMPTY;
  return percentFormatter.format(ratio);
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return countFormatter.format(value);
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return EMPTY;
  // isoDate is a date-only string like "2022-11-16" from Postgres DATE.
  // Appending T00:00 avoids TZ shift on parse.
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return EMPTY;
  return dateFormatter.format(d);
}

export function formatEstimateRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (low == null && high == null) return EMPTY;
  if (low == null || high == null) return formatCurrency(low ?? high);
  return `${currencyFormatter.format(low)} \u2013 ${currencyFormatter.format(high)}`; // U+2013 en-dash
}
```

**Note on `sell_through_pct` vs computed ratio:** The `sale_departments.sell_through_pct` column is stored as `numeric(5,2)` representing 0–100 (per Phase 2 schema). The sales-list `sell_through` column is computed as `lots_sold / lots_auctioned`, a 0–1 ratio. `formatPercent` above expects a ratio. For the dept table, pre-divide by 100 at the `accessorFn` layer: `accessorFn: (row) => row.sell_through_pct == null ? null : row.sell_through_pct / 100`. Document this inline in `DepartmentTable.tsx`.

### Example 2: Debounced filter input component (FilterInput)

```tsx
// src/components/FilterInput.tsx
import * as React from 'react';

interface FilterInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
}

export function FilterInput({ value, onChange, placeholder, ariaLabel }: FilterInputProps) {
  return (
    <div className="relative w-full max-w-xs">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onChange(''); }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full h-10 px-4 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear filter"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:ring-2 focus:ring-accent rounded outline-none"
        >
          {/* Heroicons x-mark outline */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

```tsx
// Usage in Sales.tsx — parent owns state, component is controlled:
const [filter, setFilter] = React.useState('');
const deferredFilter = React.useDeferredValue(filter);

return (
  <>
    <FilterInput
      value={filter}
      onChange={setFilter}
      placeholder="Search sales…"
      ariaLabel="Filter sales by title or sale number"
    />
    <SalesTable sales={sales} filterText={deferredFilter} />
    {filter && (
      <p aria-live="polite" aria-atomic="true" className="text-sm text-gray-500 mt-1">
        {matchCount} of {sales.length} sales
      </p>
    )}
  </>
);
```

### Example 3: ValidationWarningBanner

Verbatim from UI-SPEC § Validation banner component:

```tsx
// src/components/ValidationWarningBanner.tsx
import { useQueryClient } from '@tanstack/react-query';

interface Props { saleNumber: string; }

export function ValidationWarningBanner({ saleNumber }: Props) {
  const qc = useQueryClient();
  return (
    <div role="alert" className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex items-center gap-3">
      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" /* exclamation-triangle outline heroicon */ ... />
      <p className="text-sm text-amber-900 dark:text-amber-100 flex-1">
        Department totals don't match the sale totals for this sale. Values may be off — spot-check against the source PDF before relying on them.
      </p>
      <button
        type="button"
        onClick={() => qc.invalidateQueries({ queryKey: ['sale', saleNumber] })}
        className="text-sm font-semibold text-amber-900 dark:text-amber-100 underline decoration-amber-600/50 hover:decoration-amber-600 focus:ring-2 focus:ring-accent rounded outline-none"
      >
        Reload sale
      </button>
    </div>
  );
}
```

### Example 4: Sidebar NavLink pattern (extracted from Phase 3 scope)

```tsx
// Conditional className via NavLink render-prop API:
<NavLink
  to="/sales"
  className={({ isActive }) =>
    `flex items-center h-11 ... ${
      isActive
        ? 'text-accent border-l-2 border-accent bg-accent/5'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`
  }
>
  <TableCellsIcon className="w-5 h-5 shrink-0" />
  <span className="hidden lg:inline ml-3">Sales</span>
</NavLink>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` + `setTimeout` for debounce | `React.useDeferredValue` | React 18 (2022) | Simpler, built-in. React 19 completes the ergonomics. |
| `useQuery({ onError })` callback | TanStack Query v5 removed `onError` — check `query.error` after render | v5 launched 2023 | Less implicit behavior; errors handled explicitly at the consumer. Phase 1 is already on v5. |
| `useQuery(['key'], queryFn)` positional args | `useQuery({ queryKey, queryFn })` single-object | v5 launched 2023 | All call sites use object form. |
| TanStack Table `ColumnDefs` with `accessor` string | `ColumnDef` with `accessorKey` or `accessorFn` | v8 (2022) | Phase 3 uses `accessorKey` for direct fields and `accessorFn` for derived. |
| Hand-rolled row virtualization (`react-window`, `react-virtualized`) | `@tanstack/react-virtual` | Growing since 2023 | Same maintainer as Table. React 19 peerDep explicit. |
| React Router v6 `useParams<T>()` with nullable-return warning | v7 with same signature — `Partial<T>` return | v7 released 2024 | No breaking change for this use case. |

**Deprecated / not to use in Phase 3:**
- `onError` / `onSuccess` / `onSettled` options on `useQuery` — removed in TanStack Query v5. [CITED: tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5]
- `useReactTable({ autoResetPageIndex: false })` — not relevant since Phase 3 uses no pagination.
- `react-router-dom` as a separate package — React Router v7 merged DOM and non-DOM into one `react-router` package. Our `package.json` already lists `react-router@^7.13.1`, not `react-router-dom`. [VERIFIED: package.json]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useDeferredValue` scheduling is close enough to "~200ms" for UI-SPEC intent. | Pattern 5 | If the planner or tests require deterministic 200ms, a manual `setTimeout` debounce is a trivial 4-line replacement. Low risk. |
| A2 | The single embedded-resource Supabase query (`sales ... sale_departments (*, department:departments (...))`) works with our RLS policies. | Pattern 3 | [ASSUMED] Phase 1 RLS policies need to allow admin SELECT on `sale_departments` and `departments` as well as `sales`. If not, the embedded query returns `null` for the nested arrays. **Planner should verify Phase 1 RLS covers all three tables before choosing embedded over two-query.** Mitigation: fall back to the two-query sequence in Pattern 3. |
| A3 | Zebra striping via `[&>tr:nth-child(even)]` selector works with absolute-positioned virtualized rows in the fixed-height pattern. | Pitfall 9 | Based on reading the TanStack fixed-height example. If it fails, falling back to explicit even/odd class on the row is 2 lines. Low risk. |
| A4 | Phase 1 RLS policies permit authenticated admin SELECT on `sales`, `sale_departments`, and `departments`. | Pattern 3, Pitfall 2 | [ASSUMED] Not verified in this research session. Phase 1 CONTEXT said "admin-only" RLS. Phase 3 would fail with empty arrays if the RLS scope doesn't cover the child tables. **Planner must verify.** |
| A5 | The 5-minute `staleTime` in CONTEXT does not conflict with any later-phase invalidation strategy. | Locked Decisions | Low risk — TanStack Query per-query staleTime is declarative, no global coupling. |
| A6 | `sale_departments.sell_through_pct` is stored as 0–100 (per Phase 2 schema), not 0–1. | Code Example 1 note | [VERIFIED: `scripts/lib/schemas.ts:47` — `z.number().min(0).max(100)`] |
| A7 | No existing Vitest tests break when we add the new routes under `<ProtectedRoute>`. | Pattern 4 | Existing `src/tests/protected-route.test.tsx` uses `MemoryRouter` with `initialEntries={['/']}` and a test-local `<Route path="/" ...>` tree; it does not depend on `App.tsx`. Low risk. |
| A8 | The `motion-safe:animate-pulse` class in Tailwind v4 still works (not removed). | Pattern — skeletons | [ASSUMED] Widely used; Tailwind v4 is backwards-compatible on modifier `motion-safe`. If the planner finds it missing in v4, `animate-pulse` without the modifier is fine. Low risk. |

---

## Open Questions

### 1. `payment_status` format — documentation drift between UI-SPEC and shipped code

- **What we know:** CONTEXT.md says "derived label + compact JSON per Phase 2 decisions". UI-SPEC §KPI summary card row `Payment status` says "Label only in v1 (e.g. `12 paid, 3 pending, 1 partial`); the JSON counts appear as a `title` tooltip". Phase 2 RESEARCH.md Open Question #2 resolution explicitly says: "Human label derived from counts... Raw counts also captured in a structured JSON text for Phase 3 rendering (stored in the same `payment_status` column as compact JSON)".
- **What the shipped code actually does:** `scripts/lib/parsers/sale-page.ts:155-165` returns just `'paid' | 'partial' | 'unpaid' | null`. No JSON. No counts. The schema (`scripts/lib/schemas.ts:35`) confirms: `z.string().nullable()` with comment "derived from paid vs unpaid invoice counts". The counts exist at parse time but are discarded.
- **What's unclear:** Which is the locked-in behavior for Phase 3 — the UI-SPEC narrative (requires Phase 2 rework) or the shipped schema (enum-only)?
- **Recommendation:**
  - **Option A (cheap):** Render the enum string as the tile value (`"paid"` → `"Paid"`, `"partial"` → `"Partial"`, `"unpaid"` → `"Unpaid"`, null → `EMPTY`). No `title` tooltip with counts since counts aren't stored. Amend the UI-SPEC to reflect this simplification.
  - **Option B (correct):** Add a Phase 2 follow-up migration to store `payment_paid_count`, `payment_unpaid_count` integer columns; re-run the importer. Phase 3 renders label as tile value + counts as `title` tooltip per UI-SPEC.
  - **Default:** Option A. The DATA-01 live import is operator-gated and hasn't run yet; any counts would be zero until that runs anyway. Option B can be added later without breaking Phase 3's rendering code (just add the fields to the component's fallback).
- **Needs user confirmation before planning.**

### 2. RLS policy coverage for `sale_departments` + `departments`

- **What we know:** Phase 1 established admin-only RLS. CONTEXT confirms "RLS admin-only policies enforce access".
- **What's unclear:** Does the RLS scope cover `sale_departments` and `departments` for authenticated admin SELECT, or only `sales`?
- **Recommendation:** Planner should inspect `supabase/migrations/` for the RLS policies on those two tables. If missing, a Phase 3 migration (one `create policy` per table) is needed as a Wave 0 step. Low-risk additive migration.

### 3. Phase 1 RLS + embedded-resource join

- **What we know:** Supabase PostgREST embedded resources apply RLS per-table.
- **What's unclear:** Whether the embedded query `sales ... sale_departments(*, department:departments(*))` correctly returns empty arrays (not errors) when a nested table's RLS rejects.
- **Recommendation:** Planner should add a smoke test at the RPC/HTTP level before deciding. Fall back to two-query pattern if embedded fails.

### 4. `DashboardLayout` responsive collapse — backward-compatibility

- **What we know:** Phase 1 layout uses a static 240px sidebar (`grid-cols-[15rem_1fr]`). Phase 3 UI-SPEC requires 64px icon rail at `md`.
- **What's unclear:** No Phase 1 test asserts the sidebar width; but existing `DashboardLayout` tests (if any) might break when we introduce breakpoint-aware classes.
- **Recommendation:** Search `src/tests/` for any DashboardLayout snapshot or `getByRole('navigation')` assertion. None appears to exist currently (only `protected-route.test.tsx` + `login-page.test.tsx`). Safe to refactor.

### 5. Skeleton shimmer color in dark mode

- **What we know:** UI-SPEC § Loading patterns locks `animate-pulse` on `bg-gray-200 dark:bg-gray-700`.
- **What's unclear:** The `h-4` / `h-3` bar heights feel correct for text rows; but inside a 44px tall virtualized row, only the cell content pulses, not the row itself. Does that feel right?
- **Recommendation:** Implement as-specified; visual tweak in phase-verify if not. Low priority.

---

## Environment Availability

Phase 3 is a pure frontend feature — no new external services, no new runtimes, no new CLIs. All dependencies are npm packages which will be installed via `npm install`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev + test runner | ✓ | Unknown but working (Phase 1/2 ran) | — |
| npm | Package install | ✓ | Working | — |
| Supabase (shared project) | useSales/useSale hooks at runtime | ✓ | Working (Phase 1 connected) | — |

**No missing dependencies, no blockers.** The only open dependency (for RESEARCH purposes) is whether the DATA-01 live import has run before Phase 3 ships — it hasn't, but that's EXPECTED and the empty-state copy is explicitly designed for that case.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 with `projects` split: `src` (jsdom) + `scripts` (node). Phase 3 tests all go to `src` project. |
| Config file | `vite.config.ts` — `test.projects[]` [VERIFIED: read file] |
| Quick run command | `npx vitest --run --project src src/tests/<file>.test.tsx` |
| Full suite command | `npm test` (runs `vitest --run` across all projects) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SALE-01 | Sales list renders 457-row scrollable table | integration | `npx vitest --run --project src src/tests/sales-page.test.tsx` | ❌ Wave 0 |
| SALE-01 | Sales list sorts by `sale_date DESC` by default | unit | `npx vitest --run --project src src/tests/sales-table.test.tsx -t "default sort"` | ❌ Wave 0 |
| SALE-01 | Column header click cycles sort (asc/desc/asc) | unit | `npx vitest --run --project src src/tests/sales-table.test.tsx -t "sort cycle"` | ❌ Wave 0 |
| SALE-01 | Text filter narrows results across title + sale_number | unit | `npx vitest --run --project src src/tests/sales-table.test.tsx -t "filter"` | ❌ Wave 0 |
| SALE-01 | Empty state renders "Run `npm run import:pdfs`" when sales === [] | integration | `npx vitest --run --project src src/tests/sales-page.test.tsx -t "empty state"` | ❌ Wave 0 |
| SALE-01 | Error state renders retry button on query failure | integration | `npx vitest --run --project src src/tests/sales-page.test.tsx -t "error state"` | ❌ Wave 0 |
| SALE-01 | Loading state renders skeleton rows | integration | `npx vitest --run --project src src/tests/sales-page.test.tsx -t "skeleton"` | ❌ Wave 0 |
| SALE-02 | Sale detail renders summary card for known sale | integration | `npx vitest --run --project src src/tests/sale-detail-page.test.tsx -t "summary card"` | ❌ Wave 0 |
| SALE-02 | Unknown sale_number renders 404 (Sale not found) | integration | `npx vitest --run --project src src/tests/sale-detail-page.test.tsx -t "not found"` | ❌ Wave 0 |
| SALE-02 | `validation_warning=true` renders amber banner | integration | `npx vitest --run --project src src/tests/sale-detail-page.test.tsx -t "validation banner"` | ❌ Wave 0 |
| SALE-02 | `validation_warning=false` does NOT render banner | integration | `npx vitest --run --project src src/tests/sale-detail-page.test.tsx -t "no validation banner"` | ❌ Wave 0 |
| SALE-02 | Reload button invalidates `['sale', saleNumber]` query | integration | `npx vitest --run --project src src/tests/sale-detail-page.test.tsx -t "reload"` | ❌ Wave 0 |
| SALE-03 | Dept table renders with departments array | unit | `npx vitest --run --project src src/tests/department-table.test.tsx` | ❌ Wave 0 |
| SALE-03 | Dept table sorts by `revenue DESC` by default | unit | `npx vitest --run --project src src/tests/department-table.test.tsx -t "default sort"` | ❌ Wave 0 |
| SALE-03 | Dept table footer row shows totals | unit | `npx vitest --run --project src src/tests/department-table.test.tsx -t "footer totals"` | ❌ Wave 0 |
| INTR-02 | Both tables support column sort toggles | unit | (covered by sales-table.test.tsx + department-table.test.tsx) | ❌ Wave 0 |
| INFR-03 | Desktop-first layout with `md` sidebar icon-rail collapse | unit | `npx vitest --run --project src src/tests/dashboard-layout.test.tsx -t "icon rail"` | ❌ Wave 0 (manual visual preferred; see note) |
| — | `formatCurrency`/`formatPercent`/`formatCount`/`formatDate`/`formatEstimateRange` | unit | `npx vitest --run --project src src/tests/format.test.ts` | ❌ Wave 0 |

**Manual-only note:** The `INFR-03` responsive test is partially manual — the actual visual collapse at `md` is best validated by a browser resize. Automated test limits to asserting the classname `lg:w-60` on the sidebar. Full visual regression is out of scope for Phase 3.

### Sampling Rate

- **Per task commit:** `npx vitest --run --project src src/tests/<relevant-file>.test.tsx` (< 5s)
- **Per wave merge:** `npx vitest --run --project src` (< 15s for all src tests)
- **Phase gate:** `npm test` — full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/tests/format.test.ts` — covers format helper unit tests (before any component uses them)
- [ ] `src/tests/sales-table.test.tsx` — covers SALE-01 sort/filter
- [ ] `src/tests/department-table.test.tsx` — covers SALE-03 sort + footer totals
- [ ] `src/tests/sales-page.test.tsx` — covers SALE-01 loading / error / empty / happy path
- [ ] `src/tests/sale-detail-page.test.tsx` — covers SALE-02 404 / validation_warning / summary / reload
- [ ] `src/tests/dashboard-layout.test.tsx` — covers Sales NavLink active + sidebar icon-rail classnames
- [ ] Test helper: mock TanStack Query wrapper with `retry: false` (inline in each test file, or shared in `src/tests/test-utils.tsx`)
- [ ] Mock helper for `supabase.from(...).select(...)` chain — extend the existing pattern in `login-page.test.tsx` / `protected-route.test.tsx`

No framework install needed — Vitest + RTL are Phase 1 infra and already working.

---

## Security Domain

Phase 3 is **read-only** and sits behind the Phase 1 `ProtectedRoute` admin gate. No new security surface is introduced.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (inherited from Phase 1) | Supabase auth, admin-only RLS |
| V3 Session Management | no (inherited from Phase 1) | Supabase session cookies |
| V4 Access Control | yes | Admin-only RLS on `sales`, `sale_departments`, `departments` — **see Open Question #2, planner must verify policy exists on all 3 tables** |
| V5 Input Validation | yes | Supabase `.eq('sale_number', saleNumber)` is parameterized; no string concat. React escapes all text by default. `validation_warning` banner body is a literal string (no user-supplied content). |
| V6 Cryptography | no (no crypto in Phase 3) | — |
| V7 Errors & Logging | yes | Error states render `role="alert"` without leaking stack traces or raw Postgres error messages (use a canned "Couldn't load sales" heading per UI-SPEC). |

### Known Threat Patterns for {React + Supabase read-path}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|--------------------|
| URL parameter injection via `:saleNumber` | Tampering | `useParams()` returns a string; pass directly to `.eq('sale_number', saleNumber)` — PostgREST parameterizes. No SQL concat anywhere. |
| XSS via `sale.title` or `payment_status` | Tampering | React escapes all text children by default; we never use `dangerouslySetInnerHTML`. Titles in the PDF source are operator-authored; no external user input reaches the DB. |
| Auth bypass via direct URL `/sales` | Elevation of Privilege | Route is inside `<ProtectedRoute>` which redirects unauthenticated users to `/login` and non-admin authenticated users to AccessDenied. Phase 1 handles this. |
| Over-fetch via SELECT * | Information Disclosure | The `sales` table contains no PII beyond `title` (public sale titles per RFC). Admin-only RLS gates all access. No concern. |
| Broken access check on nested resources | Elevation of Privilege | **Open Question #2** — RLS policies on `sale_departments` and `departments` must also be admin-only. Planner must verify. |

### Payment / PII Handling

- **Monetary columns** are display-only (read from DB, formatted with Intl.NumberFormat). No client-side aggregation, no rounding, no rewriting. INFR-04 (already satisfied at Phase 1 schema level) continues to hold.
- **No PII** — no names, no emails, no addresses in the sales / sale_departments / departments tables. The `payment_status` field contains aggregated counts, not individual payer data.

---

## Sources

### Primary (HIGH confidence)

- **TanStack Table v8 virtualized-rows example** — `https://github.com/TanStack/table/blob/main/examples/react/virtualized-rows/src/main.tsx` [VERIFIED: raw source fetched, full content captured for Pattern 1]
- **TanStack Virtual table example** — `https://github.com/TanStack/virtual/blob/main/examples/react/table/src/main.tsx` [VERIFIED: raw source fetched, fixed-row-height pattern adopted]
- **TanStack Virtual API docs** — `https://tanstack.com/virtual/v3/docs/api/virtualizer` [VERIFIED: useVirtualizer signature and options]
- **React Router v7 useParams** — `https://reactrouter.com/api/hooks/useParams` [VERIFIED: generic signature, `Partial<T>` return]
- **npm registry** — versions verified 2026-04-21:
  - `npm view @tanstack/react-table version` → 8.21.3 (modified 2026-04-18T02:45:58Z)
  - `npm view @tanstack/react-virtual version` → 3.13.24 (modified 2026-04-17T11:51:34Z)
  - `npm view @heroicons/react version` → 2.2.0
- **Local repo files** (read directly):
  - `CLAUDE.md` — stack pins
  - `.planning/REQUIREMENTS.md` — SALE-01..03, INFR-03, INTR-02 definitions
  - `.planning/STATE.md` — Phase 2 status; DATA-01 live run deferred
  - `.planning/phases/03-sale-views/03-CONTEXT.md` — user decisions
  - `.planning/phases/03-sale-views/03-UI-SPEC.md` — approved design contract
  - `src/db/database.types.ts` — generated Supabase types (confirms schema)
  - `src/App.tsx`, `src/main.tsx`, `src/layouts/DashboardLayout.tsx`, `src/lib/supabase.ts`, `src/stores/authStore.ts`, `src/components/ProtectedRoute.tsx`, `src/components/AccessDenied.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Login.tsx`, `src/tests/setup.ts`, `src/tests/protected-route.test.tsx`, `src/tests/login-page.test.tsx`, `vite.config.ts`, `package.json`, `.planning/config.json`
  - `scripts/lib/parsers/sale-page.ts` — `derivePaymentStatus` confirms bare enum shipping behavior
  - `scripts/lib/schemas.ts` — confirms `payment_status: z.string().nullable()` with no structured sub-fields

### Secondary (MEDIUM confidence)

- **TanStack Query + Supabase integration** — [CITED: makerkit.dev/blog/saas/supabase-react-query, last updated January 2026 per article metadata] — `.throwOnError()` pattern cross-verified against TanStack Query v5 docs.
- **TanStack Table global filter** — `https://tanstack.com/table/v8/docs/guide/global-filtering` [CITED: verified via WebFetch; `globalFilterFn: 'includesString'` is the built-in case-insensitive filter]
- **TanStack Table column filtering guide** — `https://tanstack.com/table/v8/docs/guide/column-filtering` [CITED: search results]

### Tertiary (LOW confidence — not used for authoritative claims)

- Community blog posts on TanStack Virtual + Table patterns [CITED: dev.to/ainayeem, mashuktamim.medium.com — only referenced for cross-checking; primary source is the official example code]

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — all versions verified against npm registry on research date; peer-dep compatibility confirmed
- **Architecture:** HIGH — patterns sourced from official TanStack examples (raw source retrieved, not summarized)
- **Pitfalls:** HIGH for pitfalls 1–7 (documented in upstream sources); HIGH for pitfall 8 (verified against shipped code); HIGH for pitfall 10 (verified against generated types)
- **Responsive icon-rail pattern:** MEDIUM — the pattern is straightforward Tailwind but no existing reference in the repo; first time we're collapsing the sidebar
- **RLS coverage for embedded queries:** LOW — flagged as Open Question #2; planner must verify before locking on the embedded-resource query variant
- **`payment_status` semantics:** HIGH for what the shipped schema does (verified via `derivePaymentStatus` source read); documentation drift between UI-SPEC and code flagged as Open Question #1

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — stack is stable; if @tanstack/react-table or @tanstack/react-virtual release a major version before then, re-verify Pattern 1 code example)
