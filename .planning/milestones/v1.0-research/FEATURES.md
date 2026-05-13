# Feature Landscape

**Domain:** Auction house internal analytics dashboard
**Researched:** 2026-04-06

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **KPI scorecards on landing page** | Every BI dashboard opens with big numbers and trend arrows. Users need instant orientation: "How are we doing?" | Low | Total revenue, sell-through rate, lots sold, sales count. Show period-over-period delta (arrow up/down + %). |
| **Date range filtering** | Universal expectation in any analytics tool. Users think in time windows: "this quarter," "last year," "all time." | Low | Presets (YTD, last 12 months, all time) plus custom range picker. Every chart must respect the global date filter. |
| **Revenue over time line chart** | The single most important trend. If you build a dashboard about auctions and it cannot show revenue trend, it is a spreadsheet with extra steps. | Low | Net revenue per sale, chronological. Add a trend line. |
| **Sell-through rate over time** | Industry-standard auction KPI. The ratio of sold lots to offered lots is how auction houses measure health. | Low | Line chart, same time axis as revenue. |
| **Per-sale summary view** | Users need to drill into any individual sale and see the full picture: lots, revenue, department breakdown, fee structure. This is the "single sale report" equivalent. | Medium | Structured layout of all metrics from the RFC auction profile. Department breakdown table with sortable columns. |
| **Department breakdown within a sale** | Department-level granularity is the stated analysis unit. Users want to see which departments drove a particular sale. | Medium | Table + bar chart. Sortable by revenue, sell-through, lot count. |
| **Department comparison across sales** | "Which departments are consistently strong?" is a question every auction director asks. Without cross-sale department analysis, the dashboard is just a PDF viewer. | Medium | Bar chart ranking departments by average sell-through, total revenue, or lots above estimate. Must allow selecting a time window. |
| **Data export (CSV)** | Users will always need to pull data into Excel for ad-hoc analysis, board reports, or sharing with people who do not have dashboard access. | Low | Export any table or chart data as CSV. Cover sale summaries, department data, and activity logs. |
| **Role-based access control** | With admin and specialist roles already in the TPC App, users expect the dashboard to respect the same permissions. Specialists should not see other specialists' activity. | Low | Reuse existing Supabase auth. Admin sees everything. Specialist sees aggregate data + own activity only. |
| **Sortable, filterable data tables** | Any data-heavy view needs sorting and filtering. Users will look for "show me only sales with sell-through above 70%" or "sort departments by revenue." | Low | Standard table component with column sort, text/numeric filters. |
| **Responsive layout (desktop-first)** | The team works on desktops but will occasionally check on a tablet. Broken layout on smaller screens erodes trust. | Low | Desktop-optimized grid. Graceful collapse on tablet. Not mobile-first. |
| **Sale list / catalog view** | Users need a way to browse all 457+ sales, search by title or date, and navigate to any individual sale. This is the primary navigation pattern. | Low | Paginated or virtual-scrolled list with search and sort. |

## Differentiators

