# Feature Research — v2.0 Live Ops

**Domain:** Live-ops + team-productivity monitoring dashboard for a small auction-house team (admin-only, Supabase-backed, desktop-first)
**Researched:** 2026-04-24
**Confidence:** MEDIUM-HIGH (patterns for each of the three capabilities are well-established; specific signals for capability C depend on RFC page structure TBD in scraper phase)

---

## Scope Note

Three capability clusters, researched and scoped independently. Every feature is tagged:
- **Capability**: A (TPC App activity) / B (Extension analytics) / C (Live RFC sale)
- **Complexity**: S (≤1 day) / M (2–4 days) / L (5+ days or needs a phase of its own)
- **Deps**: Other features that must precede it
- **Unknown-blocked**: Whether it's gated on TBD info (marked ⚠️)

The **audience is one person** — the TPC ops manager. Team is 2–10 total. That changes the math: no multi-tenant, no per-manager views, no role hierarchy, no ticketing. "Glance-and-go" visualizations beat deep multi-level drilldowns.

---

## Capability A — TPC App Activity Tracking

Admin sees what specialists are doing day-to-day in the voice cataloger: active sessions, throughput per person, item backlog health (AI status), export pipeline progress, photo coverage.

### A. Table Stakes

| ID | Feature | Why expected | Complexity | Deps | Notes |
|----|---------|--------------|------------|------|-------|
| A-TS-1 | **"Today" KPI strip** at top of App Activity view: sessions created today, items created today, items exported today, % items with AI `done` status | Every ops dashboard opens with a numeric strip. Answers "is anyone working right now?" in one glance. | S | — | 4–6 big-number cards, compare-to-yesterday delta (▲ 12% vs yesterday). Query: simple `count()` with `created_at > today`. |
| A-TS-2 | **Sessions in progress** table (status=`active`): session name, mode (house/sale), assigned_to display_name, item count, created_at, last-updated-at, age | "Who is working on what right now" is the single most-common question. | S | — | TanStack Table, sortable by age + assigned_to. Click row → Session Detail drawer. |
| A-TS-3 | **Items per specialist per day** stacked bar (last 14 days, x=day, y=item count, stack=specialist) | Standard team-throughput chart; answers "who's carrying the load this week". | S | — | Recharts `<BarChart>` with `<Bar stackId="a">` per specialist. Colors from a fixed palette keyed by profile.id. |
| A-TS-4 | **AI status health** donut (pending / processing / done / failed / queued) sized over the last 7 days of items | Failed/stuck AI items are the #1 silent failure; admin needs visible proof the AI pipeline is healthy. | S | — | Recharts `<PieChart>`, innerRadius for donut. Alert color (red slice) if `failed > 0`. |
| A-TS-5 | **Export pipeline** counts: sessions by status (`active` / `submitted` / `returned` / `exported`) as horizontal stacked bar | Mirrors the funnel the team actually operates on. Answers "what's stuck in review?". | S | — | Single row of stacked bar, 4 segments. Click segment → filtered sessions list. |
| A-TS-6 | **Session detail drawer / route**: session metadata (name, mode, status, notes, review_notes, assigned_to, created_by, timestamps) + item list (receipt_number, title, ai_status, photo_count, sort_order) | Drilldown is the #1 expected interaction once a user sees an interesting row. | M | A-TS-2 | Route: `/app/sessions/:id`. Item table shows status pills + thumbnail count. Read-only (no edits). |
| A-TS-7 | **Date-range filter** (Today / 7d / 30d / custom) scoped to the whole App Activity view | De facto standard filter. Without it every chart is useless. | S | — | URL-state filter (`?range=7d`), propagates to all queries. Reusable `<DateRangeFilter>` component. |
| A-TS-8 | **Specialist filter** (multi-select from `profiles` where role=`specialist` and is_active=true) | Lets admin isolate one person's activity for a 1:1 or review. | S | A-TS-7 | Multi-select dropdown; empty = all. |
| A-TS-9 | **Mode filter** (house / sale / all) | The team treats house and sale sessions differently (house = routine intake, sale = deadline-driven). | S | A-TS-7 | Segmented control. |
| A-TS-10 | **Photo coverage** per session in Session Detail: items with ≥1 photo vs items with 0 photos, upload_status breakdown (pending/uploading/uploaded/failed) | Photos uploading via mobile is failure-prone; ops needs to see stuck uploads. | S | A-TS-6 | Small bar chart in session drawer + a "failed uploads" callout if any. |

### A. Differentiators

