# Phase 3: TPC App Activity (`/activity`) — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 53 (3 pages, 22 components, 18 hooks, 1 service, 1 migration, 3 lib modules + extensions, 6 verifiers)
**Analogs found:** 50 / 53 — Phase 2 deliverables provide near-1:1 templates for almost every Phase 3 file. Only `useSignedPhotoUrl`, `severity.ts`, and `chartPalette.ts` lack a same-domain analog (closest matches still extracted).

> **Phase 3 is a clone-and-adapt of Phase 2.** Plans should default to "copy the Phase 2 analog, swap `analytics_events` → TPC App tables, swap `app_source = 'tpc-extension'` → TPC-App-table scoping". Where the patterns diverge — photo signed URLs, dual filter axes (right-now vs range-driven), nested routes — call it out explicitly in plan headers.

---

## File Classification

### Frontend pages (3)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/pages/Activity.tsx` | page | request-response (composes ~9 child queries) | `src/pages/Extension.tsx` | exact (page composition + filter row + DeveloperPanel placement) |
| `src/pages/SessionDetail.tsx` | page | request-response (single record + child list) | `src/pages/Extension.tsx` (page shell only — no detail-route precedent in repo) | role-match (page shell idiom only; new layout with BackLink + metadata + table) |
| `src/pages/StuckItems.tsx` | page | request-response | `src/pages/Extension.tsx` (page shell only) | role-match |

### Frontend components — activity feature (22)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/activity/TodayKpiStrip.tsx` | component | request-response (1 RPC) | `src/components/extension/KpiStrip.tsx` | exact |
| `src/components/activity/ActiveSessionsTable.tsx` | component | request-response (TanStack Table) | `src/components/extension/PerUserTable.tsx` | exact |
| `src/components/activity/StuckItemsAlertCard.tsx` | component | request-response | `src/components/extension/KpiStrip.tsx` (KpiCard idiom) | role-match (single severity-toned card) |
| `src/components/activity/ItemsPerSpecialistChart.tsx` | component | request-response (Recharts stacked bar) | `src/components/extension/EventVolumeChart.tsx` | exact (stacked bar + pivot + ET ticks) |
| `src/components/activity/AiStatusDonut.tsx` | component | request-response (Recharts Pie) | `src/components/extension/ErrorRateChart.tsx` | role-match (Recharts container chrome only — Pie is new shape) |
| `src/components/activity/HouseSaleSplit.tsx` | component | request-response (paired KPIs) | `src/components/extension/KpiStrip.tsx` | exact |
| `src/components/activity/ExportPipelineChart.tsx` | component | request-response (Recharts horizontal stacked bar) | `src/components/extension/ErrorRateChart.tsx` | exact (`layout="vertical"` horizontal-bar idiom) |
| `src/components/activity/SessionMetadataCard.tsx` | component | request-response | `src/components/kit/KpiCard.tsx` (presentational card chrome) | role-match |
| `src/components/activity/PhotoCoveragePanel.tsx` | component | request-response | `src/components/extension/KpiStrip.tsx` (count breakdown) | role-match |
| `src/components/activity/SessionItemList.tsx` | component | request-response (TanStack Table + row expansion) | `src/components/extension/PerUserTable.tsx` | exact (chrome) — extends with `getExpandedRowModel` |
| `src/components/activity/SessionItemDisclosure.tsx` | component | request-response | `src/components/extension/RecentErrorsTable.tsx` (dev-gated cell idiom) | role-match (per-row dev-gated content) |
| `src/components/activity/ThumbnailTile.tsx` | component | request-response (calls `useSignedPhotoUrl`) | none in repo | **no analog** — new contract |
| `src/components/activity/RawItemInspector.tsx` | component | request-response (modal trigger) | `src/components/extension/RecentErrorsTable.tsx` (PayloadViewerModal trigger lines 105-130) | exact |
| `src/components/activity/StuckItemsTable.tsx` | component | request-response (TanStack Table — clickable rows) | `src/components/extension/PerUserTable.tsx` | exact (chrome) — adds `onClick` row navigation |
| `src/components/activity/DeveloperPanel.tsx` | component | request-response (collapsible wrapper) | `src/components/extension/DeveloperPanel.tsx` | exact |
| `src/components/activity/FailedAiBreakdown.tsx` | component | request-response (3-column KpiCard grid) | `src/components/extension/CancellationRateKpis.tsx` | exact |
| `src/components/activity/UiInteractionsPanel.tsx` | component | composition wrapper | `src/components/extension/DeveloperPanel.tsx` (sub-panel grouping) | role-match |
| `src/components/activity/UiTopPagesTable.tsx` | component | request-response (TanStack Table) | `src/components/extension/PerUserTable.tsx` | exact |
| `src/components/activity/UiTopElementsTable.tsx` | component | request-response (TanStack Table) | `src/components/extension/PerUserTable.tsx` | exact |
| `src/components/activity/WalkthroughFunnel.tsx` | component | request-response (Recharts horizontal bar) | `src/components/extension/ErrorRateChart.tsx` | exact |
| `src/components/activity/UiRecentEventsFeed.tsx` | component | event-driven (live tail) | `src/components/extension/LiveEventFeed.tsx` | exact |

### Frontend components — shared (top-level src/components/) (2)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/SpecialistMultiSelect.tsx` | component | request-response (popover multi-select) | `src/components/UserMultiSelect.tsx` | exact |
| `src/components/ModeToggle.tsx` | component | URL state | `src/components/kit/DateRangeFilter.tsx` (preset row segmented buttons) | role-match (reuse segmented-button idiom only) |

### Hooks (18)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/hooks/useSpecialistFilter.ts` | hook (URL filter) | URL state | `src/hooks/extension/useUserFilter.ts` | exact |
| `src/hooks/useModeFilter.ts` | hook (URL filter) | URL state | `src/hooks/extension/useUserFilter.ts` | exact (single-value variant) |
| `src/hooks/useSignedPhotoUrl.ts` | hook (per-photo URL) | request-response with refetch-on-focus | `src/hooks/extension/useLiveFeed.ts` (only `defaultOptions` override precedent in repo) | role-match — load-bearing new contract per Success Criterion #5 |
| `src/hooks/activity/useTodayKpis.ts` | hook (RPC) | request-response | `src/hooks/extension/useKpiTotals.ts` | exact (drop sparkline arg, add specialist+mode args) |
| `src/hooks/activity/useActiveSessions.ts` | hook (raw select with join) | request-response | `src/hooks/extension/usePerUserSummary.ts` (hook shape) + `src/services/extension/queries.ts:fetchRecentErrors` (raw select pattern) | role-match |
| `src/hooks/activity/useActiveSpecialists.ts` | hook (option list) | request-response | `src/hooks/extension/useDistinctVersions.ts` | exact |
| `src/hooks/activity/useItemsPerSpecialist.ts` | hook (RPC) | request-response | `src/hooks/extension/useEventVolume.ts` | exact |
| `src/hooks/activity/useAiStatusDistribution.ts` | hook (RPC) | request-response | `src/hooks/extension/useEventVolume.ts` | exact |
| `src/hooks/activity/useExportPipeline.ts` | hook (RPC) | request-response | `src/hooks/extension/useEventVolume.ts` | exact |
| `src/hooks/activity/useHouseSaleSplit.ts` | hook (RPC) | request-response | `src/hooks/extension/useKpiTotals.ts` | exact |
| `src/hooks/activity/useStuckItems.ts` | hook (RPC) | request-response | `src/hooks/extension/usePerUserSummary.ts` | exact (no date-range args) |
| `src/hooks/activity/useSessionDetail.ts` | hook (raw select with join) | request-response | `src/services/extension/queries.ts:fetchRecentErrors` | role-match |
| `src/hooks/activity/usePhotoCoverage.ts` | hook (RPC) | request-response | `src/hooks/extension/useKpiTotals.ts` | exact |
| `src/hooks/activity/useFailedAiBreakdown.ts` | hook (RPC) | request-response | `src/hooks/extension/useEventVolume.ts` | exact |
| `src/hooks/activity/useUiTopPages.ts` | hook (RPC) | request-response | `src/hooks/extension/useEventVolume.ts` | exact (no specialist+mode args — D-34) |
| `src/hooks/activity/useUiTopElements.ts` | hook (RPC) | request-response | `src/hooks/extension/useEventVolume.ts` | exact |
| `src/hooks/activity/useWalkthroughFunnel.ts` | hook (RPC) | request-response | `src/hooks/extension/usePerUserSummary.ts` | exact (no args at all) |
| `src/hooks/activity/useUiRecentEventsFeed.ts` | hook (live tail) | event-driven | `src/hooks/extension/useLiveFeed.ts` | exact |

