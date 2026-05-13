# Domain Pitfalls

**Domain:** Auction analytics dashboard with PDF parsing, web scraping, and data visualization
**Researched:** 2026-04-06

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or major rework.

### Pitfall 1: Financial Value Parsing Produces Silent Errors

**What goes wrong:** PDF parsing of currency values like "$533,300-880,550" or "$1,234.56" silently drops commas, misreads ranges as single values, or truncates decimals. The parser returns a number without error, but it is wrong. With 457 PDFs and 30+ fields each, a subtle regex bug can corrupt thousands of records before anyone notices.

**Why it happens:** pdf-parse and similar libraries return raw text blobs with no table structure. Financial values with commas, hyphens (ranges), parentheses (negative values), and mixed formatting get mangled by naive `parseFloat()` or regex patterns. The "All Departments" summary page has different spacing than per-department pages. A regex that works on page 1 fails on page 3.

**Consequences:** Every downstream chart, trend, and comparison is wrong. If sell-through rates or revenue numbers are off by even 5%, the dashboard loses all credibility with TPC team. Rebuilding trust after bad data is harder than building it initially.

**Prevention:**
- Parse all 457 PDFs BEFORE building any UI. Validate the parsed output against a manually verified sample of 10-15 PDFs covering different sale sizes, departments, and date ranges.
- Store raw extracted text alongside parsed values in a staging step so you can re-parse without re-extracting.
- Build a dedicated parsing module with unit tests for every known format variant: "$1,234.56", "$533,300-880,550" (ranges into low/high), "(1,234.56)" (negatives), "N/A", blank fields.
- Use a positional/layout-aware approach (pdf2json or PDF.js with coordinate tracking) rather than plain text extraction, since the PDFs have consistent tabular layout.
- Run checksums: "All Departments" total should equal sum of department breakdowns. Flag mismatches automatically.

**Detection:** Cross-validation failures between summary and department totals. Values that are exactly 1000x too large or small (comma parsing error). Negative values where positives are expected.

**Phase relevance:** Phase 1 (PDF parsing). This must be rock-solid before any visualization work begins.

---

### Pitfall 2: JavaScript Floating-Point Corruption of Financial Data

**What goes wrong:** Parsed DECIMAL(12,2) values from PostgreSQL arrive in JavaScript as IEEE 754 floats. Aggregations accumulate rounding errors. A revenue total of $127,845.10 displays as $127,845.09999999999. Worse: intermediate calculations (sell-through percentages, revenue breakdowns) compound the error.

**Why it happens:** PostgreSQL DECIMAL is exact arithmetic. JavaScript `Number` is 64-bit float. The Supabase JS client returns numeric columns as JavaScript numbers by default, silently losing precision. Summing hundreds of department values amplifies the error.

**Consequences:** Numbers on the dashboard do not match the source PDFs. TPC team loses trust. Rounding errors in percentage calculations cause sell-through rates to exceed 100% or revenue breakdowns that do not sum to the total.

**Prevention:**
- Return financial columns as strings from Supabase (use `.csv()` or cast in query) and convert with a precision-safe library like `currency.js` or `Decimal.js` on the frontend.
- Perform all aggregations in PostgreSQL (SUM, AVG) rather than in JavaScript. The database keeps exact precision; let it do the math.
- Round display values explicitly with `toFixed(2)` at the presentation layer only, never during intermediate calculations.
- Store pre-calculated aggregates (sell-through %, total revenue) in the database rather than computing them client-side.

**Detection:** Dashboard totals that differ by $0.01-$0.10 from source data. Percentage columns that sum to 99.99% or 100.01%. Revenue breakdown components that do not sum to the displayed total.

**Phase relevance:** Phase 1 (data layer) and Phase 2 (visualization). Establish the pattern early.

---

### Pitfall 3: RFC Scraper Breaks Silently After Site Changes

**What goes wrong:** The RFC/Invaluable auction platform changes its login flow, page structure, or session handling. The scraper fails but the cron job does not alert anyone. New sales stop appearing in the dashboard for weeks before someone notices.

