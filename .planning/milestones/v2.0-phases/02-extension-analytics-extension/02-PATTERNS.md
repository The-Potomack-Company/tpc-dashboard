# Phase 2: Extension Analytics (`/extension`) - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 25 new files + 2 modified
**Analogs found:** 23 strong-match in codebase / 4 from RESEARCH.md (TanStack Table v8 + RPC SQL — no in-repo analog)

---

## File Classification

### New files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/pages/Extension.tsx` | page (route component) | request-response | `src/pages/Kit.tsx` + `src/pages/Home.tsx` | role-match (Kit.tsx is a section-composing page; closest analog) |
| `src/components/extension/EventVolumeChart.tsx` | component (chart) | request-response (read) | `src/components/kit/Sparkline.tsx` (Recharts wrapper) | role-match — Sparkline is the only existing Recharts wrapper |
| `src/components/extension/KpiStrip.tsx` | component (composer) | request-response | `src/pages/Kit.tsx` (KpiCard composition section, lines 99–126) | role-match (existing KpiCard composition site) |
| `src/components/extension/ErrorRateChart.tsx` | component (chart) | request-response | `src/components/kit/Sparkline.tsx` | role-match (Recharts pattern) |
| `src/components/extension/PerUserTable.tsx` | component (table) | request-response | RESEARCH.md "Code Examples" § TanStack Table v8 sortable headless table | research-only — no in-repo TanStack Table analog yet |
| `src/components/extension/RecentErrorsTable.tsx` | component (table + modal trigger) | request-response | RESEARCH.md "Code Examples" § TanStack Table v8 + `src/components/kit/PayloadViewerModal.tsx` (modal pattern) | research-only for table; exact for modal |
| `src/components/extension/LiveEventFeed.tsx` | component (live feed) | streaming (polled) | `src/components/kit/PayloadViewerModal.tsx` (state pattern) + RESEARCH.md Pattern 4 for hook | partial — feed list UI is novel |
| `src/components/extension/DeveloperPanel.tsx` | component (collapsible surface) | request-response | `src/components/kit/PayloadViewerModal.tsx` (open/close state + useEffect pattern) | role-match — closest local stateful UI |
| `src/components/extension/DominantVersionBadge.tsx` | component (badge) | request-response | `src/components/kit/KpiCard.tsx` (delta chip styling) | role-match |
| `src/components/extension/ExtensionVersionFilter.tsx` | component (multi-select) | request-response | `src/components/kit/DateRangeFilter.tsx` (popover + URL hook idiom) | exact (same popover pattern) |
| `src/components/extension/CancellationRateKpis.tsx` | component (composer) | request-response | `src/pages/Kit.tsx` (KpiCard composition) + `KpiStrip.tsx` (above) | role-match |
| `src/components/UserMultiSelect.tsx` | component (multi-select) | request-response | `src/components/kit/DateRangeFilter.tsx` (popover/click-outside/Escape) | exact |
| `src/hooks/extension/useUserFilter.ts` | hook (URL state) | event-driven (URL sync) | `src/hooks/useDateRange.ts` | **exact** (canonical analog per CONTEXT.md) |
| `src/hooks/extension/useVersionFilter.ts` | hook (URL state) | event-driven (URL sync) | `src/hooks/useDateRange.ts` | **exact** (canonical analog per CONTEXT.md) |
| `src/hooks/extension/useExtensionGate.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 5 + `src/lib/supabase.ts` import idiom | research-only — first TanStack Query hook in repo |
| `src/hooks/extension/useEventVolume.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 | research-only — same |
| `src/hooks/extension/useKpiTotals.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 | research-only |
| `src/hooks/extension/useErrorRate.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 | research-only |
| `src/hooks/extension/usePerUserSummary.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 | research-only |
| `src/hooks/extension/useRecentErrors.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 (variant: raw `.from()` not RPC) | research-only |
| `src/hooks/extension/useLiveFeed.ts` | hook (TanStack Query w/ refetchInterval) | streaming (polled) | RESEARCH.md Pattern 4 | research-only |
| `src/hooks/extension/useDominantVersion.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 | research-only |
| `src/hooks/extension/useCancellationRates.ts` | hook (TanStack Query) | request-response | RESEARCH.md Pattern 3 | research-only |
| `src/services/extension/queries.ts` | service (query/RPC builders) | request-response | RESEARCH.md "Code Examples" § Supabase RPC call with typed args + `src/stores/authStore.ts` lines 55–68 (existing `.from().select()` shape) | partial — first dedicated service module |
| `src/lib/devAccess.ts` | utility (allowlist) | request-response (pure) | RESEARCH.md "Code Examples" § isDevAccount allowlist | research-only — no in-repo allowlist precedent |
| `src/lib/format.ts` | utility (formatters) | request-response (pure) | `src/hooks/useTimezone.ts` (formatter wrapping `formatInTimeZone`) | role-match — `format.ts` is referenced in UI-SPEC as v1.0 carryover but does NOT exist; create new mirroring `useTimezone` style |
| `supabase/migrations/<ts>_create_extension_rpcs.sql` | migration (RPCs + grants) | n/a | `supabase/migrations/20260424120500_create_analytics_events.sql` (admin SELECT policy + grant pattern only) + RESEARCH.md Patterns 1, 2, Q5 (canonical RPC bodies) | partial — existing migration has no RPC; RPC body comes from research |

### Modified files

| Modified File | Role | Modification | Closest Analog |
|---------------|------|--------------|----------------|
| `src/App.tsx` | route registry | Add `<Route path="/extension" element={<ExtensionPage />} />` inside the `<DashboardLayout>` group | self (lines 22–32) |
| `src/layouts/DashboardLayout.tsx` | layout shell | Append first entry to `NAV_ITEMS` array (line 24) | self (lines 53–93 — render block already exists; only data array changes) |

---

## Pattern Assignments

### `src/hooks/extension/useUserFilter.ts` (hook, URL state)

**Analog:** `src/hooks/useDateRange.ts` — **canonical, exact pattern per CONTEXT.md and per UI-SPEC § Open Items**

**Imports pattern** (lines 1–4):
```typescript
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { subDays, startOfDay, endOfDay, parse, isValid } from 'date-fns';
import { useTimezone } from './useTimezone';
```
For `useUserFilter` keep `useCallback` + `useSearchParams`; drop date-fns/useTimezone (no time math needed).

**URL-derived value pattern** (lines 43–69):
```typescript
export function useDateRange(): DateRangeValue {
  const [params, setParams] = useSearchParams();
  // ...
  const rawRange = params.get('range');
  const range: DateRangePreset = isPreset(rawRange) ? rawRange : '7d'; // D-17 default
```
For users: `const rawUsers = params.get('users'); const users = rawUsers ? rawUsers.split(',') : [];` (comma-separated single key per CONTEXT D-17 + UI-SPEC discretion).

**Single-closure setParams write pattern** (lines 71–87):
```typescript
const setRange = useCallback(
  (next: Exclude<DateRangePreset, 'custom'>) => {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        copy.set('range', next);
        copy.delete('from');
        copy.delete('to');
        return copy;
      },
      { replace: false },
    );
  },
  [setParams],
);
```
**This is the load-bearing idiom.** RESEARCH Pitfall 5 (referenced in line 14 comment) requires the single-closure form — multiple `setParams(...)` calls in one render do NOT batch in react-router 7. For `useUserFilter`'s `setUsers(next: string[])`, the closure body becomes:
```typescript
setParams((prev) => {
  const copy = new URLSearchParams(prev);
  if (next.length === 0) copy.delete('users');
  else copy.set('users', next.join(','));
  return copy;
}, { replace: false });
```

**Test pattern** — `src/hooks/useDateRange.test.tsx` (lines 1–47, 87–122):
- Wrapper helper `makeWrapper(initialEntries)` returning a `<MemoryRouter>` + `<Routes><Route path="*">...</Route></Routes>`.
- Hook variant `useDateRangeWithLocation()` that exposes `loc.search` so assertions can verify URL mutations (lines 23–27).
- `act(() => result.current.setRange('30d'))` then `expect(result.current.search).toBe('?range=30d')` (lines 87–97).

Apply identically: `useUserFilterWithLocation()`, `act(() => result.current.setUsers(['a@x.com','b@y.com']))`, assert `params.get('users')` round-trips.

---

### `src/hooks/extension/useVersionFilter.ts` (hook, URL state)

**Analog:** identical to `useUserFilter.ts` (same shape, different param name). Single source of pattern truth: `src/hooks/useDateRange.ts`. Use `?versions=` with comma-separated values.

---

### `src/hooks/extension/useExtensionGate.ts` (hook, TanStack Query single-shot probe)

**Analog:** RESEARCH.md Pattern 5 (`02-RESEARCH.md` lines 547–574). No in-repo analog — first TanStack Query hook.

**Imports pattern** (RESEARCH lines 549–550):
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
```

