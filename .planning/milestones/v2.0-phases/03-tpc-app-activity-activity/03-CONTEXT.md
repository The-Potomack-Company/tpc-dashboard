# Phase 3: TPC App Activity (`/activity`) - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the `/activity` admin route plus the nested `/activity/sessions/:id` Session Detail route and the nested `/activity/stuck` page, sourced exclusively from existing TPC App tables (`profiles`, `sessions`, `items`, `photos`, `export_history`) and — for the dev-only surface — `ui_interactions`. The page surfaces who on the TPC team is cataloging what: a "Today" KPI strip (sessions / items / exports / % AI-done), an Active Sessions table sortable by age and specialist, a 14-day items-per-specialist stacked bar, an AI-status donut with a visually distinct failed slice, an Export Pipeline horizontal stacked bar, a House-vs-Sale split, and a Stuck-Items alert card. Filtering uses the shared `<DateRangeFilter>` (Phase 1) plus a new specialist multi-select and a session-mode toggle. Session Detail renders session metadata, a TanStack-Table item list (receipt_number, title, ai_status, photo count), a Photo Coverage panel (counts + breakdowns), and lazy per-item thumbnail strips. The dev-only surface (gated by `isDevAccount(profile.email)`) adds a collapsed `<DeveloperPanel>` at the bottom of `/activity` and per-row dev affordances inside Session Detail and the Stuck Items page.

Phase 3 reads only from TPC App tables and `ui_interactions` — **no writes** to any TPC App table, no mutation of `photos.upload_status`, no schema changes to TPC App–owned objects. New dashboard objects in this phase are limited to (a) Postgres RPCs for aggregation, and (b) per-route components / hooks / services. Phase 3 does NOT enable Realtime on any TPC App table, does NOT add the `/extension` or `/live` routes, and does NOT install Playwright or any scraper code.

Covers requirements: **APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-07, APP-08, APP-09, APP-10, APP-11, APP-12**.

</domain>

<decisions>
## Implementation Decisions

### Page Structure & Routing

- **D-01:** `/activity` is a single page composed of (top-to-bottom): Today KPI strip → Active Sessions table → Stuck Items alert card → 14-day items-per-specialist stacked bar → AI-status donut + House-vs-Sale split (paired) → Export Pipeline horizontal stacked bar → DeveloperPanel (collapsed, dev-only). The page header carries `<DateRangeFilter>`, specialist multi-select, and session-mode toggle.
- **D-02:** Session Detail is a **dedicated route** `/activity/sessions/:id`, not a drawer or modal. Reasons: bookmarkable URL; full-width grid for the photo coverage panel and item list; browser back returns to `/activity` with filter state intact.
- **D-03:** Session Detail route is **nested under `/activity`** so the page-level filter URL params (`?range=`, `?specialists=`, `?mode=`) are preserved across navigation. Browser back from `/activity/sessions/:id` lands on `/activity` with the same filter state. Breadcrumb in header reads `Activity › [Session Name]`. `DashboardLayout` `NAV_ITEMS` keeps `/activity` highlighted on the nested route.
- **D-04:** Session Detail layout: session metadata card on the left, **Photo Coverage panel on the right (above the item list)**, item list spans full width below. The coverage panel is numeric only (≥1 photo vs 0, `upload_status` breakdown, failed-state callout). Thumbnails do NOT render in the coverage panel.
- **D-05:** Session Detail item list uses **TanStack Table v8** (the `^8.21.3` dep added by Phase 2 plan 02-05). Columns: receipt_number, title, ai_status, photo count. Sortable per column, sticky header, simple client-side pagination if needed. Reuses `SortIndicator` + `TableSkeleton` from Phase 1 D-25.
- **D-06:** Thumbnails appear via **per-item row expansion** in the item list — click a row to disclose an inline thumbnail strip for that item only. Mass thumbnail grids are NOT used. Drives the photo signed-URL strategy toward "lazy, on-demand, per-photo".
- **D-07:** `/activity/stuck` is a **dedicated nested route** that renders the stuck-items list. Triggered from the alert card on `/activity`. Bookmarkable, distinct context, room for triage.

### Photo Signed-URL Strategy (D-08 through D-13)

> Constraint anchor: TPC App photos bucket is private (`storage.buckets.public = false`). The only display path is `supabase.storage.from('photos').createSignedUrl(path, ttl)`. TPC App's `usePhotoUrl` hook (`~/Projects/TPC_App/TPC_App/src/hooks/usePhotoUrl.ts`) uses TTL=3600s and prefers a Dexie blob; the dashboard runs on a different device with no Dexie blobs, so the dashboard hook drops the blob branch entirely. Phase 3 Success Criterion #5 requires thumbnails to render correctly after a **2-hour tab-resume**, which 3600s alone does not survive.

