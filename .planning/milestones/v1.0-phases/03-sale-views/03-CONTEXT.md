# Phase 3: Sale Views - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two browsable screens: a sales list (`/sales`) showing all imported sales in a dense sortable+filterable table, and a sale detail page (`/sales/:saleNumber`) showing the full "All Departments" summary plus a sortable department breakdown table. Desktop-first with tablet collapse. Uses TanStack Query for data fetching, TanStack Table for both tables. Works against whatever rows exist in the shared Supabase `sales`/`sale_departments` tables — including the empty-DB case (until Phase 2's live import runs).

Not in scope: editing, comparison views (Phase 6), charts (Phase 5), KPI scorecard (Phase 4), exports (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Sales List Page (SALE-01)
- Dense sortable TanStack Table (not card grid) — 457-row dataset needs efficient scanning
- Columns: `sale_number`, `title`, `sale_date`, `lots_auctioned`, `lots_sold`, `sell_through_%` (computed), `total_sold_value`, `net_revenue`
- Default sort: `sale_date` DESC (newest first)
- Client-side rendering — all 457 rows returned by one query; react-window or TanStack Virtual for smooth scroll
- Debounced text filter (~200ms) across `title` + `sale_number` (case-insensitive, client-side)
- Column sort toggles (asc/desc/unsorted) via TanStack Table built-ins
- Empty state: "No sales imported yet. Run `npm run import:pdfs` — see README." (graceful when Phase 2 live run is deferred)
- Loading skeleton: 10 shimmer rows matching column widths

### Sale Detail Page (SALE-02)
- Route: `/sales/:saleNumber` (human-readable URL; `sale_number` is unique per schema)
- Layout: two stacked sections, both full-width:
  - Summary card at top: title, sale_date, then a 4x3 grid of KPIs covering every "All Departments" metric (lots auctioned/sold/unsold, sell-through %, total sold value, total unsold value, estimate range, reserves, hammer total, buyer premium, commission, insurance, lot charges, referral fees, net revenue, bidders, buyers, payment status)
  - Department breakdown table below
- `validation_warning=true` → amber banner above summary card: "⚠ Dept sums differ from totals — spot-check this sale" with link to reload
- 404 handling: unknown `sale_number` → "Sale not found" page with "Back to sales" link
- Back button: link to `/sales`

### Department Table (SALE-03, INTR-02)
- TanStack Table v8 (headless, Tailwind-styled)
- Columns: Department (code + display_name), Lots Auctioned, Lots Sold, Sell-through %, Sold Value, Estimate Range (low–high), Reserves, Revenue
- Default sort: `revenue` DESC
- Per-column filters in header (text filters on department; numeric filters are range-less v1 — just sort columns)
- Rows are read-only; no selection UI
- Footer row: totals (sum across all dept rows) — purely visual, intentionally NOT asserting equality with sale-level totals (that's what `validation_warning` covers)

### Data Fetching + Responsive
- TanStack Query hooks:
  - `useSales()` — returns `sales[]` sorted by `sale_date DESC`; query key `['sales']`; `staleTime: 5 * 60_000`
  - `useSale(saleNumber)` — returns `{ sale, departments[] }`; query key `['sale', saleNumber]`; `staleTime: 5 * 60_000`
- Both hooks go through `src/lib/supabase.ts` (anon client) — RLS admin-only policies enforce access
- Loading states: skeletons on both pages (not spinners) to prevent layout shift
- Error states: inline error card with retry button
- Responsive breakpoints: `lg:` (1024px+) is the target; `md:` (768-1023) collapses the Phase 1 sidebar to an icon rail; below 768 out of scope (INFR-03 desktop-first)
- Router: integrate Sales + Sale Detail into the Phase 1 `App.tsx` routes table, under the existing `<ProtectedRoute>` gate

### Claude's Discretion
- Exact table cell formatting (currency: `$1,234,567.89` with Intl.NumberFormat; percentages: `42.5%`; dates: `Nov 16, 2022`)
- Whether to extract a shared `DataTable` component vs inline each table
- Skeleton row count and shimmer animation choice
- How to handle the `payment_status` column rendering (it's a derived label + compact JSON per Phase 2 decisions — render the label + tooltip-expand counts on hover OR just show label in v1)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phases 1-2)
- `src/lib/supabase.ts` — Proxy lazy client; use for all Phase 3 queries
- `src/db/database.types.ts` — `Database['public']['Tables']['sales'|'sale_departments'|'departments']` Row types — import directly
- `src/stores/authStore.ts` — auth gate already enforces admin-only; Phase 3 pages live behind ProtectedRoute
- `src/layouts/DashboardLayout.tsx` — sidebar + header; Phase 3 adds `/sales` and `/sales/:saleNumber` links
- `src/components/ProtectedRoute.tsx` — Phase 3 routes nest inside this
- TanStack Query already provided at root (Phase 1 `main.tsx` → QueryClientProvider)

### Established Patterns
- Vite + Tailwind v4 with `@theme` tokens (Phase 1 `src/index.css`)
- React Router v7 `<Route path>` table in `App.tsx`
- Zustand stores for client state (extend `useAuthStore` pattern if Phase 3 needs local UI state, e.g., table filters)
- No shadcn — hand-authored Tailwind components per Phase 1 UI-SPEC
- Tests: Vitest + @testing-library/react with jsdom, mocked supabase client

### Integration Points
- Sidebar link "Sales" (currently "Coming soon" in DashboardLayout) → make it an active `NavLink` to `/sales`
- Adds 2 new routes under `<ProtectedRoute>` in App.tsx
- Updates `useAuthStore`? No — auth state already complete

</code_context>

<specifics>
## Specific Ideas

- `<SalesTable>` component in `src/components/` — receives sales array + loading state
- `<DepartmentTable>` component in `src/components/` — reused on sale detail
- `<SaleSummaryCard>` component in `src/components/` — 4x3 KPI grid
- `<ValidationWarningBanner>` component in `src/components/` — amber alert
- Pages at `src/pages/Sales.tsx` and `src/pages/SaleDetail.tsx`
- Hooks at `src/hooks/useSales.ts` and `src/hooks/useSale.ts`
- Install `@tanstack/react-table` + `@tanstack/react-virtual` deps
- UI-SPEC will be generated by `gsd-ui-phase` — it will cover typography, color tokens, spacing for the new components (extending the Phase 1 design tokens)

</specifics>

<deferred>
## Deferred Ideas

- Client-side CSV export of the sales list (Phase 8)
- Multi-select to compare sales (Phase 6)
- Revenue waterfall chart on sale detail (Phase 6, SALE-06)
- Department-level drill-down page (post-v1)
- URL-persisted filters/sort (nice-to-have, can be added later without schema changes)
- Saved searches / favorites (not in v1)

</deferred>
