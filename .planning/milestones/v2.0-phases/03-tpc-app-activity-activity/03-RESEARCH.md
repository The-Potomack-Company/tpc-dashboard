# Phase 3: TPC App Activity (`/activity`) — Research

**Researched:** 2026-04-30
**Domain:** React 19 + Supabase admin analytics over five TPC App tables (`profiles`, `sessions`, `items`, `photos`, `export_history`) plus `ui_interactions`; private-bucket signed-URL UX; URL-driven asymmetric filter scope; nested route + drawer route + dev-panel composition
**Confidence:** HIGH (every stack pin verified against npm registry; every TPC App schema constraint verified against `~/Projects/TPC_App/TPC_App/supabase/migrations/`; every Phase 1/2 reusable asset opened and read; every locked decision in CONTEXT D-01..D-37 mapped to a concrete deliverable)

---

## Summary

Phase 3 ships **three routes (`/activity`, `/activity/sessions/:id`, `/activity/stuck`) backed by ~9 Postgres RPCs and ~7 raw `.from().select()` builders, ~20 typed React hooks, and ~25 React components.** Every one of the 37 locked decisions in `03-CONTEXT.md` has a direct file deliverable in `03-UI-SPEC.md § Component Inventory` (verified — every CONTEXT decision has an SPEC counterpart). The plan structure mirrors Phase 2's 5-wave shape exactly (Wave 1 = SQL surface + filter hooks + libs / Wave 2 = service + hook layer / Wave 3 = admin chart components / Wave 4 = nested-route page components + dev-panel sub-panels / Wave 5 = page assembly + smoke + verification) — the only structural deviation is that Phase 3 has THREE page shells to assemble in Wave 5 rather than Phase 2's one.

**Three pieces are net-new to the dashboard codebase and load-bearing on phase success:**

1. **`useSignedPhotoUrl` hook** (`src/hooks/useSignedPhotoUrl.ts`) — per-photo TanStack Query with `refetchOnWindowFocus: true` + `staleTime: 50min` + `gcTime: 10min` overriding the global `refetchOnWindowFocus: false` default. **This single hook is the entire mechanism for Success Criterion #5** (thumbnails survive a 2-hour tab-resume); a Vitest test that fires a synthetic `visibilitychange` after a fast-forward past `staleTime` and asserts a refetch is the gate.
2. **Filter-scope discipline** — D-14..D-21 split widgets into "right-now" (Today KPI, Active Sessions, Stuck Items, 14-day stacked bar) vs "range-driven" (AI status donut, Export Pipeline, House-vs-Sale, Failed-AI Breakdown, ui_interactions Top Pages/Elements) vs "live tail" (ui_interactions Recent Events Feed) vs "right-now per-user state" (Walkthrough Funnel). The master rule is the most-likely-to-be-forgotten invariant; a code-review checklist item plus a JSDoc-class-tag convention on every hook + RPC is the enforcement.
3. **Three-table specialist join story** — `sessions.assigned_to` is a `uuid REFERENCES auth.users(id)` (NOT an FK to `profiles.id`). To get a specialist's `display_name`, RPCs and PostgREST queries must join via `profiles` on `profiles.id = sessions.assigned_to`. The `SpecialistMultiSelect` URL param uses **email** (per UI-SPEC), but server-side joins MUST use `profiles.id`/`auth.uid` UUIDs — emails are looked up server-side via `email = ANY(p_specialist_emails)` against `profiles`.

**Primary recommendation:** Build the SQL surface FIRST in Wave 1 (one migration with all 9 RPCs, types regen blocking the wave), then assemble bottom-up the same way Phase 2 did. Do **not** pre-flight a generic activity-query abstraction. Every chart's hook has a different return shape and a different filter-scope class — typed-per-hook is the right shape.

---

## User Constraints (from CONTEXT.md)

> Locked-decision verbatim copy. The planner MUST honor these. Discuss-time discretion areas are also copied so the planner can make sane defaults without re-asking the user.

### Locked Decisions (D-01..D-37, verbatim from `03-CONTEXT.md`)

**Page Structure & Routing**

- **D-01** `/activity` is a single page composed top-to-bottom: Today KPI strip → Active Sessions table → Stuck Items alert card → 14-day items-per-specialist stacked bar → AI-status donut + House-vs-Sale split (paired) → Export Pipeline horizontal stacked bar → DeveloperPanel (collapsed, dev-only). Page header carries `<DateRangeFilter>`, specialist multi-select, session-mode toggle.
- **D-02** Session Detail = dedicated route `/activity/sessions/:id` (NOT drawer/modal).
- **D-03** Session Detail nested under `/activity` so URL filter params (`?range=`, `?specialists=`, `?mode=`) preserved across navigation. Browser back lands on `/activity` with same filter state.
- **D-04** Session Detail layout: metadata card LEFT, Photo Coverage panel RIGHT (above item list), item list FULL WIDTH below. Coverage panel is **numeric only** — no thumbnails.
- **D-05** Session Detail item list = **TanStack Table v8** (`^8.21.3` already shipped by Phase 2 plan 02-05). Columns: receipt_number, title, ai_status, photo_count. Sortable per column, sticky header, simple client-side pagination (50 rows).
- **D-06** Thumbnails appear via per-item row expansion in the item list. Click a row to disclose inline thumbnail strip for that item only. Mass thumbnail grids NOT used.
- **D-07** `/activity/stuck` = dedicated nested route. Bookmarkable triage page. Triggered from alert card on `/activity`.

**Photo Signed-URL Strategy**

- **D-08** Primary mechanism = **refetch-on-window-focus + per-photo TanStack Query**. Each photo URL is its own `useQuery({ queryKey: ['signed-photo-url', path] })`. Query overrides global default with `refetchOnWindowFocus: true`.
- **D-09** Lazy fetch timing — mounting `/activity/sessions/:id` only fetches photo metadata, NOT signed URLs. Signed URL fetched only when admin clicks an item row.
- **D-10** Hook lives at `src/hooks/useSignedPhotoUrl.ts` (shared, not phase-scoped).
- **D-11** Cache parameters: TTL=3600s (matches TPC App), staleTime=50min, refetchOnWindowFocus: true, retry: 1, gcTime: 10min.
- **D-12** `thumbnail_path` only — no full-size in Phase 3.
- **D-13** `upload_status='failed'` photos render inline error chip — **NO `createSignedUrl` call** for those photos.

**Filter Scope (master rule: range applies to `created_at`-based aggregates only; "right-now" widgets ignore range; specialist + mode apply to BOTH)**

- **D-14** Today KPI strip (APP-01) anchored to today regardless of selected range. Previous-period delta = "today vs yesterday" (N=1 day).
- **D-15** Active Sessions table (APP-02) always-current. Queries `WHERE status = 'active'` regardless of date range. Sortable by age (`now() - created_at`) and specialist.
- **D-16** 14-day items-per-specialist stacked bar (APP-03) = fixed-window: trailing 14 days bucketed daily in ET.
- **D-17** AI-status donut (APP-04), Export Pipeline (APP-05), House-vs-Sale (APP-12) = range-driven on `items.created_at` / `sessions.created_at`.
- **D-18** Stuck Items (APP-11) uses its own rule: `ai_status IN ('processing','queued') AND created_at < now() - interval '2 hours'`. Independent of date range.
- **D-19** Specialist multi-select (APP-08) sources from `profiles WHERE is_active = true AND role = 'specialist'`. Admin role excluded. Specialists with zero activity in range still rendered. Deactivated specialists excluded from dropdown but historical rows still appear.
- **D-20** Mode filter (APP-09) targets `sessions.mode` (canonical). `items.mode` is treated as redundant.
- **D-21** Default range on landing = `7d` (Phase 1 D-17 carryover). URL params: `?range=today|7d|30d|custom`, `?specialists=email1,email2`, `?mode=house|sale|all`.

**Stuck Items**

- **D-22** Alert card on `/activity` shows count, age-of-oldest, severity tone (yellow N≥5, red oldest>6h), CTA. Quiet success at N=0.
- **D-23** `/activity/stuck` columns: receipt_number, title, ai_status, age, session.name, specialist. Click row → `/activity/sessions/:id`. Filters from `/activity` NOT inherited.
- **D-24** **Server-side RPC `get_stuck_items(p_specialists text[], p_mode text)`**. 2h threshold **hard-coded inside RPC**, NOT a parameter. Card uses count + max(age) from same RPC.
- **D-25** Card refetch cadence = TanStack default `staleTime: 60s`, no `refetchInterval`. Same for donut, export pipeline, other static aggregates.

**Admin / Developer Surface Split**

- **D-26** Identity gate = email allowlist from `src/lib/devAccess.ts` (Phase 2 plan 02-02 ships this — verified file exists). Phase 3 imports `isDevAccount` as-is, no new exports.
- **D-27** Admin surface (always rendered): Today KPI, Active Sessions, 14-day stacked bar, AI-status donut, Export Pipeline, House-vs-Sale, Stuck Items alert, Session Detail with photo coverage, `/activity/stuck`, filters.
- **D-28** Developer surface: Raw Item Inspector inside Session Detail per-item disclosure; raw storage_path strings under thumbnails + "view full-size" link signing storage_path; extra columns on `/activity/stuck` (category, estimate, raw photo paths, view-raw-item-JSON); `<DeveloperPanel>` at bottom of `/activity` housing Failed-AI Breakdown + `ui_interactions` panel.
- **D-29** Failed-AI Breakdown panel — KPIs for `items.ai_status='failed'` over selected range, by specialist + mode + items.category. RPC `get_failed_ai_breakdown(p_from, p_to, p_specialists, p_mode)`.
- **D-30** All Phase 3 RPCs follow Phase 2 D-12/D-13 server-aggregation pattern. Per-chart RPCs, `date_trunc(... AT TIME ZONE 'America/New_York')` server-side bucketing. Shared filter signature `(p_from timestamptz, p_to timestamptz, p_specialists text[], p_mode text)` for range-driven; `(p_specialists text[], p_mode text)` for right-now. Non-aggregating queries use raw `.from().select()` with embedded joins. Layout: `src/services/activity/queries.ts` + `src/hooks/activity/`.

**`ui_interactions` Dev Panel**

- **D-31** Lives inside `/activity` `<DeveloperPanel>` (collapsed by default).
- **D-32** Sub-panels: Top Page Paths (RPC `get_ui_top_pages`), Top Element Clicks (RPC `get_ui_top_elements`), Walkthrough Funnel (RPC `get_walkthrough_funnel`, ignores date range), Recent Events Feed (10s `refetchInterval`, mirrors Phase 2 LiveEventFeed). Row click opens `<PayloadViewerModal>`.
- **D-33** **Hard filter `app_source = 'tpc-app'` on every `ui_interactions` query** — RPC bodies + service layer. Code review checklist item enforces.
- **D-34** Filter scope: range applies to date-windowed sub-panels (Top Pages, Top Elements, Failed-AI Breakdown). Walkthrough Funnel + Recent Events ignore date range. **Specialist + mode filters do NOT apply to `ui_interactions`** (table joins on `user_id`, not `items.created_by`/`sessions.assigned_to`).

**Empty / Loading / Error UX**

- **D-35** Per-card empty + per-card loading + per-card `<ErrorState>` with `refetch()`-bound retry. **Locked `<ErrorState>` contract** (Phase 2 verification 2026-04-29, also re-verified by reading `src/components/ErrorState.tsx` 2026-04-30): props are `{ heading: string; body: string; onRetry: () => void }`. Component renders its own internal Retry. Sibling Retry buttons forbidden. Children syntax forbidden — body is a plain string.
- **D-36** No page-level Suspense boundary. Same as Phase 2 D-21.
- **D-37** No full-page empty state for `/activity` (TPC App tables populated from day one; empty `sessions` is genuinely anomalous). Each card shows its per-card empty if zero rows. Diverges from Phase 2 D-19.

### Claude's Discretion (planner picks defaults; UI-SPEC has already committed many)