### Services & migration (2)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/services/activity/queries.ts` | service (Supabase builders) | request-response | `src/services/extension/queries.ts` | exact |
| `supabase/migrations/<ts>_phase_3_activity_rpcs.sql` | migration (Postgres RPCs) | CRUD (read-only RPCs) | `supabase/migrations/20260429120000_create_extension_rpcs.sql` | exact |

### Library / utility (3)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/lib/severity.ts` | utility (constants + classifier) | pure | `src/lib/devAccess.ts` (constants-and-helper module shape) | role-match |
| `src/lib/chartPalette.ts` | utility (color constants) | pure | `src/components/extension/EventVolumeChart.tsx:33-39` (`EVENT_COLORS` map inline) | role-match — extract pattern from inline component constants |
| `src/lib/format.ts` (extension) | utility (add `formatAge`) | pure | `src/lib/format.ts` (existing module — extend in place) | exact |

### Modifications (3)

| Modified File | Role | Modification |
|---------------|------|--------------|
| `src/App.tsx` | router | Add 3 `<Route>` entries inside `<DashboardLayout>` group |
| `src/layouts/DashboardLayout.tsx` | layout | Append `/activity` entry to `NAV_ITEMS` array |
| `src/db/database.types.ts` | generated | Regenerate via `npm run db:types` after migration applies |

### Verifiers (6 new prebuild scripts)

| New File | Role | Closest Analog | Match Quality |
|----------|------|----------------|---------------|
| `scripts/verify-activity-app-source-scope.mjs` | verifier (SQL grep) | `scripts/verify-extension-app-source-scope.mjs` | exact (swap `app_source = 'tpc-extension'` → `app_source = 'tpc-app'` for ui_interactions only; D-13 ET bucketing identical) |
| `scripts/verify-activity-rpc-shape.mjs` | verifier (RPC presence) | `scripts/verify-extension-app-source-scope.mjs` (RPC name list iteration) | exact |
| `scripts/verify-activity-table-readonly.mjs` | verifier (no `INSERT/UPDATE/DELETE` against TPC App tables) | `scripts/check-no-service-role-in-src.mjs` (file-walk + grep) | role-match (boundary enforcement) |
| `scripts/verify-activity-stuck-threshold-hardcoded.mjs` | verifier (`interval '2 hours'` literal in `get_stuck_items`) | `scripts/verify-extension-app-source-scope.mjs` | role-match |
| `scripts/verify-activity-photos-ttl.mjs` | verifier (signed URL TTL = 3600 in `useSignedPhotoUrl`) | `scripts/check-no-service-role-in-src.mjs` (source walk + grep) | role-match |
| `scripts/verify-activity-mode-filter-on-sessions.mjs` | verifier (no `items.mode =` filter; only `sessions.mode =`) | `scripts/verify-extension-app-source-scope.mjs` | role-match (D-20 invariant) |

### Tests (per-component / per-hook)

| New Files | Role | Closest Analog |
|-----------|------|----------------|
| `src/pages/Activity.test.tsx`, `SessionDetail.test.tsx`, `StuckItems.test.tsx` | test | `src/pages/Extension.test.tsx`, `Extension.smoke.test.tsx` |
| `src/components/activity/*.test.tsx` (~22 files, colocated) | test | `src/components/extension/*.test.tsx` (each component has a colocated suite) |
| `src/hooks/activity/*.test.tsx` (subset — only non-trivial ones, mirroring Phase 2) | test | `src/hooks/extension/__tests__/` + colocated `*.test.tsx` |

---

## Pattern Assignments

> Below: per-file analog pointer + literal code excerpts. Planner pastes excerpts into each plan's `<read_first>` section so executors don't re-discover patterns.

### `src/services/activity/queries.ts` (service, request-response)

**Analog:** `src/services/extension/queries.ts`

**Imports + invariant header (lines 1-14):**
```ts
//
// Phase 2 / EXT-01..10 — Supabase query/RPC builders for /extension.
//
// IMPORTANT: every aggregation and select against analytics_events MUST scope by
// app_source = 'tpc-extension' (CONTEXT D-01). The 5-event vocabulary excludes
// catalog_item from EXT-01..04 (D-02). The error signal is `error_message IS NOT NULL`
// (D-03). Bucketing is server-side (D-13).
//
// Code-review checklist: every new function in this module MUST .eq('app_source', 'tpc-extension').
// Plan 02-01's static verifier (scripts/verify-extension-app-source-scope.mjs) covers the SQL
// migration; this JSDoc + reviewer convention covers the TypeScript half.

import { supabase } from '../../lib/supabase';
import type { Database } from '../../db/database.types';
```
**Phase 3 swap:** Header invariants change to "every right-now / range-driven RPC accepts `(p_specialists text[], p_mode text)` per D-30; range-driven additionally accepts `(p_from, p_to)`. Every `ui_interactions` query (RPC body OR raw `.from()`) MUST `.eq('app_source', 'tpc-app')` per D-33. Mode filter targets `sessions.mode`, NEVER `items.mode` per D-20."

**RPC builder pattern (lines 50-66):**
```ts
export async function fetchEventVolume(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
  bucket: 'day' | 'hour';
}): Promise<VolumeRow[]> {
  const { data, error } = await supabase.rpc('get_event_volume_daily', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users, // empty array = "no filter" (Pitfall 2)
    p_versions: args.versions,
    p_bucket: args.bucket,
  });
  if (error) throw error;
  return data ?? [];
}
```
**Phase 3 swap:** rename signature args → `{ from, to, specialists, mode }`. Right-now RPCs drop `from`/`to` entirely.

