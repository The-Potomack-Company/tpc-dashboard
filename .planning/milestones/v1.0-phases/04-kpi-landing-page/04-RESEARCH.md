# Phase 4: KPI Landing Page - Research

**Researched:** 2026-04-22
**Domain:** React dashboard landing page — Postgres aggregation RPC, TanStack Query v5, period-over-period delta math, Tailwind v4 segmented control
**Confidence:** HIGH — every recommendation is either already present in the repo (Phases 1–3 patterns) or verified via current TanStack Query v5 docs and Postgres documentation.

## Summary

Phase 4 is a small, highly-constrained phase: one route (`/`), one new Postgres RPC (`kpi_summary`), one new hook (`useKpiSummary`), one pure-function lib (`src/lib/period.ts`), one new `format.ts` helper (`formatDelta`), and seven new components. CONTEXT.md and 04-UI-SPEC.md lock essentially every design and implementation decision. The remaining research questions are narrow:

1. What's the correct Postgres function body for `kpi_summary(period_start, period_end, compare_start, compare_end) returns jsonb`?
2. How do I compute `{current, previous}` date bounds for YTD / L6M / L12M in JS?
3. What does the `useKpiSummary` hook look like under TanStack Query v5 (which removed `keepPreviousData` as an option)?
4. What's the shape-validation story for a JSONB RPC response (Zod)?

**Primary recommendation:** Use a single `security definer` RPC that runs two CTEs (one per window) and returns them combined as `jsonb_build_object`. Guard weighted sell-through with `NULLIF(SUM(lots_auctioned), 0)` to avoid divide-by-zero. In the hook, use `placeholderData: keepPreviousData` (the v5 migration path for the old `keepPreviousData: true` flag) so period flips don't flash skeletons. Validate the RPC payload with a Zod schema — the generated `database.types.ts` types RPC returns as generic `Json`, so validation is the only way to narrow the shape.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**KPI Scorecards (KPI-01, KPI-02)**
- 4 metrics in fixed order:
  1. **Total revenue** — `SUM(net_revenue)` over period
  2. **Avg sell-through rate** — `SUM(lots_sold) / SUM(lots_auctioned)` (weighted by lots, not arithmetic mean of per-sale rates)
  3. **Total lots sold** — `SUM(lots_sold)`
  4. **Total sales count** — `COUNT(*)` sales in period
- Default period: **Last 12 months rolling** (`sale_date >= now() - interval '12 months'`)
- Compare period: **Previous 12 months** (`sale_date >= now() - interval '24 months' AND sale_date < now() - interval '12 months'`)
- Period selector: segmented control with 3 options — YTD, L6M, L12M (default L12M)
- Change indicator: arrow + percentage. `▲ 12.4%` when current > previous (green), `▼ 8.1%` when current < previous (red), `—` / gray when previous period has no sales (no baseline)
- Colors: use Tailwind `green-600` / `red-600` + `gray-500` — NOT Phase 1 accent. Accent reservation from Phase 1 UI-SPEC remains intact.
- Data source: **Single Supabase RPC** `public.kpi_summary(period_start date, period_end date, compare_start date, compare_end date) returns jsonb`. Returns `{ current: { revenue, sell_through, lots_sold, sales_count }, previous: { ... } }`. Written as a new migration in Wave 1.
- RPC is `security definer`, granted SELECT to authenticated admin (matches Phase 1 RLS pattern)

**Recent Sales Panel (KPI-03)**
- Show 5 most-recent sales (sorted `sale_date DESC`)
- Each rendered as a compact card: sale_number, title, formatted date, net_revenue, sell-through %
- Click/Enter → navigate to `/sales/:saleNumber` (reuse Phase 3 detail page)
- Data source: **Reuse `useSales()`** + `.slice(0, 5)` — shares TanStack Query cache with `/sales` (5-min staleTime). No new hook.
- Empty state: "No sales yet — run the PDF import" (matches Phase 3 SalesTable empty copy verbatim)
- Loading: 5 skeleton cards using the Phase 3 skeleton pattern

