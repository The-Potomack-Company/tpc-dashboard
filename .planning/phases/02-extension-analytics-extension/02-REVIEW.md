---
phase: 02-extension-analytics-extension
reviewed: 2026-04-30T15:23:02Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - supabase/migrations/20260429120000_create_extension_rpcs.sql
  - scripts/verify-extension-app-source-scope.mjs
  - src/services/extension/queries.ts
  - src/hooks/extension/useUserFilter.ts
  - src/hooks/extension/useVersionFilter.ts
  - src/lib/devAccess.ts
  - src/lib/format.ts
  - src/hooks/extension/useExtensionGate.ts
  - src/hooks/extension/useEventVolume.ts
  - src/hooks/extension/useKpiTotals.ts
  - src/hooks/extension/useErrorRate.ts
  - src/hooks/extension/usePerUserSummary.ts
  - src/hooks/extension/useRecentErrors.ts
  - src/hooks/extension/useDominantVersion.ts
  - src/hooks/extension/useCancellationRates.ts
  - src/hooks/extension/useDistinctVersions.ts
  - src/hooks/extension/useLiveFeed.ts
  - src/components/extension/EventVolumeChart.tsx
  - src/components/extension/KpiStrip.tsx
  - src/components/extension/ErrorRateChart.tsx
  - src/components/extension/computeFlippedDelta.ts
  - src/components/extension/CancellationRateKpis.tsx
  - src/components/extension/DominantVersionBadge.tsx
  - src/components/extension/ExtensionVersionFilter.tsx
  - src/components/extension/DeveloperPanel.tsx
  - src/components/extension/PerUserTable.tsx
  - src/components/extension/RecentErrorsTable.tsx
  - src/components/extension/LiveEventFeed.tsx
  - src/components/UserMultiSelect.tsx
  - src/pages/Extension.tsx
  - src/pages/Extension.smoke.test.tsx
  - src/App.tsx
  - src/layouts/DashboardLayout.tsx
findings:
  blocker: 0
  warning: 6
  info: 6
  total: 12
status: findings
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-30T15:23:02Z
**Depth:** standard
**Files Reviewed:** 32 (Phase 2 source surface; auto-generated `database.types.ts` + the `*.test.{ts,tsx}` colocated suites read for context but not in scope per review-scope rules)
**Status:** findings (no BLOCKERs; 6 WARNINGs, 6 INFOs)

## Summary

Phase 2 ships a clean, internally consistent extension-analytics surface. The D-01 invariant (`app_source = 'tpc-extension'`) is enforced at three layers: the static SQL grep verifier, every RPC's scoped CTE, and the four raw `.from('analytics_events')` builders in `queries.ts`. The D-15 dev gate (`isDevAccount(...) ? subtree : null`) is a render-conditional, never `display:hidden`. The `useLiveFeed` hook implements the function-form `refetchInterval` + Resume-invalidate pattern correctly. The previous_rate runtime null-check (D-05 NULLIF semantics) is honored in `CancellationRateKpis`. No service-role key, no `as any`, no `eval`, no `dangerouslySetInnerHTML`, no `console.log` debris in the Phase 2 source.

That said, the review surfaced 6 WARNING-class defects worth addressing before sign-off:

- A semver tie-break ordering in `get_dominant_version` that returns the wrong version when minor numbers cross 9→10 (`1.10.0` reads as older than `1.9.0`).
- A boundary-inclusivity mismatch between the SQL aggregations (half-open `created_at < p_to`) and the raw `fetchRecentErrors` builder (`.lte('created_at', to)` — closed interval). For the same `to` argument, the table can show one extra row that the EXT-03 chart aggregates miss.
- `KpiStrip` hides the delta chip whenever `cur === 0`, masking the most important regression signal (events dropped to zero).
- `useExtensionGate` returns an `error` field that no consumer reads; on probe failure the page falls through to the ready branch and quietly mounts the full chart tree.
- A copy-paste bug in `DeveloperPanel`'s auth selector type cast widens `email` from `string | null` (the actual `profiles.Row.email` type) to a custom shape that drifts from the store contract.
- The `ExtensionVersionFilter` lexicographic sort fails for the same 9→10 reason; tracks the SQL bug but is its own rendering concern.

INFO items are scoped to type-cast hygiene, dead code, and one mojibake string in retired NAV_ITEMS code.

## Warnings

### WR-01: Semver tie-break in `get_dominant_version` returns wrong version on minor 9→10 crossover

