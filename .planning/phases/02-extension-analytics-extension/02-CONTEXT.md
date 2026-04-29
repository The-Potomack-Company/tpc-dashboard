# Phase 2: Extension Analytics (`/extension`) - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the `/extension` admin route that consumes `public.analytics_events` and surfaces how the TPC AI Cataloger Chrome extension is being used: a 14-day stacked-bar event-volume chart, five per-event-type KPI cards (count + previous-period delta + sparkline), an error-rate bar chart, a per-user table, a Recent Errors table, and a 10-second-refetching live event feed — filtered by date range and user. A second, allowlist-gated `<DeveloperPanel>` at the bottom of the page reuses the same filters and surfaces dev-only signals (extension_version filter + dominant-version badge, cancellation-rate KPIs, payload viewer triggers).

Phase 2 reads only from `analytics_events` — no writes, no schema changes beyond the four aggregation RPCs. It does NOT touch TPC App tables (covered in Phase 3), does NOT add the `/activity` or `/live` routes, does NOT enable Supabase Realtime on `analytics_events`, and does NOT install Playwright or any scraper code.

Covers requirements: **EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09, EXT-10**.

</domain>

<decisions>
## Implementation Decisions

### Data Scoping (applies to every query on the page)

- **D-01:** Every query against `analytics_events` filters with `where app_source = 'tpc-extension'` (strict). Rows where `app_source IS NULL` (legacy, pre-extension-migration-006) are intentionally excluded. The shared table now serves both the extension and TPC_App; without this filter, EXT charts would mix in TPC_App events.
- **D-02:** The page uses a **5-event-type vocabulary** at the top level: `catalog_single`, `catalog_batch`, `portal_upload`, `spreadsheet_transform`, `data_import`. The 6th event type `catalog_item` (per-item child rows of `catalog_batch`, shipped in extension migration 003) is **excluded** from EXT-01 stacked bar, EXT-02 KPI cards, EXT-03 error rate, and EXT-04 per-user totals — counting children alongside their batch parent would double-count cataloging activity. `catalog_item` rows remain reachable from the developer panel's payload viewer if needed; otherwise they are not surfaced.
- **D-03:** Canonical "error" signal is `error_message IS NOT NULL`, exactly as REQUIREMENTS-EXT-03 specifies. Per-event-type rule branches are NOT used. The `item_status` and `error_count` columns exist but are not consulted for top-level error counts.
- **D-04:** Rows with `user_email IS NULL` are aggregated under a single `"Unknown"` bucket in EXT-04 (per-user table). `"Unknown"` is also a selectable value in the EXT-07 user multi-select. EXT-04 totals always reconcile with EXT-01 totals (no silent drops).
- **D-05:** "Previous period" for EXT-02 KPI deltas is **same-length, immediately preceding**. If selected range is N days ending on `to`, prior period is the N days ending on `from - 1 day`. Custom ranges follow the same rule. Calendar-aligned comparisons are out of scope.
- **D-06:** EXT-09 "dominant version" badge resolves to: the `extension_version` value with the most rows in the **active filter selection** (date range + user filter + version filter). Updates as filters change. Ties broken by latest semver.
- **D-07:** EXT-10 cancellation-rate KPIs are computed strictly per event type: `count(WHERE cancelled = true) / count(*)` with denominator scoped to `event_type IN ('catalog_batch')` for the W2 KPI and `event_type IN ('portal_upload')` for the W3 KPI. Two separate KPIs, both gated to the developer panel (D-15). Rows with `cancelled IS NULL` count toward the denominator (legacy rows with the column unpopulated do exist and reflect "not cancelled").
- **D-08:** EXT-02 sparkline resolution is **range-aware**: when `range = 'today'`, sparkline buckets are 24 hourly buckets in ET; for `7d` / `30d` / `custom`, buckets are daily in ET. Resolution is decided in the SQL aggregation (D-12), not the `<Sparkline>` component.

### Live Event Feed (EXT-08)