Features that elevate the dashboard beyond "a place to look at numbers." Not expected on day one, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sale comparison (side-by-side)** | Directly answering "How did this sale compare to that one?" without mental math. Overlay charts and delta highlighting make patterns visible that tables hide. | Medium | Select 2-4 sales, show metrics in columns, overlay line charts, highlight improvements/declines in green/red. |
| **Department performance heat map** | A grid where rows are departments and columns are sales (or time periods), color-coded by sell-through or revenue. Instantly reveals which departments are trending up or down. Far more powerful than individual bar charts. | Medium | Color scale from red (weak) to green (strong). Requires decent number of sales to be useful. |
| **Revenue waterfall chart** | Visual breakdown of how hammer price becomes net revenue through premium, commission, insurance, lot charges, and referral fees. Makes the fee structure tangible. | Medium | Waterfall/bridge chart for a single sale. Uncommon in auction tools; usually buried in spreadsheets. |
| **Estimate accuracy analysis** | Tracking what percentage of lots sold above, within, or below estimate over time. This is a leading indicator of catalog quality and pricing discipline. | Medium | Stacked area chart over time. Per-department breakdown. Helps identify departments that consistently over- or under-estimate. |
| **Automated new sale ingestion** | Scraper that detects completed sales on RFC and auto-imports profiles. Eliminates manual PDF downloading and uploading. The dashboard stays current without human intervention. | High | Scheduled job (Vercel cron or external). Needs RFC login, session management, PDF detection, parsing. Fragile to RFC UI changes. |
| **Pre-built report templates (PDF)** | Quarterly review, year-over-year, department report -- formatted PDF exports that can go straight to leadership or board. CSV export is table stakes; polished PDF reports are a differentiator. | High | Requires server-side PDF generation. Template design is labor-intensive. Start with one (Sale Summary PDF) and expand. |
| **Team activity dashboard (TPC App)** | Visibility into cataloging sessions, items processed, specialist workload. Turns the dashboard into an operations tool, not just a financial one. | Medium | Reads existing Supabase tables. Charts: items/day, sessions/week, specialist leaderboard. |
| **Extension analytics (TPC AI Cataloger)** | Batch processing stats, photo upload success rates, workflow event tracking. Shows ROI of the Chrome extension investment. | Medium | Depends on extension v2.0 analytics_events table. Cannot be built until that ships. |
| **Saved report configurations** | Users configure a report (date range, departments, metrics) and save it to re-run later. Eliminates repetitive setup. | Medium | Needs a saved_reports table. Per-user. Simple JSON blob of filter state. |
| **Cross-filtering (click to filter)** | Clicking a department in a bar chart filters all other charts on the page to that department. Standard in Tableau/Power BI but rare in custom dashboards. Significantly improves exploration. | Medium | Requires shared filter state across chart components. Architecture decision -- use a global filter context. |
| **Payment/settlement status tracking** | Outstanding invoices, unsettled lots across recent sales. Turns the dashboard into a collections tool. Actionable, not just informational. | Medium | Data must be in the auction profiles. If RFC profiles include payment data, this is straightforward. |
| **Bidder participation trends** | Registered bidders and buyers per sale over time. Measures audience health and marketing effectiveness. | Low | Simple line chart if the data is in the auction profiles. |

## Anti-Features

Features to explicitly NOT build. These are traps that waste time or create maintenance burden.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Individual lot-level data** | Explicitly out of scope. Would require different data sources, massive storage increase, and lot-level UI that shifts the product from "analytics dashboard" to "auction management system." | Keep granularity at department level. If lot-level questions arise, direct users to RFC directly. |
| **Real-time live auction monitoring** | This is a post-sale analytics tool. Building live monitoring is an entirely different product with WebSocket infrastructure, latency requirements, and RFC integration challenges. | State clearly in the UI that data reflects completed sales only. |
| **AI-powered predictions or forecasting** | Tempting but premature. With 457 sales and department-level (not lot-level) data, there is insufficient granularity for meaningful ML. Predictions would be unreliable and erode trust. | Focus on descriptive analytics (what happened) and trend visualization (what is the direction). Let humans do the forecasting. |
| **Open-ended data exploration / ad-hoc query builder** | Dashboards used for open-ended analysis get dumped to Excel anyway. Building a query builder is building a BI tool from scratch. | Provide well-designed, purpose-built views. Export to CSV for anything not covered. |
| **CRM or accounting integration** | The team has not asked for it, the data sources are RFC + TPC App + Extension. Adding Salesforce/QuickBooks connectors is scope creep that delays the core value. | Keep the dashboard read-only from its three defined data sources. |
| **Mobile-first design** | Explicitly out of scope. This is a desktop analytics tool. Over-investing in mobile layout delays useful features. | Responsive enough to not break on tablet. Nothing more. |
| **Editing source data from the dashboard** | The dashboard is read-only by design. Adding write capabilities to TPC App or Extension data from the dashboard creates data integrity risks and doubles the surface area for bugs. | Read-only. Always. Link out to TPC App if users need to edit. |
| **User management / registration** | Reuse Supabase auth from TPC App. Building separate user management is duplicate work. | Authenticate against existing system. If a user needs access, they get added in TPC App. |
| **Notification / alerting system** | For a small team looking at historical data, email alerts ("sell-through dropped below 60%!") add complexity without proportional value. The team will open the dashboard when they need it. | Skip entirely. If alert needs emerge later, that is a v2+ consideration. |
| **Multi-tenant / multi-auction-house support** | This is for one company: The Potomack Company. Abstracting for multi-tenancy adds architectural overhead with zero current value. | Hard-code for TPC. Single tenant. Single database. |