**Core probe pattern** (RESEARCH lines 552–573):
```typescript
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

**Existing supabase `.from().select()` reference** (`src/stores/authStore.ts` lines 55–69):
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', fetchingFor)
  .maybeSingle();
// ...
if (error) {
  console.error('[authStore] profile fetch failed', error);
}
```
The error-throw pattern in `useExtensionGate` (`if (error) throw error`) replaces the console.error for TanStack Query consumption — let TanStack capture the error.

---

### `src/hooks/extension/useEventVolume.ts` (and useKpiTotals, useErrorRate, usePerUserSummary, useDominantVersion, useCancellationRates)

**Analog:** RESEARCH.md Pattern 3 (`02-RESEARCH.md` lines 446–479). No in-repo analog.

**Canonical hook shape** (RESEARCH lines 451–478):
```typescript
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

**Critical:** Sort arrays before placing into queryKey (RESEARCH Pitfall 3). Apply this template to **all 6 RPC hooks** by changing only the queryKey discriminator (`'eventVolume'` → `'kpiTotals'` | `'errorRate'` | `'perUserSummary'` | `'dominantVersion'` | `'cancellationRates'`) and the `fetchX` import.

**QueryClientProvider precedent** — `src/main.tsx` lines 12–20 already configures `staleTime: 60_000, retry: 1, refetchOnWindowFocus: false`. Hooks inherit; do NOT redeclare per-query.

---

### `src/hooks/extension/useLiveFeed.ts` (hook, polled streaming)

**Analog:** RESEARCH.md Pattern 4 (`02-RESEARCH.md` lines 484–519). No in-repo analog.

**Pause/Resume idiom** (RESEARCH lines 491–518):
```typescript
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
    void qc.invalidateQueries({ queryKey: FEED_KEY });
  }, [qc]);

  return { ...query, paused, pause, resume };
}
```
**Load-bearing detail:** `refetchInterval` MUST be the function form (not static number) so `paused` flips reactively (RESEARCH Pitfall 4). Resume MUST pair `setPaused(false)` with `qc.invalidateQueries(...)` to trigger an immediate refetch.

---

### `src/services/extension/queries.ts` (service, query/RPC builders)

**Analog:** RESEARCH.md "Code Examples" § Supabase RPC call with typed args (`02-RESEARCH.md` lines 810–871). No in-repo dedicated service module.

**Imports + JSDoc invariant warning** (RESEARCH lines 811–820):
```typescript
import { supabase } from '../../lib/supabase';
import type { Database } from '../../db/database.types';

