# Phase 2: Extension Analytics (`/extension`) — Research

**Researched:** 2026-04-29
**Domain:** React 19 + Supabase analytics dashboard (read-only, admin-gated, RPC-driven aggregation)
**Confidence:** HIGH (all stack pins verified against npm registry + Context7; Postgres bucketing pattern verified against official PostgreSQL docs)

---

## Summary

- **Phase 2 ships ~7 plans** (RPCs migration → query/hook layer → page shell → 3 chart/table batches → live feed → dev panel + empty/error/empty-state polish). All decisions in CONTEXT.md (D-01..D-21) are locked; this research builds on top of them, never against.
- **Stack is already on disk except TanStack Table.** `recharts@3.8.1`, `@tanstack/react-query@5.99.2`, `@supabase/supabase-js@2.101.1`, `date-fns@4.1.0`, `date-fns-tz@3.2.0`, `zustand@5.0.11`, and Vite/Vitest are pinned in root `package.json`. **TanStack Table v8.21.3 is the only new runtime dep this phase adds.** `[VERIFIED: npm view @tanstack/react-table version → 8.21.3, dist-tag latest]` (v9 is alpha-only).
- **Bucketing canonical form:** `date_trunc('day', created_at, 'America/New_York')` (3-arg form, returns `timestamptz`). The 2-arg `date_trunc('day', x AT TIME ZONE 'America/New_York')` returns a naked `timestamp` and forces the React side to reattach a zone — strictly worse. `[VERIFIED: PostgreSQL 17 docs, functions-datetime.html#FUNCTIONS-DATETIME-TRUNC]`
- **Recharts stacked-bar shape is row-per-bucket with one column per stacked series.** A `BarChart` with multiple `<Bar dataKey="..." stackId="a" />` children stacks them. Server should return WIDE (one column per event_type) — pivoting at the SQL boundary is cheaper than pivoting in JS and produces zero-count cells via a `crosstab`-free `LEFT JOIN generate_series(...)` pattern. `[CITED: recharts.org/llms.txt § BarChart stackId]`
- **Pause/Resume idiom for the live feed is `refetchInterval: () => isPaused ? false : 10_000`** combined with `queryClient.invalidateQueries({ queryKey: [...feedKey] })` on Resume click. Setting `refetchInterval` reactively does NOT trigger an immediate refetch — TanStack reschedules but waits for the next tick; the explicit `invalidateQueries` is what makes Resume jump to "latest 50 right now" (CONTEXT D-11). `[CITED: tanstack.com/query/latest/docs/react/guides/polling § Pausing polling]`
- **RPC default volatility + security:** `LANGUAGE sql STABLE` (sql > plpgsql for read-only aggregations — better optimizer visibility, no plan caching overhead) and `SECURITY INVOKER` (the Postgres default — preserves the calling admin's RLS, so the existing `analytics_admin_select` policy keeps gating reads). No `SECURITY DEFINER` is needed in this phase. `[VERIFIED: postgresql.org/docs § sql-createfunction, xfunc-volatility]`
- **Array-as-optional-filter idiom in SQL:** `WHERE (cardinality(p_users) = 0 OR user_email = ANY(p_users))`. From JS, pass an empty array `[]` to mean "no filter." `[VERIFIED: postgresql.org/docs § functions-array — array_length on empty array returns NULL, cardinality returns 0]`
- **TanStack Query queryKey for URL-driven filters:** `['extension', kind, { from: from.toISOString(), to: to.toISOString(), users: [...users].sort(), versions: [...versions].sort() }]`. Sorting the arrays inside the key is mandatory — TanStack does structural equality over keys but `['a','b']` and `['b','a']` are DIFFERENT keys; without sort you get cache misses on equivalent filter sets.
- **The full-page empty gate (`useExtensionGate`, D-19) sits in the page component**, not in a router loader. It runs ONCE per session (`staleTime: Infinity`), branches the page render: `gate.isLoading` → skeleton; `gate.isEmpty` → `<EmptyState>` only; otherwise → mount the rest of the page. Gating sub-charts conditionally is wrong — single page-level branch is the right shape.
- **Recharts JSDom mock from Phase 1 covers stacked bars too.** The mock replaces `ResponsiveContainer` with a sized div; `BarChart` + `<Bar>` render real SVG inside. No mock extension needed for stacked variants. `[VERIFIED: src/components/kit/Sparkline.test.tsx Phase 1 pattern]`

**Primary recommendation:** Build the SQL surface first (one migration with all 4 admin RPCs + 2 dev-only RPCs, using `LANGUAGE sql STABLE SECURITY INVOKER`), regen `database.types.ts`, then assemble the page from kit primitives and per-RPC hooks. Do NOT pre-flight a generic "useFilteredQuery" abstraction — the four chart hooks have different return shapes; each gets its own typed hook.

---

## Validation Architecture (MANDATORY)

This section is consumed by the Nyquist validation phase (`workflow.nyquist_validation: true` in `.planning/config.json`). Every Plan must hand verification a green test that proves the boundary it claims to honor.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 + jsdom 28.1.0 |
| Config file | `vitest.config.ts` (Phase 1; reuse) |
| Quick run command | `npm run test -- {file pattern}` |
| Full suite command | `npm run test` |
| Coverage today | 81/81 passing in 12 files (Phase 1 closeout) + 4/4 in scraper/ |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| EXT-01 | 14-day stacked bar renders with 5 series + 14 buckets | unit (component + hook mock) | `npm run test -- src/components/extension/EventVolumeChart.test.tsx` | ❌ Wave 0 |
| EXT-02 | 5 KPI cards each show count, prev-period delta direction, sparkline | unit (component + hook mock) | `npm run test -- src/components/extension/KpiStrip.test.tsx` | ❌ Wave 0 |
| EXT-03 | Error-rate horizontal bar shows count(error_message NOT NULL) / count(*) per type | unit (component + hook mock) | `npm run test -- src/components/extension/ErrorRateChart.test.tsx` | ❌ Wave 0 |
| EXT-04 | Per-user table sortable by total + last-seen; Unknown bucket present | unit (component) | `npm run test -- src/components/extension/PerUserTable.test.tsx` | ❌ Wave 0 |
| EXT-05 | Recent Errors table renders ts/email/type/message/version; row click guarded | unit (component) | `npm run test -- src/components/extension/RecentErrorsTable.test.tsx` | ❌ Wave 0 |
| EXT-06 | PayloadViewerModal opens on dev row click; admin row click is no-op | unit (interaction) | `npm run test -- src/components/extension/RecentErrorsTable.test.tsx` | ❌ Wave 0 |
| EXT-07 | URL `?range=7d&users=a,b` round-trips through hooks; chart hooks invalidate on filter change | unit (hook) | `npm run test -- src/hooks/extension/useUserFilter.test.ts src/hooks/extension/useEventVolume.test.ts` | ❌ Wave 0 |
| EXT-08 | Live feed refetches every 10s; Pause sets interval false; Resume jumps to latest 50 | unit (hook + fake timers) | `npm run test -- src/hooks/extension/useLiveFeed.test.ts` | ❌ Wave 0 |
| EXT-09 | Dominant-version badge shows highest-count version under active filter; ties → latest semver | unit (component + hook) | `npm run test -- src/components/extension/DominantVersionBadge.test.tsx` | ❌ Wave 0 |
| EXT-10 | Cancellation-rate KPIs render only inside DeveloperPanel; numerator/denominator math correct | unit (component + RPC mock) | `npm run test -- src/components/extension/CancellationRateKpis.test.tsx` | ❌ Wave 0 |
| EXT-D-01 | Every RPC scopes by `app_source = 'tpc-extension'` | static (SQL grep) + integration (DB seed) | `node scripts/verify-extension-app-source-scope.mjs` | ❌ Wave 0 |
| EXT-D-02 | catalog_item rows never appear in EXT-01/02/03/04 results | integration (DB seed) | `npm run test:db -- extension-rpc-catalog-item-exclusion` (or vitest with mock RPC) | ❌ Wave 0 |
| EXT-D-05 | Previous-period window = `[from - len, from)` exact | unit (RPC math test against fixtures) | `npm run test -- src/services/extension/queries.test.ts` | ❌ Wave 0 |
| EXT-D-13 | An event at `2026-03-08T03:30:00Z` (= 2026-03-07 22:30 ET) lands in bucket 2026-03-07, not 2026-03-08 | integration (DB seed) OR unit (SQL fixture) | `node scripts/verify-extension-bucket-tz.mjs` | ❌ Wave 0 |
| EXT-D-15 | DeveloperPanel renders ONLY when `isDevAccount(profile.email)` is true | unit (component with auth-store mock) | `npm run test -- src/components/extension/DeveloperPanel.test.tsx` | ❌ Wave 0 |
| EXT-D-19 | Zero-lifetime-rows triggers full-page empty state; no charts mount | unit (page test with hook mock) | `npm run test -- src/pages/Extension.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- {file pattern}` (the specific component/hook the task touched)
- **Per wave merge:** `npm run test` (full suite — currently 81 tests, will land around 130-150)
- **Phase gate:** Full suite green + new SQL static-shape verifier green before `/gsd-verify-work`

### Wave 0 Gaps (test infra to add before implementation)

- [ ] `src/services/extension/queries.test.ts` — fixtures for RPC arg shape + previous-period math
- [ ] `src/hooks/extension/useEventVolume.test.ts` — queryKey shape + filter folding
- [ ] `src/hooks/extension/useKpiTotals.test.ts` — same
- [ ] `src/hooks/extension/useErrorRate.test.ts` — same
- [ ] `src/hooks/extension/usePerUserSummary.test.ts` — same
- [ ] `src/hooks/extension/useRecentErrors.test.ts` — covers EXT-05 query shape
- [ ] `src/hooks/extension/useLiveFeed.test.ts` — covers refetchInterval pause/resume + invalidateQueries
- [ ] `src/hooks/extension/useExtensionGate.test.ts` — covers `staleTime: Infinity` + `app_source` scope
- [ ] `src/hooks/extension/useUserFilter.test.ts` + `useVersionFilter.test.ts` — URL round-trip
- [ ] `src/components/extension/*.test.tsx` for each chart/table component (10 files)
- [ ] `src/lib/devAccess.test.ts` — allowlist semantics (case-insensitive? trim? null safe?)
- [ ] `src/pages/Extension.test.tsx` — empty-gate branching, dev-panel gating, layout assembly
- [ ] `scripts/verify-extension-app-source-scope.mjs` — static SQL grep on the migration file (`MUST contain "app_source = 'tpc-extension'"` in every aggregation query)
- [ ] `scripts/verify-extension-bucket-tz.mjs` — admin-client integration test that seeds an `analytics_events` row at a known UTC time + asserts which day-bucket the RPC returns

### Recharts JSDom Mock — already in use, no extension needed

The Phase 1 mock (in `Sparkline.test.tsx`) replaces `ResponsiveContainer` with a sized div via `cloneElement`. It works for `LineChart`, `BarChart` (stacked included), and any chart that takes `width`/`height` props. New chart tests in `src/components/extension/` reuse the mock pattern verbatim.

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Phase 2 Implication |
|-----------|--------|--------------------|
| `src/` MUST NOT import `scraper/lib/supabase-admin.ts` | CLAUDE.md § Service-role admin client rule 1 | Frontend hooks always use `src/lib/supabase.ts` (anon client). RPCs are called via the anon client; RLS gates them. |
| `src/` reads env via `import.meta.env.VITE_*` | rule 2 | No `process.env` in frontend code. |
| Prebuild guard fails if `SUPABASE_SERVICE_ROLE_KEY` appears in `src/` or `index.html` or `vite.config.ts` | rule 3 (`scripts/check-no-service-role-in-src.mjs`) | Phase 2 cannot regress this. |
| GSD workflow enforced — start work through a GSD command | CLAUDE.md § GSD Workflow Enforcement | All Phase 2 plans go through `/gsd-execute-phase`. |
| Forbidden Supabase CLI commands: `supabase db pull`, `supabase db reset --linked` | STATE.md decision (Phase 1 v1.0) | Phase 2 RPC migration ships via `supabase db push` only. |
| Stack pins (versions) | CLAUDE.md § Technology Stack | All Phase 2 deps already at the pinned versions; only TanStack Table is new (v8.21.3 latest). |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregation (volume, KPIs, error rates, per-user) | **Database (Postgres RPC)** | — | D-12/D-13: server-side bucketing means `useTimezone` and SQL agree on day boundaries. |
| Recent errors table data (50 newest filtered rows) | **Database (PostgREST view via `.from().select()`)** | — | D-12: non-aggregating shape. |
| Live feed data (50 newest unfiltered rows, polled) | **Database (PostgREST view via `.from().select()`)** | — | D-09: TanStack `refetchInterval`, not Realtime. |
| Lifetime emptiness probe | **Database (PostgREST view via `.from().select('id').eq('app_source','tpc-extension').limit(1)`)** | — | D-19: a single-row probe; one network call per session. |
| Filter state (date range, users, versions) | **Browser URL (`useSearchParams`)** | React (`useDateRange`, `useUserFilter`, `useVersionFilter`) | D-17: URL is single source of truth; no Zustand. |
| Auth gating (admin + dev allowlist) | **API (RLS via `private.is_admin()`)** | Browser (`isDevAccount(email)`) | D-15/D-16: admin gate at DB layer; dev gate is purely UI for affordances. |
| Chart rendering | **Browser (Recharts)** | — | Recharts SVG renders client-side; no server-side render. |
| Live-feed pause/resume + queryKey invalidation | **Browser (TanStack Query)** | — | D-11: client-side polling control. |
| Payload viewer | **Browser (HTML `<dialog>`)** | — | Phase 1 PayloadViewerModal already ships; payload is just `analytics_events.items_content` (jsonb) round-tripped. |

---

## Standard Stack

### Core (already installed at correct versions)

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| react | ^19.2.0 | UI framework | Phase 1 | `[VERIFIED: package.json]` |
| typescript | ~5.9.3 | Type safety | Phase 1 | `[VERIFIED: package.json]` |
| vite | ^7.3.1 | Build | Phase 1 | `[VERIFIED: package.json]` |
| tailwindcss | ^4.2.1 | Styling | Phase 1 | `[VERIFIED: package.json]` |
| @supabase/supabase-js | ^2.101.1 | DB client | Phase 1 | `[VERIFIED: package.json]` |
| @tanstack/react-query | ^5.99.2 | Server-state caching, polling | Phase 1; Phase 2 first heavy consumer | `[VERIFIED: package.json; npm view → 5.100.6 latest, our pin works]` |
| recharts | ^3.8.1 | Charts (stacked bar, line, sparkline, error-rate bar) | Phase 1 | `[VERIFIED: package.json; npm view recharts version → 3.8.1]` |
| date-fns | ^4.1.0 | Date math (subDays, startOfDay) | Phase 1 | `[VERIFIED: package.json]` |
| date-fns-tz | ^3.2.0 | ET formatting (consumed by `useTimezone`) | Phase 1 | `[VERIFIED: package.json]` |
| zustand | ^5.0.11 | Auth store ONLY (filters are URL-driven, D-17) | Phase 1 | `[VERIFIED: package.json]` |
| zod | ^4.3.6 | Schema validation (RPC response parsing if needed) | Phase 1 | `[VERIFIED: package.json]` |
| react-router | ^7.13.1 | Routing + `useSearchParams` | Phase 1 | `[VERIFIED: package.json]` |

### New addition (only one)

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| @tanstack/react-table | ^8.21.3 | Headless sortable/filterable tables (EXT-04, EXT-05) | Pairs with TanStack Query; headless = full Tailwind control; small bundle. CLAUDE.md already names it as the standard table lib. | `[VERIFIED: npm view @tanstack/react-table version → 8.21.3, dist-tag latest. v9 is alpha-only.]` |

**Installation:**
```bash
npm install @tanstack/react-table@^8.21.3
```

**Version verification (run before locking the plan):**
```bash
npm view @tanstack/react-table version          # → 8.21.3 [VERIFIED 2026-04-29]
npm view @tanstack/react-table dist-tags        # → { beta: '8.0.0-beta.9', latest: '8.21.3', alpha: '9.0.0-alpha.39' }
npm view @tanstack/react-query version          # → 5.100.6 [VERIFIED 2026-04-29]
npm view recharts version                       # → 3.8.1 [VERIFIED 2026-04-29]
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts BarChart with `stackId` (D-12) | Tremor/Nivo | Tremor wraps Recharts, locks in opinions; Nivo heavier API. CLAUDE.md already standardizes on Recharts. |
| TanStack Query refetchInterval (D-09) | Supabase Realtime | Per-row RLS fan-out cost on a high-volume INSERT table; rejected by D-09. |
| Server-side bucketing via RPC (D-13) | Client-side bucketing in JS | DST correctness + agreement with `useTimezone` formatters requires SQL `date_trunc` with the timezone arg. |
| URL-driven filters (D-17) | Zustand filter store | Zustand can't survive refresh; URL-driven gives shareable links + browser back/forward. |
| TanStack Table v8.21.3 stable | v9 alpha (`tableFeatures` API) | v9 is alpha; we're shipping production. |

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────── BROWSER ───────────────────────┐
│                                                    │
│  URL (single source of truth for filters)          │
│   ?range=7d&users=a@x.com,b@y.com&versions=2.0.1   │
│                       │                            │
│                       ▼                            │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ useDateRange │  │useUserFilter│  │useVersion │  │
│  │              │  │             │  │  Filter   │  │
│  └──────┬───────┘  └──────┬──────┘  └────┬──────┘  │
│         └──────────┬──────┴──────────────┘         │
│                    ▼                                │
│      ┌──────────────────────────────┐              │
│      │  src/hooks/extension/        │              │
│      │  useEventVolume    ─┐        │              │
│      │  useKpiTotals      ─┤        │              │
│      │  useErrorRate      ─┼─ each folds            │
│      │  usePerUserSummary ─┤   filters              │
│      │  useRecentErrors   ─┤   into queryKey        │
│      │  useLiveFeed       ─┤   (sorted arrays)      │
│      │  useExtensionGate  ─┘                        │
│      └──────────┬───────────────────┘              │
│                 ▼                                   │
│      ┌──────────────────────┐                      │
│      │  TanStack Query      │ staleTime 60s        │
│      │  (module-level cache)│ retry 1              │
│      └──────────┬───────────┘ refetchInterval(feed)│
│                 ▼                                   │
│      ┌──────────────────────┐                      │
│      │ src/services/        │                      │
│      │  extension/queries.ts│                      │
│      │  (.from() + .rpc())  │                      │
│      └──────────┬───────────┘                      │
│                 ▼                                   │
│      src/lib/supabase.ts (anon client + JWT)       │
└──────────────────────┬────────────────────────────┘
                       │ HTTPS
                       ▼
┌────────── SUPABASE (PostgREST + Postgres) ────────┐
│                                                    │
│  RLS gate: analytics_admin_select                  │
│   (TO authenticated USING private.is_admin())      │
│                       │                            │
│                       ▼                            │
│  ┌───────────────── public.analytics_events ───┐  │
│  │ (admin SELECT + anon INSERT)                  │ │
│  └───────────────────┬───────────────────────────┘ │
│                      ▲                             │
│       ┌──────────────┴───────────────┐             │
│       │  4 admin RPCs (LANGUAGE sql  │             │
│       │  STABLE SECURITY INVOKER):   │             │
│       │   get_event_volume_daily     │             │
│       │   get_kpi_totals             │             │
│       │   get_error_rate_by_type     │             │
│       │   get_per_user_summary       │             │
│       │  + 2 dev-panel RPCs:         │             │
│       │   get_cancellation_rates     │             │
│       │   get_dominant_version       │             │
│       │  All scope by                │             │
│       │   app_source = 'tpc-extension'│           │
│       └──────────────────────────────┘             │
└────────────────────────────────────────────────────┘

Component responsibilities (file-to-role map; not in the diagram):
  src/pages/Extension.tsx              — page shell, empty-gate branch, layout
  src/components/extension/            — chart/table/feed components (presentational)
  src/components/extension/DeveloperPanel.tsx — collapsed-by-default dev surface (D-15)
  src/lib/devAccess.ts                 — isDevAccount(email) email allowlist (D-16)
  src/services/extension/queries.ts    — query/RPC builder helpers
  src/hooks/extension/                 — one hook per RPC + per non-aggregating query
  supabase/migrations/<ts>_create_extension_rpcs.sql — all 6 RPCs
```

### Recommended Project Structure

```
src/
├── pages/
│   └── Extension.tsx                         # page shell — empty-gate branch
├── components/extension/
│   ├── EventVolumeChart.tsx                  # EXT-01 stacked bar
│   ├── KpiStrip.tsx                          # EXT-02 5 cards
│   ├── ErrorRateChart.tsx                    # EXT-03 horizontal bar
│   ├── PerUserTable.tsx                      # EXT-04 TanStack Table
│   ├── RecentErrorsTable.tsx                 # EXT-05 TanStack Table + payload trigger
│   ├── LiveEventFeed.tsx                     # EXT-08 polled feed + Pause
│   ├── DeveloperPanel.tsx                    # D-15 collapsible dev shell
│   ├── DominantVersionBadge.tsx              # EXT-09 inside DeveloperPanel
│   ├── ExtensionVersionFilter.tsx            # EXT-09 multi-select inside DeveloperPanel
│   └── CancellationRateKpis.tsx              # EXT-10 inside DeveloperPanel
├── hooks/extension/
│   ├── useEventVolume.ts
│   ├── useKpiTotals.ts
│   ├── useErrorRate.ts
│   ├── usePerUserSummary.ts
│   ├── useRecentErrors.ts
│   ├── useLiveFeed.ts
│   ├── useExtensionGate.ts
│   ├── useDominantVersion.ts
│   ├── useCancellationRates.ts
│   ├── useUserFilter.ts                      # URL ?users=
│   └── useVersionFilter.ts                   # URL ?versions=
├── services/extension/
│   └── queries.ts                            # .from()+.rpc() builders + JSDoc app_source warning
├── lib/
│   └── devAccess.ts                          # isDevAccount(email) — allowlist constant
└── (existing) layouts/DashboardLayout.tsx    # NAV_ITEMS gets first entry: { label: 'Extension', to: '/extension' }

supabase/migrations/
└── <ts>_create_extension_rpcs.sql            # all 6 RPCs in one migration
```

### Pattern 1: Server-side bucketing RPC (EXT-01 EventVolume)

**What:** One row per (bucket, event_type) with zero-count cells filled by `LEFT JOIN generate_series`.
**When to use:** Any time the chart must show empty buckets as zeros (stacked bars don't infer "missing = 0").

```sql
-- Source: PostgreSQL 17 docs § functions-datetime + functions-srf (generate_series)
create or replace function public.get_event_volume_daily(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[]
) returns table (
  bucket_start timestamptz,
  event_type   text,
  event_count  bigint
)
language sql
stable
security invoker
as $$
  with buckets as (
    select generate_series(
      date_trunc('day', p_from, 'America/New_York'),
      date_trunc('day', p_to,   'America/New_York'),
      interval '1 day'
    )::timestamptz as bucket_start
  ),
  types as (
    select unnest(array[
      'catalog_single', 'catalog_batch', 'portal_upload',
      'spreadsheet_transform', 'data_import'
    ]) as event_type
  ),
  scoped as (
    select
      date_trunc('day', created_at, 'America/New_York') as bucket_start,
      event_type
    from public.analytics_events
    where app_source = 'tpc-extension'                            -- D-01
      and event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )                                                           -- D-02
      and created_at >= date_trunc('day', p_from, 'America/New_York')
      and created_at <  date_trunc('day', p_to,   'America/New_York') + interval '1 day'
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
  timestamptz, timestamptz, text[], text[]
) to authenticated;
```

**Hourly variant (range = 'today', D-08):** Either branch on `p_bucket = 'day'|'hour'` inside the same RPC, or ship a sibling `get_event_volume_hourly`. Recommendation: add a 5th positional arg `p_bucket text default 'day'` and `case when p_bucket = 'hour' then 'hour' else 'day' end` inside `date_trunc`. Keeps the JS hook to a single RPC name.

### Pattern 2: KPI totals + previous-period + sparkline in ONE RPC (EXT-02)

**What:** `get_kpi_totals` returns one row per event_type with current count, previous count, and a JSON array of bucket counts for the sparkline. Avoids 5×3 = 15 round trips.

```sql
create or replace function public.get_kpi_totals(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[],
  p_bucket   text     default 'day'   -- 'hour' for range=today (D-08)
) returns table (
  event_type      text,
  current_count   bigint,
  previous_count  bigint,
  sparkline       jsonb           -- [{ "x": "2026-04-01T00:00:00-04", "y": 12 }, ...]
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      p_from as cur_from,
      p_to   as cur_to,
      p_from - (p_to - p_from) as prev_from,    -- D-05: same length, immediately preceding
      p_from                       as prev_to
  ),
  types as (
    select unnest(array[
      'catalog_single', 'catalog_batch', 'portal_upload',
      'spreadsheet_transform', 'data_import'
    ]) as event_type
  ),
  scoped as (
    select
      event_type,
      created_at,
      case when created_at >= (select cur_from from bounds)
            and created_at <  (select cur_to   from bounds) then 'cur'
           when created_at >= (select prev_from from bounds)
            and created_at <  (select prev_to   from bounds) then 'prev'
      end as period
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )
      and created_at >= (select prev_from from bounds)
      and created_at <  (select cur_to    from bounds)
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  ),
  totals as (
    select event_type,
           count(*) filter (where period = 'cur')  as current_count,
           count(*) filter (where period = 'prev') as previous_count
    from scoped group by event_type
  ),
  sparks as (
    select
      event_type,
      jsonb_agg(
        jsonb_build_object('x', bucket_start, 'y', cnt)
        order by bucket_start
      ) as sparkline
    from (
      select event_type,
             date_trunc(p_bucket, created_at, 'America/New_York') as bucket_start,
             count(*) as cnt
      from scoped
      where period = 'cur'
      group by 1, 2
    ) inner_buckets
    group by event_type
  )
  select t.event_type,
         coalesce(tot.current_count, 0)  as current_count,
         coalesce(tot.previous_count, 0) as previous_count,
         coalesce(s.sparkline, '[]'::jsonb) as sparkline
  from types t
  left join totals tot using (event_type)
  left join sparks s using (event_type)
  order by t.event_type;
$$;

grant execute on function public.get_kpi_totals(
  timestamptz, timestamptz, text[], text[], text
) to authenticated;
```

### Pattern 3: TanStack Query hook with URL-derived sorted-array queryKey

```typescript
// src/hooks/extension/useEventVolume.ts
// Source: TanStack Query v5 docs § Query Keys (https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)

import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchEventVolume } from '../../services/extension/queries';

export function useEventVolume() {
  const { from, to, range } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const bucket = range === 'today' ? 'hour' : 'day';

  // Sort arrays so ['a','b'] and ['b','a'] hit the SAME cache entry.
  const usersKey    = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension', 'eventVolume',
      { from: from.toISOString(), to: to.toISOString(),
        users: usersKey, versions: versionsKey, bucket },
    ],
    queryFn: () => fetchEventVolume({ from, to, users, versions, bucket }),
    // staleTime/retry inherited from QueryClientProvider in src/main.tsx (60s, 1)
  });
}
```

### Pattern 4: Pause/Resume live feed (EXT-08, D-09/D-10/D-11)

```typescript
// src/hooks/extension/useLiveFeed.ts
// Source: TanStack Query v5 docs § Polling (https://tanstack.com/query/latest/docs/framework/react/guides/polling)

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { fetchRecentEvents } from '../../services/extension/queries';

const FEED_KEY = ['extension', 'liveFeed'] as const;

export function useLiveFeed() {
  const [paused, setPaused] = useState(false);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => fetchRecentEvents({ limit: 50 }),
    // Function form: re-evaluated on each tick. Returning false pauses;
    // a number reschedules. Reactive to `paused` because the closure
    // captures it on every render.
    refetchInterval: () => (paused ? false : 10_000),    // D-10
    staleTime: 0,                                          // each refetch returns fresh rows
  });

  const pause  = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setPaused(false);
    // D-11: Resume must IMMEDIATELY refetch, not wait 10s.
    // Just flipping refetchInterval back to 10000 reschedules but does NOT
    // trigger a sync refetch. invalidateQueries with default refetchType:'active'
    // forces an immediate refetch on the active observer.
    void qc.invalidateQueries({ queryKey: FEED_KEY });
  }, [qc]);

  return { ...query, paused, pause, resume };
}
```

### Pattern 5: Empty-state gate at the page level (D-19)

```typescript
// src/pages/Extension.tsx
import { useExtensionGate } from '../hooks/extension/useExtensionGate';
import { EmptyState } from '../components/EmptyState';
// ...rest of imports

export function ExtensionPage() {
  const gate = useExtensionGate();

  if (gate.isLoading) {
    return <div className="p-8" aria-busy="true" />;          // minimal skeleton
  }
  if (gate.isEmpty) {
    return (
      <EmptyState heading="No extension events yet">
        Waiting on TPC AI Cataloger v2.0.
      </EmptyState>
    );
  }
  // gate clear — mount full page
  return <ExtensionPageContent />;
}
```

```typescript
// src/hooks/extension/useExtensionGate.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useExtensionGate() {
  const q = useQuery({
    queryKey: ['extension', 'gate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('id')
        .eq('app_source', 'tpc-extension')   // D-01: respect strict scope
        .limit(1);
      if (error) throw error;
      return { hasAny: (data?.length ?? 0) > 0 };
    },
    staleTime: Infinity,           // D-19: probe ONCE per session
    gcTime: Infinity,
    retry: 1,
  });
  return {
    isLoading: q.isLoading,
    isEmpty:   !q.isLoading && q.data?.hasAny === false,
    error:     q.error,
  };
}
```

### Anti-Patterns to Avoid

- **Calling `.from('analytics_events')` from a hook without `.eq('app_source', 'tpc-extension')`** — D-01 invariant. Even the live feed and Recent Errors `select()` MUST scope. Add a JSDoc warning at the top of `services/extension/queries.ts`.
- **Bucketing with JavaScript `setHours(0,0,0,0)`** — JS Date math is ambiguous around DST and uses the user's locale, not ET. Always bucket in SQL via the 3-arg `date_trunc(... , 'America/New_York')`.
- **Storing filters in Zustand alongside URL state** — D-17 forbids it. Either-or, not both. URL is the SSOT.
- **Trying to gate sub-charts behind `useExtensionGate`** — page-level branch is the right shape; per-chart conditional mounting just multiplies the network probe.
- **Setting `refetchInterval: 10000` and relying on a re-render to flip it to `false`** — works for pause, BUT for resume, just flipping back to 10000 only RESCHEDULES; the user has to wait up to 10s. Always pair Resume with `qc.invalidateQueries`.
- **Putting array filters into the queryKey unsorted** — `['a','b']` ≠ `['b','a']` for TanStack's structural equality; `.sort()` is mandatory.
- **Catching error_message via per-event-type rules** — D-03 says canonical signal is `error_message IS NOT NULL`. No "if catalog_batch then error_count > 0" branches.
- **Mounting DeveloperPanel and `display: hidden`-ing it for non-devs** — render-conditionally on `isDevAccount(profile?.email)`. The `<ExtensionVersionFilter>` input MUST NOT exist in the DOM for admins, or the "?versions= URL still works for devs sharing URLs with admins" property breaks (admin would see filter applied but no UI to clear it — already accepted by D-17, but having a hidden input would surface in keyboard tab order).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable/filterable tables (EXT-04, EXT-05) | Custom `useSortable` hook + manual `Array.sort` callbacks | TanStack Table v8.21.3 (`useReactTable` + `getCoreRowModel` + `getSortedRowModel`) | Headless = full Tailwind control, built-in multi-column sort, stable across re-renders, paired with TanStack Query. |
| Stacked bar / sparkline / horizontal bar | SVG by hand or D3 directly | Recharts 3.8.1 BarChart + `<Bar stackId="a" />` | Phase 1 already standardized; Sparkline/KpiCard already consume Recharts. |
| Day bucketing across DST | JS Date math + manual offset table | Postgres `date_trunc('day', ts, 'America/New_York')` | DST-correct, returns `timestamptz`, agrees with `useTimezone`. |
| Polling | `setInterval(refetch, 10000)` in `useEffect` | TanStack Query `refetchInterval` | Pause/resume + queryKey invalidation + GC behavior all handled. |
| Previous-period math | Per-card hook reads two queries | One RPC returns both periods + sparkline (Pattern 2) | Single round trip; SQL guarantees consistent boundary. |
| URL-state filters | Hand-coded `useEffect(() => parseURL(), [location])` | `useSearchParams` from react-router 7 (already used by `useDateRange`) | Single-closure-write pattern documented in Phase 1. |
| Modal | Custom div + portal + Esc handler | Phase 1 `<PayloadViewerModal>` (native `<dialog>`) | Already shipped with tests. |
| Empty/error/loading | Three custom patterns per chart | `<EmptyState>` + `<ErrorState>` + `<TableSkeleton>` (Phase 1 D-25 retained) | Already shipped. |

**Key insight:** Phase 2 is mostly composition — six SQL RPCs + one new lib (TanStack Table) + ten new components stitched onto Phase 1 primitives. The biggest hand-rolling temptation is "let's invalidate filtered queries manually on filter change" — DON'T. Folding filters into queryKey gives invalidation for free.

---

## Common Pitfalls

### Pitfall 1: `date_trunc` 2-arg vs 3-arg form

**What goes wrong:** Using `date_trunc('day', created_at AT TIME ZONE 'America/New_York')` (2-arg form) returns a naked `timestamp without time zone` representing wall-clock midnight ET. When `supabase-js` round-trips it to JS, JS interprets it as a local time and you get an arbitrary offset.
**Why it happens:** Two valid forms in PostgreSQL look almost identical but return different types.
**How to avoid:** Always use the 3-arg form: `date_trunc('day', created_at, 'America/New_York')` returns a true `timestamptz` (the UTC moment of midnight ET). `[VERIFIED: postgresql.org/docs § functions-datetime — "When the input value is of type timestamp with time zone, the truncation is performed with respect to a particular time zone"]`
**Warning signs:** Bucket timestamps coming back as ISO strings without `Z` or `±hh:mm` suffix; bucket boundaries off by one in EST↔EDT transition weeks.

### Pitfall 2: Empty array means "match everything," NULL would mean "match nothing"

**What goes wrong:** A hook passes `users: undefined` and the SQL function gets `p_users = NULL`. The check `cardinality(NULL) = 0` returns NULL (not true), so the filter passes through and `user_email = any(NULL)` matches NOTHING. The chart silently goes blank.
**Why it happens:** Postgres trinary logic.
**How to avoid:** (1) RPC defaults: `p_users text[] default array[]::text[]` (empty, not NULL). (2) JS callers ALWAYS pass an array, never `undefined`. (3) SQL filter idiom: `(cardinality(p_users) = 0 OR x = any(p_users))` — `cardinality(NULL)` is NULL but `cardinality(empty)` is 0. (4) For belt-and-braces: `coalesce(cardinality(p_users), 0) = 0`. `[VERIFIED: postgresql.org/docs § functions-array]`
**Warning signs:** Charts go blank when filters are cleared; no error in console.

### Pitfall 3: TanStack Query queryKey array stability

**What goes wrong:** Two adjacent renders produce `users: ['b','a']` then `users: ['a','b']`; TanStack treats them as different keys, fires two requests, two cache entries.
**Why it happens:** `useSearchParams` returns insertion order; if a user multi-selects in different orders, the strings differ.
**How to avoid:** `[...users].sort()` (or `[...users].sort((a,b) => a.localeCompare(b))`) inside the hook before placing into `queryKey`. Same for `versions`.
**Warning signs:** Network tab shows duplicate requests; React Query devtools shows `[..., users: ['a','b']]` and `[..., users: ['b','a']]` as distinct entries.

### Pitfall 4: `refetchInterval` flipping false→number does NOT trigger immediate refetch

**What goes wrong:** Pause works (interval cleared), Resume doesn't visibly update until 10s pass.
**Why it happens:** TanStack reschedules the next interval but doesn't fire a refetch on the schedule change. This is by-design but counter-intuitive.
**How to avoid:** Pair Resume with `queryClient.invalidateQueries({ queryKey: FEED_KEY })` (default `refetchType: 'active'` triggers immediate refetch on any active observer). Pattern 4 above. `[CITED: tanstack.com/query/latest/docs/react/guides/polling]`
**Warning signs:** "Why does Resume feel laggy?" feedback during UAT.

### Pitfall 5: `cell.renderCell()` and `header.renderHeader()` are NOT v8 APIs

**What goes wrong:** WebFetch's first answer suggested `cell.renderCell()` — that's wrong for v8. Real v8 uses `flexRender(cell.column.columnDef.cell, cell.getContext())`.
**Why it happens:** API drift between v7/v8/v9-alpha.
**How to avoid:** Always use `flexRender` from `@tanstack/react-table` for headers and cells. `[CITED: tanstack.com/table/v8/docs — official v8 examples]`
**Warning signs:** TS error `Property 'renderCell' does not exist on type 'Cell'`.

### Pitfall 6: Forgetting `app_source = 'tpc-extension'` on a NEW query

**What goes wrong:** A future plan adds a new chart, copies the query builder template but forgets the `.eq('app_source', 'tpc-extension')` step. Charts mix in TPC App rows. (D-01)
**Why it happens:** The filter is invariant-by-convention, not invariant-by-type.
**How to avoid:** (a) JSDoc warning at top of `services/extension/queries.ts`. (b) A static verifier script that greps the migration file + `services/extension/queries.ts` for the literal string `app_source` in every aggregation/select. (c) Code review checklist item. See Validation Architecture row EXT-D-01.
**Warning signs:** EXT-04 totals don't reconcile with EXT-01 totals; obvious cross-app rows surface in EXT-05 Recent Errors.

### Pitfall 7: `catalog_item` rows leaking into top-level rollups (D-02)

**What goes wrong:** A grouping CTE forgets the `event_type IN (5-event-vocab)` filter; `catalog_item` child rows double-count batch activity.
**Why it happens:** Easy to write `GROUP BY event_type` without restricting the universe.
**How to avoid:** Every aggregation CTE includes the `event_type IN (...5...)` predicate. The `types` CTE in Pattern 1/2 above also enumerates exactly 5. Validation row EXT-D-02 seeds a catalog_item row and asserts it doesn't appear.

### Pitfall 8: `useExtensionGate` flipping after first event arrives mid-session

**What goes wrong:** D-19's `staleTime: Infinity` means once the gate sees `isEmpty: true`, it never re-checks. If the extension ships and an event arrives while the user has the tab open, the page stays in empty state until refresh.
**Why it happens:** Deliberate trade-off (CONTEXT § Deferred — Empty-state polling). Acceptable per D-19 + Deferred.
**How to avoid:** Document this in user-facing copy ("Waiting on TPC AI Cataloger v2.0 — refresh once it ships"). If it surprises anyone in UAT, the fix is one-liner: drop `staleTime: Infinity` and let the default 60s kick in.

### Pitfall 9: PostgREST grant errors on RPC calls

**What goes wrong:** RPC defined but `supabase.rpc(...)` returns 404 or "permission denied for function".
**Why it happens:** PostgREST exposes functions in `public` schema only if the calling role has `EXECUTE` privilege.
**How to avoid:** Every RPC migration ships `grant execute on function public.<name>(<arg_types>) to authenticated;` (or `to anon, authenticated;` if the function is also called pre-login — not our case). Pattern 1 above shows this.
**Warning signs:** 404 PGRST202 ("Could not find the function in the schema cache"); pgREST may need a schema cache reload (`notify pgrst, 'reload schema'`).

### Pitfall 10: Auth store's `profile` is `null` during initial render (race)

**What goes wrong:** `<DeveloperPanel>` reads `useAuthStore(s => s.profile?.email)` and on the first render gets `null` → `isDevAccount(null) === false` → the panel never mounts even for the dev. Then the profile loads but the dev panel doesn't re-render because the parent didn't change.
**Why it happens:** Zustand selectors are stable; the panel SHOULD re-render when `profile` changes.
**How to avoid:** This actually works correctly — Zustand subscribes the selector and the panel will re-render on `profile` change. But validation row EXT-D-15 should test BOTH the `profile = null` case (panel hidden) AND the `profile.email = 'josh@potomackco.com'` case (panel visible) AND a profile change from null → dev (panel mounts).

---

## Code Examples

Verified patterns from Context7 / official docs.

### Recharts BarChart with stackId (EXT-01)

```tsx
// Source: context7.com/recharts/recharts/llms.txt § Create BarChart with stacked bars
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Server returns long form: [{bucket_start, event_type, event_count}, ...]
// Pivot to wide form for Recharts: one row per bucket, one column per event_type.
function pivotForRecharts(rows: Array<{ bucket_start: string; event_type: string; event_count: number }>) {
  const byBucket = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const e = byBucket.get(r.bucket_start) ?? { bucket: r.bucket_start };
    e[r.event_type] = r.event_count;
    byBucket.set(r.bucket_start, e);
  }
  return [...byBucket.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
}

const COLORS: Record<string, string> = {
  catalog_single:        '#3b82f6',
  catalog_batch:         '#8b5cf6',
  portal_upload:         '#10b981',
  spreadsheet_transform: '#f59e0b',
  data_import:           '#ef4444',
};

export function EventVolumeChart({ data, formatBucket }: {
  data: ReturnType<typeof pivotForRecharts>,
  formatBucket: (iso: string) => string,    // from useTimezone()
}) {
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tickFormatter={formatBucket} />
          <YAxis />
          <Tooltip />
          <Legend />
          {(['catalog_single','catalog_batch','portal_upload','spreadsheet_transform','data_import'] as const).map(t => (
            <Bar key={t} dataKey={t} stackId="events" fill={COLORS[t]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### TanStack Table v8 sortable headless table (EXT-04)

```tsx
// Source: tanstack.com/table/v8/docs/framework/react § sorting (verified API)
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { SortIndicator } from '../SortIndicator';   // Phase 1 retained

interface Row {
  user_email: string;
  catalog_single: number;
  catalog_batch: number;
  portal_upload: number;
  spreadsheet_transform: number;
  data_import: number;
  total_errors: number;
  last_seen_at: string;   // ISO
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'user_email', header: 'User' },
  { accessorKey: 'catalog_single',        header: 'Catalog single' },
  { accessorKey: 'catalog_batch',         header: 'Catalog batch' },
  { accessorKey: 'portal_upload',         header: 'Portal upload' },
  { accessorKey: 'spreadsheet_transform', header: 'Spreadsheet xform' },
  { accessorKey: 'data_import',           header: 'Data import' },
  { accessorKey: 'total_errors',          header: 'Errors' },
  { accessorKey: 'last_seen_at',          header: 'Last seen' },
];

export function PerUserTable({ data }: { data: Row[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'last_seen_at', desc: true }]);
  const table = useReactTable({
    data, columns,
    state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-200 text-left">
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id}>
            {hg.headers.map(h => (
              <th
                key={h.id}
                className="cursor-pointer px-3 py-2"
                onClick={h.column.getToggleSortingHandler()}
              >
                <span className="inline-flex items-center gap-1">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  <SortIndicator state={(h.column.getIsSorted() as 'asc' | 'desc' | false) ?? false} />
                </span>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(r => (
          <tr key={r.id} className="border-b border-gray-100">
            {r.getVisibleCells().map(c => (
              <td key={c.id} className="px-3 py-2">
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

### Supabase RPC call with typed args (after `npm run db:types`)

```typescript
// src/services/extension/queries.ts
//
// IMPORTANT: every aggregation and select against analytics_events MUST scope by
// app_source = 'tpc-extension' (CONTEXT D-01). The 5-event vocabulary excludes
// catalog_item from EXT-01..04 (D-02). The error signal is `error_message IS NOT NULL`
// (D-03). Bucketing is server-side (D-13).

import { supabase } from '../../lib/supabase';
import type { Database } from '../../db/database.types';

type Volume = Database['public']['Functions']['get_event_volume_daily']['Returns'];
type Kpi    = Database['public']['Functions']['get_kpi_totals']['Returns'];

export async function fetchEventVolume(args: {
  from: Date; to: Date; users: string[]; versions: string[]; bucket: 'day' | 'hour';
}): Promise<Volume> {
  const { data, error } = await supabase.rpc('get_event_volume_daily', {
    p_from:     args.from.toISOString(),
    p_to:       args.to.toISOString(),
    p_users:    args.users,         // empty array = "no filter" (D-01-Pitfall-2)
    p_versions: args.versions,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRecentErrors(args: {
  from: Date; to: Date; users: string[]; versions: string[]; limit?: number;
}) {
  let q = supabase
    .from('analytics_events')
    .select('id, created_at, user_email, event_type, error_message, extension_version, items_content')
    .eq('app_source', 'tpc-extension')             // D-01
    .not('error_message', 'is', null)              // D-03
    .in('event_type', [
      'catalog_single','catalog_batch','portal_upload',
      'spreadsheet_transform','data_import',
    ])                                              // D-02
    .gte('created_at', args.from.toISOString())
    .lte('created_at', args.to.toISOString())
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 100);
  if (args.users.length)    q = q.in('user_email',        args.users);
  if (args.versions.length) q = q.in('extension_version', args.versions);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchLiveFeed({ limit = 50 }: { limit?: number } = {}) {
  // Live feed: NO filters, just newest 50. (D-09 / D-10 / D-11)
  const { data, error } = await supabase
    .from('analytics_events')
    .select('id, created_at, user_email, event_type, error_message, extension_version, items_content')
    .eq('app_source', 'tpc-extension')             // D-01 still applies
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

### isDevAccount allowlist (D-16)

```typescript
// src/lib/devAccess.ts
// D-16: email allowlist gating the <DeveloperPanel>. Allowlist ships in the
// production bundle — emails are not secrets.

const DEV_EMAILS: ReadonlyArray<string> = [
  'josh@potomackco.com',
];

export function isDevAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  // Case-insensitive comparison; emails are case-insensitive per RFC 5321.
  return DEV_EMAILS.includes(email.toLowerCase());
}
```

```typescript
// src/components/extension/DeveloperPanel.tsx (sketch)
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';

export function DeveloperPanel() {
  const email = useAuthStore(s => s.profile?.email);
  if (!isDevAccount(email)) return null;       // gated render — never in DOM for admins
  // ... rest of panel (collapsed by default)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `date_trunc('day', x AT TIME ZONE 'America/New_York')` | 3-arg `date_trunc('day', x, 'America/New_York')` | PostgreSQL 16 (3-arg form added) | Returns true `timestamptz`, not naked `timestamp` — round-trips correctly to JS. |
| TanStack Table v7 `useTable` | v8 `useReactTable` + explicit row models (`getCoreRowModel`, `getSortedRowModel`) | TanStack Table v8 (Aug 2022) | Headless API is current standard. v9 alpha exists with `tableFeatures` builder but is alpha-only as of Apr 2026. |
| `keepPreviousData: true` (TanStack Query v4) | `placeholderData: keepPreviousData` (TanStack Query v5) | Query v5 (Oct 2023) | If we want filter changes to "fade" instead of "blank", import `keepPreviousData` from `@tanstack/react-query` and use it. Optional polish. |
| Supabase Realtime as default for any live signal | TanStack `refetchInterval` for high-volume INSERT tables; Realtime only for low-frequency tables | Phase 4 SCRP-16 precedent | EXT-08 follows the new pattern (D-09). |

**Deprecated/outdated:**
- `cell.renderCell()` / `header.renderHeader()` — never existed in v8 stable; some AI sources confuse them with v7 or v9-alpha. Use `flexRender(...)`.
- `LineChart` for sparklines without `isAnimationActive={false}` — Phase 1 already locked in `isAnimationActive={false}` to avoid JSDom test flakes.
- Setting `refetchInterval: 10000` and expecting Resume to refetch immediately — needs explicit `invalidateQueries`.

---

## Per-Question Research Findings

### Q1 — Recharts 3.x stacked bar + sparkline patterns

**Stacked-bar shape (EXT-01):**
- Recharts canonical form is wide rows: `data = [{ bucket: '2026-04-01', catalog_single: 12, catalog_batch: 4, ... }, ...]` with one `<Bar dataKey="catalog_single" stackId="a" />` per series. `stackId` is what makes them stack. `[CITED: context7.com/recharts/recharts § Create BarChart with stacked bars]`
- Server emits LONG (one row per bucket × event_type, see Pattern 1). The hook pivots to WIDE before passing to the chart (~5 lines, see code above). Pivoting in JS is fine here — 14 buckets × 5 types = 70 rows.
- Empty buckets MUST be present in the data array as zeros, otherwise the X-axis goes scarce. Pattern 1's `LEFT JOIN generate_series` solves this server-side; recommend over Recharts gap-handling because the X axis stays evenly spaced.

**Sparkline (EXT-02):**
- Phase 1 `<Sparkline>` already wraps `LineChart` with no axes/grid/tooltip. EXT-02 hands it `data: [{ x, y }, ...]` per event type. The RPC return shape (Pattern 2 — `sparkline jsonb`) is already in `[{x, y}, ...]` form, so the consumer just `.map(d => d.sparkline)`.

**X-axis ticks for daily vs hourly (D-08):**
- `<XAxis dataKey="bucket" tickFormatter={fn} />`. Pass a different formatter from `useTimezone` based on `range`:
  - daily (7d/30d/custom): `formatBucket = (iso) => formatInTimeZone(iso, 'America/New_York', 'MMM d')`
  - hourly (today): `formatBucket = (iso) => formatInTimeZone(iso, 'America/New_York', 'h a')`
- Add a custom `interval` prop or rely on Recharts default (`preserveStartEnd`). For 24 hourly ticks consider `interval={2}` to avoid cramping.
- `[CITED: context7.com/recharts/recharts § Configure XAxis and YAxis with custom formatting]`

**JSDom mock for stacked variants:** The Phase 1 mock (`src/components/kit/Sparkline.test.tsx`) intercepts `ResponsiveContainer` and clones width/height onto its child. This works for `LineChart`, `BarChart`, and any other Recharts chart — no extension needed. Tests for stacked bars assert on `<rect>` elements (one per stacked segment) rather than `<path>` (line). `[VERIFIED: STATE.md decision Phase 1/01-05 + reading Sparkline.test.tsx]`

**Confidence:** HIGH

### Q2 — TanStack Query refetchInterval pause/resume mechanics

**Reactive switching:** Use the FUNCTION form of `refetchInterval`, not the static number form. The function is re-evaluated on every interval tick AND on every query state change. It can read closure-captured `paused` state and return `false` (pause) or a number (resume schedule). `[CITED: tanstack.com/query/latest/docs/react/guides/polling § Pausing polling]`

**Resume immediate refetch:** Setting `refetchInterval` from `false` back to a number does NOT trigger a refetch — TanStack reschedules the next tick but doesn't fire one synchronously. CONTEXT D-11 says Resume should "immediately refetch." The idiomatic pattern is to pair the state flip with `queryClient.invalidateQueries({ queryKey: FEED_KEY })`. `invalidateQueries` defaults to `refetchType: 'active'` which triggers an immediate refetch on any active observer. `[CITED: tanstack.com/query/latest/docs/reference/QueryClient § invalidateQueries]`

**Why not `query.refetch()` directly?** It works too and is slightly simpler, but `invalidateQueries` integrates with the cache (any subscriber, including a future second `<LiveEventFeed>` if we ever embed one) and surfaces the action in DevTools. Use `invalidateQueries`.

**Test pattern:** Use Vitest's `vi.useFakeTimers()`. Assertions:
1. Initial render → `queryFn` called once.
2. `vi.advanceTimersByTime(10_000)` → called twice.
3. Click Pause → `vi.advanceTimersByTime(20_000)` → still twice.
4. Click Resume → assert `queryFn` called a 3rd time WITHIN the same tick (no time advance), proving immediate refetch.

**Confidence:** HIGH

### Q3 — Postgres `date_trunc(... AT TIME ZONE 'America/New_York')` correctness

**Canonical form:** `date_trunc('day', created_at, 'America/New_York')` — the 3-arg form available in PostgreSQL 16+. Returns `timestamptz`. `[VERIFIED: postgresql.org/docs § functions-datetime — "date_trunc(text, timestamp with time zone, text) → timestamp with time zone"]`

**vs the 2-arg form `date_trunc('day', x AT TIME ZONE 'America/New_York')`:** Returns `timestamp without time zone` (the wall clock). Strictly worse — JS will interpret it as local time, producing a wrong UTC offset on round-trip.

**DST correctness:** Built in. The doc states explicitly: "When the input value is of type timestamp with time zone, the truncation is performed with respect to a particular time zone; for example, truncation to day produces a value that is midnight in that zone." Across the 2026-03-08 spring-forward boundary, an event at `2026-03-08T03:30:00Z` (= 22:30 ET on 2026-03-07, before the gap) buckets to `2026-03-07 00:00:00-05` (UTC: `2026-03-07T05:00:00Z`). Across fall-back, the doubled-hour is treated as EST (after the transition); same correctness.

**Round-trip to React via `useTimezone`:** RPC returns ISO `2026-03-07T05:00:00+00:00` (UTC). `useTimezone.formatDate(new Date(...))` runs `formatInTimeZone(d, 'America/New_York', 'MMM d, yyyy')` → "Mar 7, 2026". Perfect agreement. **Validation EXT-D-13** seeds an event at the boundary and asserts the bucket comes back as 2026-03-07.

**Previous-period idiom:** `prev_from = p_from - (p_to - p_from)`, `prev_to = p_from`. The `[prev_from, prev_to)` half-open interval is the same length as `[p_from, p_to)`. Pattern 2 above shows this. Off-by-one safe because half-open intervals never overlap. **Validation EXT-D-05** asserts a specific fixture: `from = 2026-04-22T00:00:00-04`, `to = 2026-04-29T00:00:00-04` (7 days) → prev_from = 2026-04-15, prev_to = 2026-04-22 (also 7 days, immediately preceding).

**Confidence:** HIGH

### Q4 — Supabase RPC ergonomics from `@supabase/supabase-js` v2.101

**Array params from JS:** Pass plain `string[]`. supabase-js sends them as JSON to PostgREST; PostgREST converts to `text[]`. Empty array `[]` arrives at PG as a 0-element `text[]` (NOT `NULL`). `[CITED: supabase-js v2 source — postgrest-js handles array serialization]`

**Empty vs no-filter semantics:** D-17 + Pitfall 2 above. Use `WHERE (cardinality(p_users) = 0 OR user_email = ANY(p_users))`. The function default `p_users text[] default array[]::text[]` makes "argument absent" equivalent to "empty array."

**TypeScript signature after `npm run db:types`:** Once the migration lands and types regen, `Database['public']['Functions']['get_event_volume_daily']` will look like:
```typescript
{
  Args: { p_from: string; p_to: string; p_users?: string[]; p_versions?: string[]; p_bucket?: string }
  Returns: { bucket_start: string; event_type: string; event_count: number }[]
}
```
`[ASSUMED: based on supabase/cli type generation behavior; will be confirmed by running `npm run db:types` after the migration]`

**Pre-regen typing strategy:** Before types regen lands, hand-write a `types.ts` next to `queries.ts` mirroring the SQL `RETURNS TABLE` shape. After regen, swap to `Database['public']['Functions'][...]['Returns']` and delete the local types. This unblocks parallel hook-writing while the migration is being reviewed.

**Security model:** Default `SECURITY INVOKER` is the right call. The existing `analytics_admin_select` policy gates reads; an RPC running as INVOKER inherits the calling JWT's role context, so an authenticated admin's RLS check passes, anon and non-admin authenticated get zero rows. `[VERIFIED: postgresql.org/docs § sql-createfunction — "SECURITY INVOKER ... is the default"]`

**Confidence:** HIGH

### Q5 — Postgres SQL patterns for the four aggregation functions

**`get_event_volume_daily`** — Pattern 1 above. Uses `LEFT JOIN generate_series` × `unnest(types)` to produce zero-cell rows. `LANGUAGE sql STABLE`.

**`get_kpi_totals`** — Pattern 2 above. Single round trip per render returns current_count, previous_count, AND sparkline (jsonb array of `{x,y}` objects) per event_type. The previous-period window is computed inside the function from `p_from` and `(p_to - p_from)`. Sparkline buckets respect `p_bucket` (D-08).

**`get_error_rate_by_type`** sketch:
```sql
create or replace function public.get_error_rate_by_type(
  p_from timestamptz, p_to timestamptz,
  p_users text[] default array[]::text[],
  p_versions text[] default array[]::text[]
) returns table (event_type text, errors bigint, total bigint, rate numeric)
language sql stable security invoker as $$
  with scoped as (
    select event_type, error_message
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in ('catalog_single','catalog_batch','portal_upload',
                         'spreadsheet_transform','data_import')
      and created_at >= p_from and created_at < p_to + interval '1 day'
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select event_type,
         count(*) filter (where error_message is not null)::bigint as errors,
         count(*)::bigint as total,
         case when count(*) = 0 then 0
              else round(count(*) filter (where error_message is not null)::numeric
                         / count(*)::numeric, 4)
         end as rate
  from scoped
  group by event_type
  order by event_type;
$$;
```

**`get_per_user_summary`** sketch:
```sql
create or replace function public.get_per_user_summary(
  p_from timestamptz, p_to timestamptz,
  p_users text[] default array[]::text[],
  p_versions text[] default array[]::text[]
) returns table (
  user_email_label text,
  catalog_single bigint, catalog_batch bigint, portal_upload bigint,
  spreadsheet_transform bigint, data_import bigint,
  total_errors bigint,
  last_seen_at timestamptz
)
language sql stable security invoker as $$
  with scoped as (
    select coalesce(user_email, 'Unknown') as user_email_label,    -- D-04
           event_type, error_message, created_at
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in ('catalog_single','catalog_batch','portal_upload',
                         'spreadsheet_transform','data_import')
      and created_at >= p_from and created_at < p_to + interval '1 day'
      and (cardinality(p_users)    = 0 or coalesce(user_email,'Unknown') = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select user_email_label,
         count(*) filter (where event_type = 'catalog_single')::bigint        as catalog_single,
         count(*) filter (where event_type = 'catalog_batch')::bigint         as catalog_batch,
         count(*) filter (where event_type = 'portal_upload')::bigint         as portal_upload,
         count(*) filter (where event_type = 'spreadsheet_transform')::bigint as spreadsheet_transform,
         count(*) filter (where event_type = 'data_import')::bigint           as data_import,
         count(*) filter (where error_message is not null)::bigint            as total_errors,
         max(created_at) as last_seen_at
  from scoped group by user_email_label
  order by last_seen_at desc;
$$;
```

**Dev-panel RPCs (D-07):** Two separate `get_cancellation_rate_w2()` and `get_cancellation_rate_w3()` (or one parameterized) returning `(numerator bigint, denominator bigint, rate numeric)` scoped to `event_type = 'catalog_batch'` and `'portal_upload'` respectively. Treat `cancelled IS NULL` as `false` (denominator counts; numerator only counts `cancelled = true`).

**Bucket completeness recommendation:** Use `generate_series` for EXT-01 (visual gaps in stacked bar are bad). Skip `generate_series` for EXT-02 sparklines if every event_type has data (the sparkline is decorative; minor gaps OK). For empty event types in EXT-02, fall back to `[]` and let `<Sparkline data={[]}>` render nothing (Phase 1 already handles empty array).

**`STABLE` vs `IMMUTABLE` vs `VOLATILE`:** STABLE. Read-only, but result depends on table contents (which can change between transactions, so not IMMUTABLE). `[VERIFIED: postgresql.org/docs § xfunc-volatility]`

**`LANGUAGE sql` vs `plpgsql`:** sql. Better optimizer visibility, no plan caching overhead, simpler. The PG docs explicitly recommend `LANGUAGE sql` for read-only aggregations. `[VERIFIED: postgresql.org/docs]`

**Confidence:** HIGH

### Q6 — TanStack Query queryKey for URL-driven filters

**Canonical key shape:**
```typescript
['extension', kindLiteral, {
  from: from.toISOString(),
  to: to.toISOString(),
  users: [...users].sort(),       // sorted!
  versions: [...versions].sort(), // sorted!
  bucket,                         // 'day' | 'hour' (only on EventVolume + KpiTotals)
}]
```

**Why a 3rd-position object:** TanStack does deep structural equality on keys. An object lets two hooks share a cache namespace (`['extension', 'eventVolume', ...]` and `['extension', 'kpiTotals', ...]`) without colliding. Adding/removing filter dimensions later doesn't bust unrelated caches.

**Sorting arrays is mandatory.** TanStack treats `['a','b']` and `['b','a']` as different keys. If a user multi-selects in different orders, you get redundant network traffic and split caches. `[...arr].sort()` before placing into the key.

**Cache sharing across hooks:** Two hooks can read the SAME filter set (`useEventVolume()` and `useKpiTotals()` will both observe `from/to/users/versions`). If both produce keys with the same first two slots and identical filter object, they hit the same cache key — but they shouldn't, because they're calling different RPCs. Differentiate the second slot (`'eventVolume'` vs `'kpiTotals'`).

**Filter change → automatic invalidation:** Because filters are part of the queryKey, any change creates a new key, fires a new query, and invalidates nothing (just doesn't read the old cache). TanStack will GC the old cache after `gcTime` (default 5min). No manual `invalidateQueries` needed for filter changes — only for the live-feed Resume case (Q2).

**Confidence:** HIGH

### Q7 — TanStack Table v8 sorting/filtering for EXT-04 and EXT-05

**Library:** `@tanstack/react-table@^8.21.3` (latest stable; v9 is alpha). `[VERIFIED: npm view 2026-04-29]`

**APIs to use:** `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel` (only if we want client-side text filter on Recent Errors), `flexRender`, `ColumnDef`, `SortingState`, `ColumnFiltersState`. `[CITED: tanstack.com/table/v8/docs § React example]`

**Wide vs long for EXT-04:** CONTEXT picks wide (5 event-type columns). Wide is the right choice for a table because each row is one user, columns are stable, sorting "by total" is sortable. Long form (one row per user × event_type) would explode rows and make sorting confusing.

**Reuse Phase 1 SortIndicator:** It accepts `state: 'asc' | 'desc' | false` which matches `header.column.getIsSorted()`. Wire as `<SortIndicator state={(h.column.getIsSorted() as 'asc'|'desc'|false) ?? false} />`. No fork.

**Reuse FilterInput for Recent Errors free-text filter:** If Plan adds a search box over error_message, FilterInput is controlled, has Esc-clear, and pairs with `column.setFilterValue`.

**Tailwind styling:** Headless = no styles. We supply Tailwind classes ourselves. Default row height matches v1.0's 44px (`h-11`) per UI-SPEC. Use the same divide pattern as `<TableSkeleton>`.

**Server-side vs client-side sorting:** Phase 2 keeps it client-side. Per-user table has ~5 users; recent errors is `LIMIT 100`. No reason to round-trip sort changes.

**Confidence:** HIGH

### Q8 — Empty-state architecture (D-19)

**Where the gate sits:** In `<ExtensionPage>` itself, NOT in a router loader. React Router 7's `loader` pattern is for data that must arrive before the route mounts; we want a render-then-gate (with skeleton during the brief probe).

**Why not per-chart:** N+1 effect — every chart hook would fire an empty-state probe. Single page-level branch is correct.

**Interaction with React Router loaders:** None needed. React Router 7 routes can have loaders (`loader: async () => ...`) but Phase 1 didn't adopt that pattern (everything mounts and fetches via TanStack Query). Phase 2 follows suit. `[VERIFIED: src/App.tsx — no loaders defined]`

**`staleTime: Infinity` + `gcTime: Infinity`:** Once probe resolves, never refetch and never garbage-collect. Single network call per session. CONTEXT § Deferred — "Empty-state polling" — is explicitly accepted: if the extension ships mid-session, user refreshes.

**Page tree:**
```
<ExtensionPage>                            ← branches on gate
   case loading: <skeleton />
   case empty:   <EmptyState />            ← page is DONE; no other components mount
   case ready:   <ExtensionPageContent />  ← real page
       <DateRangeFilter /> + <UserFilter />
       <KpiStrip />
       <EventVolumeChart />
       <ErrorRateChart />
       <PerUserTable />
       <RecentErrorsTable />
       <LiveEventFeed />
       <DeveloperPanel />                  ← gated by isDevAccount
```

**`useExtensionGate` MUST scope by app_source:** `eq('app_source', 'tpc-extension')`. Otherwise legacy NULL-source rows could mask the empty state. Code in Pattern 5 above.

**Confidence:** HIGH

### Q9 — isDevAccount + DeveloperPanel composition

**Reactive consumption:** `const email = useAuthStore(s => s.profile?.email);`. Zustand subscribes the selector; when `profile` changes (login/logout/profile change mid-session), the panel re-renders. The selector is stable (returns the same email string for unchanged profile object).

**Allowlist semantics:**
- Case-insensitive: emails are case-insensitive per RFC 5321. Compare `.toLowerCase()` on both sides.
- Trim whitespace? No — `profile.email` from Supabase auth is already trimmed.
- Null safe: `if (!email) return false`.

**Collapsed by default (D-15):** Local state inside `<DeveloperPanel>`: `const [open, setOpen] = useState(false);`. No URL persistence (devs can re-collapse on next visit; not load-bearing).

**Composition with EXT-05 row click (D-18):**
- `<RecentErrorsTable>` accepts an `onRowClick?: (row) => void` prop.
- The PARENT (page or DeveloperPanel) decides what to pass:
  - Admin (always-rendered table): `onRowClick={undefined}` → `<RecentErrorsTable>` renders rows without cursor-pointer styling and the `<tr>` has no onClick.
  - Dev (allowlisted): `onRowClick={(row) => setPayloadModal({ open: true, payload: row.items_content })}`. The table is the SAME instance; it's the parent that passes a click handler when in dev mode.
- **Important:** the table itself is NOT duplicated. There's ONE `<RecentErrorsTable>` mounted. The conditional is on the prop, decided at the page level by `isDevAccount(email)`.

**Composition with EXT-08 row click (D-18):** Same pattern. `<LiveEventFeed onRowClick={...}>` accepts the optional handler.

**Confidence:** HIGH

### Q10 — Validation Architecture (covered above)

See dedicated **Validation Architecture** section. The key tests:
- **app_source filter invariant (EXT-D-01):** static SQL grep on the migration file PLUS an integration test that seeds a row with `app_source = NULL` and asserts no chart query returns it.
- **catalog_item exclusion (EXT-D-02):** integration test seeds a `catalog_item` row plus a `catalog_batch` parent; asserts `get_event_volume_daily` returns count of 1 (parent only) for `catalog_batch` event_type, and zero rows with `event_type = 'catalog_item'`.
- **previous-period math (EXT-D-05):** unit test against `get_kpi_totals` with fixed fixtures; `from = 2026-04-22T00:00:00-04`, `to = 2026-04-29T00:00:00-04`; assert `previous_count` equals the number of seeded events in `[2026-04-15, 2026-04-22)`.
- **bucketing TZ (EXT-D-13):** seed event at `2026-03-08T03:30:00Z` (= 22:30 ET 2026-03-07); assert `get_event_volume_daily` puts it into bucket `2026-03-07T05:00:00+00:00` (= midnight ET 2026-03-07), NOT 2026-03-08.
- **dev-panel gating (EXT-D-15):** render `<DeveloperPanel>` with auth-store mock setting `profile.email = 'admin@example.com'` → assert `queryByTestId('developer-panel')` is null. Switch to `'josh@potomackco.com'` → re-render → assert non-null.
- **empty-state gate (EXT-D-19):** mock `useExtensionGate` to return `{ isLoading: false, isEmpty: true }`; render `<ExtensionPage>`; assert `<EmptyState>` is the only thing rendered (no chart testids in DOM).
- **refetchInterval pause/resume:** Vitest fake timers; assert immediate refetch after Resume click.
- **URL filter round-trip:** render `<UserFilterMultiSelect>` inside a MemoryRouter with initial URL `?users=a@x.com,b@y.com`; assert `useUserFilter().users` returns `['a@x.com','b@y.com']`. Then call `setUsers(['c@z.com'])`; assert URL updates to `?users=c@z.com`.

**Confidence:** HIGH

---

## Recommended Plan Decomposition

The planner can adopt or modify. Each plan is sized to 1-3 deliverable files + tests + a clear "this proves X" gate.

### Plan 02-01: SQL — Six RPCs, types regen
**Outputs:**
- `supabase/migrations/<ts>_create_extension_rpcs.sql` — all 4 admin + 2 dev-panel RPCs (Patterns 1, 2, + sketches in Q5).
- `npm run db:push` against shared-prod, then `npm run db:types` regenerates `src/db/database.types.ts`.
- `scripts/verify-extension-app-source-scope.mjs` — static grep over the migration: every aggregation/select MUST contain `app_source = 'tpc-extension'`. Wired to `prebuild` or invoked as a verification step.
**Gate:** all 6 RPCs callable from a sample admin session; static grep verifier exits 0; types regen committed.
**Requirements:** EXT-01..04, EXT-09, EXT-10 (back-end half).

### Plan 02-02: URL filter hooks + dev-access utility
**Outputs:**
- `src/hooks/extension/useUserFilter.ts` + `.test.ts` — reads/writes `?users=`.
- `src/hooks/extension/useVersionFilter.ts` + `.test.ts` — reads/writes `?versions=`.
- `src/lib/devAccess.ts` + `.test.ts` — `isDevAccount(email)`.
**Gate:** colocated tests pass; URL round-trip proven for both filters; dev-access semantics tested for null/empty/case.
**Requirements:** EXT-07 (user filter half), EXT-09 (version filter — input lives in DeveloperPanel later), D-16 prep.

### Plan 02-03: Query/RPC service + per-RPC hooks
**Outputs:**
- `src/services/extension/queries.ts` — all `.from()` and `.rpc()` builders with JSDoc invariant warning. (~150 LoC)
- `src/hooks/extension/{useEventVolume,useKpiTotals,useErrorRate,usePerUserSummary,useRecentErrors,useLiveFeed,useExtensionGate,useDominantVersion,useCancellationRates}.ts` — each ~30 LoC, each with colocated test mocking the service layer to assert queryKey shape + filter folding.
**Gate:** all hook tests pass; queryKey shape verified per hook; pause/resume mechanics proven for `useLiveFeed` with fake timers (EXT-D-08); previous-period math proven (EXT-D-05) via a service-layer test calling the real RPC against a fixture-seeded dev DB OR via a SQL fixture file.
**Requirements:** EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-08, EXT-09, EXT-10 (data layer for all of them).

### Plan 02-04: Page shell + empty gate + nav entry
**Outputs:**
- `src/pages/Extension.tsx` — empty-gate branching, layout, `<DateRangeFilter>` + `<UserFilterMultiSelect>` row, mount slots for KPI strip / chart row / table row / live feed row / DeveloperPanel.
- `src/components/extension/UserFilterMultiSelect.tsx` — multi-select consuming `useUserFilter` (small new component; not a kit primitive).
- `src/App.tsx` — add `<Route path="/extension" element={<ExtensionPage />} />`.
- `src/layouts/DashboardLayout.tsx` — add first NAV_ITEMS entry: `{ label: 'Extension', to: '/extension', Icon: ... }` (simple SVG, per Claude's Discretion).
- `src/pages/Extension.test.tsx` — empty-state test (EXT-D-19), layout assembly test.
**Gate:** page test proves empty-gate branching; nav entry visible; page renders without errors when gate is `ready`.
**Requirements:** EXT-07 (date filter wired), Phase 2 success criterion #6 (empty state).

### Plan 02-05: KPI strip + EventVolume chart + ErrorRate chart
**Outputs:**
- `src/components/extension/KpiStrip.tsx` + `.test.tsx` — composes 5 `<KpiCard>` from `useKpiTotals` data + `<Sparkline>` per card; computes delta direction with semantic-neutrality awareness.
- `src/components/extension/EventVolumeChart.tsx` + `.test.tsx` — Recharts stacked bar; pivot helper; range-aware tickFormatter (`useTimezone` wired).
- `src/components/extension/ErrorRateChart.tsx` + `.test.tsx` — Recharts horizontal bar (BarChart layout='vertical').
**Gate:** all three components render under JSDom mock; tickFormatter verified for daily and hourly bucket; KpiCard delta direction set correctly when delta is positive/negative/zero; horizontal bar renders 5 bars one per event_type.
**Requirements:** EXT-01, EXT-02, EXT-03.

### Plan 02-06: Per-user table + Recent Errors table + payload viewer wiring
**Outputs:**
- `npm install @tanstack/react-table@^8.21.3`
- `src/components/extension/PerUserTable.tsx` + `.test.tsx` — TanStack Table, sortable, "Unknown" bucket present.
- `src/components/extension/RecentErrorsTable.tsx` + `.test.tsx` — sortable; accepts optional `onRowClick`; admin no-op vs dev-payload-open.
- Wire `<PayloadViewerModal>` open state lifted into `<ExtensionPage>` (or local to RecentErrorsTable + LiveEventFeed pair).
**Gate:** sort works on both tables; "Unknown" appears for null user_email; admin row click is no-op; dev row click opens modal with `items_content`.
**Requirements:** EXT-04, EXT-05, EXT-06.

### Plan 02-07: Live event feed + Pause/Resume
**Outputs:**
- `src/components/extension/LiveEventFeed.tsx` + `.test.tsx` — consumes `useLiveFeed`; Pause/Resume button; row click shares dev-gate logic with RecentErrorsTable.
**Gate:** fake-timer test proves 10s polling; Pause stops polling; Resume jumps to "latest right now" (Pitfall 4 + EXT-D-08).
**Requirements:** EXT-08.

### Plan 02-08: DeveloperPanel + dev-only EXT-09 controls + EXT-10 cancellation KPIs
**Outputs:**
- `src/components/extension/DeveloperPanel.tsx` + `.test.tsx` — gated by `isDevAccount(profile.email)`; collapsible.
- `src/components/extension/ExtensionVersionFilter.tsx` + `.test.tsx` — multi-select on extension_version; consumes `useVersionFilter`.
- `src/components/extension/DominantVersionBadge.tsx` + `.test.tsx` — consumes `useDominantVersion`; tie-breaks by latest semver.
- `src/components/extension/CancellationRateKpis.tsx` + `.test.tsx` — two `<KpiCard>` reading `useCancellationRates`.
**Gate:** dev-only render proven (EXT-D-15); version filter affects ALL charts via shared URL-driven filter; dominant-version badge updates on filter change; cancellation rate math correct for non-zero denominators and zero denominators.
**Requirements:** EXT-09, EXT-10, D-15/D-16/D-18.

### Optional Plan 02-09: visual polish + UAT smoke
- Cross-cutting: ensure error-state buttons retry the right `useQuery`; ensure empty-state copy is final; visual eyeball at `/extension` against a seeded dev project.

---

## Open Questions for Planner

1. **Should `useExtensionGate` use `staleTime: Infinity` literal, or a finite (e.g., 1h) staleTime?** D-19 says Infinity. Accepted trade-off (CONTEXT § Deferred). Just confirm with planner that the trade-off is locked.

2. **Where does the `<PayloadViewerModal>` open-state live?** Two reasonable choices: (a) lifted to `<ExtensionPage>` so both `<RecentErrorsTable>` and `<LiveEventFeed>` invoke a single shared modal; (b) one modal per table, local state. Recommendation: (a) — single modal, lifted, fewer DOM dialogs. Plan 02-06 should make this call.

3. **Hourly bucketing for `range = 'today'`:** Add `p_bucket text default 'day'` argument to `get_event_volume_daily` and `get_kpi_totals`, OR ship a sibling `get_event_volume_hourly`? Recommendation: `p_bucket` arg — fewer RPCs, branching is one `case` expression. Plan 02-01 makes this call.

4. **Cancellation rate for `cancelled IS NULL`:** D-07 says NULL counts toward denominator (means "not cancelled"). Confirm: numerator only counts `cancelled = true`, denominator counts ALL rows of that event_type. The SQL is `count(*) filter (where cancelled = true) / count(*)`. If denominator is 0, return 0 (don't divide).

5. **Dominant-version tie-breaker:** D-06 says "ties broken by latest semver." Postgres has no native semver type. Use `string_to_array(version, '.')::int[]` for natural ordering; fallback to lexicographic if version strings have non-numeric suffixes. Plan 02-08 needs to handle malformed versions ("2.0.1-beta") — recommend lexicographic-ASC fallback with a comment.

6. **Recent Errors table cap:** Claude's Discretion = 100. Plan 02-06 confirms 100; revisit only if UAT proves it too low.

7. **Per-user table column shape:** Claude's Discretion = pivot wide (5 columns). Plan 02-06 confirms; if visual cramping happens, fall back to "Total + popover-on-hover for breakdown" (deferred).

8. **`<UserFilterMultiSelect>` UX:** Multi-select dropdown? Comma-separated chips? Recommendation: dropdown with checkbox list of distinct `user_email` values from the active range, plus a "Unknown" entry for NULL. Source the list via a thin RPC (`get_distinct_users`) OR derive from `usePerUserSummary` data already in cache. Plan 02-04 makes the call.

9. **Should the version filter input also live in the admin surface (visible to admins)?** D-17 says no — version control is dev-only. Admins inheriting a `?versions=` URL still see filtered charts but no UI to clear. Confirmed acceptable (D-17). If admins find this confusing in UAT, the fix is to surface a small "Versions: 2.0.1, 2.0.2 (set by URL)" badge on the admin surface; defer.

10. **Visual verification checkpoint:** Phase 1 plan 01-06 ended with operator visual verification at `/kit`. Phase 2 should include an analogous step — operator verifies `/extension` against a populated test dataset before phase verification. Plan 02-09 is the natural place.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @tanstack/react-table | EXT-04, EXT-05 | ✗ (not yet installed) | — | npm install (no fallback needed) |
| recharts | EXT-01, EXT-02, EXT-03 | ✓ | 3.8.1 | — |
| @tanstack/react-query | every hook | ✓ | 5.99.2 | — |
| @supabase/supabase-js | every hook | ✓ | 2.101.1 | — |
| date-fns / date-fns-tz | bucket formatting | ✓ | 4.1.0 / 3.2.0 | — |
| Supabase shared project (analytics_events table) | every query | ✓ | live | — |
| `private.is_admin()` helper | RLS gate | ✓ | shipped Phase 1 | — |
| `analytics_admin_select` RLS policy | every query | ✓ | shipped Phase 1 | — |
| Supabase CLI (`supabase db push`, `supabase gen types`) | RPC migration | ✓ | 2.81.3 | — |
| Vitest + jsdom | tests | ✓ | 4.0.18 / 28.1.0 | — |
| `prebuild` guard | build | ✓ | shipped Phase 1 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Security Domain (ASVS)

`security_enforcement` is not explicitly disabled in `.planning/config.json`, so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuses Supabase auth from Phase 1; no new auth surface. `<ProtectedRoute>` already gates `/extension`. |
| V3 Session Management | yes | Reuses Supabase session lifecycle (Phase 1 authStore); no changes. |
| V4 Access Control | yes | Two layers: (1) DB layer — `analytics_admin_select` RLS policy via `private.is_admin()`. (2) UI layer — `<DeveloperPanel>` gated by `isDevAccount(email)` allowlist. The UI gate is defense-in-depth; the DB gate is authoritative. |
| V5 Input Validation | yes | RPC args are typed `timestamptz`, `text[]` — Postgres validates type. `email` strings into `isDevAccount` are bounded by Supabase's auth-time email validation. JSON payloads displayed in `<PayloadViewerModal>` are stringified via `JSON.stringify` (no eval). No user-input-to-SQL concatenation anywhere — all queries use `.eq`, `.in`, `.rpc` with parameterized args. |
| V6 Cryptography | no | No crypto operations in this phase. JWTs and RLS handled by Supabase platform. |
| V7 Error Handling | yes | Per-card `<ErrorState>` (D-21); never surfaces SQL error messages directly to user. RPC errors thrown in service layer; hooks `throw error` → TanStack Query `error` state → `<ErrorState>` renders generic message. |
| V8 Data Protection | yes | No PII beyond `user_email` (which is a TPC team member's work email) and `extension_version`. No financial data. `items_content` may contain auction-item details — restricted by admin-SELECT RLS so non-admins can never read it. The dev panel exposes `items_content` view; trade-off documented in D-15. |
| V9 Communications | yes | All Supabase traffic over HTTPS by default (`createClient` enforces). No new endpoints. |
| V10 Malicious Code | n/a | — |
| V11 Business Logic | yes | The cancellation-rate denominator includes `cancelled IS NULL` (D-07) — confirm with stakeholders that this is the intended business rule (it is — legacy rows pre-cancelled-column count as "not cancelled"). |
| V12 Files | n/a | No file uploads/downloads in this phase. |
| V13 API | yes | RPC names + arg types documented in `database.types.ts` after regen. PostgREST auto-exposes — `grant execute on function ... to authenticated` is the access boundary. |
| V14 Configuration | yes | Service-role key still gated by Phase 1 prebuild guard — Phase 2 cannot regress this. |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter values | Tampering | All filter values pass through supabase-js's `.eq` / `.in` / `.rpc` parameterized layer. No string concatenation. |
| RLS bypass via RPC | Elevation | RPCs use `SECURITY INVOKER` (Postgres default). Calling user's RLS still applies. `analytics_admin_select` gates non-admins to zero rows. |
| Service-role key leak into bundle | Information Disclosure | Phase 1 prebuild guard (`scripts/check-no-service-role-in-src.mjs`) stays in place. Phase 2 frontend code only imports from `src/lib/supabase.ts` (anon). |
| Allowlist email comparison case-mismatch | Elevation | `isDevAccount` lowercases both sides. |
| Stale gate caching obscures genuinely empty state | Information Disclosure (false negative) | `useExtensionGate` scopes by `app_source` — legacy NULL-source rows can't false-positive the gate. |
| URL `?versions=` filter manipulation by admin | n/a (admin can already see everything) | Filter only narrows visible data; can't reveal more than RLS already allows. |
| `<PayloadViewerModal>` displaying secrets in `items_content` | Information Disclosure | Dev-panel gated. The modal's pretty-print is a `<pre>` with text content (JSX auto-escapes); no XSS risk. |
| Live feed polling DDoS Supabase | Denial of Service (self-inflicted) | 10-second interval at slow end of spec; pause button; tab-background pause via TanStack default `refetchIntervalInBackground: false`. |

---

## Sources

### Primary (HIGH confidence)

- **PostgreSQL 17 official docs § functions-datetime (`date_trunc` 3-arg form)** — https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-TRUNC `[VERIFIED via WebFetch 2026-04-29]`
- **PostgreSQL 17 official docs § functions-array (cardinality vs array_length on empty)** — https://www.postgresql.org/docs/current/functions-array.html `[VERIFIED via WebFetch 2026-04-29]`
- **PostgreSQL 17 official docs § sql-createfunction (SECURITY INVOKER default)** — https://www.postgresql.org/docs/current/sql-createfunction.html `[VERIFIED via WebFetch 2026-04-29]`
- **PostgreSQL 17 official docs § xfunc-volatility (STABLE for read-only aggs)** — https://www.postgresql.org/docs/current/xfunc-volatility.html `[VERIFIED via WebFetch 2026-04-29]`
- **Recharts Context7 (`/recharts/recharts`) — stacked bar with stackId, XAxis tickFormatter** `[VERIFIED via ctx7 CLI 2026-04-29]`
- **TanStack Query Context7 (`/tanstack/query`) — refetchInterval function form, invalidateQueries refetchType** `[VERIFIED via ctx7 CLI 2026-04-29]`
- **TanStack Query official polling docs** — https://tanstack.com/query/latest/docs/framework/react/guides/polling `[CITED]`
- **TanStack Query QueryClient invalidateQueries** — https://tanstack.com/query/latest/docs/reference/QueryClient `[CITED]`
- **TanStack Table v8 latest docs** — https://tanstack.com/table/latest/docs/framework/react/react-table `[VERIFIED via WebFetch — confirms `useReactTable` API in v8 stable]`
- **npm registry: @tanstack/react-table dist-tags** — `npm view @tanstack/react-table dist-tags` `[VERIFIED 2026-04-29: latest = 8.21.3]`
- **npm registry: recharts version** — `npm view recharts version` `[VERIFIED 2026-04-29: 3.8.1]`
- **npm registry: @tanstack/react-query version** — `npm view @tanstack/react-query version` `[VERIFIED 2026-04-29: 5.100.6]`

### Secondary (MEDIUM confidence)

- **Supabase RPC docs** — https://supabase.com/docs/reference/javascript/rpc and https://supabase.com/docs/guides/database/functions `[CITED — partial; supplemented by Postgres docs for the missing detail]`
- **Supabase RLS view security_invoker** — https://supabase.com/docs/guides/database/postgres/row-level-security `[CITED]`
- **DEV.to: supabase RPC typing helpers (jsonb fields)** — https://dev.to/omills/supabase-helper-for-better-rpc-function-typing-with-jsonb-fields-1ok5 `[VERIFIED via WebSearch — community pattern for handling jsonb returns]`

### Tertiary (LOW confidence — flagged for validation)

- **(none)** — every claim above is either Postgres-official, TanStack-official, or Phase 1 codebase-verified. No LOW-confidence claims in this research.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Database['public']['Functions']['get_event_volume_daily']['Args']` will be `{ p_from: string; p_to: string; p_users?: string[]; p_versions?: string[]; p_bucket?: string }` after `npm run db:types` | Q4 | Low — if shape differs, hooks adjust during plan 02-03; nothing else depends. |
| A2 | An empty array `[]` from JS arrives at PG as `array[]::text[]` (not NULL) | Q4 | Low — if it arrives as NULL, `coalesce(cardinality(p_users), 0) = 0` belt-and-braces handles both. |
| A3 | TanStack Query v5's `invalidateQueries` with default `refetchType: 'active'` triggers an immediate refetch for any active observer of that key | Pattern 4 / Q2 | Low — confirmed in Context7 docs; if it doesn't behave as expected, fallback is `query.refetch()`. |
| A4 | The dev-allowlist `josh@potomackco.com` is the user's TPC work email and matches what Supabase auth returns | D-16 | Low — if it differs (e.g., Google OAuth returns a different mailbox), dev panel doesn't render and we update the allowlist; observable in 1 minute of UAT. |
| A5 | TanStack Table v8 sort indicators line up with Phase 1's `<SortIndicator state>` accepting `'asc'|'desc'|false` | Q7 | Low — `header.column.getIsSorted()` returns exactly `'asc'|'desc'|false` per v8 docs. |

**If this table seems short:** It is. Most claims are Postgres-official or directly verified against the Phase 1 codebase. The five A1-A5 items are surface-level integration assumptions with cheap fallbacks.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified against npm registry today
- Architecture (RPC patterns, queryKey shape, gate placement): HIGH — Postgres-official + TanStack-official sources
- Pitfalls: HIGH — verified across Postgres docs (date_trunc, cardinality), TanStack docs (refetchInterval), and Phase 1 codebase
- Recharts JSDom mock for stacked variants: HIGH — Phase 1 pattern verified by reading `Sparkline.test.tsx`
- Validation Architecture: HIGH — every test maps to a documented decision

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (Recharts/TanStack release cadence is monthly; re-verify version pins at that point)
