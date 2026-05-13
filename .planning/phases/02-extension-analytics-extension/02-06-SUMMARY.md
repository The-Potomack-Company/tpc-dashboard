---
phase: 02-extension-analytics-extension
plan: 06
subsystem: extension-analytics
tags: [react, ui, live-feed, polling, accessibility, dev-gate, tdd]
requires:
  - phase: 02-extension-analytics-extension
    provides: "useLiveFeed hook with function-form refetchInterval + Resume invalidateQueries (Plan 02-03); isDevAccount allowlist gate + formatTimestampShort/EMPTY formatters (Plan 02-02); EventRow type from services/extension/queries (Plan 02-03); Phase 1 ErrorState locked contract (heading + body + onRetry); Phase 1 PayloadViewerModal + TableSkeleton (INFR-03)"
provides:
  - "src/components/extension/LiveEventFeed.tsx — EXT-08 polled live feed component (presentational; no polling logic)"
  - "src/components/extension/LiveEventFeed.test.tsx — 10 colocated tests covering D-09/D-10/D-11, D-18, badge palette, ErrorState contract, aria-live"
affects:
  - "Plan 02-08 (page composition): imports LiveEventFeed and mounts it in the admin surface (D-15)"
tech-stack:
  added: []
  patterns:
    - "Presentational component delegates ALL polling state to a TanStack Query hook (LiveEventFeed.tsx contains zero setInterval/setTimeout/invalidateQueries call sites — verified via grep)"
    - "D-18 admin/dev row split: admin rows render as <div> (not focusable, not in tab order); dev rows render as <button type='button' aria-haspopup='dialog'> with payload-viewer click handler. Same gate as RecentErrorsTable (Plan 02-05)."
    - "Live indicator: bg-green-500 + motion-safe:animate-pulse when running; bg-gray-400 static when paused. sr-only text label ('Live' / 'Paused') for screen readers per UI-SPEC § Accessibility."
    - "Subtitle <p> uses aria-live='polite' aria-atomic='true' so the Pause/Resume state change is announced by SR."
key-files:
  created:
    - "src/components/extension/LiveEventFeed.tsx"
    - "src/components/extension/LiveEventFeed.test.tsx"
  modified: []
key-decisions:
  - "Row content factored into a shared <RowContent> sub-component so the admin (<div>) and dev (<button>) shells render the same children without duplication. Cleaner than conditional className strings + a single shell."
  - "Loading state wraps TableSkeleton in a <table> (TableSkeleton renders <tbody>). Same wrap pattern Plan 02-05 RecentErrorsTable uses."
  - "Loading skeleton is gated by `isLoading && rows.length === 0 && !error` so a transient refetch error doesn't strobe the skeleton over a stale-but-rendered list."
patterns-established:
  - "Presentational live-feed pattern: data + paused + pause/resume all consumed via the hook; the component never opens a QueryClient or sets a timer. Future polled feeds (e.g. Phase 4 SCRP-16, Phase 5 LIVE-01) should follow this split."
  - "isDevAccount per-element render branch (button vs div) instead of a per-handler early return — keeps admin rows out of the keyboard tab order without relying on tabindex=-1."
requirements-completed: [EXT-08]

# Metrics
duration: 4min
completed: 2026-04-30
---

# Phase 02 Plan 06: LiveEventFeed Summary

**One-liner:** Polled live event feed component (EXT-08) — presentational shell over the Plan 02-03 `useLiveFeed` hook, with D-09/D-10/D-11 Pause/Resume semantics, D-18 admin/dev row-click split, the locked Phase 1 ErrorState contract, and full UI-SPEC § Color badge palette + § Accessibility live-region wiring.

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-30T10:35:00Z (after worktree base reset + `npm install`)
- **Completed:** 2026-04-30T10:39:00Z
- **Tasks:** 1 (TDD: RED → GREEN, no REFACTOR needed)
- **Files created:** 2

## Accomplishments

- `LiveEventFeed.tsx` ships as a pure presentational component — the load-bearing invariant from the plan ("no `setInterval`, `setTimeout`, or `invalidateQueries` in this file") is verified by `Grep` returning 0 call-site matches across both files.
- D-18 admin/dev branching is enforced at the element level: admin rows render as `<div>` (no `tabindex`, no `aria-haspopup`), dev rows render as `<button type='button' aria-haspopup='dialog'>`. Tests prove both branches: admin click is no-op (no dialog), dev click opens `PayloadViewerModal` with the title `${event_type} payload — ${user_email}` matching the EXT-06 convention from Plan 02-05.
- All UI-SPEC § Copywriting EXT-08 strings copied verbatim:
  - Running subtitle: `Tailing latest 50 events · refreshes every 10s`
  - Paused subtitle: `Paused · ${n} events shown at pause time`
  - Empty: `Waiting for events…`
  - Error heading: `Couldn't load live feed`
  - Error body: `Polling failed. Retry below to start tailing again.`
