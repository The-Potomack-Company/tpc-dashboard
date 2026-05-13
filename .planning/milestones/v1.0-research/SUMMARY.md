# Project Research Summary

**Project:** TPC Dashboard
**Domain:** Internal auction analytics dashboard with PDF ingestion, web scraping, and multi-source data visualization
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

The TPC Dashboard is a read-heavy internal analytics tool for The Potomack Company, built to surface post-sale auction performance data — revenue trends, sell-through rates, and department breakdowns — from 457+ historical auction profiles currently locked inside PDFs. The core architecture follows a hub-and-spoke model: Supabase is the data hub, a Node.js PDF parser and a Playwright-based RFC scraper are write-path producers, and a React SPA on Vercel is the read-only consumer. The stack is deliberately aligned with the sibling TPC App (React 19 / TypeScript 5.9 / Vite 7 / Tailwind 4 / Supabase / Zustand / Zod) to minimize context-switching for the shared developer. TanStack Query, Recharts, and TanStack Table are added where the dashboard has needs the TPC App does not.

The recommended build order is driven by a strict data dependency: nothing can be validated or demonstrated until auction data is in the database. Phase 1 must be the PDF parser and Supabase schema. Only after the 457 historical PDFs are parsed and verified can the frontend be built against real data, not fixtures. The scraper automation — the most complex and fragile piece — should come last; manual PDF imports cover new sales in the interim. The most commonly requested analytics views (KPI scorecards, trend charts, department comparisons) fall in the middle phases once the data foundation is solid.

The most dangerous risks are invisible: silent financial value parsing errors that corrupt thousands of records before anyone notices, and floating-point precision loss when JavaScript aggregates PostgreSQL DECIMAL values. Both must be addressed in Phase 1 before any UI work begins. A secondary risk is the shared Supabase database — dashboard migrations must never touch TPC App tables, and the scraper's service role key must never reach the frontend. If these three constraints are handled correctly upfront, the rest of the build follows well-documented patterns.

---

## Key Findings

### Recommended Stack

The stack closely mirrors the TPC App to eliminate context-switching, with four additions specific to dashboard needs. TanStack Query (not in TPC App) handles the dashboard's heavy read workload — caching, background refetching, and per-view loading states that Zustand alone should not own. Recharts provides all needed chart types (line, bar, stacked area, pie) with a React-idiomatic component model simpler than Nivo and less opinionated than Tremor. TanStack Table gives headless, fully Tailwind-styled sortable/filterable tables. The scraper requires Playwright and cannot run inside Vercel serverless functions due to browser binary and timeout constraints — it must run as a separate process (Railway, Fly.io, or local CLI for MVP).

**Core technologies:**
- React 19 + TypeScript 5.9 + Vite 7 + Tailwind 4: exact match with TPC App — no version divergence
- Supabase JS v2: same project as TPC App; shared auth, shared database, separate table ownership
- Zustand v5: client UI state (filters, selected date range, active sale)
- TanStack Query v5: server state, caching, loading/error handling for all data fetching
- Zod v4: validates parsed PDF data before DB insertion — critical for financial accuracy
- Recharts v3.8: line, bar, stacked area, and pie charts; declarative React component API
- TanStack Table v8: headless sortable/filterable tables, styled with Tailwind
- pdf-parse v2.4.5: text extraction from structured auction PDFs (with pdfjs-dist as fallback)
- Playwright v1.59: RFC login and profile scraping (runs outside Vercel functions)
- @react-pdf/renderer v4: PDF report export (Phase 4+)
- papaparse v5.5: CSV export, minimal API
- Vercel: hosting; cron jobs trigger scraper webhook on external service

### Expected Features

The research separates features into three clear tiers. The most important insight: **the dashboard is useless without bulk PDF import**, so that is not optional or deferrable even for MVP. Every other view depends on data being present.

