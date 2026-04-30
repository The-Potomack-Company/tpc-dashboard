---
phase: 02-extension-analytics-extension
plan: 03
subsystem: extension-analytics
tags: [services, hooks, tanstack-query, supabase-rpc, live-feed, polling, queryKey-sort, tdd]
requires:
  - phase: 02-extension-analytics-extension
    provides: "6 typed RPC Function entries on Database['public']['Functions'] (Plan 02-01); URL-state filter hooks useUserFilter + useVersionFilter (Plan 02-02); D-01 invariant on the SQL side enforced by scripts/verify-extension-app-source-scope.mjs (Plan 02-01)"
provides:
  - "src/services/extension/queries.ts — 10 typed query/RPC builders with the D-01 invariant baked in (6 RPC + 2 raw select + 1 gate + 1 distinct-versions)"
  - "src/hooks/extension/useExtensionGate.ts — D-19 lifetime emptiness probe (staleTime: Infinity, retry: 1)"
  - "src/hooks/extension/useEventVolume.ts + useKpiTotals.ts — EXT-01/02 (range-aware bucket arg per D-08)"
  - "src/hooks/extension/useErrorRate.ts + usePerUserSummary.ts + useRecentErrors.ts — EXT-03/04/05"
  - "src/hooks/extension/useDominantVersion.ts + useCancellationRates.ts — EXT-09 dominant-version + EXT-10 cancellation-rate KPIs"
  - "src/hooks/extension/useDistinctVersions.ts — EXT-09 ExtensionVersionFilter option list (sole source for Plan 02-07; 5min staleTime; filter-independent queryKey)"
  - "src/hooks/extension/useLiveFeed.ts — EXT-08 polled live feed with function-form refetchInterval + Resume-immediate-refetch (D-09/D-10/D-11)"
affects:
  - "Plan 02-04 (admin-charts): imports useEventVolume, useKpiTotals, useErrorRate, useDominantVersion, useCancellationRates"
  - "Plan 02-05 (tables): imports usePerUserSummary, useRecentErrors"
  - "Plan 02-06 (LiveFeed component): imports useLiveFeed"
  - "Plan 02-07 (DeveloperPanel): imports useDistinctVersions, useDominantVersion, useCancellationRates"
  - "Plan 02-08 (page composition): imports useExtensionGate"
tech-stack:
  added: []
  patterns:
    - "Single service module exposing both supabase.rpc(...) and chained .from().select() builders (queries.ts) — JSDoc invariant header + code-review checklist line covers the D-01 TypeScript half (Pitfall 6 mitigation)"
    - "TanStack Query hook template with sorted-array queryKey + URL-order fetch arg (Pitfall 3 mitigation) — applied across 7 chart hooks via shared all-hooks-smoke parameterized test"
    - "Function-form refetchInterval () => paused ? false : 10_000 reactive to closure-captured state (Pitfall 4 mitigation); Resume pairs setPaused(false) with qc.invalidateQueries({ queryKey: FEED_KEY }) for immediate refetch"
    - "Empty IN-list no-op idiom: skip .in('user_email', [...]) entirely when users[] is empty (raw .from() builders); RPCs use the SQL-side cardinality(p_users)=0 idiom from Plan 02-01"
key-files:
  created:
    - "src/services/extension/queries.ts"
    - "src/services/extension/queries.test.ts"
    - "src/hooks/extension/useExtensionGate.ts"
    - "src/hooks/extension/useExtensionGate.test.tsx"
    - "src/hooks/extension/useEventVolume.ts"
    - "src/hooks/extension/useEventVolume.test.tsx"
    - "src/hooks/extension/useKpiTotals.ts"
    - "src/hooks/extension/useErrorRate.ts"
    - "src/hooks/extension/usePerUserSummary.ts"
    - "src/hooks/extension/useRecentErrors.ts"
    - "src/hooks/extension/useDominantVersion.ts"
    - "src/hooks/extension/useCancellationRates.ts"
    - "src/hooks/extension/useDistinctVersions.ts"
    - "src/hooks/extension/useLiveFeed.ts"
    - "src/hooks/extension/useLiveFeed.test.tsx"
    - "src/hooks/extension/__tests__/all-hooks-smoke.test.tsx"
  modified: []
