# Roadmap: TPC Dashboard

## Overview

Transform 457 historical auction profile PDFs into a live analytics dashboard for The Potomack Company. The build follows a strict data-first order: structured data must exist before any views can be built or tested. Foundation and PDF import come first, then sale browsing and KPI views, then progressively richer analytics (trends, departments, team activity), then reporting and custom charts, and finally the automated RFC scraper -- the most complex and least urgent component.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Supabase schema, RLS policies, auth integration, project scaffolding
- [ ] **Phase 2: PDF Import Pipeline** - Bulk-parse all 457 auction profile PDFs into structured database records
- [ ] **Phase 3: Sale Views** - Browse, search, and inspect individual sales with department breakdowns
- [ ] **Phase 4: KPI Landing Page** - Scorecard dashboard with key metrics and recent sales at a glance
- [ ] **Phase 5: Trend Analysis** - Time-series charts for revenue, sell-through, departments, and estimates
- [ ] **Phase 6: Department Analysis & Sale Comparison** - Cross-sale department rankings, comparisons, and cross-filtering
- [ ] **Phase 7: Team Activity** - TPC App and AI Cataloger usage analytics
- [ ] **Phase 8: Reporting & Export** - PDF reports, CSV export, saved report configurations
- [ ] **Phase 9: Custom Charts** - User-created charts with selectable metrics, departments, and chart types
- [ ] **Phase 10: RFC Scraper** - Automated login, detection, download, and import of new auction profiles

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: The application skeleton exists with working authentication and a verified database schema that safely coexists with the TPC App
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can log in to the dashboard using their existing TPC App Supabase credentials
  2. Admin user sees a placeholder dashboard page after login; specialist user sees a restricted version
  3. Unauthenticated users are redirected to login and cannot access any data endpoints
  4. Database schema exists with all dashboard-owned tables (sales, sale_departments, departments, scraper_runs, saved_reports) and does not modify any TPC App tables
  5. All financial aggregation queries use PostgreSQL DECIMAL arithmetic, not JavaScript
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Vite + React 19 + TS + Tailwind v4 + Vitest + ESLint + directory skeleton
- [x] 01-02-PLAN.md — Supabase migrations (5 dashboard tables + RLS + seed), db push, regen types
- [x] 01-03-PLAN.md — Supabase client + authStore + main.tsx composition + Wave 0 tests (client/store/schema)
- [x] 01-04-PLAN.md — Login/ProtectedRoute/AccessDenied/DashboardLayout/routes + Wave 0 UI tests
- [x] 01-05-PLAN.md — README, REQUIREMENTS/STATE updates, manual QA checklist, Vercel deploy
**UI hint**: yes

### Phase 2: PDF Import Pipeline
**Goal**: All 457 historical auction profiles are parsed into structured, validated database records that accurately represent the original PDF data
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. User can run a CLI command that bulk-imports all 457 PDFs, producing 457 sale records and their associated department records
  2. A spot-check of 10+ imported sales confirms all financial values match the source PDFs exactly (including ranges, commas, percentages)
  3. Department record sums match the "All Departments" totals for every imported sale (cross-validation passes)
  4. Re-running the import on the same PDFs skips all duplicates and produces no errors
  5. The departments reference table contains all known department codes (ASN, PNT, SIL, CER, FRN, etc.) with display names
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Migrations (validation_warning + auto_discovered) + import_sale_with_departments RPC + BLOCKING db push + types regen
- [x] 02-02-PLAN.md — Install pdf-parse/tsx/dotenv + scripts/ scaffolding + numeric/sale/dept parsers + Zod schemas + isolated supabase-admin + parse-pdf orchestrator + Wave 0 unit tests
- [x] 02-03-PLAN.md — cross-validate.ts (DATA-05 tolerance) + import-sale.ts (idempotent + auto-discover) + Wave 0 integration tests
- [x] 02-04-PLAN.md — scripts/import-pdfs.ts CLI (argparse + scraper_runs lifecycle + progress + summary + T-05 banner) + integration test
- [x] 02-05-PLAN.md — README + PROJECT.md path correction + STATE.md + manual-QA checkpoint (full 457 run + 10-sale spot-check + re-run idempotency) + REQUIREMENTS/ROADMAP finalization

