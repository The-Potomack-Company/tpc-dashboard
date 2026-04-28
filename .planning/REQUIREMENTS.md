# Requirements: TPC Dashboard

**Defined:** 2026-04-24 (v2.0 Live Ops milestone)
**Core Value:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen.

> v1.0 milestone (pivot-closed, 2026-04-24) is archived at `.planning/milestones/v1.0-REQUIREMENTS.md`. This file tracks v2.0 Live Ops only. Validated v1.0 requirements that carry forward are preserved under **Validated (v1.0)** below.

---

## Validated (v1.0)

Requirements from v1.0 that are validated and carry forward unchanged. Do NOT re-plan.

- [x] **AUTH-01**: User can log in using existing Supabase credentials from TPC App — *validated v1.0 Phase 1*
- [x] **AUTH-02**: Admin role sees all dashboard data — *validated v1.0 Phase 1 (single-admin implementation; specialist view deferred to later milestone)*
- [x] **AUTH-04**: Unauthenticated users cannot access any dashboard data — *validated v1.0 Phase 1*

> AUTH-03 (specialist-only view) is **deferred** to a later milestone per v1.0 Phase 1 decision. Not in v2.0 scope.

---

## v2.0 Requirements

Requirements for the v2.0 Live Ops milestone. Each maps to a roadmap phase in `.planning/ROADMAP.md`. REQ-IDs continue numbering from v1.0 where categories overlap (INFR, SCRP, AUTH); new categories start at `-01`.

### Infrastructure & Cross-Cutting

- [ ] **INFR-01**: Dashboard frontend is deployed to Vercel with production environment variables set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), accessible at a production URL — *carried forward from v1.0 (not shipped)*
- [ ] **INFR-02**: Repo `supabase/migrations/` reconciles with the linked Supabase `schema_migrations` table — no drift errors on `supabase db push`, no v1.0-retired tables left orphaned, no v1.0 migrations referencing dropped objects
- [x] **INFR-03**: A shared UI-kit module exports `<DateRangeFilter>`, `<Sparkline>`, `<KpiCard>`, and `<PayloadViewerModal>` components with typed props and Tailwind v4 styling, consumed by Capability A, B, and C views — *validated v2.0 Phase 1 plans 01-05 (primitives) + 01-06 (/kit demo + tree-shake verifier)*
- [ ] **INFR-04**: Shared client hooks `useDateRange` and `useTimezone` expose URL-state date-range filtering (Today / 7d / 30d / custom) and fixed Eastern-Time formatting via `date-fns` + `date-fns-tz`
- [ ] **INFR-05**: An admin-only SELECT RLS policy is added to `public.analytics_events` without modifying the extension's existing `anon INSERT` policy; `private.is_admin()` gates read access
- [ ] **INFR-06**: A convention is established for a service-role Supabase admin client (used by the scraper), placed outside `src/` so the service-role key cannot leak into the frontend bundle; documented in the repo

### TPC App Activity (Capability A)

Read-only reporting on existing TPC App tables (`profiles`, `sessions`, `items`, `photos`, `export_history`) at route `/activity`.

