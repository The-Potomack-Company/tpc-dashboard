# Architecture Research — v2.0 Live Ops

**Domain:** Live-ops analytics dashboard (read-heavy reporting + real-time auction floor view)
**Researched:** 2026-04-24
**Confidence:** HIGH (baseline patterns already established in v1.0 phase 1; live-ops extensions verified against current Supabase/TanStack Query docs)

---

## Executive Summary

The existing v1.0 phase 1 scaffolding (Vite + React 19 + TS + Tailwind 4 + TanStack Query + Zustand auth + admin-gated router) is the correct backbone for v2.0. Three things get added:

1. **Read-only "App Activity" and "Extension Analytics" surfaces** — pure TanStack Query over the existing anon-key `supabase` client, using a per-table `useXxxQuery` hook pattern. The `analytics_events` table needs a new admin-SELECT RLS policy (currently only anon-INSERT exists).
2. **A dashboard-owned "Live Sale" domain** — new Supabase tables + Realtime subscriptions wired into TanStack Query via `queryClient.invalidateQueries` (the safer default) with a narrow `setQueryData` fast-path for the "current lot" ticker where sub-second latency matters.
3. **A Playwright scraper running outside Vercel** — authenticates to Supabase with the `service_role` key, writes append-only lot events plus a compact "live sale status" row the frontend polls/subscribes for the "is a sale live right now" signal. Recommended host: **Fly.io** (cheaper at 24/7, proper browser-binary support, suspend/resume fits bursty auction-day cadence).

The frontend route structure collapses into **three top-level routes** — `/activity` (TPC App), `/extension` (Cataloger), `/live` (sale monitor) — gated by the existing `ProtectedRoute`. No tabbed single-page mega-dashboard: each domain has its own filters, its own refetch cadence, and the live view deserves its own full-bleed layout.