**Raw `.from().select()` pattern with conditional `.in()` filters (lines 183-205):**
```ts
export async function fetchRecentErrors(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
  limit?: number;
}): Promise<EventRow[]> {
  let q = supabase
    .from('analytics_events')
    .select('id, created_at, user_email, event_type, error_message, extension_version, items_content')
    .eq('app_source', 'tpc-extension') // D-01
    .not('error_message', 'is', null) // D-03
    .in('event_type', EXTENSION_EVENT_TYPES as unknown as string[]) // D-02
    .gte('created_at', args.from.toISOString())
    .lte('created_at', args.to.toISOString())
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 100);
  if (args.users.length) q = q.in('user_email', args.users);
  if (args.versions.length) q = q.in('extension_version', args.versions);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}
```
**Phase 3 use:** Active Sessions list, Session Detail items, ui_interactions live feed. Embedded joins use PostgREST syntax: `.select('*, sessions!inner(name, mode), profiles!inner(display_name)')`.

**Typed result aliases (lines 28-40):**
```ts
export type VolumeRow = Database['public']['Functions']['get_event_volume_daily']['Returns'][number];
export type KpiRow = Database['public']['Functions']['get_kpi_totals']['Returns'][number];
export type ErrorRateRow = Database['public']['Functions']['get_error_rate_by_type']['Returns'][number];
export type PerUserRow = Database['public']['Functions']['get_per_user_summary']['Returns'][number];
export type EventRow = Database['public']['Tables']['analytics_events']['Row'];
```
**Phase 3 use:** Same idiom — one type alias per Phase 3 RPC pulled from the regenerated `Database['public']['Functions']`.

---

### `supabase/migrations/<ts>_phase_3_activity_rpcs.sql` (migration)

**Analog:** `supabase/migrations/20260429120000_create_extension_rpcs.sql`