- [ ] **APP-01**: Admin sees a "Today" KPI strip at the top of `/activity` showing sessions created today, items created today, items exported today, and % of items with `ai_status='done'`, each with a previous-period delta
- [ ] **APP-02**: Admin sees an "Active sessions" table listing sessions with `status='active'`, showing session name, mode (house/sale), assigned specialist display name, item count, created-at, last-updated-at, and age; sortable by age and specialist
- [ ] **APP-03**: Admin sees a stacked bar chart of items cataloged per day for the last 14 days, with each bar stacked by specialist
- [ ] **APP-04**: Admin sees a donut chart of AI status distribution (pending / processing / done / queued / failed) for items created in the selected date range, with a visually distinct "failed" slice
- [ ] **APP-05**: Admin sees an "Export pipeline" horizontal stacked bar showing sessions grouped by status (active / submitted / returned / exported) over the selected date range
- [ ] **APP-06**: Admin can open a Session Detail view (route or drawer) from any session row that shows session metadata (name, mode, status, notes, review_notes, assigned_to, created_by, timestamps) plus an item list with receipt_number, title, ai_status, and photo count — read-only
- [ ] **APP-07**: Admin can filter the entire `/activity` view by date range (Today / 7d / 30d / custom) using the shared `<DateRangeFilter>`; filter state is reflected in the URL
- [ ] **APP-08**: Admin can filter the `/activity` view by one or more specialists (multi-select from active `profiles` where `role='specialist'`)
- [ ] **APP-09**: Admin can filter the `/activity` view by session mode (house / sale / all)
- [ ] **APP-10**: Inside Session Detail, admin sees a photo-coverage panel showing items with ≥1 photo vs 0 photos, a `photos.upload_status` breakdown (pending / uploading / uploaded / failed), and a callout if any photos are in `failed` state
- [ ] **APP-11**: Admin sees a "Stuck items" alert card on `/activity` that surfaces items with `ai_status IN ('processing','queued')` AND `created_at` older than 2 hours, with a link to the filtered item list
- [ ] **APP-12**: Admin sees a "House vs sale" split on `/activity` (small paired KPIs or pie) comparing session and item counts by mode over the selected range

### Extension Analytics (Capability B)

Read-only reporting on the extension's `analytics_events` table (5 event types: `catalog_single`, `catalog_batch`, `portal_upload`, `spreadsheet_transform`, `data_import`) at route `/extension`.

- [ ] **EXT-01**: Admin sees a stacked bar chart of event volume for the last 14 days, with each bar stacked by `event_type`
- [ ] **EXT-02**: Admin sees five KPI cards (one per event type) showing total count in the selected range, previous-period delta, and a sparkline of daily counts
- [ ] **EXT-03**: Admin sees a horizontal bar chart of error rate per event type, computed as `count(event_type WHERE error_message IS NOT NULL) / count(event_type)` over the selected range
- [ ] **EXT-04**: Admin sees a per-user table keyed by `user_email` with columns for count-per-event-type, total error count, and last-seen-at timestamp; sortable by totals and last-seen
- [ ] **EXT-05**: Admin sees a "Recent errors" table showing timestamp, `user_email`, `event_type`, `error_message`, `extension_version`, and a "view payload" action for each row
- [ ] **EXT-06**: Admin can open a payload-viewer modal from any errors-table row that shows pretty-printed JSON of the event's `items_content` plus event-type-specific columns, with a copy-to-clipboard button
- [ ] **EXT-07**: Admin can filter the `/extension` view by date range (shared `<DateRangeFilter>`) and by one or more `user_email` values
- [ ] **EXT-08**: Admin sees a live event feed that tails `analytics_events` via a 5–10 s refetch (or Supabase Realtime if enabled on the table), showing the latest 50 events newest-first with timestamp, user_email, event-type badge, and success/error indicator; feed has a Pause button and row-click opens the payload viewer (EXT-06)
- [ ] **EXT-09**: Admin can filter the `/extension` view by one or more `extension_version` values and sees a badge showing the currently dominant version
- [ ] **EXT-10**: Admin sees cancellation-rate KPIs for batch workflows (W2 `catalog_batch` and W3 `portal_upload`) computed as `count(cancelled=true) / count(total)` over the selected range

### Live RFC Sale Tracking — UI (Capability C)

Admin-facing live-auction view at route `/live`, plus post-sale review. During an active sale, `/live` shows near-real-time state from dashboard-owned tables populated by the scraper.