Phase ordering: **Extension analytics first** (smallest blast radius, validates the read-hook pattern against a table the dashboard doesn't own), **TPC App activity second** (same pattern, more tables, proves the cross-table join/aggregation story), **Live Sale last** (needs new tables, new scraper deploy, new realtime wiring, and requires a real auction to end-to-end test).

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Browser (React SPA)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                      │
│  │ /activity  │  │ /extension │  │ /live      │  (route-scoped pages) │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                      │
│        │ useXxxQuery   │ useXxxQuery   │ useLiveSaleFeed              │
│  ┌─────┴───────────────┴───────────────┴──────────────────┐          │
│  │          TanStack Query cache (module singleton)        │          │
│  └─────┬───────────────┬───────────────┬──────────────────┘          │
│        │ supabase.from │ supabase.from │ channel.on('postgres_changes')│
│  ┌─────┴───────────────┴───────────────┴──────────────────┐          │
│  │      supabase client (anon key, Proxy singleton)        │ ◄── authStore
│  └─────┬───────────────────────────────────────────────────┘          │
└────────┼──────────────────────────────────────────────────────────────┘
         │ HTTPS (PostgREST) + WSS (Realtime)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase (shared project)                          │
│  ┌──────────────────────┐   ┌──────────────────────────────────────┐ │
│  │ TPC App tables (R/O) │   │ Dashboard-owned tables (R/W)          │ │
│  │  profiles sessions   │   │  live_sales                           │ │
│  │  items photos        │   │  live_lot_events  (append-only)       │ │
│  │  export_history      │   │  live_lot_current (derived/upserted)  │ │
│  │                      │   │  scrape_runs                          │ │
│  │ Extension table (R/O)│   │                                        │ │
│  │  analytics_events    │   │ supabase_realtime publication includes │ │
│  └──────────────────────┘   │   live_lot_current + live_sales only   │ │
│                             └──────────────────────────────────────┘ │
└───────────────────────────────────────────▲──────────────────────────┘
                                            │ service_role INSERT/UPSERT
                                            │ (WSS for Supabase Auth
                                            │  session refresh N/A —
                                            │  scraper does NOT use Supabase Auth)
                                            │
┌───────────────────────────────────────────┴──────────────────────────┐
│                 Playwright scraper (Fly.io worker)                    │
│  - cron or "start-on-command" loop                                   │
│  - owns RFC login cookie jar                                         │
│  - polls RFC live page every 2–5 s                                   │
│  - writes lot events → Supabase (service_role JWT)                   │
│  - writes heartbeat to scrape_runs                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `src/lib/supabase.ts` | Anon-key singleton client for the browser | Proxy-lazy `createClient<Database>` — **already exists, no changes needed** |
| `src/stores/authStore.ts` | Session + profile + `isAdmin` flag | Zustand — **already exists, no changes needed** |
| `src/components/ProtectedRoute.tsx` | Gate admin routes | Wraps `<Outlet />`, reads authStore — **already exists** |
| `src/hooks/queries/*` **(NEW)** | Per-table read hooks wrapping TanStack Query + Supabase | One file per domain (see "Data-access layer" below) |
| `src/hooks/realtime/*` **(NEW)** | Realtime channel subscriptions, returning nothing — they invalidate queries as a side effect | `useLiveSaleChannel()` per-domain |
| `src/pages/activity/*` **(NEW)** | TPC App activity charts/tables | Composes read hooks + Recharts + TanStack Table |
| `src/pages/extension/*` **(NEW)** | Extension analytics charts/tables | Same pattern |
| `src/pages/live/*` **(NEW)** | Live sale monitor | Composes read hooks + realtime hook + ticker UI |
| `scraper/` **(NEW, top-level, not under src/)** | Playwright scraper deployable unit | Its own `package.json`, its own Dockerfile, deploys to Fly.io |
| Dashboard-owned Supabase tables **(NEW)** | Lot events, scrape run heartbeat, live-sale status | SQL migrations under `supabase/migrations/` |

---

## Recommended Project Structure

```
tpc-dashboard/
├── scraper/                           # NEW — separate deployable, own package.json
│   ├── package.json                   # Playwright + @supabase/supabase-js only
│   ├── Dockerfile                     # mcr.microsoft.com/playwright:v1.59.1
│   ├── fly.toml                       # Fly.io deploy config
│   ├── src/
│   │   ├── index.ts                   # Entry: parse args, run loop
│   │   ├── rfc/
│   │   │   ├── login.ts               # Session-cookie refresh
│   │   │   ├── poll.ts                # Scrape one tick of the live page
│   │   │   └── parse.ts               # HTML → LotEvent[]
│   │   ├── supabase/
│   │   │   ├── client.ts              # service_role client
│   │   │   └── write.ts               # upsert live_lot_current, append live_lot_events
│   │   └── runner.ts                  # Loop + heartbeat + graceful shutdown
│   └── README.md                      # How to run locally, how to deploy
├── src/                               # Dashboard SPA (existing structure preserved)
│   ├── lib/
│   │   └── supabase.ts                # EXISTING — anon client singleton
│   ├── stores/
│   │   └── authStore.ts               # EXISTING
│   ├── db/
│   │   └── database.types.ts          # EXISTING — regen after scraper migrations
│   ├── hooks/
│   │   ├── queries/                   # NEW — per-domain read hooks
│   │   │   ├── activity/
│   │   │   │   ├── useSessionVolume.ts
│   │   │   │   ├── useItemThroughput.ts
│   │   │   │   ├── useAiStatusHealth.ts
│   │   │   │   ├── useExportHistory.ts
│   │   │   │   └── usePhotoCoverage.ts
│   │   │   ├── extension/
│   │   │   │   ├── useEventVolume.ts
│   │   │   │   ├── useBatchPerformance.ts
│   │   │   │   └── useEventFeed.ts
│   │   │   └── live/
│   │   │       ├── useLiveSaleStatus.ts
│   │   │       ├── useCurrentLot.ts
│   │   │       └── useLotEventFeed.ts
│   │   ├── realtime/                  # NEW — realtime subscription hooks
│   │   │   ├── useLiveSaleChannel.ts
│   │   │   └── useExtensionEventChannel.ts
│   │   └── shared/                    # NEW — cross-cutting hooks
│   │       ├── useDateRange.ts        # URL-synced date filter
│   │       ├── useTimezone.ts         # Config + conversions
│   │       └── useRequireAdmin.ts     # Guard helper (ProtectedRoute already covers route-level)
│   ├── pages/
│   │   ├── Home.tsx                   # EXISTING
│   │   ├── Login.tsx                  # EXISTING
│   │   ├── activity/
│   │   │   ├── ActivityPage.tsx       # /activity shell
│   │   │   └── sections/              # SessionVolumeChart, ItemThroughputTable, etc.
│   │   ├── extension/
│   │   │   ├── ExtensionPage.tsx      # /extension shell
│   │   │   └── sections/              # EventVolumeChart, LiveEventFeed, etc.
│   │   └── live/
│   │       ├── LivePage.tsx           # /live shell (full-bleed)
│   │       └── sections/              # CurrentLotTicker, LotEventStream, ScraperStatusBadge
│   ├── layouts/
│   │   └── DashboardLayout.tsx        # EXISTING — NAV_ITEMS repopulated
│   ├── components/                    # EXISTING primitives (EmptyState, ErrorState, etc.)
│   └── App.tsx                        # EXISTING — add /activity /extension /live routes
└── supabase/
    └── migrations/
        ├── 20260425000000_create_live_sale_tables.sql    # NEW
        ├── 20260425000001_live_sale_rls.sql              # NEW
        ├── 20260425000002_live_sale_publication.sql      # NEW (add to supabase_realtime)
        └── 20260425000003_analytics_events_admin_select.sql # NEW (extension read policy)
```

### Structure Rationale

- **`scraper/` is a sibling of `src/`, not nested.** The scraper has zero browser runtime overlap with the React app. It has different dependencies (Playwright 500MB+), different deploy target (Fly.io Docker), different lifecycle (long-running). Nesting it under `src/` drags Playwright into Vite's module graph and the frontend bundle. Sibling packages keep the boundaries honest.
- **`src/hooks/queries/{domain}/useXxx.ts` — one hook per query.** Each file exports a single `useXxxQuery(filters)` function wrapping TanStack Query + the Supabase client. This scales better than a `services/` layer with big `SessionService` objects because TanStack Query's key-per-query model makes per-hook files the natural granularity. Matches the "Use Supabase with React Query" MakerKit pattern.
- **`src/hooks/realtime/` separate from `queries/`.** Realtime subscriptions don't return data to components — they invalidate or patch the query cache as a side effect. Keeping them out of `queries/` makes it obvious which hooks are the source of truth (queries) vs which are side-effect wiring (realtime).
- **Pages are split by domain, not by chart type.** `pages/activity/sections/SessionVolumeChart.tsx` is a leaf component used only by `ActivityPage`. Cross-domain primitives (`Table`, `DateRangePicker`) live in `src/components/`.
- **Supabase migrations are numbered per the project's existing convention** (`YYYYMMDDHHMMSS_description.sql`) — a separate migration for tables, RLS, publication, and the extension's admin-SELECT so each can be rolled back independently if something breaks in production.

---

## Architectural Patterns

### Pattern 1: Per-table read hook (established baseline)

**What:** Every public data fetch is a single-purpose hook in `src/hooks/queries/{domain}/useXxx.ts` that wraps `useQuery` + Supabase. No service layer, no repository abstraction.

**When to use:** All read-only data fetching — default for every query in the app.

**Trade-offs:**
- **Pro:** Query keys live next to the query definition; easy to find and invalidate. Matches TanStack Query's mental model.
- **Pro:** TypeScript auto-infers return type from the Supabase query — end-to-end typed from DB schema to component.
- **Con:** If two components need slightly different columns from the same table, the temptation is to create two hooks. Resist — one hook, `select` the union of columns, let components pick.

**Example:**
```typescript
// src/hooks/queries/extension/useEventVolume.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { z } from 'zod';

const FiltersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  eventType: z.enum(['catalog_single', 'catalog_batch', 'portal_upload', 'spreadsheet_transform', 'data_import']).optional(),
});
export type EventVolumeFilters = z.infer<typeof FiltersSchema>;

export const eventVolumeKey = (f: EventVolumeFilters) => ['extension', 'eventVolume', f] as const;

export function useEventVolumeQuery(filters: EventVolumeFilters) {
  return useQuery({
    queryKey: eventVolumeKey(filters),
    queryFn: async () => {
      let q = supabase
        .from('analytics_events')
        .select('event_type, created_at')
        .gte('created_at', filters.from)
        .lte('created_at', filters.to);
      if (filters.eventType) q = q.eq('event_type', filters.eventType);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 60_000, // matches main.tsx default
  });
}
```

### Pattern 2: Realtime-backed query invalidation (default for live views)

**What:** A `useXxxChannel()` hook subscribes to `supabase.channel(...).on('postgres_changes', ...)` and calls `queryClient.invalidateQueries({ queryKey: [...] })` on every event. The hook returns nothing; its only job is to keep the cache fresh.

**When to use:** Any query that needs to track database changes in real time. **Prefer this over `setQueryData` by default** — invalidation is safer (it always re-reads authoritative state and re-runs filters/joins/RLS) and the latency difference (~100–300 ms extra for a refetch) is acceptable for the live-sale UI. Reserve `setQueryData` for the one or two hot-path queries where that extra refetch hurts (see Pattern 3).

**Trade-offs:**
- **Pro:** Cache and DB can never diverge — every change triggers a fresh read through the same query path.
- **Pro:** RLS is always respected — the refetch hits PostgREST with the user's JWT.
- **Con:** Extra round-trip per event. For the live-sale domain at ~1 event/sec this is trivial; at 100 events/sec it would be wasteful.
- **Con:** Supabase Realtime fans out one auth check per subscriber per event — fine for 1–5 admins, would matter at 1000 users.

**Example:**
```typescript
// src/hooks/realtime/useLiveSaleChannel.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useLiveSaleChannel(liveSaleId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!liveSaleId) return;
    const channel = supabase
      .channel(`live-sale-${liveSaleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_lot_current', filter: `live_sale_id=eq.${liveSaleId}` },
        () => qc.invalidateQueries({ queryKey: ['live', 'currentLot', liveSaleId] })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_lot_events', filter: `live_sale_id=eq.${liveSaleId}` },
        () => qc.invalidateQueries({ queryKey: ['live', 'lotEventFeed', liveSaleId] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [liveSaleId, qc]);
}
```

### Pattern 3: Realtime `setQueryData` fast path (hot tickers only)

**What:** Instead of invalidating, the channel callback patches the query cache directly with the event payload.

**When to use:** Exactly one place — the "current lot" ticker on `/live`. That widget needs to paint within ~100 ms of a scraper write; skipping the refetch shaves the PostgREST round-trip. Do NOT use this pattern for the lot-event feed (append-only, invalidation is fine) or for any aggregation (the payload doesn't contain the aggregate, only the row).

**Trade-offs:**
- **Pro:** Sub-100ms paint on every tick.
- **Con:** Bypasses the query function's projection/transformation — you must cast the payload yourself and trust it matches `Database['public']['Tables']['live_lot_current']['Row']`.
- **Con:** If RLS would have filtered the row server-side, realtime RLS already does that check before emitting the event — but if the query has client-side filtering/transformation, `setQueryData` skips it. Keep the hook narrow.

**Example:**
```typescript
// inside useLiveSaleChannel, second .on() for the ticker
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'live_lot_current', filter: `live_sale_id=eq.${liveSaleId}` },
  (payload) => {
    qc.setQueryData(['live', 'currentLot', liveSaleId], payload.new);
  }
)
```

### Pattern 4: Append-only event log + upserted projection

**What:** The scraper writes every observed change to `live_lot_events` (append-only, one row per tick-diff) AND upserts the "current truth" into `live_lot_current` (one row per live sale). The frontend reads `live_lot_current` for the ticker and `live_lot_events` for the history feed.

**When to use:** Every live-sale write. This is the v2.0 scraper's contract.

**Trade-offs:**
- **Pro:** Audit trail preserved. Debugging a mis-reported hammer price after the sale is as easy as scrolling `live_lot_events`.
- **Pro:** Frontend reads are cheap — `live_lot_current` has ~1 row per active sale.
- **Pro:** Realtime publication can include only `live_lot_current` + `live_sales`, keeping the high-frequency event table out of the fan-out path.
- **Con:** Two writes per tick. Wrap them in one RPC (`public.record_lot_tick(...)`) so the scraper doesn't need a transaction from the client side.

**Example:**
```sql
-- supabase/migrations/20260425000000_create_live_sale_tables.sql
create table public.live_sales (
  id uuid primary key default gen_random_uuid(),
  rfc_sale_id text not null unique,
  title text not null,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null check (status in ('scheduled','live','ended')),
  updated_at timestamptz not null default now()
);