## Feature Dependencies

```
Sale List/Catalog View --> Per-Sale Summary View (need list to navigate to detail)
Per-Sale Summary View --> Department Breakdown (department data is part of sale detail)
Date Range Filtering --> All trend charts (trends require time filtering)
Bulk PDF Import --> All sale data views (no data = no dashboard)
RFC Scraper --> Automated new sale ingestion (scraper populates ongoing data)
KPI Scorecards --> Revenue + Sell-Through charts (same underlying queries)
Department Comparison --> Department Heat Map (heat map is an advanced view of same data)
Sale Comparison --> Revenue Waterfall (waterfall can appear in comparison view)
TPC App Tables Exist --> Team Activity Dashboard (reads from sessions/items tables)
Extension v2.0 Analytics --> Extension Analytics Dashboard (blocked until v2.0 ships)
Role-Based Access --> Specialist Activity View (must filter by role)
Saved Reports Table --> Saved Report Configurations (needs DB schema)
```

## MVP Recommendation

**Prioritize (Phase 1 -- the dashboard is useless without these):**

1. **Bulk PDF import and parsing** -- without data, nothing else works. This is the foundation.
2. **Sale list with search/sort** -- primary navigation to find any sale.
3. **Per-sale summary with department breakdown** -- the core "read a sale" experience, replacing PDF reading.
4. **KPI scorecards on landing page** -- instant orientation on overall performance.
5. **Revenue and sell-through trend charts** -- the two most important time-series views.
6. **Date range filtering** -- must work from day one on all views.
7. **CSV export** -- safety valve for anything the dashboard does not cover.
8. **Auth with role-based access** -- security from day one.

**Defer to Phase 2:**

- Department comparison across sales (needs the base views working first)
- Sale comparison (side-by-side) -- high value but needs stable chart infrastructure
- Team activity dashboard (TPC App data) -- independent data source, can ship separately
- Estimate accuracy analysis -- requires base trend infrastructure

**Defer to Phase 3+:**

- Automated RFC scraper -- high complexity, fragile. Manual import works for now.
- PDF report generation -- high effort. CSV export covers 80% of the need.
- Extension analytics -- blocked on extension v2.0
- Saved report configurations -- convenience feature, not critical path
- Heat maps, waterfall charts -- advanced visualizations once core charts are stable
- Cross-filtering -- architectural investment, add after core views are proven

## Sources

- [AuctionMethod Reporting and Analytics](https://www.auctionmethod.com/auction-reporting-analytics)
- [Auction Houses Dashboard in Power BI](https://www.pk-anexcelexpert.com/auction-houses-dashboard-in-power-bi/)
- [Invaluable RFC Auction Systems Benefits](https://www.invaluable.com/inv/rfc-auction-systems/benefits/)
- [Basedash Dashboard Software Guide 2026](https://www.basedash.com/blog/dashboard-software-the-complete-guide-for-modern-teams-in-2026)
- [Yellowfin BI Dashboard Guide 2026](https://www.yellowfinbi.com/blog/business-intelligence-dashboard-what-is-it-how-to-use)
- [Tableau Sales Dashboard Examples](https://www.tableau.com/dashboard/sales-dashboard-examples-and-templates)
- [Auction KPI Metrics - Financial Models Lab](https://financialmodelslab.com/blogs/kpi-metrics/online-auction-house)
- [Auction Performance Metrics - FasterCapital](https://fastercapital.com/content/Auction-industry-trends-and-analysis--Data-Driven-Insights--Analyzing-Auction-Performance-Metrics.html)
- [Auction Goal Setting and Tracking](https://fastercapital.com/content/Auction-goal-setting-and-tracking--Measuring-Auction-Success--Metrics-and-Milestones.html)
- [Dashboard Anti-Patterns - Kevin Gee](https://kevingee.biz/?p=144)
- [Metrics Anti-Patterns - Xebia](https://xebia.com/articles/common-anti-patterns-in-defining-metrics-and-how-to-avoid-them/)