- All 5 event-type badge classes verbatim from UI-SPEC § Color, including the `text-amber-800` (NOT `-700`) contrast exception for `spreadsheet_transform`. `unknown` fallback added defensively for any out-of-vocabulary event_type the server might one day emit.
- Live indicator dot toggles `bg-green-500 motion-safe:animate-pulse` ↔ `bg-gray-400` with sr-only `Live`/`Paused` labels.
- Subtitle `<p>` is wired with `aria-live='polite' aria-atomic='true'` so screen readers announce the running ↔ paused state change.

## Task Commits

Each TDD gate was committed atomically:

1. **RED — failing tests for `LiveEventFeed`** — `7f036b2` (test)
2. **GREEN — implement `LiveEventFeed.tsx`** — `7c9a5f5` (feat)

No REFACTOR commit — the GREEN implementation passed all 10 tests + lint + typecheck on the first run.

## Files Created/Modified

- `src/components/extension/LiveEventFeed.tsx` (271 lines) — presentational polled feed card; consumes `useLiveFeed`, `useAuthStore`, `isDevAccount`, `formatTimestampShort`, `EMPTY`, `PayloadViewerModal`, `TableSkeleton`, `ErrorState`. Exports `LiveEventFeed`.
- `src/components/extension/LiveEventFeed.test.tsx` (331 lines) — 10 colocated Vitest tests with `useLiveFeed` and `useAuthStore` mocks; HTMLDialogElement polyfill for JSDom.

## Test Coverage

| # | Test | Asserts |
|---|------|---------|
| 1 | Initial mount running state | running subtitle + `bg-green-500 animate-pulse` dot + sr-only `Live` + Pause button |
| 2 | Pause click | `hook.pause()` called; rerender flips subtitle to `Paused · 5 events shown at pause time`; dot becomes `bg-gray-400` (no animate-pulse); button label flips to Resume |
| 3 | Resume click | `hook.resume()` called; rerender flips subtitle/button back to running form |
| 4 | 5 rows render with badges | 5 `<li>`; each event-type rendered once; UI-SPEC palette classes verbatim including `text-amber-800` for `spreadsheet_transform`; error row has `border-l-red-500` + red timestamp; non-error timestamps stay gray-500 |
| 5 | Admin row click no-op | with `email='admin@example.com'`, no row `<button aria-haspopup='dialog'>` exists; clicking the email cell opens no dialog |
| 6 | Dev row click opens modal | with `email='josh@potomackco.com'`, row `<button>` with `aria-haspopup='dialog'` exists; click opens `<dialog role='dialog'>` with title `catalog_single payload — a@x.com` |
| 7 | Empty state | `data: []` renders italic gray-500 `Waiting for events…` |
| 8 | Error state | `error: Error('network down')` renders `<ErrorState>` with locked heading/body; clicking the internal Retry calls `refetch()` |
| 9 | Pause/Resume aria-labels | `Pause live feed` when running, `Resume live feed` when paused |
| 10 | Subtitle aria attributes | `aria-live='polite'` + `aria-atomic='true'` on the running subtitle |

**Total: 10 tests, all green. Project test suite grew from 199 → 209.**

## Verification

| Step | Command | Result |
|------|---------|--------|
| Plan-scoped tests | `npx vitest --run src/components/extension/LiveEventFeed.test.tsx` | **10 passed** |
| Full project test suite | `npx vitest --run` | **209 passed** (28 files), no regressions |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Lint, scoped to new files | `npx eslint src/components/extension/LiveEventFeed.tsx src/components/extension/LiveEventFeed.test.tsx` | clean |
| No polling code in the component | `grep -E "setInterval\\(\|setTimeout\\(\|invalidateQueries\\(" src/components/extension/LiveEventFeed.tsx` | **0 matches** (only 1 reference inside a documentation comment) |

## Key Confirmations (Plan 02-06 output requirements)

1. **Component file + test file paths.** `src/components/extension/LiveEventFeed.tsx` (1 export: `LiveEventFeed`); `src/components/extension/LiveEventFeed.test.tsx` (10 tests).

2. **All polling state is owned by `useLiveFeed`.** `LiveEventFeed.tsx` does NOT import `useQueryClient`, NOT call `setInterval`, NOT call `setTimeout`, NOT call `invalidateQueries`. The component reads `{ data, isLoading, error, refetch, paused, pause, resume }` from the hook return shape. The Pause/Resume buttons wire directly to `pause` / `resume` from the hook — no local state machine.