**Header invariant block (lines 1-17):**
```sql
-- Phase 2 / EXT-01..10 — Aggregation RPCs for /extension.
-- INVARIANTS (NEVER drop these; the static grep verifier in
-- scripts/verify-extension-app-source-scope.mjs enforces them):
--   D-01: every scoped CTE filters `app_source = 'tpc-extension'`
--   D-02: 5-event vocabulary excludes `catalog_item`
--   D-03: error signal is `error_message IS NOT NULL`
--   D-13: bucketing uses 3-arg `date_trunc('day'|'hour', x, 'America/New_York')`
--   Pitfall 2: empty array filter idiom `(cardinality(p_users) = 0 OR x = any(p_users))`
--   Pitfall 9: every function has explicit `grant execute ... to authenticated`
--
-- All 6 functions are `language sql stable security invoker` so the existing
-- `analytics_admin_select` RLS policy (Phase 1 INFR-05) gates row visibility
-- via the calling JWT's role context. anon and non-admin authenticated users
-- get zero rows; admins see the full extension-scoped event stream.
--
-- D-22: this migration does NOT alter `public.analytics_events`. Schema shape
-- is owned by the extension repo. Do not add columns or policies here.
```
**Phase 3 swap:**
- Phase 3 has TWO invariant classes: TPC-App-table reads (no `app_source` filter — those tables don't have one; verifier asserts no INSERT/UPDATE/DELETE), and `ui_interactions` reads (which DO require `app_source = 'tpc-app'` per D-33).
- Stuck threshold: `interval '2 hours'` is a hard-coded literal (D-24); verifier asserts presence inside `get_stuck_items` body.
- Phase 3 does NOT alter any TPC App table — same "owner repo writes the schema" discipline as D-22.

**Range-driven RPC body (lines 25-86):**
```sql
create or replace function public.get_event_volume_daily(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[],
  p_bucket   text     default 'day'
) returns table (
  bucket_start timestamptz,
  event_type   text,
  event_count  bigint
)
language sql
stable
security invoker
as $$
  with bucket_unit as (
    select case when p_bucket = 'hour' then 'hour' else 'day' end as unit,
           case when p_bucket = 'hour' then interval '1 hour' else interval '1 day' end as step
  ),
  buckets as (
    select generate_series(
      date_trunc((select unit from bucket_unit), p_from, 'America/New_York'),
      date_trunc((select unit from bucket_unit), p_to,   'America/New_York'),
      (select step from bucket_unit)
    )::timestamptz as bucket_start
  ),
  ...
  scoped as (
    select
      date_trunc((select unit from bucket_unit), created_at, 'America/New_York') as bucket_start,
      event_type
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in ( ... )
      and created_at >= date_trunc((select unit from bucket_unit), p_from, 'America/New_York')
      and created_at <  date_trunc((select unit from bucket_unit), p_to,   'America/New_York') + (select step from bucket_unit)
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select
    b.bucket_start,
    t.event_type,
    coalesce(count(s.*), 0)::bigint as event_count
  from buckets b
  cross join types t
  left join scoped s
    on s.bucket_start = b.bucket_start and s.event_type = t.event_type
  group by b.bucket_start, t.event_type
  order by b.bucket_start, t.event_type;
$$;

grant execute on function public.get_event_volume_daily(
  timestamptz, timestamptz, text[], text[], text
) to authenticated;
```
**Phase 3 swap:** Replace `public.analytics_events` → `public.items` (joined to `public.sessions` via `sessions.id = items.session_id` for mode filter, and `public.profiles` via `sessions.assigned_to = profiles.id` for specialist filter). Replace `(p_users text[], p_versions text[], p_bucket text)` → `(p_specialists text[], p_mode text)`. Apply specialist filter on `profiles.email = any(p_specialists)` (Pitfall 5: URL param is email, server-side join is UUID — resolve via `profiles.email`). Apply mode filter on `sessions.mode = p_mode` when `p_mode <> 'all'` (D-20: never `items.mode`).

**Right-now RPC pattern (D-30):** Drop `p_from`/`p_to` entirely (e.g., `get_today_activity`, `get_active_sessions`, `get_stuck_items`, `get_walkthrough_funnel`). Use `now() AT TIME ZONE 'America/New_York'`-relative bounds inside the body for "today" anchoring per D-14.

**Cancellation rate / paired-row idiom (lines 414-432) — applicable to House-vs-Sale split:**
```sql
  -- Both target event types appear in output even when one period has zero rows.
  types(event_type) as (values ('catalog_batch'), ('portal_upload'))
  select
    t.event_type,
    coalesce(c.cancelled_count, 0)::bigint as cancelled_count,
    ...
  from types t
  left join cur  c on c.event_type = t.event_type
  left join prev p on p.event_type = t.event_type
  order by t.event_type;
```
**Phase 3 use:** `get_house_sale_split` returns 2 rows (`'house'`, `'sale'`) via VALUES + LEFT JOIN so the UI 2-tile slot stays stable when one mode has zero items in range.

---

### `src/pages/Activity.tsx` (page, request-response)

**Analog:** `src/pages/Extension.tsx`

**Header + filter row pattern (lines 32-49):**
```tsx
function PageHeader() {
  return (
    <header className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Extension Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Cataloger Chrome extension activity
        </p>
      </div>
      <div className="flex items-center gap-3">
        <DateRangeFilter />
        <UserMultiSelect />
      </div>
    </header>
  );
}
```
**Phase 3 swap:** Title → "Team Activity", subtitle → per UI-SPEC § Copywriting. Filter row gets THREE controls: `<DateRangeFilter />`, `<SpecialistMultiSelect />`, `<ModeToggle />`. Note Phase 3 DOES NOT use `useExtensionGate` — there's no full-page empty state per D-37; ship the section composition directly.

**Section composition pattern (lines 102-180):**
```tsx
return (
  <>
    <PageHeader />

    {/* EXT-01 — stacked bar: events by type/day */}
    <section
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid="ext-01-card"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Event volume</h2>
        <span className="text-sm text-gray-500">Last 14 days</span>
      </div>
      <div className="h-72">
        <EventVolumeChart />
      </div>
    </section>

    ...

    {/* EXT-04 + EXT-05 — side-by-side at xl, stacked below */}
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
      ...
    </section>

    ...

    {/* DeveloperPanel — self-gates by isDevAccount; null for non-devs (D-15) */}
    <DeveloperPanel />
  </>
);
```
**Phase 3 use:** Section order locked by D-01 → Today KPI strip → Active Sessions → Stuck Items alert → 14-day chart → AI donut + House-vs-Sale paired → Export Pipeline → DeveloperPanel. Each `data-testid` follows pattern `app-<requirement-id>-card`.

---

### `src/pages/SessionDetail.tsx` (page, request-response)

**Analog:** `src/pages/Extension.tsx` (page shell only — there is no detail-route precedent in the repo)

**Page shell pattern (loading + error + content branch):** copy lines 51-99 from Extension.tsx (the gate branches). Phase 3 SessionDetail uses the same `useEffect` document-title swap, `aria-busy="true"` loading branch, and per-card error handling — but shape its own loading/error UX since there's no gate hook here.

**Read-first additions Phase 3 needs (no analog):**
- `BackLink` consumption: `<BackLink to={`/activity?${parentSearch}`}>Back to Activity</BackLink>` — preserves filter state (D-03) by reading `useLocation().search` from outer page state at navigation time.
- TPC App photos bucket signed URLs use `useSignedPhotoUrl` (new hook) — admin client never imported into `src/`.

---

### `src/pages/StuckItems.tsx` (page, request-response)

**Analog:** `src/pages/Extension.tsx` (page shell). Same Phase-2 page-shell idiom but without the `useExtensionGate` branch. Owns `<BackLink>` + `<StuckItemsTable>`. URL params are independent (D-23); does NOT inherit specialist+mode from `/activity`.

---

### `src/components/activity/TodayKpiStrip.tsx` (component, request-response)

**Analog:** `src/components/extension/KpiStrip.tsx`

**Imports + delta computation (lines 1-49):**
```tsx
import { KpiCard, type KpiDelta } from '../kit/KpiCard';
import { Sparkline } from '../kit/Sparkline';
import { useKpiTotals } from '../../hooks/extension/useKpiTotals';
import { ErrorState } from '../ErrorState';
import { formatCount, EMPTY } from '../../lib/format';
import type { KpiRow } from '../../services/extension/queries';

const EVENT_TYPE_ORDER = [
  'catalog_single',
  'catalog_batch',
  'portal_upload',
  'spreadsheet_transform',
  'data_import',
] as const;

function computeDelta(current: number, previous: number): KpiDelta {
  if (current === previous) {
    return { value: '0', direction: 'flat', label: 'vs prev period' };
  }
  if (previous === 0) {
    return {
      value: current > 0 ? `+${current}` : `${current}`,
      direction: current > 0 ? 'up' : 'down',
      label: 'vs prev period',
    };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  return {
    value: `${pct >= 0 ? '+' : ''}${pct}%`,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
    label: 'vs prev period',
  };
}
```
**Phase 3 swap:** 4 KPIs (sessions / items / exports / % AI-done) instead of 5 event types. `computeDelta` reused verbatim. Per UI-SPEC: NO sparklines on Today strip (the planner default). Label reads "today vs yesterday" per D-14. KpiCard error branch lifted into its own `<div className="col-span-full">` wrapper (lines 60-69 idiom).

---

### `src/components/activity/ActiveSessionsTable.tsx` (component, request-response)

**Analog:** `src/components/extension/PerUserTable.tsx`

**TanStack Table v8 setup (lines 104-198):**
```tsx
export function PerUserTable() {
  const query = usePerUserSummary();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'last_seen_at', desc: true },
  ]);

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (query.isLoading) {
    return (
      <table className="w-full text-sm">
        <TableSkeleton rows={5} columnWidths={COLUMN_WIDTHS} />
      </table>
    );
  }

  if (query.error) {
    return (
      <ErrorState
        heading="Couldn't load per-user data"
        body="Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  if ((query.data ?? []).length === 0) {
    return (
      <EmptyState heading="No users in this range">
        Try widening the date range or clearing the user filter.
      </EmptyState>
    );
  }

  return (
    <table className="w-full text-sm" data-testid="per-user-table">
      <thead className="border-b border-gray-200 bg-gray-50 text-left">
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="h-11">
            {hg.headers.map((h, idx) => {
              const sorted = h.column.getIsSorted() as 'asc' | 'desc' | false;
              return (
                <th
                  key={h.id}
                  scope="col"
                  className={`px-4 cursor-pointer text-sm font-semibold text-gray-700 select-none ${
                    isNumericColumn(idx) ? 'text-right' : ''
                  }`}
                  aria-sort={
                    sorted === 'asc' ? 'ascending'
                      : sorted === 'desc' ? 'descending' : 'none'
                  }
                  onClick={h.column.getToggleSortingHandler()}
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    <SortIndicator state={sorted ?? false} />
                  </span>
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((r) => (
          <tr key={r.id} className="h-11 border-b border-gray-100 hover:bg-gray-50">
            {r.getVisibleCells().map((c, idx) => (
              <td key={c.id} className={`px-4 ${isNumericColumn(idx) ? 'text-right' : ''}`}>
                {flexRender(c.column.columnDef.cell, c.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```
**Phase 3 swap:** Default sort `{ id: 'age', desc: true }` (oldest first per Claude's Discretion). Columns: name, mode, age, specialist (display_name from join). `EmptyState` heading: "No active sessions". This same skeleton is the analog for `StuckItemsTable`, `UiTopPagesTable`, `UiTopElementsTable`.

**Per-row clickable navigation (StuckItemsTable extension):** wrap `<tr>` content in a button or attach `onClick={() => navigate(`/activity/sessions/${row.original.session_id}`)}` — keep keyboard support via `tabIndex={0}` and `onKeyDown` Enter handler.

---

### `src/components/activity/ItemsPerSpecialistChart.tsx` (component, request-response)

**Analog:** `src/components/extension/EventVolumeChart.tsx`

**Pivot helper + Recharts container (lines 22-131):**
```tsx
const EVENT_TYPE_ORDER = [
  'catalog_single', 'catalog_batch', 'portal_upload',
  'spreadsheet_transform', 'data_import',
] as const;
type EventTypeLiteral = (typeof EVENT_TYPE_ORDER)[number];

const EVENT_COLORS: Record<EventTypeLiteral, string> = {
  catalog_single: '#64748b',
  catalog_batch: '#0284c7',
  portal_upload: '#0d9488',
  spreadsheet_transform: '#d97706',
  data_import: '#7c3aed',
};

const ET = 'America/New_York';

function pivotForRecharts(rows: VolumeRow[]): WideRow[] {
  const byBucket = new Map<string, WideRow>();
  for (const r of rows) {
    if (!EVENT_TYPE_ORDER.includes(r.event_type as EventTypeLiteral)) continue;
    const wide = byBucket.get(r.bucket_start) ?? { bucket: r.bucket_start };
    (wide as unknown as Record<string, unknown>)[r.event_type] = Number(r.event_count);
    byBucket.set(r.bucket_start, wide);
  }
  return [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

return (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={wide} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="bucket" tickFormatter={tickFormatter} />
      <YAxis />
      <Tooltip />
      <Legend />
      {EVENT_TYPE_ORDER.map((t) => (
        <Bar
          key={t}
          dataKey={t}
          stackId="events"
          fill={EVENT_COLORS[t]}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  </ResponsiveContainer>
);
```
**Phase 3 swap:**
- 14-day fixed-window per D-16 — never reads `useDateRange` (Specifics: "the 14-day stacked bar (APP-03) is fixed-window. Don't let the date range filter reach into it").
- Series = dynamic per-specialist (not 5 fixed event types). Use `colorForSpecialist(email)` from `src/lib/chartPalette.ts` rather than a static map. Pivot key = `specialist_email`, stack id = `'items'`.
- `tickFormatter` always uses daily form `'M/d'` (no hourly branch).
- Locked Recharts invariants from Phase 1 carry over: `isAnimationActive={false}`, `<CartesianGrid strokeDasharray="3 3" />`.

---

### `src/components/activity/AiStatusDonut.tsx` (component, request-response)

**Analog:** `src/components/extension/ErrorRateChart.tsx` (Recharts container chrome only — Pie shape is new)

**Container chrome + loading/error/empty branches (lines 76-110):**
```tsx
if (query.isLoading) {
  return (
    <div className="h-full w-full animate-pulse rounded bg-gray-100"
         data-testid="error-rate-skeleton" aria-busy="true" />
  );
}
if (query.error) {
  return (
    <ErrorState heading="Couldn't load error rates"
                body="Something went wrong. Retry below."
                onRetry={() => void query.refetch()} />
  );
}
const data = rowsForChart(query.data);
if (data.length === 0) {
  return (
    <div className="flex h-full items-center justify-center" data-testid="error-rate-empty">
      <EmptyState heading="No events in this range"><></></EmptyState>
    </div>
  );
}
return (
  <ResponsiveContainer width="100%" height="100%">
    ...
  </ResponsiveContainer>
);
```

**Pulled-out failed slice (RESEARCH § Code Examples lines 905-933 — already vetted):**
```tsx
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AI_STATUS_COLOR } from '../../lib/chartPalette';

const ORDER = ['pending', 'processing', 'queued', 'done', 'failed'] as const;

return (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie data={slices} dataKey="value" innerRadius="60%" outerRadius="80%" paddingAngle={2}>
        {slices.map((slice) => (
          <Cell
            key={slice.name}
            fill={AI_STATUS_COLOR[slice.name]}
            outerRadius={slice.name === 'failed' ? '85%' : '80%'}
          />
        ))}
      </Pie>
    </PieChart>
  </ResponsiveContainer>
);
```

---

### `src/components/activity/ExportPipelineChart.tsx` (component, request-response)

**Analog:** `src/components/extension/ErrorRateChart.tsx` (horizontal-bar idiom)

**Horizontal stacked bar via `layout="vertical"` (lines 111-130):**
```tsx
return (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart layout="vertical" data={data}
              margin={{ top: 8, right: 48, bottom: 8, left: 16 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis type="number" tickFormatter={(v: number) => `${v}%`} domain={[0, 'dataMax']} />
      <YAxis type="category" dataKey="event_type" width={140} />
      <Tooltip formatter={(v) => formatPercent(Number(v))} />
      <Bar dataKey="rate_pct" fill={BAR_FILL} isAnimationActive={false}>
        ...
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
```
**Phase 3 use:** `<XAxis type="number">`, `<YAxis type="category" dataKey="status">`. Stack with multiple `<Bar stackId="pipeline" dataKey={...}>` entries colored from `SESSION_STATUS_COLOR` (`active`, `submitted`, `returned`, `exported`, `completed`).

---

### `src/components/activity/UiRecentEventsFeed.tsx` (component, event-driven)

**Analog:** `src/components/extension/LiveEventFeed.tsx`

**Live-feed shell + Pause/Resume contract (lines 116-241):**
```tsx
export function LiveEventFeed() {
  const { data, isLoading, error, refetch, paused, pause, resume } = useLiveFeed();
  const email = useAuthStore((s) => (s as { profile: { email?: string } | null }).profile?.email);
  const isDev = isDevAccount(email);
  const [modal, setModal] = useState<ModalState>({ open: false, title: 'Payload', payload: null });

  const rows = data ?? [];
  const subtitle = paused
    ? `Paused · ${rows.length} events shown at pause time`
    : 'Tailing latest 50 events · refreshes every 10s';

  function handleRowClick(row: EventRow) {
    if (!isDev) return;  // D-18 admin no-op
    setModal({
      open: true,
      title: `${row.event_type} payload — ${row.user_email ?? 'unknown'}`,
      payload: row.items_content,
    });
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white" data-testid="live-event-feed">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 h-12">
        <div className="flex items-center gap-2">
          <span aria-hidden="true"
                className={paused
                  ? 'h-2 w-2 rounded-full bg-gray-400'
                  : 'h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse'} />
          <span className="sr-only">{paused ? 'Paused' : 'Live'}</span>
          <h2 className="text-sm font-semibold text-gray-700">Live feed</h2>
          ...
        </div>
        <PauseButton paused={paused} onPause={pause} onResume={resume} />
      </header>
      <div className="max-h-[28rem] overflow-y-auto">
        ... loading / error / empty / rows branches ...
      </div>
      <PayloadViewerModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.title}
        payload={modal.payload}
      />
    </section>
  );
}
```
**Phase 3 swap:** Component is dev-only; the parent `<UiInteractionsPanel>` is mounted only inside Phase 3's `<DeveloperPanel>`. Row click ALWAYS opens PayloadViewerModal (no admin/dev split — non-dev users never see this component at all). Subtitle reads "Tailing latest 50 ui_interactions · refreshes every 10s". Row badge palette uses `interaction_type` colors from `chartPalette.ts`.

---

### `src/components/activity/DeveloperPanel.tsx` (component)

**Analog:** `src/components/extension/DeveloperPanel.tsx` (verbatim chrome — distinct file because content differs)

**Render-conditional gate + chevron + body (lines 46-99):**
```tsx
export function DeveloperPanel() {
  const email = useAuthStore((s) => (s as { profile: { email: string | null } | null }).profile?.email ?? null);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isDevAccount(email)) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white mt-8"
             data-testid="developer-panel">
      <button
        type="button"
        onClick={() => setIsExpanded((e) => !e)}
        aria-expanded={isExpanded}
        aria-controls={PANEL_BODY_ID}
        aria-label={isExpanded ? 'Collapse developer panel' : 'Expand developer panel'}
        className="w-full flex items-center justify-between px-4 h-12 hover:bg-gray-50 focus:ring-2 focus:ring-accent rounded-lg outline-none"
      >
        <div className="flex items-center gap-2">
          <Chevron rotated={isExpanded} />
          <span className="text-sm font-semibold text-gray-700">Developer panel</span>
          <span className="text-xs text-gray-500">Diagnostics for {email}</span>
        </div>
        <DominantVersionBadge />
      </button>
      {isExpanded && (
        <div id={PANEL_BODY_ID} className="border-t border-gray-200 p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Extension version</h3>
            <ExtensionVersionFilter />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Cancellation rates</h3>
            <CancellationRateKpis />
          </div>
        </div>
      )}
    </section>
  );
}
```
**Phase 3 swap:** Replace right-side badge (no DominantVersionBadge analog needed). Body sub-panels: `<FailedAiBreakdown />` then `<UiInteractionsPanel />` (which itself wraps the four `ui_interactions` sub-sub-panels). Header copy: "Diagnostics for {email}". File lives at `src/components/activity/DeveloperPanel.tsx` — distinct from `src/components/extension/DeveloperPanel.tsx` per UI-SPEC component inventory.

---

### `src/components/activity/RawItemInspector.tsx` (component, dev-only)

**Analog:** `src/components/extension/RecentErrorsTable.tsx` (PayloadViewerModal trigger pattern, lines 105-130)

**Dev-gated PayloadViewerModal trigger:**
```tsx
{
  id: 'payload',
  header: 'Payload',
  enableSorting: false,
  cell: (info) => {
    if (!isDev) return null;
    const row = info.row.original;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setModal({
            open: true,
            title: `${row.event_type} payload — ${row.user_email ?? 'unknown'}`,
            payload: row.items_content,
          });
        }}
        aria-haspopup="dialog"
        className="text-sm text-gray-700 hover:text-accent focus:ring-2 focus:ring-accent rounded outline-none"
      >
        View →
      </button>
    );
  },
},
```
**Phase 3 use:** Mount the `<PayloadViewerModal>` once inside `<RawItemInspector>` — opened by an inline JSON-dump-and-View button. Modal title pattern: `"Item payload — ${item.receipt_number ?? item.id}"`. Component is dev-only; it isn't conditionally gated internally — the caller (`SessionItemDisclosure`) renders it inside an `isDev && (...)` branch.

---

### `src/components/SpecialistMultiSelect.tsx` (component, top-level shared)

**Analog:** `src/components/UserMultiSelect.tsx`

**Popover open/close + outside-click + Escape (lines 36-65):**
```tsx
const [open, setOpen] = useState(false);
const popoverRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!open) return;
  function handleDocClick(e: MouseEvent) {
    if (!popoverRef.current) return;
    if (!popoverRef.current.contains(e.target as Node)) setOpen(false);
  }
  function handleEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
  }
  document.addEventListener('mousedown', handleDocClick);
  document.addEventListener('keydown', handleEsc);
  return () => {
    document.removeEventListener('mousedown', handleDocClick);
    document.removeEventListener('keydown', handleEsc);
  };
}, [open]);

const triggerLabel =
  selected.length === 0
    ? 'All users'
    : `${selected.length} ${selected.length === 1 ? 'user' : 'users'}`;

function toggle(email: string) {
  if (selected.includes(email)) setUsers(selected.filter((e) => e !== email));
  else setUsers([...selected, email]);
}
```
**Phase 3 swap:**
- Reads from `useSpecialistFilter` instead of `useUserFilter`.
- Option list source: `useActiveSpecialists()` (queries `profiles WHERE is_active = true AND role = 'specialist'`) instead of folding from per-user-summary cache.
- Display: `display_name` from profile, NOT the email (D-19). Filter param value remains the email (Pitfall 5: URL stays email; server resolves to UUID).
- Trigger label: `'All specialists'` or `'N specialists'`.

---

### `src/components/ModeToggle.tsx` (component, URL state)

**Analog:** `src/components/kit/DateRangeFilter.tsx` (preset row segmented buttons — same visual idiom)

The `DateRangeFilter` segmented preset row is the analog. New file: 3-button segmented control (`All` | `House` | `Sale`) writing `?mode=` via `useModeFilter`. Reuse Tailwind classes `h-8 px-3 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-accent outline-none` for visual consistency.

---

### `src/hooks/useSpecialistFilter.ts` + `src/hooks/useModeFilter.ts`

**Analog:** `src/hooks/extension/useUserFilter.ts`

Already authored verbatim in `03-RESEARCH.md` lines 766-833 (Code Examples). Planner pastes those snippets into the plan's read-first.

**`useUserFilter.ts` lines 14-43 verbatim — single-closure URL write idiom (Pitfall 5):**
```ts
export function useUserFilter(): UserFilterValue {
  const [params, setParams] = useSearchParams();

  const raw = params.get('users');
  const users = raw ? raw.split(',').filter((v) => v.length > 0) : [];

  const setUsers = useCallback(
    (next: string[]) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next.length === 0) copy.delete('users');
          else copy.set('users', next.join(','));
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { users, setUsers };
}
```

---

### `src/hooks/useSignedPhotoUrl.ts` (NEW load-bearing — no exact analog)

**Closest analog:** `src/hooks/extension/useLiveFeed.ts` (only QueryClient-default override precedent in the repo).

**`useLiveFeed.ts` shows the override pattern (lines 1-32):**
```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { fetchLiveFeed } from '../../services/extension/queries';

const FEED_KEY = ['extension', 'liveFeed'] as const;

export function useLiveFeed() {
  const [paused, setPaused] = useState(false);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => fetchLiveFeed({ limit: 50 }),
    refetchInterval: () => (paused ? false : 10_000),
    staleTime: 0,  // each refetch returns fresh rows
  });

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setPaused(false);
    void qc.invalidateQueries({ queryKey: FEED_KEY });
  }, [qc]);

  return { ...query, paused, pause, resume };
}
```

**Phase 3 hook implementation (vetted in RESEARCH § Code Examples lines 717-762):**
```ts
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
**Test invariant:** synthesize `visibilitychange` event; assert query refetches when `staleTime` elapsed. (RESEARCH § Pitfall 4 + Specifics: "Photo signed-URL refetch-on-focus is the only piece that doesn't have a Phase 2 precedent. Worth a small Vitest behavior test that fires a synthetic visibilitychange event").

---

### `src/hooks/activity/useEventVolume`-shaped hooks (most Phase 3 hooks)

**Analog:** `src/hooks/extension/useEventVolume.ts`

**Sorted-array queryKey pattern (lines 12-36):**
```ts
export function useEventVolume() {
  const { from, to, range } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const bucket: 'day' | 'hour' = range === 'today' ? 'hour' : 'day';
  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'eventVolume',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
        bucket,
      },
    ],
    queryFn: () => fetchEventVolume({ from, to, users, versions, bucket }),
    // staleTime/retry/refetchOnWindowFocus inherited from QueryClientProvider (src/main.tsx)
  });
}
```
**Phase 3 swap:**
- queryKey root: `'activity'` instead of `'extension'`.
- `users → specialists`, `versions` → drop, add `mode`.
- Key sorting (Pitfall 3): `[...specialists].sort()` so `?specialists=a,b` and `?specialists=b,a` hit the same cache.
- Range-driven hooks (APP-04 / 05 / 12 / 29 / Top Pages / Top Elements) take from + to from `useDateRange`.
- Right-now hooks (APP-01 / 02 / 11 / Walkthrough Funnel) drop `from`/`to` entirely. queryKey: `['activity', 'todayKpis', { specialists, mode }]`.
- Fixed-window hook (APP-03 14d) computes its own bounds — does NOT consume `useDateRange`.

---

### `src/hooks/activity/useUiRecentEventsFeed.ts` (live tail)

**Analog:** `src/hooks/extension/useLiveFeed.ts` (verbatim — see excerpt above).

**Phase 3 swap:** queryKey `['activity', 'uiRecentEvents']`. Underlying fetch hits `ui_interactions` with `.eq('app_source', 'tpc-app')` per D-33.

---

### `src/lib/severity.ts` (NEW utility — closest analog: `src/lib/devAccess.ts`)

**`devAccess.ts` constants-and-helper shape (lines 1-13):**
```ts
// src/lib/devAccess.ts
// D-16: email allowlist gating the <DeveloperPanel>. Allowlist ships in the
// production bundle — emails are not secrets per RFC 5321.