type Volume = Database['public']['Functions']['get_event_volume_daily']['Returns'];
type Kpi    = Database['public']['Functions']['get_kpi_totals']['Returns'];
```
**JSDoc header at top of file** (per CONTEXT specifics + RESEARCH Pitfall 6):
```typescript
//
// IMPORTANT: every aggregation and select against analytics_events MUST scope by
// app_source = 'tpc-extension' (CONTEXT D-01). The 5-event vocabulary excludes
// catalog_item from EXT-01..04 (D-02). The error signal is `error_message IS NOT NULL`
// (D-03). Bucketing is server-side (D-13).
//
```

**RPC call pattern** (RESEARCH lines 824–835):
```typescript
export async function fetchEventVolume(args: {
  from: Date; to: Date; users: string[]; versions: string[]; bucket: 'day' | 'hour';
}): Promise<Volume> {
  const { data, error } = await supabase.rpc('get_event_volume_daily', {
    p_from:     args.from.toISOString(),
    p_to:       args.to.toISOString(),
    p_users:    args.users,         // empty array = "no filter" (Pitfall 2)
    p_versions: args.versions,
  });
  if (error) throw error;
  return data ?? [];
}
```

**Raw `.from().select()` pattern** (RESEARCH lines 837–858):
```typescript
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
```

**Existing analogous shape** — `src/stores/authStore.ts` lines 55–68 already shows `.from().select().eq().maybeSingle()` + `if (error)` handling. Mirror that error path: throw on error (let TanStack capture), `return data ?? []` on success.

---

### `src/lib/devAccess.ts` (utility, allowlist)

**Analog:** RESEARCH.md "Code Examples" § isDevAccount allowlist (`02-RESEARCH.md` lines 875–889).

**Full file excerpt** (RESEARCH lines 876–889):
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
The lowercase pre-comparison means the constant must already be lowercase — `josh@potomackco.com` is already lowercase, no transform needed at module-load.

---

### `src/lib/format.ts` (utility, formatters — NEW MODULE)

**Note:** UI-SPEC references `formatPercent`, `formatCount`, `EMPTY` as v1.0 carryovers but `Glob src/lib/format.ts` returned no files. **The module does not exist.** Phase 2 must create it.

**Analog:** `src/hooks/useTimezone.ts` (lines 18–32) for the `formatInTimeZone` wrapping idiom + `date-fns-tz` import:
```typescript
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const ET = 'America/New_York';
// ...
formatDate: (d) => formatInTimeZone(d, ET, 'MMM d, yyyy'),
formatDateTime: (d) => formatInTimeZone(d, ET, "MMM d, yyyy h:mm a 'ET'"),
```

**`format.ts` shape Phase 2 must ship:**
```typescript
import { formatInTimeZone } from 'date-fns-tz';