**Must have (table stakes):**
- Bulk PDF import and parsing — foundation; without data, nothing else works
- Sale list with search/sort — primary navigation across 457+ sales
- Per-sale summary with department breakdown — core "read a sale" experience replacing PDF reading
- KPI scorecards on landing page — total revenue, sell-through rate, lots sold, period deltas
- Revenue over time and sell-through rate trend charts — the two most critical time series
- Date range filtering (presets + custom) — must apply globally to all charts from day one
- CSV export — escape valve for ad-hoc analysis
- Role-based access control (admin / specialist) — reuses existing Supabase auth; not optional

**Should have (differentiators):**
- Department comparison across sales — answers "which departments consistently perform?"
- Sale comparison (side-by-side) — eliminates mental math for "how did this compare to that?"
- Estimate accuracy analysis — stacked area over time; leading indicator of catalog quality
- Team activity dashboard (reads TPC App sessions/items tables) — operations visibility
- Department performance heat map — color-coded grid; reveals trends invisible in bar charts
- Revenue waterfall chart — visualizes how hammer price becomes net revenue through fees

**Defer (v2+):**
- Automated RFC scraper — high complexity, fragile; manual import works for now
- PDF report generation — high effort; CSV covers 80% of the need
- Extension analytics — blocked on Cataloger Extension v2.0 shipping
- Saved report configurations — convenience, not critical path
- Cross-filtering (click to filter all charts) — architectural investment; add after core views stabilize
- Payment/settlement status tracking — depends on data availability in RFC profiles

**Explicit anti-features (do not build):**
- Individual lot-level data — shifts product from analytics to auction management
- Real-time live auction monitoring — entirely different product with WebSocket infrastructure
- AI predictions/forecasting — insufficient data granularity; would erode trust
- Open-ended ad-hoc query builder — users export to CSV for that
- Mobile-first design — desktop analytics tool; tablet-graceful is enough
- Editing source data from dashboard — read-only by design, always

### Architecture Approach

The architecture is a hub-and-spoke model with Supabase at the center. Three data producers write to Supabase using the service role key (PDF parser, RFC scraper, TPC App / Extension); the React SPA reads using anon key + user JWT through RLS. The dashboard owns exactly five tables (`sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`) and has SELECT-only access to TPC App tables. All Supabase queries go through a typed service layer, wrapped in TanStack Query hooks, with data transformation handled at the query layer — never in components. At the current scale of hundreds of sales, this is a small dataset; no data warehousing or pre-aggregation pipelines are needed.

**Major components:**
1. **Supabase (hub)** — PostgreSQL data store, shared auth, RLS enforcement, five dashboard-owned tables plus SELECT on app tables
2. **PDF Parser (CLI)** — Node.js script; extracts text with pdf-parse, validates with Zod, bulk-inserts 457 historical sales and department rows; runs locally or as a one-time script
3. **RFC Scraper (external process)** — Playwright login + profile detection + HTML/PDF parsing + Supabase insertion; scheduled via Vercel cron triggering an external webhook (Railway/Fly.io); NOT inside Vercel serverless functions
4. **React SPA (Vercel)** — 7 route-level pages; service layer (src/services/) + TanStack Query hooks (src/hooks/) + Recharts chart components + TanStack Table tables; read-only from Supabase
5. **Report Generator** — client-side for CSV (papaparse) and simple PDF (@react-pdf/renderer); Vercel API route for complex multi-page PDF reports in later phases

### Critical Pitfalls

1. **Silent financial value parsing errors** — Naive `parseFloat()` on auction PDF text corrupts thousands of records with no error thrown. Currency ranges ("$533,300-880,550"), comma-separated numbers, and negative values in parentheses all break naive parsers. Prevention: unit-test every format variant before building any UI; cross-validate "All Departments" totals against department row sums; store raw extracted text alongside parsed values for re-parsing.

2. **JavaScript floating-point corruption of financial data** — PostgreSQL DECIMAL arrives in JavaScript as IEEE 754 floats, causing rounding errors ($127,845.10 displays as $127,845.09999999...). Prevention: perform all SUM/AVG aggregations in PostgreSQL, not JavaScript; use `currency.js` or `Decimal.js` for any client-side arithmetic; round only at the display layer with `toFixed(2)`.