decisions:
  - "Service module exports EXTENSION_EVENT_TYPES as a readonly tuple of 5 strings — single source of the D-02 5-event vocabulary in TS code; consumed by fetchRecentErrors via `EXTENSION_EVENT_TYPES as unknown as string[]` cast (supabase-js v2's .in() expects writable string[])"
  - "useExtensionGate test for the error path uses { timeout: 5000 } on waitFor because the hook explicitly sets retry: 1 per D-19 (overriding the test wrapper's retry: false default). Hook behavior matches the spec; the test accommodates the retry."
  - "fetchDistinctVersions dedupes via JS-side Set after the server returns desc-sorted rows. Server-side .order('extension_version', { ascending: false }) is preserved — JS Set iteration preserves insertion order, so the resulting array is desc-sorted distinct."
metrics:
  completed: "2026-04-30"
  duration_minutes: 9
  task_count: 3
  file_count: 16
  test_count_added: 35
  test_count_total_after: 143
requirements: [EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-07, EXT-08, EXT-09, EXT-10]
---

# Phase 02 Plan 03: Services + Hooks Summary

**One-liner:** Twelve new source files + four colocated test files shipping the entire data-access layer for `/extension`: one service module (`queries.ts`) with 10 typed RPC/select builders, nine TanStack Query hooks (one per RPC + one live-feed polling hook + one distinct-versions hook), and a parameterized all-hooks-smoke that proves each chart hook folds URL filters into its queryKey while passing URL-order arrays to its fetch fn.

## What Shipped

### Source files (12 total — 11 new + the existing useUserFilter/useVersionFilter from Plan 02-02 untouched)

| File | Purpose |
|------|---------|
| `src/services/extension/queries.ts` | 10 typed builders + `EXTENSION_EVENT_TYPES` constant |
| `src/hooks/extension/useExtensionGate.ts` | D-19 lifetime probe (`staleTime: Infinity`) |
| `src/hooks/extension/useEventVolume.ts` | EXT-01 (D-08 bucket=hour for range=today) |
| `src/hooks/extension/useKpiTotals.ts` | EXT-02 (sparkline resolution from D-08 bucket) |
| `src/hooks/extension/useErrorRate.ts` | EXT-03 |
| `src/hooks/extension/usePerUserSummary.ts` | EXT-04 |
| `src/hooks/extension/useRecentErrors.ts` | EXT-05 (limit=100 locked) |
| `src/hooks/extension/useDominantVersion.ts` | EXT-09 dominant-version badge |
| `src/hooks/extension/useCancellationRates.ts` | EXT-10 (`previous_rate: number \| null` pass-through) |
| `src/hooks/extension/useDistinctVersions.ts` | **EXT-09 option list — sole source for Plan 02-07's `ExtensionVersionFilter`** (Checker WARNING #4 fix) |
| `src/hooks/extension/useLiveFeed.ts` | EXT-08 polled feed with Pause/Resume |

### Test files (5 colocated)

| Test file | Test count | Coverage |
|-----------|-----------|----------|
| `src/services/extension/queries.test.ts` | 18 | EXTENSION_EVENT_TYPES (1) + fetchEventVolume rpc shape + error throw + null-data fallback (3) + KpiTotals/ErrorRate/PerUserSummary/DominantVersion/CancellationRates (5) + fetchRecentErrors D-01/D-02/D-03 + empty-users no-op + error throw (3) + fetchLiveFeed D-09 unfiltered shape + default limit (2) + fetchExtensionGate hasAny true/false (2) + fetchDistinctVersions D-01 + dedupe + error (2) |
| `src/hooks/extension/useExtensionGate.test.tsx` | 4 | isLoading on first render + hasAny:false→isEmpty:true + hasAny:true→isEmpty:false + error surfacing (with retry:1 timeout=5000) |
| `src/hooks/extension/useEventVolume.test.tsx` | 4 | bucket=day for ?range=7d + bucket=hour for ?range=today (D-08) + URL-order users[] passed to fetch + single cache entry across users=b,a vs users=a,b (Pitfall 3) |
| `src/hooks/extension/useLiveFeed.test.tsx` | 2 | 10s interval refetch (D-10) + Pause halts polling + Resume immediate refetch + interval resumed (D-09/D-10/D-11) |
| `src/hooks/extension/__tests__/all-hooks-smoke.test.tsx` | 7 (parameterized) | Each of useEventVolume/useKpiTotals/useErrorRate/usePerUserSummary/useRecentErrors/useDominantVersion/useCancellationRates calls its corresponding fetch fn once with URL-order users/versions arrays |
| **Total new tests** | **35** | All green; project total grew from 108 → 143, no regressions |

