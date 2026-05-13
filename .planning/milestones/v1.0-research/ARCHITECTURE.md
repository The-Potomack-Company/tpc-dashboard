# Architecture Patterns

**Domain:** Analytics dashboard with multiple data sources (auction performance)
**Researched:** 2026-04-06

## Recommended Architecture

The TPC Dashboard is a read-heavy analytics application with four distinct data ingestion paths feeding a shared Supabase PostgreSQL database, fronted by a React SPA on Vercel. The architecture follows a **hub-and-spoke model**: Supabase is the hub, data producers (PDF parser, web scraper, TPC App, Cataloger extension) are spokes, and the React frontend reads from the hub.

```
                         DATA PRODUCERS (Write)
                         =====================

 ┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐
 │  PDF Parser      │   │  RFC Scraper      │   │  TPC App +        │
 │  (One-time bulk  │   │  (Scheduled cron)  │   │  Cataloger Ext    │
 │   + ad-hoc)      │   │                    │   │  (Live writes)    │
 │                  │   │  Puppeteer/        │   │                   │
 │  Node.js CLI     │   │  Playwright        │   │  Already running  │
 │  pdf2json /      │   │  -> parse HTML     │   │  in production    │
 │  pdf-parse       │   │  -> insert to DB   │   │                   │
 └────────┬─────────┘   └────────┬───────────┘   └─────────┬─────────┘
          │                      │                          │
          │  service_role key    │  service_role key        │  anon key + RLS
          ▼                      ▼                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │                        SUPABASE (Hub)                                │
 │                                                                      │
 │  Dashboard-owned tables:        Read-only tables:                    │
 │  ┌──────────────────────┐       ┌────────────────────────────────┐  │
 │  │ sales                │       │ profiles, sessions, items,     │  │
 │  │ sale_departments     │       │ export_history, photos         │  │
 │  │ departments (ref)    │       │ (TPC App)                      │  │
 │  │ scraper_runs         │       │                                │  │
 │  │ saved_reports        │       │ analytics_events               │  │
 │  └──────────────────────┘       │ (Cataloger Extension v2.0)    │  │
 │                                  └────────────────────────────────┘  │
 │  Auth: shared Supabase Auth (admin / specialist roles)              │
 └──────────────────────────────┬───────────────────────────────────────┘
                                │
                                │  anon key + RLS (read-only for most tables)
                                │
                         DATA CONSUMER (Read)
                         ====================

                    ┌───────────────────────────┐
                    │   React SPA on Vercel      │
                    │                             │
                    │   TanStack Query (caching)  │
                    │   Recharts (visualization)  │
                    │   Supabase JS client        │
                    │                             │
                    │   Pages:                    │
                    │   - Sale Overview (landing) │
                    │   - Sale Deep-Dive          │
                    │   - Trend Analysis          │
                    │   - Department Performance  │
                    │   - Sale Comparison          │
                    │   - Team Activity            │
                    │   - Reports                  │
                    └───────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Auth Method |
|-----------|---------------|-------------------|-------------|
| **React SPA** | Render dashboards, charts, reports; handle user interaction | Supabase (reads) | Supabase Auth (anon key + JWT) |
| **PDF Parser** | Bulk-import 457+ historical PDFs into `sales` + `sale_departments` | Supabase (writes) | service_role key |
| **RFC Scraper** | Periodic login + scrape of RFC/Invaluable for new sale profiles | Supabase (writes), RFC website (reads) | service_role key |
| **Supabase** | Data storage, auth, RLS policies, real-time (optional) | All components | N/A (is the hub) |
| **TPC App** | Existing cataloging app; writes sessions/items/photos | Supabase (reads + writes) | Supabase Auth |
| **Cataloger Extension** | Existing Chrome extension; will write analytics_events | Supabase (writes) | Supabase Auth |
| **Report Generator** | PDF/CSV export from dashboard data | Runs client-side or via Vercel API route | Supabase Auth |

### Key Boundary Rules

1. **Dashboard never writes to TPC App or Cataloger tables.** Read-only access enforced by RLS.
2. **PDF Parser and Scraper use service_role key** -- they bypass RLS because they are trusted server-side processes.
3. **Frontend uses anon key + user JWT** -- all access goes through RLS policies.
4. **Report generation happens client-side** (jsPDF, Papa Parse for CSV) or via lightweight Vercel API routes if server-side PDF rendering is needed.

---

## Data Flow

### Flow 1: Historical PDF Import (One-time + ad-hoc)

```
PDF files on disk
    │
    ▼