export const DEV_EMAILS: ReadonlyArray<string> = [
  'josh@potomackco.com',
];

export function isDevAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEV_EMAILS.includes(email.toLowerCase());
}
```
**Phase 3 use:** Same idiom — exported constants (`STUCK_ITEMS_THRESHOLDS`, `STUCK_ITEMS_TONE`) plus a pure classifier function `classifyStuckSeverity(count: number, oldestAgeHours: number): 'success' | 'yellow' | 'red'`. Default thresholds per Claude's Discretion: N≥5 → yellow, oldest>6h → red, else success.

---

### `src/lib/chartPalette.ts` (NEW utility — closest analog: inline color maps in extension components)

**Inline pattern from `EventVolumeChart.tsx` lines 33-39:**
```ts
const EVENT_COLORS: Record<EventTypeLiteral, string> = {
  catalog_single: '#64748b',
  catalog_batch: '#0284c7',
  portal_upload: '#0d9488',
  spreadsheet_transform: '#d97706',
  data_import: '#7c3aed',
};
```
**Phase 3 extracts this idiom to a shared module:**
- `AI_STATUS_COLOR: Record<AiStatus, string>` — pending=gray, processing=blue, queued=amber, done=green, failed=red (per Claude's Discretion).
- `SESSION_STATUS_COLOR: Record<SessionStatus, string>` — active, submitted, returned, exported, completed.
- `SESSION_MODE_COLOR: Record<SessionMode, string>` — house, sale.
- `SPECIALIST_COLOR_CYCLE: ReadonlyArray<string>` — 8-color cycle for dynamic per-specialist series.
- `colorForSpecialist(email: string): string` — deterministic hash-mod-cycle assignment so a specialist's color is stable across renders.
**Test invariant (UI-SPEC Chart-palette test invariant):** snapshot test confirms palette keys are exhaustive of the runtime status enum.

---

### `src/lib/format.ts` (extension — add `formatAge`)

**Analog:** existing module — extend in place. Reuse the existing `formatTimestampShort`, `formatPercent`, `formatCount`, `EMPTY` exports.

`formatAge(createdAt: string | Date): string` returns `"14h"`, `"23m"`, `"3d"` for use in Active Sessions age column and Stuck Items alert card.

---

### `scripts/verify-activity-*.mjs` (6 prebuild verifiers)

**Analog:** `scripts/verify-extension-app-source-scope.mjs`

**Module shape (lines 1-60):**
```js
#!/usr/bin/env node
// scripts/verify-extension-app-source-scope.mjs
// Phase 2 / EXT-01..10 — static SQL grep verifier.
// Validates the extension RPC migration against the D-01 / D-02 / D-13
// invariants documented in .planning/phases/02-extension-analytics-extension/.
// Runs WITHOUT a database connection.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-extension-app-source-scope]';
const MIGRATION_PATH = 'supabase/migrations/20260429120000_create_extension_rpcs.sql';