const ET = 'America/New_York';
export const EMPTY = '—';  // em-dash

export function formatPercent(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return `${n.toFixed(decimals)}%`;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return n.toLocaleString('en-US');
}

export function formatTimestampShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, ET, 'MM/dd HH:mm');
}
```
The `MM/dd HH:mm` format is locked by UI-SPEC § Typography "Date/time (ET, short)".

---

### `src/components/extension/ExtensionVersionFilter.tsx` and `src/components/UserMultiSelect.tsx` (multi-select popovers)

**Analog:** `src/components/kit/DateRangeFilter.tsx` — exact popover idiom (custom popover, click-outside, Escape close).

**State + ref + outside-click-and-Escape handler pattern** (lines 27–60):
```typescript
const [popoverOpen, setPopoverOpen] = useState(false);
const popoverRef = useRef<HTMLDivElement>(null);

// Close popover when user clicks outside or presses Escape.
useEffect(() => {
  if (!popoverOpen) return;
  function handleDocClick(e: MouseEvent) {
    if (!popoverRef.current) return;
    if (!popoverRef.current.contains(e.target as Node)) {
      setPopoverOpen(false);
    }
  }
  function handleEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') setPopoverOpen(false);
  }
  document.addEventListener('mousedown', handleDocClick);
  document.addEventListener('keydown', handleEsc);
  return () => {
    document.removeEventListener('mousedown', handleDocClick);
    document.removeEventListener('keydown', handleEsc);
  };
}, [popoverOpen]);
```
Apply this exact handler shape to both new multi-select components — no library, hand-rolled (UI-SPEC § Design System).

**Trigger button + popover layout** (lines 81–154 — segmented buttons + `absolute top-full` popover):
```typescript
<div className="relative inline-flex flex-col gap-0">
  <button type="button" onClick={() => setPopoverOpen(o => !o)} aria-pressed={...} className="...">
    {triggerLabel}
  </button>
  {popoverOpen && (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 z-10 mt-1 flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
    >
      {/* checkbox rows or chip list */}
    </div>
  )}
</div>
```

---

### `src/components/extension/PerUserTable.tsx` and `RecentErrorsTable.tsx` (TanStack Table v8)

**Analog:** RESEARCH.md "Code Examples" § TanStack Table v8 sortable headless table (`02-RESEARCH.md` lines 730–805). **No in-repo analog — TanStack Table is a NEW dependency.**

**Imports + ColumnDef + state** (RESEARCH lines 733–763):
```typescript
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { SortIndicator } from '../SortIndicator';   // Phase 1 retained

interface Row {
  user_email: string;
  catalog_single: number;
  // ...
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'user_email', header: 'User' },
  { accessorKey: 'catalog_single', header: 'Catalog single' },
  // ...
];
```

**Table instantiation + render** (RESEARCH lines 763–805):
```typescript
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
  );