| ID | Feature | Value | Complexity | Deps | Notes |
|----|---------|-------|------------|------|-------|
| A-DF-1 | **Specialist activity heatmap** (7×24 grid, rows=day-of-week, cols=hour, cell intensity = items cataloged, filterable per specialist) | Reveals working patterns (someone crunches Sunday nights, someone only works mornings). Useful for capacity planning and spotting unusual quiet periods. | M | A-TS-3 | Grid heatmap, one grid per specialist OR aggregate. Recharts doesn't ship a heatmap — use `<div>` grid with Tailwind + computed opacity. |
| A-DF-2 | **Per-specialist sparkline row**: for each specialist, show a 14-day items-per-day sparkline next to name + 14-day total | "At-a-glance team roster" block. Replaces the need to eyeball a stacked bar for per-person trends. | M | A-TS-3 | Small multiples layout; Recharts `<LineChart>` at fixed small size, no axes. |
| A-DF-3 | **Stuck-item alert card**: items where `ai_status in ('processing','queued')` AND `created_at > 2h ago` — surfaced as a single callout with count + link to filtered item list | "Observability" pattern — make failures impossible to miss. Small team means alert noise tolerance is low, but stuck AI items matter. | S | A-TS-4 | Hardcoded threshold to start; tune later. Red border card with count. |
| A-DF-4 | **House-vs-sale split** pie or pair of KPIs showing session/item distribution over the selected range | Answers "are we doing enough sale prep vs house intake?" — a planning question only this team has. | S | A-TS-9 | Two KPI cards OR a small pie. Low implementation cost. |
| A-DF-5 | **Session age distribution**: histogram of `now - created_at` for active sessions (buckets: <1h, 1–4h, 4h–1d, 1–7d, >7d) | Reveals sessions that have been "open" for days without progressing. | S | A-TS-2 | Small bar chart. Red bucket for `>7d`. |
| A-DF-6 | **Export history table**: recent exports with session_name, mode, item_count, exported_at, exported_by | Audit trail without leaving the dashboard. | S | — | Simple table reading `export_history`. Date filter + optional "by user" filter. |

### A. Anti-Features

| Feature | Why tempting | Why avoid | Alternative |
|---------|--------------|-----------|-------------|
| **Per-specialist daily/weekly quotas with goal lines on charts** | "Gamify productivity" is a common dashboard trope | Team of 5 with known names; quotas feel like surveillance, damage trust, and the data is noisy enough that a "miss" is meaningless. Call-center research notes this actively contributes to burnout. | Show throughput trend without a target line. If ops manager wants to set a personal goal, they can eyeball the chart. |
| **Leaderboards / ranked specialist lists** | "Who's #1 today" is an easy feature | Same reason — 5 people, they know each other, competition is toxic at this scale. | Roster view sorted alphabetically OR by last-activity time. |
| **Notifications / email alerts / Slack integration for team events** | "Real-time ops" sounds like it needs push notifications | Ops manager is already in the app. Adds infra (SMTP, Slack webhook, quiet hours). Dashboard is a desktop tab they leave open — that's the notification channel. | In-app red-badge indicators + stuck-item callout (A-DF-3). |
| **User management UI** (add/remove specialists, change roles) | Admin dashboards often ship with CRUD over users | Writing to `profiles` would duplicate logic the TPC App owns. Milestone says read-only. | Direct Supabase table editor (for the one admin) if they ever need it. |
| **1-second auto-refresh on every chart** | "Live dashboard" implies live-updating | App activity isn't live-ops scale — cataloging events are minute-scale, not second-scale. Auto-refresh every 5 min is plenty. Over-refreshing hits Supabase read quota. | TanStack Query `staleTime: 5min` on App Activity views. Live polling only for capability C. |
| **Per-item edit history / revision log** | "Audit trail" sounds important | TPC App owns the source of truth; history tracking would require triggers we don't own. | Trust TPC App's internal state. |
| **Anomaly detection ("item rate down 40% this week!")** | ML-flavored, sounds smart | Data volume too low for reliable anomaly detection on a 5-person team. Will trigger false positives every holiday. | Surface raw 7d-vs-prior-7d delta on KPI cards; admin interprets it. |

---

## Capability B — Extension Workflow Analytics

Admin sees usage of the 5 extension event types (W1–W5) — volume, errors, per-user usage, and a live event feed.

### B. Table Stakes

