# TPC Dashboard — Feature Overview

> High-level overview of what the dashboard includes and what reports/graphs the team can create.

---

## Data Sources

| Source | What It Provides | Status |
|--------|-----------------|--------|
| **RFC Auction Profile PDFs** | Historical sale performance (457+ sales, 2018-present) | Import on setup |
| **RFC Web Scraper** | Automatic capture of new sale profiles as they complete | Built as part of dashboard |
| **TPC App (Supabase)** | Cataloging sessions, items, specialist activity, exports | Live — already in database |
| **TPC AI Cataloger (Supabase)** | Workflow analytics: batch runs, photo uploads, imports | Coming in extension v2.0 |

---

## Dashboard Sections

### 1. Sale Overview (Landing Page)

The first thing you see when you open the dashboard.

- **Latest sales** with key metrics: total sold value, sell-through rate, net revenue
- **Quick stats**: sales this year vs last year, average sell-through rate, total revenue
- **Upcoming/recent sale cards** with at-a-glance performance indicators
- **Payment status**: outstanding invoices and unsettled lots across recent sales

### 2. Sale Deep-Dive

Select any individual sale to see its full profile.

- All metrics from the auction profile PDF in a structured, readable layout
- Department breakdown table with sortable columns
- Revenue waterfall: hammer -> premium -> commission -> insurance -> lot charges -> net
- Estimate accuracy: % within, above, below estimate
- Reserve performance: all lots sold at or above reserve? Any below?
- Payment/settlement status: paid vs unpaid invoices, settled vs unsettled lots

### 3. Trend Analysis

Historical performance across all sales over time.

**Available charts:**

| Chart | What It Shows | Type |
|-------|--------------|------|
| Revenue over time | Net revenue per sale, with trend line | Line chart |
| Sell-through rate | % of lots sold per sale over time | Line chart |
| Total sold value | Hammer totals per sale | Bar chart |
| Lots auctioned vs sold | Side-by-side per sale | Grouped bar chart |
| Estimate accuracy | % above/within/below estimate over time | Stacked area chart |
| Bidder participation | Registered bidders and buyers per sale | Line chart |
| Buyer/seller ratio | Number of buyers vs sellers over time | Dual-axis line |

**Filters:**
- Date range (custom, last year, last 2 years, all time)
- Sale type (if distinguishable from title)
- Minimum lot count threshold

### 4. Department Performance

Compare how different departments perform across sales.

**Available charts:**

| Chart | What It Shows | Type |
|-------|--------------|------|
| Revenue by department | Total sold value per department across all sales | Bar chart (horizontal) |
| Department sell-through | Average sell-through rate by department | Bar chart, ranked |
| Department revenue trend | Selected departments' revenue over time | Multi-line chart |
| Estimate accuracy by dept | % above/within/below per department | Stacked bar chart |
| Department share of sale | What % of each sale's revenue comes from each dept | Stacked bar (100%) |
| Top performers | Departments with highest sell-through and above-estimate rates | Scorecard/table |
| Department comparison | Select 2-4 departments for side-by-side across all metrics | Comparison table |

**Filters:**
- Select specific departments
- Group by category (Asian, Paintings, Furniture, etc.)
- Date range
- Minimum lot threshold (exclude departments with <N lots)

### 5. Sale Comparison

Select 2+ sales for side-by-side comparison.

- **Summary comparison table**: all key metrics in columns
- **Overlay charts**: revenue, sell-through, department breakdown overlaid
- **Delta highlights**: what improved, what declined between compared sales
- **Department heat map**: color-coded performance (green = strong, red = weak) across departments for each sale

### 6. Team Activity

Monitor what's happening in TPC App and Cataloger extension.

**TPC App metrics:**
- Sessions created (by mode: house visit vs sale)
- Items cataloged per day/week
- Specialist workload: items per specialist
- Session lifecycle: active -> submitted -> exported pipeline
- Export volume and frequency

**TPC AI Cataloger metrics (when v2.0 analytics lands):**
- Batch processing runs: items processed, success/error rates
- Photo uploads: groups, photos, success rates
- Spreadsheet imports: row counts, frequency
- TPC App data imports: items imported, modes used
- Per-user activity breakdown

**Activity feed:**
- Timeline of recent actions across both tools
- Filterable by user, action type, date range

### 7. Reports

Generate and export summarized reports.

**Pre-built report templates:**

| Report | Contents | Export |
|--------|----------|--------|
| **Sale Summary** | Single sale performance report with all metrics and department breakdown | PDF, CSV |
| **Quarterly Review** | All sales in a quarter: totals, averages, trends, top departments | PDF |
| **Department Report** | Single department performance across all sales | PDF, CSV |
| **Year-over-Year** | Current year vs previous year on all key metrics | PDF |
| **Team Activity** | Cataloging volume, specialist productivity, app/extension usage | PDF, CSV |
| **Custom** | Pick metrics, date range, departments — build your own | CSV |

**Saved reports:**
- Save any report configuration for quick re-run
- Each team member has their own saved reports

---

## Visualizations Library

The dashboard will support these chart types:

- **Line charts** — trends over time (revenue, sell-through, bidders)
- **Bar charts** — comparisons (departments, sale-to-sale)
- **Stacked bar/area** — composition (department share, estimate accuracy breakdown)
- **Pie/donut** — proportions (revenue by department for a single sale)
- **Heat maps** — department performance grids
- **Scorecards/KPIs** — big numbers with trend indicators
- **Tables** — sortable, filterable data tables with export

---

## Access & Permissions

- Same login as TPC App (Supabase auth)
- **Admin**: Full access to all views, reports, and saved reports
- **Specialist**: Can view sale data and trends; can view their own activity; cannot access other specialists' activity details

---

## Technical Architecture (High Level)

```
                    ┌──────────────┐
                    │   Vercel     │
                    │  (Frontend)  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Supabase   │
                    │  (Shared DB) │
                    └──┬───┬───┬───┘
                       │   │   │
            ┌──────────┘   │   └──────────┐
            ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │  Dashboard │  │  TPC App  │  │ Cataloger │
    │  Tables    │  │  Tables   │  │ Extension │
    │            │  │           │  │ Analytics │
    │ - sales    │  │ - profiles│  │           │
    │ - sale_    │  │ - sessions│  │ - analytics│
    │   depts    │  │ - items   │  │   _events │
    │ - saved_   │  │ - export_ │  │           │
    │   reports  │  │   history │  │           │
    │ - scraper_ │  │ - photos  │  │           │
    │   runs     │  │           │  │           │
    └───────────┘  └───────────┘  └───────────┘

    ┌───────────────────────┐
    │   RFC Scraper         │
    │   (Scheduled job)     │
    │   Vercel Cron or      │
    │   external service    │
    └───────────────────────┘
```

---

## What's NOT Included (v1)

- Individual lot-level data (which specific lot sold for what)
- Live auction monitoring
- Editing TPC App or Cataloger data from the dashboard
- Buyer/seller personal information
- Financial forecasting or AI-powered predictions
- Mobile-optimized layout (responsive but desktop-focused)