3. **Shared Supabase database causing cross-application breakage** — A dashboard migration that accidentally modifies an index or RLS policy can take down TPC App mid-auction. Prevention: dashboard owns only its five tables; never ALTER existing app tables; run all migrations with `supabase db push --dry-run` in staging first; use PostgreSQL GRANT to restrict service role key to dashboard tables only.

4. **RFC scraper breaks silently after site changes** — Scraper fails on a login flow change and the cron job does not alert anyone; new sales stop appearing for weeks. Prevention: monitor `scraper_runs` table; alert if no successful run in X days; save raw HTML/PDF responses before parsing so broken parsers can be fixed without re-scraping; implement graduated retry logic.

5. **Vercel cron timeout kills the scraper** — Vercel serverless has a 60s execution limit on Pro; Playwright login + navigation + multi-page scrape easily exceeds this. Prevention: never run the scraper inside a Vercel function; use cron only as a trigger; run actual scraper on Railway/Fly.io or as a local CLI script for MVP.

---

## Implications for Roadmap

Research strongly implies a five-phase build order driven by data dependencies and component coupling.

### Phase 1: Foundation — Schema, Auth, and PDF Import Pipeline

**Rationale:** Every subsequent phase depends on having real auction data in Supabase. Building any UI before the PDF parser is proven against all 457 PDFs is building on an unverified foundation. Auth and DB schema must also be established before any service layer can be written.

**Delivers:** Supabase schema with all five dashboard tables; RLS policies; anon/service role key separation; PDF parser CLI that can import all 457 historical sales; validated, spot-checked dataset; auth integration with TPC App's existing Supabase project.

**Addresses:** Bulk PDF import (table stakes), role-based access control (table stakes).

**Avoids:** Silent financial parsing errors (Pitfall 1); floating-point corruption in data layer (Pitfall 2); shared database breakage (Pitfall 4); auth token conflicts between three apps (Pitfall 9); no validation layer between parse and insert (Pitfall 11); department code inconsistency (Pitfall 8).

**Research flag:** NEEDS RESEARCH during planning — the specific PDF format of auction profiles determines parsing strategy. Test pdf-parse against 10+ sample PDFs before committing; have pdfjs-dist fallback ready if text extraction is unreliable.

### Phase 2: Core Frontend — Navigation, Sale Views, and KPIs

**Rationale:** With data in the database, deliver the first usable product. Sale Overview and Sale Detail are the highest-frequency views and validate the full data pipeline end-to-end. Date range filtering must be implemented now because retrofitting global filter state later is costly.

**Delivers:** React app scaffolded (Vite + TypeScript + TanStack Query + Supabase client); service layer and hooks for sales/departments; Sale Overview landing page with KPI scorecards; Sale List with search/sort; Sale Detail with department breakdown table; global date range filter; CSV export.

**Uses:** React 19, TanStack Query v5, TanStack Table v8, Zustand v5, papaparse, Supabase JS v2.

**Implements:** Service layer abstraction pattern, TanStack Query hook pattern, query key hierarchy (all three must be established now — retrofitting is painful).

**Avoids:** Direct Supabase calls in components (Anti-Pattern 1); monolithic data fetch on load (Anti-Pattern 2).

**Research flag:** STANDARD PATTERNS — well-documented TanStack Query + Supabase integration. No deeper research needed.

### Phase 3: Analytics Views — Trend Charts and Department Comparisons

**Rationale:** These are the high-value views that justify building a dashboard instead of reading PDFs. They require the charting infrastructure and data patterns established in Phase 2. Department comparisons need cross-sale queries that should be designed as PostgreSQL views to avoid chart performance issues.

**Delivers:** Trend Analysis page (revenue + sell-through over time, with trend lines); Department Performance page (cross-sale comparisons, sortable bar charts); Sale Comparison page (side-by-side selected sales); Estimate Accuracy analysis (stacked area chart).

**Uses:** Recharts v3.8 (line, stacked area, bar, waterfall chart types); PostgreSQL aggregation views for department performance.

**Avoids:** Chart performance degradation with full dataset (Pitfall 6) — pre-aggregate in PostgreSQL; disable Recharts animations above 200 data points; limit default time windows.

