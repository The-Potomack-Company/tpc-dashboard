# Pitfalls Research — v2.0 Live Ops

**Domain:** Live auction house ops monitoring — multi-source dashboard (reads TPC App tables + extension analytics_events + writes live-scraped RFC sale state)
**Researched:** 2026-04-24
**Confidence:** HIGH for Supabase Realtime + RLS pitfalls (Context7 + official docs corroborated); HIGH for v1→v2 transition pitfalls (direct codebase inspection); MEDIUM for scraper long-run failure modes (documented community patterns, but specific to RFC's stack unknown until scraper phase).

> **Scope note.** This file is a v2-only addendum. v1 lessons already in STATE.md — `supabase db pull/reset --linked` banned, service-role key never in frontend bundle, `numeric(14,2)` for money, security-definer PL/pgSQL RPCs for atomicity, don't over-invest in an import before proving end-to-end — are **not repeated here**. Treat them as preconditions.

---

## Critical Pitfalls

### Pitfall 1: Adding a SELECT policy to `analytics_events` that breaks the extension's `anon INSERT`

**What goes wrong:**
The extension's Chrome extension writes to `analytics_events` using the Supabase anon key and an `INSERT` RLS policy for the `anon` role. The dashboard needs admin `SELECT`. A naive fix — `DROP POLICY` and re-add, or a catch-all policy, or enabling `FORCE ROW LEVEL SECURITY` — silently breaks extension writes with a policy-violation error that only surfaces when a user triggers an event.

**Why it happens:**
RLS policies are additive across commands but *command-scoped*. A dashboard author adding `CREATE POLICY "admin can read" ... FOR SELECT` is safe. But they sometimes reach for `FOR ALL` for simplicity, or recreate the entire policy set, or assume Postgres' ownership of the table lets them freely edit. The extension and the dashboard live in separate repos; the dashboard author doesn't see the extension's write path break until a real event fires in production.

**How to avoid:**
- Policies for the two roles are strictly additive. Add one new policy, `CREATE POLICY "admin_select_analytics_events" ON public.analytics_events FOR SELECT TO authenticated USING (private.is_admin())`. Do **not** touch the existing anon INSERT policy.
- Never use `FORCE ROW LEVEL SECURITY` on `analytics_events` — it would force RLS on the extension's service-role writes too (if any).
- Before migration: dump current policies (`SELECT * FROM pg_policies WHERE tablename = 'analytics_events'`) into the migration file as a comment so the diff is obvious during review.
- After migration: run a test insert from the extension against the same DB (either a staging clone or coordinated with the extension team) before merging.

**Warning signs:**
- The migration drops or replaces an existing policy rather than adding a new one.
- `pg_policies` count for `analytics_events` decreases instead of increases after migration.
- Extension users start seeing the catalog-event flow silently fail client-side (extension typically fires-and-forgets with no retry).

**Phase to address:**
**Early** — the phase that first reads `analytics_events`. Must ship *before* any UI consumes the data so the extension-write regression would be caught by the dashboard team, not the extension team.

---

### Pitfall 2: Supabase Realtime subscription never fires because the SELECT policy is missing (not the publication)

**What goes wrong:**
Developer enables `ALTER PUBLICATION supabase_realtime ADD TABLE <x>`, subscribes from the frontend, sees no events. Assumes the publication is the fix (it is half of it). Real cause: Realtime evaluates the subscriber's RLS **SELECT** policy for every row-change event; if the subscriber can't `SELECT` the row, Realtime silently drops the event.

**Why it happens:**
Supabase Realtime is a separate service that tails the WAL and broadcasts only rows the subscriber is authorized to SELECT. Documentation calls this out but it's easy to miss when the "obvious" fix is publication-level.

**How to avoid:**
- For every live-sale table, ship **three things in the same migration**: the `CREATE TABLE`, `CREATE POLICY ... FOR SELECT TO authenticated USING (private.is_admin())`, and `ALTER PUBLICATION supabase_realtime ADD TABLE public.<t>`.
- For `analytics_events` — already in publication or not? Audit in the first migration of the analytics phase; if not present, add it alongside the admin SELECT policy.
- Confirm end-to-end with a throwaway test: open two Supabase JS clients (one inserts, one subscribes), verify the subscriber fires.

**Warning signs:**
- `.subscribe()` callback registers but is never invoked.
- DB INSERT works (visible in Table Editor / `SELECT * FROM`), but UI doesn't update until a manual refetch.
- `supabase_realtime` publication listing (`SELECT pubname, tablename FROM pg_publication_tables`) does not include the table.

**Phase to address:**
**Mid** — the phase where live-sale events first flow to the UI. Bundle realtime wiring as part of each new live-sale table migration so this can never drift.

---

### Pitfall 3: Playwright long-running scrape — browser context bloat + session cookie silent expiry

**What goes wrong:**
Scraper opens one Playwright `browserContext` + one `page` at scraper start, logs in, begins polling every N seconds. Two things fail as the sale runs long:
1. **Memory creeps 40-60MB/hour** (documented: ~400MB RSS after 20 min of refresh-every-1s, over 1GB in <20 min under heavier load). After 3-4 hours the process gets OOM-killed by the container.
2. **Session cookie expires** or the site silently logs the session out mid-sale. Subsequent polls return the login page HTML; the parser reads "no current lot" and writes stale-looking records — or worse, misinterprets the login page's DOM as an empty auction.

**Why it happens:**
- Playwright retains DOM, event listeners, network buffers across navigations in the same context. "Refresh the page, wait, read DOM" is the naive loop and it leaks.
- Auction sites rotate session cookies aggressively (either on a timer or on idle); a scraper that logs in once and never re-authenticates hits the wall eventually.

**How to avoid:**
- **Recycle the context every N minutes or N polls** (e.g., every 30 minutes or 200 polls, whichever comes first). Close the context, create a new one, restore saved `storageState`, verify logged-in by checking a post-login DOM marker before continuing.
- **Verify logged-in on every poll** via a cheap check (e.g., presence of a user-menu DOM node, or absence of a login-form selector) *before* trusting the lot data. If logged out, re-authenticate.
- **Budget memory with process-level ceilings.** On Railway/Fly, set a memory limit (e.g., 512MB) and configure the orchestrator to restart on OOM. A fresh process every few hours is cheaper than debugging a slow leak.
- **Periodically `page.close()` + `browserContext.close()`** even if keeping the browser alive, to release DOM retention.
- **Save and reload storageState to disk / Supabase storage** so restarts don't trigger a fresh login every time (anti-bot signal).

**Warning signs:**
- Scraper process RSS growing monotonically — always a leak.
- Parser starts reporting "current lot not found" after N hours when the sale is clearly still live.
- Login-page HTML appearing in a saved debug HTML dump.
- Memory graph on Fly/Railway trending up for the entire sale window.

**Phase to address:**
**Late** — scraper phase. Mitigation lives in the scraper runtime itself, not earlier DB design. The *memory cap + auto-restart* should be set at the deploy config step before the first live-sale test.

---

### Pitfall 4: Stale-data hazard — scraper falls behind, UI shows old bid state as "current"

**What goes wrong:**
Scraper polls every 5s. Target site throttles for 30s. Scraper's last-written row in `live_sale_events` is 35s old but the UI reads it as "current lot, current bid" with no indication it's stale. Sale monitor makes a decision based on stale data (e.g., believes a lot passed that's actually still open).

**Why it happens:**
The "read current state from the latest row" pattern has no inherent concept of "row freshness." Without a lag indicator, the UI can't distinguish "nothing is happening" from "the scraper is broken."

**How to avoid:**
- Every live-sale event row gets a `scraped_at timestamptz not null default now()` (wall-clock when the scraper wrote it).
- **Scraper heartbeat table** — a dashboard-owned `scraper_heartbeats` table the scraper updates every poll regardless of whether any event row was written. Columns: `scraped_at`, `poll_latency_ms`, `logged_in bool`, `current_sale_id`, `last_error text null`. The UI reads `now() - heartbeats.scraped_at` to compute staleness.
- UI staleness banner: green < 15s, amber 15-60s, red > 60s. Bigger than red = "Scraper offline — values frozen at HH:MM:SS."
- Don't silently retry parser failures and keep the old row as "current" — write a row with `status: 'parse_error', last_dom_snapshot: '...'` so the heartbeat still advances.

**Warning signs:**
- No `scraped_at` / `server_received_at` column on the events table.
- UI has no time-since-last-update indicator for the live feed.
- Scraper logs errors but keeps the "current lot" card looking identical to the user.

**Phase to address:**
**Mid** — live-sale schema phase. Heartbeat table + UI staleness indicator should be non-negotiable in the schema design before any scraper code is written.

---

### Pitfall 5: Clock skew between scraper wall clock, Supabase `now()`, and browser render

**What goes wrong:**
Scraper writes `scraped_at: new Date().toISOString()` from its runtime. Runtime has drifted (especially on long-lived Railway/Fly containers without NTP sync, or if the scraper is running in a different region). Browser renders `scraped_at` as "37 seconds in the future" — user sees a timestamp that hasn't happened yet, or the staleness banner oscillates green/red.

**Why it happens:**
- Scraper container's clock and Supabase's Postgres `now()` are independent clocks.
- JS `new Date()` is the container clock, not the DB clock.
- Browser computes "X seconds ago" against its own clock, which also drifts.

**How to avoid:**
- **Always write timestamps from Postgres**, not from the scraper. Schema defaults: `scraped_at timestamptz not null default now()`. Scraper passes `null` or omits the column; DB stamps it.
- If the scraper captures a page-side timestamp (e.g., RFC's server-reported timer), store it separately as `source_timestamp timestamptz` — never substitute for `scraped_at`.
- Frontend computes staleness against **server time**, not `new Date()`: fetch `select now()` once per session (or via a dedicated lightweight RPC) and compute the browser↔server skew, then subtract it from all age calculations.
- UI formatting: never render an absolute timestamp as "in 3 seconds" — clamp negatives to "just now."

**Warning signs:**
- Staleness banner shows "-5s ago" or flips red/green for no reason.
- Test users on a machine with wrong time see totally different freshness than production users.
- The scraper writes `scraped_at` from the container wall clock in its INSERT statements.

**Phase to address:**
**Mid** — same schema phase as Pitfall 4. Enforce "timestamps default from Postgres" as a codebase convention; document in the new Conventions section of CLAUDE.md.

---

### Pitfall 6: Dashboard Supabase user ≠ TPC App admin (auth mapping trap)

**What goes wrong:**
Dashboard dev assumes "same Supabase project means the admin user I'm logged in as on the dashboard is the same admin `private.is_admin()` returns true for when I was in the TPC App." This holds **only if** `private.is_admin()` is defined against `auth.uid()` of the current JWT and the dashboard uses the same `auth.users` table (same Supabase project, not just same schema). If the dashboard accidentally talks to a different project URL, or if `private.is_admin()` reads from a per-app table (`app_admins` vs `dashboard_admins`), the admin check fails and queries silently return zero rows.

**Why it happens:**
- Config drift: `.env.local` has `VITE_SUPABASE_URL` pointing at a different project (a dev copy) but the same key name.
- `private.is_admin()` might have been duplicated in both projects with divergent allow-lists.
- v1 validated this assumption in Phase 1 with a single shared `profiles` table — but nothing enforces it.

**How to avoid:**
- **Assert at startup**: on admin login, call a simple RPC that returns `{ auth_uid, is_admin, tpc_app_profile_exists, email }` and log/display the result. If `tpc_app_profile_exists=false` but the user just logged in, the dashboard and TPC App are out of sync.
- Single source of truth: `private.is_admin()` reads from the shared `profiles.role` (TPC App's column). Do **not** maintain a parallel `dashboard_admins` table.
- On a PR that touches `private.is_admin()`, require dual-repo awareness (TPC App + dashboard) in the PR checklist.

**Warning signs:**
- Admin queries return zero rows but the same SQL in the Supabase SQL editor (service-role) returns rows.
- `VITE_SUPABASE_URL` differs between dashboard and TPC App `.env` files (but both are pointed at "prod").
- Two copies of `private.is_admin()` exist with different allow-lists.

**Phase to address:**
**Early** — first phase that reads from TPC App tables. Add the assertion RPC and a "who am I?" debug page in the phase that lights up the first read-only view.

---

### Pitfall 7: Signed URLs for photos expire mid-session — dashboard shows broken thumbnails

**What goes wrong:**
Dashboard needs to display photos from the TPC App's Storage bucket (which contains photos from sessions). Dev generates signed URLs with 1-hour expiry at query time (via `createSignedUrl`), caches them in TanStack Query with the query result, stale time 5 minutes. Four hours later, the user reopens the tab — the cached URLs are expired, thumbnails 404.

**Why it happens:**
- Signed URL expiry is embedded in the URL itself; once issued, it can't be "refreshed" — only re-issued.
- TanStack Query's staleness is orthogonal to signed-URL expiry. Cached data can be "fresh" (per TQ) while the URLs inside it are expired.
- The bucket is private (it must be — these are customer photos), so there's no "just use the public URL" fallback.

**How to avoid:**
- **Don't pre-sign URLs** for thumbnails in list views. Use a cheap server-side rendered thumbnail proxy route (a Supabase Edge Function or a Vercel function) that generates the signed URL on-demand with a short TTL (5 min) and redirects. The URL in the DOM is `/thumb/<photo_id>`, not a direct Storage URL.
- If pre-signing: set expiry = query staleTime + safety margin, and use `queryFn` to re-issue on every fetch, not cache indefinitely.
- Bucket policy check before shipping: ensure dashboard admins can read the TPC App photo bucket. Storage RLS policies are on `storage.objects` — read them explicitly; they're not covered by table RLS.
- Watch for cross-origin: Storage URLs are on `*.supabase.co`, dashboard is on `*.vercel.app` — signed URLs work cross-origin, but service-worker caching can bite.

**Warning signs:**
- Thumbnails load on first visit, 404 on tab-resume.
- Network tab shows a 403/401 from `*.supabase.co/storage/v1/object/sign/...`.
- Bucket RLS policies list includes only `owner = auth.uid()` but no admin path.

**Phase to address:**
**Mid** — TPC App activity tracking phase, specifically when photos are first surfaced. Any view that shows images is blocking-dependent on a decided URL strategy.

---

### Pitfall 8: Leftover v1 dashboard tables / migrations causing v2 confusion

**What goes wrong:**
v1 Phase 1 added 9 dashboard-owned tables (sales, sale_departments, departments, etc.) via migrations starting at `20260421000000`. The v1→v2 pivot note says these were "truncated + tables dropped." Inspecting current migrations: `20260421000000_create_updated_at_trigger.sql` and `20260421000006_rls_helper_functions.sql` remain; the create-sales/create-departments/etc. migrations are absent locally. **But the prod Supabase project may still have the dropped state already applied**, meaning a new dev cloning the repo and running `supabase db push` against a fresh project would get an *inconsistent* schema compared to prod.

Additionally, the `supabase_migrations.schema_migrations` table in prod tracks applied migrations — if prod has rows for migrations no longer present in the repo, `supabase db push` will complain or silently skip re-application.

**Why it happens:**
- Migration files were deleted locally (v1-reset commits) but the corresponding schema-migrations rows remain in prod.
- No "drop-unused-dashboard-tables" migration was added — tables were dropped manually, out-of-band.

**How to avoid:**
- **Audit migration history first**: query `select version, name from supabase_migrations.schema_migrations order by version`. List what prod thinks has been applied. Compare to the local `supabase/migrations/` directory.
- If divergence: add a **repair migration** that documents what was dropped manually (as a no-op IF NOT EXISTS sequence, or a `DO $$ ... $$` block that tolerates already-dropped state). Get the two in sync.
- For any v2 new dashboard-owned tables: use migration timestamps ≥ `20260424000000` so there's no ambiguity about pre- vs post-pivot.
- **Don't run `supabase db reset --linked`** (already banned in STATE.md) — but also don't rely on anyone being able to rebuild the schema from scratch until the repair migration ships.

**Warning signs:**
- `supabase db push` reports "nothing to apply" but the prod schema doesn't match expectations.
- `pg_tables` in prod includes tables (e.g., `sales`, `sale_departments`) that don't exist in the local migration files.
- A new dev can't reproduce the prod schema with `db push` against a fresh project.

**Phase to address:**
**Early** — first v2 schema phase. Treat it as "Phase 0: Repair schema-migration drift" before any new tables are added. One small migration that makes prod match the repo going forward.

---

### Pitfall 9: Service-role admin client pattern needs a new home (old home was deleted)

**What goes wrong:**
v1 placed the admin/service-role Supabase client in `scripts/lib/supabase-admin.ts`. The scripts directory is gone. The v2 scraper will need the same pattern (reading `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` or deploy secrets, never from `VITE_*` prefixed vars, never imported by frontend code). A fresh dev writes `import { createClient } from '@supabase/supabase-js'` directly in the scraper code, pulls the URL from the frontend env file, and the service role key leaks into the scraper's frontend bundle or the anon key ends up in the scraper (weaker than needed).

**Why it happens:**
- The "don't import supabase-admin from src/" convention was in a file that no longer exists.
- v2 has two contexts that need Supabase: the frontend (anon) and the scraper (service-role). Mixing them is a real risk.

**How to avoid:**
- Establish a **new location before the scraper phase**: e.g., `server/lib/supabase-admin.ts` or `scraper/lib/supabase-admin.ts`. Do **not** place it under `src/`. Add a lint rule or a comment banner that says "NEVER import this from src/."
- Add a build-time check: Vite's `build.rollupOptions.external` or a simple grep pre-commit hook that fails if `src/**` imports from `server/` or `scraper/`.
- Document the separation in CLAUDE.md → Conventions section as a first v2 convention.
- Scraper's deployment platform (Fly/Railway) stores `SUPABASE_SERVICE_ROLE_KEY` as a secret; frontend never sees it.

**Warning signs:**
- Any file in `src/` imports a module that reads `SUPABASE_SERVICE_ROLE_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` shows up in `dist/` after a frontend build.
- A single `lib/supabase.ts` file tries to conditionally pick anon vs service-role based on env — too easy to get wrong.

**Phase to address:**
**Mid** — before the scraper phase. The pattern should be established in whichever phase first needs non-frontend DB access (could be the scraper, could be an edge function for auth mapping assertions). Document as a convention in CLAUDE.md in the same phase.

---

### Pitfall 10: Scraper detection + blocking — minimum viable countermeasures for an admin-authorized scrape

**What goes wrong:**
Dashboard is scraping a site the user has a paid account on (RFC). Even with permission, stock Playwright trips anti-bot defenses (Cloudflare Bot Management, DataDome, PerimeterX). Two scenarios:
1. Session gets challenged with a CAPTCHA mid-sale — scraper blocks until timeout, data freezes, sale monitor notices 5 minutes later.
2. IP gets blocked — subsequent polls 403; user has to manually log in via browser to "re-warm" the IP; scraper restart doesn't fix it.

**Why it happens:**
Default Playwright exposes `navigator.webdriver = true`, identical TLS/fingerprint across sessions, no human-like mouse/keyboard patterns. Modern detection (2026) uses ML-trained behavioral models, not just the `webdriver` flag.

**How to avoid (for an admin-authorized scrape on a site with a paid account):**
- **Human-cadence polling first.** Poll every 3-5s minimum, with jitter (±20%). Not every 500ms. Auction sites update bids at human speed; sub-second polling is self-incriminating.
- **Use a real Chrome channel** (`launchOptions: { channel: 'chrome' }`) not Chromium — smaller fingerprint delta.
- **Reuse `storageState`** (persistent login) across scraper restarts. Logging in from scratch every 30 min is a red flag.
- **Add `playwright-extra` + `puppeteer-extra-plugin-stealth`** (or equivalent Playwright stealth). Understand this is a patch, not a fix — it hides the most obvious tells.
- **Do NOT** run headless if the site actively fingerprints headless (check early — headful mode runs fine on Railway/Fly with Xvfb).
- **Honor the site's natural pauses.** If the auction has no active bidding for 30s, don't poll at full cadence — match the site's activity level.
- Do **not** overload with concurrent contexts. One context, one page, one tab.
- **If challenged with CAPTCHA**: stop, surface "scraper needs re-auth" to the dashboard, wait for human intervention. Don't try to solve.
- **Watch the HTTP response codes** in the scraper: a 403 or a sudden 200-with-new-HTML (challenge page) means back off immediately.

**Warning signs:**
- Playwright `launchOptions` uses default headless without any stealth.
- Polling is sub-second or at a perfectly regular cadence (5.000s ± 0ms).
- No storageState reuse — scraper logs in from scratch every process start.
- Scraper ignores HTTP status codes from the navigation response.

**Phase to address:**
**Late** — scraper phase. Specifically: the *research/prototype* subphase before schema is locked, so the team can discover what RFC actually detects before committing to a cadence and a deploy model.

---

### Pitfall 11: TanStack Query + Realtime double-fetch / thrash pattern

**What goes wrong:**
Dev wires Supabase Realtime subscription → `queryClient.invalidateQueries(['live-sale-events'])` on every postgres change event. Under a burst (10 bid events in 1 second during a hot lot), the query refetches 10 times in 1 second, each refetch is a full SELECT with joins, UI re-renders 10 times, and the scraper's INSERT rate is echoed back as a client-side stampede.

**Why it happens:**
`invalidateQueries` triggers an immediate refetch for active queries. No default debounce. Fine at 1 event/min, a problem at 10 events/sec.

**How to avoid:**
- **Merge the realtime payload into the query cache directly** instead of invalidating: `queryClient.setQueryData(['live-sale-events'], old => [...old, newEvent])`. This uses the event payload you already have in hand — zero refetch.
- If you must invalidate (e.g., the UPDATE payload is incomplete): **debounce invalidation** to 1-2s using a simple timer (`setTimeout` that's cleared on each new event, or a `useDebouncedCallback`).
- Set `staleTime: 30000` on the query so that if invalidation fires, refetch happens lazily on focus rather than immediately.
- Consider **aggregation queries separately** from event-stream queries. The "latest lot" query can invalidate; the "all bid events in the last 5 min" query should merge.

**Warning signs:**
- Network tab shows N identical requests to the same query key within 1s.
- UI stutter / flicker during high-bid-activity lots.
- `ReactQueryDevtools` shows the same query flipping fetching → idle → fetching rapidly.
- React DevTools profiler shows dozens of re-renders per second.

**Phase to address:**
**Mid** — first phase that combines Realtime + TanStack Query. Establish the pattern (merge-not-invalidate + debounce) as a convention and document it.

---

### Pitfall 12: Defining live-sale schema before sale monitors see a prototype

**What goes wrong:**
Roadmap front-loads a "design live-sale schema" phase. Team designs `live_lot_events` with columns for hammer price, bidder count, lot number, timer state. Build the scraper to fill those columns. Ship to sale monitor. Monitor says "this doesn't tell me the signal I care about — I need to know when a lot is about to close without bids because that's when I pull it." Schema doesn't support that signal. Retrofitting requires new scraper parsing + new columns + replanning the UI.

**Why it happens:**
The "signals that matter during a live sale" are expert tacit knowledge. Dev writes the schema from the observable fields on the RFC page, not from the decisions a sale monitor actually makes. PROJECT.md already flags this ("bidding issues/anomalies — exact signals shaped with sale monitors during phase discuss").

**How to avoid:**
- **Earlier phases must not over-specify the live-sale schema.** Ship extension-analytics and TPC-App-activity views first (no monitor-input needed there — the tables exist, we're just reading them).
- For the scraper phase itself: Phase Discuss *precedes* Phase Plan. Sale monitor shadowing session or structured interview lives in Discuss. Only after that does schema get committed to a migration.
- **Store raw DOM/HTML snapshots in a `scraper_snapshots` table** during early scraper runs. If the initial schema misses a signal, the snapshots let you backfill parsing without re-running the sale.
- **Version the live-sale event schema**: `event_version int not null default 1`. Adding a new event type or signal bumps to 2; existing rows stay on 1. No big-bang migrations during a live UAT.

**Warning signs:**
- Live-sale schema migration lands before any sale-monitor conversation is documented in `.planning/`.
- Columns are named from RFC page fields ("hammer", "bid_count") with no columns for monitor-defined signals ("risk_flag", "close_without_bid_warning").
- No `scraper_snapshots` / raw-HTML capture table exists in the schema.

**Phase to address:**
**Early-to-mid decision** — the *roadmap ordering* pitfall. Put extension + app-activity phases ahead of scraper. Scraper phase's Discuss must include sale monitors.

---

## Moderate Pitfalls

### Pitfall 13: Extension `analytics_events` schema coupling across repos

**What goes wrong:**
Dashboard hardcodes an enum for the 5 event types (`catalog_single`, `catalog_batch`, `portal_upload`, `spreadsheet_transform`, `data_import`). Extension adds a 6th in v2.1. Dashboard Zod schema rejects the new rows; live feed breaks; error bubbles to users.

**How to avoid:**
- Parse `analytics_events.event_type` as `z.string()` with a soft-warn-on-unknown (log + surface in a "new event types" admin panel), not `z.enum([...])`.
- The dashboard owns neither the table's schema nor its event-type vocabulary. Any referenced enum is a dashboard-side display convenience, not a validation gate.
- Extension team owns the table migration; dashboard tracks the extension's migration log (link in CLAUDE.md Context section).

**Phase to address:** Extension-analytics phase.

---

### Pitfall 14: Scraper phase dependency on extension v2.0 shipping

**What goes wrong:**
Scraper phase is scheduled before extension v2.0 ships `analytics_events`. Extension slips; scraper blocks; whole milestone stalls.

**How to avoid:**
- Scraper and extension-analytics phases are independent. Sequence them so scraper can ship without extension shipping. Scraper reads/writes only dashboard-owned tables.
- Extension-analytics phase has a "gate": if `analytics_events` isn't in prod by phase start, this phase waits but doesn't block scraper.
- Surface the dependency in the roadmap's critical-path diagram so it's visible at a glance.

**Phase to address:** Roadmap / milestone planning.

---

### Pitfall 15: Package.json has no scraper or chart libraries — re-adding must match v1 versions

**What goes wrong:**
v1-reset pruned scraper/charting/table/PDF libs from package.json. v2 adds Playwright, Recharts, TanStack Table. A dev grabs `playwright@latest` without checking for peer conflicts, picks a Recharts major that's behind the v1 research, or accidentally re-adds pdf-parse / papaparse that v2 doesn't need.

**How to avoid:**
- CLAUDE.md "Recommended Stack" table is authoritative for v2 versions. Re-adding a library requires matching that table.
- Only add libraries the *current* phase needs. Don't pre-add "we'll probably need this."
- Lock Playwright version at install time — its browser binaries are version-pinned.

**Phase to address:** Each phase, when it adds its first library.

---

### Pitfall 16: Scraper cost sprawl on always-on infra

**What goes wrong:**
Scraper runs 24/7 on Fly/Railway at $5-15/mo, but auctions only happen ~2 days a week. 80% of compute is idle. Worse: a bug makes Playwright spawn a second browser; RAM doubles; auto-scales up; bill triples unexpectedly.

**How to avoid:**
- **Scraper is not always-on.** Start it only when a sale is scheduled. Vercel Cron or Supabase scheduled function triggers a "start-scraper" webhook that boots the Fly/Railway machine; scraper detects sale-end, calls a "stop-scraper" webhook.
- Or: use Fly Machines' `auto-stop` — machine spins down when idle, boots on HTTP. Cost ≈ sale-hours × rate, not 24/7.
- Set a **monthly budget alarm** at 2× expected spend. Railway/Fly both support this via billing alerts.
- One browser, one context, one page. Assert this in scraper startup logs.

**Phase to address:** Scraper phase — deploy sub-phase.

---

### Pitfall 17: Supabase Realtime quota surprises (peak concurrent connections)

**What goes wrong:**
Every admin's open tab + the scraper's backfill channel count as concurrent Realtime connections. Overage billed at $10 per 1000 peak connections. Small team means this is unlikely to bite, but tab-sprawl from a single admin with 5 dashboard tabs during a sale × 3 admins × reconnect-churn during flaky wifi can spike.

**How to avoid:**
- **One Realtime channel per page**, not per hook. Centralize channel lifecycle in a provider.
- Use `channel.unsubscribe()` on page unmount (React Strict Mode will double-fire — handle idempotently).
- Monitor peak concurrent count in Supabase's Realtime metrics panel; alert if approaching plan limit.

**Phase to address:** Mid — first Realtime phase. Centralize channel management as a convention.

---

### Pitfall 18: Silent Realtime disconnections during a long sale (wifi drop, tab backgrounded)

**What goes wrong:**
Supabase JS auto-reconnects with 1s/2s/5s/10s backoff, but during a long sale an admin backgrounds the tab (Chrome throttles timers) and never gets the `CLOSED` → `SUBSCRIBED` transition. Events during the outage are lost; UI shows stale state; admin never knows.

**How to avoid:**
- Listen for `channel.on('system', { event: '*' }, payload => ...)` and surface connection state in the UI (green dot / red dot).
- **On reconnect, invalidate + refetch** the relevant queries so the UI catches up with rows the subscription missed during the outage. Realtime gives you current changes only — not a replay.
- Visibility API: on `visibilitychange` to visible, refetch the "current state" queries (cheap, bounded).

**Phase to address:** Mid — Realtime integration phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Scrape only during a scheduled sale window (no auto-detect) | 1-2 days saved; no sale-schedule scraper needed | Requires operator to start/stop; forgotten sale = no data | v2 MVP. Upgrade to auto-detect in v2.1 only if drag on ops. |
| Hardcode "admin ids that can read" in an RLS policy instead of using `private.is_admin()` | Faster to ship for a 1-admin v2 | Breaks when second admin joins; duplicates TPC App's admin-list | Never — v1 already proved `private.is_admin()` works. |
| Read `analytics_events` directly from the dashboard instead of through a view | No view to maintain | Dashboard queries depend on extension's column names; extension rename breaks dashboard | OK for MVP; add a view layer if the extension schema starts churning. |
| Single Playwright context for the whole sale, no recycling | Simpler scraper code | Memory leak → OOM → missed bids | Never — the cost isn't worth the saved 50 lines. |
| Display scraper state as "live" without a staleness indicator | Cleaner UI | Sale monitor trusts stale data; bad decisions | Never. |
| Use frontend `new Date()` for "time ago" labels against a DB timestamp | Works most of the time | Clock drift breaks UX for ~5% of users | Never for live-sale data; acceptable for static historical data. |
| Delete v1 dashboard-owned tables out-of-band (no migration) | Quicker than writing a migration | Schema drift between dev and prod; `db push` reports nothing | Already happened — requires a repair migration in v2 Phase 0. |
| Ignore `storageState` / log in fresh every scraper restart | Simpler login flow | Increases anti-bot detection; doubles login-page load on RFC | Never for a multi-hour sale scraper. |
| Skip the scraper_heartbeats table; infer staleness from latest event row | One fewer table | Can't distinguish "no events" from "scraper dead" | Never — it's load-bearing for trust. |
| Put service-role admin client under `src/lib/` | No new directory structure | One careless import and service-role key ends up in the frontend bundle | Never. |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `analytics_events` (extension-owned, dashboard reads) | Alter existing anon INSERT policy to "also" allow admin SELECT | Add a **new** SELECT-only policy scoped to `authenticated` + `private.is_admin()`; leave INSERT policy untouched |
| `profiles` / `sessions` / `items` / `photos` (TPC App tables) | Dashboard writes to reflect "ai_status health fixes" or backfills | Dashboard is **read-only** against TPC App tables. Enforce via code-review convention; consider revoking INSERT/UPDATE/DELETE for `authenticated` on these if TPC App doesn't need them |
| Photo storage bucket (TPC App owns) | Dashboard displays photos with client-side-generated signed URLs cached forever | Use a short-TTL thumbnail proxy or re-sign on every query fetch |
| Supabase Realtime | Enable publication only, forget SELECT policy | Every table added to publication ships with a SELECT RLS policy in the same migration |
| Supabase Realtime + TanStack Query | `invalidateQueries` on every INSERT event | Merge payload via `setQueryData`; debounce invalidations if you must invalidate |
| Service-role client (for scraper writes) | Share a single `supabase.ts` between frontend and scraper, gated by env var | Separate `src/lib/supabase.ts` (anon) and `scraper/lib/supabase-admin.ts` (service role). Never cross-import. |
| `supabase db push` | Run against prod with local migrations that don't match applied migrations | Run a schema-migrations audit migration first; only use `db push`; `db pull` / `db reset --linked` are banned (STATE.md) |
| RFC scraper ↔ auth | Log in fresh every scraper restart | Reuse `storageState`; verify logged-in on every poll via DOM marker |
| Vercel Cron | Used to host the scraper itself (60s timeout, no browser binary) | Use Vercel Cron only to *trigger* a scraper on Fly/Railway; never to run Playwright directly |
| Scraper timestamps | Scraper writes `scraped_at: new Date().toISOString()` | Schema default `now()`; scraper omits the column |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Playwright context not recycled in long scrape | RSS growing monotonically; OOM after 3-4 hours | Recycle context every 30 min or 200 polls; memory cap + auto-restart | Multi-hour sales (every sale — this WILL bite) |
| Realtime → invalidateQueries thrash | UI stutter during active bidding; many identical refetches/sec | Merge realtime payloads with `setQueryData`; debounce invalidation | ≥ 5 events/sec (hot lots in a live sale) |
| Full-table SELECT for live feed on every render | Growing latency as `live_sale_events` grows | Server-side aggregates via RPC; add `sale_id` index; paginate with keyset | > 10k events in one sale (possible — bids are frequent) |
| Unindexed `analytics_events` queries | Extension-analytics views slow down as table grows | Add indexes on `(event_type, created_at)`, `(user_id, created_at)` on dashboard side if extension didn't; coordinate with extension team | > 100k events (months of extension use) |
| Pre-signed URLs cached by TanStack Query | 403s after tab resume | Short TTL + re-sign on fetch, or thumb proxy route | Any tab left open > signed-URL TTL |
| One Realtime channel per hook instance | Peak connection count scales with tabs × hooks | Centralize channel lifecycle; one channel per logical subscription | 5+ admins × multi-tab during sales |
| Scraper polls every second regardless of activity | Anti-bot block; wasted compute | Adaptive cadence (faster during active bidding, slower during idle) | First contact with RFC's anti-bot |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service-role key in the frontend bundle | Full DB access for any user who opens devtools | `SUPABASE_SERVICE_ROLE_KEY` without `VITE_` prefix; server-side only; pre-commit grep check |
| Signed URLs with 7-day expiry leaked in server logs | Long-lived public access to private photos | Short TTL (5-15 min); never log URLs at INFO level |
| RFC credentials stored in repo / env file committed | Credential theft; paid account compromise | Store in Fly/Railway secrets; never commit; `.env*` in `.gitignore` |
| `FORCE ROW LEVEL SECURITY` on tables with service-role writes | Breaks scraper writes (service-role usually bypasses RLS; `FORCE` makes it apply) | Do not use FORCE unless you understand the service-role interaction. Stick to plain `ENABLE ROW LEVEL SECURITY`. |
| Sharing dashboard Supabase anon key publicly thinking it's safe | Safe against RLS — but quota DDOS is real; anyone with the key can hammer `auth/v1` | Anon key is fine to ship client-side (it's the designed model); monitor auth quota; ban abusive IPs at Supabase level |
| Extension-analytics SELECT policy too permissive (e.g., `USING (true)`) | Any authenticated TPC App specialist could read all analytics events | Scope SELECT to `private.is_admin()` only |
| RFC scraper HTML snapshots contain full lot descriptions + bidder paddle numbers | Leaks buyer bid identity if that data lands unencrypted in a debug table | Scrub sensitive fields before storing snapshots; or encrypt at rest |
| Scraper logs include full page HTML on error | Credentials / session cookies leak to log sinks | Redact HTML in logs; save raw HTML to a separate table with RLS, not to stdout |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No staleness indicator on live views | Sale monitor trusts stale data; bad calls | Visible "last updated X seconds ago" + color-coded staleness |
| Spinner on every realtime update | Distracting flicker during active bidding | Subtle animation (pulsing border) or no visual during small updates; spinner only for full-page loads |
| "Live sale" view with no offline / disconnected state | User thinks they're watching live when they're watching frozen data | Banner: "Disconnected — last event at HH:MM:SS" when Realtime channel drops |
| Time displayed as "in 3 seconds" or "-5s ago" | Jarring; erodes trust | Clamp negatives to "just now"; always use server time for deltas |
| Mobile-first live-sale view | Cramped for a dashboard that's explicitly desktop-oriented (PROJECT.md) | Desktop-first layout; mobile-responsive but not optimized |
| Infinite-scroll of live events with no "jump to newest" | User scrolled up to read context, new events push the read area off-screen | Pin the newest-event area; provide "N new events" affordance |
| Scraper-status info buried in a settings page | Sale monitor doesn't know scraper is offline until they notice stale numbers | Top-bar scraper health indicator, always visible on live-sale pages |
| Timestamps in local time with no indicator | Remote team members see different timestamps for the same event | Display in sale-site timezone (likely ET for RFC Alexandria VA) with explicit TZ suffix |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Realtime subscription wired:** Often missing the SELECT RLS policy for the subscribing role — verify event fires end-to-end with two clients.
- [ ] **`ALTER PUBLICATION` migration shipped:** Often missed for newly-added tables — verify `pg_publication_tables` lists the table.
- [ ] **Scraper runs in prod:** Often missing the context-recycle loop and memory cap — verify RSS stays flat over a 2-hour synthetic run.
- [ ] **Live-sale page shipped:** Often missing scraper_heartbeat + staleness banner — verify disconnecting the scraper shows a red banner within 60s.
- [ ] **Admin SELECT policy added to `analytics_events`:** Often the existing anon INSERT policy gets modified by accident — verify extension writes still work post-migration.
- [ ] **Photo thumbnails render:** Often pre-signed URLs expire on tab resume — verify after 2 hours.
- [ ] **Scraper re-auths on session expiry:** Often the initial login works but no re-auth path — verify after a 4-hour synthetic session.
- [ ] **Cost cap in place:** Often the scraper runs 24/7 by default — verify billing projection for a month matches expected sale-hours.
- [ ] **Service-role key isolation:** Often the admin client sneaks into a shared lib — verify `grep -r SUPABASE_SERVICE_ROLE_KEY src/` returns nothing.
- [ ] **Schema-migration parity:** Often prod has rows in `schema_migrations` that don't exist locally — verify `supabase db push` against a *fresh* project reproduces prod schema.
- [ ] **Sale-monitor input captured:** Often the live-sale schema is locked before monitor shadowing — verify Discuss phase doc references specific monitor quotes.
- [ ] **Reconnect UX:** Often the "you lost connection" banner isn't there — verify by killing wifi during a test sale.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Broke extension writes via RLS policy change | LOW if caught in staging; HIGH if live | Revert the migration; re-deploy; post-mortem. Keep a "current policies snapshot" comment in every RLS migration to make reverts trivial. |
| Realtime subscriptions silent in prod | LOW | Add SELECT policy; add table to publication; redeploy. No data loss. |
| Scraper OOM mid-sale | MEDIUM | Process restart from last saved `storageState`; backfill missing window from `scraper_snapshots` if raw HTML was captured; annotate live-sale data with a "scraper gap" event. If no snapshots → data loss for the window. |
| Scraper IP-blocked by RFC | HIGH | Stop scraping immediately (don't burn further goodwill); contact RFC; consider proxy rotation for future sales (last resort — adds complexity + legal surface). |
| Signed URL cache expiry causes widespread 404s | LOW | Deploy thumb proxy route; clear frontend cache; TanStack Query cache is per-session so most users fix on refresh. |
| Clock skew showed future timestamps | LOW | Switch to server-issued timestamps; clear frontend cache; document skew handling convention. |
| v1 dashboard tables still in prod but not in local migrations | LOW-MEDIUM | Write "repair migration" that explicitly drops with `IF EXISTS`, document in PR what was dropped manually. Matches dev-prod going forward. |
| Service-role key leaked in frontend bundle | HIGH | Rotate the service-role key in Supabase immediately; redeploy frontend; audit git history; consider secret scanning on pre-commit going forward. |
| Polling cadence tripped anti-bot block | MEDIUM | Pause scraper; switch to slower cadence + jitter; reuse storageState; prototype from a residential IP before re-attempting prod. |
| Live-sale schema wrong after monitor input | MEDIUM | `event_version` column lets you add new event types alongside v1; don't drop old rows. Retrofit UI to handle both versions. |
| Missed sale due to scraper not started | HIGH (data gone) | No recovery — the bids happened, they're not replayable. Process fix: auto-trigger scraper from a calendar feed or sale-list scrape. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Phases are illustrative — exact numbering owned by gsd-roadmapper.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. `analytics_events` SELECT policy breaks anon INSERT | Extension-analytics phase (mid) | Test extension insert after migration; dump `pg_policies` diff in PR |
| 2. Realtime fires nothing without SELECT policy | Each phase that adds realtime (mid–late) | Two-client E2E test: subscriber fires on publisher's INSERT |
| 3. Playwright long-run bloat | Scraper phase (late) | 2-hour synthetic run with flat RSS; context-recycle counter logged |
| 4. Stale-data hazard | Live-sale schema phase (mid) | `scraper_heartbeats` table exists; UI banner flips red within 60s of scraper kill |
| 5. Clock skew | Live-sale schema phase (mid) | No INSERT in the codebase provides `scraped_at`; all from `default now()` |
| 6. Auth mapping TPC App ↔ dashboard | First TPC-App read phase (early) | "Who am I" assertion RPC returns `is_admin=true` + matching `profile_exists` for each admin |
| 7. Signed URL expiry | TPC-App activity phase when photos first rendered (mid) | 2-hour tab-resume test; thumbnails still load |
| 8. v1 dashboard tables leftover | Phase 0 repair (very early) | `supabase db push` against fresh project reproduces prod schema |
| 9. Service-role client home | Scraper phase or earlier (mid) | Pre-commit grep: no `SUPABASE_SERVICE_ROLE_KEY` references under `src/` |
| 10. Scraper anti-bot detection | Scraper research subphase (late) | Headful prototype completes 1-hour run without challenge; storageState reuse confirmed |
| 11. TanStack Query + Realtime thrash | First realtime phase (mid) | Network tab shows no refetch stampede during burst test |
| 12. Schema locked before monitor input | Roadmap ordering | Scraper Discuss doc references monitor quotes; no live-sale migrations before Discuss |
| 13. Extension schema coupling | Extension-analytics phase | Dashboard parses event_type as string with warn-on-unknown |
| 14. Scraper depends on extension shipping | Roadmap ordering | Scraper phase has no extension-schema dependency in its plan |
| 15. Package.json re-adds | Each phase that adds libs | Version matches CLAUDE.md stack table |
| 16. Scraper cost sprawl | Scraper deploy subphase (late) | Scraper auto-stops when no sale active; monthly billing projection documented |
| 17. Realtime peak connections | Mid | Centralized channel provider; peak connection metric below plan limit |
| 18. Silent Realtime disconnections | Mid | Connection-state indicator in UI; refetch-on-reconnect wired |

---

## Sources

Verified official docs + community posts. Confidence annotations per source.

- [Supabase Docs — Realtime Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — HIGH — authoritative on publication + RLS interaction
- [Supabase Docs — RLS Simplified troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8) — HIGH
- [Supabase Docs — Realtime Limits / Peak Connections](https://supabase.com/docs/guides/realtime/limits) — HIGH
- [Supabase Docs — Realtime Pricing (overage $10/1000 peak connections)](https://supabase.com/docs/guides/realtime/pricing) — HIGH
- [Supabase Docs — Handling Silent Disconnections](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) — HIGH
- [Supabase Docs — Automatic Retries in supabase-js](https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js) — HIGH
- [realtime-js RealtimeClient source (exponential 1s/2s/5s/10s backoff)](https://github.com/supabase/realtime-js/blob/master/src/RealtimeClient.ts) — HIGH
- [Supabase Discussion #35196 — Realtime silent when RLS enabled without SELECT](https://github.com/orgs/supabase/discussions/35196) — HIGH (problem pattern confirmation)
- [Supabase Docs — Storage Access Control + Signed URLs](https://supabase.com/docs/guides/storage/security/access-control) — HIGH
- [Supabase Storage — Create Signed URL JS reference](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — HIGH
- [Playwright GH Issue #15400 — memory leak in long sessions](https://github.com/microsoft/playwright/issues/15400) — MEDIUM (community report of 400MB / 20min)
- [WebScraping.AI — Playwright memory management in long sessions](https://webscraping.ai/faq/playwright/what-are-the-memory-management-best-practices-when-running-long-playwright-sessions) — MEDIUM
- [AlterLab — Playwright Anti-Bot Detection 2026](https://alterlab.io/blog/playwright-anti-bot-detection-what-actually-works-in-2026) — MEDIUM (stealth-plugin patches are incomplete in 2026)
- [BrowserStack — How to avoid bot detection with Playwright](https://www.browserstack.com/guide/playwright-bot-detection) — MEDIUM
- [Railway Docs — Serverless sleep after 10 min idle](https://docs.railway.com/platform/compare-to-fly) — MEDIUM
- [Fly.io Pricing — pay-per-use Machines](https://fly.io/pricing/) — HIGH
- [Makerkit — Supabase + TanStack Query pattern](https://makerkit.dev/blog/saas/supabase-react-query) — MEDIUM
- [Nextbase — Handling Realtime Data With Supabase + TanStack Query](https://www.usenextbase.com/docs/v2/guides/handling-realtime-data-with-supabase) — MEDIUM
- Codebase inspection (confidence HIGH for v1→v2 transition claims):
  - `C:/Users/maser/Projects/tpc-dashboard/supabase/migrations/` — current migration list (only `_create_updated_at_trigger` + `_rls_helper_functions` from 20260421)
  - `C:/Users/maser/Projects/tpc-dashboard/package.json` — no Playwright / Recharts / TanStack Table / pdf-parse / papaparse / @react-pdf/renderer remain
  - `C:/Users/maser/Projects/tpc-dashboard/src/` — v2 shell only (Home, Login, auth guard components, tests for those)
  - `.planning/PROJECT.md` + `.planning/STATE.md` + `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — pivot context

---

*Pitfalls research for: TPC Dashboard v2.0 Live Ops*
*Researched: 2026-04-24*