**File:** `supabase/migrations/20260429120000_create_extension_rpcs.sql:336-340`
**Severity:** WARNING
**Issue:** The dominant-version tie-break uses `string_to_array(extension_version, '.') desc nulls last`. PostgreSQL compares text arrays element-by-element with text (lexicographic) ordering — not numeric. So `string_to_array('1.10.0','.') = {1,10,0}` compared to `{1,9,0}` yields `'10' < '9'` (because `'1' < '9'`), and `1.9.0` is reported as the dominant version when `1.10.0` exists with the same event count. The migration header acknowledges this trade-off as "Open Question 5", but with v2.x rollout in flight, the very next minor bump (`2.10.x`) silently inverts the semver chip. This is observable end-user-facing data once 2.10 ships.
**Fix:**
```sql
-- Convert each segment to integer when possible; non-numeric suffixes (e.g. '2.0.0-rc1')
-- still receive a stable but undefined ordering, which is acceptable per Open Question 5.
order by
  count(*) desc,
  (string_to_array(extension_version, '.'))::int[] desc nulls last
-- Or, if non-numeric segments are expected, use a regex extraction:
--   array(select coalesce(nullif(regexp_replace(p, '\D', '', 'g'), '')::int, 0)
--         from unnest(string_to_array(extension_version, '.')) p) desc
```

### WR-02: Boundary-inclusivity mismatch between RPC aggregates (half-open) and `fetchRecentErrors` raw select (closed)

**File:** `src/services/extension/queries.ts:196-198`
**Severity:** WARNING
**Issue:** Every aggregation RPC in the migration uses `created_at < p_to` (half-open right boundary, line 68/140/215/276/327/392). `fetchRecentErrors` uses `.gte('created_at', from.toISOString()).lte('created_at', to.toISOString())` — a CLOSED upper bound. For the same `to`, the table can include one row that the EXT-03 error-rate chart aggregates exclude. Worst case at the boundary instant of `useDateRange`'s `endOfDay(now)` (which is `23:59:59.999`), but for any caller passing exact-step boundaries, the table count drifts from chart counts. Same bug for `fetchExtensionGate` (line 235 has no upper bound, so unaffected) and `fetchLiveFeed` (no bounds, unaffected). Only `fetchRecentErrors` is wrong.
**Fix:**
```ts
let q = supabase
  .from('analytics_events')
  .select('id, created_at, user_email, event_type, error_message, extension_version, items_content')
  .eq('app_source', 'tpc-extension')
  .not('error_message', 'is', null)
  .in('event_type', EXTENSION_EVENT_TYPES as unknown as string[])
  .gte('created_at', args.from.toISOString())
  .lt('created_at', args.to.toISOString())  // change .lte → .lt to match RPC half-open convention
  .order('created_at', { ascending: false })
  .limit(args.limit ?? 100);
```

### WR-03: `KpiStrip` hides delta chip when `cur === 0`, masking events-dropped-to-zero regression

**File:** `src/components/extension/KpiStrip.tsx:82-83`
**Severity:** WARNING
**Issue:** `const value = cur > 0 ? formatCount(cur) : EMPTY; const delta = cur > 0 ? computeDelta(cur, prev) : undefined;` — if the previous period had 50 events and the current period has 0, the card renders `—` with no delta chip, hiding the most operationally important signal (a feature went dark). The `computeDelta` helper already handles `current === previous === 0` (returns flat) and `previous === 0` (absolute delta with direction), so showing a `-100%` / `-50` delta when prev > 0 and cur === 0 is the natural extension. Decision was undocumented in the plan / SUMMARY.
**Fix:**
```tsx
const row = rowFor(query.data, type);
const cur = Number(row?.current_count ?? 0);
const prev = Number(row?.previous_count ?? 0);
const sparkData = (row?.sparkline as SparkPoint[] | null | undefined) ?? [];
const value = cur > 0 ? formatCount(cur) : EMPTY;
// Show delta whenever either period had activity — `cur === 0 && prev > 0` is the
// most important signal a card can carry (events stopped flowing).
const delta = (cur > 0 || prev > 0) ? computeDelta(cur, prev) : undefined;
const sparkline = sparkData.length > 0 ? <Sparkline data={sparkData} /> : undefined;
```

### WR-04: `useExtensionGate` returns `error` but no consumer reads it; gate-probe failure silently falls through to chart mount