| ID | Feature | Why expected | Complexity | Deps | Notes |
|----|---------|--------------|------------|------|-------|
| B-TS-1 | **Event volume by type** stacked bar (last 14d, x=day, y=count, stack=event_type) | Standard product-analytics opener. Shows which workflows actually get used. | S | — | Same Recharts pattern as A-TS-3, just stacked by `event_type` instead of specialist. |
| B-TS-2 | **Event type breakdown cards**: one KPI card per event type (catalog_single, catalog_batch, portal_upload, spreadsheet_transform, data_import) showing count (selected range) + delta vs previous range + tiny sparkline | "Table stakes" for 5 distinct event types with shared schema — 5 cards is the canonical layout. | M | — | Grid of 5 cards. Each is a mini-dashboard. Re-used sparkline component from A-DF-2. |
| B-TS-3 | **Error rate** per event type: horizontal bar showing `(events with error_message IS NOT NULL) / total` as % per event_type, over the selected range | Errors are the #1 actionable insight from event data. Must be surfaced at the top. | S | — | Red-tinted bar chart. Sort desc so noisiest workflow is on top. |
| B-TS-4 | **Per-user usage** table: rows=user_email, cols=event counts per type + error count + last-seen-at | "Who's using what" answers support and rollout questions. | S | B-TS-1 | TanStack Table. Sort by total events or last-seen. |
| B-TS-5 | **Recent errors** table: timestamp, user_email, event_type, error_message, extension_version, "view payload" button | Triaging errors needs the full payload accessible, not just the count. | S | — | Table at bottom of view. Click "view payload" → modal with pretty-printed JSON of `items_content`. |
| B-TS-6 | **Payload viewer modal**: pretty-printed JSON of the event's `items_content` + event-type-specific fields (e.g. W2 shows `session_id`, `total_items`, `cancelled`) | Payload inspection is the standard drilldown pattern in product analytics tools. | S | B-TS-5 | Simple JSON pretty-print component. Copy-to-clipboard button. |
| B-TS-7 | **Extension version filter + display**: multi-select of `extension_version` values + chart showing usage by version over time | Rollout tracking — essential when a new extension version ships. | S | B-TS-1 | Multi-select dropdown. Small "current dominant version" badge at top. |
| B-TS-8 | **Date-range + user filter** at the top of Extension Analytics view (same pattern as A-TS-7/A-TS-8 but scoped to `user_email` not `profiles.id`) | Filtering is non-negotiable. | S | — | Reuses `<DateRangeFilter>`; user filter pulls distinct `user_email` values. |

### B. Differentiators

| ID | Feature | Value | Complexity | Deps | Notes |
|----|---------|-------|------------|------|-------|
| B-DF-1 | **Live event feed** (tailing `analytics_events`, polls every 5–10s, newest on top, auto-scroll unless user scrolled up): compact row per event with timestamp, user_email, event_type badge, success/error indicator, 1-line summary | Small team visibility — admin sees extension activity happen live, which builds trust in both the extension and the dashboard. **Not decoration for this audience**: 5 users means feed is slow enough to be readable. At 500 users/hour this would be noise. | M | B-TS-1, B-TS-6 | Virtualized list (react-virtual) or cap at 100 rows. Click row → payload viewer (B-TS-6). Pause button. Polling via TanStack Query with `refetchInterval`. |
| B-DF-2 | **Batch performance view** (W2 catalog_batch specific): scatter or table of `execution_time_ms` vs `total_items`, colored by success vs error | W2 is the workflow most likely to have performance problems (runs over hundreds of items). Surfaces slowdowns. | M | B-TS-1 | Recharts `<ScatterChart>` OR a sortable table. Start with table — scatter adds polish but same info. |
| B-DF-3 | **Success/skip/error funnel** per batch workflow (W2, W3, W5): stacked bar of `success_count` / `skipped_count` / `error_count` summed over range, split by event_type | Batch workflows all share the success/skip/error pattern; a unified view makes them comparable. | S | B-TS-1 | Single grouped stacked bar. Good candidate for the top of the page. |
| B-DF-4 | **W1 catalog_single breakdown**: bar charts of top `category_id`, `detection_method`, `field_mode` distributions; summary stats on `photo_count` | W1 is the highest-volume event type; slicing by its own fields is the highest-yield drilldown. | M | B-TS-1 | 3–4 small bar charts in a grid. |
| B-DF-5 | **Per-user detail route** `/extension/users/:email`: all events for that user, sparkline of activity, per-event-type breakdown, recent errors | Natural drilldown from B-TS-4 (click user). | M | B-TS-4, B-TS-5 | Reuses most existing components filtered by user_email. |
| B-DF-6 | **"Cancelled" tracking**: for W2 and W3 which have a `cancelled` boolean, a small KPI showing cancellation rate | Cancellation is a usability signal (user gave up partway) distinct from an error. | S | B-TS-1 | Two small KPI cards. |

### B. Anti-Features