### Phase 3: Sale Views
**Goal**: Users can browse all imported sales and drill into any individual sale to see its complete auction profile with department breakdown
**Depends on**: Phase 2
**Requirements**: SALE-01, SALE-02, SALE-03, INFR-03, INTR-02
**Success Criteria** (what must be TRUE):
  1. User can view a list of all imported sales, search by title or sale number, and sort by date, sale number, or title
  2. User can click into any sale and see all metrics from the original PDF (lots, sold, sell-through, values, revenue breakdown)
  3. Sale detail page shows a department breakdown table that is sortable by any column
  4. All data tables support column sorting and text/numeric filtering
  5. Layout is desktop-first with graceful collapse on tablet-sized screens
**Plans**: TBD

Plans:
- [x] 03-01: TBD
**UI hint**: yes

### Phase 4: KPI Landing Page
**Goal**: Users see a high-level performance snapshot the moment they open the dashboard
**Depends on**: Phase 3
**Requirements**: KPI-01, KPI-02, KPI-03
**Success Criteria** (what must be TRUE):
  1. Landing page displays KPI scorecards for total revenue, average sell-through rate, total lots sold, and total sales count
  2. Each scorecard shows period-over-period change with directional arrow and percentage
  3. Landing page shows the most recent sales with key metrics visible at a glance
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md — Migration + kpi_summary RPC + db:push + types regen (Wave 1)
- [x] 04-02-PLAN.md — period.ts + formatDelta + kpi-schema (Wave 2)
- [x] 04-03-PLAN.md — useKpiSummary + 6 components + tests (Wave 3)
- [x] 04-04-PLAN.md — Dashboard page composition + integration test (Wave 4)
**UI hint**: yes

### Phase 5: Trend Analysis
**Goal**: Users can visualize how auction performance changes over time across multiple dimensions — net revenue per sale with a rolling-3 trend overlay, sell-through per sale, estimate accuracy bands (below/within/above), bidder participation dual-axis, and a department performance heat map — all filterable via a shared L12M-default DateRangeFilter with presets + custom range and tooltips showing exact values on hover.
**Depends on**: Phase 3
**Requirements**: TRND-01, TRND-02, TRND-03, TRND-04, TRND-05, TRND-06, INTR-03
**Success Criteria** (what must be TRUE):
  1. User can view net revenue per sale over time as a line chart with a visible trend line
  2. User can view sell-through rate over time as a line chart
  3. User can filter all trend views by date range using presets (YTD, last 12 months, last 2 years, all time) or a custom range picker
  4. User can view a department performance heat map (rows = departments, columns = sales, color intensity = sell-through or revenue)
  5. Charts display tooltips with exact values on hover
**Plans**: 7 plans

Plans:
- [x] 05-01-PLAN.md — Install recharts + chart-colors.ts + period.ts Range extension + ChartTooltip + ChartSkeleton + ChartCard primitives (Wave 1)
- [x] 05-02-PLAN.md — DateRangeFilter (5 presets + Custom disclosure) + MetricToggle (Wave 2, parallel with 05-03)
- [x] 05-03-PLAN.md — useSalesInRange + useDepartmentGrid TanStack Query hooks (Wave 2, parallel with 05-02)
- [x] 05-04-PLAN.md — rolling-avg helper + NetRevenueTrendChart (TRND-01) + SellThroughTrendChart (TRND-02) (Wave 3)
- [x] 05-05-PLAN.md — estimate-accuracy helper + EstimateAccuracyChart (TRND-05) + BidderParticipationChart (TRND-06) (Wave 3)
- [x] 05-06-PLAN.md — heat-map-bucket helper + DepartmentHeatMap (TRND-04) (Wave 3)
- [x] 05-07-PLAN.md — Trends page composition + /trends route + DashboardLayout Trends NavLink activation + human-verify checkpoint (Wave 4)
**UI hint**: yes

### Phase 6: Department Analysis & Sale Comparison
**Goal**: Users can compare departments across sales and compare selected sales side-by-side to identify patterns and outliers
**Depends on**: Phase 5
**Requirements**: DEPT-01, DEPT-02, DEPT-03, SALE-04, SALE-05, SALE-06, INTR-01
**Success Criteria** (what must be TRUE):
  1. User can view departments ranked by total revenue, average sell-through, or lots above estimate
  2. User can select multiple departments and see their revenue plotted over time on a multi-line chart
  3. User can view department share of sale as a stacked 100% bar chart
  4. User can compare 2-4 sales side-by-side with all metrics in columns, with color-coded deltas showing improvement or decline
  5. User can view a revenue waterfall chart for any sale showing the path from hammer price to net revenue
