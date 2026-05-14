---
phase: 03-tpc-app-activity-activity
plan: 04
subsystem: ui-right-now-widgets
tags: [react, tanstack-table-v8, kpi-strip, severity-toned-alert, right-now-widgets, react-router, tdd, locked-error-state-contract]

# Dependency graph
requires:
  - plan: 03-02 (Wave 1)
    provides: "src/lib/severity.ts (classifyStuckSeverity, STUCK_ITEMS_TONE), src/lib/format.ts extensions (formatAge, formatTimestampShort, EMPTY), verify-activity-error-state-contract.mjs verifier"
  - plan: 03-03 (Wave 2)
    provides: "useTodayKpis, useActiveSessions, useStuckItems hooks (right-now class — ignore ?range=, apply ?specialists= and ?mode=); ActiveSessionsRow / StuckItemsRow / TodayKpisRow types from src/services/activity/queries.ts"
  - phase: 01 (Phase 1 primitives)
    provides: "KpiCard (kit/), ErrorState, EmptyState, TableSkeleton, SortIndicator (locked contracts)"
  - phase: 02 (Phase 2 patterns)
    provides: "src/components/extension/KpiStrip.tsx computeDelta semantics; src/components/extension/PerUserTable.tsx TanStack Table v8 boilerplate; src/components/extension/LiveEventFeed.tsx green pulsing right-now indicator pip"
provides:
  - "src/components/activity/TodayKpiStrip.tsx — APP-01 right-now KPI strip ('Today's Snapshot')"
  - "src/components/activity/ActiveSessionsTable.tsx — APP-02 right-now active-sessions sortable table"
  - "src/components/activity/StuckItemsAlertCard.tsx — APP-11 right-now severity-toned alert card"
  - "Right-now indicator pip pattern reused verbatim from Phase 2 LiveEventFeed (green-500, h-2 w-2 rounded-full, motion-safe:animate-pulse, sr-only Live)"
  - "Plan 03-08 (Activity page composition) can mount these 3 components directly — no parent props required; each is fully self-contained"