| Feature | Why tempting | Why avoid | Alternative |
|---------|--------------|-----------|-------------|
| **Retention / cohort analysis** (D1, D7, D30 retention) | Standard product-analytics feature | 5-user tool. N=5 makes every retention number meaningless noise. | Just show "active users this week" as a count. |
| **Funnel builder UI** (drag-drop events to build a funnel) | Mixpanel-style flex | Event types are heterogeneous (not a single user journey); funnels don't map to this data. Also: 5 users, no analyst on staff to build funnels. | Hardcode the 3 funnels that matter (W2/W3/W5 success-skip-error — covered by B-DF-3). |
| **SQL query builder / custom report editor** | "Empower admin to explore" | Admin is non-technical. They'll use the Supabase SQL editor if they need that. | Fixed set of curated views; add new ones on request. |
| **Alerting on error rate thresholds** | "Ops dashboard needs alerts" | Same reasoning as A — admin watches the dashboard. Adds infrastructure for zero new value. | Red-tinted KPI cards when error rate > threshold, visible on load. |
| **Session replay / user recording** | Product-analytics table stakes for consumer apps | Extension runs in users' browsers; recording would be invasive + need consent + need infra. | Payload viewer (B-TS-6) is the equivalent here. |
| **A/B test analysis** | Common analytics feature | Not applicable — one extension version at a time, no split-testing infra. | — |

---

## Capability C — Live RFC Sale Monitoring

Admin watches the auction floor live (during a ~10-min peak-attention sale) and reviews outcomes after. Major unknowns ⚠️ tied to RFC page structure — exact signals finalized in scraper phase discuss.

### Dashboard mode distinction

| Mode | Trigger | What's shown | Scraper state |
|------|---------|--------------|---------------|
| **Active sale** | Scraper detects a live sale in progress (or admin manually starts monitoring) | Big-format "live view" with current lot, bid activity, pace, issues | Polling at 1–10s cadence |
| **Between sales** | No active sale detected | History + past-sale summaries + scraper health | Scraper idle or doing sparse heartbeat |

### C. Table Stakes

| ID | Feature | Why expected | Complexity | Deps | Notes |
|----|---------|--------------|------------|------|-------|
| C-TS-1 | **Current lot card** (active-sale mode): lot number, lot title, current bid, bid source (online / room / phone if exposed), time-on-lot timer, department/category | Every auction operations console leads with "what's happening right now". This is the #1 signal. | M ⚠️ | Scraper emits lot-level events | Big card top of page. Pulls latest row from lot-state table. Polls every 2–5s. Depends on which fields RFC exposes. |
| C-TS-2 | **Sold/passed running totals** (active-sale mode): KPI strip — lots sold, lots passed, total hammer, sell-through % | Every auctioneer and ops manager wants to see these numbers during and after a sale. Standard live-auction metric set. | M ⚠️ | C-TS-1 | 4 KPI cards. Data from dashboard-owned aggregates updated as scraper writes events. Depends on RFC exposing hammer + sold/passed signal. |
| C-TS-3 | **Lots-per-hour pace** gauge or single-number (active-sale mode) with typical-range annotation (industry pace: 60–200 lots/hr) | Pace is the single most-asked question during a sale — too fast = bidders can't keep up, too slow = sale runs past scheduled end. | S | C-TS-1 | Single stat card with sparkline of last 30 min. Compute from `lots_done / elapsed_time`. |
| C-TS-4 | **Recent-lots table** (active-sale mode): last 20 lots with lot#, title, hammer, sold/passed, duration | Supplements the "current lot" card — shows the tail so admin can see trends without scrolling. | S | C-TS-1 | TanStack Table, newest on top. Auto-refresh at same cadence as current-lot card. |
| C-TS-5 | **Scraper health indicator** (both modes): green/yellow/red pill with "last successful scrape: X ago" + latency stat | "Observability answers whether the data reflects reality" (industry standard for scraper dashboards). Without this, admin can't trust any of the live data. | S | Scraper heartbeat table | Top-right global indicator. Red if >60s since last scrape during active sale. Click → detail page with scraper history. |
| C-TS-6 | **Issues / anomalies feed** (active-sale mode): timestamped list of detected issues: scraper offline, lot stalled (>2 min on same lot), lot skipped (non-sequential jump), unusual hammer (e.g. far below estimate if estimate is available) | "Detect unusual bidding activity patterns that might indicate problems during live bidding" — industry table-stakes. Exact signal set depends on which anomalies are detectable from RFC's public UI. | L ⚠️ | C-TS-1, C-TS-5 | Dedicated panel. Event-stream table. **Specific anomaly definitions TBD in discuss phase with sale monitors** — start with 3 (scraper-down, lot-stalled, lot-skipped). |
| C-TS-7 | **Past-sales list** (between-sales mode): table of historical sales the scraper has captured, with date, duration, lots_total, sell-through %, total hammer | "Between sales" needs content. This is the entry point to post-sale review. | S | Sale-level aggregate table | TanStack Table. Click row → C-TS-8. |
| C-TS-8 | **Post-sale summary view**: for a selected past sale — duration, lots total / sold / passed / withdrawn, sell-through %, total hammer, lots-per-hour average, anomaly summary | "Clear insights to improve future auctions" (standard in auction software). | M ⚠️ | C-TS-7 | Single-page summary. Depends on what data the scraper captured. |
| C-TS-9 | **Lot-by-lot replay**: paginated table of every lot in a past sale — lot#, title, hammer, sold/passed, time-on-lot, anomalies | Standard post-auction review artifact. | M ⚠️ | C-TS-8 | TanStack Table with filters (sold vs passed, department). CSV export. |
| C-TS-10 | **Dedicated `/live` route** (active-sale mode UI) that is admin-recognizable and bookmarkable | Clean separation from activity/extension analytics. Industry convention: live-bidding consoles are their own screen. | S | C-TS-1 | Route: `/live`. In between-sales mode, shows "No active sale — last sale finished X ago" + link to past-sales list. |