**Research flag:** STANDARD PATTERNS for Recharts usage. NEEDS VALIDATION for PostgreSQL aggregation view design — define views alongside chart components, not after.

### Phase 4: Team Activity and Report Export

**Rationale:** Team Activity reads from existing TPC App tables — no new data pipeline needed — so it can ship independently. Report generation (PDF/CSV) is an output format, not a core view, and is most useful once the analytics views are proven and stable.

**Delivers:** Team Activity dashboard (sessions, items processed, specialist workload from TPC App tables); Sale Summary PDF report (@react-pdf/renderer); enhanced CSV export; saved report configurations (Phase 4 stretch goal).

**Uses:** @react-pdf/renderer v4, papaparse, dedicated print-layout React components.

**Avoids:** PDF export producing blank charts (Pitfall 7) — build dedicated print-layout components, never screenshot the live dashboard; hex-to-SVG color bug in Puppeteer PDF rendering.

**Research flag:** STANDARD PATTERNS for CSV. NEEDS RESEARCH for @react-pdf/renderer chart rendering — validate PDF output for each chart type during development.

### Phase 5: Scraper Automation

**Rationale:** The bulk PDF import covers all historical data. The scraper only matters for future sales, which arrive periodically. This is the highest-complexity, most fragile component (headless browser, login flows, anti-scraping concerns, deployment constraints) and has the lowest urgency. MVP without it is fully functional.

**Delivers:** RFC scraper (Playwright login + profile detection + parse + Supabase insert); deployment on Railway or Fly.io; Vercel cron trigger via webhook; scraper monitoring section in dashboard (scraper_runs table visibility); Extension analytics section (contingent on Cataloger Extension v2.0 timeline).

**Uses:** Playwright v1.59; external hosting (Railway ~$5-7/month); Vercel Cron Jobs for scheduling.

**Avoids:** Playwright in Vercel serverless functions (Pitfall 5, Anti-Pattern 3); credential hardcoding (Pitfall 10); silent scraper failures (Pitfall 3) — monitoring and alerting built in from the start.

**Research flag:** NEEDS RESEARCH during planning — RFC/Invaluable site structure, login flow specifics, and session management requirements. Test against the actual site early. This phase has the most unknowns.

### Phase Ordering Rationale

- **Data before UI:** Phase 1 is non-negotiable. No dashboard view can be built or meaningfully tested without real data. The PDF parser is a prerequisite for everything.
- **Validation before features:** PDF parsing errors are silent and catastrophic. Verifying the dataset (spot-checks, checksum validation) must complete before Phase 2 begins.
- **Service layer before views:** The TanStack Query service layer and query key hierarchy established in Phase 2 must be architecturally correct from the start — both research files flag that retrofitting these patterns is expensive.
- **Charts after infrastructure:** Phase 3 analytics views require charting patterns, data transformation hooks, and PostgreSQL aggregation views. These cannot be designed in isolation from Phase 2's data layer.
- **Scraper last:** Phase 5 has the most complexity, the most fragility, and the least urgency. Manual PDF import is a viable interim strategy. Delaying the scraper keeps the critical path short.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 1 (PDF Parser):** Auction PDF format must be tested against real samples before committing to pdf-parse. Coordinate-based extraction (pdfjs-dist) may be needed if plain text extraction mangles tables. Research needed: test pdf-parse against 10+ sample files from the 457-PDF corpus.
- **Phase 5 (RFC Scraper):** RFC/Invaluable login flow, session management, and page structure are unknowns until the site is tested. CAPTCHA or MFA requirements could invalidate Playwright as the tool. Research needed: manual recon of RFC authentication and profile page structure.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Core Frontend):** TanStack Query + Supabase is a well-documented, widely-used pattern with clear examples. Stack alignment with TPC App removes all technology unknowns.
- **Phase 3 (Analytics Views):** Recharts with standard chart types is thoroughly documented. The main design decision (PostgreSQL aggregation views) can be validated during implementation.
- **Phase 4 (Reports):** CSV export with papaparse is trivial. @react-pdf/renderer has a clear API; the risk is testing chart rendering in PDF output, which is a validation task, not a research task.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Directly anchored to TPC App's verified package.json. All additions (TanStack Query, Recharts, TanStack Table, Playwright) sourced from current npm releases and official docs. |
| Features | HIGH | Auction analytics domain is well-documented; KPI expectations cross-referenced across multiple auction industry sources. Anti-features are clearly scoped by explicit product constraints. |
| Architecture | HIGH | Hub-and-spoke + service layer + TanStack Query pattern is a well-established combination with multiple implementation guides. Build order is logically derived from component dependencies. |
| Pitfalls | HIGH | Financial precision and PDF parsing pitfalls are grounded in documented JavaScript/PostgreSQL behavior. Scraper reliability and Vercel timeout constraints verified against official Vercel docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **RFC/Invaluable site structure:** Login flow, session handling, and profile page format are entirely unknown until tested against the live site. This is the single biggest unknown in the project and is gating Phase 5. Recommend manual site recon before roadmap for Phase 5 is written.
- **Auction PDF format variance:** Research assumes consistent tabular layout across all 457 PDFs, but this has not been verified at scale. The parser strategy (pdf-parse for plain text vs. pdfjs-dist for coordinate-aware extraction) depends on the actual PDF quality. Validate before Phase 1 planning is locked.
- **Cataloger Extension v2.0 timeline:** The Extension analytics section (Phase 4+) is blocked on `analytics_events` table shipping. Dashboard code should gracefully handle the table not existing yet, but the feature cannot be scoped until the extension release date is known.
- **RFC credential access:** The scraper needs RFC login credentials. If TPC does not have a programmatic-access-friendly RFC account, the scraper approach may need to change entirely.

