# Requirements: TPC Dashboard

**Defined:** 2026-04-06
**Core Value:** Give the TPC team a single place to see how their auctions are performing over time — what departments are strong, which sales do well, and what's happening across both the app and extension.

## v1 Requirements

### Data Pipeline

- [ ] **DATA-01**: User can bulk-import all 457 historical auction profile PDFs into structured database records
- [ ] **DATA-02**: Each PDF is parsed into a sale record with all "All Departments" summary metrics (auctioned lots, lots sold, total sold/unsold value, estimates, reserves, payment status, revenue breakdown)
- [ ] **DATA-03**: Each PDF's per-department pages are parsed into department records with department code, name, and all department-level metrics
- [ ] **DATA-04**: Financial values are parsed accurately including ranges ($533,300-880,550), commas, percentages, and parenthetical annotations
- [ ] **DATA-05**: Cross-validation confirms department record sums match the sale-level "All Departments" totals
- [ ] **DATA-06**: Department reference table is seeded with all known department codes and display names
- [ ] **DATA-07**: Duplicate PDFs are detected and skipped (same sale number not imported twice)

### RFC Scraper

- [ ] **SCRP-01**: Scheduled scraper logs into RFC/Invaluable using stored credentials
- [ ] **SCRP-02**: Scraper detects completed sales that are not yet in the database
- [ ] **SCRP-03**: Scraper downloads and parses new auction profiles automatically
- [ ] **SCRP-04**: Scraper runs are logged with timestamps, status, sales found/imported, and errors
- [ ] **SCRP-05**: Scraper failures are visible in the dashboard (scraper_runs table with status)

### Authentication