- [ ] **LIVE-01**: Admin sees a `/live` route that is admin-bookmarkable and distinct from `/activity` and `/extension`; shows "Active sale" layout when the scraper reports a live sale, or a "Between sales" layout otherwise
- [ ] **LIVE-02**: During an active sale, admin sees a "Current lot" card with lot number, lot title, current bid amount, bid source (if exposed by RFC), time-on-lot timer, and department/category (if exposed); refreshes at 2–5 s cadence
- [ ] **LIVE-03**: During an active sale, admin sees KPI cards with running totals: lots sold, lots passed, total hammer, sell-through % — updated as the scraper writes lot events
- [ ] **LIVE-04**: During an active sale, admin sees a "Lots per hour" pace indicator with a sparkline of the last 30 min and a typical-range annotation (60–200 lots/hr)
- [ ] **LIVE-05**: During an active sale, admin sees a "Recent lots" table of the last 20 lots with lot#, title, hammer, sold/passed, and time-on-lot; newest on top, auto-refreshing at the same cadence as LIVE-02
- [ ] **LIVE-06**: Admin sees a scraper-health indicator (green/yellow/red pill + "last successful scrape: X ago" + latency) visible on every route; turns red if no successful scrape in >60 s during an active sale
- [ ] **LIVE-07**: During an active sale, admin sees an "Issues" feed panel showing timestamped anomalies; initial anomaly set is `scraper_offline`, `lot_stalled` (>2 min on same lot), and `lot_skipped` (non-sequential lot jump); the full anomaly vocabulary is finalized with sale monitors during the Phase 3 discuss
- [ ] **LIVE-08**: Admin sees a "Past sales" list (between-sales mode) showing sales the scraper has captured with date, duration, total lots, sell-through %, and total hammer; clickable into sale summary
- [ ] **LIVE-09**: Admin sees a post-sale summary view for any captured sale showing duration, lots total / sold / passed / withdrawn, sell-through %, total hammer, lots-per-hour average, and an anomaly summary
- [ ] **LIVE-10**: Admin sees a lot-by-lot replay table for any captured sale with lot#, title, hammer, sold/passed, time-on-lot, and anomalies; filterable by sold/passed and department; CSV-exportable via `papaparse`
- [ ] **LIVE-11**: Admin can manually start or stop "active sale" monitoring via two buttons on `/live`, overriding the scraper's auto-detection (writes to a scraper-control row)
- [ ] **LIVE-12**: When the scraper detects a sale start, admin sees a global banner on every route ("Live sale in progress — click to open") that links to `/live`

### Live RFC Sale Tracking — Scraper (SCRP-06+)

Server-side Playwright scraper that runs during active RFC sales, writing lot events to dashboard-owned Supabase tables. Continues SCRP numbering from v1.0 (SCRP-01..05 were PDF-import-era requirements, retired in pivot).

- [ ] **SCRP-06**: Scraper is packaged as a `scraper/` workspace (separate from `src/`), deployable as a container image based on the official Playwright Docker image
- [ ] **SCRP-07**: Scraper runs on Railway (or an equivalent always-on container host) with at least 1 GB RAM, Fly.io documented as fallback
- [ ] **SCRP-08**: Scraper logs into RFC using stored credentials, persists `storageState` across runs, and refreshes the session before it expires
- [ ] **SCRP-09**: Scraper polls the active auction page at a configurable cadence (target 2–5 s; tuned against RFC rate-limit behavior in the scraper phase) and writes lot-level events to an append-only `live_lot_events` table
- [ ] **SCRP-10**: Scraper maintains a `live_lot_current` projection row (upserted per lot) that the `/live` current-lot card reads, via a security-definer RPC that updates both tables atomically
- [ ] **SCRP-11**: Scraper writes a heartbeat every poll cycle to a `scraper_heartbeats` table that LIVE-06 consumes; heartbeat row includes timestamp, scrape latency, and error (if any)
- [ ] **SCRP-12**: Scraper recycles its Playwright browser context on a bounded schedule (time OR memory) to prevent the documented ~400 MB / 20-min memory leak during multi-hour sales
- [ ] **SCRP-13**: Scraper writes to Supabase using a `service_role` key stored only in the Railway (or fallback) secret store — never in the frontend bundle or in any `VITE_*` variable
- [ ] **SCRP-14**: Scraper detects anomalies matching LIVE-07 definitions and writes rows to an anomalies table with type, lot number (if applicable), and contextual payload
- [ ] **SCRP-15**: Scraper schema (`live_lot_events`, `live_lot_current`, `scraper_heartbeats`, anomalies) is NOT locked before a Phase 3 discuss session with sale monitors; raw HTML snapshots are captured during early runs so signals can be backfilled without a schema rewrite
- [ ] **SCRP-16**: Supabase Realtime is enabled on `live_lot_current` (and any other low-frequency live table), RLS SELECT policy + publication ship together, `live_lot_events` is NOT in the realtime publication (invalidate-driven instead); client uses `invalidateQueries` as default pattern and `setQueryData` only for the current-lot ticker