- **D-09:** Mechanism is **TanStack Query `refetchInterval`**, not Supabase Realtime. The feed component issues a SELECT against `analytics_events` (newest 50 rows, scoped by D-01) and `useQuery` re-fires every 10 seconds. Matches Phase 4's invalidate-driven precedent (SCRP-16) for high-volume INSERT tables. Avoids the per-row RLS fan-out cost of putting `analytics_events` in the Realtime publication.
- **D-10:** Refetch interval is **10 s** (slowest end of EXT-08's 5–10 s spec). Less load on Supabase, still inside spec.
- **D-11:** Pause behavior — clicking Pause sets `refetchInterval: false` on the live-feed `useQuery`. Resume re-enables interval AND immediately refetches; the rendered window jumps to "latest 50 right now" at resume time. Events that arrived during pause are NOT held as a backlog (option A from discussion). Feed starts auto-tailing on mount; Pause button is the only control.

### Query Architecture

- **D-12:** Page issues many TanStack queries (one per chart/table/feed), not a single overview RPC. Aggregating shapes go through Postgres RPCs (security-invoker, RLS still applies via the calling admin's session); non-aggregating shapes use raw `.from('analytics_events').select()`. New RPCs:
  - `get_event_volume_daily(p_from, p_to, p_users, p_versions)` — returns one row per (bucket_start, event_type) for EXT-01. Bucket = `date_trunc('day' OR 'hour', created_at AT TIME ZONE 'America/New_York')` depending on whether range is `today`.
  - `get_kpi_totals(p_from, p_to, p_users, p_versions)` — returns one row per event_type with totals + previous-period totals (computed inside the RPC against `[p_from - len, p_from)`) + sparkline series. Powers EXT-02.
  - `get_error_rate_by_type(p_from, p_to, p_users, p_versions)` — returns one row per event_type with `errors`, `total`, `rate`. Powers EXT-03.
  - `get_per_user_summary(p_from, p_to, p_users, p_versions)` — returns one row per user_email (NULL grouped as `"Unknown"`) with per-event-type counts, total errors, last-seen-at. Powers EXT-04.
  - Additional RPCs for cancellation rates (D-07) live behind the dev-panel gate; same shape, two-event-type denominator.
- **D-13:** Bucketing is **server-side** via `date_trunc(... AT TIME ZONE 'America/New_York')` so the buckets line up with `useTimezone`'s ET-only formatting. Client-side bucketing in JS is not used.
- **D-14:** Codebase layout: `src/services/extension/queries.ts` exports query-builder helpers (raw `.from().select()` builders for non-aggregating queries; thin `.rpc()` wrappers for the four aggregation RPCs). React hooks live in `src/hooks/extension/` — one hook per RPC + one per non-aggregating query. Hooks fold the URL filters into the queryKey (D-17). Page + chart components import the hooks; they never call `supabase` directly.

### Admin / Developer Surface Split

- **D-15:** The page has two visually distinct surfaces:
  - **Admin surface** (always rendered): EXT-01 stacked bar, EXT-02 five KPI cards, EXT-03 error-rate bar, EXT-04 per-user table, EXT-05 recent-errors table, EXT-07 date+user filters, EXT-08 live event feed.
  - **Developer surface** (rendered only when `isDevAccount(profile.email)` is true): collapsed-by-default `<DeveloperPanel>` at the bottom of `/extension`. Contains the EXT-09 extension_version multi-select + dominant-version badge, the two EXT-10 cancellation-rate KPIs, and the EXT-06 payload-viewer triggers.
- **D-16:** Identity gate is an **email allowlist**, not a build-mode check. Module: `src/lib/devAccess.ts` exporting `isDevAccount(email: string | null | undefined): boolean`. Initial allowlist constant: `['josh@potomackco.com']`. The allowlist is read once via the Zustand auth store. Admin role and `private.is_admin()` are unchanged — dev access is purely additive on top of admin auth.
  - Trade-off accepted: the allowlist ships in the production JS bundle (visible to anyone who inspects sources). An email is not a secret — this is fine.
  - Future: when more devs need access, add their email to the constant; no migration, no backend change.
- **D-17:** Filters (date range, user_email[], extension_version[]) are **URL-driven**, single source of truth, no Zustand store. Reuse `useDateRange` from Phase 1. Add two new hooks:
  - `useUserFilter()` reads/writes `?users=email1,email2` and exposes `{ users: string[], setUsers(next) }`.
  - `useVersionFilter()` reads/writes `?versions=2.0.1,2.0.2` and exposes `{ versions: string[], setVersions(next) }`.
  Each chart hook reads the active filters and folds them into its queryKey, so a filter change naturally invalidates every dependent chart. The version filter input only renders inside the `<DeveloperPanel>` — admin users never see it — but the underlying `?versions=` URL parameter still applies to charts on both surfaces if a dev shares a URL with an admin (admin would just see filtered charts without controls to change the filter, which is acceptable).
- **D-18:** Recent Errors table (EXT-05) renders for both surfaces with the spec'd columns (timestamp, user_email, event_type, error_message, extension_version). The "view payload" action is gated by `isDevAccount`: admins see the row but no payload-open affordance; devs see the action and can open `<PayloadViewerModal>`. Live feed (EXT-08) row click follows the same rule: admin row click is a no-op, dev row click opens the payload viewer.

### Empty / Loading / Error UX

- **D-19:** Full-page empty state when **lifetime** extension events = 0. A `useExtensionGate()` hook in `src/hooks/extension/` issues `select('id').eq('app_source', 'tpc-extension').limit(1)` once per session (`staleTime: Infinity`) and exposes `{ isEmpty: boolean, isLoading: boolean }`. When `isEmpty`, the page renders a centered `<EmptyState>` (reused from `src/components/EmptyState.tsx`) with copy: "No extension events yet — waiting on TPC AI Cataloger v2.0." No charts, no tables, no feed mounted. The gate respects `app_source` (D-01) so legacy NULL-source rows do not flip it.
- **D-20:** Per-card empty messages when lifetime ≠ 0 but the active filter selection returns zero. Each KPI card shows `—` for value, no delta, no sparkline. Each chart renders its own empty message ("No events in this range" / "No errors in this range"). Live feed renders "Waiting for events…" until first row arrives.
- **D-21:** Per-card loading + per-card error. KpiCard already supports `loading` (Phase 1 D-13). Charts use a skeleton placeholder (reuse `src/components/TableSkeleton.tsx` for tables). Errors render per-card with `<ErrorState>` from `src/components/ErrorState.tsx` and a Retry button that calls the underlying `useQuery`'s `refetch()`. No page-level Suspense boundary; one slow query never blocks others.

### Claude's Discretion

- Exact Tailwind class choices for the page layout (chart grid, KPI strip, table styling) — match the visual style established by the `/kit` page and the v1.0 components.
- Layout of the `<DeveloperPanel>` (single-column collapsed accordion vs side-by-side once expanded).
- Whether the `/extension` nav entry icon uses an emoji, an SVG, or a Heroicon — keep it consistent with whatever Phase 3 (`/activity`) and Phase 5 (`/live`) will need; if undecided, use a simple SVG.
- Recent Errors table cap — REQUIREMENTS doesn't specify. Default to 100 rows with a `LIMIT 100 ORDER BY created_at DESC`; revisit if the cap turns out too low in operator UAT.
- Per-user table column shape — pivot wide (one column per event_type) is the default since there are 5 columns. If layout becomes cramped, fall back to total + popover-on-hover for per-type breakdown.
- URL filter param naming exact form (`?users=` vs `?user=` repeated) — go with the comma-separated single-key form to match how the date range encodes its values.
- RPC argument shape (positional vs JSON) — positional with explicit defaults is fine; the four signatures share the same `(p_from timestamptz, p_to timestamptz, p_users text[], p_versions text[])` prefix.
- Initial empty-state copy wording — match Phase 1's plain tone; finalize in plan execution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current-milestone requirements
- `.planning/REQUIREMENTS.md` § v2.0 Requirements § Extension Analytics (Capability B) — EXT-01..EXT-10 verbatim
- `.planning/ROADMAP.md` § Phase 2: Extension Analytics (`/extension`) — phase goal, dependencies, 6 success criteria (including the empty-state criterion #6)
- `.planning/PROJECT.md` § Active (v2.0 Live Ops) — extension analytics target capability
- `.planning/PROJECT.md` § Constraints — shared-database non-interference + admin-only access model

### Phase 1 carryovers (locked, do not re-litigate)
- `.planning/phases/01-infrastructure-shared-ui-kit/01-CONTEXT.md` § Implementation Decisions — D-11 through D-25 cover the UI kit + hooks + admin client conventions Phase 2 consumes
- `.planning/phases/01-infrastructure-shared-ui-kit/01-VERIFICATION.md` — Phase 1 must-haves passed (5/5)
- `.planning/STATE.md` § Accumulated Context § Decisions — recharts mock pattern (Phase 1 / 01-05), useDateRange URL-driven contract, KpiCard delta semantic neutrality

### Phase 1 reusable assets (concrete files to import from, not copy)
- `src/components/kit/KpiCard.tsx` — EXT-02 KPI cards
- `src/components/kit/Sparkline.tsx` — EXT-02 sparkline slot inside KpiCard
- `src/components/kit/PayloadViewerModal.tsx` — EXT-06 payload viewer (dev-panel gated, D-15)
- `src/components/kit/DateRangeFilter.tsx` — EXT-07 date filter
- `src/hooks/useDateRange.ts` — EXT-07 date-range URL contract
- `src/hooks/useTimezone.ts` — ET-only formatters; SQL bucketing in D-13 must align with this hook
- `src/components/EmptyState.tsx` — D-19 full-page empty state, D-20 per-card empty
- `src/components/ErrorState.tsx` — D-21 per-card error. **LOCKED CONTRACT** (verified by reading the source 2026-04-29 during checker revision): props are `{ heading: string (required); body: string (required, plain string NOT children); onRetry: () => void (required) }`. The component renders its own Retry button internally — DO NOT add a sibling `<button>Retry</button>` in callers; DO NOT use children syntax. All Phase 2 plans 02-04, 02-05, 02-06, 02-07 use this contract verbatim.
- `src/components/TableSkeleton.tsx` — D-21 per-card loading for tables
- `src/components/SortIndicator.tsx`, `src/components/FilterInput.tsx` — opportunistic reuse for EXT-04 / EXT-05 tables
- `src/layouts/DashboardLayout.tsx` — `NAV_ITEMS` is empty; Phase 2 adds the `/extension` entry
- `src/main.tsx` — `QueryClientProvider` already wired; Phase 2 just consumes it
- `src/lib/supabase.ts` — anon client (frontend-only); never use `scraper/lib/supabase-admin.ts` from `src/`
- `src/db/database.types.ts` — already includes the full live `analytics_events` shape (extension migrations 001..006 applied to prod)

### Schema reference (extension repo, read for understanding only — do NOT mirror new columns)
- `~/Projects/TPC_AI_Cataloger/supabase/migrations/001_analytics_events.sql` — original 5-event schema
- `~/Projects/TPC_AI_Cataloger/supabase/migrations/002_add_started_at.sql` — adds `started_at` (Phase 2 may surface duration in the dev panel; not in EXT-01..10)
- `~/Projects/TPC_AI_Cataloger/supabase/migrations/003_catalog_item_rows.sql` — adds the 6th event type `catalog_item` + `item_index` + `item_status` (excluded from top-level charts per D-02)
- `~/Projects/TPC_AI_Cataloger/supabase/migrations/004_add_ended_at.sql` — adds `ended_at`
- `~/Projects/TPC_AI_Cataloger/supabase/migrations/005_add_engine_timestamps.sql` — adds `engine_started_at`, `engine_ended_at` for W4
- `~/Projects/TPC_AI_Cataloger/supabase/migrations/006_add_app_source.sql` — adds `app_source` (the column D-01's strict filter relies on)

### Existing dashboard schema
- `supabase/migrations/20260424120500_create_analytics_events.sql` — Phase 1 INFR-05 admin-SELECT RLS already shipped. Phase 2 ships only the four aggregation RPCs (D-12); no new columns, no new policies.

### Stack documentation
- `CLAUDE.md` § Technology Stack — version pins (Recharts 3.8.1, Supabase JS 2.101.1, TanStack Query, date-fns, date-fns-tz)
- `CLAUDE.md` § Conventions § Service-role Supabase admin client — confirms `src/` MUST NOT import the admin client; Phase 2 stays pure-frontend
- `CLAUDE.md` § GSD Workflow Enforcement — planning-artifact discipline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 1 UI kit (`src/components/kit/`)** — `KpiCard`, `Sparkline`, `PayloadViewerModal`, `DateRangeFilter` are all production-ready with colocated Vitest suites. Phase 2 imports them as-is; no fork.
- **Phase 1 hooks (`src/hooks/`)** — `useDateRange` provides the URL contract Phase 2 extends with `useUserFilter` + `useVersionFilter`. `useTimezone` provides ET formatters; SQL bucketing in D-13 must use the same `'America/New_York'` zone.
- **v1.0 components retained (Phase 1 D-25)** — `EmptyState`, `ErrorState`, `FilterInput`, `SortIndicator`, `TableSkeleton`, `BackLink` are kept and reused opportunistically. Phase 2 uses `EmptyState` (D-19, D-20), `ErrorState` (D-21), `TableSkeleton` (D-21), and likely `SortIndicator` + `FilterInput` for EXT-04 / EXT-05 tables.
- **Auth store (`src/stores/authStore.ts`)** — exposes `{ session, profile, isAdmin }`. `isDevAccount(profile.email)` from `src/lib/devAccess.ts` (new module, D-16) is read once per render via the same store.
- **`src/main.tsx`** — `QueryClientProvider` is module-level; `staleTime: 60s`, `retry: 1`, `refetchOnWindowFocus: false`. The page composes inside this provider tree without changes. The 10-second live-feed refetch (D-10) goes through `refetchInterval`, not `staleTime`.
- **`src/db/database.types.ts`** — already reflects extension migrations 001..006 (verified by grep: includes `app_source`, `started_at`, `ended_at`, `item_status`, etc.). Phase 2's RPCs will need types regen via `npm run db:types` after the migrations land.
- **`supabase/migrations/20260424120500_create_analytics_events.sql`** — the admin-SELECT policy (`analytics_admin_select`) gates every Phase 2 query. Anon INSERT policy is preserved. Phase 2 does not modify this migration.

### Established Patterns

- **TanStack Query**: module-level QueryClient, `staleTime: 60s`, `refetchOnWindowFocus: false`, `retry: 1`. Phase 2 follows this. Live feed overrides with `refetchInterval: 10000` (D-10) and `staleTime: 0` so each refetch returns fresh rows.
- **Supabase queries**: typed via `Database` from `src/db/database.types.ts`. RPCs are called via `supabase.rpc('get_kpi_totals', { p_from, p_to, p_users, p_versions })`.
- **RLS**: every policy calls `private.is_admin()` (statement-cached subquery wrapper, Phase 1 pattern). Phase 2's RPCs are `security invoker` (default), so the admin SELECT policy continues to govern reads.
- **Tailwind v4**: `@tailwindcss/vite` plugin; classes inline. Page layout uses utility classes — no custom CSS.
- **Migrations**: timestamped `YYYYMMDDHHMMSS_<name>.sql`. Idempotent where possible (`create or replace function` for RPCs). Forbidden: `supabase db pull`, `supabase db reset --linked`. Allowed: `supabase db push`, `supabase gen types`.
- **ESLint v9 flat config + Vitest**: every new component/hook ships with a colocated `*.test.tsx` / `*.test.ts` per the Phase 1 pattern (Recharts JSDom mock pattern is documented in STATE.md and reusable for any chart test).
- **URL-driven filters**: Phase 1 D-20 set the precedent. Phase 2 extends, never abandons it.

### Integration Points

- **`src/App.tsx`** — currently routes `/login`, `/`, and the dev-only `/kit`. Phase 2 adds `<Route path="/extension" element={<ExtensionPage />} />` inside the `<DashboardLayout>` group. No dynamic-import gating needed (the page is admin-facing, not dev-only).
- **`src/layouts/DashboardLayout.tsx`** — `NAV_ITEMS` array is empty (Phase 1 explicitly reset it). Phase 2 adds the first entry: `{ label: 'Extension', to: '/extension', Icon: ... }`. Phase 3 + Phase 5 will append `/activity` and `/live` later.
- **`src/lib/supabase.ts`** — Phase 2's hooks import the anon client from here. The admin client (`scraper/lib/supabase-admin.ts`) is NEVER imported from `src/` — the prebuild grep guard (Phase 1 D-09) catches it.
- **Shared Supabase project** — same URL/anon key as TPC App. Phase 2 RPCs land via `supabase db push` from this repo. Types regen via `npm run db:types` writes to `src/db/database.types.ts` and is committed.
- **Dev-account allowlist (`src/lib/devAccess.ts`)** — new module created in Phase 2. Single export `isDevAccount(email: string | null | undefined): boolean`. Constant: `['josh@potomackco.com']`. Read via the auth store inside `<DeveloperPanel>` and inside the EXT-05 / EXT-08 row-click handlers (D-18).

</code_context>

<specifics>
## Specific Ideas

- **The dev-panel split is the biggest UX shift in this phase**, not a small flag. It changes how every "diagnostic" requirement (EXT-06, EXT-09, EXT-10) is exposed and shapes the visual hierarchy of the page. The collapsed-by-default `<DeveloperPanel>` at the bottom is deliberate — admin's eye should not even land on it.
- **Filters apply to BOTH surfaces** because they're URL-driven (D-17). A dev who narrows the date range on the admin surface sees the dev panel rebucket too. This is a feature, not a coincidence: it means the dev's "let me investigate" use case is one URL change away from "what is the admin seeing right now".
- **The 10-second feed refetch interval is at the slow end of the spec on purpose** (D-10). Cataloging happens at minute-scale, not second-scale; faster polling is just load on Supabase. If operator UAT shows the feed feels sluggish, the interval is one config change away.
- **The `app_source = 'tpc-extension'` filter is the most-likely-to-be-forgotten invariant** in any new query. Plan should call it out explicitly in the RPC headers and in `services/extension/queries.ts` JSDoc. Code review checklist item: "every new query against `analytics_events` MUST scope by `app_source`".
- **The `catalog_item` exclusion is REQUIREMENTS-aligned** (REQUIREMENTS.md says "5 event types"). Any future v2.1+ phase that wants to surface per-item analytics should do so via a different chart, not by sneaking `catalog_item` into the existing event_type rollups.
- **Don't mirror new extension columns into our migration**. Extension migrations 002..006 already shipped against the live shared project; our types regen reflects them. The dashboard's `20260424120500_create_analytics_events.sql` deliberately stops at the 001 shape because the live table is a no-op recipient (Phase 1 D-21). New extension migrations don't need a dashboard counterpart.

</specifics>

<deferred>
## Deferred Ideas

- **Per-item analytics on `catalog_item`** (avg time per item, success rate by category, skip-reason breakdown) — `catalog_item` rows carry `item_status`, `item_index`, `error_message`, and `category_id`; rich potential signal. Out of scope for Phase 2 per D-02; revisit in v2.1+. APP-FUT-01 already gestures at heat-map shapes for related signals.
- **Duration analytics** (W2 batch wall-clock from `started_at`/`ended_at`, W4 wizard vs engine duration) — extension columns exist (002, 005) but no EXT-01..10 requirement uses them. Defer to v2.1+ "Batch performance" view (EXT-FUT-01).
- **Per-user detail route `/extension/users/:email`** — drilling into a single user's full timeline. Listed as EXT-FUT-04. Phase 2's EXT-04 gives totals; the drill-down comes later.
- **Supabase Realtime on `analytics_events`** — explicitly rejected for Phase 2 (D-09). Revisit only if (a) operator UAT shows the 10-s feed feels too laggy AND (b) Phase 4's Realtime-on-`live_lot_current` proves out the publication+RLS pattern at low cost.
- **Server-side pagination for Recent Errors table** — Phase 2 ships with a flat `LIMIT 100` (Claude's discretion). If errors regularly exceed 100 in the active range, add cursor-based pagination in a follow-up plan.
- **Roles-based dev panel gating** (instead of email allowlist) — D-16 chose the email allowlist as the minimum viable gate. If multiple devs need access AND the team prefers it lives in the database, swap to a `profiles.is_developer` column without changing the page-side gate logic.
- **Cross-app comparison view** ("extension vs TPC_App event volume side-by-side") — possible future use of the `app_source` column. Out of scope for `/extension`; would belong on a new route entirely.
- **Empty-state polling** — `useExtensionGate()` is `staleTime: Infinity` (D-19). Once a session sees `isEmpty = false`, it never re-checks. If the user keeps the tab open past the moment the extension v2.0 ships, they'd need to refresh. Acceptable trade-off; revisit if it surprises anyone.
- **Background-tab feed throttling** — TanStack's `refetchIntervalInBackground` defaults to false. Feed pauses naturally when tab is backgrounded; not a problem to solve now.
- **Toast-based error UX** — explicitly rejected for D-21. Per-card `<ErrorState>` is more discoverable.

</deferred>

---

*Phase: 02-extension-analytics-extension*
*Context gathered: 2026-04-29*