create table public.live_lot_events (
  id bigserial primary key,
  live_sale_id uuid not null references public.live_sales(id),
  lot_number int not null,
  event_type text not null,                     -- 'bid','hammer','pass','opened','closed'
  payload jsonb not null,
  observed_at timestamptz not null default now()
);
create index on public.live_lot_events (live_sale_id, observed_at desc);

create table public.live_lot_current (
  live_sale_id uuid primary key references public.live_sales(id),
  lot_number int not null,
  title text,
  current_bid_cents bigint,
  bid_count int not null default 0,
  status text not null,                         -- 'open','hammer','passed','closed'
  updated_at timestamptz not null default now()
);

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  live_sale_id uuid references public.live_sales(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null,                         -- 'running','succeeded','failed'
  last_heartbeat_at timestamptz not null default now(),
  error jsonb
);
```

### Pattern 5: RLS — admin-SELECT on extension table (additive, does NOT touch anon-INSERT)

**What:** Add a SELECT policy on `analytics_events` that allows admins (via existing `private.is_admin()`). Do NOT touch the existing anon INSERT policy.

**When to use:** When the dashboard ships the /extension surface.

**Trade-offs:**
- **Pro:** Dashboard reads respect the same auth model as everything else.
- **Con:** Another codebase now owns a policy on a table another codebase owns. Document this in PROJECT.md "Constraints" so future extension refactors know the dashboard cares.

**Example:**
```sql
-- supabase/migrations/20260425000003_analytics_events_admin_select.sql
alter table public.analytics_events enable row level security; -- no-op if already enabled
create policy "admins can read analytics_events"
  on public.analytics_events
  for select
  using (private.is_admin());
