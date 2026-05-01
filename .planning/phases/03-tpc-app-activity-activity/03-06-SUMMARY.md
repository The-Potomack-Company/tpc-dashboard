---
phase: 03-tpc-app-activity-activity
plan: 06
subsystem: ui
tags: [react, tanstack-table, tanstack-query, signed-urls, supabase-storage, popover-multiselect, payload-modal, dev-gate]

# Dependency graph
requires:
  - phase: 03-tpc-app-activity-activity (Plan 03-02)
    provides: useSignedPhotoUrl hook (load-bearing per-photo signed URL with 50min staleTime + refetchOnWindowFocus override + retry:1); useSpecialistFilter; useModeFilter
  - phase: 03-tpc-app-activity-activity (Plan 03-03)
    provides: useActiveSpecialists, useSessionDetail, useSessionItems, usePhotoCoverage, useSessionPhotos, useStuckItems
  - phase: 03-tpc-app-activity-activity (Plan 03-01)
    provides: get_session_detail / get_photo_coverage / get_stuck_items RPCs (typed via database.types.ts)
  - phase: 02 (TPC App Extension)
    provides: UserMultiSelect popover idiom; PayloadViewerModal; RecentErrorsTable dev-gated cell pattern; isDevAccount allowlist; ErrorState/EmptyState/TableSkeleton/SortIndicator kit
provides:
  - SpecialistMultiSelect (page-header filter, APP-08)
  - ModeToggle (page-header session-mode toggle, APP-09)
  - SessionMetadataCard (session header card, APP-06)
  - PhotoCoveragePanel (photo coverage stats panel, APP-10)
  - ThumbnailTile (D-13 single-photo signed-URL consumer)
  - SessionItemDisclosure (per-row expansion body)
  - RawItemInspector (dev-only PayloadViewerModal trigger)
  - SessionItemList (TanStack Table v8 with row expansion, APP-06)
  - StuckItemsTable (/activity/stuck table with row navigation + dev columns, APP-11 / D-23)