Node.js CLI script
    │ reads PDF with pdf-parse or pdf2json
    │ extracts structured fields (sale summary + department breakdowns)
    │ validates data (financial figures, percentages)
    ▼
Supabase INSERT
    │ sales row (page 1 "All Departments")
    │ N sale_departments rows (pages 2+)
    │ departments upsert (any new codes)
    ▼
Data available to dashboard
```

**Direction:** Local files -> Parser -> Supabase -> Frontend
**Frequency:** Once for bulk import, then ad-hoc for manual additions
**Trigger:** Manual CLI execution

### Flow 2: RFC Scraper (Scheduled)

```
Scheduled trigger (cron)
    │
    ▼
Scraper process starts
    │ logs scraper_runs row (status: 'running')
    │
    ▼
Login to RFC/Invaluable
    │ Puppeteer or Playwright headless browser
    │ navigate to auction profiles section
    │
    ▼
Detect new completed sales
    │ compare against existing sale_numbers in DB
    │
    ▼
For each new sale:
    │ scrape profile page (HTML) or download PDF
    │ parse into structured data
    │ INSERT into sales + sale_departments
    │
    ▼
Update scraper_runs (status: 'success', counts)
    │
    ▼
Data available to dashboard
```

**Direction:** RFC website -> Scraper -> Supabase -> Frontend
**Frequency:** Daily or weekly (configurable)
**Trigger:** Cron schedule

### Flow 3: Live App/Extension Data (Continuous)

```
TPC App user creates session / catalogs items
Cataloger Extension user runs batch / uploads photos
    │
    ▼
Writes to Supabase tables (profiles, sessions, items, analytics_events, etc.)
    │ (these writes happen independently of dashboard)
    │
    ▼
Dashboard reads these tables via Supabase client
    │ TanStack Query caches results
    │ staleTime configured per query (activity data: shorter; historical: longer)
    ▼
Rendered in Team Activity section
```

**Direction:** App/Extension -> Supabase -> Frontend
**Frequency:** Continuous (as users work)
**Trigger:** User actions in other apps

### Flow 4: Report Generation (On-demand)

```
User configures report in dashboard UI
    │ selects type, date range, departments, metrics
    ▼
Frontend queries Supabase for report data
    │ (same queries as dashboard views, different aggregation)
    ▼
Client-side generation:
    │ PDF: jsPDF + autoTable plugin
    │ CSV: Papa Parse (unparse)
    ▼
Browser download
```

**Direction:** Supabase -> Frontend -> User's browser
**Frequency:** On-demand
**Trigger:** User clicks "Export"

---

## Patterns to Follow

### Pattern 1: Service Layer Abstraction

Organize Supabase queries into a service layer rather than calling the client directly in components. Each data domain gets its own module.

```typescript
// src/services/sales.ts
import { supabase } from '@/lib/supabase'

export async function getSalesSummary(dateRange: DateRange) {
  const { data, error } = await supabase
    .from('sales')
    .select('sale_number, sale_date, title, total_sold_value, sell_through_pct, total_net_revenue')
    .gte('sale_date', dateRange.start)
    .lte('sale_date', dateRange.end)
    .order('sale_date', { ascending: false })

  if (error) throw error
  return data
}

