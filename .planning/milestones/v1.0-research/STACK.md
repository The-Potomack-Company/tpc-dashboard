# Technology Stack

**Project:** TPC Dashboard
**Researched:** 2026-04-06

## Design Principle: Match TPC App

The TPC App (sibling project) uses React 19 / TypeScript 5.9 / Vite 7 / Tailwind 4 / Supabase JS v2 / Zustand / Zod / React Router 7. The dashboard MUST align with this stack so the same developer can move between projects without context-switching. Every recommendation below starts from "what does TPC App already use?" and only diverges when the dashboard has a genuinely different need.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^19.2.0 | UI framework | Same as TPC App. React 19 is stable, well-supported. | HIGH |
| TypeScript | ~5.9.3 | Type safety | Same as TPC App. Strict mode for financial data accuracy. | HIGH |
| Vite | ^7.3.1 | Build tool | Same as TPC App. Fast dev server, native ESM, React plugin works well. | HIGH |
| Tailwind CSS | ^4.2.1 | Styling | Same as TPC App. Utility-first, no custom CSS maintenance. v4 is current. | HIGH |
| React Router | ^7.13.1 | Routing | Same as TPC App. File-based routing not needed; dashboard has ~8 views. | HIGH |

### State & Data

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @supabase/supabase-js | ^2.101.1 | Database client | Same Supabase project as TPC App. v2.x is current stable line. | HIGH |
| Zustand | ^5.0.11 | Client state | Same as TPC App. Lightweight, no boilerplate, works with React 19. | HIGH |
| Zod | ^4.3.6 | Schema validation | Same as TPC App. Validates parsed PDF data before DB insertion. Critical for financial accuracy. | HIGH |
| TanStack Query | ^5 (latest) | Server state / caching | TPC App doesn't use this, but the dashboard needs it. Most views are read-heavy queries with filters, date ranges, and aggregations. TanStack Query handles caching, refetching, and loading states — things Zustand alone shouldn't do. | HIGH |

### Charting & Visualization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Recharts | ^3.8.1 | Charts (line, bar, stacked, area, pie) | Best balance of simplicity and capability for React dashboards. Declarative component API matches React patterns. Actively maintained (3.8.1 released March 2026). Supports all chart types needed: line, bar, stacked bar, stacked area, pie/donut. Good TypeScript support. | HIGH |

**Why Recharts over alternatives:**
- **Nivo**: More powerful (SVG + Canvas + HTML rendering), but heavier API surface and steeper learning curve. Overkill for this dashboard's chart needs (mostly standard line/bar/stacked charts). Would choose Nivo if we needed heatmaps with complex interactivity or server-side rendering of charts.
- **Tremor**: High-level dashboard component library built ON TOP of Recharts. Looks great out of the box but locks you into its opinions. If a chart doesn't fit Tremor's abstractions, you drop down to raw Recharts anyway. Just use Recharts directly.
- **Chart.js / react-chartjs-2**: Canvas-based, less React-idiomatic. Recharts' component model is cleaner.

### Data Tables

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TanStack Table | ^8 (latest) | Sortable, filterable data tables | Headless — full control over styling with Tailwind. Built-in sorting, filtering, pagination. Pairs naturally with TanStack Query. Small bundle (5-14KB). The dashboard has multiple data-heavy views (department breakdowns, sale comparisons) that need interactive tables. | HIGH |

### PDF Parsing (Import Pipeline)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| pdf-parse | ^2.4.5 | Extract text from auction profile PDFs | The auction profiles have a consistent, structured format (confirmed across 457 files). We don't need layout analysis or coordinate-based extraction — we need reliable text extraction followed by regex/line parsing. pdf-parse does exactly this with a simple API. Pure TypeScript, cross-platform. | MEDIUM |

**Why pdf-parse over alternatives:**
- **pdfjs-dist (pdf.js)**: Full Mozilla PDF renderer. We don't need rendering, canvas output, or coordinate-level positioning. pdf-parse wraps pdfjs-dist internally but exposes a simpler text-extraction API. Use pdfjs-dist directly only if pdf-parse can't handle edge cases in the auction PDFs.
- **unpdf**: Modern alternative for edge runtimes. Unnecessary here — parsing runs server-side on Vercel functions or as a local script, not at the edge.
- **pdf2json**: Preserves more document structure but more complex API. Not needed given the consistent PDF format.

**Risk mitigation**: Test pdf-parse against 10+ sample PDFs in Phase 1 before committing. If text extraction is garbled or tables are mangled, fall back to pdfjs-dist with coordinate-based parsing.

