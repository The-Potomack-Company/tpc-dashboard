# Stack Research — v2.0 Live Ops Additions

**Domain:** React dashboard for live auction ops + activity analytics (TPC Dashboard v2.0)
**Researched:** 2026-04-24
**Confidence:** HIGH for frontend additions and core deployment target; MEDIUM for specific resilience library versions (Playwright ecosystem churn)

## Scope of This Document

This is **additive** to the locked v1.0 stack (React 19, TypeScript 5.9, Vite 7, Tailwind 4, React Router 7, Supabase JS v2, Zustand 5, Zod 4, TanStack Query 5, Recharts 3.8, TanStack Table 8, papaparse, @react-pdf/renderer, Vitest 4, ESLint 9 — already in `package.json`). Do not re-litigate those. This document answers: **what do we add for v2.0 Live Ops, where does the Playwright scraper run, and how do we wire real-time updates into TanStack Query?**

PDF-specific libraries (pdf-parse) and the historical-sale schema are retired in v2.0 and intentionally absent below.

---

## Recommended Stack Additions

### Near-Real-Time UI (Live Dashboard Freshness)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` Realtime channel API (already installed, ^2.104.1 current) | pinned via `@supabase/supabase-js` ^2.101.1 (bump to ^2.104.1) | Push notifications for lot-event INSERTs during a live sale | Already bundled with the Supabase client; no separate backend needed. Supports `postgres_changes` on specific tables/events/filters. Pair it with `queryClient.invalidateQueries()` to refresh TanStack Query caches — the idiomatic 2026 pattern. |
| TanStack Query `refetchInterval` (function form) | included in `@tanstack/react-query` ^5.99.2 (already installed) | Fallback polling and tunable cadence during active sales | Function-form `refetchInterval: (query) => ...` lets us flip 30s → 2s when a sale is "active" and return `false` when idle. `refetchIntervalInBackground: true` keeps the ops dashboard fresh on a second monitor/unfocused tab. |

**Primary pattern (use both, not one or the other):**

- **Realtime channel** = push. Open one channel per active live-sale view. On any `INSERT/UPDATE` on the dashboard-owned lot-event table, call `queryClient.invalidateQueries({ queryKey: ['liveSale', saleId] })`. This gives seconds-scale freshness without a tight poll.
- **TanStack Query with dynamic `refetchInterval`** = pull. Acts as (a) safety net if the Realtime socket drops, (b) cadence control for derived/aggregated views that don't correspond 1:1 to a table, and (c) the sole mechanism for activity-tracking tabs that read TPC App / extension tables where we don't own the publication.

**Rejected alternatives:**
- **Custom WebSocket / SSE endpoint** — We already have Realtime from Supabase. Building a parallel websocket layer on Vercel is wasted complexity.
- **`setInterval` inside components** — Bypasses TanStack Query's dedup, focus-pause, and cache machinery. Don't.

**Integration point:** Realtime subscriptions live in a `useLiveSaleSubscription(saleId)` hook that:
1. `supabase.channel(...).on('postgres_changes', ...).subscribe()` on mount
2. `supabase.removeChannel(channel)` in cleanup (critical — missed cleanup causes ghost listeners on route change)
3. Monitors `SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT` status; on error, falls back to shorter `refetchInterval` until reconnect

---