### C. Differentiators

| ID | Feature | Value | Complexity | Deps | Notes |
|----|---------|-------|------------|------|-------|
| C-DF-1 | **Auto-surface `/live` when scraper detects sale start**: either a banner on all routes ("Live sale in progress — click to open") or a redirect prompt | Small team, and peak attention is narrow (~10 min). Making it one click instead of buried-in-a-menu is cheap and high-value. Don't force-redirect — offer. | S | C-TS-1, C-TS-10 | Global banner component reading a "sale active" flag from scraper state. |
| C-DF-2 | **Bid velocity chart** (active-sale mode): line chart of bids-per-minute over last 30 min | "Bid velocity" is cited as a core live-auction metric. Shows pace + engagement trend during the sale. | M ⚠️ | C-TS-1 | Depends on whether RFC exposes per-bid events or only final hammer. If only hammer: repurpose as "lots per 5-min bucket". |
| C-DF-3 | **Department / category pace breakdown** (active-sale mode): small stacked area of lots sold per department over elapsed time | Answers "are we through the jewelry section yet" — a planning question real auction-room managers ask. | M ⚠️ | C-TS-1 | Depends on whether lots carry department/category on the RFC page. |
| C-DF-4 | **Hammer vs estimate** comparison (post-sale mode): scatter plot of hammer vs low-estimate per lot, with reference line at 1:1 | "Comparison to estimate" is a classic post-sale review. Sets expectations for future sales. | M ⚠️ | C-TS-9 | Only feasible if estimates are visible in the RFC auction UI (uncertain). If not → drop this feature and note in PITFALLS. |
| C-DF-5 | **Anomaly history** (between-sales mode): all anomalies across all past sales, filterable by type, clickable to the sale they occurred in | Retrospective tool — "do we always have scraper dropouts at 3 pm?" | S | C-TS-6 | Table view filterable by anomaly type and date range. |
| C-DF-6 | **Live-view dark/high-contrast mode** (active-sale mode): larger fonts, higher contrast, fewer decorations — suitable for displaying on a secondary monitor during a sale | Live-auction rooms often have a shared monitor. A few minor CSS tweaks can make the `/live` route usable for that. | S | C-TS-1 | `?display=wall` query param → swap to a larger-font layout. |
| C-DF-7 | **Manual sale-start/stop controls** (admin-only): override to tell dashboard "treat next N minutes as active sale" even if scraper hasn't auto-detected | Scraper auto-detection will be imperfect in early iterations. Escape hatch. | S | C-TS-10 | Two buttons on `/live` route. Writes to scraper control table. |
| C-DF-8 | **Sale comparison**: side-by-side KPIs of two past sales (total hammer, sell-through %, lots, duration) | Lightweight version of the pattern from v1.0 (retired). Useful once 3+ sales captured. | M | C-TS-7 | Two dropdowns → two KPI columns. Pairs with sparse data — only ship after capturing several sales. |

### C. Anti-Features

