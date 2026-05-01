---
phase: 03-tpc-app-activity-activity
plan: 07
subsystem: ui
tags: [react, tanstack-table, tanstack-query, recharts, payload-modal, dev-gate, live-tail, render-conditional]

# Dependency graph
requires:
  - phase: 03-tpc-app-activity-activity (Plan 03-03)
    provides: useFailedAiBreakdown, useUiTopPages, useUiTopElements, useWalkthroughFunnel, useUiRecentEventsFeed (with pause/resume API)
  - phase: 03-tpc-app-activity-activity (Plan 03-01)
    provides: get_failed_ai_breakdown, get_ui_top_pages, get_ui_top_elements, get_walkthrough_funnel RPCs (typed via database.types.ts) + ui_interactions table types
  - phase: 02 (TPC App Extension)
    provides: DeveloperPanel chrome idiom (D-15); LiveEventFeed visual idiom (EXT-08); CancellationRateKpis as KpiCard-grid analog; PayloadViewerModal; isDevAccount allowlist; ErrorState/EmptyState/TableSkeleton/SortIndicator kit
  - phase: 01 (Phase 1 INFR)
    provides: useAuthStore (selector idiom for profile.email)
provides:
  - DeveloperPanel (render-conditional dev panel chrome, D-26/D-28/D-31)
  - FailedAiBreakdown (3-column dev sub-surface, D-29)
  - UiInteractionsPanel (composition wrapper for 4 ui_interactions panels, D-32)
  - UiTopPagesTable (range-driven dev sub-panel, D-32/D-34)
  - UiTopElementsTable (range-driven dev sub-panel, D-32/D-34)
  - WalkthroughFunnel (right-now horizontal Recharts bar, D-32/D-34)
  - UiRecentEventsFeed (10s polling live tail with Pause/Resume, D-32)