```
**Critical (RESEARCH Pitfall 5):** Use `flexRender(h.column.columnDef.header, h.getContext())` — NOT `h.renderHeader()`. The latter is not a v8 API; it leaks from v7 / v9-alpha sources.

**SortIndicator integration** — `src/components/SortIndicator.tsx` already supports the v8 sort state shape directly:
```typescript
interface SortIndicatorProps {
  state: 'asc' | 'desc' | false;
}
```
Cast `h.column.getIsSorted()` to that union (RESEARCH line 786).

**Phase 2 column shapes** (UI-SPEC § Component Inventory + Copywriting):
- `PerUserTable`: `User | catalog_single | catalog_batch | portal_upload | spreadsheet_transform | data_import | Errors | Last seen` — default sort `[{ id: 'last_seen_at', desc: true }]`.
- `RecentErrorsTable`: `Time | User | Event | Error | Version | Payload` (last col dev-only) — default sort `[{ id: 'created_at', desc: true }]`. Cell-level `View →` button gating in the action column reads `isDevAccount(email)` per row.

---

### `src/components/extension/EventVolumeChart.tsx` and `ErrorRateChart.tsx` (Recharts charts)

**Analog (in-repo):** `src/components/kit/Sparkline.tsx` for the Recharts component shape + `isAnimationActive={false}` discipline.

**ResponsiveContainer + isAnimationActive pattern** (`src/components/kit/Sparkline.tsx` lines 28–48):
```typescript
return (
  <div
    className={className}
    style={{ width, height }}
    data-testid="sparkline"
    aria-hidden="true"
  >
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="y"
          stroke={stroke}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
```
**Load-bearing:** `isAnimationActive={false}` is mandatory — Phase 1 locked it to avoid JSDom test flakes (RESEARCH "State of the Art" deprecated row + STATE.md Phase 1/01-05). Apply to every `<Bar>` in `EventVolumeChart` and `ErrorRateChart`.

**Stacked bar shape** — RESEARCH.md "Code Examples" § Recharts BarChart with stackId (lines 683–728):
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ... pivotForRecharts helper (lines 689-697)

const COLORS: Record<string, string> = {
  // UI-SPEC § Color locks the palette — DO NOT use the indicative hexes from
  // RESEARCH (lines 699-705); use the UI-SPEC values:
  catalog_single:        '#64748b', // slate-500
  catalog_batch:         '#0284c7', // sky-600
  portal_upload:         '#0d9488', // teal-600
  spreadsheet_transform: '#d97706', // amber-600
  data_import:           '#7c3aed', // violet-600
};

return (
  <ResponsiveContainer>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="bucket" tickFormatter={formatBucket} />
      <YAxis />
      <Tooltip />
      <Legend />
      {(['catalog_single','catalog_batch','portal_upload','spreadsheet_transform','data_import'] as const).map(t => (
        <Bar key={t} dataKey={t} stackId="events" fill={COLORS[t]} isAnimationActive={false} />
      ))}
    </BarChart>
  </ResponsiveContainer>
);
```

**Test pattern: Recharts JSDom mock** — `src/components/kit/Sparkline.test.tsx` lines 13–32:
```typescript
vi.mock('recharts', async () => {
  const actual =
    await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(children as ReactElement<{ width?: number; height?: number }>, {
            width: 200,
            height: 32,
          })
        : children;
      return (
        <div style={{ width: 200, height: 32 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});
```
**Reuse verbatim** for `EventVolumeChart.test.tsx` and `ErrorRateChart.test.tsx`. Adjust width/height to match the chart's expected size (`h-72` = 288 for EventVolumeChart, `h-48` = 192 for ErrorRateChart).

---

### `src/pages/Extension.tsx` (page, route component)

**Analogs:** `src/pages/Kit.tsx` (section composition), `src/pages/Home.tsx` (centered-flex empty layout).

**Section composition pattern** (`src/pages/Kit.tsx` lines 49–96):
```typescript
export function KitPage() {
  // ...local state + hook reads...
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">UI Kit — Dev Demo</h1>
        <p className="mt-1 text-sm text-gray-600">...</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">&lt;DateRangeFilter&gt;</h2>
        <DateRangeFilter />
      </section>
      {/* ...repeat per section... */}
    </div>
  );
}
```
For `Extension.tsx` use the layout shape from UI-SPEC § Layout Specifications (lines 466–553) — `<main>` is provided by `DashboardLayout`'s outlet, so the page itself is just a `<>...</>` with a `<header>` + sections + `{isDev && <DeveloperPanel/>}`.

**Empty-gate branch pattern** — RESEARCH.md Pattern 5 (lines 524–544):
```typescript
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
**Note (UI-SPEC § Empty gate layout, lines 562–581):** the empty branch should ALSO render the `<header>` with `<DateRangeFilter>` + `<UserMultiSelect>` (filters do nothing in empty state but stay informational). Adjust the RESEARCH-template branch to keep the header + filter row above the centered EmptyState, not bail on the whole page.

**`isDevAccount` gating pattern in component** (RESEARCH lines 891–901):
```typescript
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';

export function DeveloperPanel() {
  const email = useAuthStore(s => s.profile?.email);
  if (!isDevAccount(email)) return null;       // gated render — never in DOM for admins
  // ... rest of panel (collapsed by default)
}
```
**Critical (RESEARCH Anti-Patterns):** Render-conditional, not `display: hidden`. The version filter MUST NOT exist in the DOM for admins (otherwise it surfaces in keyboard tab order).

---

### `src/components/extension/DeveloperPanel.tsx` (collapsible surface)

**Analog (state pattern):** `src/components/kit/PayloadViewerModal.tsx` lines 22–43 — the open/close `useState` + `useEffect` discipline. Adapt to a simpler `isExpanded` toggle (no native dialog needed).

**Outer chrome** (UI-SPEC § Layout Specifications lines 528–550):
```typescript
{isDev && (
  <section className="rounded-lg border border-gray-200 bg-white mt-8">
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isExpanded}
      aria-controls="dev-panel-body"
      className="w-full flex items-center justify-between px-4 h-12 hover:bg-gray-50"
    >
      <div className="flex items-center gap-2">
        <Chevron rotated={isExpanded} />
        <span className="text-sm font-semibold text-gray-700">Developer panel</span>
        <span className="text-xs text-gray-500">Diagnostics for {profile.email}</span>
      </div>
      <DominantVersionBadge />
    </button>
    {isExpanded && (
      <div id="dev-panel-body" className="border-t border-gray-200 p-6 space-y-6">
        {/* EXT-09 ExtensionVersionFilter, EXT-10 CancellationRateKpis */}
      </div>
    )}
  </section>
)}
```
Reuse the `SortIndicator.tsx` chevron SVG (lines 22–63) inlined as a small `<Chevron>` helper with a `motion-safe:transition-transform` and `rotate-180` when expanded (UI-SPEC § Interaction Contract: DeveloperPanel collapse/expand).

---

### `src/components/extension/LiveEventFeed.tsx` (polled feed list)

**Analog:** No exact in-repo match. Combine:
- Bordered card chrome from UI-SPEC § Layout Specifications lines 513–525.
- `useLiveFeed` hook from above.
- `<TableSkeleton>` pattern from `src/components/TableSkeleton.tsx` lines 20–37 for first-mount loading.
- Pause icon + Resume icon as inline Heroicons SVGs (matching `SortIndicator.tsx` lines 22–63 inline-SVG idiom).

**Section heading + live-dot subtitle pattern** (UI-SPEC § Copywriting "EXT-08 Live Event Feed"):
```typescript
<header className="flex items-center justify-between border-b border-gray-200 px-4 h-12">
  <div className="flex items-center gap-2">
    <span
      className={paused ? 'h-2 w-2 rounded-full bg-gray-400' : 'h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse'}
      aria-hidden="true"
    />
    <span className="sr-only">{paused ? 'Paused' : 'Live'}</span>
    <h2 className="text-sm font-semibold text-gray-700">Live feed</h2>
    <p className="text-xs text-gray-500" aria-live="polite" aria-atomic="true">
      {paused ? `Paused · ${rows.length} events shown at pause time` : 'Tailing latest 50 events · refreshes every 10s'}
    </p>
  </div>
  <button type="button" onClick={paused ? resume : pause} className="h-8 px-3 ..." aria-label={paused ? 'Resume live feed' : 'Pause live feed'}>
    {paused ? 'Resume' : 'Pause'}
  </button>