3. **5 event-type badge color classes verified verbatim from UI-SPEC § Color.** Asserted in Test 4:
   - `catalog_single` → `bg-slate-100 text-slate-700`
   - `catalog_batch` → `bg-sky-100 text-sky-700`
   - `portal_upload` → `bg-teal-100 text-teal-700`
   - `spreadsheet_transform` → `bg-amber-100 text-amber-800` (the contrast exception)
   - `data_import` → `bg-violet-100 text-violet-700`

4. **D-18 admin/dev branching verified via test.** Test 5 (admin no-op): `useAuthStore` mocked to return `email='admin@example.com'`; component renders rows as `<div>`; clicking the email cell does NOT open the dialog; no row-buttons advertise `aria-haspopup='dialog'`. Test 6 (dev modal-open): mock returns `email='josh@potomackco.com'`; component renders rows as `<button aria-haspopup='dialog'>`; clicking the first row opens the `<dialog>` with the title matching `catalog_single payload — a@x.com`.

5. **Deviations from UI-SPEC § Copywriting EXT-08:** **zero**. All five strings (running subtitle, paused subtitle, empty, error heading, error body) are copy-pasted from the spec.

## Decisions Made

- **`<RowContent>` sub-component factored out** so the admin `<div>` and dev `<button>` shells render the same children without duplicating the timestamp/badge/email JSX.
- **Loading skeleton wraps `TableSkeleton` in a `<table>`** because `TableSkeleton` renders `<tbody>` directly. Same pattern Plan 02-05 `RecentErrorsTable` uses for its loading branch.
- **Loading branch is gated by `!error`** so a polling failure during a refetch shows the `ErrorState` instead of strobing the skeleton over a stale-but-rendered list.
- **`unknown` badge class added** as a defensive fallback for any out-of-vocabulary `event_type` (e.g. if `catalog_item` were ever to leak through despite D-02's exclusion). Keeps the row visible without throwing on a missing palette key.

## Deviations from Plan

None. The Action block in the plan was followed verbatim (with the small DRY refactor of pulling row content into a sub-component, which is structurally equivalent — same DOM output, same className strings, same a11y attributes).

## Issues Encountered

None. The TDD cycle was clean:

- **RED:** All 10 tests failed with `Failed to resolve import "./LiveEventFeed"` — the expected module-not-found error before the GREEN implementation existed.
- **GREEN:** First-pass implementation passed all 10 tests + lint + typecheck. No iteration needed.

## Threat Model Compliance

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-22 (Information Disclosure — feed polling on hidden tab) | accept | TanStack default `refetchIntervalInBackground: false` (inherited via `QueryClientProvider`); confirmed in Plan 02-03 SUMMARY; not re-tested here. |
| T-02-23 (DoS — Pause click stuck) | mitigate | Plan 02-03's `useLiveFeed.test.tsx` proves the hook contract via fake timers. This plan's Tests 2 + 3 additionally assert the visual state flip (subtitle text, button label, dot color) so a hook-side regression that didn't update `paused` would still be caught at the component layer. |
| T-02-24 (Elevation of Privilege — admin row click bypassed via DOM manipulation) | accept | Same trade-off as Plan 02-05 (T-02-19): RLS is authoritative; UI gate is organizational. A DOM-spoofer cannot read more than RLS already grants because `items_content` is gated server-side. |

## Stub Tracking

No stubs introduced. The component renders real data from `useLiveFeed`, real loading/error/empty states, and real `PayloadViewerModal` integration. No hardcoded empty arrays, no placeholder data, no mock-only paths in the source file.

## Threat Flags

None. The component introduces no new network endpoints, no new auth paths, no file access patterns, and no schema changes. It composes existing surface (the auth store profile selector, the live-feed hook, the payload modal) under the same trust boundaries Plan 02-05 already set.

## Self-Check: PASSED

Files created (verified via `[ -f path ]`):
- FOUND: src/components/extension/LiveEventFeed.tsx
- FOUND: src/components/extension/LiveEventFeed.test.tsx

Commits (verified via `git log --oneline | grep`):
- FOUND: 7f036b2 (test — RED)
- FOUND: 7c9a5f5 (feat — GREEN)

## Next Phase Readiness

- Plan 02-08 (page composition) can now `import { LiveEventFeed } from '../components/extension/LiveEventFeed'` and mount it in the admin surface (D-15) with no props.
- Hook contract used by `LiveEventFeed`:
  ```ts
  const { data, isLoading, error, refetch, paused, pause, resume } = useLiveFeed();
  ```
  No additional props or context required — the component reads its dev-gate signal from the auth store directly (same as `RecentErrorsTable` from Plan 02-05).

---
*Phase: 02-extension-analytics-extension*
*Plan: 06*
*Status: COMPLETE*