- [ ] **AUTH-01**: User can log in using existing Supabase credentials from TPC App
- [ ] **AUTH-02**: Admin role sees all data, all activity, all reports
- [ ] **AUTH-03**: Specialist role sees sale data, trends, and own activity only (not other specialists' details)
- [ ] **AUTH-04**: Unauthenticated users cannot access any dashboard data

### Sale Views

- [ ] **SALE-01**: User can browse all imported sales in a searchable, sortable list (by date, sale number, title)
- [ ] **SALE-02**: User can view a sale detail page with the complete auction profile (all metrics from the PDF)
- [ ] **SALE-03**: Sale detail page includes a sortable department breakdown table (columns: department, lots, sold, sell-through %, sold value, estimate range, revenue)
- [ ] **SALE-04**: User can compare 2-4 sales side-by-side with all metrics in columns
- [ ] **SALE-05**: Sale comparison highlights deltas (improvement/decline) with color coding
- [ ] **SALE-06**: User can view a revenue waterfall chart for any sale (hammer -> premium -> commission -> insurance -> lot charges -> referral fees -> net revenue)

### KPI & Landing Page

- [ ] **KPI-01**: Landing page shows KPI scorecards: total revenue, average sell-through rate, total lots sold, total sales count
- [ ] **KPI-02**: KPI scorecards show period-over-period change (arrow up/down with %)
- [ ] **KPI-03**: Landing page shows the most recent sales with key metrics at a glance

### Trend Analysis

- [ ] **TRND-01**: User can view net revenue per sale over time as a line chart with trend line
- [ ] **TRND-02**: User can view sell-through rate per sale over time as a line chart
- [ ] **TRND-03**: User can filter all trend views by date range (presets: YTD, last 12 months, last 2 years, all time, plus custom)
- [ ] **TRND-04**: User can view a department performance heat map (rows = departments, columns = sales, color = sell-through or revenue)
- [ ] **TRND-05**: User can view estimate accuracy over time (% lots above/within/below estimate as stacked area chart)
- [ ] **TRND-06**: User can view bidder participation trends (registered bidders and buyers per sale)

### Department Analysis

- [ ] **DEPT-01**: User can view departments ranked by total revenue, average sell-through, or lots above estimate
- [ ] **DEPT-02**: User can view a multi-line chart of selected departments' revenue over time
- [ ] **DEPT-03**: User can view department share of sale as stacked 100% bar chart (each department's % of total revenue per sale)

### Team Activity

- [ ] **TEAM-01**: User can view TPC App session counts by mode (house visit vs sale) over time
- [ ] **TEAM-02**: User can view items cataloged per day/week
- [ ] **TEAM-03**: Admin can view specialist workload (items per specialist)
- [ ] **TEAM-04**: User can view export volume and frequency
- [ ] **TEAM-05**: User can view TPC AI Cataloger workflow analytics (batch runs, photo uploads, spreadsheet imports, app data imports) when extension v2.0 analytics table is available
- [ ] **TEAM-06**: Dashboard gracefully handles missing analytics_events table (shows placeholder until extension v2.0 ships)

### Reporting & Export

- [ ] **RPT-01**: User can export any data table as CSV
- [ ] **RPT-02**: User can generate a formatted PDF sale summary report for any individual sale
- [ ] **RPT-03**: User can generate a quarterly review PDF (all sales in a quarter with totals, averages, trends)
- [ ] **RPT-04**: User can generate a department performance PDF report
- [ ] **RPT-05**: User can save report configurations (date range, departments, metrics) for quick re-run
- [ ] **RPT-06**: Saved reports are per-user (each team member has their own)

### Custom Charts

- [ ] **CHRT-01**: User can create a custom chart by selecting metrics (revenue, sell-through, lots, etc.), departments, and date range
- [ ] **CHRT-02**: User can choose chart type (bar, line, pie/donut, stacked bar) for custom charts
- [ ] **CHRT-03**: Custom charts can be saved for future access

### Interaction

- [ ] **INTR-01**: Clicking a department in any chart filters all other views on the page to that department (cross-filtering)
- [ ] **INTR-02**: All data tables support column sorting and text/numeric filtering
- [ ] **INTR-03**: Charts display tooltips with exact values on hover

### Infrastructure

- [ ] **INFR-01**: Dashboard is a web application deployed to Vercel
- [ ] **INFR-02**: Dashboard uses Supabase for database, auth, and real-time (shared project with TPC App)
- [ ] **INFR-03**: Desktop-first responsive layout (graceful collapse on tablet, not mobile-optimized)
- [ ] **INFR-04**: All financial aggregations happen in PostgreSQL, not in JavaScript (prevents floating-point precision errors)

## v2 Requirements

### Advanced Analytics

- **ADV-01**: Year-over-year comparison report (current year vs previous year on all key metrics)
- **ADV-02**: Seasonal analysis (which months/quarters historically perform best)
- **ADV-03**: Seller performance trends (which receipts/sellers contribute most revenue over time)

### Notifications

- **NOTF-01**: Alert when scraper fails or has not run in expected timeframe
- **NOTF-02**: Alert when a new sale is auto-imported

## Out of Scope

| Feature | Reason |
|---------|--------|
| Individual lot-level data | Department-level summaries are sufficient; lot-level requires different data source and shifts product to auction management |
| Real-time live auction monitoring | This is a post-sale analytics tool, not a live operations tool |
| AI-powered predictions/forecasting | Insufficient data granularity (457 sales, department-level) for meaningful ML |
| Open-ended query builder | Users will export to CSV for ad-hoc analysis; building a query builder is building a BI tool |
| CRM or accounting integration | Not requested; three defined data sources are sufficient |
| Editing TPC App or Cataloger data | Read-only analytics; edit in source apps |
| Mobile-first design | Desktop analytics tool; responsive but not mobile-optimized |
| Separate user management | Reuse Supabase auth from TPC App |
| Multi-tenant support | Single company (The Potomack Company); no abstraction needed |
| Video or image content | Dashboard displays numbers and charts, not media |

## Traceability

(Updated during roadmap creation)

| Requirement | Phase | Status |
|-------------|-------|--------|
| — | — | — |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 0
- Unmapped: 48

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