</header>
```

---

### `supabase/migrations/<ts>_create_extension_rpcs.sql` (RPC migration)

**Analog (in-repo, partial — admin SELECT policy + grant convention only):** `supabase/migrations/20260424120500_create_analytics_events.sql`.

**Header comment + idempotency pattern** (lines 1–10):
```sql
-- Phase 1 / INFR-05 — Provision analytics_events + admin SELECT RLS.
-- Mirrors TPC AI Cataloger extension migration 001 (applied to shared Supabase
-- project on 2026-04-21) so this file is a no-op on the live table and a
-- clean create against a fresh project.
```
For Phase 2 RPC migration: open with the Phase + decision references (D-12, D-01, D-02, D-03, D-13, D-15) and the invariant warning ("every RPC scopes by app_source = 'tpc-extension'").

**Grant pattern** (lines 71–72):
```sql
-- Explicit grants (D-23). Supabase applies default grants but we document
-- them here for forensics + to survive any future role-default rework.
grant insert on public.analytics_events to anon;
grant select on public.analytics_events to authenticated;
```
Apply per RPC: `grant execute on function public.<name>(<arg_types>) to authenticated;` (RESEARCH Pitfall 9).

**Idempotency idiom for RPCs** — **NOT in existing migration**; comes from RESEARCH:
```sql
create or replace function public.<name>(...)
language sql stable security invoker
as $$ ... $$;
```
`create or replace function` is idempotent on re-run (replaces the body); `drop policy if exists` + `create policy` is the existing analog idempotency pattern but only applies to policies.

**Canonical RPC body** — RESEARCH.md Pattern 1 (`02-RESEARCH.md` lines 286–349) for `get_event_volume_daily`:
```sql
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
**Load-bearing details (RESEARCH Pitfalls 1, 2, 6, 7):**
- `date_trunc('day', x, 'America/New_York')` — 3-arg form returns `timestamptz`. NOT 2-arg `... AT TIME ZONE 'America/New_York'`.
- `cardinality(p_users) = 0 OR ... = any(p_users)` — empty array means "no filter"; defaults `array[]::text[]` make argument-absent equivalent to empty.
- `app_source = 'tpc-extension'` predicate appears in EVERY scoped CTE.
- `event_type IN (5 vocab)` predicate excludes `catalog_item`.

**Other RPC bodies:** RESEARCH.md Pattern 2 for `get_kpi_totals` (lines 358–443), and Q5 § lines 996–1170 for `get_error_rate_by_type`, `get_per_user_summary`, `get_dominant_version`, `get_cancellation_rates`. Each follows the same `language sql stable security invoker` + `grant execute` skeleton.

---

### `src/App.tsx` (modification)