### Activity-Feed UI Primitives

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-virtual` | ^3.13.24 | Virtualized scrolling for the extension live event feed and any `analytics_events` / lot-event list that can exceed a few hundred rows | Headless (same philosophy as TanStack Table / Query — integrates with Tailwind cleanly). 5–10 KB gzip. Handles dynamic row heights and inverted (bottom-up) feeds, which is exactly what a live event stream needs. |
| `react-day-picker` | ^9.14.0 | Date range picker for activity reports ("volume by day, Apr 1–Apr 24") | Headless, zero runtime deps, React 19-ready, WCAG 2.1 AA. TanStack-ecosystem-aligned philosophy (style it yourself with Tailwind). react-datepicker bundles date-fns internally and has more opinions about markup; react-day-picker gives us more control with less weight. |
| `date-fns` | ^4.1.0 | Date math, formatting, timezone conversions for chart axes, session windowing, export filenames | Functional / tree-shakeable API pairs well with our existing Zod + TanStack Query functional style. 13 KB if you import everything; typically 2–4 KB after tree-shaking for the ~8 functions a dashboard actually uses. Widely adopted across React dashboards. Temporal API is not yet stable in all Node/Vercel runtimes as of Apr 2026. |
| `date-fns-tz` | ^3.2.0 | Timezone-aware formatting for America/New_York (TPC's ops timezone) | Companion package to date-fns. TPC sessions, sales, and events span late-night scrape runs and multi-timezone admins; rendering everything in ET consistently matters. |

Why not Day.js? Smaller bundle (2 KB) but requires the timezone plugin + UTC plugin + locale plugin chain, mutable-ish chaining API, and worse TypeScript ergonomics for discriminated-union Date usage. date-fns wins on DX for a typed codebase of this size.

**Recharts and TanStack Table are already locked — no changes needed for the charting/table primitives themselves.** Recharts renders line/bar/stacked charts for activity; TanStack Table renders the sortable session/event grids.

---

### Scraper Runtime (RFC Live Sale Scraper)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Playwright (Node) | ^1.59.1 | Browser automation for RFC login + live sale page scraping | Locked in v1.0 research; still the right tool. Auto-wait, login-flow DX, multi-browser, Microsoft-backed. |
| Playwright official Docker image | `mcr.microsoft.com/playwright:v1.59.1-noble` | Base image for scraper container | Maintained by the Playwright team, includes Chromium + Firefox + WebKit + all OS-level deps. Using anything else guarantees "Executable doesn't exist at /root/.cache/ms-playwright/chromium…" errors on first deploy. |
| `p-retry` | ^8.0.0 | Exponential-backoff retry wrapper for flaky RFC page loads | Battle-tested, tiny (~2 KB). Handles `AbortError`, error-class filtering, and custom `onFailedAttempt` hooks. Simpler than rolling our own retry loop and more predictable than Playwright's test-mode retries (which don't apply in scraper mode). |
| `pino` | ^10.3.1 | Structured JSON logging for the scraper | 5–8× faster than Winston; JSON-first output is trivial to pipe to Railway/Fly logs, Supabase log tables, or external log aggregators later. The scraper will produce hundreds of log lines per sale; we want no logging-induced jitter in the polling loop. |

**Why not `@microsoft/playwright-chromium` alone?** The full `playwright` package is only ~5 MB installed; browser binaries come from `playwright install chromium`. Using the Chromium-only package saves a tiny amount of disk but loses the ability to swap browsers if RFC starts fingerprinting Chrome specifically.

**Why not Crawlee?** It's a framework that wraps Playwright with queue/session/proxy infrastructure. We're scraping one known URL on a timer, not running a distributed crawler. Crawlee adds conceptual weight (request queues, dataset stores) we won't use.

---

### Scraper Deployment Target — **Recommendation: Railway (Docker, long-running service)**

**Verdict:** Deploy the scraper as a **Railway service** using the official Playwright Docker image, triggered by an internal HTTP endpoint or a lightweight in-container scheduler. Keep the frontend on Vercel.

**Why Railway over the alternatives:**

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **Railway (recommended)** | ✅ Primary | Supports Docker + long-running processes + persistent container. Official Playwright guide. Simplest deploy path: Dockerfile → `railway up` → live. Usage-based pricing (~$5–15/mo for a small always-on scraper). Memory configurable (start at 1 GB). Works with GitHub deploys. |
| **Fly.io** | ⏸ Acceptable backup | Also Docker-native, global regions (irrelevant here — RFC is US-East and the scraper doesn't need edge). Documented Playwright quirks: Chromium cold-start can take 25+ seconds, `--ipc=host` required to avoid OOM crashes. Slightly more config ceremony than Railway. Use if Railway pricing becomes an issue or we need multi-region. |
| **Render** | ⏸ Acceptable backup | Background workers from $7/mo. Similar capability profile to Railway but with less mindshare in the Playwright community, fewer worked examples. |
| **Supabase Edge Functions (Deno)** | ❌ Not viable | **Hard blocker**: 256 MB memory cap, no multithreading (rules out Chromium), 150s free / 400s paid wall-clock limit. Confirmed April 2026 Supabase docs. v1.0 STACK.md listed this as "Option A (RECOMMENDED)" — that recommendation is **reversed** based on current platform limits. |
| **Vercel Functions** | ❌ Not viable | 60s Hobby / 800s Pro wall-clock; no browser binary in the standard runtime; live sales run for hours. |
| **GitHub Actions scheduled runs** | ❌ Not viable for live | Minimum cron granularity is 5 min and schedules are best-effort (often delayed 5–30 min). Fine for one-shot profile scrapes but useless for seconds-scale live-sale polling. |
| **Self-hosted VPS (DO/Hetzner)** | ⏸ Available if needed | Cheapest at scale ($4–6/mo) but adds OS-patching, monitoring, and log-shipping work. Choose only if Railway/Fly pricing doesn't fit and we're willing to take the ops burden. |

**How Railway integrates with the existing stack:**

1. **Frontend on Vercel** (unchanged) calls a Railway-hosted HTTP endpoint to start/stop a live-sale scrape session. Use a shared-secret bearer token in an env var — the scraper endpoint is admin-only and doesn't need to sit behind Supabase auth.
2. **Scraper writes directly to Supabase** using the service-role key (dashboard-owned lot-event tables only). All writes go through `@supabase/supabase-js` in the scraper container, not through Vercel. Writes trigger Postgres `REPLICA IDENTITY`-enabled publications that the frontend Realtime channel picks up.
3. **Supabase `auth` is never called from the scraper** — it uses service-role credentials only.
4. **Logs** flow to Railway's built-in log viewer (pino JSON format); optionally tee to a `scrape_logs` Supabase table for in-dashboard visibility during debugging.
5. **Scheduling**: start with manual start/stop via dashboard UI ("Begin live scrape" / "End live scrape" admin buttons). Add auto-detect-sale scheduling later once we have patterns from real sales.

**Why not run the scraper "from Vercel" via a proxy?** Vercel's Pro plan supports 800s functions, but even that doesn't fit a multi-hour sale. Splitting a sale into 800s windows just recreates the problem of "how does state survive between invocations?" — which is exactly what a persistent Railway container solves.

---

### Installation (v2.0 additions only)

```bash
# Near-real-time and UI primitives (frontend)
npm install @tanstack/react-virtual@^3.13.24 \
            react-day-picker@^9.14.0 \
            date-fns@^4.1.0 \
            date-fns-tz@^3.2.0