## Pattern Conformance

- **Service module** is verbatim from RESEARCH.md "Code Examples" lines 810-871, extended with `fetchKpiTotals`, `fetchErrorRate`, `fetchPerUserSummary`, `fetchDominantVersion`, `fetchCancellationRates`, `fetchExtensionGate`, and `fetchDistinctVersions`. The JSDoc invariant header at the top of `queries.ts` matches PATTERNS.md lines 266-272 (cited from RESEARCH lines 813-820).
- **Chart hooks** follow RESEARCH Pattern 3 (lines 446-479) and PATTERNS.md lines 184-209 verbatim. The 7 hooks share the same template — only the queryKey discriminator and fetch fn differ (`useKpiTotals` and `useEventVolume` additionally include `bucket` per D-08).
- **`useExtensionGate`** follows RESEARCH Pattern 5 (lines 547-573) with a defensive `!q.error &&` clause added to the `isEmpty` derivation (an error during the gate fetch must not surface as `isEmpty: true` — the page should render the error rather than the empty state).
- **`useLiveFeed`** follows RESEARCH Pattern 4 (lines 484-519) verbatim, with the function-form `refetchInterval` and `qc.invalidateQueries` Resume mitigation (Pitfall 4).
- **`useDistinctVersions`** is new in this plan (Checker WARNING #4 fix). The 5-minute staleTime and `['extension', 'distinctVersions']` queryKey are filter-independent — the version OPTIONS don't narrow with date/user filters, only the chart data does.

## Verification

| Step | Command | Result |
|------|---------|--------|
| All 5 colocated test files | `npx vitest --run src/services/extension src/hooks/extension` | **48 passed** |
| Full project test suite | `npx vitest --run` | **143 passed** (21 files), no regressions |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Lint, scoped to new files | `npx eslint src/services/extension src/hooks/extension` | clean |
| `app_source` literal in queries.ts | `grep -c "tpc-extension" src/services/extension/queries.ts` | 7 (≥5 required by plan done criteria) |
| Function-form refetchInterval | `grep -n "refetchInterval: () =>" src/hooks/extension/useLiveFeed.ts` | 1 match (line 21) |
| `qc.invalidateQueries` in Resume | `grep -n "invalidateQueries" src/hooks/extension/useLiveFeed.ts` | matches inside resume callback (line 28) |
| Chart hooks don't redeclare staleTime/retry | `grep -n "staleTime\\|retry" use{EventVolume,KpiTotals,ErrorRate,PerUserSummary,RecentErrors,DominantVersion,CancellationRates}.ts` | only one match — and it's a comment in `useEventVolume.ts` line 34 ("staleTime/retry/refetchOnWindowFocus inherited from QueryClientProvider") — no `staleTime: ...` or `retry: ...` config redeclarations |

## Key Confirmations (Plan 02-03 output requirements)

1. **EXTENSION_EVENT_TYPES is the single source of the 5-event vocabulary in TS code.** Defined once in `queries.ts` as a `readonly tuple` and reused inside `fetchRecentErrors` via the `as unknown as string[]` cast (line 192). No hand-typed event-type arrays appear elsewhere in the new source files.

2. **`useLiveFeed`'s Resume callback calls `qc.invalidateQueries`.** Cited at `src/hooks/extension/useLiveFeed.ts` line 28: `void qc.invalidateQueries({ queryKey: FEED_KEY });` inside the `useCallback` body returned as `resume`.

3. **`fetchDistinctVersions` is exported and `useDistinctVersions` wraps it.** `fetchDistinctVersions` at `src/services/extension/queries.ts` line 249 is the SOLE source of EXT-09 option-list data; `useDistinctVersions` at `src/hooks/extension/useDistinctVersions.ts` line 13 wraps it with `staleTime: 5 * 60_000` and queryKey `['extension', 'distinctVersions']`. Plan 02-07's `ExtensionVersionFilter` consumes the hook — no inline supabase queries.

4. **Test counts:**
   - `queries.test.ts` — 18 (≥7 required by plan)
   - `useExtensionGate.test.tsx` — 4 (matches plan)
   - `useEventVolume.test.tsx` — 4 (matches plan)
   - `useLiveFeed.test.tsx` — 2 (in the 2-3 range from plan)
   - `__tests__/all-hooks-smoke.test.tsx` — 7 parameterized (matches plan)
   - **Total: 35** (plan estimate was ~21 — actual exceeds because queries.test.ts gained granular coverage of each RPC builder beyond the 7-test minimum)

## Commits

| Order | Hash | Type | Summary |
|-------|------|------|---------|
| 1 | `55b9c7a` | test | RED — failing tests for `services/extension/queries` (Task 1) |
| 2 | `ad6e0a7` | feat | GREEN — implement 10 typed query/RPC builders (Task 1) |
| 3 | `4fdd952` | test | RED — failing tests for gate + chart hooks + all-hooks-smoke (Task 2) |
| 4 | `2cf5c11` | feat | GREEN — implement gate + 7 chart hooks + `useDistinctVersions` (Task 2) |
| 5 | `ac3e2a1` | test | RED — failing fake-timer tests for `useLiveFeed` (Task 3) |
| 6 | `e35a350` | feat | GREEN — implement `useLiveFeed` with function-form `refetchInterval` (Task 3) |

## TDD Gate Compliance

Three independent TDD cycles, one per task. Every implementation commit (`feat`) is preceded by a failing-test commit (`test`). RED commits were verified to fail (module-not-found errors) before GREEN was written:

- Task 1 RED: `55b9c7a` (queries.test.ts fails — `Failed to resolve import "./queries"`)
- Task 1 GREEN: `ad6e0a7` (18 tests pass)
- Task 2 RED: `4fdd952` (3 test files fail — module not found for the hook files)
- Task 2 GREEN: `2cf5c11` (15 tests pass — gate 4 + EventVolume 4 + smoke 7)
- Task 3 RED: `ac3e2a1` (useLiveFeed.test.tsx fails — module not found)
- Task 3 GREEN: `e35a350` (2 fake-timer tests pass)

No REFACTOR commits — implementations are direct copies of the canonical RESEARCH.md / PATTERNS.md excerpts; the only post-RED adjustment was a 1-line test-side `{ timeout: 5000 }` on the gate error-path waitFor (the hook's `retry: 1` per D-19 needs ~1s to surface the final error after the retry; hook behavior is correct, the test accommodates the retry — captured in the GREEN commit's test patch).

## Deviations from Plan

None of substance. The Action block was followed verbatim. Two minor expected adjustments captured here for completeness:

1. **`useExtensionGate.test.tsx` error-path test uses `{ timeout: 5000 }` on waitFor.** The hook explicitly sets `retry: 1` per D-19 (overriding the test wrapper's `retry: false` default), so the final error surfaces after one retry cycle (~1s). The 5000ms timeout absorbs the retry; the hook itself matches the plan spec verbatim. This is what the plan's read_first PATTERNS.md lines 144-146 prescribe (`retry: 1`).

2. **`useExtensionGate` `isEmpty` derivation includes `!q.error &&` clause.** Plan sketch was `!q.isLoading && q.data?.hasAny === false`. Adding `!q.error &&` prevents `isEmpty: true` from surfacing during an error state — without it, the page would render the EmptyState ("No extension events yet — waiting on TPC AI Cataloger v2.0") even when the gate query failed, masking the real error from the operator. Matches the threat model intent: the page must distinguish "no events yet" from "couldn't tell whether there are events." Verified by the new error-path test (`expect(result.current.isEmpty).toBe(false)` while `error` is set).

## Threat Model Compliance

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-11 (Information Disclosure — missing app_source filter on a future helper) | mitigate | (a) JSDoc invariant header at top of `queries.ts` (lines 1-12); (b) code-review checklist comment inline; (c) Plan 02-01 SQL-side static verifier in prebuild chain. `grep -c "tpc-extension"` returns 7 in queries.ts. Future-work item filed: ESLint custom rule flagging `.from('analytics_events')` calls without a sibling `.eq('app_source', ...)` (low priority — JSDoc + reviewer convention is sufficient for now). |
| T-02-12 (Tampering — filter array unsorted in queryKey) | mitigate | Every chart hook uses `[...arr].sort()` before placing into queryKey. The all-hooks-smoke parameterized test asserts each hook receives URL-order arrays at the fetch boundary across all 7 chart hooks; the EventVolume queryKey-cache test (Test 4) asserts that `users=b,a` and `users=a,b` produce a single cache entry → single fetch call. |
| T-02-13 (DoS — LiveFeed polling) | accept | TanStack default `refetchIntervalInBackground: false` (inherited via `QueryClientProvider`); `staleTime: 0` ensures Pause-then-Resume jumps to fresh rows; 10s interval is at the slow end of EXT-08 spec. |
| T-02-14 (Information Disclosure — gate cached past first negative result) | accept | Documented trade-off (CONTEXT § Deferred — "Empty-state polling"); operator workaround = browser refresh. Plan 02-08's empty-gate copy hints at this implicitly via "waiting on TPC AI Cataloger v2.0." |

## Stub Tracking

No stubs introduced. All 11 hooks return `UseQueryResult<...>` (or `{ isLoading, isEmpty, error }` for `useExtensionGate`) bound to a real fetch fn — no hardcoded empty arrays, no placeholder data, no mock-only paths in the source files.

## Threat Flags

None. All new query helpers reuse the existing analytics_events surface (no new tables, no new columns), the anon Supabase client (no new auth path), and respect the D-01 `.eq('app_source','tpc-extension')` invariant. No new file access patterns.

## Self-Check: PASSED

Files created (verified via `[ -f path ]`):
- FOUND: src/services/extension/queries.ts
- FOUND: src/services/extension/queries.test.ts
- FOUND: src/hooks/extension/useExtensionGate.ts
- FOUND: src/hooks/extension/useExtensionGate.test.tsx
- FOUND: src/hooks/extension/useEventVolume.ts
- FOUND: src/hooks/extension/useEventVolume.test.tsx
- FOUND: src/hooks/extension/useKpiTotals.ts
- FOUND: src/hooks/extension/useErrorRate.ts
- FOUND: src/hooks/extension/usePerUserSummary.ts
- FOUND: src/hooks/extension/useRecentErrors.ts
- FOUND: src/hooks/extension/useDominantVersion.ts
- FOUND: src/hooks/extension/useCancellationRates.ts
- FOUND: src/hooks/extension/useDistinctVersions.ts
- FOUND: src/hooks/extension/useLiveFeed.ts
- FOUND: src/hooks/extension/useLiveFeed.test.tsx
- FOUND: src/hooks/extension/__tests__/all-hooks-smoke.test.tsx

Commits (verified via `git log --oneline | grep`):
- FOUND: 55b9c7a (test — Task 1 RED)
- FOUND: ad6e0a7 (feat — Task 1 GREEN)
- FOUND: 4fdd952 (test — Task 2 RED)
- FOUND: 2cf5c11 (feat — Task 2 GREEN)
- FOUND: ac3e2a1 (test — Task 3 RED)
- FOUND: e35a350 (feat — Task 3 GREEN)

---
*Phase: 02-extension-analytics-extension*
*Plan: 03*
*Status: COMPLETE*