| Feature | Why tempting | Why avoid | Alternative |
|---------|--------------|-----------|-------------|
| **Bidder identity / personal-details display** | "Know who's bidding" | Explicitly out of scope per PROJECT.md. RFC UI exposes aggregate bid state only. Storing bidder PII creates compliance + trust issues. | Show aggregate counts only — "3 online bidders active" if RFC exposes a count. |
| **Placing bids or controlling the auction from the dashboard** | "Full operations console" ambitions | RFC is a third-party site. We scrape it, we don't drive it. Any write-back opens a legal and safety problem. | View-only. Always view-only. |
| **Sub-second polling / true streaming** | "Real-time" sounds cool | RFC will rate-limit or IP-ban aggressive scrapers. 1–10s is the realistic window. PROJECT.md already decides this. | Polling cadence 1–10s tuned in scraper phase. |
| **Predictive "will this lot meet estimate?" ML** | Trendy | Data volume too small, signal too noisy, and estimate data may not even be reliably scrapable. Reputation cost of being wrong. | Show the raw signal (hammer, estimate if available) and let ops manager judge. |
| **Multi-sale-at-once tracking** | "Scale" | RFC runs one sale at a time for TPC. Overengineering. | Single active sale assumed. Schema can allow multiple but UI treats one. |
| **Public-facing "sale stats" sharing** | "Marketing analytics" | Admin-only scope. Mixing audiences = complicates RLS, creates pressure to polish visuals. | Admin-only; if marketing wants data, CSV export. |
| **Full bid history with bidder IDs stored in our DB** | "Complete audit trail" | RFC owns the audit trail. Storing aggregate lot state is sufficient; per-bid user records bloat + create PII risks. | Store lot-level snapshots: {lot#, current_bid, timestamp} and issue events. Skip per-bid-event storage unless RFC exposes it cleanly and we have a clear use. |

---

## Feature Dependencies

```
Capability A (App Activity)
   A-TS-7 (date filter) ─┬─> A-TS-3 (items/specialist stacked bar)
                         ├─> A-TS-8 (specialist filter)
                         └─> A-TS-9 (mode filter)
   A-TS-2 (active sessions) ──> A-TS-6 (session detail) ──> A-TS-10 (photo coverage)
   A-TS-3 ──enhances──> A-DF-1 (heatmap), A-DF-2 (sparkline row)
   A-TS-4 (AI donut) ──enhances──> A-DF-3 (stuck alert)

Capability B (Extension Analytics)
   B-TS-8 (date/user filter) ──> all B charts
   B-TS-1 (event volume stacked) ──> B-TS-2 (cards), B-DF-1 (live feed), B-DF-2 (batch perf), B-DF-3 (funnel), B-DF-4 (W1 breakdown), B-DF-6 (cancelled)
   B-TS-5 (recent errors) ──> B-TS-6 (payload viewer)
   B-TS-4 (per-user table) ──> B-DF-5 (per-user route)
   B-DF-1 (live feed) requires B-TS-6 (payload viewer for row click)

Capability C (Live RFC)
   SCRAPER (phase precondition) ──> C-TS-1 (current lot)
   C-TS-1 ──> C-TS-2 (running totals), C-TS-3 (pace), C-TS-4 (recent lots), C-TS-6 (issues feed),
              C-DF-2 (bid velocity), C-DF-3 (dept pace)
   SCRAPER HEARTBEAT ──> C-TS-5 (health indicator) ──> C-TS-6 (issues feed incl scraper-down)
   C-TS-10 (/live route) ──> C-DF-1 (auto-surface banner), C-DF-6 (wall mode), C-DF-7 (manual controls)
   C-TS-7 (past sales list) ──> C-TS-8 (sale summary) ──> C-TS-9 (lot replay) ──> C-DF-4 (hammer vs estimate)
   C-TS-6 (live issues) ──> C-DF-5 (anomaly history)

Cross-capability
   A-TS-7 / B-TS-8 share a <DateRangeFilter> component → implement once
   A-DF-2 sparkline row and B-TS-2 event-type cards share a <Sparkline> component → implement once
```

### Dependency notes

- **Capability C is gated on the Playwright scraper phase.** All C features require the scraper to emit lot-level events to a dashboard-owned table. The scraper phase has its own research cliff (⚠️ RFC page structure, polling cadence, anti-bot behavior).
- **Capabilities A and B are independent** — can ship in either order. A likely first because the app data already exists and is reliable; B depends on the extension's `analytics_events` table shipping from extension Phases 28–31.
- **Shared components to build once**: `<DateRangeFilter>`, `<Sparkline>`, `<KpiCard>`, `<PayloadViewerModal>`, session/lot drawer primitives. Worth a small "dashboard UI kit" phase before capability-specific work.

---

## MVP Definition

### Launch with v2.0 (from table stakes, ruthlessly cut)

**Capability A (App Activity) — P1:**
- [ ] A-TS-1 Today KPI strip
- [ ] A-TS-2 Active sessions table
- [ ] A-TS-3 Items per specialist stacked bar
- [ ] A-TS-4 AI status donut
- [ ] A-TS-5 Export pipeline breakdown
- [ ] A-TS-6 Session detail drawer
- [ ] A-TS-7, A-TS-8, A-TS-9 filters (date / specialist / mode)

**Capability B (Extension Analytics) — P1 (gated on extension Phases 28–31 shipping):**
- [ ] B-TS-1 Event volume stacked bar
- [ ] B-TS-2 Event type cards
- [ ] B-TS-3 Error rate bar
- [ ] B-TS-4 Per-user table
- [ ] B-TS-5 + B-TS-6 Recent errors + payload viewer
- [ ] B-TS-8 Filters

**Capability C (Live RFC) — P1 (gated on scraper phase):**
- [ ] C-TS-1 Current lot card
- [ ] C-TS-2 Sold/passed running totals
- [ ] C-TS-5 Scraper health indicator
- [ ] C-TS-7 Past sales list
- [ ] C-TS-10 `/live` route

### Add after initial validation (v2.x)

- A-TS-10 Photo coverage, A-DF-3 Stuck item alerts
- B-DF-1 Live event feed (requires validation that 5-user event volume is actually readable at human speed)
- C-TS-3 Pace, C-TS-4 Recent lots, C-TS-6 Issues feed (reduced initial anomaly set), C-TS-8/C-TS-9 Post-sale views

### Future consideration (v2.y or v3)

- A-DF-1 Heatmap (polish, not core)
- B-DF-2 Batch performance view (wait for actual perf complaints)
- C-DF-2 Bid velocity, C-DF-3 Dept pace, C-DF-4 Hammer vs estimate (all ⚠️ depend on RFC fields)
- C-DF-8 Sale comparison (needs 3+ captured sales)
- A-DF-6 Export history (low priority — visible in TPC App)

---

## Feature Prioritization Matrix (condensed — only P1 and borderline items)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| A-TS-1 Today KPI strip | HIGH | LOW | P1 |
| A-TS-2 Active sessions | HIGH | LOW | P1 |
| A-TS-3 Items/specialist stacked bar | HIGH | LOW | P1 |
| A-TS-4 AI status donut | HIGH | LOW | P1 |
| A-TS-5 Export pipeline | HIGH | LOW | P1 |
| A-TS-6 Session detail | HIGH | MEDIUM | P1 |
| A-TS-7/8/9 Filters | HIGH | LOW | P1 |
| A-DF-3 Stuck item alert | HIGH | LOW | P1.5 |
| A-DF-1 Heatmap | MEDIUM | MEDIUM | P2 |
| A-DF-2 Sparkline rows | MEDIUM | MEDIUM | P2 |
| B-TS-1 Event volume stacked | HIGH | LOW | P1 |
| B-TS-2 Event type cards | HIGH | MEDIUM | P1 |
| B-TS-3 Error rate | HIGH | LOW | P1 |
| B-TS-4 Per-user table | HIGH | LOW | P1 |
| B-TS-5/6 Errors + payload | HIGH | LOW | P1 |
| B-TS-7 Version filter | MEDIUM | LOW | P2 |
| B-DF-1 Live event feed | MEDIUM-HIGH | MEDIUM | P2 (ship once core works) |
| B-DF-3 Success/skip/error funnel | MEDIUM | LOW | P2 |
| C-TS-1 Current lot | HIGH ⚠️ | MEDIUM | P1 |
| C-TS-2 Sold/passed totals | HIGH ⚠️ | MEDIUM | P1 |
| C-TS-3 Pace | HIGH ⚠️ | LOW | P1 |
| C-TS-5 Scraper health | HIGH | LOW | P1 |
| C-TS-6 Issues feed | HIGH ⚠️ | LARGE | P1.5 (start with 3 anomaly types) |
| C-TS-7/8/9 Past-sale views | MEDIUM | MEDIUM | P2 |
| C-TS-10 /live route | HIGH | LOW | P1 |
| C-DF-1 Auto-surface banner | MEDIUM-HIGH | LOW | P1.5 |
| C-DF-6 Wall mode | LOW | LOW | P3 (polish) |
| C-DF-7 Manual sale controls | MEDIUM | LOW | P1.5 (escape hatch) |

**Priority key:** P1 = must for v2.0. P1.5 = ship in v2.0 if it falls naturally out of dependencies. P2 = add soon after. P3 = nice-to-have, post-validation.

---

## Competitor / Pattern Analysis

| Feature | LiveAuctioneers / BidStream-style platforms | ScrapeOps / observability patterns | Mixpanel/Amplitude product analytics | Our approach |
|---------|---------------------------------------------|-------------------------------------|---------------------------------------|--------------|
| Current lot display | Large heads-up display, multi-currency, bid-source colors | — | — | Simplified: lot#, title, hammer, timer, source (C-TS-1). No currencies (USD only). |
| Anomaly detection | "AI-powered unusual bid pattern detection" | Field-level staleness, schema drift, health checks | — | Hand-curated rules, 3 to start (C-TS-6). No ML. |
| Scraper health UX | — | Last-run timestamp + pass/fail + latency (standard) | — | Direct copy (C-TS-5). |
| Event-type breakdown | — | — | Event tiles + drilldown to event property → cohort | Event-type KPI cards (B-TS-2), no cohort analysis (anti-feature). |
| Live event feed | — | Log tail (Sumo Logic-style) | Live event stream (Mixpanel) | Yes, with pause (B-DF-1). Kept because 5 users = readable pace. |
| Quotas / leaderboards | — | — | Goal tracking | No — anti-feature. |
| Drill-down pattern | Click bidder → bidder detail | Click alert → log context | Click event → property breakdown | Click session → session detail; click user → user detail; click event → payload. Two-level only. |

---

## Sources

- [Circuit Auction — Best Auction Management Software 2026](https://circuitauction.com/blog/auction-software-2026) — MEDIUM confidence (marketing content; confirms pattern that modern platforms ship unified live dashboards)
- [GetApp — Auction Software with Real-Time Monitoring](https://www.getapp.com/retail-consumer-services-software/auction/f/real-time-monitoring/) — aggregator listings of real-time auction features (bid increments, live tracking, notifications rated HIGH by reviewers)
- [BidStream Auction Software — Live Bidding](https://www.auctionmarketer.co.uk/auction-software/live-bidding) — auctioneer heads-up display pattern (bid source, asking price, last-winner info) — MEDIUM confidence
- [Bid-KIT Live Auction Software](https://www.bid-kit.com/en/live-auction.php) — auctioneer screen feature list — MEDIUM confidence
- [Mike Brandly, Auctioneer — The speed of an auction](https://mikebrandlyauctioneer.wordpress.com/2010/01/08/the-speed-of-an-auction/) — industry rule of thumb: 2 items/min = 120/hr typical pace — HIGH confidence (cited across multiple auctioneer sources)
- [AuctionMethod — Retail Liquidation Sell-Through](https://www.auctionmethod.com/blog/retail-liquidation-auctions-how-to-move-returns-fast-and-profitably) — 85–95%+ sell-through as ops-manager target — MEDIUM confidence (domain-adjacent)
- [PromptCloud — Web Scraping Monitoring Challenges](https://www.promptcloud.com/blog/web-scraping-monitoring-challenges/) — "observability answers whether the data still reflects reality" — HIGH confidence (industry-standard framing)
- [ScrapeOps Monitoring](https://scrapeops.io/monitoring-scheduling/) — scraper dashboard table stakes: last run, success rate, latency, alerts — HIGH confidence
- [WPNewsify — Browser Extension Analytics Platforms](https://wpnewsify.com/blog/7-browser-extension-analytics-platforms-for-measuring-user-engagement) — DAU / session length / feature usage as canonical extension metrics — MEDIUM
- [Statsig — Metric Drilldown](https://docs.statsig.com/product-analytics/drilldown) — drilldown by event property + user property is the standard interaction — HIGH
- [Sumo Logic Live Tail](https://www.sumologic.com/blog/introducing-sumo-logic-live-tail) — live-tail UX conventions (auto-scroll, pause, filter) — HIGH
- [Shadcn — User Activity Heatmap Block](https://www.shadcn.io/blocks/dashboard-user-activity-heatmap) — 7×24 grid implementation pattern — HIGH
- [CallCentreHelper — Agent Performance Dashboards](https://www.callcentrehelper.com/call-centre-agent-performance-dashboards-255701.htm) — noted surveillance/burnout risk cited in research — informs anti-feature list — MEDIUM
- TPC App table schemas (provided in milestone context: `profiles`, `sessions`, `items`, `photos`, `export_history`) — HIGH confidence (direct from briefing)
- TPC Extension `analytics_events` schema (W1–W5 fields provided) — HIGH confidence (direct from briefing)
- TPC PROJECT.md + CLAUDE.md (read during research) — HIGH confidence

---

*Feature research for: v2.0 Live Ops (TPC Dashboard)*
*Researched: 2026-04-24*