**Self-analog** (lines 22–32):
```typescript
return (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<HomePage />} />
        {KitPage && <Route path="/kit" element={<KitPage />} />}
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
```
**Modification:** Add `<Route path="/extension" element={<ExtensionPage />} />` next to the `HomePage` line, inside the `<DashboardLayout>` group. Import `ExtensionPage` from `'./pages/Extension'`. **Do NOT** wrap in `import.meta.env.DEV` — this is admin-facing, not dev-only (CONTEXT § Integration Points).

---

### `src/layouts/DashboardLayout.tsx` (modification)

**Self-analog** (line 24):
```typescript
const NAV_ITEMS: NavItem[] = [];
```
**Modification:** Append the first entry. Icon is Heroicons `chart-bar` (UI-SPEC § Open Items: nav icon committed). The render loop (lines 53–93) already supports `item.to` (NavLink) vs no-to (disabled placeholder); use the `item.to` branch:
```typescript
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Extension',
    to: '/extension',
    Icon: () => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];
```
Active styling already locked at lines 62–67 (`text-accent border-l-2 border-accent bg-accent/5`).

---

## Shared Patterns

### Pattern A: Inline Heroicons SVG (no package dep)
**Source:** `src/components/SortIndicator.tsx` lines 22–82, `src/components/FilterInput.tsx` lines 56–72, `src/components/BackLink.tsx` lines 21–35.
**Apply to:** `LiveEventFeed.tsx` (pause/play icons), `DashboardLayout.tsx` modification (chart-bar icon), `DeveloperPanel.tsx` (chevron — reuse SortIndicator's chevron-down d-string), any new component needing icons.
```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
  strokeWidth={1.5}
  stroke="currentColor"
  className="w-4 h-4"
  aria-hidden="true"
>
  <path strokeLinecap="round" strokeLinejoin="round" d="..." />
</svg>
```
Stroke-width 1.5, `aria-hidden="true"`, `currentColor` so parent `text-*` controls color.

### Pattern B: Tailwind border-card with `rounded-lg border border-gray-200 bg-white`
**Source:** `src/components/kit/KpiCard.tsx` line 63, `src/components/EmptyState.tsx` line 16, `src/components/ErrorState.tsx` line 16.
**Apply to:** Every chart card (`EventVolumeChart`, `ErrorRateChart`), every table card (`PerUserTable`, `RecentErrorsTable`), `LiveEventFeed`, `DeveloperPanel`.
```tsx
<section className="rounded-lg border border-gray-200 bg-white p-4">
  ...
</section>
```
Phase 2 introduces zero new card-chrome variants — UI-SPEC § Color "Borders and radius" already locks this.

### Pattern C: Auth-store selector for profile reads
**Source:** `src/layouts/DashboardLayout.tsx` lines 27–29, `src/stores/authStore.ts` (store definition).
**Apply to:** `DeveloperPanel.tsx`, `RecentErrorsTable.tsx` (row-click gating), `LiveEventFeed.tsx` (row-click gating).
```typescript
import { useAuthStore } from '../../stores/authStore';
const profile = useAuthStore(s => s.profile);
// or, narrowly:
const email = useAuthStore(s => s.profile?.email);
```
Selector form (`s => s.profile`) is the established pattern (NOT `useAuthStore().profile`). Zustand subscribes to that selector and re-renders only when the slice changes. RESEARCH Pitfall 10: profile is `null` during initial render; component re-renders when it loads.

### Pattern D: TanStack Query queryFn error-throw pattern
**Source:** RESEARCH.md "Code Examples" § Supabase RPC call (lines 826–834) + existing `src/stores/authStore.ts` lines 63–64 pattern (console.error for non-Query consumers).
**Apply to:** Every hook/service function in `src/services/extension/queries.ts` and `src/hooks/extension/*.ts`.
```typescript
const { data, error } = await supabase.from(...).select(...);
if (error) throw error;
return data ?? [];
```
**Critical:** TanStack Query catches the throw and surfaces `error` on the `useQuery` result. Do NOT swallow with `console.error` inside a queryFn — that loses the error from the consumer.

### Pattern E: Test wrapper for hooks needing router + auth
**Source:** `src/hooks/useDateRange.test.tsx` lines 9–19 (router wrapper).
**Apply to:** `useUserFilter.test.ts`, `useVersionFilter.test.ts`, every hook test that reads URL or auth.
```typescript
function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    );
  };
}
```
For TanStack Query hooks (the new RPC hooks), wrap `<MemoryRouter>` inside a `<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>` — `src/main.tsx` lines 12–20 shows the production config; tests use `retry:false` to fail fast.

### Pattern F: Recharts JSDom mock (Sparkline.test.tsx)
**Source:** `src/components/kit/Sparkline.test.tsx` lines 13–32 (verbatim above).
**Apply to:** Every chart-rendering component test: `EventVolumeChart.test.tsx`, `ErrorRateChart.test.tsx`. The mock is reusable across `LineChart`, `BarChart` (stacked included), and any other Recharts chart (RESEARCH § Recharts JSDom mock confirmation).

### Pattern G: `app_source = 'tpc-extension'` invariant scope (D-01)
**Source:** RESEARCH.md "Code Examples" § Supabase RPC call (lines 843, 862) + Pitfall 6.
**Apply to:** Every `.from('analytics_events')` in `services/extension/queries.ts` and every CTE in the RPC migration.
- TS: `.eq('app_source', 'tpc-extension')`
- SQL: `where app_source = 'tpc-extension'`
JSDoc warning at top of `queries.ts` and SQL comment at top of migration are mandatory per CONTEXT § Specifics ("most-likely-to-be-forgotten invariant").

### Pattern H: 5-event-vocab predicate (D-02)
**Source:** RESEARCH Pattern 1 lines 326–329, Pattern 2 lines 399–402, "Code Examples" lines 845–848.
**Apply to:** Every aggregation CTE + every Recent Errors `.in('event_type', ...)`. Excludes `catalog_item`.
- TS: `.in('event_type', ['catalog_single','catalog_batch','portal_upload','spreadsheet_transform','data_import'])`
- SQL: `event_type in ('catalog_single', 'catalog_batch', 'portal_upload', 'spreadsheet_transform', 'data_import')`

### Pattern I: Empty-array-as-no-filter idiom (Pitfall 2)
**Source:** RESEARCH Patterns 1/2 + Pitfall 2.
**Apply to:** Every RPC arg pair `p_users / p_versions`.
- SQL: `(cardinality(p_users) = 0 or user_email = any(p_users))`
- SQL defaults: `p_users text[] default array[]::text[]`
- TS callers: ALWAYS pass `string[]`, never `undefined` (`useUserFilter` returns `string[]` by construction).

---

## No Analog Found

Files where the closest match is research-only (no in-repo precedent) — planner should reference RESEARCH.md sections directly:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/extension/PerUserTable.tsx` | component (table) | request-response | TanStack Table v8 is a NEW dependency; no in-repo analog exists. Use RESEARCH lines 730–805 verbatim as the analog source. |
| `src/components/extension/RecentErrorsTable.tsx` | component (table + modal trigger) | request-response | Same TanStack Table reason as above. Modal-trigger half borrows from `PayloadViewerModal.tsx` consumer pattern in `Kit.tsx` lines 134–146. |
| All 9 hooks in `src/hooks/extension/` (except useUserFilter, useVersionFilter) | hook (TanStack Query) | request-response / streaming | `useDateRange.ts` is a `useSearchParams` hook, not a TanStack Query hook. The first TanStack Query hooks land in Phase 2; analog is RESEARCH Patterns 3, 4, 5. |
| `src/services/extension/queries.ts` | service | request-response | First dedicated `services/` module; partial analog from `authStore.ts` `.from().select()` lines 55–68 + RESEARCH "Code Examples" lines 810–871. |
| RPC bodies inside `supabase/migrations/<ts>_create_extension_rpcs.sql` | migration | n/a | Existing analytics_events migration is table+RLS only; no RPCs in repo. Use RESEARCH Patterns 1, 2, Q5 verbatim. The migration's grant + idempotency idiom DOES come from the existing migration. |
| `src/lib/devAccess.ts` | utility | n/a | First allowlist module. RESEARCH lines 875–889 is the canonical excerpt. |
| `src/lib/format.ts` | utility | n/a | UI-SPEC describes it as a v1.0 carryover but `Glob` confirms it does not exist. Phase 2 must create it; pattern borrowed from `useTimezone.ts` formatter idiom. |

---

## Metadata

**Analog search scope:**
- `src/` — all hooks, components, pages, layouts, stores, lib, services
- `supabase/migrations/` — all 17 existing migrations
- `.planning/phases/02-extension-analytics-extension/` — CONTEXT, RESEARCH, UI-SPEC

**Files scanned:** 38 source files via Glob + 17 migrations + 4 phase docs (CONTEXT, RESEARCH first 1000 lines, UI-SPEC, this PATTERNS draft)

**Pattern extraction date:** 2026-04-29

**Stack version pins consulted:** `recharts@^3.8.1`, `@tanstack/react-query@^5.99.2`, `@tanstack/react-table@^8.21.3` (NEW), `@supabase/supabase-js@^2.101.1`, `react-router@^7.13.1`, `date-fns-tz@^3.2.0`, `vitest@^4.0.18` — all from `CLAUDE.md § Technology Stack` and `02-RESEARCH.md § Standard Stack`.