affects: [03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-card data ownership: each component mounts its own activity hook, surfaces its own loading / empty / error state — D-35 locked ErrorState contract honored verbatim (no children, no sibling Retry)"
    - "Phase 3 right-now indicator pip: <span aria-hidden bg-green-500 motion-safe:animate-pulse /> + <span sr-only>Live</span> — reused verbatim from src/components/extension/LiveEventFeed.tsx:151-159; planted on Today KPI strip section header AND Active Sessions section header (NOT on Stuck Items card per D-22)"
    - "TodayKpiStrip computeDelta: same direction semantics as Phase 2 KpiStrip — current==previous → flat; previous===0 → absolute delta with direction; otherwise pct delta. Zero-current with positive-previous → 'down' (KpiCard renders text-red-600)"
    - "TanStack Table v8 default sort = age desc (oldest first per UI-SPEC). Custom sortingFn returns b.created_at - a.created_at so the desc=true flag inverts to oldest-first"
    - "Full-row click target with keyboard activation: tabIndex=0 + onClick + onKeyDown(Enter|Space) + focus:ring-2 focus:ring-accent — accessible row navigation pattern"
    - "StuckItemsAlertCard derives count + oldestAgeHours client-side from useStuckItems().data (count = length; oldestAgeHours = max(age_seconds/3600))"
    - "min-h-[6rem] preserved across all 4 StuckItemsAlertCard states (none / yellow / red / loading / error) per D-22 quiet-success no-reflow rule"

key-files:
  created:
    - "src/components/activity/TodayKpiStrip.tsx (183 lines)"
    - "src/components/activity/TodayKpiStrip.test.tsx (178 lines, 9 tests)"
    - "src/components/activity/ActiveSessionsTable.tsx (237 lines)"
    - "src/components/activity/ActiveSessionsTable.test.tsx (272 lines, 11 tests)"
    - "src/components/activity/StuckItemsAlertCard.tsx (176 lines)"
    - "src/components/activity/StuckItemsAlertCard.test.tsx (328 lines, 11 tests)"
  modified: []

decisions:
  - "TodayKpiStrip uses formatPercent(rate) where rate = Math.round((num/denom) * 1000) / 10 for 1-decimal precision per UI-SPEC § Numeric formatting (e.g. items_done=80 / items_total=100 renders '80.0%'). The same 1-decimal rate is fed to computeDelta so the % AI done card's delta compares (today_rate, yday_rate)"
  - "TodayKpiStrip % AI done card omits the delta entirely when items_total_today === 0 (no rate to compare). Value renders EMPTY (em-dash). Today_total > 0 with yesterday_total === 0 falls into the previous===0 branch of computeDelta which surfaces an absolute +pct value with 'up' direction"
  - "ActiveSessionsTable sortingFn: TanStack Table v8 inverts the comparator when desc=true. To get oldest-first under {id:'age', desc:true}, the comparator returns b.created_at - a.created_at (asc base = newest-first; desc reverses to oldest-first)"
  - "Row tabIndex={0} + Enter/Space onKeyDown handler instead of nesting an interactive element inside <td>. Avoids the React 'button-in-button' anti-pattern and matches the UI-SPEC 'full row is the click target' requirement"
  - "StuckItemsAlertCard.tsx uses inline Heroicons SVGs (clipboard-document-list + exclamation-triangle) — same convention as src/components/SortIndicator.tsx — to avoid pulling in a new heroicons package dependency"
  - "Loading and error containers for StuckItemsAlertCard use bg-white border border-gray-200 (same as 'none' state) so the card silhouette stays stable through all transitions per D-22"

# Metrics
metrics:
  duration_minutes: 7
  tasks_completed: 2
  files_created: 6
  files_modified: 0
  tests_added: 31
  commit_count: 6
---

# Phase 3 Plan 04: Right-Now Activity Widgets Summary

Three self-contained right-now widgets land on `/activity`: the Today KPI strip (4 KpiCards with today-vs-yesterday deltas), the Active Sessions sortable table (TanStack Table v8 with row-click navigation), and the Stuck Items severity-toned alert card (3 severity states + loading + error). Each component owns its data fetching via the Plan 03-03 hooks and surfaces its own loading/empty/error states under the locked D-35 ErrorState contract.

## What Was Built

### TodayKpiStrip (APP-01)

- 4 KpiCards in a `grid grid-cols-2 lg:grid-cols-4 gap-4` layout
- Card labels: `Sessions today`, `Items today`, `Items exported today`, `% AI done today`
- Section header: `Today's Snapshot` + green pulsing right-now indicator pip + sr-only `Live`
- Delta label `vs yesterday` (D-14, N=1 day previous-period)
- Strip-level error renders one `<ErrorState>` inside a `<div className="col-span-full">` wrapper (Phase 2 KpiStrip idiom)
- NO sparklines (UI-SPEC § Per-Card Copy Contract: planner default — sparkline prop omitted on the 4 KpiCards)

### ActiveSessionsTable (APP-02)

- TanStack Table v8 with 7 columns: `Session | Mode | Specialist | Items | Created | Updated | Age`
- Default sort: `[{ id: 'age', desc: true }]` — oldest first per UI-SPEC
- Section header: `Active sessions` + green pulsing right-now pip + plural-correct subheading
- Row click + Enter/Space → `useNavigate('/activity/sessions/<row.session_id>')`
- Hover bg-gray-50; full row is click target; tabIndex={0} + focus:ring-2 focus:ring-accent
- Loading: `<TableSkeleton rows={5} columnWidths={['w-48','w-12','w-32','w-12','w-24','w-24','w-12']} />`
- Empty: `<EmptyState heading="No active sessions">The TPC team isn't cataloging right now.</EmptyState>`
- Error: locked `<ErrorState heading="Couldn't load active sessions" body="Retry below." onRetry={...} />`

### StuckItemsAlertCard (APP-11)

- Three severity states from `classifyStuckSeverity({ count, oldestAgeHours })`:
  - `none` (N=0): clipboard-document-list icon (gray-400), `bg-white border border-gray-200`, no left border, headline `No stuck items`, body `Last checked just now.`, no CTA
  - `yellow` (N≥1, oldest ≤ 6h): exclamation-triangle (amber-600), `bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500`, headline `{N} stuck items`, body `Oldest is {formatAge}.`, CTA `View {N} stuck items →`
  - `red` (oldest > 6h regardless of N): exclamation-triangle (red-600), `bg-red-50 border border-red-200 border-l-4 border-l-red-500`, body `Oldest is {formatAge} — needs attention.`, CTA `View {N} stuck items →`
- CTA navigates to `/activity/stuck` with NO preserved query params (D-23)
- `min-h-[6rem]` preserved across all 4 render states (D-22 no-reflow)
- Loading: 4-line shimmer with `motion-safe:animate-pulse`
- Error: locked `<ErrorState heading="Couldn't check for stuck items" body="The query failed. Retry below." onRetry={...} />` inside `min-h-[6rem]` wrapper
- NO `motion-safe:animate-pulse` on the alert body when not loading (D-22: severity tone is enough)

## Right-now Indicator Pip — Verbatim Match

The pip pattern is **identical** to Phase 2 `src/components/extension/LiveEventFeed.tsx:151-159`:

```tsx
<span
  aria-hidden="true"
  className="h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse"
/>
<span className="sr-only">Live</span>
```

Both `<TodayKpiStrip>` and `<ActiveSessionsTable>` mount this pip in their section header. `<StuckItemsAlertCard>` does NOT mount it — that card uses severity tone instead per D-22.

## % AI done formatPercent — Exact Call Shape

```ts
const pct = Math.round((items_done_today / items_total_today) * 1000) / 10; // 1-decimal
formatPercent(pct);
// → '80.0%'  (when num=80, denom=100)
// → '87.4%'  (when num=80, denom=91.5 — though counts are integers, the rate is a float)
```

`formatPercent` (in `src/lib/format.ts`) takes a `number` and returns `${n.toFixed(decimals)}%` with `decimals` defaulting to 1. The Today strip honors that default, producing 1-decimal precision matching UI-SPEC § Numeric formatting.

When `items_total_today === 0`:
- Value renders `EMPTY` (em-dash) instead of a percent
- Delta is omitted entirely (no rate to compare)

## TDD Cycle

| Task | Component | RED commit | GREEN commit | Tests |
|------|-----------|-----------|-------------|-------|
| 1a | TodayKpiStrip | `f7645aa` | `265033b` | 9 |
| 1b | ActiveSessionsTable | `05a8640` | `bf9cacf` | 11 |
| 2 | StuckItemsAlertCard | `f9f4dd6` | `5a14d63` | 11 |

Total: 31 tests, all green. Each RED commit confirmed test failure (import resolution error → file does not exist), each GREEN commit confirmed all tests pass + `tsc -b` clean.

## TDD Gate Compliance

Both tasks follow the RED → GREEN sequence:
- Task 1 (TodayKpiStrip): `test(03-04)` commit `f7645aa` precedes `feat(03-04)` commit `265033b`
- Task 1 (ActiveSessionsTable): `test(03-04)` commit `05a8640` precedes `feat(03-04)` commit `bf9cacf`
- Task 2 (StuckItemsAlertCard): `test(03-04)` commit `f9f4dd6` precedes `feat(03-04)` commit `5a14d63`

No REFACTOR commits — green code already aligned with UI-SPEC and existing patterns; no cleanup needed.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/components/activity/{TodayKpiStrip,ActiveSessionsTable,StuckItemsAlertCard}.test.tsx` | 3 files passed, 31 tests passed |
| `npx tsc -b` | Clean (no type errors) |
| `npm run prebuild` (all 11 verifiers) | All OK — including `verify-activity-error-state-contract` confirming 3 files scanned with all 3 props on every `<ErrorState>` and no sibling Retry siblings |

## Deviations from Plan

None — UI-SPEC § APP-01 / APP-02 / APP-11 implemented verbatim. The 31 tests (vs 27 planned) come from minor granularity additions (e.g. separate test for the singular "1 active session" subheading; separate test for keyboard Enter activation). No semantic deviations.

The plan suggested using `formatTimestampShort(info.getValue() as string)` in the cell renderer for Created/Updated columns; that is what was implemented — no change.

## Threat Surface Scan

No new threat surface introduced beyond the plan's `<threat_model>`:

- **T-03-21 (URL injection via session_id):** mitigated. `session_id` flows from server-returned `ActiveSessionsRow.session_id` (uuid from RPC) directly into `navigate(/activity/sessions/${session_id})`. No user input feeds the URL. RLS will gate access at the `/activity/sessions/:id` route.
- **T-03-22 (info disclosure of stuck count):** mitigated. Page is admin-only via `<ProtectedRoute>` from Phase 1; RLS on `items` and `sessions` enforces row-level access.
- **T-03-23 (overflow in delta):** accepted. `Number()` coerces bigint-as-string from supabase-js; realistic counts well below MAX_SAFE_INTEGER.

No new endpoints, no auth paths, no file/storage access, no schema changes. No `## Threat Flags` section needed.

## Self-Check: PASSED

**Files exist:**
- `src/components/activity/TodayKpiStrip.tsx` — FOUND
- `src/components/activity/TodayKpiStrip.test.tsx` — FOUND
- `src/components/activity/ActiveSessionsTable.tsx` — FOUND
- `src/components/activity/ActiveSessionsTable.test.tsx` — FOUND
- `src/components/activity/StuckItemsAlertCard.tsx` — FOUND
- `src/components/activity/StuckItemsAlertCard.test.tsx` — FOUND

**Commits exist:**
- `f7645aa` (test TodayKpiStrip RED) — FOUND
- `265033b` (feat TodayKpiStrip GREEN) — FOUND
- `05a8640` (test ActiveSessionsTable RED) — FOUND
- `bf9cacf` (feat ActiveSessionsTable GREEN) — FOUND
- `f9f4dd6` (test StuckItemsAlertCard RED) — FOUND
- `5a14d63` (feat StuckItemsAlertCard GREEN) — FOUND