affects: [03-08 (page composition — DeveloperPanel mounts at the bottom of /activity), 03-09 (e2e wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-conditional dev gate: `if (!isDevAccount(email)) return null;` at the TOP of the component (NOT display:hidden) — entire subtree absent from DOM"
    - "Long-form RPC row → multi-column client-side pivot (FailedAiBreakdown filters rows by `dimension` field at render time)"
    - "Live-tail polling via hook (10s refetchInterval owned by useUiRecentEventsFeed); component is purely presentational (no setInterval, no setTimeout, no invalidateQueries)"
    - "Pause/Resume pattern via hook-exposed paused/pause/resume API; live indicator dot reflects paused state"
    - "Stub-then-replace ordering for circular module imports: DeveloperPanel imports UiInteractionsPanel; UiInteractionsPanel imports UiRecentEventsFeed. Task 1 stubbed UiInteractionsPanel; Task 2 stubbed UiRecentEventsFeed; Task 3 fleshed it out"

key-files:
  created:
    - src/components/activity/DeveloperPanel.tsx
    - src/components/activity/DeveloperPanel.test.tsx
    - src/components/activity/FailedAiBreakdown.tsx
    - src/components/activity/FailedAiBreakdown.test.tsx
    - src/components/activity/UiInteractionsPanel.tsx
    - src/components/activity/UiInteractionsPanel.test.tsx
    - src/components/activity/UiTopPagesTable.tsx
    - src/components/activity/UiTopPagesTable.test.tsx
    - src/components/activity/UiTopElementsTable.tsx
    - src/components/activity/UiTopElementsTable.test.tsx
    - src/components/activity/WalkthroughFunnel.tsx
    - src/components/activity/WalkthroughFunnel.test.tsx
    - src/components/activity/UiRecentEventsFeed.tsx
    - src/components/activity/UiRecentEventsFeed.test.tsx
  modified: []

key-decisions:
  - "Render-conditional gate at the TOP of DeveloperPanel — D-26 enforcement. Test 1 (returns null when isDevAccount is false) is load-bearing for the threat model T-03-31 (DOM-inspection information disclosure)."
  - "FailedAiBreakdown uses simple `<ul>` rows of `[label  count]` rather than KpiCard chrome — picks visual density over individual card framing because each dimension column already has its own card, and individual rows would be redundant. UI-SPEC line 640 listed both ('KpiCard list') as acceptable; chose `<ul>` for compactness."
  - "Italic 'None' placeholder for empty dimension columns in FailedAiBreakdown — better DOM stability than collapsing the column when one dimension has zero rows. Keeps the 3-column grid layout consistent."
  - "Test 4c (sort toggle) uses single click — TanStack Table v8 default sort cycle is desc → asc → none, so two clicks would land on 'none' (original input order), not asc. Single click flips initial desc to asc."
  - "Stub-then-replace pattern: Tasks 1/2 created minimal `() => null` stubs for downstream components so DeveloperPanel.tsx and UiInteractionsPanel.tsx could import-and-compile during their TDD GREEN phases; Tasks 2/3 then replaced the stubs with real implementations. No additional files created beyond the 14 listed in files_modified."
  - "Test 6 (no-localStorage persistence) verifies via mount → expand → unmount → re-mount → still collapsed, instead of probing localStorage directly. JSDom's localStorage is read-only in this test environment (`localStorage.setItem is not a function`)."

patterns-established:
  - "Pattern: Render-conditional gate at the entry point of a dev surface — caller wraps nothing; component returns null for non-dev. All children skip their own dev gating because the parent absent-from-DOM guarantee covers them."
  - "Pattern: Client-side pivot of long-form RPC rows. The RPC returns one row per (dimension, dim_key); the component filters by dimension key and renders one column per dimension. Avoids 3 separate RPC calls + simplifies SQL (single window over the failed-items set)."
  - "Pattern: Live-tail component reads `{data, isLoading, error, refetch, paused, pause, resume}` from a single hook; Pause button toggles via `paused ? onResume : onPause`. Component never owns polling state."

requirements-completed: [APP-04]

# Metrics
duration: ~18min
completed: 2026-05-01
---

# Phase 3 Plan 07: Developer Panel + UI Interactions Surface Summary

**Seven dev-only components shipped (1 render-conditional dev panel + 6 sub-surfaces) wiring D-26 render gate, D-29 Failed-AI Breakdown 3-column pivot, D-32 ui_interactions sub-panels, D-34 filter scope (right-now Walkthrough Funnel + range-driven Top Pages/Elements), and the Phase 2 LiveEventFeed visual idiom for the Recent Events Feed — 53 tests green.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-01T20:55Z
- **Completed:** 2026-05-01T21:14Z
- **Tasks:** 3 (TDD cycles)
- **Files created:** 14 (7 components + 7 colocated tests)
- **Files modified:** 0

## Accomplishments

- **DeveloperPanel:** render-conditional gate via `isDevAccount(profile?.email)` at the top of the component — null for non-dev accounts (T-03-31 mitigation: entire subtree absent from DOM, NOT display:hidden). Collapsed-by-default chrome with chevron toggle, aria-expanded/aria-controls, "Diagnostics for {email}" subtitle. NO localStorage persistence — every fresh mount starts collapsed.
- **FailedAiBreakdown:** range-driven D-29 sub-surface that consumes `useFailedAiBreakdown()` returning long-form rows (one per dimension × dim_key). Component pivots client-side to a 3-column grid (by specialist / by mode / by category). Per-card loading skeleton (3 animate-pulse blocks), EmptyState ("No AI failures in this range"), and locked ErrorState contract (D-35).
- **UiInteractionsPanel:** D-31/D-32 composition wrapper composing the four sub-panels in order (Top Pages → Top Elements → Walkthrough Funnel → Recent Events Feed) with `space-y-6` rhythm and "UI interactions (TPC App)" heading.
- **UiTopPagesTable + UiTopElementsTable:** TanStack Table v8 sortable, 2-column tables. Range-driven (D-34: specialist + mode do NOT apply — hook only consumes useDateRange). Default sorts: views desc / clicks desc respectively. 6-row / 8-row TableSkeleton, EmptyState, locked ErrorState.
- **WalkthroughFunnel:** Recharts BarChart `layout="vertical"` (horizontal bars), single neutral `gray-400` fill (#9ca3af) — bar lengths carry meaning. Right-now per-user state — IGNORES all filters per D-34 (no useDateRange / useSpecialistFilter / useModeFilter imports — verified at the source level via Vite ?raw import in Test 16). Compact `h-32` body.
- **UiRecentEventsFeed:** 10s polling live tail mirroring Phase 2 LiveEventFeed verbatim. Live indicator dot (green pulsing / static gray), Pause/Resume button, max-h-[28rem] scroll body, row click → PayloadViewerModal with `"UI interaction — {interaction_type}"` title. Interaction-type chip palette per UI-SPEC § Recent Events Feed (walkthrough_step uses `text-amber-800` for AA contrast on amber-100).
- **D-26 load-bearing test:** `DeveloperPanel.test.tsx` Tests 1 / 1b / 1c assert `container.firstChild === null` for non-dev / null profile / null email — the critical assertion for threat T-03-31 (information disclosure via DOM inspection).

## Task Commits

1. **Task 1 RED: failing DeveloperPanel + FailedAiBreakdown tests** — `7af1dc7` (test)
2. **Task 1 GREEN: implement DeveloperPanel + FailedAiBreakdown** — `999721d` (feat)
3. **Task 2 RED: failing ui_interactions sub-panel suite tests** — `9d7ff5c` (test)
4. **Task 2 GREEN: implement UiInteractionsPanel + UiTopPagesTable + UiTopElementsTable + WalkthroughFunnel** — `faf14aa` (feat)
5. **Task 3 RED: failing UiRecentEventsFeed tests** — `e333fa6` (test)
6. **Task 3 GREEN: implement UiRecentEventsFeed** — `bf80137` (feat)

_Note: Each task was a strict RED → GREEN cycle (no REFACTOR commits — minimal cleanup folded into GREEN). Stub modules created during Task 1/2 GREEN (UiInteractionsPanel placeholder, UiRecentEventsFeed placeholder) were replaced in Task 2/3 GREEN respectively — no extra commits required._

## Files Created/Modified

### Render-conditional dev panel
- `src/components/activity/DeveloperPanel.tsx` + `.test.tsx` — `isDevAccount(email)` gate; 11 tests (3 gate + 8 chrome).

### Failed-AI breakdown
- `src/components/activity/FailedAiBreakdown.tsx` + `.test.tsx` — 3-column long-form pivot; 7 tests (grid layout, copy, formatCount, empty/loading/error, italic 'None').

### UI interactions panel suite
- `src/components/activity/UiInteractionsPanel.tsx` + `.test.tsx` — 4-child composition wrapper; 3 tests (heading, composition order, space-y-6).
- `src/components/activity/UiTopPagesTable.tsx` + `.test.tsx` — TanStack v8 sortable; 7 tests (columns, default sort, single-click toggle, copy, empty/loading/error).
- `src/components/activity/UiTopElementsTable.tsx` + `.test.tsx` — analogous to TopPages; 6 tests.
- `src/components/activity/WalkthroughFunnel.tsx` + `.test.tsx` — Recharts horizontal bar gray-400; 7 tests (bar render + fill, copy, empty/loading/error, source-level no-filter-hooks, h-32 body).
- `src/components/activity/UiRecentEventsFeed.tsx` + `.test.tsx` — Phase 2 LiveEventFeed mirror; 12 tests (chrome, indicator, pause/resume, row layout, chip palette, modal, empty/loading/error).

## Decisions Made

- **Render-conditional gate at the entry point.** DeveloperPanel returns null for non-dev. All children (FailedAiBreakdown, UiInteractionsPanel, and the four ui_interactions sub-panels) skip their own dev gating because the parent absent-from-DOM guarantee covers them. This is the threat model T-03-31 mitigation: even DOM inspection cannot reveal the dev surface to non-allowlisted users.
- **FailedAiBreakdown row rendering: `<ul>` rows over KpiCard.** UI-SPEC § Failed-AI Breakdown sub-panel (line 640) listed both options. Chose `<ul>` rows because each column is already a card; individual KpiCards inside would be redundant. Visual density wins for the dev surface where a single column may have 5+ specialists.
- **Italic 'None' placeholder for empty dimension columns.** Keeps the 3-column grid layout stable when one dimension has zero rows — better than collapsing the column or hiding it.
- **TanStack Table v8 default sort cycle is desc → asc → none.** Test 4c originally used 2 clicks expecting "back to asc" but actually lands on "none" (= original input order). Fixed to a single click (initial desc → asc) which is also what users will most often do.
- **Stub-then-replace ordering.** Task 1 needed `UiInteractionsPanel` to import-and-compile; Task 2 needed `UiRecentEventsFeed` likewise. Created `() => null` stubs in their respective dependency-task GREEN commits, then replaced them with real implementations in their own GREEN commits. No extra commits or files beyond the 14 in `files_modified`.
- **Test 6 (no-localStorage persistence) reformulated.** JSDom in this test env doesn't allow `localStorage.setItem` (read-only `Storage` impl). Test now mounts the panel, expands it, unmounts, remounts — and asserts the second mount starts collapsed. Same load-bearing assertion (no persistence carrying across mounts), no jsdom dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Write tool path resolution to wrong location**
- **Found during:** Task 1 RED setup
- **Issue:** Initial calls to the Write tool used Windows-backslash absolute paths (`C:\Users\...\.claude\worktrees\...`), and the tool resolved them to the *main* repo `src/components/activity/` instead of the worktree's. This was discovered when `npx vitest` reported "no test files found".
- **Fix:** Switched to forward-slash absolute paths (`C:/Users/.../.claude/worktrees/.../src/...`) for all subsequent Write calls. Removed the misplaced files from the main repo.
- **Files modified:** None permanent (the misplaced files were deleted before commits landed).
- **Verification:** `find /c/Users/maser/Projects/tpc-dashboard -name 'FailedAiBreakdown.test.tsx'` now returns only the worktree path. All 14 plan files live under the worktree only.
- **Committed in:** N/A — no permanent record of the misroute; tooling pattern is documented here for future runs.

**2. [Rule 1 — Bug] Test 6 (no-localStorage persistence) crashed on JSDom localStorage.setItem**
- **Found during:** Task 1 GREEN
- **Issue:** Test 6 wrote `localStorage.setItem(...)` to seed a "would persist" value, but JSDom in this test environment has a read-only Storage stub: `TypeError: localStorage.setItem is not a function`.
- **Fix:** Reformulated the test to verify the no-persistence claim via remount — first mount expands the panel; unmount; second fresh mount asserts the panel starts collapsed. Same semantic guarantee, no jsdom dependency.
- **Files modified:** `src/components/activity/DeveloperPanel.test.tsx`
- **Verification:** Test 6 green.
- **Committed in:** `999721d` (Task 1 GREEN).

**3. [Rule 1 — Bug] Test 4c expected wrong sort state after 2 clicks**
- **Found during:** Task 2 GREEN
- **Issue:** Test 4c clicked the Views header twice expecting to land on ascending sort. TanStack Table v8 default sort cycle is `desc → asc → none`, so two clicks land on "none" = original input order, not asc.
- **Fix:** Changed test to single click (desc → asc); rewrote test name to document the v8 cycle.
- **Files modified:** `src/components/activity/UiTopPagesTable.test.tsx`
- **Verification:** Test 4c green.
- **Committed in:** `faf14aa` (Task 2 GREEN).

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocker — tooling-related, not in repo).
**Impact on plan:** All deviations were test-environment / TanStack-cycle workarounds. Zero scope creep — all 7 components delivered with the locked behavior contracts.

## Issues Encountered

- The Write tool resolves Windows-backslash absolute paths against the main repo's working directory rather than the worktree's even when the agent's `cwd` is the worktree. Forward-slash absolute paths work correctly. Future executor agents in worktrees should default to forward-slash paths.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 03-08 (page composition):** ready. Will mount `<DeveloperPanel />` at the bottom of `/activity` (UI-SPEC § DeveloperPanel Layout: "the dev surface is the second of two surfaces on /activity, mounted below the always-rendered admin surface"). The page does not need to wrap DeveloperPanel in a dev gate — the component self-gates.
- **Plan 03-09 (e2e wiring):** ready. UiRecentEventsFeed's 10s polling will produce live observable behavior in dev environments; pause/resume guards against unbounded network traffic during inactive sessions.
- **No blockers.** All 7 components consume their hook contracts cleanly; type check clean; all 11 prebuild verifiers green; full test suite (67 files / 548 tests) passes.

## Self-Check: PASSED

All committed work verified on disk and in git history.

### Files verified (FOUND on disk)
- src/components/activity/DeveloperPanel.tsx
- src/components/activity/DeveloperPanel.test.tsx
- src/components/activity/FailedAiBreakdown.tsx
- src/components/activity/FailedAiBreakdown.test.tsx
- src/components/activity/UiInteractionsPanel.tsx
- src/components/activity/UiInteractionsPanel.test.tsx
- src/components/activity/UiTopPagesTable.tsx
- src/components/activity/UiTopPagesTable.test.tsx
- src/components/activity/UiTopElementsTable.tsx
- src/components/activity/UiTopElementsTable.test.tsx
- src/components/activity/WalkthroughFunnel.tsx
- src/components/activity/WalkthroughFunnel.test.tsx
- src/components/activity/UiRecentEventsFeed.tsx
- src/components/activity/UiRecentEventsFeed.test.tsx

### Commits verified (FOUND in git log)
- 7af1dc7 — test(03-07): add failing tests for DeveloperPanel + FailedAiBreakdown
- 999721d — feat(03-07): implement DeveloperPanel + FailedAiBreakdown (Task 1)
- 9d7ff5c — test(03-07): add failing tests for ui_interactions sub-panel suite
- faf14aa — feat(03-07): implement ui_interactions sub-panel suite (Task 2)
- e333fa6 — test(03-07): add failing tests for UiRecentEventsFeed (Task 3)
- bf80137 — feat(03-07): implement UiRecentEventsFeed (Task 3)