**Plans**: 6 plans

Plans:
- [ ] 06-01-PLAN.md — Migrations (3 new RPCs) + BLOCKING db push + types regen + delta/waterfall libs + 4 data hooks (Wave 1)
- [ ] 06-02-PLAN.md — /departments page skeleton: DeptRankingMetricToggle + DepartmentRankingsTable + page-level cross-filter state (Wave 2)
- [ ] 06-03-PLAN.md — DepartmentChipBar + DepartmentRevenueLineChart + DepartmentShareStackedBarChart wired into /departments (Wave 2)
- [ ] 06-04-PLAN.md — SalesTable selection + SaleSelectionFooter + /sales/compare page + ComparisonTable + parseSalesParam (Wave 2)
- [ ] 06-05-PLAN.md — RevenueWaterfallChart + collapsible Revenue Breakdown section on Sale Detail (Wave 2)
- [ ] 06-06-PLAN.md — DashboardLayout Departments NavLink activation + human-verify end-to-end checkpoint (Wave 3)
**UI hint**: yes

### Phase 7: Team Activity
**Goal**: Users can monitor TPC App and AI Cataloger usage to understand team workload and cataloging throughput
**Depends on**: Phase 3
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06
**Success Criteria** (what must be TRUE):
  1. User can view TPC App session counts by mode (house visit vs sale) over time
  2. User can view items cataloged per day or week and export volume/frequency
  3. Admin can view specialist workload breakdown (items per specialist); specialist sees only their own data
  4. Dashboard shows a placeholder section for AI Cataloger analytics if the analytics_events table does not yet exist
  5. When the analytics_events table exists, user can view batch runs, photo uploads, spreadsheet imports, and app data imports
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
**UI hint**: yes

### Phase 8: Reporting & Export
**Goal**: Users can generate and export formatted reports of sale performance, department trends, and team activity
**Depends on**: Phase 6
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06
**Success Criteria** (what must be TRUE):
  1. User can export any data table as a CSV file
  2. User can generate a formatted PDF summary report for any individual sale
  3. User can generate a quarterly review PDF covering all sales in a quarter with totals, averages, and trends
  4. User can save report configurations (date range, departments, metrics) and re-run them later
  5. Saved reports are per-user (each team member sees only their own saved reports)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Custom Charts
**Goal**: Users can create their own visualizations by choosing metrics, departments, date ranges, and chart types
**Depends on**: Phase 5
**Requirements**: CHRT-01, CHRT-02, CHRT-03
**Success Criteria** (what must be TRUE):
  1. User can create a custom chart by selecting metrics (revenue, sell-through, lots, etc.), departments, and date range
  2. User can choose chart type (bar, line, pie/donut, stacked bar) for their custom chart
  3. User can save custom charts and access them later from a saved charts list
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
**UI hint**: yes

### Phase 10: RFC Scraper
**Goal**: New auction profiles are automatically detected, downloaded, and imported without manual intervention
**Depends on**: Phase 2
**Requirements**: SCRP-01, SCRP-02, SCRP-03, SCRP-04, SCRP-05
**Success Criteria** (what must be TRUE):
  1. Scraper logs into RFC using stored credentials on a scheduled basis
  2. Scraper detects completed sales not yet in the database and imports their auction profiles automatically
  3. Each scraper run is logged with timestamp, status, sales found/imported, and any errors
  4. Scraper failures are visible in the dashboard (user can see recent scraper run history and status)
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phases 4, 5, and 7 can run in parallel after Phase 3. Phase 9 can run after Phase 5. Phase 10 can run after Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 0/5 | Planned | - |
| 2. PDF Import Pipeline | 0/5 | Planned | - |
| 3. Sale Views | 0/? | Not started | - |
| 4. KPI Landing Page | 0/? | Not started | - |
| 5. Trend Analysis | 0/7 | Planned | - |
| 6. Department Analysis & Sale Comparison | 0/6 | Planned | - |
| 7. Team Activity | 0/? | Not started | - |
| 8. Reporting & Export | 0/? | Not started | - |
| 9. Custom Charts | 0/? | Not started | - |
| 10. RFC Scraper | 0/? | Not started | - |