-- (leave existing anon-INSERT policy untouched)
```

---

## Data Flow

### Live-sale end-to-end (scraper → UI)

```
┌─────────────────────────────────────────────────────────────────┐
│  RFC live auction page (HTML + websocket-driven bidding UI)    │
└─────────────────────────────────────────────────────────────────┘
                        │  Playwright navigates + polls every 2–5 s
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  scraper/src/rfc/poll.ts                                        │
│   • reads current-lot DOM                                       │
│   • diffs against in-memory previous tick                       │
│   • emits LotEvent[] (only changes)                             │
└─────────────────────────────────────────────────────────────────┘
                        │  zod-validate payload
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  scraper/src/supabase/write.ts                                  │
│   • rpc('record_lot_tick', { events, current })                 │
│   • uses SUPABASE_SERVICE_ROLE_KEY from Fly.io secret           │
└─────────────────────────────────────────────────────────────────┘
                        │  HTTPS (PostgREST RPC)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Postgres:                                                      │
│   • INSERT into live_lot_events (N rows)                        │
│   • UPSERT into live_lot_current (1 row, updated_at = now())    │
│   • UPDATE scrape_runs SET last_heartbeat_at = now()            │
└─────────────────────────────────────────────────────────────────┘
                        │  logical replication → supabase_realtime publication
                        │  (only live_lot_current + live_sales in publication)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Realtime broadcast                                    │
