---
phase: 03-tpc-app-activity-activity
plan: 03
subsystem: data-access
tags: [react-hooks, tanstack-query, supabase, services-layer, query-key-namespacing, sorted-array-cache, filter-folding, jsdoc-verifier, tdd]

# Dependency graph
requires:
  - phase: 02-extension-analytics-extension
    provides: "Phase 2 services/hooks shape: services/extension/queries.ts (header invariant block + RPC wrapper pattern + raw .from() builder pattern), src/hooks/extension/* (sorted-array queryKey idiom, useLiveFeed pause/resume + invalidateQueries-on-resume contract, all-hooks-smoke harness)"
  - plan: 03-01 (Wave 1)
    provides: "13 typed RPC entries on Database['public']['Functions'] (Args + Returns), regenerated src/db/database.types.ts"
  - plan: 03-02 (Wave 1)
    provides: "useSpecialistFilter, useModeFilter, useDateRange URL primitives that this plan's hooks fold into queryKeys; verify-activity-filter-scope.mjs verifier (auto-passes when src/hooks/activity/ does not yet exist)"
provides:
  - "src/services/activity/queries.ts — single Supabase service module with 13 RPC wrappers + 4 raw .from() builders + defaultTodayKpisRow helper"
  - "16 hooks under src/hooks/activity/* — one per surface (chart, KPI strip, table, alert card, dev panel sub-panel, page-level loader)"
  - "queryKey namespace: every Phase 3 hook's queryKey root starts with 'activity' so cache invalidation can target the entire phase via queryClient.invalidateQueries({ queryKey: ['activity'] })"
  - "Filter-scope JSDoc convention: every hook carries @filterScope right-now | range-driven | fixed-window | live-tail | one-shot; enforced by verify-activity-filter-scope.mjs"
  - "Live-tail contract: useUiRecentEventsFeed mirrors Phase 2 useLiveFeed verbatim (10s poll + pause/resume + invalidateQueries-on-resume) — Pitfall 10 mitigated"