**Why it happens:** Web scraping is inherently fragile. Login-protected sites change authentication flows (CAPTCHA additions, MFA requirements, session token rotation). CSS selectors break when the site redesigns. The scraper runs on a schedule with no human watching it.

**Consequences:** Gap in auction data. The dashboard appears to show a decline in sales activity when in reality the scraper is just broken. Decisions made on incomplete data.

**Prevention:**
- Build an alerting system from day one. The `scraper_runs` table already tracks status -- add a monitoring check: "If no successful run in X days, send alert."
- Make the scraper idempotent. If it runs twice for the same sale, it should upsert, not duplicate.
- Save raw HTML/PDF responses before parsing. When parsing breaks, you have the raw data to re-parse after fixing the extractor.
- Use cookie/session persistence (`userDataDir` in Puppeteer) to reduce login frequency and avoid triggering anti-bot defenses.
- Implement graduated retry: network timeout -> retry in 5 min; login failure -> retry in 1 hour with fresh session; structural change -> alert human.
- Test against the actual site regularly (not just mocked HTML).

**Detection:** `scraper_runs` table shows consecutive `failed` or `partial` statuses. Gap in `sales.sale_date` values (missing recent sales). Login step taking longer than expected (site added CAPTCHA).

**Phase relevance:** Phase 2 (scraper). Must include monitoring from initial implementation.

---

### Pitfall 4: Shared Supabase Database Causes Cross-Application Breakage

**What goes wrong:** A schema migration for the dashboard accidentally modifies an index, trigger, or RLS policy that affects TPC App or Cataloger extension tables. Or the dashboard's scraper service role key, if leaked, grants write access to all tables including the app's production data.

**Why it happens:** Three applications share one Supabase project. The service role key bypasses all RLS. Migration scripts can have unintended side effects on shared infrastructure (connection pool exhaustion, lock contention during migrations).

**Consequences:** TPC App goes down during an auction. Cataloger extension loses data. Production incident across multiple products from a dashboard deployment.

**Prevention:**
- Dashboard owns ONLY its tables (`sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`). Never write migrations that ALTER existing TPC App tables.
- Use a dedicated Supabase service role key scoped to dashboard operations. Better: use PostgreSQL GRANT to restrict the dashboard's service role to only its own tables plus SELECT on app tables.
- Run all migrations in a staging environment first. Supabase CLI's `db diff` and `db push --dry-run` catch problems before production.
- RLS policies on dashboard tables are already correct in the schema (authenticated read, service_role write). Verify these with integration tests: "Can an authenticated user write to sales? Expected: no."
- Never store the service role key in frontend code. It goes in Vercel environment variables for server-side routes only.

**Detection:** TPC App error rates spike after a dashboard deployment. Connection pool warnings in Supabase dashboard. Unexpected write operations in audit logs.

**Phase relevance:** Phase 1 (database setup). Establish strict boundaries before any tables are created.

---

## Moderate Pitfalls

### Pitfall 5: Vercel Cron Job Unreliability for Scraping

**What goes wrong:** Vercel cron jobs have imprecise timing (up to 59 minutes late), a 60-second execution limit on Pro plan, and can fire duplicate events. A scraper that needs to log in, navigate pages, and download PDFs will almost certainly exceed 60 seconds.

**Prevention:**
- Do NOT run the actual scraper inside a Vercel cron function. Use the cron to trigger an external job (e.g., a Supabase Edge Function with longer timeout, or an external service like Railway/Render with a proper long-running process).
- Alternative: Use the Vercel cron to enqueue a job, and have a separate worker process the queue. This decouples scheduling from execution.
- Design for idempotency: duplicate cron fires should not create duplicate sales records. The `sale_number UNIQUE` constraint handles this at the database level.
- Use the `scraper_runs` table as a distributed lock: check if a run is already `running` before starting a new one.

**Detection:** Scraper runs that show `failed` with timeout errors. Duplicate entries in `scraper_runs` for the same time window.

**Phase relevance:** Phase 2 (scraper infrastructure). Architecture decision needed early.