**File:** `src/hooks/extension/useExtensionGate.ts:19-23` and `src/pages/Extension.tsx:62-99`
**Severity:** WARNING
**Issue:** `useExtensionGate` exposes `{ isLoading, isEmpty, error }`. `Extension.tsx` reads `gate.isLoading` and `gate.isEmpty` but never `gate.error`. When the gate probe fails (RLS reject mid-session, transient network hiccup, etc.), `q.isLoading` flips to false and `q.data` stays `undefined`, so `isEmpty = !q.isLoading && !q.error && q.data?.hasAny === false` evaluates to **false** (because `!q.error` is `false`). The page then silently mounts the full chart composition, every per-card hook fires its own request and either succeeds (best case) or surfaces 8+ red ErrorState cards (worst case). The `Extension.smoke.test.tsx` `'does not crash when gate probe errors'` test only asserts no-throw, not behavior. This is acceptable for resilience but undocumented and confusing for the operator.
**Fix:**
```tsx
// In Extension.tsx, after the empty/loading branches:
if (gate.error) {
  return (
    <>
      <PageHeader />
      <ErrorState
        heading="Couldn't reach the analytics database"
        body="The page-level data probe failed. Refresh to retry."
        onRetry={() => window.location.reload()}
      />
    </>
  );
}
// …then the existing ready branch.
```
Alternatively, suppress the `error` field on the hook return if the design intent is to treat probe-failure as "render anyway and let per-card errors bubble up" — but document that decision.

### WR-05: `DeveloperPanel` auth-store selector cast diverges from real `Profile.email` type (`string | null`)

**File:** `src/components/extension/DeveloperPanel.tsx:47`
**Severity:** WARNING
**Issue:** The selector `useAuthStore((s) => (s as { profile: { email: string | null } | null }).profile?.email ?? null)` reaches into the store via an inline shape cast instead of importing `AuthState` from `../../stores/authStore`. This works today because the cast happens to match (`Profile.email = string | null` per `database.types.ts:288`), but `LiveEventFeed.tsx:118` does the same trick with a DIFFERENT shape: `(s as { profile: { email?: string } | null })`, where `email?: string` (optional) is structurally INCOMPATIBLE with the real `string | null` (required). The two cast variants drift; nothing prevents them from drifting further (e.g., a future contributor types `email: string` and removes the null branch). Because both bypass the real `AuthState` type, TypeScript can't catch the divergence.
**Fix:**
```tsx
import { useAuthStore } from '../../stores/authStore';

// Use the authStore's exported selector style — the inferred type flows from the store.
const email = useAuthStore((s) => s.profile?.email ?? null);
```
Apply identical change in `LiveEventFeed.tsx:118` (drop the `email?: string` cast). `RecentErrorsTable.tsx:47` already does the right thing (`useAuthStore((s) => s.profile?.email)` without a cast) — that's the canonical form.

### WR-06: `ExtensionVersionFilter` sorts versions lexicographically (same 9→10 bug as WR-01)

**File:** `src/components/extension/ExtensionVersionFilter.tsx:28`
**Severity:** WARNING
**Issue:** `[...set].sort().reverse()` is plain string sort, descending. `'2.10.0'` will sort BEFORE `'2.9.0'` in descending lexicographic order — wait, that's what we want? No: `'2.10.0'.localeCompare('2.9.0') < 0` because character 2 is `'1'` vs `'9'`, so `'2.10.0' < '2.9.0'`, and after `.reverse()` we get `['2.9.0', '2.10.0']` — newest version (`2.10.0`) sorts BELOW older `2.9.0` in the popover. Cosmetic but confusing for devs comparing 2.x → 2.10. Mirror of the SQL bug (WR-01) at the rendering layer.
**Fix:**
```ts
const options = useMemo(() => {
  const set = new Set<string>(selected);
  for (const v of rows ?? []) set.add(v);
  // Numeric-aware sort so 2.10.0 > 2.9.0; falls back to localeCompare for non-numeric
  // suffixes (e.g. release candidates), preserving stability.
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  ).reverse();
}, [rows, selected]);
```

## Info

### IN-01: `DEV_EMAILS.includes(email.toLowerCase())` works only because `DEV_EMAILS` is lowercase