---

## Sources

### Primary (HIGH confidence)
- TPC App `package.json` (local file, read directly) — exact version numbers for stack alignment
- [Recharts GitHub Releases](https://github.com/recharts/recharts/releases) — v3.8.1 confirmed current, March 2026
- [Playwright npm](https://www.npmjs.com/package/playwright) — v1.59.1 confirmed current, April 2026
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.101.1
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — 100 per project, 60s timeout on Hobby
- [Vercel Function Duration limits](https://vercel.com/docs/functions/configuring-functions/duration) — 60s Hobby, 800s Pro
- [Supabase RLS docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — RLS policy patterns
- [PostgreSQL Numeric Types](https://www.postgresql.org/docs/current/datatype-numeric.html) — DECIMAL precision behavior

### Secondary (MEDIUM confidence)
- [TanStack Query + Supabase patterns (MakerKit)](https://makerkit.dev/blog/saas/supabase-react-query) — service layer and hook patterns
- [Supabase best practices (Leanware)](https://www.leanware.co/insights/supabase-best-practices) — security and scaling
- [Playwright vs Puppeteer 2026 (BrowserStack)](https://www.browserstack.com/guide/playwright-vs-puppeteer) — scraper tool selection
- [React Chart Libraries comparison (Querio, 2026)](https://querio.ai/blogs/charting-library-for-react) — Recharts vs Nivo vs Tremor
- [How to Handle Monetary Values in JavaScript](https://frontstuff.io/how-to-handle-monetary-values-in-javascript) — floating-point precision strategies
- [PDF Parsing Libraries for Node.js (Strapi, 2025)](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025) — parser selection
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse) — v2.4.5 API and limitations

### Tertiary (LOW confidence — validate during implementation)
- [Auction Houses Dashboard in Power BI](https://www.pk-anexcelexpert.com/auction-houses-dashboard-in-power-bi/) — feature expectations for auction analytics
- [Auction KPI Metrics (Financial Models Lab)](https://financialmodelslab.com/blogs/kpi-metrics/online-auction-house) — sell-through rate as primary KPI
- [Generating PDF Reports with Charts Using React and Puppeteer](https://dev.to/carlbarrdahl/generating-pdf-reports-with-charts-using-react-and-puppeteer-4245) — PDF export chart rendering; test against actual stack

---

*Research completed: 2026-04-06*
*Ready for roadmap: yes*