# Bump Supabase client to pick up latest Realtime fixes (optional but recommended)
npm install @supabase/supabase-js@^2.104.1

# Scraper-only deps (should live in a separate workspace or scraper/ subdirectory,
# not the frontend bundle)
npm install playwright@^1.59.1 \
            p-retry@^8.0.0 \
            pino@^10.3.1
# After playwright install:
npx playwright install chromium
```

**Important:** Keep `playwright`, `p-retry`, and `pino` out of the Vercel frontend bundle. Options:
- Move the scraper to `scraper/` with its own `package.json` (monorepo-ish).
- Or mark them as `optionalDependencies` and exclude via Vite's `external` config.

Locking which is in-scope is a planning decision, not a research decision — but the structural constraint is: **the frontend bundle must not include Playwright.**

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase Realtime + TanStack Query invalidation | TanStack Query polling alone (no Realtime) | If the extension team ships a Postgres publication we can't join, or if the `analytics_events` table has no `REPLICA IDENTITY FULL` and we can't set it. Poll-only is worse freshness but works without schema changes. |
| Supabase Realtime | Custom SSE endpoint on Vercel | If Supabase Realtime's per-channel message cap becomes a throughput problem (unlikely at TPC scale — tens of events/minute, not thousands). |
| Railway (Docker) | Fly.io (Docker) | If we need multi-region, GPU (we won't), or Railway's pricing model becomes problematic. Both use the official Playwright image — migration is copy-paste. |
| Railway (Docker) | Browserless.io / Scrapfly (cloud browser as a service) | If RFC aggressively blocks and we need managed proxy + stealth rotation. Adds $50–500/mo and external dependency; only worth it after we actually see blocks. |
| `@tanstack/react-virtual` | Native browser `content-visibility: auto` | If the live-event feed stays under a few hundred rows and the feed component is simple. Cheaper code, but regresses once an extension-heavy day pushes 1000+ rows. |
| `date-fns` + `date-fns-tz` | `dayjs` + `dayjs/plugin/timezone` + `dayjs/plugin/utc` | Bundle-size-obsessed projects. Dashboard is not one — the charts/tables dominate the bundle. |
| `react-day-picker` | `react-datepicker` | If we want out-of-the-box styled dropdowns and don't care about Tailwind-native styling. react-datepicker has a larger CSS footprint we'd end up overriding. |
| `pino` | `winston` | If we need out-of-the-box CloudWatch / S3 / MongoDB transports. For Railway-native logging, pino is simpler and faster. |
| `p-retry` | Custom `async function retry(...)` | If we only retry in one place. We don't — login, page navigation, selector waits, Supabase upserts all want backoff. Centralize in `p-retry`. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `pdf-parse`, `pdfjs-dist`, `unpdf` | PDF import pipeline retired in v2.0 pivot. No historical sale ingestion exists. | Nothing — live scraping only. |
| A replacement state library (Redux, Jotai, Valtio) | Zustand + TanStack Query is the locked pattern from v1.0 and works for live ops. | Keep Zustand for client state, TanStack Query for server state. |
| A replacement chart library (Nivo, Tremor, Chart.js) | Recharts 3.8 handles every live-ops chart we need (activity-over-time line, event-type stacked bar, ai_status health pie). | Keep Recharts. |
| `socket.io`, `ws`, raw WebSocket server, or separate realtime backend (Ably, Pusher) | Supabase Realtime is already in the bundle and the scraper already writes to Supabase. Adding a second realtime transport is pure duplication. | Supabase Realtime `postgres_changes` channel. |
| `puppeteer` | Locked out by v1.0 decision: Chromium-only, needs stealth plugin for anti-bot, worse login-flow DX than Playwright. | Playwright (already chosen). |
| `crawlee` | Queue/dataset framework we don't need. We poll one URL on a timer; adding crawler infrastructure hides the simple control flow under framework indirection. | Raw Playwright + p-retry. |
| `node-cron` running inside a Vercel function | Vercel functions are short-lived; node-cron needs a persistent process. Conflates scheduling with execution. | Railway cron feature, or a loop inside the Railway long-running service, or a dashboard-triggered "start sale" button. |
| Playwright **test** mode (`@playwright/test`) | Test runner assumes CI ergonomics (spec files, `expect`, retries-per-test). We're writing a long-running scraper, not assertions. | Use the `playwright` Node library directly — `chromium.launch()`, `context.newPage()`. |
| `supabase` with anon key from the scraper | RLS blocks most writes; accidentally exposing the anon key in a container image is a leak vector. | Service-role key, stored in Railway env vars, never checked into git. |
| `moment` / `moment-timezone` | Moment is in maintenance mode and 2–3× the size of date-fns. No advantage in 2026. | `date-fns` + `date-fns-tz`. |
| `axios` for HTTP inside the scraper | Native `fetch` is in Node 18+ (Railway runs Node 20+ by default). One less dep. | Native `fetch`. |
| Adding TanStack Router | React Router 7 is already in the stack and working. | Keep React Router 7. |

---

## Stack Patterns by Variant

**If the live sale is running:**
- Subscribe to `postgres_changes` on the live-sale event table (one channel per sale)
- TanStack Query `refetchInterval: 2_000` on the current-lot summary query (safety net)
- `refetchIntervalInBackground: true` so a second-monitor dashboard stays fresh

**If no live sale is active:**
- Don't subscribe (save the channel)
- TanStack Query default staleTime / `refetchInterval: 60_000` on activity-tracking tabs
- Disable scraper container via Railway sleep / scale-to-zero (if we want to save cost — optional)

**If the RFC scraper is blocked or login fails:**
- `p-retry` backs off up to N attempts with jitter
- Scraper writes a `scrape_errors` row to Supabase
- Realtime-subscribed dashboard banner surfaces the error to the admin within seconds
- After N failures, scraper container health-checks fail → Railway restarts → fresh session

**If we outgrow Railway (throughput/cost):**
- Move scraper container to Fly.io (change target, Dockerfile stays the same)
- Or route scrapes through a cloud-browser API (Scrapfly / Browserless) — Playwright `connect()` works with both
- No frontend code changes required

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@tanstack/react-virtual@^3.13.24` | React 19 | Confirmed via npm peer deps Apr 2026 |
| `@tanstack/react-query@^5.99.2` | React 19 | Already in `package.json`; no change |
| `react-day-picker@^9.14.0` | React 19 | v9 is the React 19-ready line; dropped older React |
| `date-fns@^4.1.0` + `date-fns-tz@^3.2.0` | Each other | date-fns-tz v3 targets date-fns v4 specifically — do not pair with date-fns v3 |
| `playwright@^1.59.1` | `mcr.microsoft.com/playwright:v1.59.1-noble` | Image tag MUST match the installed Playwright version — version drift causes browser-launch failures |
| `@supabase/supabase-js@^2.101.1` → `^2.104.1` | Existing `zustand`, `zod`, `@tanstack/react-query` | Minor bumps only; no breaking changes in the 2.10x line as of Apr 2026 |
| `pino@^10.3.1` | Node 20+ | Railway default Node is 20; Vercel is 20 by default too |
| `p-retry@^8.0.0` | Node 18+ | ESM-only; our project is already `"type": "module"` so no issue |