// src/services/departments.ts
export async function getDepartmentPerformance(deptCode: string, dateRange: DateRange) {
  const { data, error } = await supabase
    .from('sale_departments')
    .select('*, sales!inner(sale_date, title)')
    .eq('department_code', deptCode)
    .gte('sales.sale_date', dateRange.start)
    .lte('sales.sale_date', dateRange.end)

  if (error) throw error
  return data
}
```

**When:** Always. Every Supabase query goes through a service function.
**Why:** Testable, reusable, keeps components focused on rendering.

### Pattern 2: TanStack Query with Supabase

Wrap service functions in TanStack Query hooks for caching, background refetching, and loading/error states. Use `.throwOnError()` on Supabase calls so TanStack Query catches errors properly.

```typescript
// src/hooks/useSales.ts
import { useQuery } from '@tanstack/react-query'
import { getSalesSummary } from '@/services/sales'

export function useSalesSummary(dateRange: DateRange) {
  return useQuery({
    queryKey: ['sales', 'summary', dateRange],
    queryFn: () => getSalesSummary(dateRange),
    staleTime: 5 * 60 * 1000, // 5 min -- historical data changes rarely
  })
}
```

**When:** All data fetching in the frontend.
**Why:** Automatic caching prevents redundant requests when navigating between views. staleTime tuned per data type: historical auction data is very stable (long staleTime), team activity is more dynamic (shorter staleTime).

### Pattern 3: Query Key Hierarchy

Establish a consistent query key structure to enable targeted invalidation.

```typescript
// src/lib/queryKeys.ts
export const queryKeys = {
  sales: {
    all: ['sales'] as const,
    summary: (range: DateRange) => ['sales', 'summary', range] as const,
    detail: (id: string) => ['sales', 'detail', id] as const,
    departments: (id: string) => ['sales', 'departments', id] as const,
  },
  departments: {
    all: ['departments'] as const,
    performance: (code: string, range: DateRange) =>
      ['departments', 'performance', code, range] as const,
  },
  activity: {
    app: (range: DateRange) => ['activity', 'app', range] as const,
    extension: (range: DateRange) => ['activity', 'extension', range] as const,
  },
  reports: {
    saved: ['reports', 'saved'] as const,
  },
}
```

**When:** From the start. Retrofitting is painful.
**Why:** Invalidating `queryKeys.sales.all` clears all sales-related caches. Essential when scraper imports new data.

### Pattern 4: Data Transformation at the Query Layer

Transform Supabase response shapes into view-ready data in the query function, not in components.

```typescript
// Service returns raw Supabase shape
// Hook transforms to chart-ready shape
export function useRevenueOverTime(dateRange: DateRange) {
  return useQuery({
    queryKey: queryKeys.sales.summary(dateRange),
    queryFn: () => getSalesSummary(dateRange),
    select: (data) => data.map(sale => ({
      date: sale.sale_date,
      revenue: Number(sale.total_net_revenue),
      sellThrough: Number(sale.sell_through_pct),
      label: `Sale ${sale.sale_number}`,
    })),
  })
}
```

**When:** Whenever the chart/component needs a different shape than the raw database row.
**Why:** The `select` function only reruns when underlying data changes. Components stay clean.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Supabase Calls in Components

**What:** Calling `supabase.from('sales').select(...)` directly inside a React component.
**Why bad:** Duplicate queries across components, no caching, hard to test, loading/error handling scattered everywhere.
**Instead:** Service layer + TanStack Query hooks (Patterns 1-2 above).

### Anti-Pattern 2: Single Monolithic Data Fetch

**What:** Loading all sales + departments + activity data on app load.
**Why bad:** Slow initial load, wasted bandwidth for views the user may never visit. With 457+ sales and 20+ departments per sale, this is thousands of rows.
**Instead:** Fetch per-page/per-view. Use TanStack Query's lazy loading. Paginate where appropriate.

### Anti-Pattern 3: Running Puppeteer in Vercel Serverless Functions

**What:** Putting the RFC scraper inside a Vercel API route or cron handler.
**Why bad:** Vercel serverless functions have strict timeout limits (10s Hobby, 60s Pro). Puppeteer needs headless Chrome which is heavy (~130MB) and slow to cold-start. Login + navigation + multi-page scrape easily exceeds timeouts.
**Instead:** Run the scraper as a separate process -- either a standalone Node.js script on a lightweight VM/container, GitHub Actions on a schedule, or a dedicated serverless platform that supports long-running tasks (Railway, Render, Fly.io). Trigger via cron; write results to Supabase using service_role key.

### Anti-Pattern 4: Storing Computed Aggregates Only

**What:** Only storing pre-computed summaries (e.g., "average sell-through for Q1") without the underlying per-sale data.
**Why bad:** Users will want to slice data in ways you did not anticipate. Pre-aggregation locks you into specific views.
**Instead:** Store granular per-sale and per-department data. Compute aggregates at query time (Supabase handles this fine for hundreds of rows). Use database views or functions for expensive aggregations if needed.

### Anti-Pattern 5: Mixing Write and Read Auth Patterns

**What:** Using service_role key in the frontend, or using anon key for the scraper.
**Why bad:** service_role bypasses all RLS -- exposing it to the frontend is a security disaster. anon key through RLS would block the scraper from writing.
**Instead:** Strict separation: frontend uses anon key + user JWT (reads through RLS), backend processes use service_role key (writes, bypasses RLS).

---

## Component Architecture (Frontend)

```
src/
├── lib/
│   ├── supabase.ts              # Supabase client init
│   └── queryKeys.ts             # Query key factory
│
├── services/                    # Data access layer
│   ├── sales.ts                 # Sales queries
│   ├── departments.ts           # Department queries
│   ├── activity.ts              # TPC App + Extension queries
│   └── reports.ts               # Saved reports CRUD
│
├── hooks/                       # TanStack Query wrappers
│   ├── useSales.ts
│   ├── useDepartments.ts
│   ├── useActivity.ts
│   └── useReports.ts
│
├── components/
│   ├── charts/                  # Recharts wrappers
│   │   ├── RevenueLineChart.tsx
│   │   ├── SellThroughChart.tsx
│   │   ├── DepartmentBarChart.tsx
│   │   └── EstimateAccuracyChart.tsx
│   │
│   ├── tables/                  # Data tables
│   │   ├── SalesTable.tsx
│   │   ├── DepartmentTable.tsx
│   │   └── ActivityTable.tsx
│   │
│   ├── layout/                  # Shell, nav, sidebar
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   │
│   └── ui/                      # Shared UI primitives
│       ├── KPICard.tsx
│       ├── DateRangePicker.tsx
│       ├── FilterBar.tsx
│       └── ExportButton.tsx
│
├── pages/                       # Route-level views
│   ├── SaleOverview.tsx         # Landing page
│   ├── SaleDetail.tsx           # Single sale deep-dive
│   ├── TrendAnalysis.tsx        # Historical trends
│   ├── DepartmentPerformance.tsx
│   ├── SaleComparison.tsx
│   ├── TeamActivity.tsx
│   └── Reports.tsx
│
└── utils/
    ├── formatters.ts            # Currency, percentage, date formatting
    ├── exportPdf.ts             # jsPDF report generation
    └── exportCsv.ts             # CSV generation