**File:** `src/lib/devAccess.ts:5-13`
**Severity:** INFO
**Issue:** `DEV_EMAILS = ['josh@potomackco.com']` (lowercase). The check is `DEV_EMAILS.includes(email.toLowerCase())` — case-insensitive on the input but not on the source. If a future contributor adds `'Josh@PotomackCo.com'` to the array, the comparison silently fails. Defensive fix: lowercase both sides at use, or freeze the array contents at module load.
**Fix:**
```ts
const DEV_EMAILS_LC: ReadonlyArray<string> = [
  'josh@potomackco.com',
].map((e) => e.toLowerCase());
export const DEV_EMAILS = DEV_EMAILS_LC; // exported lowercase shape
export function isDevAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEV_EMAILS_LC.includes(email.toLowerCase());
}
```

### IN-02: `coalesce(count(s.*), 0)` is redundant — `count()` never returns NULL

**File:** `supabase/migrations/20260429120000_create_extension_rpcs.sql:75`
**Severity:** INFO
**Issue:** `coalesce(count(s.*), 0)::bigint` — Postgres' `count()` always returns 0 when the input set is empty, never NULL. The `coalesce` wrap is a no-op. Harmless but noisy.
**Fix:**
```sql
count(s.*)::bigint as event_count
```

### IN-03: `nulls last` on `string_to_array` is dead — input is `where extension_version is not null`

**File:** `supabase/migrations/20260429120000_create_extension_rpcs.sql:339`
**Severity:** INFO
**Issue:** The `scoped` CTE filters `extension_version is not null` (line 335), and the outer `select` further restricts to non-null. By the time `string_to_array(extension_version, '.')` is computed, the input can never be NULL — the `nulls last` clause is unreachable. Remove for clarity (after fixing WR-01).
**Fix:**
```sql
order by
  count(*) desc,
  (string_to_array(extension_version, '.'))::int[] desc
```

### IN-04: Latin-1-mojibake em-dash in `DashboardLayout.tsx` placeholder title (currently dead path)

**File:** `src/layouts/DashboardLayout.tsx:101`
**Severity:** INFO
**Issue:** `title={`${item.label} â€” Coming soon`}` — the literal string contains the bytes `â€"` which is the canonical Latin-1 misinterpretation of UTF-8 `—` (U+2014). All NAV_ITEMS in this file currently have a `to` field, so the `else` branch (line 97-113) never renders, and end users see nothing. But the moment Phase 3 or Phase 5 adds a placeholder entry without `to`, every admin sees `Activity â€" Coming soon` in the tooltip.
**Fix:**
```tsx
title={`${item.label} — Coming soon`}  // U+2014 em-dash, written directly in UTF-8
// or, if the file's encoding is suspect:
title={`${item.label} — Coming soon`}
```

### IN-05: `LabelList content` cast in `ErrorRateChart` is `as unknown as (props: unknown) => ReactElement`

**File:** `src/components/extension/ErrorRateChart.tsx:125`
**Severity:** INFO
**Issue:** Double-cast through `unknown` defeats the type checker entirely. The `LabelContentProps` interface above is sound; Recharts' `LabelList.content` actually accepts `(props: object) => ReactNode`. A simpler `as React.FunctionComponent<LabelContentProps>` cast or a direct `(props: object) => ReactElement` works without `unknown`.
**Fix:**
```ts
import type { ReactNode } from 'react';
function renderRateLabel(props: LabelContentProps): ReactNode { /* ... */ }
// then in JSX:
<LabelList dataKey="rate_pct" content={renderRateLabel} />
```
Recharts' types accept `(props: object) => ReactNode` for `content`, which `renderRateLabel` satisfies after the signature change.

### IN-06: `error_message` cell uses `truncate` on a `<span>` inside an unconstrained-width `<td>`

**File:** `src/components/extension/RecentErrorsTable.tsx:90-93`
**Severity:** INFO
**Issue:** Tailwind's `truncate` (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) only ellipsizes when the parent constrains width. The parent `<td>` here has no `max-w-*` class — it grows to the natural width of its content. Combined with the column-width hint `w-full` (one of the entries in `COLUMN_WIDTHS`), the column will absorb available space, and very long error strings can blow out the table layout. Cosmetic only.
**Fix:**
```tsx
{
  accessorKey: 'error_message',
  header: 'Error',
  cell: (info) => (
    <span
      className="block max-w-xs truncate text-red-600"
      title={info.getValue<string | null>() ?? undefined}
    >
      {info.getValue<string | null>() ?? EMPTY}
    </span>
  ),
},
```

---

_Reviewed: 2026-04-30T15:23:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