---

## Future Requirements

Deferred beyond v2.0.

### Differentiator charts

- **APP-FUT-01**: Specialist activity heatmap (7×24 grid of items cataloged) — v2.1+
- **APP-FUT-02**: Per-specialist sparkline roster — v2.1+
- **APP-FUT-03**: Session age distribution histogram — v2.1+
- **APP-FUT-04**: Export history table — v2.1+
- **EXT-FUT-01**: Batch performance view (W2 execution time vs total items scatter) — v2.1+
- **EXT-FUT-02**: Success/skip/error funnel by batch workflow — v2.1+
- **EXT-FUT-03**: W1 catalog-single breakdown (by category / detection method / field mode) — v2.1+
- **EXT-FUT-04**: Per-user detail route `/extension/users/:email` — v2.1+
- **LIVE-FUT-01**: Bid-velocity line chart (bids per minute) — gated on RFC exposing per-bid events; defer until scraper phase confirms
- **LIVE-FUT-02**: Department / category pace breakdown — gated on RFC lot fields
- **LIVE-FUT-03**: Hammer-vs-estimate scatter (post-sale) — gated on RFC exposing estimates
- **LIVE-FUT-04**: Anomaly-history cross-sale view — v2.1+
- **LIVE-FUT-05**: Wall-mode display variant (`?display=wall`) for secondary-monitor use — v2.1+
- **LIVE-FUT-06**: Sale comparison (side-by-side KPIs) — defer until 3+ sales captured

### Specialist access

- **AUTH-FUT-01**: Specialist-scoped view (see own activity only; denied from cross-team views). Deferred from v1.0 Phase 1 decision.

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Historical sale analytics (PDF import, sale browse/detail, KPI landing, trend charts, department/sale comparison) | Retired in the v1.0 → v2.0 pivot — dashboard now focuses on live ops, not historical analytics |
| Individual buyer/seller/bidder identity display or storage | RFC UI exposes only aggregate bid state; storing bidder PII creates compliance + trust issues |
| Writing to or controlling TPC App or Cataloger extension state from the dashboard | Read-only analytics only; writes would duplicate logic the source repos own |
| Placing bids or controlling the auction from `/live` | RFC is a third-party site we scrape, not drive; any write-back opens legal/safety issues |
| Direct RFC API integration | RFC has no API — live scrape is the only supported access method |
| Mobile-first responsive design | Desktop-oriented live-ops tool; responsive OK but not mobile-first |
| Sub-second polling / websocket streaming against RFC | RFC will rate-limit or IP-ban aggressive scrapers; 1–10 s cadence is the realistic window |
| Per-specialist quotas, goal lines, or leaderboards | Team of ~5; surveillance/burnout cost exceeds signal at this N |
| Email/Slack/push notifications for team or sale events | Dashboard is a desktop tab left open; adds infra for zero new value at this scale |
| User-management CRUD (add/remove specialists, change roles) | TPC App owns `profiles`; duplicating logic here breaks single-source-of-truth |
| Retention / cohort analysis for extension usage | N=5 users makes every retention number meaningless noise |
| SQL query builder / custom-report editor | Admin is non-technical; curated fixed views over flexible builder |
| Anomaly detection via ML ("item rate down 40%!") | Data volume too low for reliable detection at this N; false positives every holiday |
| Sub-second auto-refresh on app-activity charts | Cataloging is minute-scale; over-refreshing hits Supabase read quota |
| Item edit history / revision log from the dashboard | TPC App owns source of truth; triggers required would be on TPC App schema |
| Predictive ML (will-this-lot-meet-estimate, sale-outcome forecasting) | Data too sparse, signal too noisy, reputation cost of being wrong |
| Multi-sale-at-once tracking | RFC runs one sale at a time for TPC |
| Public-facing sale-stats sharing | Admin-only scope; CSV export is sufficient if marketing needs data |
| Full bid history with per-bidder records | Per-bid storage creates PII + bloat; aggregate lot snapshots suffice |