### Web Scraping (RFC Scraper)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Playwright | ^1.59.1 | Browser automation for RFC login + scraping | Playwright is the modern standard for browser automation. Better than Puppeteer for login-protected sites: built-in auto-wait, proxy support, multi-browser support. Microsoft-backed, actively maintained. Handles the full flow: login to RFC, navigate to auction profiles, detect new sales, download/parse profile pages. | HIGH |

**Why Playwright over alternatives:**
- **Puppeteer**: Chrome-only, requires stealth plugins for anti-bot evasion. Playwright handles login flows and dynamic content better out of the box.
- **Cheerio / HTTP-based scraping**: RFC requires login (session cookies, potentially JS-rendered content). Can't reliably scrape with HTTP requests alone — need a real browser.
- **Crawlee**: Framework built on Playwright/Puppeteer. Adds queue management, retry logic, etc. Overkill for scraping a single site with a known URL pattern.

**Deployment note**: Playwright requires a browser binary. This means the scraper CANNOT run inside a standard Vercel serverless function (60s timeout on Hobby, no browser binary). See Infrastructure section below.

### PDF Report Generation (Export)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @react-pdf/renderer | ^4 (latest) | Generate PDF reports for export | Declarative React component API for building PDF documents. Perfect for structured reports (sale summaries, quarterly reviews) where you control the layout. Flexbox-based positioning. TypeScript support. | MEDIUM |

**Why @react-pdf/renderer over alternatives:**
- **jsPDF**: Imperative API with manual coordinate positioning. Fine for simple one-pagers, painful for the multi-page structured reports this dashboard needs.
- **html2pdf.js / html-to-image**: Screenshots the DOM. Bad for print-quality PDFs, page breaks are unreliable.
- **Server-side PDF (Puppeteer print)**: Could use Playwright to render a page and print-to-PDF, but adds complexity and requires browser binary in the export path.

### CSV Export

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| papaparse | ^5.5.3 | CSV generation and download | De facto standard for CSV in JavaScript. Simple `unparse()` API converts JSON arrays to CSV strings. No React-specific wrapper needed — just generate the string and trigger download via Blob URL. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel | -- | Hosting & deployment | Same as TPC App. Free tier works for dashboard frontend. | HIGH |
| Vercel Cron Jobs | -- | Trigger periodic scraper checks | Up to 100 cron jobs per project (updated Jan 2026). Triggers an API route on a schedule. | HIGH |
| Supabase Edge Functions (or external) | -- | Run Playwright scraper | Vercel serverless functions have a 60s timeout (Hobby) and no browser binary support. The scraper needs Playwright + potentially minutes to run. **Two options below.** | MEDIUM |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | ^4.0.18 | Unit/integration testing | Same as TPC App. Native Vite integration, fast. | HIGH |
| ESLint | ^9.39.1 | Linting | Same as TPC App. Flat config format (v9+). | HIGH |
| Supabase CLI | ^2.81.3 | DB migrations, type generation | Same as TPC App. `supabase gen types` for type-safe queries. | HIGH |

---

## Scraper Deployment Strategy

The scraper is the most architecturally constrained piece. Playwright needs a browser binary and can run for minutes. Options:

### Option A: Supabase Edge Functions + Deno (RECOMMENDED)

Supabase Edge Functions run on Deno with up to 150s execution time on the free plan, 400s on Pro. You can use Deno-compatible HTTP clients to handle the RFC login flow if the site doesn't require full JS rendering. If RFC pages are server-rendered HTML behind a login, this works.

**Limitation**: No Playwright in Edge Functions. You'd use fetch-based scraping with cookie management instead of a headless browser.

### Option B: External Scraper Service

Run Playwright on a small always-on service (Railway, Fly.io, or a simple VPS). Vercel cron triggers the scraper via HTTP webhook. Scraper runs Playwright, parses profiles, writes to Supabase using the service role key.

**Cost**: ~$5-7/month for a small instance on Railway or Fly.io.

### Option C: Local/Manual Script (MVP)

For Phase 1, run the scraper locally as a Node.js script (`npx tsx scripts/scrape.ts`). Automate later. This unblocks all other dashboard work without solving the deployment question upfront.