affects: [03-04, 03-05, 03-06, 03-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service-layer single-source-of-truth for Supabase calls: hooks NEVER call supabase.rpc / supabase.from; they import fetchX from services/activity/queries.ts"
    - "Sorted-array queryKey idiom (Pitfall 3): specialistsKey = [...specialists].sort() in queryKey; URL-order specialists at fetch boundary"
    - "queryKey namespacing: ['activity', '<feature>', { ...filters }] enables phase-scoped invalidation"
    - "Filter-scope JSDoc convention enforced by static verifier (right-now / range-driven / fixed-window / live-tail / one-shot)"
    - "Per-hook QueryClient default override (mirrors Phase 2 useLiveFeed): useUiRecentEventsFeed sets refetchInterval (function form) + staleTime: 0; pause/resume API wraps useState + invalidateQueries"
    - "Embedded count flatten: PostgREST `select('photos(count)')` returns photos: [{ count }]; service-layer fetchSessionItems flattens to photo_count: number per row"
    - "Defensive null narrow: fetchActiveSpecialists drops email-IS-NULL rows server-side AND filters JS-side so the return type is { id; email: string; display_name }"
    - "TDD discipline: every hook had a failing import in the smoke test before its implementation existed; queries.test.ts authored RED before queries.ts existed"

key-files:
  created:
    - "src/services/activity/queries.ts (424 lines — 13 RPC wrappers + 4 raw .from builders + defaultTodayKpisRow)"
    - "src/services/activity/queries.test.ts (432 lines — 21 tests covering D-19, D-32, D-33, D-34, D-16, D-17 invariants)"
    - "src/hooks/activity/useTodayKpis.ts (right-now)"
    - "src/hooks/activity/useActiveSessions.ts (right-now)"
    - "src/hooks/activity/useActiveSpecialists.ts (one-shot)"
    - "src/hooks/activity/useItemsPerSpecialist.ts (fixed-window — NO useDateRange import per D-16)"
    - "src/hooks/activity/useAiStatusDistribution.ts (range-driven)"
    - "src/hooks/activity/useExportPipeline.ts (range-driven)"
    - "src/hooks/activity/useHouseSaleSplit.ts (range-driven)"
    - "src/hooks/activity/useStuckItems.ts (right-now)"
    - "src/hooks/activity/useSessionDetail.ts (one-shot — exports useSessionDetail AND useSessionItems)"
    - "src/hooks/activity/usePhotoCoverage.ts (one-shot)"
    - "src/hooks/activity/useSessionPhotos.ts (one-shot — D-09 lazy per-item)"
    - "src/hooks/activity/useFailedAiBreakdown.ts (range-driven)"
    - "src/hooks/activity/useUiTopPages.ts (range-driven, no specialist/mode per D-34)"
    - "src/hooks/activity/useUiTopElements.ts (range-driven, no specialist/mode per D-34)"
    - "src/hooks/activity/useWalkthroughFunnel.ts (right-now, no args per D-32)"
    - "src/hooks/activity/useUiRecentEventsFeed.ts (live-tail — mirrors Phase 2 useLiveFeed)"
    - "src/hooks/activity/useItemsPerSpecialist.test.tsx (3 tests — fixed-window contract)"
    - "src/hooks/activity/useStuckItems.test.tsx (3 tests — right-now contract)"
    - "src/hooks/activity/useUiRecentEventsFeed.test.tsx (2 tests — fake-timers + pause/resume)"
    - "src/hooks/activity/__tests__/all-hooks-smoke.test.tsx (17 cases — every hook fires its fetch once on mount)"
  modified: []

key-decisions:
  - "useSessionItems is co-located with useSessionDetail (single file, two named exports). Both hooks mount on /activity/sessions/:id; co-locating keeps the import surface tight (one path for the page-level loader). useSessionPhotos is a separate file because it is per-item lazy (D-09) and consumers mount it from within a row-disclosure component, not from the page-level loader."
  - "fetchActiveSpecialists declares its return type as { id; email: string; display_name } (email narrowed from string | null). The .not('email','is',null) server-side filter excludes null rows, but the JS-side .filter() preserves the narrow at the type-system level — no `as` cast leaks into consumers. This is load-bearing because the SpecialistMultiSelect (Plan 03-08) keys on email."
  - "fetchSessionItems flattens the embedded `photos(count)` aggregate into row.photo_count via an explicit object construction (no `as ItemListRow` cast). This avoids a lurking type bug where the supabase-js generic narrows photos to `Array<{ count: number }> | null` but the consuming component expects `photo_count: number`. Each field is restated so the satisfies clause catches drift."
  - "useUiRecentEventsFeed mirrors Phase 2 useLiveFeed verbatim — same pause/resume API, same Pitfall 10 fix (invalidateQueries on resume). The 10s polling interval and staleTime: 0 are deliberate per-hook QueryClient default overrides that the global QueryClientProvider (60s staleTime) does not provide."
  - "Right-now hooks (useTodayKpis, useActiveSessions, useStuckItems, useWalkthroughFunnel, useActiveSpecialists) do NOT import useDateRange. This is enforced at compile time: if a future change adds the import, the queryKey shape would change and tsc -b would surface the divergence at the call sites. The verify-activity-filter-scope.mjs verifier catches the JSDoc tag drift in CI."
  - "useItemsPerSpecialist explicitly does NOT import useDateRange (D-16 fixed-window — server computes the trailing 14-day bounds). The dedicated test asserts that varying ?range= on the URL does NOT trigger a refetch (cache hit), proving the hook is range-independent."
  - "fetchUiTopPages and fetchUiTopElements pass ONLY p_from / p_to (D-34 — UI dev panels are app-wide and intentionally ignore the activity surface filters). The test asserts the absence of p_specialists and p_mode in the RPC arg."
  - "fetchWalkthroughFunnel calls supabase.rpc('get_walkthrough_funnel') with no second arg (D-32 — RPC takes no parameters). The test tolerates either undefined or {} as the second supabase.rpc arg shape and asserts the absence of any p_* fields."
  - "fetchTodayKpis returns a defaultTodayKpisRow() (all zeros) when supabase yields []. This prevents downstream UI crashes on empty databases and also keeps the test fixture simple — every test resolves to a typed row, never undefined."
  - "useSignedPhotoUrl is NOT re-exported from this plan. Plan 03-02 ships it at src/hooks/useSignedPhotoUrl.ts; Plan 03-06 consumers import it directly from there. Re-exporting from src/hooks/activity/ would create a synonym path and confuse the verify-activity-filter-scope.mjs scanner (the verifier expects @filterScope on every hook in src/hooks/activity/, but useSignedPhotoUrl has no scope class — it is per-photo, not per-surface)."

patterns-established:
  - "Co-located test discipline: services/activity/queries.test.ts sits next to queries.ts so the mock surface stays in sync; hook tests sit next to their hooks; the all-hooks smoke harness lives under __tests__/ so it parameterizes over imports."
  - "Empty-array filter forwarding: every RPC wrapper passes specialists / users arrays verbatim (Pitfall 7). The RPC body uses cardinality(arr) = 0 OR ... to short-circuit. The wrapper does NOT skip the parameter when the array is empty — that would silently drop the filter and surface a server-side type-coercion error."
  - "Smoke harness coverage report: 17 hook cases (the 16 hooks + useSessionItems co-located in useSessionDetail.ts) parameterized via describe.each — each hook is mounted once and asserted to fire its corresponding fetch exactly once. Catches missing fetch arg propagation, broken imports, and hook signature drift in one pass."

requirements-completed: [APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-07, APP-08, APP-09, APP-10, APP-11, APP-12]

# Metrics
duration: ~12 min (RED→GREEN cycles for both tasks; full prebuild + 360-test suite included)
tasks-completed: 2
completed: 2026-05-01
---

# Phase 3 Plan 03: Activity Hooks + Service Queries Summary

**Single Supabase services module (`services/activity/queries.ts`) with 13 typed RPC wrappers + 4 raw `.from()` builders, plus 16 TanStack Query hooks under `src/hooks/activity/` — one per surface — wired against the regenerated `Database` types and verified by the `verify-activity-filter-scope.mjs` JSDoc invariant.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-01T16:18:00Z
- **Completed:** 2026-05-01T16:25:30Z
- **Tasks:** 2 (both TDD: RED → GREEN per task)
- **Commits:** 4 (2 RED + 2 GREEN)
- **Files created:** 21 (1 service + 1 service-test + 16 hooks + 3 dedicated hook-tests + 1 smoke harness)
- **Files modified:** 0

## Accomplishments

- Phase 3 data-access layer is complete: every chart, KPI strip, table, alert card, dev sub-panel, and page-level loader from APP-01..12 has a typed hook ready to consume.
- queryKey namespace is locked: `['activity', ...]` for every Phase 3 hook → phase-scoped cache invalidation works out of the box (Wave 3 admin sign-out and refresh flows can call `queryClient.invalidateQueries({ queryKey: ['activity'] })`).
- Filter-scope JSDoc invariant enforced: 16 hook files scanned, every one carries `@filterScope` with one of the 5 scope classes; static verifier exits 0 against the new tree (was previously a no-op pre-Wave-2).
- Live-tail contract honored: `useUiRecentEventsFeed` mirrors Phase 2 `useLiveFeed` verbatim — the Pitfall 10 fix (immediate refetch via `invalidateQueries` on resume rather than relying on the next interval tick) is preserved.
- Full prebuild verifier chain (11 verifiers) passes; `tsc -b` clean; 360/360 tests pass across the codebase.

## Task Commits

Each TDD cycle landed two commits with `--no-verify` (parallel executor in worktree):

1. **Task 1 RED — failing tests for services/activity/queries** — `0b77c09` (test)
2. **Task 1 GREEN — implement services/activity/queries.ts** — `d8c3f70` (feat)
3. **Task 2 RED — failing tests for 4 hook test files** — `5101d1f` (test)
4. **Task 2 GREEN — implement 16 activity hooks** — `f4e72ef` (feat)

_Plan metadata commit (this SUMMARY.md) follows._

## Hook Inventory (16 hooks → 5 filter-scope classes)

| Hook | Filter scope | RPC / table | Filters consumed |
|------|-------------|-------------|------------------|
| `useTodayKpis` | right-now | `get_today_kpis` | specialists, mode |
| `useActiveSessions` | right-now | `get_active_sessions` | specialists, mode |
| `useStuckItems` | right-now | `get_stuck_items` | specialists, mode |
| `useWalkthroughFunnel` | right-now | `get_walkthrough_funnel` | (none — D-32) |
| `useItemsPerSpecialist` | fixed-window | `get_items_per_specialist_14d` | specialists, mode (NO range — D-16) |
| `useAiStatusDistribution` | range-driven | `get_ai_status_distribution` | from, to, specialists, mode |
| `useExportPipeline` | range-driven | `get_export_pipeline` | from, to, specialists, mode |
| `useHouseSaleSplit` | range-driven | `get_house_sale_split` | from, to, specialists, mode |
| `useFailedAiBreakdown` | range-driven | `get_failed_ai_breakdown` | from, to, specialists, mode |
| `useUiTopPages` | range-driven | `get_ui_top_pages` | from, to (no specialist/mode — D-34) |
| `useUiTopElements` | range-driven | `get_ui_top_elements` | from, to (no specialist/mode — D-34) |
| `useActiveSpecialists` | one-shot | `profiles` (raw) | (none — option list) |
| `useSessionDetail` | one-shot | `get_session_detail` | sessionId arg |
| `useSessionItems` (co-located) | one-shot | `items` (raw embed) | sessionId arg |
| `usePhotoCoverage` | one-shot | `get_photo_coverage` | sessionId arg |
| `useSessionPhotos` | one-shot | `photos` (raw, D-09 lazy) | itemId arg |
| `useUiRecentEventsFeed` | live-tail | `ui_interactions` (raw, D-33 scope) | (none — 10s polling) |

## Service-Layer Inventory (17 functions in queries.ts)

| Function | Underlying call | Notes |
|----------|----------------|-------|
| `fetchTodayKpis` | RPC `get_today_kpis` | Returns single row (zero-row fallback) |
| `fetchActiveSessions` | RPC `get_active_sessions` | |
| `fetchActiveSpecialists` | raw `.from('profiles')` | D-19: is_active=true AND role=specialist |
| `fetchItemsPerSpecialist14d` | RPC `get_items_per_specialist_14d` | D-16: NO from/to args |
| `fetchAiStatusDistribution` | RPC `get_ai_status_distribution` | |
| `fetchExportPipeline` | RPC `get_export_pipeline` | 5-segment incl. 'completed' |
| `fetchHouseSaleSplit` | RPC `get_house_sale_split` | Always 2 rows |
| `fetchStuckItems` | RPC `get_stuck_items` | |
| `fetchSessionDetail` | RPC `get_session_detail` | Single row or null |
| `fetchPhotoCoverage` | RPC `get_photo_coverage` | Single row or null |
| `fetchFailedAiBreakdown` | RPC `get_failed_ai_breakdown` | Long-form rows (dimension column) |
| `fetchUiTopPages` | RPC `get_ui_top_pages` | D-34: NO specialist/mode |
| `fetchUiTopElements` | RPC `get_ui_top_elements` | D-34: NO specialist/mode |
| `fetchWalkthroughFunnel` | RPC `get_walkthrough_funnel` | D-32: NO args |
| `fetchSessionItems` | raw `.from('items')` | Embedded `photos(count)` flattened to `photo_count` |
| `fetchSessionPhotos` | raw `.from('photos')` | D-09 lazy metadata-only |
| `fetchUiRecentEvents` | raw `.from('ui_interactions')` | D-33: `.eq('app_source','tpc-app')` |

## Files Created/Modified

### Service layer (2 files)
- `src/services/activity/queries.ts` — 13 RPC wrappers + 4 raw .from() builders + defaultTodayKpisRow helper. Header invariant block lists D-19, D-20, D-30, D-33 per the Phase 2 convention.
- `src/services/activity/queries.test.ts` — 21 tests covering D-19, D-32, D-33, D-34, D-16, D-17 invariants. Mocks `supabase.from` and `supabase.rpc` at the module level via `vi.mock('../../lib/supabase')`.

### Hook layer (16 hooks + 4 tests)
- 16 hook files under `src/hooks/activity/` — one per surface, every file carrying `@filterScope` JSDoc.
- `src/hooks/activity/useItemsPerSpecialist.test.tsx` — D-16 fixed-window contract (no useDateRange) + Pitfall 3 sorted-array queryKey + URL-order at fetch boundary.
- `src/hooks/activity/useStuckItems.test.tsx` — right-now contract (no from/to) + filter folding + sorted queryKey.
- `src/hooks/activity/useUiRecentEventsFeed.test.tsx` — fake-timers, 10s polling, pause halts, resume invalidates immediately (Pitfall 10).
- `src/hooks/activity/__tests__/all-hooks-smoke.test.tsx` — parameterized over 17 hook cases (the 16 hooks + useSessionItems); each hook fires its fetch once on mount.

## Decisions Made

See `key-decisions` in frontmatter — 10 decisions captured. Notable:

- **`useSessionItems` co-located in `useSessionDetail.ts`** — both mount on /activity/sessions/:id, so a single file with two named exports keeps the import surface tight. `useSessionPhotos` is a separate file because it is per-item lazy and consumed from row-disclosure components, not from the page loader.
- **`fetchActiveSpecialists` return type narrows `email` to `string` (not `string | null`)** via JS-side `.filter()` after the server-side `.not('email','is',null)` predicate. No `as` cast leaks. Plan 03-08 SpecialistMultiSelect keys on email, so the narrow is load-bearing.
- **`fetchSessionItems` flattens the embedded count without an `as ItemListRow` cast** — every field is restated explicitly under a `satisfies ItemListRow`. Drift between the supabase-js generic and the consumer-facing type is caught at compile time.
- **`useSignedPhotoUrl` is NOT re-exported** — Plan 03-02 owns it at `src/hooks/useSignedPhotoUrl.ts`. Re-exporting would force the verify-activity-filter-scope.mjs scanner to invent a scope class for a per-photo (not per-surface) hook.

## Smoke Harness Coverage Report

The all-hooks smoke harness (`src/hooks/activity/__tests__/all-hooks-smoke.test.tsx`) parameterizes over 17 cases via `describe.each`:

```
PASS  ✓ useTodayKpis              > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useActiveSessions         > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useActiveSpecialists      > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useItemsPerSpecialist     > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useAiStatusDistribution   > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useExportPipeline         > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useHouseSaleSplit         > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useStuckItems             > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useSessionDetail          > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useSessionItems           > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ usePhotoCoverage          > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useSessionPhotos          > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useFailedAiBreakdown      > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useUiTopPages             > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useUiTopElements          > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useWalkthroughFunnel      > mounts cleanly and fires its corresponding fetch fn exactly once
PASS  ✓ useUiRecentEventsFeed     > mounts cleanly and fires its corresponding fetch fn exactly once
```

17/17 cases pass. Combined with the 3 dedicated hook tests (8 cases) and the queries.test.ts (21 cases), Plan 03-03 ships **46 new test cases** all green.

## Verification Results

| Gate | Result |
|------|--------|
| `npm run test -- src/services/activity/queries.test.ts` | 21/21 |
| `npm run test -- src/hooks/activity/` | 25/25 |
| `npm run test` (full suite) | 360/360 |
| `npx tsc -b` | clean |
| `node scripts/verify-activity-filter-scope.mjs` | 16 hook files scanned, OK |
| `npm run prebuild` (11 verifiers) | all OK |

## Deviations from Plan

None — plan executed exactly as written. The plan was prescriptive enough that no Rule 1/2/3 auto-fixes were needed:

- All 13 RPCs had matching typed entries on `Database['public']['Functions']` from Plan 03-01 — no missing types to work around.
- The fetch / hook pattern is a direct mirror of Phase 2's `extension/queries.ts` + `hooks/extension/`; no novel architectural choices required Rule 4 escalation.
- The verify-activity-filter-scope.mjs verifier is keyed on the literal token `@filterScope` — every file received the tag on first authorship, no retroactive edits needed.

The single tactical decision worth noting (already covered in `key-decisions`): the `useSessionItems` co-location vs. separate-file question was resolved by following the plan's recommendation (co-locate with `useSessionDetail`), and `useSessionPhotos` was kept separate per the same plan note.

## Issues Encountered

None.

## TDD Gate Compliance

Both tasks followed the RED → GREEN cycle with explicit commit gates:

- **Task 1:** `0b77c09` (test) → `d8c3f70` (feat) — test file pre-dated the implementation file; first run failed with `Failed to resolve import "./queries"`.
- **Task 2:** `5101d1f` (test) → `f4e72ef` (feat) — 4 test files (3 dedicated + 1 smoke) pre-dated the 16 hook files; first run failed with `Failed to resolve import "./useItemsPerSpecialist"` (and 15 sibling failures).

No REFACTOR commits — both implementations landed clean against the test contract on first GREEN.

## Next Phase Readiness

- **Wave 3 (Plans 03-04, 03-05, 03-06):** ready. Every chart / KPI strip / table / alert card / page loader has its hook and service shape locked in; the components import named hooks from `src/hooks/activity/` and consume `useQuery` results. The queryKey namespace `'activity'` is the single point for cache invalidation.
- **Wave 4 (Plan 03-07 dev panel):** ready. `useFailedAiBreakdown`, `useUiTopPages`, `useUiTopElements`, `useWalkthroughFunnel`, and `useUiRecentEventsFeed` cover all 5 dev panel sub-surfaces.
- **No blockers.** The verify-activity-filter-scope.mjs verifier now reports `16 hook file(s) scanned` instead of `no files yet`, transitioning the verifier from no-op to active enforcement.

## Self-Check: PASSED

Verified post-write:

- `src/services/activity/queries.ts` — FOUND
- `src/services/activity/queries.test.ts` — FOUND
- 16 hook files under `src/hooks/activity/` — FOUND
- 3 dedicated hook tests — FOUND
- `src/hooks/activity/__tests__/all-hooks-smoke.test.tsx` — FOUND
- Commit `0b77c09` (test RED queries) — FOUND
- Commit `d8c3f70` (feat GREEN queries) — FOUND
- Commit `5101d1f` (test RED hooks) — FOUND
- Commit `f4e72ef` (feat GREEN hooks) — FOUND

---
*Phase: 03-tpc-app-activity-activity*
*Plan: 03*
*Completed: 2026-05-01*