const RPC_NAMES = [
  'get_event_volume_daily',
  'get_kpi_totals',
  'get_error_rate_by_type',
  'get_per_user_summary',
  'get_dominant_version',
  'get_cancellation_rates',
];

if (!existsSync(MIGRATION_PATH)) {
  console.error(`${TAG} Migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const raw = readFileSync(MIGRATION_PATH, 'utf8');

// Strip line comments before counting invariant occurrences. Without this, the
// header invariant block at the top of the migration would inflate every
// count and mask a missing real-code occurrence.
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const failures = [];

// Check 1 — function presence
for (const name of RPC_NAMES) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i');
  if (!re.test(stripped)) {
    failures.push(`Missing function declaration: ${name}`);
  }
}
```

**Comment-stripping idiom (Pattern lines 43-46):**
```js
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');
```
**This is the canonical verifier pattern — every Phase 3 SQL grep verifier must strip comments before counting invariants.**

**Phase 3 verifier matrix (each follows the same shape):**

| Script | Asserts |
|--------|---------|
| `verify-activity-app-source-scope.mjs` | Every reference to `ui_interactions` in the migration body OR in `src/services/activity/queries.ts` is paired with `app_source = 'tpc-app'` (D-33). Mirror Check 2 from Phase 2 verifier (≥N occurrences). |
| `verify-activity-rpc-shape.mjs` | All ~13 Phase 3 RPC names declared with `create or replace function public.<name>`; each has `language sql stable security invoker` and `grant execute ... to authenticated`. |
| `verify-activity-table-readonly.mjs` | The migration body MUST NOT contain `INSERT INTO public.{profiles,sessions,items,photos,export_history,ui_interactions}`, `UPDATE public.<tpc_app_table>`, `DELETE FROM public.<tpc_app_table>`, `ALTER TABLE public.<tpc_app_table>` (RESEARCH § Anti-Patterns + the boundary spec from CONTEXT § Phase Boundary). |
| `verify-activity-stuck-threshold-hardcoded.mjs` | `get_stuck_items` body contains literal `interval '2 hours'` AND no `p_threshold` parameter (D-24). |
| `verify-activity-photos-ttl.mjs` | `src/hooks/useSignedPhotoUrl.ts` contains literal `createSignedUrl(path, 3600)` AND `refetchOnWindowFocus: true` AND `staleTime: 50 * 60 * 1000` (D-11). |
| `verify-activity-mode-filter-on-sessions.mjs` | Migration body never references `items.mode = p_mode` or `items.mode = any(`; mode filter ALWAYS applies via `sessions.mode` (D-20 invariant; RESEARCH § Specifics "Mode filter on items lives at sessions.mode"). |

Wire each into `package.json` `prebuild` after the existing extension scope verifier.

---

## Shared Patterns

### 1. Loading / Error / Empty per-card UX (D-35)

**Source:** Every `src/components/extension/*.tsx` component.
**Apply to:** Every Phase 3 card-bound component (charts, tables, KPI strips).

**Per-card branches in standard order:**
```tsx
if (query.isLoading) {
  // For chart: animate-pulse rounded bg-gray-100 (skeleton block)
  // For table: <table><TableSkeleton rows={5} columnWidths={...} /></table>
  return ...;
}

if (query.error) {
  // LOCKED Phase 1 ErrorState contract: heading + body string + onRetry.
  // No children syntax, no sibling Retry button.
  return (
    <ErrorState
      heading="Couldn't load <thing>"
      body="Retry below."
      onRetry={() => void query.refetch()}
    />
  );
}

if ((query.data ?? []).length === 0) {
  return <EmptyState heading="No <things> in this range">...</EmptyState>;
}

return <ActualContent ... />;
```
**Locked invariants (referenced from `src/components/ErrorState.tsx`):**
- ErrorState props: `{ heading: string, body: string, onRetry: () => void }` — body is a STRING, not children. Never wrap with a sibling `<button>Retry</button>` — the component renders one internally.
- EmptyState accepts children: `<EmptyState heading="No X"><p>...</p></EmptyState>`.
- TableSkeleton renders `<tbody>` only; wrap in `<table>` to keep DOM valid.

### 2. Render-conditional dev gate (D-26 / D-28)

**Source:** `src/components/extension/DeveloperPanel.tsx:46-50`, `src/components/extension/RecentErrorsTable.tsx:108-110`, `src/components/extension/LiveEventFeed.tsx:118-119, 211-213`.
**Apply to:** Every Phase 3 dev-only component, dev-only column, dev-only inline content.

```tsx
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';

const email = useAuthStore((s) => s.profile?.email);
const isDev = isDevAccount(email);

if (!isDev) return null;          // for whole components
{isDev ? <DevOnly /> : null}      // for inline content
```
**Invariant:** NEVER use `display: hidden`, `className="hidden"`, or `aria-hidden` to hide dev affordances — the component must be absent from the DOM (per CONTEXT D-28 + Phase 2 D-15). Verifier could be added if drift becomes a risk; currently enforced by code review.

### 3. Sorted-array TanStack Query keys (RESEARCH Pitfall 3)

**Source:** Every hook in `src/hooks/extension/`.
**Apply to:** Every Phase 3 hook whose queryKey contains the specialists array.

```ts
const specialistsKey = [...specialists].sort();  // before placing in queryKey
return useQuery({
  queryKey: ['activity', '<chart>', { from, to, specialists: specialistsKey, mode }],
  queryFn: () => fetchX({ from, to, specialists, mode }),
});
```
**Why:** `?specialists=a@x,b@x` and `?specialists=b@x,a@x` should hit the same cache entry. The fetch arg keeps URL order (server idempotent on order); only the queryKey is sorted.

### 4. URL-driven filter hooks with single-closure write (Pitfall 5)

**Source:** `src/hooks/extension/useUserFilter.ts:25-40`.
**Apply to:** `useSpecialistFilter`, `useModeFilter`.

```ts
const setX = useCallback((next: ...) => {
  setParams((prev) => {
    const copy = new URLSearchParams(prev);
    if (/* default */) copy.delete('x');
    else copy.set('x', /* serialize */);
    return copy;
  }, { replace: false });
}, [setParams]);
```
**Why:** Single closure form ensures React Router 7 batches the update; multi-call form risks lost writes when filters change in rapid succession.

### 5. Pagewise document-title swap (Phase 1 carryover)

**Source:** `src/pages/Extension.tsx:30, 54-60`.
**Apply to:** All 3 Phase 3 pages.

```tsx
const PAGE_TITLE = 'Activity — TPC Dashboard';

useEffect(() => {
  const previous = document.title;
  document.title = PAGE_TITLE;
  return () => { document.title = previous; };
}, []);
```

### 6. Test file colocated `*.test.tsx` next to `*.tsx`

**Source:** `src/components/extension/*.test.tsx` (every component has a colocated test).
**Apply to:** Every new Phase 3 `*.tsx` / `*.ts` file in `src/components/activity/`, `src/hooks/activity/`, `src/pages/`, `src/lib/severity.ts`, `src/lib/chartPalette.ts`.

### 7. Recharts JSDom mock (Phase 1 + Phase 2 precedent)

**Source:** Phase 1 / 01-05 plan; reused by every chart test in `src/components/extension/*.test.tsx`.
**Apply to:** Tests for `ItemsPerSpecialistChart`, `AiStatusDonut`, `ExportPipelineChart`, `WalkthroughFunnel`.

The JSDom mock pattern is reusable as-is — extension chart tests already use it. (Per RESEARCH § Validation Architecture: "Recharts JSDom Mock — already in use, no extension needed.")

### 8. Server-side ET bucketing (D-13 carryover, D-30 explicit)

**Source:** `supabase/migrations/20260429120000_create_extension_rpcs.sql:46-47, 67-68`.
**Apply to:** Every Phase 3 RPC that buckets time (APP-01 today range, APP-03 14d daily, range-driven aggregates if any bucket).

```sql
date_trunc('day', x, 'America/New_York')   -- 3-arg form ONLY
-- never:
-- (x AT TIME ZONE 'America/New_York')::date
```
The verifier `scripts/verify-extension-app-source-scope.mjs:85-95` enforces this; Phase 3's verifier mirrors the check.

---

## No Analog Found

Files where the analog match is weakest — planner should lean on RESEARCH.md examples (which are already vetted) plus security/correctness invariants from CONTEXT decisions:

| File | Role | Reason |
|------|------|--------|
| `src/hooks/useSignedPhotoUrl.ts` | hook (per-photo URL) | First hook in the repo that calls `supabase.storage.createSignedUrl`. RESEARCH § Code Examples lines 717-762 has the verbatim implementation; treat as production-ready and copy. Test invariant per Specifics: synthetic `visibilitychange` event. |
| `src/components/activity/ThumbnailTile.tsx` | component (signed-URL consumer) | No prior consumer of `useSignedPhotoUrl`. Contract: 80×80 tile, consumes hook, three states (loading skeleton, success `<img>`, error chip with retry); separately, gates entirely on `upload_status === 'failed'` (does NOT call the hook — D-13). |
| `src/lib/chartPalette.ts` | utility (color constants) | Inline `EVENT_COLORS` maps in extension chart components (lines 33-39 of `EventVolumeChart.tsx`) are the only precedent — Phase 3 extracts this idiom to a shared module. Use UI-SPEC § Color committed palettes verbatim. |

---

## Metadata

**Analog search scope:**
- `src/pages/`, `src/components/`, `src/components/extension/`, `src/components/kit/`, `src/hooks/`, `src/hooks/extension/`, `src/services/extension/`, `src/lib/`, `src/layouts/`, `src/main.tsx`, `src/App.tsx`
- `supabase/migrations/`
- `scripts/`

**Files scanned:** 53 (full Phase 1 + Phase 2 deliverables — every `*.tsx`, `*.ts`, `*.mjs`, `*.sql` listed).

**Analog selection ranking applied (per system prompt):**
1. Same role + same data flow → exact (e.g., `EventVolumeChart` ↔ `ItemsPerSpecialistChart`).
2. Same role, different data flow → role-match (e.g., `ErrorRateChart` chrome ↔ `AiStatusDonut`).
3. Different role, same data flow → partial (n/a here).
4. Recency tie-breaker: Phase 2 deliverables (April 2026) preferred over Phase 1 deliverables when both are candidates.

**Pattern extraction date:** 2026-04-30