- **D-08:** Primary mechanism is **refetch-on-window-focus + per-photo TanStack Query**. Each photo URL is its own `useQuery({ queryKey: ['signed-photo-url', path] })`. The query overrides the global QueryClient default (`refetchOnWindowFocus: false` from Phase 1) with `refetchOnWindowFocus: true` for this query key. Tab-resume after 2h triggers the focus event, stale entries refetch, thumbnails repaint with new URLs without a flash.
- **D-09:** **Lazy fetch timing.** Mounting `/activity/sessions/:id` only fetches photo metadata (`storage_path`, `thumbnail_path`, `upload_status`) — **no signed URLs**. When the admin clicks an item row to disclose its thumbnail strip, that item's photos each kick off `useSignedPhotoUrl(thumbnail_path)`. Mass eager signing on mount is rejected.
- **D-10:** Hook lives at **`src/hooks/useSignedPhotoUrl.ts`** (shared, not phase-scoped under `src/hooks/activity/`). Reusable for any future phase that needs signed photo URLs (e.g., a v2.1+ ItemDetail panel; the Live UI's lot photos if RFC ever exposes them).
- **D-11:** Cache parameters: **TTL=3600s** (matches TPC App; minimizes URL leak window), **staleTime=50min** (TanStack proactively considers the URL stale 10min before actual expiry — next render or focus event refetches before the user sees a 403), `refetchOnWindowFocus: true`, `retry: 1`, `gcTime: 10min`.
- **D-12:** **`thumbnail_path` only.** Phase 3 has no requirement to view full-size photos; that drilldown is deferred to v2.1+. Reduces storage egress materially when an admin expands many rows in a long session.
- **D-13:** When a photo's `upload_status = 'failed'`, the row renders an inline error chip — **no `createSignedUrl` call** is issued for that photo (its `storage_path` may be missing or invalid). Surfaced in the Photo Coverage panel's failed-state callout.

### Filter Scope (D-14 through D-21)

> Master rule: **the global date range filter applies to `created_at`-based aggregates only. "Right-now" widgets ignore the date range. Specialist + mode filters apply to BOTH categories.**

- **D-14:** **Today KPI strip (APP-01)** is anchored to today regardless of selected range. Previous-period delta uses Phase 2 D-05 math (same-length immediately preceding) with N=1 day → "today vs yesterday". The strip header reads "Today's Snapshot" so the contrast with the analytical widgets below is explicit. Specialist + mode filters apply.
- **D-15:** **Active Sessions table (APP-02)** is always-current. Queries `sessions WHERE status = 'active'` regardless of date range. Sortable by age (`now() - created_at`) and specialist (`profiles.display_name` joined via `sessions.assigned_to`). Specialist + mode filters apply.
- **D-16:** **14-day items-per-specialist stacked bar (APP-03)** is fixed-window: always trailing 14 days bucketed daily in ET. Specialist + mode filters apply; date range does not. Mirrors Phase 2's EXT-01 14-day fixed-window.
- **D-17:** **AI-status donut (APP-04)**, **Export Pipeline horizontal stacked bar (APP-05)**, **House-vs-Sale split (APP-12)** are range-driven. APP-04 explicit: "items created in the selected date range". Specialist + mode filters apply.
- **D-18:** **Stuck Items (APP-11)** uses its own rule: `ai_status IN ('processing','queued') AND created_at < now() - interval '2 hours'`. Independent of date range. Specialist + mode filters apply (admin can narrow stuck items to one specialist's queue).
- **D-19:** **Specialist multi-select (APP-08)** sources from `profiles WHERE is_active = true AND role = 'specialist'`. Admin role users are NOT in the dropdown (per AUTH model: admins administer, specialists catalog). Specialists with zero activity in the selected range still render (operational view, not analytical hide). Deactivated specialists who have historical activity in the range are excluded from the dropdown but their historical rows still render in any chart that doesn't gate on the dropdown selection (i.e., when the multi-select is empty = "all").
- **D-20:** **Mode filter (APP-09)** targets `sessions.mode` (house / sale / all). `items.mode` is treated as redundant and not used as a filter — the migration sets it equal to the parent session's mode at insert time. If `items.mode` ever diverges from `sessions.mode`, that's a TPC App data bug; surfacing it is out of scope here.
- **D-21:** **Default range** when admin lands on `/activity` is **`7d`** (Phase 1 D-17 carryover). URL param naming: `?range=today|7d|30d|custom`, `?specialists=email1,email2` (comma-separated single key, mirroring Phase 2 D-17), `?mode=house|sale|all`.

### Stuck Items (D-22 through D-25)

- **D-22:** Alert card on `/activity` shows: large stuck-items count, age-of-oldest (e.g., "14h"), severity tone (yellow when N≥5, red when oldest >6h — thresholds adjustable by tweaking constants in the component), and a "View N stuck items →" CTA linking to `/activity/stuck`. **Quiet success state when N=0**: card renders "No stuck items" so the page layout doesn't reflow on each refetch.
- **D-23:** `/activity/stuck` page columns: **receipt_number, title, ai_status, age, session.name, specialist** (`profiles.display_name` from `sessions.assigned_to`). Sortable per column, TanStack Table v8. Click row → jumps to `/activity/sessions/:id` of that item's session. Specialist + mode filters from `/activity` are NOT inherited (the page is its own context); URL params are independent.
- **D-24:** **Server-side RPC `get_stuck_items(p_specialists text[], p_mode text)`** returns one row per stuck item with all six display columns joined server-side. Card uses `count(*)` and `max(now() - created_at)` from the same RPC result (or a paired smaller RPC `get_stuck_items_summary` if the page-vs-card data shapes diverge enough — plan-time decision). Stuck threshold ("2 hours" from APP-11) is **hard-coded inside the RPC**, NOT a parameter, so the card and page can never drift.
- **D-25:** Card refetch cadence: TanStack default `staleTime: 60s` (no `refetchInterval`). Same for the donut, export pipeline, and other static aggregates. Live tail behavior is reserved for the `ui_interactions` recent-events feed in the DeveloperPanel (D-32).

### Admin / Developer Surface Split (D-26 through D-33)

> Mirrors Phase 2 D-15 / D-16. Same gate, same module, same render-conditional (NOT display-hidden) discipline.

- **D-26:** Identity gate is the **email allowlist** from `src/lib/devAccess.ts` (Phase 2 plan 02-02 ships this module). Phase 3 reuses it as-is — does NOT add a second gate, does NOT extend the constant inline. Initial allowlist (in Phase 2): `['josh@potomackco.com']`. Phase 3 uses `isDevAccount(profile?.email)` read via the Zustand auth store.
- **D-27:** Admin surface (always rendered): Today KPI strip (APP-01), Active Sessions (APP-02), 14-day stacked bar (APP-03), AI-status donut (APP-04), Export Pipeline (APP-05), House-vs-Sale (APP-12), Stuck Items alert card (APP-11), Session Detail (APP-06) with photo coverage (APP-10), `/activity/stuck` page, `<DateRangeFilter>` + specialist multi-select + mode toggle (APP-07/08/09).
- **D-28:** Developer surface (rendered only when `isDevAccount(profile.email)` is true):
  - Inside `/activity/sessions/:id` per-item disclosure: a **Raw Item Inspector** section showing `items.transcript`, `items.description`, `items.measurements`, `items.estimate`, full row JSON via `<PayloadViewerModal>` (the Phase 1 D-14 component, also used for Phase 2 EXT-06). Admins see only the four spec'd item-list columns.
  - Inside `/activity/sessions/:id` per-item thumbnail strip: under each thumbnail, the **raw `storage_path` / `thumbnail_path`** strings + a "view full-size" link that signs `storage_path` (separate `useSignedPhotoUrl` query). Admins see thumbnails only.
  - Inside `/activity/stuck`: extra columns **`category`, `estimate`, raw photo storage paths for any failed photos, "view raw item JSON" action per row**. Admins see operational columns only (D-23).
  - At the bottom of `/activity`: a **`<DeveloperPanel>`** (collapsed by default, mirrors Phase 2 D-15 / 02-07's panel) housing (1) the Failed-AI Breakdown, (2) the `ui_interactions` panel (D-31..D-34).
- **D-29:** **Failed-AI Breakdown panel** (inside `<DeveloperPanel>`): KPIs for `items.ai_status = 'failed'` over the selected date range, broken down by specialist + mode + items.category. Powered by a new RPC `get_failed_ai_breakdown(p_from timestamptz, p_to timestamptz, p_specialists text[], p_mode text)`. Filter scope: respects the page-level date range (range applies to `items.created_at` aggregates per D-14..D-17 rule); respects specialist + mode.
- **D-30:** All Phase 3 RPCs follow the **Phase 2 D-12 / D-13 server-aggregation pattern**: per-chart RPCs, server-side `date_trunc(... AT TIME ZONE 'America/New_York')` bucketing, shared filter signature where applicable (`p_from timestamptz, p_to timestamptz, p_specialists text[], p_mode text` for range-driven RPCs; `p_specialists text[], p_mode text` for the right-now ones). Non-aggregating queries (Active Sessions list, Session Detail items, Stuck Items page rows) use raw `.from().select()` with embedded joins (`sessions!inner`, `profiles!inner` via PostgREST). Codebase layout: `src/services/activity/queries.ts` + `src/hooks/activity/`.

### `ui_interactions` Dev Panel (D-31 through D-34)

> Surfaces TPC App's `public.ui_interactions` table (see migration `~/Projects/TPC_App/TPC_App/supabase/migrations/20260424000001_create_ui_interactions.sql`). RLS already admins-read-all; dashboard admin session can SELECT directly. **High volume** (~10–100× `analytics_events` per the migration comment) and 30-day retention.

- **D-31:** Lives **inside the `/activity` `<DeveloperPanel>`** (collapsed by default), not on its own dev route. Single dev surface for all Phase 3 dev affordances.
- **D-32:** Sub-panels:
  - **Top Page Paths**: count where `interaction_type = 'view'`, grouped by `page_path`, top 10. New RPC `get_ui_top_pages(p_from, p_to)`.
  - **Top Element Clicks**: count where `interaction_type = 'click'`, grouped by `element_id`, top 20. New RPC `get_ui_top_elements(p_from, p_to)`.
  - **Walkthrough Funnel**: count of distinct `user_id` at each `walkthrough_step` value (extract from `metadata->>'step'` if not surfaced as a top-level column — finalize in plan after reading TPC App's walkthrough emitter). New RPC `get_walkthrough_funnel()` — ignores date range (per-user-state question, not window aggregate). Useful given the existing `profiles.walkthrough_completed` boolean column.
  - **Recent Events Feed**: TanStack Query with `refetchInterval: 10000`, newest 50, `app_source = 'tpc-app'`. Pause button toggles `refetchInterval: false`; Resume re-enables AND immediately refetches. Mirrors Phase 2 D-09 / D-10 / D-11 live-feed pattern. Row click opens `<PayloadViewerModal>` with full row JSON + `metadata`.
- **D-33:** **Hard filter `app_source = 'tpc-app'` on every `ui_interactions` query** — RPC bodies + service-layer `.from('ui_interactions').select()` builders both. JSDoc on every query. Code review checklist item: "every new query against `ui_interactions` MUST scope by `app_source`". Mirrors Phase 2 D-01 invariant for `analytics_events`.
- **D-34:** Filter scope of the panel:
  - Range applies to the date-windowed sub-panels (Top Pages, Top Elements, Failed-AI Breakdown).
  - Walkthrough Funnel + Recent Events Feed ignore date range.
  - Specialist + mode filters do NOT apply to `ui_interactions` (it joins on `user_id`, not `items.created_by` / `sessions.assigned_to`, and isn't session-scoped).

### Empty / Loading / Error UX

- **D-35:** **Per-card empty messages**, per-card loading skeletons, per-card `<ErrorState>` with a `refetch()`-bound retry. **Locked `<ErrorState>` contract** from Phase 2 (verified 2026-04-29): `{ heading: string; body: string; onRetry: () => void }` — the component renders its own internal Retry button; sibling Retry buttons are forbidden. Reuses `EmptyState`, `ErrorState`, `TableSkeleton` from Phase 1 D-25.
- **D-36:** No page-level Suspense boundary — one slow query never blocks others. Same as Phase 2 D-21.
- **D-37:** **No full-page empty state** for `/activity`. TPC App tables (`profiles`, `sessions`, `items`) are populated in prod from day one of TPC App use; an empty `sessions` table is genuinely anomalous (would mean no specialist has ever started a session). If somehow zero rows: each card shows its per-card empty message ("No sessions yet", "No items in this range"). Diverges from Phase 2 D-19 because the data dependency is different.

### Claude's Discretion

- Exact Tailwind class choices for the page layout (KPI strip grid, chart grid, card spacing) — match the visual style of `/kit` and `/extension`.
- Severity-threshold constants for the Stuck Items alert tone (yellow / red) — start with N≥5 → yellow, oldest>6h → red; revisit if operator UAT shows misclassification.
- Pagination size for `/activity/stuck` and Session Detail item list — default to 50 rows per page.
- TanStack Query `staleTime` overrides on a per-hook basis where defaults need tightening — none expected, but the Recent Events Feed sets `staleTime: 0` per Phase 2 D-09 / D-10.
- Recharts donut color choices for AI status — pending=neutral gray, processing=blue, queued=amber, done=green, **failed=red and visually distinct** (heavier border or pulled-out slice — pulled-out slice is the cleanest).
- Severity tone hex values (yellow / red) and any animation on the alert card — keep static; no pulsing.
- Active Sessions table sort defaults: by age descending (oldest first) on initial render; user can click any column header.
- Whether to gate the `<DeveloperPanel>` open-state with `localStorage` so dev's collapsed-vs-expanded preference persists — nice-to-have, not required.
- Walkthrough funnel — exact step list and ordering — finalize in plan after reading TPC App's emitter source (`grep -rn walkthrough_step ~/Projects/TPC_App/TPC_App/src/`).
- Whether `get_stuck_items` is one RPC returning all rows (and the card derives count + age) or a paired `get_stuck_items_summary` for the card — plan-time decision based on row volume in prod.
- Whether to add `ui_interactions.user_email` derivation when `user_id` is set but email is null (RPC `JOIN auth.users` vs trust the `user_email` column TPC App writes) — finalize in plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current-milestone requirements
- `.planning/REQUIREMENTS.md` § v2.0 Requirements § TPC App Activity (Capability A) — APP-01 through APP-12 verbatim
- `.planning/ROADMAP.md` § Phase 3: TPC App Activity (`/activity`) — phase goal, dependencies, 5 success criteria (Today KPI strip + Active Sessions; filter URL state; charts; Session Detail; photo signed-URL strategy)
- `.planning/PROJECT.md` § Active (v2.0 Live Ops) — TPC App activity tracking target capability
- `.planning/PROJECT.md` § Constraints — shared-database non-interference + admin-only access model

### Phase 1 carryovers (locked, do not re-litigate)
- `.planning/phases/01-infrastructure-shared-ui-kit/01-CONTEXT.md` § Implementation Decisions — D-11 through D-25 cover the UI kit + hooks (`useDateRange`, `useTimezone`) + admin client conventions Phase 3 consumes
- `.planning/phases/01-infrastructure-shared-ui-kit/01-VERIFICATION.md` — Phase 1 must-haves passed (5/5)

### Phase 2 carryovers (locked, do not re-litigate)
- `.planning/phases/02-extension-analytics-extension/02-CONTEXT.md` § Implementation Decisions — D-01 (`app_source` invariant pattern), D-05 (previous-period math), D-12/D-13/D-14 (RPC server-aggregation pattern + ET bucketing + `services/<feature>/queries.ts` layout), D-15/D-16 (`<DeveloperPanel>` + `isDevAccount` gate), D-17 (URL-driven filters comma-separated single-key), D-21 (per-card empty/loading/error + locked `<ErrorState>` contract)
- `.planning/phases/02-extension-analytics-extension/02-PLAN.md` — Phase 2 plan structure mirrors Phase 3's planned shape (5 waves, RPC + types regen blocking checkpoint)
- `.planning/phases/02-extension-analytics-extension/02-02-PLAN.md` — ships `src/lib/devAccess.ts` (Phase 3 reuses)
- `.planning/phases/02-extension-analytics-extension/02-05-PLAN.md` — installs `@tanstack/react-table@^8.21.3` (Phase 3 reuses for Session Detail item list and `/activity/stuck`)
- `.planning/phases/02-extension-analytics-extension/02-07-PLAN.md` — `<DeveloperPanel>` precedent (Phase 3's panel mirrors structure)
- `.planning/STATE.md` § Accumulated Context § Decisions — Recharts JSDom mock pattern, `useDateRange` URL-driven contract, `KpiCard` delta semantic neutrality

### Phase 1 reusable assets (concrete files to import from, not copy)
- `src/components/kit/KpiCard.tsx` — Today KPI strip (APP-01)
- `src/components/kit/Sparkline.tsx` — sparkline slot inside KpiCard (deltas)
- `src/components/kit/PayloadViewerModal.tsx` — dev-panel raw item JSON viewer (D-28); ui_interactions recent-events row click (D-32)
- `src/components/kit/DateRangeFilter.tsx` — APP-07 date filter
- `src/hooks/useDateRange.ts` — APP-07 URL contract
- `src/hooks/useTimezone.ts` — ET formatters; SQL bucketing in D-30 must align with this hook (`'America/New_York'`)
- `src/components/EmptyState.tsx` — D-35 per-card empty
- `src/components/ErrorState.tsx` — D-35 per-card error. **LOCKED CONTRACT** (Phase 2 verification): props are `{ heading: string (required); body: string (required, plain string NOT children); onRetry: () => void (required) }`. Component renders its own internal Retry button — DO NOT add sibling Retry; DO NOT use children syntax.
- `src/components/TableSkeleton.tsx` — D-35 per-card loading for tables
- `src/components/SortIndicator.tsx`, `src/components/FilterInput.tsx` — opportunistic reuse for sortable tables
- `src/components/BackLink.tsx` — Session Detail and `/activity/stuck` breadcrumb / back affordance
- `src/layouts/DashboardLayout.tsx` — `NAV_ITEMS` (Phase 2 will have already added `/extension`); Phase 3 adds the `/activity` entry
- `src/main.tsx` — `QueryClientProvider` already wired; Phase 3 just consumes it (with per-hook overrides for `refetchOnWindowFocus` on signed-photo-url and `refetchInterval` on the recent-events feed)
- `src/lib/supabase.ts` — anon client (frontend-only); never use `scraper/lib/supabase-admin.ts` from `src/`
- `src/lib/devAccess.ts` — Phase 2 plan 02-02 ships this; Phase 3 imports `isDevAccount` as-is
- `src/db/database.types.ts` — Phase 2 will regenerate this after its RPCs land; Phase 3 regenerates again after the Phase 3 migrations land

### TPC App schema reference (read for understanding only — do NOT mirror columns)
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260318000000_create_profiles.sql` — `profiles` shape: `id`, `role` ('admin' | 'specialist'), `display_name`, `is_active`, `created_at`
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260318000001_create_sessions.sql` — `sessions` shape: `id`, `name`, `mode` ('house' | 'sale'), `status` ('active' | 'submitted' | 'returned' | 'exported'), `notes`, `review_notes`, `created_by`, `assigned_to`, timestamps
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260318000002_create_items.sql` — `items` shape: `id`, `session_id`, `mode`, `receipt_number`, `title`, `description`, `condition`, `estimate`, `measurements`, `category`, `transcript`, `ai_status` ('pending' | 'processing' | 'done' | 'failed' | 'queued'), `sort_order`, `created_at`
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260318000003_create_export_history.sql` — `export_history` shape: `id`, `session_id`, `session_name`, `session_mode`, `item_count`, `exported_at`, `exported_by`
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260318000006_add_email_to_profiles.sql` — adds `email` to profiles (Phase 3 specialist-multi-select uses display_name; email is admin-side identity)
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260320000000_add_completed_status.sql` — `sessions.status` extension
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260320100000_add_walkthrough_completed.sql` — `profiles.walkthrough_completed` boolean (used by D-32 walkthrough funnel context)
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260320200000_create_photos.sql` — `photos` shape: `id`, `item_id`, `storage_path`, `thumbnail_path`, `sort_order`, `upload_status` ('pending' | 'uploading' | 'uploaded' | 'failed'), `created_at`. **Storage bucket `photos` is private** (`public = false`). RLS: admins full access; specialists scoped via session ownership.
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260424000001_create_ui_interactions.sql` — `ui_interactions` shape: `id`, `app_source` (default `'tpc-app'`), `user_id`, `user_email`, `session_id`, `interaction_type` ('click' | 'view' | 'focus' | 'blur' | 'submit' | 'walkthrough_step'), `page_path`, `element_id`, `metadata` jsonb, `created_at`. RLS: admins read all (dashboard reads directly).
- `~/Projects/TPC_App/TPC_App/supabase/migrations/20260424000003_add_app_version.sql` — adds `app_version` column (potential future filter; not used in Phase 3)
- `~/Projects/TPC_App/TPC_App/src/hooks/usePhotoUrl.ts` — TPC App's signed-URL hook (TTL=3600s, blob-first); the dashboard's `useSignedPhotoUrl` (D-10) is a simplified sibling of this

### Existing dashboard schema
- `supabase/migrations/20260424120000_drop_retired_v1_tables.sql` — Phase 1 v1.0 → v2.0 drop migration (informational; Phase 3 does not touch retired tables)
- `supabase/migrations/20260424120500_create_analytics_events.sql` — Phase 1 INFR-05 admin-SELECT RLS (Phase 3 does not consume `analytics_events`; Phase 2 does)

### Stack documentation
- `CLAUDE.md` § Technology Stack — version pins (Recharts 3.8.1, Supabase JS 2.101.1, TanStack Query, TanStack Table 8.21.3 from Phase 2, date-fns, date-fns-tz)
- `CLAUDE.md` § Conventions § Service-role Supabase admin client — confirms `src/` MUST NOT import the admin client; Phase 3 stays pure-frontend
- `CLAUDE.md` § GSD Workflow Enforcement — planning-artifact discipline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 1 UI kit (`src/components/kit/`)** — `KpiCard`, `Sparkline`, `PayloadViewerModal`, `DateRangeFilter` are production-ready with colocated Vitest suites. Phase 3 imports as-is.
- **Phase 1 hooks (`src/hooks/`)** — `useDateRange` provides the URL contract Phase 3 extends with `useSpecialistFilter` (`?specialists=`) and `useModeFilter` (`?mode=`). `useTimezone` provides ET formatters; SQL bucketing in D-30 must use the same `'America/New_York'` zone.
- **v1.0 components retained (Phase 1 D-25)** — `EmptyState`, `ErrorState`, `FilterInput`, `SortIndicator`, `TableSkeleton`, `BackLink` reused opportunistically. Phase 3 uses all six (BackLink for nested-route headers, FilterInput for table column filters, SortIndicator for table headers).
- **Phase 2 deliverables** (assumed shipped before Phase 3 starts) — `src/lib/devAccess.ts` exporting `isDevAccount`, `@tanstack/react-table` v8.21.3 dep, `<DeveloperPanel>` patterns, `services/<feature>/queries.ts` + `hooks/<feature>/` layout. Phase 3 follows the established shape.
- **Auth store (`src/stores/authStore.ts`)** — exposes `{ session, profile, isAdmin }`. `isDevAccount(profile.email)` reads via the same store (one source).
- **`src/main.tsx`** — `QueryClientProvider` is module-level: `staleTime: 60s`, `retry: 1`, `refetchOnWindowFocus: false`. Phase 3 follows. Per-hook overrides: `useSignedPhotoUrl` enables `refetchOnWindowFocus`; `useUiRecentEventsFeed` sets `refetchInterval: 10000` and `staleTime: 0`.
- **`src/db/database.types.ts`** — currently reflects pre-Phase 2 schema. Phase 3 regenerates after its own migrations (RPCs only — Phase 3 adds no new columns and no new tables).
- **TPC App photo storage bucket (`photos`)** — already provisioned, private. RLS: admins full access. Dashboard admin user can `createSignedUrl` against it directly via the anon client + admin session.

### Established Patterns

- **TanStack Query**: module-level QueryClient, `staleTime: 60s`, `refetchOnWindowFocus: false`, `retry: 1`. Phase 3 follows. Per-hook overrides documented in D-08, D-11, D-32.
- **Supabase queries**: typed via `Database` from `src/db/database.types.ts`. RPCs called via `supabase.rpc('get_xxx', { p_from, p_to, p_specialists, p_mode })`.
- **RLS**: every policy calls `private.is_admin()` (statement-cached subquery wrapper, Phase 1 pattern). Phase 3's RPCs are `security invoker` (default), so the admin SELECT policies on each TPC App table govern reads. Existing TPC App RLS already supports admin-read-all (`profiles`, `sessions`, `items`, `photos`, `export_history`, `ui_interactions`).
- **Tailwind v4**: `@tailwindcss/vite` plugin; classes inline. Page layout uses utility classes — no custom CSS.
- **Migrations**: timestamped `YYYYMMDDHHMMSS_<name>.sql`. Idempotent where possible (`create or replace function` for RPCs). Forbidden: `supabase db pull`, `supabase db reset --linked`. Allowed: `supabase db push`, `supabase gen types`.
- **ESLint v9 flat config + Vitest**: every new component/hook ships with a colocated `*.test.tsx` / `*.test.ts`. Recharts JSDom mock pattern (Phase 1 / 01-05) is reusable for the donut, stacked bar, horizontal stacked bar, and house-vs-sale split charts.
- **URL-driven filters**: Phase 1 D-20 set the precedent; Phase 2 D-17 extended. Phase 3 extends again with `?specialists=` + `?mode=`. No Zustand for filters.
- **Render-conditional dev gate**: `isDevAccount(profile?.email) ? <DevOnlyComponent /> : null`. NOT `display: hidden` — the dev component is not in the DOM at all for non-dev users. Same discipline as Phase 2 D-15.

### Integration Points

- **`src/App.tsx`** — Phase 2 will have added `<Route path="/extension">`. Phase 3 adds (a) `<Route path="/activity" element={<ActivityPage />} />`, (b) `<Route path="/activity/sessions/:id" element={<SessionDetailPage />} />`, (c) `<Route path="/activity/stuck" element={<StuckItemsPage />} />`, all inside the `<DashboardLayout>` group. None of these are dev-only routes — page-level gating is via the `<DeveloperPanel>` and per-row dev affordances inside the pages.
- **`src/layouts/DashboardLayout.tsx`** — `NAV_ITEMS` will have one entry from Phase 2 (`/extension`). Phase 3 appends the second entry: `{ label: 'Activity', to: '/activity', Icon: ... }`. Phase 5 will append `/live` later.
- **`src/lib/supabase.ts`** — Phase 3 hooks import the anon client. The admin client (`scraper/lib/supabase-admin.ts`) is NEVER imported from `src/` — the prebuild grep guard catches it.
- **Shared Supabase project** — same URL/anon key as TPC App. Phase 3 RPCs land via `supabase db push` from this repo. Types regen via `npm run db:types` writes to `src/db/database.types.ts` and is committed.
- **`src/lib/devAccess.ts`** — Phase 2 ships this module. Phase 3 imports `isDevAccount` and adds NO new exports here. If Phase 3 needs a separate dev/admin distinction, it adds a sibling helper rather than mutating the allowlist constant.
- **TPC App Storage bucket (`photos`)** — Phase 3 reads via `supabase.storage.from('photos').createSignedUrl(thumbnail_path, 3600)`. Storage RLS already grants authenticated `select` on `bucket_id = 'photos'`.

</code_context>

<specifics>
## Specific Ideas

- **The dev-panel split mirrors Phase 2 deliberately.** Same gate (`isDevAccount`), same module (`src/lib/devAccess.ts`), same render-conditional discipline, same collapsed-by-default `<DeveloperPanel>` placement (bottom of page). One mental model across `/extension` and `/activity`.
- **`/activity` is the first page where filters apply asymmetrically across widgets.** The "right-now vs range" rule (D-14..D-21) is the most-likely-to-be-forgotten invariant. Plans should call it out in component headers and in `services/activity/queries.ts` JSDoc. Code review checklist item: "every new chart/card on `/activity` MUST be classified explicitly as right-now or range-driven".
- **Photo signed-URL refetch-on-focus is the only piece that doesn't have a Phase 2 precedent.** Worth a small Vitest behavior test that fires a synthetic `visibilitychange` event and asserts the per-photo query refetches. The hook becomes load-bearing on Success Criterion #5.
- **Photos with `upload_status = 'failed'` MUST NOT issue `createSignedUrl` calls.** D-13 bars it. The hook either short-circuits on a `disabled` flag or the call site never invokes the hook for failed photos. Either approach is fine; pick one in plan.
- **Stuck Items threshold ("2 hours") is hard-coded in the RPC, not a parameter.** D-24 is explicit. If product ever wants a configurable threshold, that's a v2.1+ ADR.
- **`ui_interactions` is high-volume.** The Recent Events Feed will tail FAST. If operator UAT shows it scrolls too aggressively, the plan should leave the `refetchInterval` value as a single constant easy to tune.
- **The 14-day stacked bar (APP-03) is fixed-window** (D-16). Don't let the date range filter reach into it. Same precedent as Phase 2 EXT-01.
- **Mode filter on items lives at `sessions.mode`, not `items.mode`** (D-20). They're meant to be equal; the dashboard treats `sessions.mode` as canonical. Plan should not introduce a fallback that splits on `items.mode`.

</specifics>

<deferred>
## Deferred Ideas

- **Specialist activity heatmap (7×24 grid)** — APP-FUT-01 in REQUIREMENTS.md. Out of scope for Phase 3.
- **Per-specialist sparkline roster** — APP-FUT-02. Out of scope.
- **Session age distribution histogram** — APP-FUT-03. Out of scope.
- **Export history table** — APP-FUT-04. Phase 3 surfaces export volume via the Export Pipeline horizontal stacked bar (APP-05); a dedicated history table is deferred.
- **Specialist-only view (own activity only)** — `AUTH-FUT-01`. Single-admin scope holds; Phase 3 does not change auth model.
- **Full-size photo viewer / lightbox inside `/activity/sessions/:id`** — D-12 limits Phase 3 to thumbnails. A v2.1+ ItemDetail drilldown would sign `storage_path` and render a lightbox.
- **`/dev/ui-activity` standalone route** — Phase 3 inlines `ui_interactions` into the `/activity` `<DeveloperPanel>` (D-31). If the dev surface grows beyond a panel-sized accordion, promote to its own route.
- **Configurable Stuck Items threshold** — D-24 hard-codes 2h. Defer.
- **Configurable severity tone thresholds for the alert card** — D-22 starts with N≥5 yellow / oldest>6h red. If operator UAT shows misclassification, expose as constants in a config module.
- **Walkthrough funnel time-to-completion histogram** — D-32 ships count-per-step. Time-between-steps is a richer signal but out of scope.
- **`ui_interactions` per-element friction view (avg time-on-element, error-rate-near-element)** — out of scope. Phase 3 ships top-N counts only.
- **Cross-app comparison panel ("`tpc-app` vs `tpc-extension` activity side-by-side")** — possible future use of the `app_source` column on both tables; would belong on a new route.
- **TanStack Query `refetchInterval` on the right-now widgets (Today KPI, Active Sessions, Stuck Items alert card)** — Phase 3 ships with default `staleTime: 60s` (D-25). If the page feels stale during operational use, add `refetchInterval: 30000` as a follow-up — the patch is two lines per hook.
- **Roles-based dev panel gating** (instead of email allowlist) — Phase 2 D-16 chose the email allowlist; Phase 3 inherits. Same upgrade path applies.
- **`useSignedPhotoUrl` extension to non-photo bucket objects** — generalize the hook into `useSignedStorageUrl(bucket, path, ttl)` if a future phase needs signed URLs for a different bucket. Not needed in v2.0.

</deferred>

---

*Phase: 03-tpc-app-activity-activity*
*Context gathered: 2026-04-30*