---

### Pitfall 6: Chart Performance Degrades with Department Comparisons

**What goes wrong:** Rendering 457 sales x 23 departments as interactive SVG charts causes the browser to lag. Users try to compare departments across all historical sales and the page becomes unresponsive. Tooltip hover on dense line charts triggers expensive re-renders.

**Prevention:**
- Pre-aggregate data in PostgreSQL views or materialized views. The frontend should fetch "revenue by department by quarter" not "all 10,000 sale_departments rows."
- Limit default chart ranges (show last 2 years, not all time). Let users expand if needed.
- Use Recharts with `isAnimationActive={false}` for charts with more than ~200 data points.
- Implement data windowing: load chart data on-demand as users scroll or change filters, not all at once.
- Consider using `useMemo` aggressively for chart data transformations so filter changes do not recompute everything.

**Detection:** Lighthouse performance score drops below 50. Time-to-interactive exceeds 3 seconds on the main dashboard page. Users report "laggy" chart interactions.

**Phase relevance:** Phase 3 (visualization). Design the data aggregation API endpoints alongside charts, not after.

---

### Pitfall 7: PDF Report Export Produces Broken Charts

**What goes wrong:** Exporting the dashboard view to PDF using Puppeteer or a similar tool produces blank chart areas, missing fonts, incorrect colors (hex-to-SVG bug), or charts that render at wrong dimensions. The exported PDF looks nothing like the screen.

**Prevention:**
- Do NOT try to screenshot the live dashboard. Instead, build a dedicated "print layout" React component that renders the same data in a static, print-friendly format.
- Use server-side rendering with `ReactDOMServer.renderToStaticMarkup()` for the report, then pass to Puppeteer's `page.setContent()` + `page.pdf()`.
- Replace hex colors with `rgb()` in SVG elements before PDF generation (known Puppeteer bug with hex in SVG).
- Set explicit width/height on all chart containers in the print layout -- do not rely on CSS flexbox or viewport units.
- Test PDF output on every chart type during development, not as an afterthought.

**Detection:** Blank rectangles where charts should be. Colors differ between screen and PDF. Chart labels are cut off or overlapping.

**Phase relevance:** Phase 4 (reporting). Plan the print layout component when building charts in Phase 3.

---

### Pitfall 8: Department Code Inconsistency Across PDFs and Scraper

**What goes wrong:** Historical PDFs use "ASN" but newer RFC pages use "ASIAN" or "Asian (Fine)" as the department identifier. The `departments` reference table has a fixed set of codes, but real-world data contains variants, typos, or new departments not in the seed data.

**Prevention:**
- Build a department code normalization layer in the parser. Map known variants to canonical codes.
- Log unknown department codes rather than silently dropping them. The `scraper_runs` table should capture "encountered unknown department: XYZ".
- The `departments` table should be treated as a living reference, not a static seed. New departments discovered during parsing get inserted automatically with a flag for human review.
- Include a department mapping configuration file that is easy to update without code changes.

**Detection:** `sale_departments` rows with NULL or unexpected `department_code`. "All Departments" total does not equal sum of known department rows (indicating a department was skipped).

**Phase relevance:** Phase 1 (PDF parsing). Build the normalization layer into the parser from the start.

---

## Minor Pitfalls

### Pitfall 9: Auth Token Confusion Between Three Apps

**What goes wrong:** The dashboard reuses Supabase auth from TPC App, but session tokens from one app interfere with another. A user logged into TPC App visits the dashboard and gets a stale or incompatible session.

**Prevention:**
- Each app should manage its own Supabase client instance. Shared auth does NOT mean shared session storage. The dashboard creates its own `createClient()` with the same project URL but manages its own localStorage/cookie namespace.
- Test the flow: log into TPC App, then open dashboard in another tab. Both should work independently.

**Detection:** Users report being randomly logged out. Auth errors in console mentioning expired or invalid tokens.

**Phase relevance:** Phase 1 (auth setup).

---

### Pitfall 10: Scraper Credentials Hardcoded or Leaked