│   • one RLS check per subscribed user per change                │
│   • drops events for non-admins                                 │
└─────────────────────────────────────────────────────────────────┘
                        │  WSS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Browser: useLiveSaleChannel(liveSaleId)                        │
│   • live_lot_current UPDATE → setQueryData (ticker, <100ms)     │
│   • live_lot_events INSERT  → invalidateQueries (feed refetch)  │
└─────────────────────────────────────────────────────────────────┘
                        │  TanStack Query refetch (for feed)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  pages/live/sections/CurrentLotTicker      ← re-renders instantly│
│  pages/live/sections/LotEventStream        ← prepends new events │
│  pages/live/sections/ScraperStatusBadge    ← heartbeat age       │
└─────────────────────────────────────────────────────────────────┘
```

### Request flow (non-live read, e.g., /extension event volume chart)

```
User changes date range on /extension
    ↓
useDateRange() updates URL search param → triggers re-render
    ↓
useEventVolumeQuery({from,to}) → TanStack Query notices new key
    ↓
queryFn: supabase.from('analytics_events').select(...).gte/lte → PostgREST
    ↓
RLS: private.is_admin() gate → row set returned
    ↓
TanStack Query caches result by key, returns to component
    ↓
Recharts <BarChart> renders
```

### State management

```
┌──────────────────┐        ┌──────────────────────┐
│  Zustand         │        │  TanStack Query       │
│  (authStore)     │        │  (module singleton)   │
│  - session       │        │  - all server data    │
│  - profile       │        │  - realtime patches   │
│  - isAdmin       │        │  - stale/refetch      │
└────────┬─────────┘        └──────────┬───────────┘
         │                             │
         │  used by                    │  used by
         │  ProtectedRoute,            │  every page
         │  DashboardLayout            │  via hooks/queries/*
         ▼                             ▼
      components                   components

  URL search params (via useDateRange, useTimezone)
       ↑
       used as a third state layer for filters that belong in the URL
       (shareable links, back/forward behavior, refresh-safe)
```

### Key Data Flows

1. **App activity read:** User lands on `/activity` → `useSessionVolume`/`useItemThroughput`/etc. fire in parallel → TanStack Query dedupes, caches 60 s → Recharts renders. **No realtime** (admin doesn't need per-second updates on yesterday's session counts).
2. **Extension analytics read:** Same as above for /extension. Optionally `useExtensionEventChannel()` subscribes to INSERTs on `analytics_events` and invalidates the "live event feed" query. Table is high-volume; consider NOT putting it in the realtime publication unless the live-feed section actually ships.
3. **Live sale read:** `/live` loads → `useLiveSaleStatus()` polls `live_sales` with `status='live'` every 10 s → once found, `useCurrentLot(id)` + `useLotEventFeed(id)` fire + `useLiveSaleChannel(id)` subscribes → realtime takes over.
4. **Scraper write:** Fly.io worker's loop ticks → `record_lot_tick` RPC → replication → realtime broadcast → frontend patch. Heartbeat to `scrape_runs.last_heartbeat_at` every tick so `ScraperStatusBadge` can go red if >30 s stale.

---

## Route Structure

```
/                        ← HomePage (existing; becomes a domain picker / recent activity)
/login                   ← existing
/activity                ← TPC App activity page (NEW)
/activity?from=...&to=...  (date range via URL)
/extension               ← Cataloger extension analytics page (NEW)
/extension?from=...&to=...
/live                    ← Live sale monitor, full-bleed layout (NEW)
/live/:liveSaleId        ← optional — specific past sale replay (out of scope for v2.0)
```

**Why three top-level routes, not tabs:**
- Each domain has its own filter state. A shared tab bar would force a single filter UX (confusing).
- `/live` wants a different layout (dark mode, full-bleed, minimal chrome) — easiest with a route-level decision.
- URLs are bookmarkable/shareable. "Send me that chart" means sending a URL.

**DashboardLayout nav becomes:**
```typescript
const NAV_ITEMS: NavItem[] = [
  { label: 'Home',       to: '/',          Icon: HomeIcon },
  { label: 'Activity',   to: '/activity',  Icon: UsersIcon },
  { label: 'Extension',  to: '/extension', Icon: ExtensionIcon },
  { label: 'Live Sale',  to: '/live',      Icon: RadioIcon },
];
```

---

## New vs Modified Files

### Modified (light-touch)
| File | Change |
|------|--------|
| `src/App.tsx` | Add three routes under `<ProtectedRoute>` nesting |
| `src/layouts/DashboardLayout.tsx` | Repopulate `NAV_ITEMS` with four entries as phases land |
| `src/db/database.types.ts` | Regenerate after each migration (via `npm run db:types`) |
| `package.json` | Add `recharts`, `@tanstack/react-table` as phases need them |
| `CLAUDE.md` | Append "Conventions" + "Architecture" sections once patterns shipped |

### New — frontend
| File | Phase |
|------|-------|
| `src/hooks/shared/useDateRange.ts` | First domain phase (whichever ships first) |
| `src/hooks/shared/useTimezone.ts` | First domain phase |
| `src/hooks/queries/extension/*.ts` | Extension phase |
| `src/hooks/queries/activity/*.ts` | App activity phase |
| `src/hooks/queries/live/*.ts` | Live sale phase |
| `src/hooks/realtime/useLiveSaleChannel.ts` | Live sale phase |
| `src/hooks/realtime/useExtensionEventChannel.ts` | Extension phase (only if live-feed ships) |
| `src/pages/extension/**` | Extension phase |
| `src/pages/activity/**` | App activity phase |
| `src/pages/live/**` | Live sale phase |

### New — infrastructure
| File | Phase |
|------|-------|
| `supabase/migrations/20260425000003_analytics_events_admin_select.sql` | Extension phase |
| `supabase/migrations/20260425000000_create_live_sale_tables.sql` | Live sale phase |
| `supabase/migrations/20260425000001_live_sale_rls.sql` | Live sale phase |
| `supabase/migrations/20260425000002_live_sale_publication.sql` | Live sale phase |
| `supabase/migrations/20260425000004_record_lot_tick_rpc.sql` | Live sale phase |
| `scraper/package.json` + `scraper/Dockerfile` + `scraper/fly.toml` | Scraper phase |
| `scraper/src/**` | Scraper phase |

### Build-order dependencies

```
infrastructure: existing v1.0 scaffold (done)
        │
        ├── Extension phase
        │     depends on: analytics_events admin-SELECT migration
        │     unblocks: the per-table hook pattern is now proven
        │
        ├── App activity phase
        │     depends on: nothing extra (tables exist, admin RLS exists)
        │     unblocks: proves multi-table aggregation patterns
        │
        └── Live sale phase
              depends on:
                - live_sale tables + RLS + publication + RPC migrations
                - scraper deployable (Fly.io app + secrets + Dockerfile)
                - Realtime wiring pattern (new, not validated in v1.0)
              unblocks: end-to-end v2.0 value
```

---

## Suggested Phase Order (for roadmapper, with rationale)

### Phase A — Extension Analytics (ships first)
**Why first:** Smallest end-to-end slice. One table. One new migration (admin-SELECT policy). Validates the entire pipeline — auth → TanStack Query hook → Recharts/Table → RLS — against a table the dashboard does NOT own (forces the policy-on-foreign-table conversation now instead of hiding it). No scraper, no realtime needed for v1 of this page.

**Minimum slice that proves end-to-end:** One chart ("events per day, grouped by event_type") on `/extension` reading through `useEventVolumeQuery` with a date-range filter. That slice exercises: auth gate, anon-client read with RLS, TanStack Query key design, Recharts setup, URL-synced filters.

### Phase B — TPC App Activity (ships second)
**Why second:** Same pattern as extension, more tables. If extension phase validated the single-table hook pattern, activity stress-tests it with 5 tables and joins. No new infra. No new risks. Parallelizable with live-sale infra prep if team has capacity.

**Why not first:** More tables, more charts, larger surface area. Doing it first would entangle "is our hook pattern right?" with "are we reading the App tables correctly?" — separate those concerns.

### Phase C — Live Sale (ships last)
**Why last:**
1. **New Supabase objects** — tables, publication, RLS, RPC. Higher blast radius for a migration mistake.
2. **New deploy target** — Fly.io scraper is new infrastructure (Vercel + Supabase was the v1 set).
3. **Requires a real auction to end-to-end test.** RFC has no sandbox. The test strategy is necessarily "run against a real live sale under supervision." That schedules poorly if it's a blocker for earlier work.
4. **Realtime wiring is new.** If invalidation vs. setQueryData tradeoffs need tuning, doing that on a domain we already understand the non-realtime shape of (because extension+activity shipped) is lower risk than learning both at once.
5. **Within live-sale phase, there's internal sequencing**: migrations → scraper-writes-to-db → frontend reads non-live → realtime wiring → end-to-end test against a real sale. A phase planner should keep migrations + scraper deploy as an early sub-slice so the frontend work can assume tables exist.

### Phase 0 (runs before A) — Shared tooling
Tiny phase covering `useDateRange`, `useTimezone`, any shared chart/table primitives. Could fold into Phase A as its first deliverable.

### Deployment phase (INFR-01 carryover)
Vercel deploy can ship after A or B — doesn't depend on live-sale infra. Treat as orthogonal.

---

## Scaling Considerations

This dashboard has a known-small audience (TPC admins, single-digit users). Most "scaling" concerns are premature — except two that matter even at N=1:

| Scale | What to do |
|-------|------------|
| 1–10 users | Current architecture is fine. No changes needed. |
| 10–100 users | `live_lot_current` realtime fan-out is N×events/sec auth checks — at N=100, 1 event/sec = 100 auth checks/sec. Supabase Realtime handles this, but consider collapsing bursts on the scraper side (diff once per tick, emit only changed fields). |
| 100+ users (hypothetical) | `analytics_events` SELECT at scan size becomes the bottleneck. Add a materialized view `analytics_daily` refreshed every 5 min for dashboard reads; keep `analytics_events` for drill-downs only. |

### Scaling priorities

1. **First bottleneck:** `analytics_events` table at any meaningful row volume. If the extension ships 5 events/user/day × 10 users × 365 days = ~18k rows/year. For 5 years of history it's 90k rows — still small, unindexed scans are fine. If it ever exceeds ~1M rows, add `(event_type, created_at)` composite index and consider the materialized-view pattern.
2. **Second bottleneck:** `live_lot_events` during a long sale. A 6-hour sale polling every 3 s ≈ 7.2k ticks × ~1 event per tick = 7.2k rows/sale. Over a year of sales that's ~0.5M rows. Index on `(live_sale_id, observed_at desc)` handles the feed query. Archive to a `live_lot_events_archive` table after sales end if the live table grows past ~5M rows.

---

## Anti-Patterns (specific to this project)

### Anti-Pattern 1: Putting the scraper inside `src/` or using a Vercel function

**What people do:** "It's just a script, let's put it in `src/scraper/` and call it from an API route." Or: "Vercel has cron jobs, we'll use those."

**Why wrong:**
- Vercel Hobby: 60 s function timeout. Pro: 800 s. A sale runs hours. No fit.
- No Vercel runtime has a Playwright browser binary pre-installed. You'd need a custom image and you'd blow past bundle-size limits. [Playwright on Vercel is not supported.](https://vercel.com/docs/functions/runtimes)
- The scraper needs persistent state (login cookies, in-memory previous-tick cache). Serverless is wrong shape.

**Do instead:** Deploy as a stateful worker on Fly.io (or Railway — Railway's Playwright guide is excellent, but per-GB pricing punishes 24/7 runs; Fly.io scale-to-suspend fits the bursty auction-day pattern). The repo's `scraper/` directory is a sibling of `src/` with its own `package.json` and `Dockerfile`.

### Anti-Pattern 2: Using the service_role key in the browser

**What people do:** "Just drop the service-role key in `VITE_SUPABASE_SERVICE_ROLE_KEY` so we can write live events from the browser and skip the scraper deploy for MVP."

**Why wrong:** `service_role` bypasses RLS. Leaking it into the browser bundle lets any dashboard user (or anyone who inspects the bundle) do anything to the shared Supabase project, including the TPC App's data. Catastrophic.

**Do instead:** `service_role` only in the scraper's environment (Fly.io secret). Browser always uses the anon key. There's no shortcut.

### Anti-Pattern 3: Tabbed single-page dashboard

**What people do:** One `/dashboard` route with three tabs, one global filter bar.

**Why wrong:** The three domains have genuinely different shapes. Live view wants full-bleed + dark + auto-scrolling feeds. Activity/extension want filter sidebars + chart grids. A shared filter bar that only applies to two of the three tabs is worse than three routes.

**Do instead:** Three top-level routes (`/activity`, `/extension`, `/live`), each owns its filters and layout. Home page gets a "jump to" card grid.

### Anti-Pattern 4: `setQueryData` everywhere for realtime

**What people do:** Subscribe to every change, patch the cache with `setQueryData` for every event, skip refetches entirely.

**Why wrong:** Any query with server-side aggregation/joining/RLS-filtering cannot be reconstructed from a single row payload. `setQueryData` with a partial payload yields wrong data silently. Bugs show up days later when someone asks "why does this chart disagree with the database."

**Do instead:** Default to `invalidateQueries`. Use `setQueryData` only for flat row-level reads where the payload IS the query result (the current-lot ticker is the only example this phase needs).

### Anti-Pattern 5: Scraper writes directly to `analytics_events` or TPC App tables

**What people do:** "It'd be easier to just put the live-sale data in a column on `sessions`."

**Why wrong:** Dashboard owns its own live-ops data. Writing into tables the TPC App owns breaks the constraint in PROJECT.md ("dashboard adds its own tables, reads app/extension tables as-is") and makes the TPC App team's schema migrations dangerous.

**Do instead:** Dashboard-owned tables (`live_sales`, `live_lot_events`, `live_lot_current`, `scrape_runs`). No exceptions.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase (Postgres + Auth + Realtime) | Browser: anon-key + RLS + Zustand auth. Scraper: service-role key from Fly.io secret. | Same project as TPC App — all migrations must be additive and can't rename existing tables. |
| RFC live auction site | Playwright browser automation. Login with session-cookie refresh. Poll every 2–5 s. | No API. No sandbox. Anti-bot defenses exist — budget time for stealth tuning during scraper phase. |
| Fly.io (scraper host) | Docker image from `mcr.microsoft.com/playwright:v1.59.1` base. Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RFC_USERNAME`, `RFC_PASSWORD`. Scale-to-zero with cron-style wake. | Primary region near RFC's origin for lowest scrape latency. |
| Vercel (dashboard host) | Existing TPC App pattern. Build: `tsc -b && vite build`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. | Carried from INFR-01 v1.0 requirement. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React pages ↔ `src/hooks/queries/*` | Direct function call | Hooks are the ONLY sanctioned path to Supabase for reads. |
| React pages ↔ `src/hooks/realtime/*` | Direct function call | Realtime hooks return nothing — side effect only. |
| `src/hooks/queries/*` ↔ Supabase | `supabase.from(...).select(...)` through the Proxy singleton | No service layer in between. |
| `scraper/` ↔ Supabase | `supabase.rpc('record_lot_tick', ...)` with service-role JWT | Single RPC so writes are atomic. |
| `scraper/` ↔ dashboard SPA | None. They share only Supabase as the integration point. | Deliberate — no HTTP between them. |

---

## Confidence Assessment

| Area | Level | Rationale |
|------|-------|-----------|
| Per-table hook pattern | HIGH | Validated against Supabase's official "use with React Query" guide + MakerKit reference + TanStack Query v5 docs. |
| `invalidateQueries` as the realtime default | HIGH | Supabase Realtime docs + TanStack Query guides explicitly recommend this pairing; `setQueryData` is noted as an optimization, not a default. |
| Fly.io as scraper host | MEDIUM | Based on 2026 platform comparisons. Railway is a viable alternative with first-class Playwright docs. Either works; Fly.io is cheaper for always-on. Decision should be revisited during the scraper phase's Research tier with the actual expected duty cycle. |
| Append-only events + upserted projection split | HIGH | Standard event-sourcing-lite pattern. Keeps high-frequency table out of realtime publication path. |
| Three top-level routes vs tabs | MEDIUM | Reasoned argument, not externally verified. UX research during /live phase may revisit — but the domain-per-route decision is defensible now. |
| RLS admin-SELECT on extension table | HIGH | `private.is_admin()` already exists; pattern already used by TPC App. |

---

## Sources

- [Supabase Postgres Changes (Realtime)](https://supabase.com/docs/guides/realtime/postgres-changes) — official docs on `postgres_changes` filters, publication, RLS integration
- [Supabase Realtime Row Level Security](https://supabase.com/blog/realtime-row-level-security-in-postgresql) — RLS is enforced per-subscriber per-event
- [Subscribing to Database Changes | Supabase Docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — `useEffect` + `removeChannel` cleanup pattern
- [Using Supabase with TanStack Query v5 (MakerKit, 2026)](https://makerkit.dev/blog/saas/supabase-react-query) — invalidate-on-realtime pattern, combined-state recommendation
- [TanStack Query v5 Query Invalidation Guide](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation) — `invalidateQueries` vs `setQueryData` guidance
- [TanStack Query + Supabase discussion #5661](https://github.com/TanStack/query/discussions/5661) — community-validated patterns
- [supabase/supabase-js issue #1917 — CHANNEL_ERROR on postgres_changes](https://github.com/supabase/supabase-js/issues/1917) — known bindings-mismatch pitfall, motivates the "one channel per component, clean up on unmount" discipline
- [Railway Playwright guide](https://docs.railway.com/guides/playwright) — Dockerfile + memory sizing recommendations (1 GB minimum)
- [Fly.io vs Railway 2026 comparison](https://thesoftwarescout.com/fly-io-vs-railway-2026-which-developer-platform-should-you-deploy-on/) — pricing + suspend/resume tradeoffs for bursty workloads
- [Stephen Haney — Playwright on Fly.io](https://stephenhaney.com/2024/playwright-on-fly-io-with-bun/) — concrete deploy write-up
- [Supabase API keys docs](https://supabase.com/docs/guides/api/api-keys) — service-role key must stay server-side
- TPC Dashboard CLAUDE.md — stack versions and constraints (HIGH, local file)
- TPC Dashboard `.planning/PROJECT.md` — v2.0 scope, constraints, v1.0 carryovers (HIGH, local file)
- TPC Dashboard current `src/` — existing v1.0 Phase 1 patterns (authStore, ProtectedRoute, supabase Proxy singleton, QueryClient config) (HIGH, local files)

---
*Architecture research for: TPC Dashboard v2.0 Live Ops*
*Researched: 2026-04-24*