**Recommendation**: Start with Option C (local script) for MVP. Validate the scraping logic works. Migrate to Option B when ready to automate — it's the most reliable path for Playwright workloads. Vercel cron triggers Option B's webhook endpoint.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Charts | Recharts | Nivo | Steeper API, heavier. Recharts covers all needed chart types with simpler component model. |
| Charts | Recharts | Tremor | Abstraction on top of Recharts. Locks you in. Just use Recharts directly. |
| Charts | Recharts | Chart.js | Canvas-based, less React-idiomatic. Component model is weaker. |
| Tables | TanStack Table | AG Grid | Heavy, enterprise-licensed for advanced features. TanStack Table is free, headless, lightweight. |
| Tables | TanStack Table | MUI DataGrid | Pulls in Material UI dependency. We use Tailwind. |
| PDF parse | pdf-parse | pdfjs-dist | Overkill API for text extraction. pdf-parse wraps it with simpler surface. |
| PDF parse | pdf-parse | unpdf | Edge-runtime focused. We parse server-side, don't need edge compat. |
| Scraping | Playwright | Puppeteer | Chrome-only, needs stealth plugins, Playwright has better DX for login flows. |
| Scraping | Playwright | Cheerio | HTTP-only. Can't handle login-protected JS-rendered pages. |
| PDF export | @react-pdf/renderer | jsPDF | Imperative coordinate-based API. Painful for multi-page structured reports. |
| CSV export | papaparse | csv-stringify | papaparse is more popular, browser-native, simpler API for our use case. |
| State | TanStack Query | SWR | TanStack Query has richer features (mutations, query invalidation, devtools). Better for complex dashboard queries. |
| State | Zustand | Redux Toolkit | Same as TPC App's reasoning — Zustand is simpler, less boilerplate. |
| Hosting | Vercel | Netlify | TPC App is already on Vercel. Same org, same deploy pipeline. |

---

## Installation

```bash
# Scaffold
npm create vite@latest tpc-dashboard -- --template react-ts

# Core dependencies (match TPC App versions where applicable)
npm install react@^19.2.0 react-dom@^19.2.0 react-router@^7.13.1 \
  @supabase/supabase-js@^2.101.1 zustand@^5.0.11 zod@^4.3.6 \
  @tanstack/react-query@^5 recharts@^3.8.1 @tanstack/react-table@^8 \
  @react-pdf/renderer papaparse

# Scraper + PDF parsing (used in scripts/server-side, not in frontend bundle)
npm install -D pdf-parse playwright

# Dev dependencies (match TPC App)
npm install -D typescript@~5.9.3 vite@^7.3.1 @vitejs/plugin-react@^5.1.1 \
  tailwindcss@^4.2.1 @tailwindcss/vite@^4.2.1 \
  eslint@^9.39.1 eslint-plugin-react-hooks@^7.0.1 eslint-plugin-react-refresh \
  vitest@^4.0.18 @testing-library/react @testing-library/jest-dom \
  supabase@^2.81.3 @types/react @types/react-dom @types/papaparse
```

---

## Version Alignment with TPC App

| Package | TPC App Version | Dashboard Version | Notes |
|---------|----------------|-------------------|-------|
| react | ^19.2.0 | ^19.2.0 | Exact match |
| typescript | ~5.9.3 | ~5.9.3 | Exact match |
| vite | ^7.3.1 | ^7.3.1 | Exact match |
| tailwindcss | ^4.2.1 | ^4.2.1 | Exact match |
| @supabase/supabase-js | ^2.99.2 | ^2.101.1 | Dashboard uses latest patch; compatible |
| zustand | ^5.0.11 | ^5.0.11 | Exact match |
| zod | ^4.3.6 | ^4.3.6 | Exact match |
| react-router | ^7.13.1 | ^7.13.1 | Exact match |
| eslint | ^9.39.1 | ^9.39.1 | Exact match |
| vitest | ^4.0.18 | ^4.0.18 | Exact match |

---

## Sources

- TPC App package.json (local file, read directly) — HIGH confidence
- [Recharts GitHub Releases](https://github.com/recharts/recharts/releases) — v3.8.1, March 2026
- [Recharts 3.0 Migration Guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [Playwright npm](https://www.npmjs.com/package/playwright) — v1.59.1, April 2026
- [Playwright vs Puppeteer 2026 (BrowserStack)](https://www.browserstack.com/guide/playwright-vs-puppeteer)
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse) — v2.4.5
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.101.1
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — 100 per project, all plans
- [Vercel Function Duration limits](https://vercel.com/docs/functions/configuring-functions/duration) — 60s Hobby, 800s Pro
- [TanStack Table docs](https://tanstack.com/table/latest)
- [React Chart Libraries comparison (Querio, 2026)](https://querio.ai/blogs/charting-library-for-react)
- [PDF Generation Libraries comparison](https://dmitriiboikov.com/posts/2025/01/pdf-generation-comarison/)