**What goes wrong:** RFC login credentials for the scraper end up in source code, git history, or client-side bundles. Invaluable/RFC detects automated access and bans the account.

**Prevention:**
- Store RFC credentials in Vercel environment variables only. Never in `.env` files that get committed.
- Add `.env*` to `.gitignore` from day zero.
- The scraper runs server-side only (API route or edge function). Verify that no client-side bundle includes the credentials by checking the build output.
- Rotate credentials if the repository is ever made public.

**Detection:** `git log --all -p | grep -i "password"` returns results. Client-side network tab shows RFC credentials in requests.

**Phase relevance:** Phase 2 (scraper). Environment setup checklist item.

---

### Pitfall 11: No Data Validation Layer Between Parse and Insert

**What goes wrong:** A malformed PDF produces a sale with `total_sold_value: NaN` or `sell_through_pct: 150.00`. The invalid data reaches the database and propagates to charts, making the dashboard show absurd values.

**Prevention:**
- Add a validation schema (Zod or similar) between the PDF parser output and the database insert. Reject records with values outside reasonable ranges.
- Define business rules: sell_through_pct must be 0-100, total_sold_value must be >= 0, lots_sold must be <= auctioned_lots.
- Quarantine invalid records in a `parse_errors` table for human review rather than silently dropping them.

**Detection:** Chart Y-axes with unexpectedly large scales. Percentage values above 100%. Negative values in revenue fields.

**Phase relevance:** Phase 1 (PDF parsing pipeline). Build validation into the pipeline, not as a later addition.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| PDF parsing (Phase 1) | Silent parsing errors in financial values | Unit test every value format; cross-validate totals vs. department sums |
| PDF parsing (Phase 1) | Department code variants across 457 PDFs | Build normalization map; log unknowns |
| Database setup (Phase 1) | Shared Supabase migration breaking TPC App | Strict table ownership; dry-run migrations; never ALTER app tables |
| Auth setup (Phase 1) | Session conflicts between three apps | Separate Supabase client instances per app |
| Scraper (Phase 2) | Vercel cron timeout (60s limit) | Decouple trigger from execution; use external worker |
| Scraper (Phase 2) | Site changes break scraper silently | Monitor `scraper_runs`; save raw responses; alert on failures |
| Scraper (Phase 2) | Credential exposure | Environment variables only; server-side execution only |
| Visualization (Phase 3) | Chart performance with full dataset | Pre-aggregate in PostgreSQL; limit default ranges; disable animations |
| Visualization (Phase 3) | Floating-point display errors | Aggregate in SQL; use precision-safe library on frontend |
| Reporting (Phase 4) | PDF export produces blank/broken charts | Dedicated print layout component; test SVG rendering in Puppeteer |
| App/Extension analytics (Phase 4+) | Reading from tables that do not exist yet | Check table existence gracefully; show "no data" state for Cataloger analytics until v2.0 ships |

---

## Sources

- [Recharts Performance Optimization Guide](https://recharts.github.io/en-US/guide/performance/)
- [Vercel Cron Jobs: Gotchas and Solutions](https://tisankan.dev/vercel-cron-jobs/)
- [Vercel Cron Jobs Troubleshooting](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase RLS Best Practices: Multi-Tenant Apps](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [How to Handle Monetary Values in JavaScript](https://frontstuff.io/how-to-handle-monetary-values-in-javascript)
- [Financial Precision in JavaScript](https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc)
- [PDF Parsing Libraries for Node.js (2025)](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025)
- [Generating PDF Reports with Charts Using React and Puppeteer](https://dev.to/carlbarrdahl/generating-pdf-reports-with-charts-using-react-and-puppeteer-4245)
- [Cookie Management in Puppeteer](https://latenode.com/blog/web-automation-scraping/puppeteer-fundamentals-setup/cookie-management-in-puppeteer-session-preservation-auth-emulation-and-limitations)
- [PostgreSQL Numeric Types Documentation](https://www.postgresql.org/docs/current/datatype-numeric.html)