---

## Version Alignment with TPC App (v2.0 update)

| Package | TPC App | Dashboard v1.0 | Dashboard v2.0 | Notes |
|---------|---------|----------------|----------------|-------|
| react | ^19.2.0 | ^19.2.0 | ^19.2.0 | Exact match (unchanged) |
| typescript | ~5.9.3 | ~5.9.3 | ~5.9.3 | Exact match (unchanged) |
| @supabase/supabase-js | ^2.99.2 | ^2.101.1 | ^2.104.1 | Minor bump to pick up Realtime reconnection fixes |
| zustand | ^5.0.11 | ^5.0.11 | ^5.0.11 | Exact match (unchanged) |
| zod | ^4.3.6 | ^4.3.6 | ^4.3.6 | Exact match (unchanged) |
| date-fns | (not used) | (not used) | ^4.1.0 | **New** in v2.0 |
| @tanstack/react-virtual | (not used) | (not used) | ^3.13.24 | **New** in v2.0 |
| react-day-picker | (not used) | (not used) | ^9.14.0 | **New** in v2.0 |
| playwright | (not used) | (not used) | ^1.59.1 | **New** in v2.0 (scraper workspace only, not frontend) |
| pino | (not used) | (not used) | ^10.3.1 | **New** in v2.0 (scraper only) |
| p-retry | (not used) | (not used) | ^8.0.0 | **New** in v2.0 (scraper only) |