---

## Traceability

Which phases cover which requirements. Filled in by the roadmapper during roadmap creation.

v2.0 phase numbering is reset to 1 for this milestone (v1.0 phases archived under `.planning/milestones/v1.0-phases/`).

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 6 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Complete (plans 01-05 + 01-06) |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Pending |
| INFR-06 | Phase 1 | Pending |
| APP-01 | Phase 3 | Pending |
| APP-02 | Phase 3 | Pending |
| APP-03 | Phase 3 | Pending |
| APP-04 | Phase 3 | Pending |
| APP-05 | Phase 3 | Pending |
| APP-06 | Phase 3 | Pending |
| APP-07 | Phase 3 | Pending |
| APP-08 | Phase 3 | Pending |
| APP-09 | Phase 3 | Pending |
| APP-10 | Phase 3 | Pending |
| APP-11 | Phase 3 | Pending |
| APP-12 | Phase 3 | Pending |
| EXT-01 | Phase 2 | Pending |
| EXT-02 | Phase 2 | Pending |
| EXT-03 | Phase 2 | Pending |
| EXT-04 | Phase 2 | Pending |
| EXT-05 | Phase 2 | Pending |
| EXT-06 | Phase 2 | Pending |
| EXT-07 | Phase 2 | Pending |
| EXT-08 | Phase 2 | Pending |
| EXT-09 | Phase 2 | Pending |
| EXT-10 | Phase 2 | Pending |
| LIVE-01 | Phase 5 | Pending |
| LIVE-02 | Phase 5 | Pending |
| LIVE-03 | Phase 5 | Pending |
| LIVE-04 | Phase 5 | Pending |
| LIVE-05 | Phase 5 | Pending |
| LIVE-06 | Phase 5 | Pending |
| LIVE-07 | Phase 5 | Pending |
| LIVE-08 | Phase 5 | Pending |
| LIVE-09 | Phase 5 | Pending |
| LIVE-10 | Phase 5 | Pending |
| LIVE-11 | Phase 5 | Pending |
| LIVE-12 | Phase 5 | Pending |
| SCRP-06 | Phase 4 | Pending |
| SCRP-07 | Phase 4 | Pending |
| SCRP-08 | Phase 4 | Pending |
| SCRP-09 | Phase 4 | Pending |
| SCRP-10 | Phase 4 | Pending |
| SCRP-11 | Phase 4 | Pending |
| SCRP-12 | Phase 4 | Pending |
| SCRP-13 | Phase 4 | Pending |
| SCRP-14 | Phase 4 | Pending |
| SCRP-15 | Phase 4 | Pending |
| SCRP-16 | Phase 4 | Pending |

**Coverage:**
- v2.0 requirements: 51 total
- Mapped to phases: 51 ✓
- Unmapped: 0 ✓

Per-phase distribution:
- Phase 1 (Infrastructure & Shared UI Kit): 5 requirements — INFR-02..06
- Phase 2 (Extension Analytics): 10 requirements — EXT-01..10
- Phase 3 (TPC App Activity): 12 requirements — APP-01..12
- Phase 4 (Live RFC Scraper Infrastructure): 11 requirements — SCRP-06..16
- Phase 5 (Live Sale UI): 12 requirements — LIVE-01..12
- Phase 6 (Vercel Production Deploy): 1 requirement — INFR-01

---

*Requirements defined: 2026-04-24 — v2.0 Live Ops*
*Last updated: 2026-04-24 (roadmap created; traceability filled in)*