- Tailwind class choices for layout (KPI strip grid, chart grid, card spacing) — match `/kit` and `/extension` visuals. **UI-SPEC has committed** specific layouts (see `03-UI-SPEC.md § Layout Specifications`).
- Severity-threshold constants for Stuck Items alert tone — **UI-SPEC committed** `yellowCount: 5`, `redAgeHours: 6`, lifted to `src/lib/severity.ts`.
- Pagination size for `/activity/stuck` and Session Detail item list — **UI-SPEC committed** 50 rows per page (TanStack Table client-side).
- TanStack Query `staleTime` overrides per hook — none expected; Recent Events Feed sets `staleTime: 0` per Phase 2 D-09/D-10.
- Recharts donut color choices for AI status — **UI-SPEC committed** `AI_STATUS_COLOR` map; failed slice = pulled-out via `<Cell outerRadius>` +4px.
- Severity tone hex values + alert card animation — **UI-SPEC committed** static, no pulsing.
- Active Sessions sort defaults — **UI-SPEC committed** age descending (oldest first).
- `<DeveloperPanel>` open-state localStorage persistence — **UI-SPEC committed** ship without persistence (page mount = collapsed).
- Walkthrough funnel step list / ordering — **defer to plan-time** after reading TPC App's emitter (`grep -rn walkthrough_step ~/Projects/TPC_App/TPC_App/src/`). Research finding: TPC App emits `walkthrough_step` interaction_type via `trackUiInteraction` from `src/components/Walkthrough.tsx`; the `step` is carried in `metadata->>step` (NOT a top-level column). RPC must extract via `metadata->>'step'`.
- `get_stuck_items` shape (single RPC vs paired card-summary) — **plan-time decision** based on row volume in prod. Recommendation below: ship a single RPC; the card derives count + maxAge from the same RPC result client-side. ~50-200 rows max in worst case is trivial payload.
- `ui_interactions.user_email` derivation when `user_id` is set but email is null — research finding: TPC App always writes both columns simultaneously in `trackUiInteraction` (verified `~/Projects/TPC_App/TPC_App/src/services/analytics.ts:107..125`). No JOIN needed; trust `user_email` directly.

### Deferred Ideas (OUT OF SCOPE)

- Specialist activity heatmap 7×24 grid (APP-FUT-01).
- Per-specialist sparkline roster (APP-FUT-02).
- Session age distribution histogram (APP-FUT-03).
- Export history table (APP-FUT-04).
- Specialist-only view (AUTH-FUT-01).
- Full-size photo viewer / lightbox inside `/activity/sessions/:id` — D-12 limits Phase 3 to thumbnails.
- `/dev/ui-activity` standalone route — Phase 3 inlines `ui_interactions` into the `/activity` `<DeveloperPanel>`.
- Configurable Stuck Items threshold — D-24 hard-codes 2h.
- Configurable severity tone thresholds — D-22 starts with N≥5 yellow / oldest>6h red.
- Walkthrough funnel time-to-completion histogram.
- `ui_interactions` per-element friction view.
- Cross-app comparison panel.
- TanStack Query `refetchInterval` on right-now widgets — Phase 3 ships with `staleTime: 60s` default.
- Roles-based dev panel gating — Phase 2 chose email allowlist; Phase 3 inherits.
- `useSignedPhotoUrl` extension to non-photo bucket objects — generalize later if needed.

---

## Phase Requirements