affects: [03-07 (alert cards), 03-08 (page composition), 03-09 (e2e wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Table v8 row expansion via getExpandedRowModel + Fragment-wrapped data + expansion <tr>"
    - "Dev-gating by render-conditional caller (NOT internal isDev gate, per UI-SPEC pattern)"
    - "Lazy mount = lazy fetch (D-09): SessionItemDisclosure only invokes useSessionPhotos when row is expanded"
    - "D-13 invariant at the call site: ThumbnailTile passes enabled=false to useSignedPhotoUrl when upload_status='failed'"
    - "Always-rendered Raw column with cell-level dev gate keeps column shape stable across admin/dev"

key-files:
  created:
    - src/components/SpecialistMultiSelect.tsx
    - src/components/SpecialistMultiSelect.test.tsx
    - src/components/ModeToggle.tsx
    - src/components/ModeToggle.test.tsx
    - src/components/activity/SessionMetadataCard.tsx
    - src/components/activity/SessionMetadataCard.test.tsx
    - src/components/activity/PhotoCoveragePanel.tsx
    - src/components/activity/PhotoCoveragePanel.test.tsx
    - src/components/activity/ThumbnailTile.tsx
    - src/components/activity/ThumbnailTile.test.tsx
    - src/components/activity/SessionItemDisclosure.tsx
    - src/components/activity/SessionItemDisclosure.test.tsx
    - src/components/activity/RawItemInspector.tsx
    - src/components/activity/RawItemInspector.test.tsx
    - src/components/activity/SessionItemList.tsx
    - src/components/activity/SessionItemList.test.tsx
    - src/components/activity/StuckItemsTable.tsx
    - src/components/activity/StuckItemsTable.test.tsx
  modified: []

key-decisions:
  - "ThumbnailTile owns the D-13 invariant at the call site (enabled=!isFailed) — Test 9 asserts createSignedUrl mock count = 0 for failed photos"
  - "Raw column header is ALWAYS rendered in SessionItemList; cell content is gated by isDev — keeps column widths stable across admin/dev sign-ins (D-23 layout-stability rationale)"
  - "RawItemInspector is NOT internally gated; SessionItemDisclosure wraps it in `{isDev && <RawItemInspector />}` (caller-side render-conditional pattern)"
  - "StuckItemsTable age sort: comparator inverted (b - a) so default { id: 'age', desc: true } surfaces oldest items first (semantically 'age desc = oldest first')"
  - "Empty-alt <img> elements are presentation role, NOT 'img' role — tests use container.querySelector('img') instead of getByRole('img')"

patterns-established:
  - "Pattern: PayloadViewerModal lifted into the parent table component, opened by per-row 'View →' buttons (mirrors EXT-06 RecentErrorsTable). e.stopPropagation in the dev cell prevents row navigation from firing alongside modal open."
  - "Pattern: ThumbnailTile state-machine (failed | loading | error | success | pending/uploading-with-overlay). Pending/uploading photos still call useSignedPhotoUrl but render with opacity-60 overlay; failed photos NEVER call the hook."
  - "Pattern: Multi-select popover label uses display_name, URL filter param value uses email — divergence is locked by D-19 / Pitfall 5."

requirements-completed: [APP-06, APP-08, APP-09, APP-10, APP-11]

# Metrics
duration: ~30min
completed: 2026-05-01
---

# Phase 3 Plan 06: Filter Components + Session Detail Surface Summary

**Nine UI components shipped (2 page-header filters + 6 Session Detail surface + 1 Stuck Items table) wiring D-13 photo signed-URL invariant at the ThumbnailTile call site, lazy-mount-driven D-09 fetch timing in SessionItemDisclosure, and TanStack Table v8 row expansion in SessionItemList — 69 tests green.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-01T20:30Z
- **Completed:** 2026-05-01T20:48Z
- **Tasks:** 3 (TDD cycles)
- **Files created:** 18 (9 components + 9 colocated tests)
- **Files modified:** 0

## Accomplishments

- **Filter row:** SpecialistMultiSelect (display_name labels per D-19; email URL params per Pitfall 5) + ModeToggle (3 segmented radio buttons; default 'all' with no URL param per D-21).
- **Session Detail surface:** SessionMetadataCard (9 metadata fields with EMPTY-em-dash for nulls), PhotoCoveragePanel (D-25 numeric-only with 4-row upload_status breakdown + red callout when status_failed > 0), ThumbnailTile (D-13 enforced — failed photos never hit createSignedUrl), SessionItemDisclosure (lazy-mounted useSessionPhotos), RawItemInspector (dev-only by caller convention; PayloadViewerModal trigger), SessionItemList (TanStack Table v8 with getExpandedRowModel + Fragment-wrapped expansion rows).
- **Stuck Items table:** 6 admin columns + 3 dev columns; default sort age desc (oldest first); row click + Enter/Space keyboard navigates to /activity/sessions/<session_id>; dev "View →" cell with e.stopPropagation guards row navigation.
- **D-13 load-bearing test:** ThumbnailTile.test.tsx Test 9 asserts createSignedUrl mock count = 0 when upload_status === 'failed'. This is the critical assertion for Success Criterion #5 (the 2-hour tab-resume thumbnail repaint cannot regress to mass-signing failed photos).

## Task Commits

1. **Task 1: SpecialistMultiSelect + ModeToggle** — `69c1882` (feat)
2. **Task 2: Session Detail surface (6 components)** — `48f7556` (feat)
3. **Task 3: StuckItemsTable** — `44d4ec1` (feat)
4. **Lint cleanup: drop unused _bucket param in ThumbnailTile mock** — `945e2b2` (fix)

_Note: Each task included colocated test files; tests were written first (RED), components implemented to make tests pass (GREEN). No standalone REFACTOR commits — minimal cleanup folded into the GREEN commits per TDD cycle._

## Files Created/Modified

### Filter components (page header)
- `src/components/SpecialistMultiSelect.tsx` + `.test.tsx` — popover multi-select sourcing useActiveSpecialists; rendering display_name; URL param value remains email.
- `src/components/ModeToggle.tsx` + `.test.tsx` — 3 segmented buttons with `radiogroup` / `radio` ARIA semantics; writes ?mode= param via useModeFilter.

### Session Detail surface
- `src/components/activity/SessionMetadataCard.tsx` + `.test.tsx` — 9-field `<dl>` grid; EMPTY (em-dash) for null fields; pure presentation (caller formats timestamps).
- `src/components/activity/PhotoCoveragePanel.tsx` + `.test.tsx` — usePhotoCoverage consumer; D-25 numeric only (no thumbnail grid); upload_status 4-row breakdown; red callout when status_failed > 0; ErrorState/EmptyState contracts honored.
- `src/components/activity/ThumbnailTile.tsx` + `.test.tsx` — D-13 enforced via `enabled: !isFailed` arg to useSignedPhotoUrl; state machine (failed | loading | error | success | pending/uploading-overlay); dev caption when isDev=true.
- `src/components/activity/SessionItemDisclosure.tsx` + `.test.tsx` — useSessionPhotos invoked only on mount (D-09 lazy fetch timing); thumbnail strip + dev RawItemInspector.
- `src/components/activity/RawItemInspector.tsx` + `.test.tsx` — preview block + PayloadViewerModal trigger; NOT internally gated (caller wraps in isDev branch).
- `src/components/activity/SessionItemList.tsx` + `.test.tsx` — TanStack Table v8 with getExpandedRowModel; Fragment-wrapped data + expansion <tr><td colSpan={visibleCells.length}>; Raw column header always rendered (cell-level dev gate).

### Stuck Items table
- `src/components/activity/StuckItemsTable.tsx` + `.test.tsx` — 6 admin columns / 9 dev columns; default sort age desc oldest first; row click + Enter/Space keyboard navigation; dev Raw cell opens PayloadViewerModal with e.stopPropagation.

## Decisions Made

- **D-13 enforcement at the call site:** ThumbnailTile passes `enabled: !isFailed && !!photo.thumbnail_path` to useSignedPhotoUrl. The hook's existing `enabled` gate short-circuits the queryFn so createSignedUrl is never invoked. This was already provable in the hook's own test suite; ThumbnailTile.test.tsx Test 9 verifies the call-site enforcement holds.
- **Layout-stable Raw column:** SessionItemList renders the "Raw" column header for both admin and dev; the cell content is gated by `isDev` (admin sees null, dev sees "expand row →" hint). Avoids column width shift on dev sign-in vs admin sign-in.
- **StuckItemsTable age comparator inverted:** `(b.created_at - a.created_at)` instead of `(a - b)` so the locked default state `{ id: 'age', desc: true }` semantically renders oldest first ("age desc" = oldest first). The plan called for "default sort age descending (oldest first)" — clarified during execution.
- **`<img alt="">` empty-alt nuance:** Tests for ThumbnailTile use `container.querySelector('img')` instead of `screen.getByRole('img')` because empty-alt images are removed from the accessibility tree (presentation role).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StuckItemsTable age sort comparator inverted**
- **Found during:** Task 3 (StuckItemsTable testing)
- **Issue:** Plan's example comparator `a.created_at - b.created_at` with `desc: true` produces newest-first. The plan's behavior contract calls for "default sort age desc (oldest first)" — these are inconsistent.
- **Fix:** Inverted the comparator to `b.created_at - a.created_at` so `desc: true` surfaces oldest items first.
- **Files modified:** `src/components/activity/StuckItemsTable.tsx`
- **Verification:** Test 3 (default sort age descending oldest first) and Test 5 (keyboard Enter on first row navigates to s1) both pass.
- **Committed in:** `44d4ec1` (Task 3 commit)

**2. [Rule 1 - Bug] Verifier false-positive from `<ErrorState>` token in JSX comment**
- **Found during:** Task 2 (PhotoCoveragePanel)
- **Issue:** `verify-activity-error-state-contract.mjs` regex `<ErrorState\b([\s\S]*?)\/>` non-greedy matches from a comment `<ErrorState>` literal up to the FIRST `/>` it encounters — which in PhotoCoveragePanel was an SVG `<path .../>` inside the PhotoIcon component. Captured "attrs" then lacked the heading/body/onRetry props (because the actual ErrorState tag was further down the file).
- **Fix:** Removed the angle brackets from the file-header comment (`// Error: locked ErrorState contract` instead of `// Error: locked <ErrorState> contract`). Out of scope to fix the verifier itself.
- **Files modified:** `src/components/activity/PhotoCoveragePanel.tsx`
- **Verification:** `node scripts/verify-activity-error-state-contract.mjs` exits 0.
- **Committed in:** `48f7556` (Task 2 commit)

**3. [Rule 3 - Blocking] JSDom HTMLDialogElement.showModal not implemented**
- **Found during:** Task 2 (RawItemInspector test) and Task 3 (StuckItemsTable test)
- **Issue:** PayloadViewerModal calls `dialog.showModal()` in a useEffect; JSDom does not implement HTMLDialogElement methods natively, so the test threw `TypeError: dialog.showModal is not a function`.
- **Fix:** Polyfilled `HTMLDialogElement.prototype.showModal` and `.close` in the test setup `beforeEach` (mirrors the existing pattern in `src/components/kit/PayloadViewerModal.test.tsx`).
- **Files modified:** `src/components/activity/RawItemInspector.test.tsx`, `src/components/activity/StuckItemsTable.test.tsx`
- **Verification:** Both test files pass.
- **Committed in:** `48f7556` and `44d4ec1`.

**4. [Rule 1 - Bug] Test queries scoped to avoid duplicate-text matches in modal body**
- **Found during:** Task 2 (RawItemInspector Test 19)
- **Issue:** `screen.getByText(/Transcript line 1/i)` matched both the inspector preview `<dd>` AND the (mounted but closed) PayloadViewerModal's `<pre>` block (which serializes the same item data into JSON). `getByText` errors on multiple matches.
- **Fix:** Used `within(dl).getByText(...)` to scope the query into the inspector's `<dl>` preview block, excluding the modal `<pre>`.
- **Files modified:** `src/components/activity/RawItemInspector.test.tsx`
- **Verification:** Tests 19, 20, 21b green.
- **Committed in:** `48f7556`.

**5. [Rule 3 - Blocking] Test timing for hook retry: 1 backoff window**
- **Found during:** Task 2 (ThumbnailTile Test 11)
- **Issue:** `useSignedPhotoUrl` configures `retry: 1` (D-11). When createSignedUrl rejects, TanStack waits ~1s for backoff before settling to error. The test default `findByRole` timeout is 1000ms — the retry chip didn't render before timeout.
- **Fix:** Increased the `findByRole` timeout to 4000ms with a comment explaining the retry: 1 backoff rationale.
- **Files modified:** `src/components/activity/ThumbnailTile.test.tsx`
- **Verification:** Test 11 green.
- **Committed in:** `48f7556`.

**6. [Rule 1 - Bug] Empty-alt <img> not in a11y tree breaks getByRole('img')**
- **Found during:** Task 2 (ThumbnailTile Tests 10, 12, 13a, 13b)
- **Issue:** ThumbnailTile renders `<img alt="">` (decorative — alt comes from sibling caption). Empty-alt images are removed from the a11y tree and given the presentation role. `screen.findByRole('img')` therefore times out even though the `<img>` exists in the DOM.
- **Fix:** Switched these tests to `container.querySelector('img')` wrapped in `vi.waitFor`.
- **Files modified:** `src/components/activity/ThumbnailTile.test.tsx`
- **Verification:** All 7 ThumbnailTile tests green.
- **Committed in:** `48f7556`.

**7. [Rule 1 - Bug] Lint error from unused `_bucket` mock parameter**
- **Found during:** Post-Task-3 lint sweep
- **Issue:** `@typescript-eslint/no-unused-vars` does not honor the `_` prefix without explicit config. My ThumbnailTile.test.tsx mock function `(_bucket: string) => ({ ... })` raised an error.
- **Fix:** Removed the parameter entirely (`() => ({ ... })`).
- **Files modified:** `src/components/activity/ThumbnailTile.test.tsx`
- **Verification:** ESLint reports 0 errors on plan files (2 warnings remain, both about `useReactTable` from `react-hooks/incompatible-library` — characteristic library warning, not specific to this plan).
- **Committed in:** `945e2b2`.

---

**Total deviations:** 7 auto-fixed (5 Rule 1 bugs, 2 Rule 3 blockers)
**Impact on plan:** All deviations were test-environment workarounds, verifier-text avoidance, or comparator-correctness fixes. Zero scope creep — all 9 components delivered with the locked behavior contracts.

## Issues Encountered

- The verifier `verify-activity-error-state-contract.mjs` is too eager: it lazy-matches `<ErrorState\b([\s\S]*?)\/>` and gets confused when the file contains an `<ErrorState>` token in a comment AND a self-closing tag (e.g. SVG `<path .../>`) before the actual `<ErrorState>` JSX. Worked around at the source (avoiding `<ErrorState>` in comments). Verifier itself is out of scope to fix; flagged here for future iteration.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 03-07 (Wave 4 — alert cards):** ready. The Stuck Items alert card already has its own table here in 03-06; the alert card itself (count + maxAge surface in the page header) is the remaining work.
- **Plan 03-08 (Wave 5 — page composition):** ready. Will mount SessionMetadataCard + PhotoCoveragePanel + SessionItemList side-by-side on the SessionDetail page (the page is responsible for ET-formatting timestamps before passing them to SessionMetadataCard); will mount StuckItemsTable on /activity/stuck without the filter row (D-23); will mount SpecialistMultiSelect + ModeToggle in the /activity page header alongside DateRangeFilter from Phase 1.
- **No blockers.** All 9 components consume their hook contracts cleanly; type check clean; all 11 prebuild verifiers green; full test suite (53 files / 429 tests) passes.

## Self-Check: PASSED

All committed work verified on disk and in git history.

### Files verified (FOUND on disk)
- src/components/SpecialistMultiSelect.tsx
- src/components/SpecialistMultiSelect.test.tsx
- src/components/ModeToggle.tsx
- src/components/ModeToggle.test.tsx
- src/components/activity/SessionMetadataCard.tsx
- src/components/activity/SessionMetadataCard.test.tsx
- src/components/activity/PhotoCoveragePanel.tsx
- src/components/activity/PhotoCoveragePanel.test.tsx
- src/components/activity/ThumbnailTile.tsx
- src/components/activity/ThumbnailTile.test.tsx
- src/components/activity/SessionItemDisclosure.tsx
- src/components/activity/SessionItemDisclosure.test.tsx
- src/components/activity/RawItemInspector.tsx
- src/components/activity/RawItemInspector.test.tsx
- src/components/activity/SessionItemList.tsx
- src/components/activity/SessionItemList.test.tsx
- src/components/activity/StuckItemsTable.tsx
- src/components/activity/StuckItemsTable.test.tsx

### Commits verified (FOUND in git log)
- 69c1882 — feat(03-06): ship SpecialistMultiSelect + ModeToggle filter controls
- 48f7556 — feat(03-06): ship Session Detail surface (6 components)
- 44d4ec1 — feat(03-06): ship StuckItemsTable for /activity/stuck page
- 945e2b2 — fix(03-06): drop unused _bucket param in ThumbnailTile mock for lint compliance

---
*Phase: 03-tpc-app-activity-activity*
*Completed: 2026-05-01*