```

### Separate Packages (Outside SPA)

```
packages/
├── pdf-parser/                  # Standalone Node.js CLI
│   ├── src/
│   │   ├── parse.ts             # PDF text extraction
│   │   ├── extract.ts           # Structured field extraction
│   │   ├── validate.ts          # Data validation
│   │   └── import.ts            # Supabase insertion
│   └── package.json
│
└── rfc-scraper/                 # Standalone Node.js process
    ├── src/
    │   ├── auth.ts              # RFC login flow
    │   ├── detect.ts            # Find new completed sales
    │   ├── scrape.ts            # Extract profile data
    │   ├── parse.ts             # HTML/PDF -> structured data
    │   └── import.ts            # Supabase insertion
    └── package.json
```

---

## Scalability Considerations

| Concern | Current (457 sales) | At 1,000 sales | At 5,000 sales |
|---------|---------------------|-----------------|-----------------|
| Query performance | No issues; simple SELECT with indexes | No issues; indexes on sale_date and department_code cover all queries | Consider materialized views for cross-sale department aggregations |
| Frontend rendering | All charts render fine | Paginate sales list; chart performance fine (Recharts handles 1K points) | Virtualize long lists; aggregate data server-side before charting |
| PDF import | ~10 min batch run | N/A (one-time) | N/A |
| Scraper frequency | Weekly is fine | Weekly, process new sales only | Same pattern; only new sales scraped |
| Report generation | Client-side PDF works | Client-side for single-sale reports; may need server-side for large aggregates | Server-side report generation via Vercel API route |

At the current scale of hundreds of sales, this is a small dataset. PostgreSQL with proper indexes handles this trivially. No need for data warehousing, OLAP cubes, or pre-aggregation pipelines. Keep it simple.

---

## Suggested Build Order

Based on component dependencies, the system should be built in this order:

### Phase 1: Foundation + Data Pipeline

**Build first because everything depends on having data in the database.**

1. Supabase schema (tables, RLS policies, indexes)
2. PDF parser CLI (bulk import 457 PDFs)
3. Verify data integrity (spot-check parsed values against original PDFs)

**Why first:** Without data, no dashboard view can be built or tested with real content. The PDF parser is a one-time tool but it produces the dataset that every subsequent component depends on.

### Phase 2: Core Frontend + Basic Views

**Build next because it delivers the first usable product.**

1. React app scaffolding (Vite + TypeScript + TanStack Query + Supabase client)
2. Auth integration (shared Supabase auth)
3. Service layer + hooks for sales data
4. Sale Overview (landing page with KPIs)
5. Sale Detail (single sale deep-dive)

**Why second:** With data loaded, the team can immediately start using the dashboard. Sale Overview and Detail are the most-used views and validate the data pipeline end-to-end.

### Phase 3: Analytics Views

**Build after core views are proven.**

1. Trend Analysis (charts over time)
2. Department Performance (cross-sale department comparisons)
3. Sale Comparison (side-by-side)

**Why third:** These are the high-value analytics views but they depend on having the charting infrastructure and data patterns established in Phase 2.

### Phase 4: Team Activity + Reports

**Build later because it reads from external tables and is independently useful.**

1. Team Activity views (TPC App data)
2. Report generation (PDF/CSV export)
3. Saved reports

**Why fourth:** Team Activity reads from TPC App tables that already exist -- no new data pipeline needed. Reports are an output format, not a core view. The Cataloger Extension analytics_events table may not exist yet (depends on extension v2.0 timeline), so this can be partially deferred.

### Phase 5: Scraper Automation

**Build last because it has the most complexity and least urgency.**

1. RFC scraper (Puppeteer/Playwright login + scrape)
2. Scraper scheduling (external cron)
3. Scraper monitoring (scraper_runs dashboard section)

**Why last:** The bulk PDF import covers all historical data. The scraper only matters for future sales, which happen periodically (not daily). This is the highest-complexity component (headless browser, login flows, anti-scraping concerns) and the team can manually import new PDFs in the interim.

---

## Sources

- [Recharts vs Nivo vs Tremor comparison](https://www.kylegill.com/essays/react-chart-libraries) -- charting library analysis
- [TanStack Query + Supabase patterns](https://makerkit.dev/blog/saas/supabase-react-query) -- data fetching architecture
- [Supabase best practices](https://www.leanware.co/insights/supabase-best-practices) -- security, scaling, RLS
- [Vercel cron limitations](https://vercel.com/docs/functions/limitations) -- timeout constraints for scraper
- [PDF parsing libraries for Node.js](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025) -- parser selection
- [Vercel Functions timeout guide](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) -- why scraper should not run on Vercel
- [Supabase services and hooks architecture](https://javascript.plainenglish.io/the-supabase-services-hooks-guide-that-will-transform-your-data-layer-architecture-301b79a8c411) -- service layer patterns