| ID | Description (verbatim REQUIREMENTS.md) | Research Support |
|----|----------------------------------------|------------------|
| APP-01 | Today KPI strip showing sessions/items/exports today + % AI done, each with prev-period delta | Server RPC `get_today_kpis(p_specialists, p_mode)` returns 4 stats + 4 prev-day stats in one call. `<KpiCard>` already supports the `delta` prop (Phase 1 D-13). |
| APP-02 | Active sessions table — name, mode, specialist, item_count, created_at, last_updated_at, age; sortable by age + specialist | Raw PostgREST `.from('sessions').select('id,name,mode,assigned_to,created_at,updated_at, profiles!sessions_assigned_to_fkey(display_name), items!inner(count)').eq('status','active')`. **Caveat below:** `assigned_to` references `auth.users`, not `profiles` — explicit FK hint required. |
| APP-03 | 14-day stacked bar of items cataloged per day, stacked by specialist | RPC `get_items_per_specialist_14d(p_specialists, p_mode)` returns `(day timestamptz, specialist_email text, specialist_display_name text, item_count bigint)` with `LEFT JOIN generate_series(...)` × specialist crossjoin for zero-cell fill (mirrors Phase 2 `get_event_volume_daily`). Server bucket via `date_trunc('day', items.created_at, 'America/New_York')`. |
| APP-04 | AI-status donut (pending/processing/done/queued/failed) for items in selected range; failed slice visually distinct | RPC `get_ai_status_distribution(p_from, p_to, p_specialists, p_mode)` returns 5 rows. Recharts `<Pie>` with per-`<Cell>` `outerRadius` +4px on failed cell. Test with the Phase 1 Recharts mock pattern (`vi.mock('recharts', ...)`). |
| APP-05 | Export pipeline horizontal stacked bar of sessions grouped by status (active/submitted/returned/exported) over selected range | RPC `get_export_pipeline(p_from, p_to, p_specialists, p_mode)` returns 4 rows (one per status). **Schema warning:** the original migration constrains status to 4 values, but `20260320000000_add_completed_status.sql` extended the CHECK to add `'completed'` — Phase 3 must decide whether to expose `'completed'` as a 5th category or coalesce it into `'exported'`. **Recommendation: include `'completed'` as a 5th segment** (see Open Question #1 below). |
| APP-06 | Session Detail view (route or drawer) — metadata + items list with receipt_number, title, ai_status, photo count | D-02 chose route `/activity/sessions/:id`. Raw PostgREST `.from('sessions').select('*, items(id,receipt_number,title,ai_status, photos(count))').eq('id', sessionId).single()`. |
| APP-07 | Date range filter (Today/7d/30d/custom) via shared `<DateRangeFilter>`; URL-reflected | Phase 1 D-15..D-20 deliverable already shipped. Phase 3 just uses `useDateRange()`. |
| APP-08 | Specialist multi-select from active `profiles.role='specialist'` | New shared `<SpecialistMultiSelect>` component reading from a one-shot `useActiveSpecialists()` query (`profiles WHERE is_active=true AND role='specialist'` ordered by display_name). New `useSpecialistFilter()` hook for `?specialists=email1,email2` URL contract — mirrors Phase 2 `useUserFilter`. |
| APP-09 | Mode filter (house/sale/all) | New `<ModeToggle>` segmented buttons + `useModeFilter()` hook reading `?mode=house|sale|all`. Default = `all` (no `?mode` param). |
| APP-10 | Inside Session Detail: photo coverage panel — items with ≥1 vs 0 photos, upload_status breakdown, failed callout | RPC `get_photo_coverage(p_session_id uuid)` returns `{ items_total, items_with_photos, items_without_photos, status_counts: {pending, uploading, uploaded, failed} }` shape — single row, jsonb sub-objects. Alternatively, two simple counts. |
| APP-11 | Stuck items alert — items `ai_status IN ('processing','queued')` older than 2h | RPC `get_stuck_items(p_specialists, p_mode)` returns one row per stuck item (six display columns server-joined). 2h threshold hard-coded inside RPC body (D-24). Card derives `count(*) + max(now() - created_at)` client-side. |
| APP-12 | House-vs-sale split (small paired KPIs or pie) over selected range | RPC `get_house_sale_split(p_from, p_to, p_specialists, p_mode)` returns 2 rows: `{ mode: 'house', n_sessions, n_items }` and same for `'sale'`. UI-SPEC committed paired-KPI layout (NOT pie). |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Daily/14-day aggregation by specialist | **Database (Postgres RPC)** | — | D-30: server-side `date_trunc(... 'America/New_York')` agrees with `useTimezone` boundaries; specialists join in SQL. |
| AI status / Export pipeline / House-vs-Sale aggregation | **Database (Postgres RPC)** | — | D-30: same server-aggregation rationale as Phase 2 D-12/D-13. |
| Failed-AI Breakdown by specialist × mode × category | **Database (Postgres RPC)** | — | D-29: 3-dimensional GROUP BY is cheaper server-side. |
| Stuck items list (six display columns joined) | **Database (Postgres RPC)** | — | D-24: server-side `JOIN sessions JOIN profiles` returns wide rows; 2h threshold hard-coded server-side so card and page can never drift. |
| Active sessions list, Session Detail item list, Today KPIs (single row), Photo coverage (single row) | **Database (PostgREST raw select OR small RPC)** | — | Non-aggregating shapes use `.from().select()` with embedded joins via `profiles!sessions_assigned_to_fkey(display_name)`; Today KPIs may also be a small wrapper RPC for cleanliness. |
| Photo signed URLs | **Supabase Storage (private bucket)** | Browser (TanStack Query cache) | `supabase.storage.from('photos').createSignedUrl(thumbnail_path, 3600)`; per-photo `useQuery` cache layer with `refetchOnWindowFocus: true` overrides global default. |
| Filter state (range, specialists, mode) | **Browser URL (`useSearchParams`)** | React (`useDateRange`, `useSpecialistFilter`, `useModeFilter`) | D-21 + Phase 1 D-20: URL is single source of truth; no Zustand. |
| Auth gating | **API (RLS via `private.is_admin()`)** | Browser (`isDevAccount(email)`) | D-26: admin gate at DB layer; dev gate is purely UI. |
| Per-row disclosure (item list) | **Browser (TanStack Table v8 expanding API)** | — | `getCanExpand()` + `getIsExpanded()` + `getToggleExpandedHandler()`; expanded body rendered as a separate `<tr>` spanning all columns (verified pattern in v8 docs). |
| `ui_interactions` aggregation (top pages, top elements, walkthrough funnel) | **Database (Postgres RPC)** | — | D-32: server-side GROUP BY; walkthrough step extracted via `metadata->>'step'`. |
| `ui_interactions` recent events tail | **Database (PostgREST raw select)** | Browser (TanStack `refetchInterval: 10s`) | D-32 mirrors Phase 2 EXT-08 / D-09. |
| AI status donut, House-vs-Sale split rendering | **Browser (Recharts)** | — | Recharts SVG renders client-side; same JSDom mock pattern as Phase 1 / 2. |

---

## Standard Stack

### Core (zero new runtime dependencies — every Phase 3 need is met by already-shipped pinned versions)

| Library | Version (verified) | Verification | Purpose | Why Standard |
|---------|--------------------|---------------|---------|--------------|
| react | ^19.2.0 | `package.json:22` | UI framework | Project pin — same as TPC App, Phase 1, Phase 2 |
| typescript | ~5.9.3 | `package.json:48` | Type safety | Project pin |
| vite | ^7.3.1 | `package.json:50` | Build tool | Project pin |
| tailwindcss | ^4.2.1 | `package.json:46` | Styling | Project pin |
| react-router | ^7.13.1 | `package.json:24` | Routing (`/activity/sessions/:id` nested) | Already pinned; Phase 3's three-route addition is straightforward `<Route>` composition |
| @supabase/supabase-js | ^2.101.1 | `package.json:17`; `[VERIFIED: npm view @supabase/supabase-js version → 2.101.1]` | DB client + Storage signed URLs | Already pinned |
| @tanstack/react-query | ^5.99.2 | `package.json:18`; `[VERIFIED: npm view @tanstack/react-query version → 5.100.6]` | Server-state caching, refetch-on-focus, refetchInterval | Phase 1/2 already use it; Phase 3 adds per-query `refetchOnWindowFocus: true` overrides |
| @tanstack/react-table | ^8.21.3 | `package.json:19`; `[VERIFIED: npm view @tanstack/react-table version → 8.21.3]` | TanStack Table v8 (Active Sessions, Session item list, Stuck Items page, dev-panel ui_interactions tables) | Already shipped by Phase 2 plan 02-05 |
| recharts | ^3.8.1 | `package.json:25`; `[VERIFIED: npm view recharts version → 3.8.1]` | Charts (14-day stacked bar, AI status donut, Export Pipeline horizontal stacked bar, Walkthrough Funnel) | Already shipped by Phase 1 / 01-05 |
| zustand | ^5.0.11 | `package.json:27` | Auth store (`isDevAccount` reads `profile.email` via `useAuthStore`) | Already pinned; Phase 3 only consumes |
| zod | ^4.3.6 | `package.json:26` | Available for any boundary validation; not strictly required this phase | Already pinned |
| date-fns | ^4.1.0 | `package.json:20` | Used by `useDateRange`, `useTimezone`, new `formatAge` helper | Already pinned |
| date-fns-tz | ^3.2.0 | `package.json:21` | ET formatting | Already pinned |

**Installation (CONFIRMED):** ZERO new runtime dependencies needed for Phase 3. The only Phase 3 changes to dependencies are inadvertent indirect updates if `npm install` runs — explicitly avoid. **`[VERIFIED]`**

### Dev Tooling (no changes)

| Library | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.0.18 | Unit/integration testing — same JSDom + RTL pattern Phase 1 / 2 use |
| @testing-library/react | ^16.3.2 | Component tests |
| @testing-library/user-event | ^14.6.1 | User interaction simulation |
| jsdom | ^28.1.0 | DOM environment for component tests |
| eslint | ^9.39.1 | Lint |
| supabase (CLI) | ^2.81.3 | `db:push` + `db:types` |

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Phase 3 Implication |
|-----------|--------|---------------------|
| `src/` MUST NOT import `scraper/lib/supabase-admin.ts` | CLAUDE.md § Service-role admin client rule 1 | Phase 3 is pure-frontend. All hooks use `src/lib/supabase.ts` (anon client). RPCs are called via the anon client; admin RLS gates them. **The signed-URL hook calls `supabase.storage.from('photos').createSignedUrl(...)` via the anon client — this works because the user's admin session is in the JWT sent with the storage request, and `storage.objects` RLS already allows authenticated SELECT on `bucket_id = 'photos'` (verified in TPC App migration `20260320200000_create_photos.sql:81-85`).** |
| `src/` reads env via `import.meta.env.VITE_*` | rule 2 | No `process.env` in any Phase 3 code. |
| Prebuild guard fails if `SUPABASE_SERVICE_ROLE_KEY` appears in `src/`, `index.html`, or `vite.config.ts` | rule 3 (`scripts/check-no-service-role-in-src.mjs`) | Phase 3 cannot regress this. |
| Phase 3 is read-only | CONTEXT § Phase Boundary | NO writes to TPC App tables. NO mutation of `photos.upload_status`. NO schema changes to TPC-App-owned objects. New dashboard objects = RPCs only. NO Realtime enablement. NO Playwright / scraper code. |
| GSD workflow enforced | CLAUDE.md § GSD Workflow Enforcement | All Phase 3 plans go through `/gsd-execute-phase`. |
| Forbidden Supabase CLI commands: `supabase db pull`, `supabase db reset --linked` | STATE.md decision (Phase 1 v1.0) | Phase 3 RPC migration ships via `supabase db push` only. |
| Stack pins | CLAUDE.md § Technology Stack | All Phase 3 deps already at pinned versions; ZERO new runtime deps. |

---

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────── BROWSER ──────────────────────────────────────────┐
│                                                                              │
│  URL ?range=7d&specialists=a@x.com,b@y.com&mode=all                          │
│         │                                                                    │
│         ▼                                                                    │
│   ┌─────────────────────────────────────────────────────────┐                │
│   │ useDateRange() / useSpecialistFilter() / useModeFilter() │                │
│   │ → { from, to, range, specialists, mode }                │                │
│   └────────────────┬────────────────────────────────────────┘                │
│                    │                                                         │
│                    ▼ (folded into queryKey, sorted)                          │
│   ┌─────────────────────────────────────────────────────────┐                │
│   │ src/hooks/activity/use*.ts (TanStack Query useQuery)    │                │
│   │   useTodayKpis            → right-now (specialists+mode) │                │
│   │   useActiveSessions       → right-now (specialists+mode) │                │
│   │   useStuckItems           → right-now (specialists+mode) │                │
│   │   useItemsPerSpecialist   → fixed-window (specialists+mode) │            │
│   │   useAiStatusDistribution → range-driven                │                │
│   │   useExportPipeline       → range-driven                │                │
│   │   useHouseSaleSplit       → range-driven                │                │
│   │   useFailedAiBreakdown    → range-driven (dev)          │                │
│   │   useUiTopPages, useUiTopElements → range-driven (dev)  │                │
│   │   useWalkthroughFunnel    → right-now (dev, ignores all)│                │
│   │   useUiRecentEventsFeed   → live tail (dev)             │                │
│   │   useSignedPhotoUrl       → per-photo, refetch-on-focus │                │
│   │   useSessionDetail, usePhotoCoverage, useActiveSpecialists│              │
│   └────────────────┬────────────────────────────────────────┘                │
│                    │                                                         │
│                    ▼                                                         │
│   ┌─────────────────────────────────────────────────────────┐                │
│   │ src/services/activity/queries.ts                        │                │
│   │   - RPC wrappers (.rpc('get_xxx', {...}))               │                │
│   │   - Raw .from() builders (active sessions, item list,   │                │
│   │     stuck items, recent UI events, photo coverage)      │                │
│   │   - All supabase calls live here; hooks never call      │                │
│   │     supabase directly                                   │                │
│   └────────────────┬────────────────────────────────────────┘                │
│                    │                                                         │
└────────────────────┼─────────────────────────────────────────────────────────┘
                     │ HTTPS + JWT (admin session)
┌────────────────────┼─────────────────────────────────────────────────────────┐
│                    ▼                                                         │
│   ┌──────────────────────────────────────────────────────┐  SUPABASE         │
│   │ PostgREST (anon key + admin JWT)                     │                   │
│   └────────┬───────────────────────┬─────────────────────┘                   │
│            │                       │                                         │
│            ▼ rpc()                 ▼ from(...).select()                      │
│   ┌─────────────────────┐    ┌──────────────────────────┐                    │
│   │ Phase 3 RPCs        │    │ TPC App tables           │                    │
│   │ (security invoker)  │    │  profiles                │                    │
│   │  get_today_kpis     │    │  sessions                │                    │
│   │  get_items_per_...  │    │  items                   │                    │
│   │  get_ai_status_...  │    │  photos                  │                    │
│   │  get_export_...     │    │  export_history          │                    │
│   │  get_house_sale_... │    │  ui_interactions         │                    │
│   │  get_stuck_items    │    │ + analytics_events       │                    │
│   │  get_failed_ai_...  │    │  (Phase 2 / not used)    │                    │
│   │  get_ui_top_pages   │    └──────────────────────────┘                    │
│   │  get_ui_top_elements│                                                    │
│   │  get_walkthrough_...│                                                    │
│   └──────────┬──────────┘                                                    │
│              │ RLS gates SELECT via private.is_admin()                       │
│              ▼                                                               │
│   ┌──────────────────────────────────────────────────────┐                   │
│   │ Postgres (shared with TPC App + extension)           │                   │
│   └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│   ┌──────────────────────────────────────────────────────┐                   │
│   │ Storage bucket 'photos' (private, public=false)      │                   │
│   │  RLS: authenticated SELECT on bucket_id='photos'     │                   │
│   │  Phase 3 calls createSignedUrl(thumbnail_path, 3600) │                   │
│   └──────────────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Component responsibilities (file-to-implementation map):**

| File | Responsibility |
|------|----------------|
| `src/pages/Activity.tsx` | Route shell — page header, filter row, top-down section composition, mounts `<DeveloperPanel>` conditionally |
| `src/pages/SessionDetail.tsx` | Route shell — back link, breadcrumb, metadata + photo coverage grid, item list section, gates Raw Item Inspector by `isDevAccount` |
| `src/pages/StuckItems.tsx` | Route shell — back link, breadcrumb, single TanStack Table |
| `src/services/activity/queries.ts` | All supabase calls — RPC wrappers + raw `.from()` builders; JSDoc enforces D-30 + D-33 invariants |
| `src/hooks/activity/*.ts` | One hook per RPC + per non-aggregating query; folds URL filters into queryKey |
| `src/hooks/useSignedPhotoUrl.ts` | **Shared (not phase-scoped)** — per-photo signed URL with `refetchOnWindowFocus: true` override |
| `src/hooks/useSpecialistFilter.ts` | Shared — `?specialists=` URL contract |
| `src/hooks/useModeFilter.ts` | Shared — `?mode=` URL contract |
| `src/components/SpecialistMultiSelect.tsx` | Top-level shared (mirrors Phase 2 `<UserMultiSelect>`); reads `useActiveSpecialists()` and renders `display_name` |
| `src/components/ModeToggle.tsx` | Top-level shared — `<div role="radiogroup">` with 3 `<button role="radio">` |
| `src/components/activity/*.tsx` | One file per chart/table/card; all adhere to D-30 layout + D-35 empty/error/loading discipline |
| `src/lib/severity.ts` | `STUCK_ITEMS_THRESHOLDS`, `STUCK_ITEMS_TONE`, `classifyStuckSeverity` |
| `src/lib/chartPalette.ts` | `AI_STATUS_COLOR`, `SESSION_STATUS_COLOR`, `SESSION_MODE_COLOR`, `SPECIALIST_COLOR_CYCLE`, `colorForSpecialist` |
| `src/lib/format.ts` | Extension — adds `formatAge(createdAt: Date \| string): string` |
| `supabase/migrations/<ts>_create_activity_rpcs.sql` | All 9-10 Phase 3 RPCs in one migration (atomic deploy) |

### Recommended Project Structure

```
src/
├── pages/
│   ├── Activity.tsx                  # /activity (NEW)
│   ├── SessionDetail.tsx             # /activity/sessions/:id (NEW)
│   └── StuckItems.tsx                # /activity/stuck (NEW)
├── components/
│   ├── activity/                     # NEW — phase-scoped
│   │   ├── TodayKpiStrip.tsx
│   │   ├── ActiveSessionsTable.tsx
│   │   ├── StuckItemsAlertCard.tsx
│   │   ├── ItemsPerSpecialistChart.tsx
│   │   ├── AiStatusDonut.tsx
│   │   ├── HouseSaleSplit.tsx
│   │   ├── ExportPipelineChart.tsx
│   │   ├── SessionMetadataCard.tsx
│   │   ├── PhotoCoveragePanel.tsx
│   │   ├── SessionItemList.tsx
│   │   ├── SessionItemDisclosure.tsx
│   │   ├── ThumbnailTile.tsx
│   │   ├── RawItemInspector.tsx       # dev-only
│   │   ├── StuckItemsTable.tsx
│   │   ├── DeveloperPanel.tsx         # phase-scoped (separate file from Phase 2's)
│   │   ├── FailedAiBreakdown.tsx      # dev-only
│   │   ├── UiInteractionsPanel.tsx    # dev-only
│   │   ├── UiTopPagesTable.tsx        # dev-only
│   │   ├── UiTopElementsTable.tsx     # dev-only
│   │   ├── WalkthroughFunnel.tsx      # dev-only
│   │   └── UiRecentEventsFeed.tsx     # dev-only
│   ├── SpecialistMultiSelect.tsx     # NEW shared
│   ├── ModeToggle.tsx                # NEW shared
│   └── (Phase 1 + 2 carryovers, untouched)
├── hooks/
│   ├── activity/                     # NEW — phase-scoped
│   │   ├── useTodayKpis.ts
│   │   ├── useActiveSessions.ts
│   │   ├── useActiveSpecialists.ts   # populates SpecialistMultiSelect options
│   │   ├── useItemsPerSpecialist.ts
│   │   ├── useAiStatusDistribution.ts
│   │   ├── useExportPipeline.ts
│   │   ├── useHouseSaleSplit.ts
│   │   ├── useStuckItems.ts
│   │   ├── useSessionDetail.ts
│   │   ├── usePhotoCoverage.ts
│   │   ├── useFailedAiBreakdown.ts
│   │   ├── useUiTopPages.ts
│   │   ├── useUiTopElements.ts
│   │   ├── useWalkthroughFunnel.ts
│   │   └── useUiRecentEventsFeed.ts
│   ├── useSignedPhotoUrl.ts          # NEW shared — load-bearing
│   ├── useSpecialistFilter.ts        # NEW shared
│   └── useModeFilter.ts              # NEW shared
├── services/
│   ├── activity/                     # NEW — phase-scoped
│   │   └── queries.ts
│   └── extension/                    # Phase 2 — untouched
├── lib/
│   ├── severity.ts                   # NEW
│   ├── chartPalette.ts               # NEW
│   ├── format.ts                     # extended (formatAge)
│   ├── devAccess.ts                  # Phase 2 — untouched
│   └── supabase.ts                   # Phase 1 — untouched
└── db/
    └── database.types.ts             # regenerated after Phase 3 migration

supabase/migrations/
└── 2026MMDD_create_activity_rpcs.sql # NEW (single migration with all RPCs)
```

### Pattern 1: Server-aggregation RPC (the canonical Phase 2 D-12/D-13 shape, adapted for TPC App tables)

**What:** Per-chart RPC that does GROUP BY + bucket-fill + filter scoping server-side; returns wide rows ready for chart consumption.

**When to use:** Every range-driven aggregate (AI status, Export Pipeline, House-vs-Sale, Failed-AI), every fixed-window aggregate (14-day items per specialist), every right-now aggregate (Today KPIs, Stuck Items count).

**Example — `get_items_per_specialist_14d` (APP-03, fixed-window 14 days bucketed daily, mirrors Phase 2 `get_event_volume_daily`):**

```sql
-- Source: pattern verified against supabase/migrations/20260429120000_create_extension_rpcs.sql
-- and PostgreSQL 17 docs (functions-datetime.html#FUNCTIONS-DATETIME-TRUNC; 3-arg form
-- handles America/New_York DST automatically).
create or replace function public.get_items_per_specialist_14d(
  p_specialists text[] default array[]::text[],   -- empty = no filter (Phase 2 Pitfall 2)
  p_mode        text   default 'all'              -- 'house' | 'sale' | 'all'
) returns table (
  bucket_start          timestamptz,
  specialist_id         uuid,
  specialist_email      text,
  specialist_display_name text,
  item_count            bigint
)
language sql
stable
security invoker
as $$
  with bounds as (
    -- Trailing 14 days inclusive of today, in ET (D-16).
    select
      date_trunc('day', now() - interval '13 days', 'America/New_York')::timestamptz as cur_from,
      date_trunc('day', now() + interval '1 day',   'America/New_York')::timestamptz as cur_to
  ),
  buckets as (
    select generate_series(
      (select cur_from from bounds),
      (select cur_to   from bounds) - interval '1 day',
      interval '1 day'
    )::timestamptz as bucket_start
  ),
  -- Find every active specialist in the period (or all if filter empty).
  specialists as (
    select p.id, p.email, p.display_name
    from public.profiles p
    where p.role = 'specialist'
      and p.is_active = true
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  ),
  scoped_items as (
    select
      date_trunc('day', i.created_at, 'America/New_York') as bucket_start,
      s.assigned_to as specialist_id
    from public.items i
    join public.sessions s on s.id = i.session_id
    where i.created_at >= (select cur_from from bounds)
      and i.created_at <  (select cur_to   from bounds)
      and (p_mode = 'all' or s.mode = p_mode)                -- D-20: filter on sessions.mode
      and (cardinality(p_specialists) = 0
           or s.assigned_to in (select id from specialists))
  )
  select
    b.bucket_start,
    sp.id        as specialist_id,
    sp.email     as specialist_email,
    sp.display_name as specialist_display_name,
    coalesce(count(si.*), 0)::bigint as item_count
  from buckets b
  cross join specialists sp
  left join scoped_items si
    on si.bucket_start = b.bucket_start and si.specialist_id = sp.id
  group by b.bucket_start, sp.id, sp.email, sp.display_name
  order by b.bucket_start, sp.display_name;
$$;

grant execute on function public.get_items_per_specialist_14d(text[], text) to authenticated;
```

**Why this shape:**
- **3-arg `date_trunc(... 'America/New_York')`** — verified against PostgreSQL 17 docs and against existing dashboard migration `supabase/migrations/20260429120000_create_extension_rpcs.sql:46-47, 67-68`. Handles DST transitions automatically. Returns `timestamptz`. **`[VERIFIED: PostgreSQL 17 docs § 9.9.4; Phase 2 migration 20260429120000_create_extension_rpcs.sql lines 40-82]`**
- **`generate_series` × `cross join specialists`** fills zero-cells so stacked bars render gaps as zeros. Same pattern Phase 2 uses for event_type buckets.
- **`security invoker`** — RLS still applies via the calling admin's JWT. The TPC App's `profiles` / `sessions` / `items` admin-read-all policies already exist (verified in TPC App migration `20260318000005_rls_policies.sql`).
- **Empty-array filter idiom** — `(cardinality(p_specialists) = 0 OR x = ANY(p_specialists))`. From JS, pass `[]` to mean "no filter." Mirrors Phase 2 RPCs.

### Pattern 2: Right-now RPC with no date-range parameters

**What:** RPC that ignores any caller-provided range and uses `now()` internally. Used for Today KPIs (D-14), Active Sessions count (D-15), 14-day fixed-window (D-16), Stuck Items (D-18).

**When to use:** Whenever the widget's classification is "right-now" or "fixed-window" per UI-SPEC § Filter Scope Visual Contract.

**Example — `get_stuck_items` (APP-11, threshold hard-coded inside per D-24):**

```sql
create or replace function public.get_stuck_items(
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  item_id          uuid,
  receipt_number   text,
  title            text,
  ai_status        text,
  created_at       timestamptz,
  age_seconds      bigint,
  session_id       uuid,
  session_name     text,
  specialist_id    uuid,
  specialist_display_name text
)
language sql
stable
security invoker
as $$
  select
    i.id                        as item_id,
    i.receipt_number,
    i.title,
    i.ai_status,
    i.created_at,
    extract(epoch from (now() - i.created_at))::bigint as age_seconds,
    s.id                        as session_id,
    s.name                      as session_name,
    p.id                        as specialist_id,
    p.display_name              as specialist_display_name
  from public.items i
  join public.sessions s on s.id = i.session_id
  left join public.profiles p on p.id = s.assigned_to
  where i.ai_status in ('processing', 'queued')
    and i.created_at < now() - interval '2 hours'      -- D-24 hard-coded threshold
    and (p_mode = 'all' or s.mode = p_mode)
    and (cardinality(p_specialists) = 0
         or p.email = any(p_specialists))
  order by i.created_at asc;                           -- oldest first
$$;

grant execute on function public.get_stuck_items(text[], text) to authenticated;
```

**Why hard-code 2h:** D-24 is explicit. If the card's RPC and the page's RPC ever drifted on the threshold, the count and the table would disagree. One source of truth.

### Pattern 3: Non-aggregating raw `.from().select()` with embedded joins

**What:** PostgREST `.from('sessions').select('..., profiles!fk(...), items(count)')` for non-aggregating shapes (Active Sessions list, Session Detail, photo coverage, ui_interactions recent events).

**When to use:** Per D-30, when the data shape is one row per business entity (no GROUP BY needed). Mirrors Phase 2's `fetchRecentErrors` + `fetchLiveFeed`.

**Example — Active Sessions list (APP-02):**

```ts
// src/services/activity/queries.ts (sketch — final form in plan)
export async function fetchActiveSessions(args: {
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<ActiveSessionRow[]> {
  let q = supabase
    .from('sessions')
    .select(`
      id,
      name,
      mode,
      status,
      assigned_to,
      created_at,
      updated_at,
      profiles:profiles!sessions_assigned_to_fkey ( id, email, display_name ),
      items ( count )
    `)
    .eq('status', 'active');

  if (args.mode !== 'all') q = q.eq('mode', args.mode);
  // D-19: when specialists empty → no filter; otherwise filter post-fetch by email
  // (PostgREST cannot filter on a joined-table column without a foreign-table .filter()
  // call; for cleanliness we accept the small over-fetch and filter client-side, OR
  // we add a server-side wrapper RPC. PLAN-TIME DECISION: ship the RPC variant.)

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
```

**Caveat — `assigned_to` FK ambiguity:** TPC App's `sessions.assigned_to` is `uuid REFERENCES auth.users(id) ON DELETE SET NULL`. There is NO FK `sessions.assigned_to → profiles.id` in the TPC App schema. PostgREST resolves embedded joins via the explicit `!fkName` hint OR by inferring through `auth.users → profiles`. **The supabase-js embed syntax `profiles:profiles!sessions_assigned_to_fkey(...)` will NOT work as-written** — there is no `sessions_assigned_to_fkey` to `profiles`.

**Recommendation: ship the Active Sessions list as a small RPC** that does the join server-side, returning `(session_id, name, mode, status, assigned_to_id, assigned_to_display_name, item_count, created_at, updated_at)`. This is cleaner than fighting PostgREST's relationship inference and guarantees the specialist join works. Same recommendation for Session Detail and `ui_interactions` user-email-with-display-name lookups. **`[ASSUMED — needs verification at plan time]`** — the planner can attempt the PostgREST embed first via a minimal probe; if it fails, fall back to RPC. Either way, the deliverable shape is the same.

### Anti-Patterns to Avoid

- **Calling `createSignedUrl` for `upload_status='failed'` photos** — D-13 forbids it. The `storage_path` may be missing or invalid; the request would 404 and produce noisy error logs. The `useSignedPhotoUrl` hook MUST take an `enabled` flag (or the call site MUST gate before invocation). Pick one in plan; both are valid.
- **Using `display: hidden` for the `<DeveloperPanel>`** — render-conditional only. A `display: hidden` panel is still in the DOM, in the keyboard tab order, and discoverable via DevTools. UI-SPEC + Phase 2 D-15 explicit.
- **Passing `?range=` URL state to "right-now" widgets' hooks** — D-14..D-21. The classifier-by-class is the master invariant. Each hook's JSDoc MUST tag its filter-scope class.
- **Mixing `items.mode` and `sessions.mode` in queries** — D-20. `sessions.mode` is canonical. The migration sets `items.mode = sessions.mode` at insert time; trusting `items.mode` for filtering is technically fine but introduces a redundancy bug surface that doesn't exist if you only filter on `sessions.mode`.
- **Mass eager photo signing on Session Detail mount** — D-09. Only fetch signed URLs lazily on row expansion. `/activity/sessions/:id` of a 200-item session must NOT issue 200 storage signing requests on mount.
- **Forgetting `app_source = 'tpc-app'` on every `ui_interactions` query** — D-33. The shared `ui_interactions` table is multi-app (TPC App + future TPC AI Cataloger writes); without the filter we mix data domains. Mirror Phase 2 D-01's enforcement convention: JSDoc on every query, code-review checklist item, plus a static SQL grep verifier in `scripts/verify-activity-app-source-scope.mjs`.
- **Sibling Retry button next to `<ErrorState>`** — D-35. The component renders its own internal Retry. Adding an external one creates two retry buttons next to each other; verified by reading `src/components/ErrorState.tsx:24-29` (2026-04-30).
- **Page-level Suspense boundary on `/activity`** — D-36. One slow query would block all the others. Per-card loading ONLY.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Photo signed-URL refresh on tab-resume | A custom `setInterval` loop or `visibilitychange` listener with manual fetch | **TanStack Query per-photo `useQuery` with `refetchOnWindowFocus: true` override + `staleTime: 50min`** | TanStack handles the visibility/focus event already, exposes per-query overrides cleanly (`[VERIFIED: tanstack.com/query/v5/docs/react/guides/window-focus-refetching]`), and gives you a refetch function for free. Custom listeners drift out of sync with cache eviction. |
| Date bucketing in ET across DST | Client-side JS bucketing with `date-fns-tz` formatters | **Postgres 3-arg `date_trunc('day', x, 'America/New_York')`** | Server-side bucketing means SQL and `useTimezone` agree on day boundaries. Client-side bucketing means a March 8 entry can land in the wrong bucket depending on the user's locale. `[VERIFIED: PostgreSQL 17 docs § 9.9.4]` |
| Specialist color allocation across reloads | Random assignment / hash-based color | **Alphabetical-position cycle** (`SPECIALIST_COLOR_CYCLE` in UI-SPEC) | Stable across reloads = same specialist always same color = chart legend is muscle-memory friendly. Hash collisions across small N produce duplicate colors. |
| Date-range / filter state | Zustand store / React Context | **URL `?range=` / `?specialists=` / `?mode=` via `useSearchParams`** | Phase 1 D-20 + Phase 2 D-17 set the precedent. URL is shareable, bookmarkable, browser-back works for free. |
| Custom date-picker for the "Custom" range option | A date-picker library | **Native `<input type="date">`** | Phase 1 D-18 already shipped this. No regression. |
| Donut "failed" slice emphasis | CSS animation, hover effect, or pulsing border | **Recharts per-`<Cell outerRadius>` +4px** | Static = no motion-prefers issue. UI-SPEC committed (CONTEXT D-104 / `03-UI-SPEC.md § APP-04`). Custom Sector shape is also valid (`[CITED: recharts.github.io/api/Pie/]`) but per-Cell `outerRadius` is the simplest + zero-state safe. |
| Stuck-items severity classification | Inline ternary in the component | **Pure `classifyStuckSeverity({ count, oldestAgeHours })` in `src/lib/severity.ts`** | Tunable from one source. Testable in isolation (UI-SPEC ships 5 invariant tests). |
| Walkthrough step extraction from `ui_interactions` | JS-side parsing of `metadata` jsonb | **Server-side `metadata->>'step'` extraction inside the RPC** | Server-side `jsonb` operators are mature, type-stable, and keep the JS layer dumb. |
| `display_name` lookup from `assigned_to` | Two queries (sessions, then a separate profiles lookup) | **Single RPC OR PostgREST embedded join via explicit FK hint** | One round-trip. Recommendation: ship the RPC variant for Active Sessions / Session Detail / Stuck Items because the FK chain (`sessions.assigned_to → auth.users → profiles`) is not directly embeddable. |
| TanStack Table v8 row expansion | A custom `expandedRowId` state + manual `<tr>` insertion | **`getCanExpand()` + `getIsExpanded()` + `getToggleExpandedHandler()` + render expanded body as a single-cell `<tr>` spanning all columns** | Native API; documented pattern; `[VERIFIED: tanstack.com/table/v8/docs/guide/expanding]`. Custom state diverges from the rest of the table's selection / sort APIs. |

**Key insight:** Phase 3 has more nuanced UX than Phase 2 (signed URLs, asymmetric filter scope, 3 routes) but no new categorical capabilities — every cross-cutting concern has a Phase 1 / Phase 2 precedent. The only net-new technical surface is `useSignedPhotoUrl`'s `refetchOnWindowFocus: true` override, which is a one-line change to the TanStack Query options for that hook.

---

## Runtime State Inventory

> N/A — Phase 3 is a new-feature phase, not a rename/refactor/migration. Skipping per RESEARCH workflow Step 2.5.

---

## Common Pitfalls

### Pitfall 1: `assigned_to` FK ambiguity

**What goes wrong:** Writing `from('sessions').select('*, profiles(...)')` and expecting PostgREST to resolve the join through `auth.users → profiles`.

**Why it happens:** TPC App's `sessions.assigned_to` is a UUID FK to `auth.users(id)`, not to `public.profiles(id)`. PostgREST cannot resolve cross-schema FK chains transparently.

**How to avoid:** Either (a) use an explicit hint with the existing FK name (`profiles!sessions_assigned_to_fkey` will FAIL because that FK doesn't exist), or (b) ship a server-side RPC that does the join. **Recommendation:** ship the RPC variant for Active Sessions, Session Detail header (specialist display_name), and Stuck Items. For the SpecialistMultiSelect dropdown options, a simple `.from('profiles').select('id,email,display_name').eq('role','specialist').eq('is_active',true)` works fine — no FK resolution involved.

**Warning signs:** PostgREST error `"Could not find a relationship between 'sessions' and 'profiles' in the schema cache"`.

### Pitfall 2: `sessions.status` includes `'completed'`

**What goes wrong:** Writing the Export Pipeline RPC to expect 4 status values (`active`, `submitted`, `returned`, `exported`) and missing rows in `'completed'`.

**Why it happens:** TPC App migration `20260318000001_create_sessions.sql` originally constrained status to 4 values. Migration `20260320000000_add_completed_status.sql` extended the CHECK to add `'completed'`. CONTEXT D-17 references the original 4-value enum but the production schema has 5.

**How to avoid:** Plan-time decision (Open Question #1 below): either (a) include `'completed'` as a 5th segment in the Export Pipeline chart with its own color, or (b) coalesce `'completed'` into `'exported'` for display purposes. **Recommendation: include as 5th segment** — it's a real status that real sessions have, and hiding it would be data fraud.

**Warning signs:** Manual count check in dev DB shows N rows with `status='completed'` not appearing on chart.

### Pitfall 3: Photo `upload_status='failed'` triggers signed-URL fetch

**What goes wrong:** `useSignedPhotoUrl` is called for every photo without checking `upload_status`. The hook makes a `createSignedUrl` request that 404s, creating noise in error logs and potentially flashing an error state in the UI.

**Why it happens:** Easy to forget the gate; the call site iterates over `photos` array and pipes each to the hook.

**How to avoid:** D-13 enforced via either an `enabled: photo.upload_status !== 'failed'` flag on the hook, OR by the call site filtering before invocation. UI-SPEC § Photo Signed-URL UX Contract is explicit about both options. **Vitest invariant test:** mock `supabase.storage.from('photos').createSignedUrl` and assert call count = 0 when all photos are `failed`.

**Warning signs:** Network tab shows 404s on photo paths; Photo Coverage panel shows `{N} failed` but those photos still flash a thumbnail-loading shimmer.

### Pitfall 4: 2-hour tab-resume thumbnail flash

**What goes wrong:** Admin opens `/activity/sessions/:id`, expands a few rows, locks their laptop, comes back 2h later. Thumbnails render with stale 1h-TTL signed URLs that have already 403'd. User sees broken images for a flash before the focus event fires.

**Why it happens:** Default TanStack Query `refetchOnWindowFocus: false` (set globally in Phase 1's `src/main.tsx`) means the focus event doesn't trigger a refetch. The user paints the stale URL into the `<img>` tag, the storage CDN returns 403, the browser shows the broken-image icon.

**How to avoid:** D-08 / D-11 — `useSignedPhotoUrl` overrides the global default with `refetchOnWindowFocus: true` AND sets `staleTime: 50min` (so the URL is considered stale 10min before actual expiry). On focus event, if a query is stale, it refetches. The new URL replaces the stale one BEFORE the `<img>` tries to render. **Test invariant:** Vitest behavior test fires `dispatchEvent(new Event('visibilitychange'))` after `vi.advanceTimersByTime(50 * 60 * 1000 + 1)` and asserts a second `createSignedUrl` call.

**Warning signs:** Photos render fine on first load but show broken-image icon after a long idle.

### Pitfall 5: Specialist filter URL param uses email but server-side joins use UUID

**What goes wrong:** RPC parameter `p_specialists text[]` accepts emails; downstream the RPC joins on `profiles.id = sessions.assigned_to`. Easy to forget the email→UUID step.

**Why it happens:** UI uses email (operator-readable, stable across `display_name` changes) but the FK lives on UUIDs.

**How to avoid:** Inside every RPC, the canonical idiom is:
```sql
where (cardinality(p_specialists) = 0
       or s.assigned_to in (
         select p.id from public.profiles p where p.email = any(p_specialists)
       ))
```
Or extract into a CTE for reuse. **Test invariant:** RPC receives `p_specialists := ARRAY['josh@potomackco.com']`; assert returned rows are limited to that user's data.

**Warning signs:** Filter selection in UI doesn't change chart contents; SQL EXPLAIN shows no email-based filter applied.

### Pitfall 6: ui_interactions `app_source` filter forgotten

**What goes wrong:** Phase 3 dev panel's `ui_interactions` query forgets `where app_source = 'tpc-app'`. Future TPC AI Cataloger or other apps writing to the same table get mixed in.

**Why it happens:** Same as Phase 2 D-01 invariant — easy to forget on a shared table.

**How to avoid:** D-33 — JSDoc on every query, code-review checklist, and a static SQL grep verifier `scripts/verify-activity-app-source-scope.mjs` (mirrors Phase 2's `scripts/verify-extension-app-source-scope.mjs`). The verifier scans the new migration for every aggregation/select against `ui_interactions` and asserts the line includes `app_source` — fails the prebuild if missing.

**Warning signs:** Top Pages panel shows `/dashboard/...` paths or non-TPC-App paths; volume spike from a single non-TPC-App user_id.

### Pitfall 7: Empty `p_specialists` / `p_mode` array means "no filter"

**What goes wrong:** Calling `.in('email', [])` returns zero rows (Postgres treats empty IN list as "match nothing"). RPC parameter handling MUST use the array-cardinality idiom, not direct `.in()`.

**Why it happens:** Same as Phase 2 Pitfall 2. Easy to write `s.email = any(p_specialists)` without the cardinality guard.

**How to avoid:** Verbatim: `(cardinality(p_specialists) = 0 OR s.email = any(p_specialists))`. From JS, pass `[]` to mean "no filter" and never `.in('col', [])`.

### Pitfall 8: Specialist color cycle doesn't apply to deactivated specialists

**What goes wrong:** Admin selects a 7-day window where one of the active specialists is John (color #1) and another is Jane (color #2). Then admin extends to 30d, picking up data from a deactivated former specialist Mark. Mark gets color #3 — but on the next render, alphabetical order shifts and John gets #2, Jane gets #3, Mark gets #1.

**Why it happens:** UI-SPEC § Color "Why slate-600 is at the END" describes the alphabetical-position allocation. If the active specialist set changes mid-page-life, colors swap.

**How to avoid:** UI-SPEC's `colorForSpecialist(email, sortedEmails)` takes the FULL active list as input, so the function is stable for a given filter selection. Re-rendering with a new filter set MAY swap colors — **this is acceptable** because the legend always shows the current mapping. If operator UAT shows it's confusing, the v2.1 fix is to persist the mapping in localStorage keyed by email.

**Warning signs:** Operator complains "the colors changed when I added a specialist."

### Pitfall 9: TanStack Table v8 expanded row content overflow

**What goes wrong:** Expanded body is rendered as a `<tr>` with a single `<td colSpan={columns.length}>`. Forgetting `colSpan` makes the expanded body collapse to one column width with horizontal scroll inside the cell.

**How to avoid:** Render expanded body verbatim:
```tsx
{row.getIsExpanded() && (
  <tr>
    <td colSpan={row.getVisibleCells().length}>
      <SessionItemDisclosure item={row.original} />
    </td>
  </tr>
)}
```

`[CITED: tanstack.com/table/v8/docs/framework/react/examples/sub-components]`

### Pitfall 10: Live-feed pause requires `invalidateQueries` on resume

**What goes wrong:** Resume button toggles `paused = false` but the next refetch waits for the next `refetchInterval` tick — up to 10 seconds of staleness before the user sees fresh data.

**Why it happens:** Setting `refetchInterval` reactively reschedules but does NOT fire immediately. Same Phase 2 Pitfall 4.

**How to avoid:** On resume, `setPaused(false)` PLUS `queryClient.invalidateQueries({ queryKey: FEED_KEY })`. Verified pattern in `src/hooks/extension/useLiveFeed.ts:25-29`. The `useUiRecentEventsFeed` hook mirrors this exactly.

---

## Code Examples

Verified patterns from sources opened during research.

### `useSignedPhotoUrl` shape (THE load-bearing hook)

```ts
// src/hooks/useSignedPhotoUrl.ts
// Phase 3 / D-08 / D-09 / D-10 / D-11 — per-photo signed URL with refetch-on-focus.
//
// Filter-scope class: per-row, lazy. Mounted only when an item row is expanded
// (D-09 — no eager mass signing). The override of refetchOnWindowFocus: true
// is what makes Success Criterion #5 work: a 2h tab-resume triggers
// visibilitychange → query is past staleTime (50min) → refetch fires →
// new URL returned BEFORE the user sees a 403.
//
// IMPORTANT: D-13 — never call this for upload_status='failed' photos. Caller
// gates via the `enabled` arg. Test invariant: when enabled=false, no
// createSignedUrl call is made.
//
// Source verified: src/main.tsx QueryClient defaults; ErrorState contract;
// Phase 2 useLiveFeed override pattern (src/hooks/extension/useLiveFeed.ts).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SignedPhotoUrlArgs {
  path: string | null | undefined;
  enabled?: boolean;     // D-13: pass false for upload_status='failed' photos
}

export function useSignedPhotoUrl({ path, enabled = true }: SignedPhotoUrlArgs) {
  return useQuery({
    queryKey: ['signed-photo-url', path] as const,
    queryFn: async () => {
      if (!path) throw new Error('No path');
      const { data, error } = await supabase.storage
        .from('photos')
        .createSignedUrl(path, 3600);     // D-11: TTL 3600s matches TPC App
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: enabled && !!path,
    staleTime: 50 * 60 * 1000,            // D-11: 50min — refetch 10min before TTL expiry
    gcTime:    10 * 60 * 1000,            // D-11: 10min cache after unmount
    refetchOnWindowFocus: true,           // D-08: OVERRIDE global default (false)
    retry: 1,                             // D-11
  });
}
```

### Filter hooks — `useSpecialistFilter`, `useModeFilter` (pattern from `useUserFilter`)

```ts
// src/hooks/useSpecialistFilter.ts
// Phase 3 / APP-08 / D-21 — URL-state specialist email multi-select filter.
// Comma-separated single key form mirrors Phase 2 useUserFilter exactly.
// Empty array = "no filter" (D-19).

import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export interface SpecialistFilterValue {
  specialists: string[];                  // emails
  setSpecialists: (next: string[]) => void;
}

export function useSpecialistFilter(): SpecialistFilterValue {
  const [params, setParams] = useSearchParams();
  const raw = params.get('specialists');
  const specialists = raw ? raw.split(',').filter((v) => v.length > 0) : [];

  const setSpecialists = useCallback((next: string[]) => {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      if (next.length === 0) copy.delete('specialists');
      else copy.set('specialists', next.join(','));
      return copy;
    }, { replace: false });
  }, [setParams]);

  return { specialists, setSpecialists };
}
```

```ts
// src/hooks/useModeFilter.ts
// Phase 3 / APP-09 / D-20 — URL-state session mode toggle.
// Default = 'all' (no ?mode= URL param). 'house' | 'sale' filters server-side.

import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export type SessionMode = 'house' | 'sale' | 'all';

export interface ModeFilterValue {
  mode: SessionMode;
  setMode: (next: SessionMode) => void;
}

function isMode(v: string | null): v is SessionMode {
  return v === 'house' || v === 'sale' || v === 'all';
}

export function useModeFilter(): ModeFilterValue {
  const [params, setParams] = useSearchParams();
  const raw = params.get('mode');
  const mode: SessionMode = isMode(raw) ? raw : 'all';

  const setMode = useCallback((next: SessionMode) => {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      if (next === 'all') copy.delete('mode');
      else copy.set('mode', next);
      return copy;
    }, { replace: false });
  }, [setParams]);

  return { mode, setMode };
}
```

### TanStack Table v8 row expansion for the Session item list

```tsx
// src/components/activity/SessionItemList.tsx (sketch)
// D-05 + D-06: TanStack Table v8 with per-row disclosure.
// [CITED: tanstack.com/table/v8/docs/guide/expanding]

import { useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getExpandedRowModel, flexRender,
  type ColumnDef, type ExpandedState,
} from '@tanstack/react-table';

interface ItemRow {
  id: string;
  receipt_number: string | null;
  title: string | null;
  ai_status: string;
  photo_count: number;
}

const columns: ColumnDef<ItemRow>[] = [/* receipt#, title, ai_status chip, photos count */];

export function SessionItemList({ items }: { items: ItemRow[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data: items,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,           // every row is expandable to show thumbnails
  });

  return (
    <table>
      <thead>{/* ... */}</thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <FragmentOrSomething key={row.id}>
            <tr
              onClick={row.getToggleExpandedHandler()}
              aria-expanded={row.getIsExpanded()}
              className="hover:bg-gray-50 cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
            {row.getIsExpanded() && (
              <tr>
                <td colSpan={row.getVisibleCells().length}>
                  <SessionItemDisclosure item={row.original} />
                </td>
              </tr>
            )}
          </FragmentOrSomething>
        ))}
      </tbody>
    </table>
  );
}
```

### Recharts donut with pulled-out failed slice (UI-SPEC committed)

```tsx
// src/components/activity/AiStatusDonut.tsx (sketch)
// APP-04 / UI-SPEC § APP-04: pulled-out failed slice via per-Cell outerRadius +4px.
// [CITED: recharts.github.io/api/Pie/ — Cell outerRadius prop]

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AI_STATUS_COLOR } from '../../lib/chartPalette';

const ORDER = ['pending', 'processing', 'queued', 'done', 'failed'] as const;

export function AiStatusDonut({ data }: { data: Record<typeof ORDER[number], number> }) {
  const slices = ORDER.map((s) => ({ name: s, value: data[s] }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={slices} dataKey="value" innerRadius="60%" outerRadius="80%" paddingAngle={2}>
          {slices.map((slice, i) => (
            <Cell
              key={slice.name}
              fill={AI_STATUS_COLOR[slice.name]}
              outerRadius={slice.name === 'failed' ? '85%' : '80%'}    // +4px-equivalent
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
```

**Note:** Per-Cell `outerRadius` override is the simplest pulled-out idiom. If the executor finds at integration time that Recharts 3.8.1 ignores per-Cell `outerRadius` (some versions only honor per-Pie), the fallback is a custom `<Sector>` shape passed to `<Pie shape={...}>`. Both are documented patterns. `[VERIFIED: recharts API docs § Pie / Sector]`

### Hooks layer pattern — sorted-array queryKey (Phase 2 carryover)

```ts
// src/hooks/activity/useItemsPerSpecialist.ts (sketch)
// APP-03 / fixed-window 14d / D-16. Sorted arrays in queryKey (Phase 2 RESEARCH Pitfall 3).

import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchItemsPerSpecialist14d } from '../../services/activity/queries';

/**
 * Filter-scope class: FIXED-WINDOW (D-16). Trailing 14 days, ignores ?range=.
 * Applies ?specialists= and ?mode= per master rule (D-14..D-21).
 */
export function useItemsPerSpecialist() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();   // queryKey stability

  return useQuery({
    queryKey: ['activity', 'itemsPerSpecialist14d', { specialists: specialistsKey, mode }],
    queryFn: () => fetchItemsPerSpecialist14d({ specialists, mode }),
    // staleTime/refetchOnWindowFocus inherited from QueryClientProvider (D-25)
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Storybook for UI primitive validation | `/kit` dev-only route gated by `import.meta.env.DEV` | Phase 1 D-11 | Tree-shaken from prod via Vite literal substitution; verified by `scripts/verify-no-kit-in-dist.mjs`. Phase 3 inherits — no UI primitive changes. |
| Multi-app shared tables without `app_source` discriminator | `app_source` invariant on every query | Phase 2 D-01 (extension), D-33 (TPC App `ui_interactions`) | Phase 3 must respect the same invariant for `ui_interactions`. Static SQL grep verifier covers it. |
| Client-side date bucketing | Server-side 3-arg `date_trunc(... 'America/New_York')` | Phase 2 D-13 | Phase 3 mirrors. No JS bucketing in chart components. |
| Polling with `setInterval` | TanStack Query `refetchInterval: 10_000` (function form) + `invalidateQueries` on resume | Phase 2 D-09/D-10/D-11 | Phase 3 dev-panel Recent Events Feed uses identical idiom. |
| Drawer modal for nested detail views | Dedicated nested route (`/activity/sessions/:id`) | Phase 3 D-02 | Bookmarkable URL; full-width grid; browser-back preserves filter state. |
| Eager mass-fetch of signed URLs | Lazy per-row signing on row expansion | Phase 3 D-09 | Drastically reduces storage egress for long sessions; trade-off is a brief shimmer on first expand. |

**Deprecated/outdated for this phase:**
- The Phase 2 "lifetime gate" pattern (`useExtensionGate`, full-page empty state) is **NOT used in Phase 3** — D-37 explicit. TPC App tables are populated from day one.

---

## Validation Architecture

This section is consumed by the Nyquist validation phase. `workflow.nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 + jsdom 28.1.0 |
| Config file | `vitest.config.ts` (Phase 1; reuse) |
| Quick run command | `npm run test -- {file pattern}` |
| Full suite command | `npm run test` |
| Coverage today (after Phase 2 closeout) | All Phase 1 + Phase 2 tests passing in src/ + scraper/ |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APP-01 | Today KPI strip renders 4 KpiCards with prev-day delta direction | unit (component + hook mock) | `npm run test -- src/components/activity/TodayKpiStrip.test.tsx` | ❌ Wave 0 |
| APP-02 | Active Sessions table renders sortable columns; default sort = age desc | unit (component) | `npm run test -- src/components/activity/ActiveSessionsTable.test.tsx` | ❌ Wave 0 |
| APP-03 | 14-day stacked bar renders 14 buckets × N specialists (zero-cells filled) | unit (component + hook mock) | `npm run test -- src/components/activity/ItemsPerSpecialistChart.test.tsx` | ❌ Wave 0 |
| APP-04 | AI status donut renders 5 slices; failed slice has +outerRadius | unit (component) | `npm run test -- src/components/activity/AiStatusDonut.test.tsx` | ❌ Wave 0 |
| APP-05 | Export pipeline horizontal stacked bar renders 4 (or 5) status segments | unit (component) | `npm run test -- src/components/activity/ExportPipelineChart.test.tsx` | ❌ Wave 0 |
| APP-06 | Session Detail page renders metadata + items list; back link preserves URL params | unit + integration (page + hook mock) | `npm run test -- src/pages/SessionDetail.test.tsx` | ❌ Wave 0 |
| APP-07 | URL `?range=7d&specialists=a,b&mode=house` round-trips | unit (hook) | `npm run test -- src/hooks/useSpecialistFilter.test.tsx src/hooks/useModeFilter.test.tsx` | ❌ Wave 0 |
| APP-08 | Specialist multi-select shows active specialists only; renders display_name | unit (component + hook mock) | `npm run test -- src/components/SpecialistMultiSelect.test.tsx` | ❌ Wave 0 |
| APP-09 | Mode toggle sets `?mode=house|sale|all`; default = all | unit (component) | `npm run test -- src/components/ModeToggle.test.tsx` | ❌ Wave 0 |
| APP-10 | Photo Coverage panel shows ≥1/0 split + upload_status breakdown + failed callout | unit (component + hook mock) | `npm run test -- src/components/activity/PhotoCoveragePanel.test.tsx` | ❌ Wave 0 |
| APP-11 | Stuck items alert card classifies severity (none/yellow/red); CTA links to /activity/stuck | unit (component) + unit (severity classifier) | `npm run test -- src/lib/severity.test.ts src/components/activity/StuckItemsAlertCard.test.tsx` | ❌ Wave 0 |
| APP-12 | House-vs-Sale split renders 2 paired KpiCards with mode color borders | unit (component) | `npm run test -- src/components/activity/HouseSaleSplit.test.tsx` | ❌ Wave 0 |
| APP-D-08 | Photo signed URL refetches on `visibilitychange` after staleTime | unit (hook + fake timers) | `npm run test -- src/hooks/useSignedPhotoUrl.test.tsx` | ❌ Wave 0 — **load-bearing** |
| APP-D-09 | Mounting Session Detail does NOT call createSignedUrl; row expansion does | unit (page + storage mock) | `npm run test -- src/pages/SessionDetail.test.tsx` (assert call count = 0 on mount, > 0 after row click) | ❌ Wave 0 |
| APP-D-13 | createSignedUrl is NEVER called for upload_status='failed' photos | unit (component + storage mock) | `npm run test -- src/components/activity/SessionItemDisclosure.test.tsx` (assert call count = 0 when all photos fail) | ❌ Wave 0 |
| APP-D-14..D-21 | Filter scope discipline — every chart hook reads only its declared filters | static (JSDoc grep) + unit (hook) | `node scripts/verify-activity-filter-scope.mjs` (NEW — greps each hook file for the @filterScope tag) | ❌ Wave 0 |
| APP-D-19 | Specialist multi-select excludes role='admin' and is_active=false | unit (hook + DB mock) | `npm run test -- src/hooks/activity/useActiveSpecialists.test.tsx` | ❌ Wave 0 |
| APP-D-20 | Mode filter targets sessions.mode, not items.mode | static (SQL grep) | `node scripts/verify-activity-mode-filter.mjs` (NEW — asserts no RPC body filters on `items.mode`) | ❌ Wave 0 |
| APP-D-24 | Stuck items 2h threshold is hard-coded inside the RPC, NOT a parameter | static (SQL grep) + unit (RPC seed test) | `node scripts/verify-activity-stuck-threshold-hardcoded.mjs` (NEW) | ❌ Wave 0 |
| APP-D-26 | DeveloperPanel renders only when isDevAccount(profile.email) | unit (component + auth-store mock) | `npm run test -- src/components/activity/DeveloperPanel.test.tsx` | ❌ Wave 0 |
| APP-D-30 | Every Phase 3 RPC uses 3-arg date_trunc('day' \| 'hour', x, 'America/New_York') | static (SQL grep) | `node scripts/verify-activity-bucket-tz.mjs` (NEW — extends Phase 2 verifier) | ❌ Wave 0 |
| APP-D-33 | Every ui_interactions query scopes by app_source = 'tpc-app' | static (SQL grep + JSDoc grep) | `node scripts/verify-activity-app-source-scope.mjs` (NEW — mirrors Phase 2's extension verifier) | ❌ Wave 0 |
| APP-D-35 | ErrorState used everywhere with the locked contract; no sibling Retry buttons | static (TS grep) + unit (component) | `node scripts/verify-activity-error-state-contract.mjs` (NEW) — asserts every `<ErrorState ... />` use passes the 3 required props and no caller renders a sibling button labeled `Retry` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- {file pattern}` (the specific component/hook the task touched)
- **Per wave merge:** `npm run test` (full suite — Phase 3 will add ~80-100 new tests)
- **Phase gate:** Full suite green + all 6 new static verifiers green before `/gsd-verify-work`

### Wave 0 Gaps (test infra + verifiers to add before implementation)

- [ ] `src/services/activity/queries.test.ts` — fixtures for RPC arg shape
- [ ] `src/hooks/activity/*.test.tsx` — one per hook, queryKey shape + filter folding
- [ ] `src/hooks/useSignedPhotoUrl.test.tsx` — **load-bearing**: covers `enabled=false` path (no fetch), `refetchOnWindowFocus: true` override (synthetic focus event after `staleTime`), `gcTime` cleanup
- [ ] `src/hooks/useSpecialistFilter.test.tsx` + `useModeFilter.test.tsx` — URL round-trip
- [ ] `src/components/activity/*.test.tsx` for each of ~22 components
- [ ] `src/lib/severity.test.ts` — 5 invariant tests from UI-SPEC § Severity Tone Constants
- [ ] `src/lib/chartPalette.test.ts` — `colorForSpecialist` stable output for fixed sortedEmails
- [ ] `src/lib/format.test.ts` — `formatAge` covers the 4 buckets (s/m/h/d format)
- [ ] `src/pages/Activity.test.tsx` — section composition, filter row, dev-panel gate
- [ ] `src/pages/SessionDetail.test.tsx` — back link preserves URL params, row expansion, no eager createSignedUrl on mount
- [ ] `src/pages/StuckItems.test.tsx` — table renders, row click navigates
- [ ] `scripts/verify-activity-app-source-scope.mjs` — static SQL grep on the new migration (mirror of `verify-extension-app-source-scope.mjs`)
- [ ] `scripts/verify-activity-bucket-tz.mjs` — static SQL grep ensuring 3-arg `date_trunc(... 'America/New_York')` on every aggregation
- [ ] `scripts/verify-activity-stuck-threshold-hardcoded.mjs` — static SQL grep ensuring `interval '2 hours'` literal inside `get_stuck_items` body, NOT a function parameter
- [ ] `scripts/verify-activity-mode-filter.mjs` — static SQL grep ensuring no RPC body filters on `items.mode` (D-20)
- [ ] `scripts/verify-activity-filter-scope.mjs` — static TS grep on `src/hooks/activity/*.ts` ensuring each file has a `@filterScope` JSDoc tag
- [ ] `scripts/verify-activity-error-state-contract.mjs` — static TS grep ensuring every `<ErrorState>` use has 3 required props and no caller renders sibling Retry

### Recharts JSDom Mock — already in use, no extension needed

The Phase 1 mock (`vi.mock('recharts', ...)` replacing `ResponsiveContainer` with a sized div + `cloneElement` injecting `width`/`height`) is verbatim-reused for Phase 3's `ItemsPerSpecialistChart`, `AiStatusDonut`, `ExportPipelineChart`, and `WalkthroughFunnel` tests. **`[VERIFIED: src/components/kit/Sparkline.test.tsx:13-32; src/components/extension/{EventVolumeChart,KpiStrip,ErrorRateChart}.test.tsx all use this mock]`**

---

## Security Domain

`security_enforcement` is the default (absent from config = enabled). Phase 3 is read-only, but several ASVS categories apply:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture, Design, and Threat Modeling | yes | Documented in CONTEXT.md (Phase 3 boundary, decisions D-01..D-37) |
| V2 Authentication | no (inherited) | Auth gate handled in Phase 1 / v1.0 ProtectedRoute + Supabase auth |
| V3 Session Management | no (inherited) | Supabase JWT lifecycle |
| V4 Access Control | yes | RLS on every TPC App table calls `private.is_admin()`; RPCs are `security invoker` so RLS still gates. Email allowlist `isDevAccount` is an **additional** UI gate, not a security boundary — non-dev admins can still see all data they're entitled to. |
| V5 Input Validation | yes | RPC parameters are typed (`text[]`, `text`, `timestamptz`); `p_mode` should be validated against `('house','sale','all')` inside the RPC body or trusted from `useModeFilter`'s parser. URL search params are parsed defensively in filter hooks (e.g., `useDateRange` falls back to 7d on invalid `range`). |
| V6 Cryptography | yes (signed URLs) | Storage signed URLs use Supabase's HMAC-signed token format. **Never hand-roll signing.** Use `supabase.storage.from(bucket).createSignedUrl(path, ttl)`. |
| V7 Error Handling and Logging | yes | TanStack Query `retry: 1`; errors surface via per-card `<ErrorState>`. **No PII leakage:** error bodies are user-facing copy (UI-SPEC committed). Stack traces NOT shown to admin. |
| V8 Data Protection | yes | Photos bucket is private. Signed URLs expire in 3600s. Failed photos never have URLs created (D-13). The dashboard never stores blob data — always signed-URL-on-demand. |
| V9 Communications | yes | All Supabase calls go over HTTPS via the anon client. |
| V10 Malicious Code | no | Phase 3 is read-only; no user-input-based execution. |
| V11 Business Logic | yes | Asymmetric filter scope (D-14..D-21) is a business-logic invariant; the static verifier `scripts/verify-activity-filter-scope.mjs` is the enforcement. |
| V12 File Resource | yes (signed URLs) | Photos are URL-only; no file upload path in Phase 3. The signed-URL TTL of 3600s minimizes the URL leak window. |
| V13 API and Web Service | yes | Every RPC has explicit `grant execute ... to authenticated`; default-deny via Supabase. |
| V14 Configuration | yes | `VITE_*` env vars only; service-role key segregation enforced by Phase 1 prebuild guard. |

### Known Threat Patterns for React + Supabase + Postgres RPC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via RPC parameter | Tampering | Postgres-prepared statements via `.rpc()`; never concatenate strings into SQL bodies. **Phase 3 RPCs MUST NOT use `format()` or `EXECUTE` with user input.** |
| RLS bypass via `security definer` | Elevation of Privilege | All Phase 3 RPCs are `security invoker` (default). RLS gates reads. |
| Service-role key in frontend bundle | Information Disclosure | Phase 1 prebuild guard (`scripts/check-no-service-role-in-src.mjs`) catches it. Phase 3 stays in `src/`. |
| Signed URL leak via DOM inspection | Information Disclosure | TTL=3600s minimizes leak window. Never log signed URLs to console or analytics. |
| `app_source` cross-app data mixing | Tampering / Spoofing | D-33 hard filter on every `ui_interactions` query; static verifier catches missing filters. |
| Specialist email enumeration via URL param | Information Disclosure | Admin-only route (`<ProtectedRoute>` + RLS); only admins can reach `/activity` so emails in URL are admin-readable, which is fine. |
| RPC denial-of-service via large arrays | Denial of Service | Filter arrays are bounded by the active specialists list (~5-20 emails); no risk at this N. |
| Photo path injection via `thumbnail_path` | Tampering | Photo paths come from `photos` rows; the admin only ever queries their own RLS-permitted rows. No user input enters the path. |

### Phase-3-specific security checklist (planner lifts into the migration plan)

- [ ] Every new RPC has `language sql stable security invoker` (matches Phase 2 RPCs verbatim)
- [ ] Every new RPC has `grant execute ... to authenticated`
- [ ] Every aggregation/select against `ui_interactions` includes `app_source = 'tpc-app'`
- [ ] Every aggregation/select against `items` / `sessions` / `photos` / `export_history` does NOT include any `app_source` filter (those are TPC-App-owned tables; no discriminator column exists there)
- [ ] No new RLS policies on TPC App tables (Phase 3 is read-only; existing admin-read-all policies are sufficient)
- [ ] No new RLS policies on dashboard-owned tables (Phase 3 doesn't add new tables)
- [ ] No `service_role` usage anywhere in `src/`
- [ ] Signed URLs use `createSignedUrl(path, 3600)` — exact TTL from D-11
- [ ] No raw SQL string concatenation; use parameterized RPC calls only

---

## Environment Availability

> Phase 3 is pure-frontend code + SQL migrations. No external runtime tool dependencies beyond what Phase 1 / Phase 2 already use (Supabase CLI, npm, Node).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, vitest, prebuild verifiers | ✓ (assumed — Phase 1/2 already running) | — | — |
| npm / vite / tsc | build pipeline | ✓ | per package.json | — |
| Supabase CLI | `db:push`, `db:types` | ✓ | ^2.81.3 | — |
| Live shared Supabase project | RPC deploy + types regen | ✓ (verified — Phase 1/2 deployed) | — | — |
| Storage bucket `photos` (private) | `useSignedPhotoUrl` runtime | ✓ (verified — TPC App migration `20260320200000_create_photos.sql:18-19` provisions it) | — | — |
| TPC App tables populated with real data | manual smoke + integration tests | likely ✓ in shared prod (Phase 3 trusts the assumption per CONTEXT) | — | If empty in dev DB, seed with fixture data |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research. The planner / discuss-phase should confirm before treating as locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST embedded join `profiles!sessions_assigned_to_fkey(...)` will FAIL because that FK name doesn't exist (the FK is `sessions.assigned_to → auth.users.id`, not `→ profiles.id`). Recommendation = ship server-side RPCs for any specialist-display-name join. | Pattern 3 + Pitfall 1 | Medium. If PostgREST does resolve the cross-schema chain auto-magically, the RPC variant is still correct — just slightly more code. If it doesn't (the assumed case), the RPC variant is mandatory. **Verify at plan time** by attempting a minimal probe in psql or via the Supabase Studio. |
| A2 | TPC App's `walkthrough_step` events carry the step name in `metadata->>'step'` (NOT a top-level column). | CONTEXT D-32 + Discretion | Low. Verified by reading `~/Projects/TPC_App/TPC_App/src/services/analytics.ts:42-48` — `interaction_type='walkthrough_step'` is in the type union but `step` itself is not a top-level column on `ui_interactions`. The emitter at `src/components/Walkthrough.tsx` (file exists; was not opened in research time) almost certainly puts step into `metadata`. **Verify at plan time** by reading `Walkthrough.tsx` before writing the funnel RPC. |
| A3 | The dashboard's `database.types.ts` is the source of truth for current shared-DB schema (e.g., `items.artist_first_name` and other columns NOT in the local TPC App migration files indicate that TPC App has unsynced migrations applied to prod). | Pitfall 2 (extended) | Medium. If the planner reads only TPC App's local migration files for schema, they'll miss columns. Always cross-reference `database.types.ts` (verified to include `artist_dates`, `artist_first_name`, `artist_last_name`, `artist_origin`, `medium` on the `items` Row at lines 175-178). |
| A4 | `sessions.status='completed'` exists in prod (TPC App migration `20260320000000_add_completed_status.sql` extends the CHECK constraint). The Export Pipeline chart should include it as a 5th segment. | Pitfall 2 + APP-05 | Medium. If excluded, sessions in `'completed'` state would not appear on the chart, missing real activity. Recommendation: include as 5th segment (color: TBD by planner — suggest `slate-600` or `gray-400` to denote "post-pipeline complete"). |
| A5 | The single-RPC + paired-summary decision for `get_stuck_items` (D-24 / Discretion) — recommendation is single RPC, card derives count + maxAge client-side. | Open Question + D-24 | Low. The TPC App's stuck-items volume is bounded by a small team; max stuck count realistically <200. Single-RPC payload is trivial. If a future scale issue emerges, splitting is a 1-plan refactor. |
| A6 | The TPC App's `ui_interactions.user_email` column is reliably populated whenever `user_id` is set, so no `JOIN auth.users` is required (D-32 Discretion). | CONTEXT Discretion | Low. Verified by reading `~/Projects/TPC_App/TPC_App/src/services/analytics.ts:107-125` — `trackUiInteraction` always writes both `user_id` AND `user_email` from the same `getUserContext()` call. |
| A7 | Specialist color cycle's per-render swap on filter-set change is acceptable to operators. | Pitfall 8 | Low. UAT signal would surface fast; v2.1 fix (localStorage persistence) is straightforward. |

---

## Open Questions

1. **Should `sessions.status='completed'` appear in APP-05's Export Pipeline chart?**
   - What we know: TPC App migration `20260320000000_add_completed_status.sql` extended the CHECK to include `'completed'`. Production data has this status.
   - What's unclear: CONTEXT D-17 references the original 4-status enum; UI-SPEC § APP-05 commits to 4 segments via `SESSION_STATUS_COLOR`.
   - Recommendation: include `'completed'` as a 5th segment with color `slate-500` (`#64748b`) — distinct from `active`'s `slate-400`. Add to `SESSION_STATUS_COLOR`. Plan-time decision.

2. **Should Active Sessions / Session Detail / Stuck Items use server-side RPCs or attempt PostgREST embedded joins first?**
   - What we know: `sessions.assigned_to → auth.users(id)`, NOT `→ profiles(id)`. Embedded `profiles!fk(...)` syntax would need to find the right FK name.
   - What's unclear: whether PostgREST infers cross-schema joins (`auth.users → profiles` via `profiles.id`) automatically.
   - Recommendation: ship RPCs for cleanliness. Probe PostgREST at plan time with a minimal `from('sessions').select('id, profiles(display_name)')` query in Supabase Studio. If that works, great; if not, RPC mandatory.

3. **Walkthrough step list and ordering — finalize in plan after reading TPC App's `Walkthrough.tsx` source.**
   - What we know: `interaction_type='walkthrough_step'` is emitted via `trackUiInteraction`. Step name is in `metadata->>'step'` (assumed A2).
   - What's unclear: the canonical step list (5? 10?) and their ordering for the funnel chart's Y-axis.
   - Recommendation: planner runs `grep -rn "walkthrough_step" ~/Projects/TPC_App/TPC_App/src/` and reads `Walkthrough.tsx` to enumerate steps. RPC `get_walkthrough_funnel()` orders them server-side via a CASE expression keyed on the step list.

4. **Should `useActiveSpecialists` be cached aggressively (`staleTime: Infinity`) or follow the default 60s?**
   - What we know: D-19 says "specialists with zero activity in range still render"; D-25 says default `staleTime: 60s`. The list of active specialists changes when an admin deactivates someone — rare.
   - What's unclear: how aggressive to cache this. Default 60s is fine; longer would prevent the UI from picking up an admin's just-made deactivation.
   - Recommendation: default `staleTime: 60s`. No special case.

5. **Should the dev panel's `<DeveloperPanel>` component live at `src/components/activity/DeveloperPanel.tsx` (per UI-SPEC) or be extracted to a generic shared component?**
   - What we know: UI-SPEC § Component Inventory says "Distinct file from Phase 2's `src/components/extension/DeveloperPanel.tsx` — different domain."
   - What's unclear: whether the chrome (collapse/expand outer container) should be extracted into a shared `<CollapsibleDevSection>`.
   - Recommendation: ship phase-scoped (per UI-SPEC). The two domains diverge in body content meaningfully; extract only when a 3rd consumer appears.

---

## Sources

### Primary (HIGH confidence — read directly during research)

- `c:\Users\maser\Projects\tpc-dashboard\.planning\phases\03-tpc-app-activity-activity\03-CONTEXT.md` — full read; 37 locked decisions D-01..D-37
- `c:\Users\maser\Projects\tpc-dashboard\.planning\phases\03-tpc-app-activity-activity\03-UI-SPEC.md` — read in 3 chunks; 1380 lines; component inventory + chart palettes + per-card copy + accessibility floor
- `c:\Users\maser\Projects\tpc-dashboard\.planning\REQUIREMENTS.md` — full read; APP-01..12 verbatim
- `c:\Users\maser\Projects\tpc-dashboard\.planning\STATE.md` — full read; Phase 3 context decisions all confirmed
- `c:\Users\maser\Projects\tpc-dashboard\.planning\ROADMAP.md` — full read; Phase 3 success criteria
- `c:\Users\maser\Projects\tpc-dashboard\.planning\phases\02-extension-analytics-extension\02-CONTEXT.md` — read; D-01 invariant pattern, D-12/D-13 server-aggregation, D-15/D-16 dev panel, D-21 ErrorState contract
- `c:\Users\maser\Projects\tpc-dashboard\.planning\phases\02-extension-analytics-extension\02-RESEARCH.md` — partial read; validation architecture template, Recharts JSDom mock pattern
- `c:\Users\maser\Projects\tpc-dashboard\.planning\phases\02-extension-analytics-extension\02-01-PLAN.md` — partial read; canonical RPC structure
- `c:\Users\maser\Projects\tpc-dashboard\.planning\phases\01-infrastructure-shared-ui-kit\01-CONTEXT.md` — partial read; Phase 1 deliverables Phase 3 imports
- `c:\Users\maser\Projects\tpc-dashboard\CLAUDE.md` — system context; service-role admin client rules
- `c:\Users\maser\Projects\tpc-dashboard\package.json` — version pins verified
- `c:\Users\maser\Projects\tpc-dashboard\src\components\ErrorState.tsx` — locked contract verbatim verified
- `c:\Users\maser\Projects\tpc-dashboard\src\components\extension\DeveloperPanel.tsx` — pattern reference
- `c:\Users\maser\Projects\tpc-dashboard\src\hooks\extension\useLiveFeed.ts` — pause/resume idiom reference
- `c:\Users\maser\Projects\tpc-dashboard\src\hooks\extension\useUserFilter.ts` — URL filter pattern reference
- `c:\Users\maser\Projects\tpc-dashboard\src\hooks\useDateRange.ts` — URL contract reference
- `c:\Users\maser\Projects\tpc-dashboard\src\services\extension\queries.ts` — service-layer pattern reference
- `c:\Users\maser\Projects\tpc-dashboard\src\lib\devAccess.ts` — `isDevAccount` import target
- `c:\Users\maser\Projects\tpc-dashboard\src\components\extension\LiveEventFeed.tsx` — partial read; LiveFeed UI idiom
- `c:\Users\maser\Projects\tpc-dashboard\src\components\kit\Sparkline.test.tsx` — Recharts JSDom mock pattern
- `c:\Users\maser\Projects\tpc-dashboard\src\App.tsx` — current route composition
- `c:\Users\maser\Projects\tpc-dashboard\src\db\database.types.ts` — schema source of truth (`profiles`, `sessions`, `items`, `photos`, `export_history`, `ui_interactions`, Phase 2 Functions)
- `c:\Users\maser\Projects\tpc-dashboard\supabase\migrations\20260429120000_create_extension_rpcs.sql` — partial read; canonical Phase 2 RPC structure for Phase 3 to mirror
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260318000000_create_profiles.sql` — `profiles` shape verified
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260318000001_create_sessions.sql` — `sessions.status` original 4-status CHECK
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260318000002_create_items.sql` — `items.ai_status` CHECK
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260318000006_add_email_to_profiles.sql` — `profiles.email` added
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260320000000_add_completed_status.sql` — **`'completed'` added to sessions.status CHECK**
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260320200000_create_photos.sql` — photos schema, `photos` bucket private, RLS confirms authenticated SELECT on `bucket_id='photos'`
- `c:\Users\maser\Projects\TPC_App\TPC_App\supabase\migrations\20260424000001_create_ui_interactions.sql` — `ui_interactions` schema; `interaction_type` enum; `metadata` jsonb
- `c:\Users\maser\Projects\TPC_App\TPC_App\src\services\analytics.ts` — `trackUiInteraction` shape; `walkthrough_step` interaction_type; `user_id` + `user_email` always written together
- `c:\Users\maser\Projects\TPC_App\TPC_App\src\hooks\usePhotoUrl.ts` — TPC App's signed-URL hook (TTL=3600s)

### Secondary (MEDIUM confidence — verified web sources)

- `[VERIFIED: tanstack.com/query/v5/docs/react/guides/window-focus-refetching]` — per-query `refetchOnWindowFocus: true` override confirmed for v5
- `[VERIFIED: tanstack.com/table/v8/docs/guide/expanding]` + `[CITED: tanstack.com/table/v8/docs/api/features/expanding]` — `getCanExpand`, `getIsExpanded`, `getToggleExpandedHandler`; expanded-row `<tr><td colSpan>...</td></tr>` pattern
- `[VERIFIED: postgresql.org/docs/current/functions-datetime.html]` — 3-arg `date_trunc('day', x, 'America/New_York')` returns `timestamptz`, handles DST automatically
- `[CITED: recharts.github.io/api/Pie/]` + `[CITED: github.com/recharts/recharts/pull/5244]` — per-`<Cell outerRadius>` for pulled-out slice
- `[VERIFIED: npm view recharts version → 3.8.1]`
- `[VERIFIED: npm view @tanstack/react-query version → 5.100.6]` (project pins ^5.99.2 — patch-compatible)
- `[VERIFIED: npm view @tanstack/react-table version → 8.21.3]`

### Tertiary (LOW confidence — single-source observations from research)

- `[ASSUMED]` PostgREST cannot resolve `sessions → profiles` join via the indirect `auth.users` chain — see Assumption A1; **must verify at plan time before locking the RPC vs embed decision**
- `[ASSUMED]` `walkthrough_step` puts step name in `metadata->>'step'` — see A2; **verify at plan time** by reading `Walkthrough.tsx` source

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every package verified against npm registry; zero new runtime deps; all paths verified to exist on disk
- Architecture (RPC pattern, filter scope, photo signing): HIGH — every pattern has a verified Phase 1 / Phase 2 / TPC App precedent
- TPC App schema: HIGH for the parts that matter (`profiles.role`, `profiles.is_active`, `profiles.email`, `profiles.display_name`, `profiles.walkthrough_completed`, `sessions.{name, mode, status, assigned_to, created_at, updated_at}`, `items.{ai_status, mode, session_id, created_at, receipt_number, title, category, estimate, transcript, description, measurements}`, `photos.{storage_path, thumbnail_path, upload_status, item_id}`, `ui_interactions.{app_source, user_id, user_email, interaction_type, page_path, element_id, metadata, created_at}`); MEDIUM on `sessions.status` enum (CHECK includes `'completed'` but original 4-status assumption persists in CONTEXT D-17 — see Open Q1)
- Pitfalls: HIGH — most pitfalls are direct carryovers from Phase 2 RESEARCH with verified call sites
- Validation Architecture: HIGH — leverages exact Phase 2 test infrastructure
- Security: MEDIUM-HIGH — Phase 3 is read-only; security boundaries are inherited; ASVS map is conservative
- Open Questions: MEDIUM — 5 plan-time decisions remain; none block planning, all have a recommended default

**Research date:** 2026-04-30

**Valid until:** 2026-05-30 (30 days; stable stack and locked CONTEXT). Re-research if (a) TPC App ships a migration that changes `sessions`, `items`, `profiles`, `photos`, or `ui_interactions` shape; (b) Recharts 4.x or TanStack Query v6 is published and the pinned versions move; (c) the `photos` bucket's privacy/RLS changes.