TPC App does not currently use any date library. Our adoption of `date-fns` does not conflict — it's additive to the shared conventions, not a replacement for an existing choice.

---

## Integration Points (for downstream phase planners)

| New capability | Hook / module name (suggested) | Consumes | Produces |
|----------------|--------------------------------|----------|----------|
| Live sale subscription | `src/features/live-sale/hooks/useLiveSaleSubscription.ts` | `supabase` client, `queryClient` | Invalidates `['liveSale', saleId]` queries on postgres_changes |
| Scraper HTTP trigger | `src/features/live-sale/api/startScrape.ts` | Shared-secret token from env | POSTs to Railway `/scrape/start` endpoint |
| Live event feed | `src/features/extension-analytics/LiveEventFeed.tsx` | `@tanstack/react-virtual` + TanStack Query | Virtualized feed of `analytics_events` |
| Date range picker | `src/components/DateRangePicker.tsx` | `react-day-picker`, `date-fns` | Standard `{ from: Date; to: Date }` controlled component |
| Scraper service (separate workspace) | `scraper/src/index.ts` | Playwright, p-retry, pino, Supabase service-role client | Dashboard-owned lot-event rows in Supabase |

---

## Sources

### HIGH confidence (official docs, Context7-equivalent npm registry, or Supabase docs)
- TPC Dashboard `package.json` (read directly) — current stack
- TPC App `package.json` (`~/Projects/TPC_App/TPC_App/package.json`) — alignment baseline
- npm registry (direct query via `npm view`) — pinned the versions above: `@tanstack/react-virtual@3.13.24`, `date-fns@4.1.0`, `date-fns-tz@3.2.0`, `p-retry@8.0.0`, `pino@10.3.1`, `playwright@1.59.1`, `@tanstack/react-query@5.100.1`, `@tanstack/react-table@8.21.3`, `recharts@3.8.1`, `@react-pdf/renderer@4.5.1`, `papaparse@5.5.3`, `@supabase/supabase-js@2.104.1`, `react-day-picker@9.14.0`, `dayjs@1.11.20` (not chosen) — all queried Apr 24 2026
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits) — confirmed 256 MB memory, 2s CPU, 150/400s wall-clock, no multithreading. Decisive for ruling out Edge Functions as a Playwright target.
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts) — `postgres_changes` channel patterns, cleanup via `removeChannel`
- [Playwright Docker docs](https://playwright.dev/docs/docker) — official image tag convention `mcr.microsoft.com/playwright:v{version}-{distro}`
- [Railway Playwright Guide](https://docs.railway.com/guides/playwright) — 1 GB memory recommendation, `NODE_OPTIONS=--max-old-space-size=4096`, cron vs long-running patterns
- [TanStack Query Polling docs](https://tanstack.com/query/latest/docs/framework/react/guides/polling) — `refetchInterval` function form, `refetchIntervalInBackground`

### MEDIUM confidence (credible analyses, not primary docs)
- [Makerkit — Supabase + TanStack Query pattern](https://makerkit.dev/blog/saas/supabase-react-query) — invalidation-on-realtime pattern
- [Nextbase — Realtime data handling guide](https://www.usenextbase.com/docs/v2/guides/handling-realtime-data-with-supabase) — subscription lifecycle, reconnection
- [Fly.io Community — Playwright threads](https://community.fly.io/t/playwright-not-working/6784) — documents the common pitfalls (browser path, `--ipc=host`, cold-start latency)
- [PkgPulse — date libs 2026](https://www.pkgpulse.com/blog/best-javascript-date-libraries-2026), [PkgPulse — pino vs winston 2026](https://www.pkgpulse.com/blog/pino-vs-winston-2026) — ecosystem benchmarks
- [LogRocket — TanStack Virtual live chat feed](https://blog.logrocket.com/speed-up-long-lists-tanstack-virtual/) — pattern applicable to event feeds

### Explicitly contradicted prior research
- v1.0 STACK.md listed **Supabase Edge Functions + Deno + Playwright** as "Option A (RECOMMENDED)" for the scraper. Current 2026 Supabase Edge Function limits (256 MB memory, no multithreading, no Chromium binary in Deno) make this **not viable**. Reversal is primary source-backed, HIGH confidence.

---
*Stack research for: TPC Dashboard v2.0 Live Ops (additions and changes only)*
*Researched: 2026-04-24*