**Layout + Routing**
- Replace `src/pages/Dashboard.tsx` placeholder with the full landing page. Keep the component name `Dashboard` to avoid route-table churn.
- Page layout:
  - Page header: "Dashboard" h1 + period selector on the right
  - KPI row: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` (responsive collapse)
  - Recent Sales section below: section heading + 5 cards `grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4`
- Loading strategy: show full skeleton layout while either query pending; avoid layout shift
- Errors: inline `<ErrorState>` (reuse Phase 3 primitive) in each section that fails independently

### Claude's Discretion
- Exact segmented-control styling (Tailwind-native; match Phase 1 input rhythm) — **resolved by 04-UI-SPEC.md** (lines 401–438)
- Whether to memoize period boundaries with `useMemo` vs recompute per render
- Exact weighted-sell-through formula handling when `SUM(lots_auctioned) = 0` (return null, render `—`) — **resolved**: `NULLIF(SUM(lots_auctioned), 0)` in SQL
- Loading vs error precedence when both queries fail — **resolved by 04-UI-SPEC.md**: each section fails independently
- Whether each KPI card is its own component (`<KpiCard label value delta>`) or inline JSX — **resolved by 04-UI-SPEC.md**: extracted component for Phase 5 reuse

### Deferred Ideas (OUT OF SCOPE)
- Custom date ranges (Phase 9 — Custom Charts already covers general range picking)
- Additional KPI tiles (estimate accuracy, bidder counts, revenue per dept) — Phase 5/6
- Trend sparkline on each KPI card — Phase 5
- Per-department KPI drill-downs — Phase 6
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KPI-01 | Landing page shows KPI scorecards: total revenue, average sell-through rate, total lots sold, total sales count | `kpi_summary` RPC computes all 4 metrics server-side (INFR-04 compliance); `KpiCard` component renders each. See "RPC SQL Shape" and "Code Examples → Pattern 1". |
| KPI-02 | KPI scorecards show period-over-period change (arrow up/down with %) | RPC returns both `current` and `previous` windows in one call; `formatDelta(ratio, type)` helper produces `{ glyph, text }` for rendering. See "Delta Math" and "Code Examples → Pattern 4". |
| KPI-03 | Landing page shows the most recent sales with key metrics at a glance | Reuse existing `useSales()` hook + `.slice(0, 5)`; share TanStack Query cache with `/sales`. No new hook. See "Architecture Patterns → Pattern 3". |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Phase 4 Impact |
|-----------|--------|----------------|
| Reuse Supabase auth from TPC App (no separate user management) | CLAUDE.md § Constraints | RPC uses Phase 1 RLS pattern — `security definer` + grant to `authenticated` role (not `anon`) |
| Shared database with TPC App — do not interfere with existing tables | CLAUDE.md § Constraints | Only new migration is `kpi_summary` RPC; no new tables |
| Match TPC App technology stack versions exactly | CLAUDE.md § Version Alignment | No new dependencies in Phase 4 — all packages already in `package.json` |
| Hand-authored Tailwind v4, no shadcn | 04-UI-SPEC.md line 30 + established pattern | Period selector is hand-rolled per UI-SPEC layout spec |
| INFR-04: All financial aggregations happen in PostgreSQL, not JavaScript | REQUIREMENTS.md | `kpi_summary` does `SUM(net_revenue)` server-side; client never sums currency values |
| Forbidden Supabase CLI commands (STATE.md): `supabase db pull`, `supabase db reset --linked` | STATE.md Accumulated Context | Migration delivery uses `supabase db push` only |
| All monetary columns are `numeric(14,2)`; server-side aggregations only | STATE.md Phase 1 decision | RPC aggregates return `numeric`; JSON serialization preserves precision as strings for large values |

## Standard Stack

### Core (no new dependencies — all already in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.99.2 | `useKpiSummary` hook, cache sharing with `useSales` | [VERIFIED: package.json] Already used by `useSales` and `useSale` with identical `staleTime: 5 * 60_000` pattern |
| `@supabase/supabase-js` | ^2.101.1 | `supabase.rpc('kpi_summary', ...)` call | [VERIFIED: package.json] RPC typing via generated `Database['public']['Functions']` |
| `zod` | ^4.3.6 | Validate JSONB response shape post-parse | [VERIFIED: package.json] Already used for PDF-import schemas in Phase 2 |
| `react-router` | ^7.13.1 | `<Link>` wrap on Recent Sales cards | [VERIFIED: package.json] `<Link>` pattern established in Phases 1 + 3 |
| `tailwindcss` | ^4.2.1 | All styling | [VERIFIED: package.json] Phase 1/3 @theme tokens reused |

### Supporting (dev + test)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^4.0.18 | Unit tests for period.ts, format.ts, hooks, components | All new tests go under `src/tests/*.test.{ts,tsx}` per `vite.config.ts` line 19 |
| `@testing-library/react` | ^16.3.2 | Component render + interaction assertions | Use `renderHook` for hooks (see `use-sales.test.tsx:47`), `render` + `screen` for components |
| `@testing-library/user-event` | ^14.6.1 | Keyboard + click simulation for PeriodSelector | Arrow-key navigation test (WAI-ARIA radiogroup pattern) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Single RPC with `current` + `previous` in one JSONB | Two separate RPCs, two hooks | Two round-trips, two loading/error states to juggle, no shared transaction | Use single RPC — CONTEXT.md § Implementation Decisions already locks this |
| JSONB return | `RETURNS TABLE` or composite type | Composite types can't easily express nested `{current: {...}, previous: {...}}` without extra wrapper table; JSONB keeps the shape obvious in SQL + matches how client will consume it | JSONB — per CONTEXT.md |
| TanStack Query v5 `placeholderData: keepPreviousData` | `useDeferredValue` on period state | `keepPreviousData` is the idiomatic pattern [CITED: tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5] | `placeholderData: keepPreviousData` |
| Zod validation of RPC response | Blind `as` cast + runtime prayer | `Database['public']['Functions']['kpi_summary']['Returns']` is typed `Json`, which narrows to nothing useful for downstream consumers [CITED: dev.to/omills/supabase-helper-for-better-rpc-function-typing-with-jsonb-fields-1ok5] | Zod — validates shape AND narrows type in one step |
| New migration timestamp `20260422000000_kpi_summary_rpc.sql` | Edit existing migration | STATE.md Phase 2 lesson: editing an already-pushed migration is a no-op on `supabase db push` — new timestamps only | Create new migration |

**Installation:** None. Phase 4 adds zero dependencies — per CONTEXT.md § Existing Code Insights and 04-UI-SPEC.md § Registry Safety.

**Version verification:** All versions pinned in `package.json` and verified present. No npm registry calls required.

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── components/
│   ├── KpiCard.tsx                      # NEW — display-only scorecard
│   ├── KpiCardSkeleton.tsx              # NEW — shimmer placeholder
│   ├── PeriodSelector.tsx               # NEW — WAI-ARIA radiogroup
│   ├── RecentSalesPanel.tsx             # NEW — wraps heading + grid + states
│   ├── RecentSaleCard.tsx               # NEW — navigable Link-wrapped card
│   └── RecentSaleCardSkeleton.tsx       # NEW — shimmer placeholder
├── hooks/
│   └── useKpiSummary.ts                 # NEW — TanStack Query wrapper for kpi_summary RPC
├── lib/
│   ├── format.ts                        # EDITED — add formatDelta helper
│   └── period.ts                        # NEW — computePeriodBounds pure function
├── pages/
│   └── Dashboard.tsx                    # REWRITTEN — component name preserved
└── tests/
    ├── period.test.ts                   # NEW — YTD/L6M/L12M bounds
    ├── format-delta.test.ts             # NEW (or extend format.test.ts)
    ├── use-kpi-summary.test.tsx         # NEW — mocked supabase.rpc
    ├── kpi-card.test.tsx                # NEW — rendering + delta aria-label
    ├── period-selector.test.tsx         # NEW — keyboard radiogroup
    ├── recent-sales-panel.test.tsx      # NEW — loading/empty/error states
    ├── recent-sale-card.test.tsx        # NEW — link target + truncation
    └── dashboard-page.test.tsx          # NEW — integration

supabase/migrations/
└── 20260422000000_kpi_summary_rpc.sql   # NEW — kpi_summary RPC migration
```

### Pattern 1: `kpi_summary` RPC SQL Shape

**What:** Single `security definer` Postgres function that computes current + previous window aggregates in one round-trip, returns a nested JSONB object.

**When to use:** Every KPI fetch from `useKpiSummary`.

**Why `security definer`:** Matches Phase 1 / Phase 2 RPC pattern (`import_sale_with_departments`). Because the query is a pure aggregate (no row-level data leaks — just SUM/COUNT totals), and because we still require the caller to be an authenticated admin (via GRANT), `security definer` is safe here. The alternative (`security invoker`) would require the caller to pass RLS checks, which means each row is filtered through `private.is_admin()` — same end result but with more policy-evaluation overhead per aggregate.

**Why `NULLIF(SUM(lots_auctioned), 0)`:** Protects against divide-by-zero when the window has sales but every sale reported `lots_auctioned = 0` (pathological but possible for withdrawn/cancelled sales). Returns `NULL` for the sell-through field, which the client formats as `—`. [CITED: neon.com/postgresql/postgresql-tutorial/postgresql-nullif — "NULLIF is particularly useful for preventing division errors"]

**Why two CTEs instead of one with CASE WHEN:** CTE-per-window is easier to read and lets Postgres pick the index on `sale_date` cleanly. [ASSUMED — performance is not the bottleneck at 457 rows; optimize for readability.]

**Example body:**

```sql
-- Source: adapted from 20260421000011_import_sale_rpc.sql pattern + Phase 1 RLS helper
create or replace function public.kpi_summary(
  period_start   date,
  period_end     date,
  compare_start  date,
  compare_end    date
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with current_window as (
    select
      coalesce(sum(net_revenue), 0)::numeric(14,2)          as revenue,
      sum(lots_sold)::bigint                                 as lots_sold,
      -- weighted sell-through: ratio of sum(lots_sold) / sum(lots_auctioned)
      -- NULLIF guards divide-by-zero → returns NULL → client renders em-dash
      (sum(lots_sold)::numeric / nullif(sum(lots_auctioned), 0))::numeric
                                                              as sell_through,
      count(*)::bigint                                       as sales_count
    from public.sales
    where sale_date >= period_start
      and sale_date <  period_end
  ),
  previous_window as (
    select
      coalesce(sum(net_revenue), 0)::numeric(14,2)          as revenue,
      sum(lots_sold)::bigint                                 as lots_sold,
      (sum(lots_sold)::numeric / nullif(sum(lots_auctioned), 0))::numeric
                                                              as sell_through,
      count(*)::bigint                                       as sales_count
    from public.sales
    where sale_date >= compare_start
      and sale_date <  compare_end
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'revenue',      c.revenue,
      'sell_through', c.sell_through,
      'lots_sold',    coalesce(c.lots_sold, 0),
      'sales_count',  c.sales_count
    ),
    'previous', jsonb_build_object(
      'revenue',      p.revenue,
      'sell_through', p.sell_through,
      'lots_sold',    coalesce(p.lots_sold, 0),
      'sales_count',  p.sales_count
    )
  )
  from current_window c, previous_window p;
$$;

revoke all on function public.kpi_summary(date, date, date, date) from public;
grant execute on function public.kpi_summary(date, date, date, date) to authenticated;

comment on function public.kpi_summary(date, date, date, date) is
  'KPI landing-page aggregate. Returns { current, previous } revenue / sell_through / lots_sold / sales_count. Admin-only via revoked public + granted authenticated + private.is_admin() gate on upstream data.';
```

**Note on `sell_through` NULL semantics:** `nullif(sum(lots_auctioned), 0)` returns NULL when the denominator is 0. `SUM` itself returns NULL when no rows match. Either path → `sell_through IS NULL` → JSONB serializes as `null` → client renders `—`. Zero is a valid lots_sold value (window had sales but no lots sold) and MUST NOT be conflated with NULL.

**Note on `revenue` coalesce:** `COALESCE(SUM(net_revenue), 0)` ensures the field is always a number, never null. A window with zero sales returns `$0.00` — UI-SPEC § KPI error / empty states line 285 locks this: "If current.sales_count === 0, render the four cards with zero values."

**Note on `lots_sold` coalesce at output:** `SUM(lots_sold)` is NULL when no rows match. The `jsonb_build_object` wrapper uses `coalesce(c.lots_sold, 0)` to normalize to 0 so the client sees a number — same contract as `revenue`.

### Pattern 2: Period Bounds (JS, pure function)

**What:** `computePeriodBounds(period: 'ytd' | 'l6m' | 'l12m', now: Date = new Date()): { current: [Date, Date], previous: [Date, Date] }` — returns two half-open intervals.

**Why half-open `[start, end)`:** Matches the SQL `sale_date >= start AND sale_date < end` convention in the RPC. Half-open intervals compose cleanly (current.end === previous-of-next-period's start never double-counts) and match Postgres range-type semantics.

**Why `now` parameter:** Injectable for unit tests — the test can pass `new Date('2026-04-22T12:00:00Z')` and assert deterministic bounds without mocking `Date`.

**Bounds math (ALL using local-TZ `Date` — do NOT use UTC constructors):**

```typescript
// Source: pure JS — no library dependency
export type Period = 'ytd' | 'l6m' | 'l12m';

export interface PeriodBounds {
  current:  { start: Date; end: Date };
  previous: { start: Date; end: Date };
}

export function computePeriodBounds(
  period: Period,
  now: Date = new Date(),
): PeriodBounds {
  if (period === 'ytd') {
    // YTD: [Jan 1 of current year, now). Previous: [Jan 1 last year, Jan 1 this year).
    const currentStart = new Date(now.getFullYear(), 0, 1);
    const previousStart = new Date(now.getFullYear() - 1, 0, 1);
    return {
      current:  { start: currentStart,  end: now },
      previous: { start: previousStart, end: currentStart },
    };
  }
  if (period === 'l6m') {
    // L6M: [now - 6mo, now). Previous: [now - 12mo, now - 6mo).
    const currentStart = addMonths(now, -6);
    const previousStart = addMonths(now, -12);
    return {
      current:  { start: currentStart,  end: now },
      previous: { start: previousStart, end: currentStart },
    };
  }
  // l12m: [now - 12mo, now). Previous: [now - 24mo, now - 12mo).
  const currentStart = addMonths(now, -12);
  const previousStart = addMonths(now, -24);
  return {
    current:  { start: currentStart,  end: now },
    previous: { start: previousStart, end: currentStart },
  };
}

function addMonths(d: Date, n: number): Date {
  const result = new Date(d.getTime());
  result.setMonth(result.getMonth() + n);
  return result;
}
```

**Gotcha — month-end math:** `new Date(2026, 0, 31).setMonth(-6)` becomes `2025-07-31`, but `new Date(2026, 0, 31).setMonth(1)` becomes `2026-03-03` (March 3, not Feb 28/29 — JS rolls over). For our purposes this is acceptable because we pass date-only values to Postgres where the lookup is `sale_date >= start`; a day-or-two shift near month-end doesn't skew a 6- or 12-month rolling window materially. [ASSUMED — acceptable for analytics; document explicitly so future readers know it's intentional.]

**Gotcha — timezone:** JS `Date` is wall-clock in local TZ, but the RPC takes `date` (no TZ). When we serialize via `.toISOString().slice(0, 10)` we'd get UTC date; that's wrong near midnight for US East. **Use a local-date serializer** — see Pattern 4.

### Pattern 3: `useKpiSummary` Hook

**What:** TanStack Query wrapper around `supabase.rpc('kpi_summary', {...})`.

**Why `placeholderData: keepPreviousData`:** TanStack Query v5 removed the `keepPreviousData: true` option and replaced it with `placeholderData: keepPreviousData` (the imported helper). [CITED: tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 — "`keepPreviousData` was removed"]. This lets period changes display the old KPI values while the new ones fetch, matching UI-SPEC § Interaction Contract → "Period change (re-fetch with existing data): Do NOT replace cards with skeletons."

**Why queryKey `['kpi', period]` (not full date strings):** The period enum uniquely identifies the bounds at any given clock time; including `now` would invalidate the cache on every render. If the user stays on the page past midnight, the L12M query's effective bounds shift — TanStack Query will refetch on the next `staleTime` expiry (5 min). Good enough for a dashboard that nobody sits on overnight.

**Example:**

```typescript
// Source: adapted from src/hooks/useSales.ts pattern + TanStack v5 migration docs
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { computePeriodBounds, type Period } from '../lib/period';
import { kpiSummarySchema, type KpiSummary } from '../lib/kpi-schema';

function toIsoDateLocal(d: Date): string {
  // Local-TZ yyyy-mm-dd, NOT d.toISOString() (which is UTC and can drift a day)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useKpiSummary(period: Period) {
  return useQuery<KpiSummary>({
    queryKey: ['kpi', period],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,   // v5 pattern — cards persist on period flip
    queryFn: async () => {
      const bounds = computePeriodBounds(period);
      const { data, error } = await supabase.rpc('kpi_summary', {
        period_start:  toIsoDateLocal(bounds.current.start),
        period_end:    toIsoDateLocal(bounds.current.end),
        compare_start: toIsoDateLocal(bounds.previous.start),
        compare_end:   toIsoDateLocal(bounds.previous.end),
      });
      if (error) throw error;
      // data is typed Json; Zod narrows it to KpiSummary
      return kpiSummarySchema.parse(data);
    },
  });
}
```

### Pattern 4: Zod Schema for RPC Response

**What:** Validates + narrows the JSONB return from `kpi_summary`.

**Why:** After regenerating `src/db/database.types.ts` with `npm run db:types`, the `Returns` type for `kpi_summary` will be `Json` (the generic Supabase JSON type) because Postgres JSONB is opaque to the type generator. [CITED: dev.to/omills/supabase-helper-for-better-rpc-function-typing-with-jsonb-fields-1ok5 — "a metadata field with jsonb will be Json type and not of your custom type"]. Zod gives us (a) runtime shape verification and (b) compile-time type narrowing via `z.infer`.

**Why numeric fields accept `number | string`:** `numeric(14,2)` values that exceed JavaScript's safe integer range are serialized as strings by PostgREST to preserve precision. [CITED: postgrest.org/en/v12/references/api/functions.html]. For revenue values in the low millions this is unlikely, but the schema should be defensive. Conversion to number happens after validation.

```typescript
// Source: src/lib/kpi-schema.ts (new file)
import { z } from 'zod';

// numeric(14,2) may serialize as string when value exceeds JS safe integer
const numericLike = z.union([z.number(), z.string().transform(Number)]);

const windowSchema = z.object({
  revenue:      numericLike,          // never null — COALESCE'd server-side
  sell_through: numericLike.nullable(), // NULL when no lots_auctioned
  lots_sold:    numericLike,          // COALESCE'd server-side
  sales_count:  numericLike,
});

export const kpiSummarySchema = z.object({
  current:  windowSchema,
  previous: windowSchema,
});

export type KpiSummary = z.infer<typeof kpiSummarySchema>;
```

### Pattern 5: Delta Math (format.ts helper)

**What:** `formatDelta(current, previous, type): { glyph, text, direction }` — compute AND format in one place.

**Why a single helper (not separate compute + format):** The UI-SPEC mandates a `pp` suffix for sell-through and `%` for others. Computing the delta separately would force every caller to know which type it is. Centralizing in `formatDelta(current, previous, type)` makes the KPI card call-site uniform.

**Why accept `type`:** UI-SPEC § Copywriting → Delta semantics (lines 249–262) locks **absolute percentage-point math** for the sell-through card and **relative percent-change math** for the other three. This is a hard rule — do not invent a general "auto-detect" heuristic.

**Why return `direction` (not just string):** The KpiCard component uses `direction` to pick the color class (`text-green-600` / `text-red-600` / `text-gray-500`) and the aria-label prefix (`Up` / `Down` / `No baseline comparison`).

```typescript
// Source: src/lib/format.ts (extension)
export type DeltaDirection = 'up' | 'down' | 'none';
export type DeltaType = 'relative' | 'absolute-pp';

export interface FormattedDelta {
  glyph: '▲' | '▼' | '—';
  text: string;           // "12.4%" | "3.2pp" | "" (when direction === 'none')
  direction: DeltaDirection;
}

export function formatDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  type: DeltaType,
): FormattedDelta {
  // No-baseline cases
  if (current == null || previous == null) {
    return { glyph: '—', text: '', direction: 'none' };
  }
  if (type === 'relative' && previous === 0) {
    // Can't compute relative % change from zero baseline
    return { glyph: '—', text: '', direction: 'none' };
  }

  const delta = type === 'relative'
    ? ((current - previous) / previous) * 100  // e.g. 12.4
    : (current - previous) * 100;              // ratio→pp, e.g. 0.032 → 3.2

  // UI-SPEC line 252: format as one decimal
  const abs = Math.abs(delta).toFixed(1);
  const suffix = type === 'relative' ? '%' : 'pp';

  if (delta > 0) return { glyph: '▲', text: `${abs}${suffix}`, direction: 'up' };
  if (delta < 0) return { glyph: '▼', text: `${abs}${suffix}`, direction: 'down' };
  // delta === 0 — no change. Render as `▲ 0.0%` (up-direction but flat) OR
  // as `—` no-baseline? UI-SPEC doesn't spec this case explicitly.
  // Recommendation: treat 0 as 'none' (em-dash) because "0% change" reads
  // identically to a muted no-baseline in practice, and it avoids the
  // visual confusion of a green up-arrow with a zero value.
  return { glyph: '—', text: '', direction: 'none' };
}
```

**Open design choice:** `delta === 0` behavior is not UI-SPEC-locked. Recommend rendering as `direction: 'none'` per the rationale above. Planner should confirm with user or default to this.

### Pattern 6: Recent Sales Reuses `useSales`

**What:** Consumer-site slice — `const { data: sales, ... } = useSales(); const recent = useMemo(() => sales?.slice(0, 5), [sales]);`

**Why:** Single cache key `['sales']` shared with `/sales` route. Navigating to `/sales` and back shows instantly from cache (5-min staleTime). No separate RPC, no separate hook, no separate loading state.

**Why `useMemo`:** `.slice(0, 5)` on every render creates a new array → breaks referential equality downstream. `EMPTY_SALES` singleton from `useSales` (`src/hooks/useSales.ts:11`) is preserved when `sales === EMPTY_SALES` — don't `.slice()` the frozen singleton (it returns a new array anyway). Reading `sales?.slice(0, 5)` inside `useMemo` with `[sales]` dep makes the reference stable per `sales` identity.

### Anti-Patterns to Avoid

- **Client-side `SUM(net_revenue)`:** Violates INFR-04. Always via RPC.
- **`new Date(bounds.end).toISOString().slice(0, 10)`:** UTC, not local. Off-by-one near midnight in US East. Use `toIsoDateLocal` helper in Pattern 3.
- **Inline `{ data } = useQuery(...)` without Zod in component:** `data` is typed `Json` (or whatever the generator produced); accessing `.current.revenue` without narrowing leaves the app a runtime cliff. Zod in the `queryFn`.
- **Editing a pushed migration in place:** Use a new timestamp. See STATE.md Accumulated Context — the lesson from migration 20260421000012 (which re-applies `import_sale_with_departments` because 11 was edited after push).
- **`security definer` without `set search_path`:** Search-path hijack CVE surface. Always `set search_path = public, pg_temp` (mirror Phase 2 RPC pattern).
- **`placeholderData: previousData` callback instead of `placeholderData: keepPreviousData` import:** Subtle difference — the callback puts you in success state while the helper preserves pending/error state semantics. [CITED: tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 — "placeholderData will always put you into success state"]. The helper is the correct migration.
- **`useMemo` on period bounds with `new Date()` as a dep:** Would recompute every render (new Date identity). Don't memoize bounds in the component — compute inside the `queryFn` where React doesn't care about identity.
- **Rendering a green `▲ 0.0%`:** Visual confusion; treat 0 as 'none'/em-dash.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date bounds math | Custom date library, `date-fns`, `dayjs` | Plain `Date` + `.setMonth` for this phase | Phase 4 needs only 3 simple bounds calculations; a dep is overkill, and `dayjs`/`date-fns` aren't in package.json. Revisit at Phase 9 (custom date ranges) if complexity grows. |
| Async data / caching / retries | Hand-rolled `useEffect` + `useState` + `AbortController` | TanStack Query `useQuery` | Already in the project; already proven in Phases 1–3. |
| Schema validation of RPC output | Blind `as` cast, hand-written type guards | Zod `z.object({...}).parse(data)` | Generic `Json` type + one source of truth for the shape. |
| Segmented-control keyboard navigation | Custom radiogroup implementation | WAI-ARIA `role="radio"` + roving `tabIndex` (spec'd in 04-UI-SPEC.md lines 403–437) | Standard pattern — browsers handle Enter/Space activation natively on `<button>`. |
| Currency / percent / date formatting | String-templating, manual decimals | Existing `formatCurrency` / `formatPercent` / `formatDate` / `formatCount` from `src/lib/format.ts` | Null-safe, Intl-based, already covered by `format.test.ts`. |
| Divide-by-zero guard in SQL | `CASE WHEN lots_auctioned = 0 THEN NULL ELSE ... END` | `NULLIF(SUM(lots_auctioned), 0)` | One token, idiomatic, universally understood. |
| Link / route navigation in cards | `onClick` + `useNavigate` on a `<div>` | `<Link to="/sales/:sale_number">` wrapping the card content | Native focus + keyboard activation for free; tested pattern in Phase 3. |

**Key insight:** Phase 4 is 100% composition of Phase 1–3 primitives + one new RPC + one new pure function. If a task's spec reads "build X from scratch" and X appears in `src/lib/`, `src/components/`, or `src/hooks/` already, the plan is wrong — reuse.

## Runtime State Inventory

Phase 4 is a **greenfield phase** (new page + new RPC + new components). No existing runtime state is renamed, refactored, or migrated. Section intentionally omitted per RESEARCH protocol — Step 2.5 trigger does not fire.

## Common Pitfalls

### Pitfall 1: RPC return typed as generic `Json`

**What goes wrong:** After `npm run db:types`, `supabase.rpc('kpi_summary', ...)` returns `Json | null`. Accessing `data.current.revenue` TypeScript-errors, tempting the executor to `as KpiSummary` cast — which defers the shape check to the first production render.

**Why it happens:** Postgres JSONB is opaque to Supabase's TypeScript generator; the tool emits `Json` because it can't inspect `jsonb_build_object` keys statically.

**How to avoid:** Always validate with Zod inside the `queryFn` BEFORE returning. `return kpiSummarySchema.parse(data)` narrows the hook's return type to `KpiSummary` without a cast.

**Warning signs:** Any `as KpiSummary` in `useKpiSummary.ts`. Any `// @ts-expect-error` around a `.current.revenue` access. Any test that works with a hand-coded mock object but breaks with a real PostgREST response.

### Pitfall 2: UTC ISO date drift

**What goes wrong:** `computePeriodBounds` returns Date objects; client does `bounds.current.end.toISOString().slice(0, 10)`. At 8pm US Eastern on April 22, `toISOString()` returns `2026-04-23T00:00:00.000Z` → slice gives `2026-04-23`. RPC query selects sales from **tomorrow** that don't exist yet and excludes today's that do.

**Why it happens:** `toISOString()` always uses UTC. Easy to assume "date-only format, must be TZ-safe".

**How to avoid:** Always use a local-TZ serializer (`toIsoDateLocal` — see Pattern 3). Alternative: compute bounds in UTC from the start (shift `now` to UTC midnight), but this complicates the unit tests.

**Warning signs:** Tests that pass with `new Date('2026-04-22T12:00:00Z')` but fail with `new Date('2026-04-22T23:00:00-05:00')`. Production bug report "KPIs are off by one day at 7pm."

### Pitfall 3: Divide-by-zero in weighted sell-through

**What goes wrong:** RPC runs, window has sales but every row has `lots_auctioned = 0` (withdrawn/cancelled). `SUM(lots_sold)::numeric / SUM(lots_auctioned)` → `... / 0` → Postgres error → RPC throws → KPI section shows error state that isn't really an error.

**Why it happens:** `SUM` of a column that's zero for every row is 0, not NULL. `x / 0` is an error in Postgres for numeric types (not IEEE-754 inf/nan like JS).

**How to avoid:** `NULLIF(SUM(lots_auctioned), 0)` replaces 0 with NULL; `x / NULL` is NULL. JSONB serializes NULL as `null`; client renders `—`. Non-error, expected path.

**Warning signs:** RPC occasionally 500s during the spot-check if any such sales exist in-window. Unit test must include a window where the SUM is 0.

### Pitfall 4: `keepPreviousData` deprecation in TanStack v5

**What goes wrong:** Executor writes `useQuery({ keepPreviousData: true, ... })` based on stale muscle memory. TypeScript tolerates it (unknown prop), option is silently ignored. Period flips flash skeletons.

**Why it happens:** `keepPreviousData: true` was the v4 syntax. TanStack v5 removed the option (didn't soft-deprecate). [CITED: tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5].

**How to avoid:** `import { keepPreviousData } from '@tanstack/react-query'` + `placeholderData: keepPreviousData`. Test: flipping period while data is stale keeps cards on screen.

**Warning signs:** Visual regression: the 4 KPI cards disappear for a half-second on every YTD/L6M/L12M click.

### Pitfall 5: Referential thrashing on `sales.slice(0, 5)`

**What goes wrong:** `const recent = sales?.slice(0, 5)` in the component body creates a fresh array on every render. Passed to `RecentSalesPanel` as prop → child's `useMemo([sales])` thrashes → downstream re-renders. Not a correctness bug but a perf footgun.

**Why it happens:** Array methods return new arrays; JS doesn't structural-share.

**How to avoid:** Wrap the slice in `useMemo([sales])` at the consumer site. Or, pass `sales` as the prop and let `RecentSalesPanel` slice internally via `useMemo`.

**Warning signs:** React Profiler shows `RecentSaleCard` re-rendering on unrelated state changes (e.g. period flip).

### Pitfall 6: Sell-through delta treated as relative %

**What goes wrong:** Delta renders `(68% - 65%) / 65% * 100 = 4.6%` instead of the correct `68% - 65% = 3pp`. UI-SPEC line 252 locks `pp` suffix for this card.

**Why it happens:** Copy-paste from the other 3 cards' call-site.

**How to avoid:** `formatDelta(current, previous, 'absolute-pp')` for card 2; `formatDelta(current, previous, 'relative')` for cards 1, 3, 4. Unit test covers both modes.

**Warning signs:** Sell-through delta never matches a hand-calculated percentage-point number. User reports "the delta math looks wrong."

### Pitfall 7: Forgetting to `grant execute` to `authenticated`

**What goes wrong:** RPC created, authenticated user calls it, PostgREST returns 403 because no role has EXECUTE.

**Why it happens:** The Phase 2 `import_sale_with_departments` pattern explicitly `grant`s to `service_role` only. Copy-pasting that grant to the new RPC leaves browser calls denied.

**How to avoid:** `grant execute on function public.kpi_summary(date, date, date, date) to authenticated;`. Write an integration-style test that asserts the RPC is callable with the anon key (mocked `rpc` response + assert `.rpc` was called with the right function name).

**Warning signs:** Integration failure `permission denied for function kpi_summary` after `db push`.

### Pitfall 8: Regenerating types forgotten

**What goes wrong:** Migration pushed, RPC live, but `database.types.ts` unchanged → `supabase.rpc('kpi_summary', ...)` TypeScript-errors because `Functions` doesn't include it.

**Why it happens:** `db:types` is a separate manual step (`npm run db:types`). Easy to skip.

**How to avoid:** Wave 1 of the plan must include: (1) write migration, (2) `npm run db:push`, (3) `npm run db:types`, (4) commit the updated `database.types.ts`. All four steps gate downstream waves.

**Warning signs:** `Property 'kpi_summary' does not exist on type '{ import_sale_with_departments: ... }'`.

## Code Examples

### Pattern 1: Full `kpi_summary` migration (copy-ready)

See Pattern 1 above in Architecture Patterns — full migration body.

### Pattern 2: KpiCard consumer wiring (from UI-SPEC lines 364–394)

```typescript
// Source: 04-UI-SPEC.md § Layout Specifications → KpiCard component
import { formatDelta, type DeltaDirection } from '../lib/format';

interface KpiCardProps {
  label: string;
  value: string;  // pre-formatted, e.g. formatCurrency(current.revenue)
  current: number | null;
  previous: number | null;
  deltaType: 'relative' | 'absolute-pp';
  periodLabel: string;  // "YTD" | "6mo" | "12mo"
}

export function KpiCard({
  label, value, current, previous, deltaType, periodLabel,
}: KpiCardProps) {
  const delta = formatDelta(current, previous, deltaType);
  const colorClass = {
    up:   'text-green-600 dark:text-green-500',
    down: 'text-red-600 dark:text-red-500',
    none: 'text-gray-500 dark:text-gray-400',
  }[delta.direction];
  const ariaLabel = {
    up:   `Up ${delta.text} versus previous ${periodLabel}`,
    down: `Down ${delta.text} versus previous ${periodLabel}`,
    none: 'No baseline comparison',
  }[delta.direction];

  return (
    <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[128px] space-y-2">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-sm tabular-nums">
        <span className={colorClass} aria-label={ariaLabel}>
          {delta.glyph}{delta.text ? ` ${delta.text}` : ''}
        </span>
        {delta.text && (
          <span className="text-gray-500 dark:text-gray-400">
            {' '}vs previous {periodLabel}
          </span>
        )}
      </p>
    </div>
  );
}
```

### Pattern 3: PeriodSelector (from UI-SPEC lines 401–438)

Already specified verbatim in 04-UI-SPEC.md. Key points the executor must preserve:
- `role="radio"` on each `<button>`, `aria-checked={value === opt}`, `aria-pressed` for AT breadth
- Roving `tabIndex` (0 on active, -1 on others)
- ArrowLeft/ArrowRight/Home/End keyboard handler
- `border-l` on options 2+ (not on option 1) draws 1px segment dividers
- Outer `<fieldset>` has `overflow-hidden` so inner buttons inherit rounded corners

### Pattern 4: Test — computePeriodBounds YTD case

```typescript
// Source: proposed src/tests/period.test.ts
import { describe, it, expect } from 'vitest';
import { computePeriodBounds } from '../lib/period';

describe('computePeriodBounds', () => {
  const now = new Date(2026, 3, 22, 12, 0, 0); // Apr 22, 2026 local

  it('YTD: current is [Jan 1 this year, now)', () => {
    const b = computePeriodBounds('ytd', now);
    expect(b.current.start).toEqual(new Date(2026, 0, 1));
    expect(b.current.end).toEqual(now);
  });

  it('YTD: previous is [Jan 1 last year, Jan 1 this year)', () => {
    const b = computePeriodBounds('ytd', now);
    expect(b.previous.start).toEqual(new Date(2025, 0, 1));
    expect(b.previous.end).toEqual(new Date(2026, 0, 1));
  });

  it('L12M: current is [now - 12 months, now)', () => {
    const b = computePeriodBounds('l12m', now);
    expect(b.current.start).toEqual(new Date(2025, 3, 22, 12, 0, 0));
    expect(b.current.end).toEqual(now);
  });

  it('L12M: previous is [now - 24 months, now - 12 months)', () => {
    const b = computePeriodBounds('l12m', now);
    expect(b.previous.start).toEqual(new Date(2024, 3, 22, 12, 0, 0));
    expect(b.previous.end).toEqual(new Date(2025, 3, 22, 12, 0, 0));
  });

  it('L6M: current is [now - 6 months, now)', () => {
    const b = computePeriodBounds('l6m', now);
    expect(b.current.start).toEqual(new Date(2025, 9, 22, 12, 0, 0));
    expect(b.current.end).toEqual(now);
  });

  it('L6M: previous is [now - 12 months, now - 6 months)', () => {
    const b = computePeriodBounds('l6m', now);
    expect(b.previous.start).toEqual(new Date(2025, 3, 22, 12, 0, 0));
    expect(b.previous.end).toEqual(new Date(2025, 9, 22, 12, 0, 0));
  });
});
```

### Pattern 5: Test — useKpiSummary mocked

```typescript
// Source: proposed src/tests/use-kpi-summary.test.tsx (adapted from use-sales.test.tsx)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { supabase } from '../lib/supabase';
import { useKpiSummary } from '../hooks/useKpiSummary';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useKpiSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls supabase.rpc("kpi_summary", ...) with 4 date strings and queryKey ["kpi", period]', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        current:  { revenue: 1000, sell_through: 0.68, lots_sold: 100, sales_count: 5 },
        previous: { revenue: 800,  sell_through: 0.65, lots_sold: 80,  sales_count: 4 },
      },
      error: null,
    });

    const { result } = renderHook(() => useKpiSummary('l12m'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabase.rpc).toHaveBeenCalledWith('kpi_summary', expect.objectContaining({
      period_start:  expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      period_end:    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      compare_start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      compare_end:   expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
    expect(result.current.data?.current.revenue).toBe(1000);
  });

  it('handles null sell_through (divide-by-zero in window)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        current:  { revenue: 0, sell_through: null, lots_sold: 0, sales_count: 0 },
        previous: { revenue: 0, sell_through: null, lots_sold: 0, sales_count: 0 },
      },
      error: null,
    });
    const { result } = renderHook(() => useKpiSummary('ytd'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.current.sell_through).toBeNull();
  });

  it('surfaces RPC errors into isError', async () => {
    const boom = new Error('rpc failed');
    rpcMock.mockResolvedValueOnce({ data: null, error: boom });
    const { result } = renderHook(() => useKpiSummary('l6m'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query `keepPreviousData: true` option | `placeholderData: keepPreviousData` (helper import) | TanStack Query v5 release (2023) [CITED: tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5] | Must use v5 pattern — project is on `^5.99.2` |
| Hand-rolled segmented controls with `<div role="button">` | `<fieldset>` + `<button role="radio">` + roving tabIndex | WAI-ARIA 1.2 radiogroup pattern (stable) | UI-SPEC mandates the pattern; accessible by default |
| Inline RPC return shape access without validation | Zod `.parse(data)` inside `queryFn` to narrow `Json` → typed | Ongoing concern; not fixed at the generator level | Only reliable way to type PostgREST JSONB returns [CITED: dev.to/omills/supabase-helper-for-better-rpc-function-typing-with-jsonb-fields-1ok5] |
| Client-side SUM for KPIs | Server-side SUM via RPC | INFR-04 constraint (project-specific, not ecosystem) | Floating-point safety + matches Phase 1/2 precedent |

**Deprecated/outdated:**
- `isPreviousData` flag — removed in TanStack v5. Use `isPlaceholderData` if needed.
- Percent formatting via `(x * 100).toFixed(1) + '%'` — use `Intl.NumberFormat` (already in `format.ts`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Month-end date math (`addMonths(-6)` on Jan 31 → Jul 31, not Aug 3) is acceptable for analytics bounds | Pattern 2 gotcha | Minor — a day-or-two shift near month-end doesn't skew rolling windows. User could ask for stricter "end-of-month" clamping; addressed by documenting the behavior. |
| A2 | `delta === 0` should render as `—` (direction 'none'), not a flat `▲ 0.0%` | Pattern 5 | Low — UI-SPEC doesn't lock this case. Planner should confirm with user OR just default to 'none' and mention in the plan. |
| A3 | Zero new npm deps needed (CONTEXT + UI-SPEC both assert this) | Standard Stack | None — confirmed by reading package.json and UI-SPEC § Registry Safety line 522. |
| A4 | `numeric(14,2)` values in the low millions fit JS safe integer (2^53 ≈ 9 quadrillion) | Pattern 4 | Low — even at $99,999,999,999,999.99 we're well inside safe range. Defensive `numericLike` schema still accepts strings. |
| A5 | The two-CTE query plan is adequate for 457 rows + `idx_sales_sale_date` | Pattern 1 | None — at 457 rows, any plan is fast. Would revisit at 100k+ rows. |
| A6 | `security definer` on an aggregate is acceptable for an admin-only dashboard | Pattern 1 | Low — there's no row leakage in aggregates. Reviewed against Phase 1 RLS pattern (`private.is_admin()` gates the `sales` table regardless). |
| A7 | `sale_date >= start AND sale_date < end` is the correct boundary convention (half-open) | Pattern 1, Pattern 2 | Low — matches Postgres range semantics and prevents the boundary double-count. |

**Planner/discuss-phase action:** A2 (delta-zero rendering) is the only one that might warrant a user touchpoint; the rest are low-risk defaults.

## Open Questions

1. **Should `delta === 0` render as `—` or as `▲ 0.0%`?**
   - What we know: UI-SPEC locks 5 states (positive currency, negative currency, positive sell-through, negative sell-through, no baseline). Zero-change is not explicitly enumerated.
   - What's unclear: UX intent for a truly flat period.
   - Recommendation: Render as `—` (direction 'none'). Document the decision in the plan; user can revisit if it bothers them.

2. **Should the hook cache-bust at a specific time of day (e.g. midnight UTC) so the rolling-window bounds refresh?**
   - What we know: `staleTime: 5 * 60_000` → refetch every 5 min when stale.
   - What's unclear: Whether "bounds drift as clock passes midnight" is user-visible in practice.
   - Recommendation: Leave as 5-min staleTime. Nobody sits on the KPI page overnight. Revisit if a user reports "the L12M hasn't updated in days" — then add `refetchInterval` or manual invalidation on focus.

3. **Does RPC need a version suffix or table comment for future evolution?**
   - What we know: Phase 2 established the pattern of `comment on function ... is '...'`.
   - Recommendation: Add a `comment on function` block (see Pattern 1) describing the return shape. Future refactors can add a `kpi_summary_v2` alongside without dropping callers.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `npm run db:push`, `npm run db:types` | ✓ | ^2.81.3 | — |
| Node.js + npm | Everything | ✓ (implied — npm scripts are running) | project-local | — |
| Supabase linked project | `db push` target | ✓ (Phases 1–3 already pushed migrations) | — | — |
| tsx | `npm run import:pdfs` (not Phase 4 — unrelated) | ✓ | ^4.21.0 | — |
| Vitest | `npm test` | ✓ | ^4.0.18 | — |

No external dependencies blocked. Phase 4 is code + migration only — no new services, binaries, or secrets.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 with jsdom environment (project: `src`) |
| Config file | `vite.config.ts` (lines 8–33) |
| Quick run command | `npm test -- src/tests/period.test.ts` (filter to file) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KPI-01 | `kpi_summary` RPC returns 4 metrics × 2 windows | unit (hook, mocked RPC) | `npm test -- src/tests/use-kpi-summary.test.tsx` | ❌ Wave 0 |
| KPI-01 | `computePeriodBounds(ytd)` returns `{current, previous}` matching Jan 1 semantics | unit | `npm test -- src/tests/period.test.ts` | ❌ Wave 0 |
| KPI-01 | `computePeriodBounds(l6m)` / `l12m` return rolling windows | unit | `npm test -- src/tests/period.test.ts` | ❌ Wave 0 |
| KPI-01 | `KpiCard` renders label + formatted value | unit | `npm test -- src/tests/kpi-card.test.tsx` | ❌ Wave 0 |
| KPI-01 | `Dashboard` page renders loading → 4 KpiCards | integration | `npm test -- src/tests/dashboard-page.test.tsx` | ❌ Wave 0 |
| KPI-02 | `formatDelta(current, previous, 'relative')` returns `▲ 12.4%` | unit | `npm test -- src/tests/format-delta.test.ts` (or extend `format.test.ts`) | ❌ Wave 0 |
| KPI-02 | `formatDelta(current, previous, 'absolute-pp')` returns `▲ 3.2pp` | unit | same | ❌ Wave 0 |
| KPI-02 | `formatDelta(x, null)` returns `{glyph: '—', text: '', direction: 'none'}` | unit | same | ❌ Wave 0 |
| KPI-02 | `formatDelta(x, 0, 'relative')` returns no-baseline (protects against x/0) | unit | same | ❌ Wave 0 |
| KPI-02 | `KpiCard` with `direction: 'up'` renders green + `▲` + aria-label `Up ... versus previous ...` | unit | `npm test -- src/tests/kpi-card.test.tsx` | ❌ Wave 0 |
| KPI-02 | `KpiCard` with `direction: 'none'` renders single em-dash in gray | unit | same | ❌ Wave 0 |
| KPI-02 | `PeriodSelector` renders 3 options, default L12M | unit | `npm test -- src/tests/period-selector.test.tsx` | ❌ Wave 0 |
| KPI-02 | `PeriodSelector` ArrowRight moves focus + selection | unit (userEvent keyboard) | same | ❌ Wave 0 |
| KPI-02 | `PeriodSelector` ArrowLeft, Home, End | unit | same | ❌ Wave 0 |
| KPI-02 | `PeriodSelector` click changes selection and calls `onChange` | unit | same | ❌ Wave 0 |
| KPI-03 | `RecentSalesPanel` renders 5 cards from `useSales().slice(0, 5)` | unit (mocked useSales) | `npm test -- src/tests/recent-sales-panel.test.tsx` | ❌ Wave 0 |
| KPI-03 | `RecentSalesPanel` shows empty state when `sales.length === 0` | unit | same | ❌ Wave 0 |
| KPI-03 | `RecentSalesPanel` shows ErrorState with Retry on error | unit | same | ❌ Wave 0 |
| KPI-03 | `RecentSalesPanel` shows 5 skeletons while loading | unit | same | ❌ Wave 0 |
| KPI-03 | `RecentSaleCard` wraps content in `<Link to="/sales/:sale_number">` | unit | `npm test -- src/tests/recent-sale-card.test.tsx` | ❌ Wave 0 |
| KPI-03 | `RecentSaleCard` truncates long titles with `title` attr fallback | unit | same | ❌ Wave 0 |
| KPI-03 | `RecentSaleCard` renders formatted date, net_revenue, sell-through | unit | same | ❌ Wave 0 |
| KPI-01/02/03 | Dashboard page integration: period flip → refetch; each section fails independently | integration | `npm test -- src/tests/dashboard-page.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- <narrow filter>` (e.g. `src/tests/period.test.ts`) — runs in < 5 seconds
- **Per wave merge:** `npm test` — full suite (< 60 seconds based on Phase 3 baseline)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/tests/period.test.ts` — covers KPI-01 (bounds math, 3 periods × 2 windows = 6 assertions minimum)
- [ ] `src/tests/format-delta.test.ts` (or extend `format.test.ts`) — covers KPI-02 (relative, absolute-pp, null, zero-baseline, zero-delta)
- [ ] `src/tests/use-kpi-summary.test.tsx` — covers KPI-01 hook contract (mocks `supabase.rpc`)
- [ ] `src/tests/kpi-card.test.tsx` — covers KPI-01/02 rendering + aria-label
- [ ] `src/tests/period-selector.test.tsx` — covers KPI-02 keyboard + click interaction
- [ ] `src/tests/recent-sales-panel.test.tsx` — covers KPI-03 (loading/empty/error/success)
- [ ] `src/tests/recent-sale-card.test.tsx` — covers KPI-03 card content + navigation
- [ ] `src/tests/dashboard-page.test.tsx` — integration (all 3 requirements wired together)
- No framework install needed — Vitest + Testing Library already in `package.json`
- No `conftest` / setup changes needed — `src/tests/setup.ts` already imports `@testing-library/jest-dom/vitest`

## Security Domain

> `security_enforcement` not explicitly set in `.planning/config.json` → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirectly) | Inherited from Phase 1 — `ProtectedRoute` guards `/`; RPC is granted to `authenticated` role only |
| V3 Session Management | yes (inherited) | Supabase auth session from Phase 1; no changes in Phase 4 |
| V4 Access Control | yes | RLS on `sales` table is admin-only (`private.is_admin()`); RPC is `security definer` but relies on `grant execute ... to authenticated` + the caller's session. If we wanted to belt-and-suspenders, the RPC could internally check `private.is_admin()` before querying — recommended addition. See [Hardening Recommendation](#hardening-recommendation). |
| V5 Input Validation | yes | Zod validates RPC response shape; RPC inputs are `date` type — Postgres casts raise on bad input, no string concat |
| V6 Cryptography | no | No crypto in Phase 4 (no secrets, no signing) |

### Known Threat Patterns for React + Supabase RPC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via date param | Tampering | Postgres `date` type casts raise on malformed input; no string concat in RPC body |
| XSS via rendered sale.title in RecentSaleCard | Tampering | React JSX text-child auto-escaping (same mitigation as Phase 3 T-03-01) |
| Authorization bypass (non-admin calls kpi_summary) | Elevation | `grant execute ... to authenticated` + `private.is_admin()` upstream RLS blocks data anyway (SELECT on `sales` is admin-only, so the aggregate returns zero rows for non-admins). Recommend adding explicit `if not private.is_admin() then raise exception ...` at the top of the RPC for defense-in-depth. |
| Period flip DoS (rapid toggles) | Denial of Service | TanStack Query dedupes/cancels in-flight requests; 5-min staleTime caches results; 457-row aggregate is sub-ms |
| CSRF | — | Supabase auth via Bearer token (not cookie), so CSRF is not applicable |
| Search-path hijack on security-definer function | Elevation | `set search_path = public, pg_temp` (mirror Phase 2 RPC) |

### Hardening Recommendation

Add an explicit admin check at the top of the RPC body:

```sql
begin
  if not private.is_admin() then
    raise exception 'Access denied';
  end if;
  -- ... rest of function
end;
```

**Trade-off:** Adds one extra SELECT-from-profiles per RPC call. At dashboard-refresh cadence (< 1/minute per active user) this is negligible. The defense is against a future migration that accidentally loosens RLS on `sales`.

**Decision:** Recommend including the check. Planner to confirm.

## Sources

### Primary (HIGH confidence)

- Project files — [VERIFIED: direct read]
  - `CLAUDE.md` — project constraints and stack
  - `.planning/REQUIREMENTS.md` — KPI-01/02/03 definitions
  - `.planning/STATE.md` — decisions log + Phase 2 migration lessons
  - `.planning/phases/04-kpi-landing-page/04-CONTEXT.md` — locked implementation decisions
  - `.planning/phases/04-kpi-landing-page/04-UI-SPEC.md` — UI design contract (approved)
  - `src/db/database.types.ts` — current generated Supabase types (no `kpi_summary` yet)
  - `src/lib/format.ts` — existing formatters; `EMPTY = '—'` constant
  - `src/lib/supabase.ts` — Proxy-wrapped anon client
  - `src/hooks/useSales.ts` — reference hook pattern (queryKey, staleTime, EMPTY_SALES singleton)
  - `src/hooks/useSale.ts` — reference for embedded-resource + enabled guard
  - `src/pages/Dashboard.tsx` — current placeholder to replace
  - `src/pages/SaleDetail.tsx` — reference for loading/error/not_found branching
  - `src/components/ErrorState.tsx` / `EmptyState.tsx` / `TableSkeleton.tsx` — primitives to reuse
  - `src/components/SalesTable.tsx` / `SaleSummaryCard.tsx` — Phase 3 patterns to mirror
  - `src/tests/use-sales.test.tsx` / `use-sale.test.tsx` / `format.test.ts` — existing test patterns
  - `supabase/migrations/20260421000006_rls_helper_functions.sql` — `private.is_admin()` definition
  - `supabase/migrations/20260421000007_rls_policies.sql` — admin-only RLS on `sales`
  - `supabase/migrations/20260421000011_import_sale_rpc.sql` / `20260421000012_refine_import_sale_rpc.sql` — security-definer RPC pattern
  - `vite.config.ts` — Vitest projects config (jsdom for `src/**/*.test.{ts,tsx}`)
  - `package.json` — all dependency versions verified present
  - `.planning/config.json` — nyquist_validation enabled, commit_docs enabled

### Secondary (MEDIUM confidence — web sources, cross-verified)

- [TanStack Query v5 Migration Guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) — `keepPreviousData` → `placeholderData: keepPreviousData` [CITED]
- [TanStack Query Placeholder Query Data](https://tanstack.com/query/v5/docs/react/guides/placeholder-query-data) — helper import and identity-function alternative [CITED]
- [Supabase RPC TypeScript caveats (DEV.to)](https://dev.to/omills/supabase-helper-for-better-rpc-function-typing-with-jsonb-fields-1ok5) — JSONB return → generic `Json` type [CITED]
- [Supabase JavaScript TypeScript support](https://supabase.com/docs/reference/javascript/typescript-support) — `db:types` command [CITED]
- [PostgREST Functions docs](https://docs.postgrest.org/en/v12/references/api/functions.html) — numeric serialization behavior [CITED]
- [Postgres NULLIF (Neon)](https://neon.com/postgresql/postgresql-tutorial/postgresql-nullif) — "particularly useful for preventing division errors" [CITED]
- [Postgres Aggregate Functions 9.6](https://www.postgresql.org/docs/9.6/functions-aggregate.html) — `SUM` returns NULL on empty / all-NULL input [CITED]
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) — security definer guidance + search_path [CITED]

### Tertiary (LOW confidence — flagged for validation)

None. All claims in this research are either verified by direct file read or cited from current official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all deps verified in `package.json`, none added
- Architecture: **HIGH** — CONTEXT.md and UI-SPEC lock every structural decision; RPC pattern proven in Phases 1–2
- Pitfalls: **HIGH** — 8 pitfalls, all grounded in either official docs (TanStack v5 migration, Supabase JSONB) or Phase 2 lessons (migration-edit gotcha, security-definer hygiene)
- SQL RPC body: **HIGH** — mirrors Phase 2 pattern with idiomatic CTE + NULLIF
- Period math: **MEDIUM-HIGH** — pure JS, no surprises; A1 (month-end rollover) is a known and documented trade-off
- Delta math + Zod: **HIGH** — UI-SPEC locks semantics; Zod pattern is idiomatic
- Test plan: **HIGH** — every requirement has a mapped test; all infrastructure already present

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable stack, no fast-moving components)
