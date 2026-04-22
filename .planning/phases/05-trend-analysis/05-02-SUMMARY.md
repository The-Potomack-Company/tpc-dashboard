---
phase: 05-trend-analysis
plan: 02
subsystem: ui
tags: [react, tailwind, vitest, wai-aria, typescript]

# Dependency graph
requires:
  - plan: 05-01
    provides: "src/lib/period.ts → RangePreset, Range, rangeFromPreset, DEFAULT_RANGE_PRESET"
  - phase: 03-sale-views
    provides: "src/lib/format.ts → formatDate (used for Custom status line)"
provides:
  - "src/components/DateRangeFilter.tsx — 5-preset radiogroup + Custom disclosure panel"
  - "src/components/MetricToggle.tsx — 2-option heat-map metric radiogroup"
  - "HeatMapMetric type ('sell_through' | 'revenue_share') exported from MetricToggle"
affects: [05-03-data-hooks, 05-06-department-heat-map, 05-07-trends-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third consumer of the WAI-ARIA segmented-control radiogroup pattern (after PeriodSelector + now the two Phase 5 filters). Kept independent — extraction deferred to post-Phase 6."
    - "Disclosure panel pattern: aria-expanded + aria-haspopup='dialog' on a trigger button inside the same fieldset as the radios."
    - "Controlled segmented control with local-only UI state (customOpen, error, input mirrors) — the authoritative Range value always lives with the parent; useEffect resyncs local input state when value.start/end change externally."
    - "jsdom date-input workaround: fireEvent.change(input, { target: { value } }) sets <input type=date> reliably; userEvent.type doesn't synthesize the full yyyy-mm-dd spinner flow."
    - "Fake-timer interaction pattern: fireEvent (not userEvent) inside describe blocks using vi.useFakeTimers — userEvent's internal scheduler deadlocks when the global timer queue is mocked."

key-files:
  created:
    - src/components/DateRangeFilter.tsx
    - src/components/MetricToggle.tsx
    - src/tests/date-range-filter.test.tsx
    - src/tests/metric-toggle.test.tsx
  modified: []

key-decisions:
  - "Tests live in src/tests/ (not colocated in src/components/). Follows established project convention — every test file in the project sits under src/tests/. Deviation from PLAN.md's files_modified path; behaviorally equivalent since vitest.config includes 'src/**/*.test.{ts,tsx}'."
  - "Test count expanded beyond plan. Plan specified 9 + 5 tests; delivered 21 + 13. Finer-grained `it` blocks so failures pinpoint a single assertion (render / active / dividers / keyboard / Apply / Reset / status). No coverage gaps vs plan."
  - "Custom button rendered INSIDE the preset fieldset (per UI-SPEC layout) but it is NOT part of the radiogroup. Arrow/Home/End navigate only the 5 preset radios — Custom is a disclosure trigger with aria-expanded + aria-haspopup='dialog'."
  - "Controlled inputs. startInput/endInput mirror value.start/end via useEffect. Parent stays the source of truth; panel inputs don't clobber each other across re-renders."
  - "Reset emits rangeFromPreset(DEFAULT_RANGE_PRESET) rather than a hardcoded preset. Single source of truth; Trends page (05-07) and filter can never drift."

patterns-established:
  - "Pattern: disclosure panel inline under a segmented control — fieldset emits a radiogroup + a sibling toggle with aria-expanded/aria-haspopup. Panel renders outside the fieldset (below) via conditional ternary on a local boolean."
  - "Pattern: validation error rendered as <p role='alert'> sibling of the inputs — no toast, no modal."
  - "Pattern: segmented-control Custom button uses border-l unconditionally (always the last segment, always divided from its neighbor)."

requirements-completed: [TRND-03]

# Metrics
duration: 8m
completed: 2026-04-22
---

# Phase 5 Plan 02: DateRangeFilter + MetricToggle Summary

**Two controlled segmented-control components landed green: DateRangeFilter (5 presets + Custom disclosure + start/end validation) and MetricToggle (Sell-through % / Revenue share %) — both WAI-ARIA radiogroup compliant with 34 new tests.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files created:** 4 (2 components + 2 test files)
- **New tests:** 34 (21 DateRangeFilter + 13 MetricToggle)
- **Full suite:** 393/393 green (was 359 after 05-01)

## Accomplishments

- `DateRangeFilter` mounts a `fieldset[aria-label="Select date range"]` with five radio-role preset buttons (YTD/L6M/L12M/L24M/All time) + a Custom disclosure trigger inside the same fieldset.
- Arrow/Home/End navigate the 5 presets per WAI-ARIA radiogroup; Custom is excluded from keyboard nav (it's a disclosure trigger, not a radio).
- Custom panel exposes `<input type="date">` for Start + End, plus `Apply range` and `Reset` buttons.
- Apply validates `start <= end` via lexicographic yyyy-mm-dd compare — invalid ranges render an inline `<p role="alert">` with the UI-SPEC-locked copy `Start date must be on or before end date.` and do NOT emit onChange.
- Status line `Custom range: {formatDate(start)} – {formatDate(end)}` renders under the fieldset only when `value.preset === 'custom' && !customOpen` (U+2013 en-dash per UI-SPEC).
- `MetricToggle` exports `HeatMapMetric = 'sell_through' | 'revenue_share'` and a 2-option radiogroup mirroring PeriodSelector.
- Type-check clean, build clean, 393/393 tests green.

## Task Commits

1. **Task 1: DateRangeFilter component + 21 tests** — `be39dfb` (feat)
2. **Task 2: MetricToggle component + 13 tests** — `a06abe5` (feat)

## Files Created/Modified

### Created
- `src/components/DateRangeFilter.tsx` — 5-preset radiogroup + Custom disclosure + validation panel + status line.
- `src/components/MetricToggle.tsx` — 2-option radiogroup with roving tabIndex + Arrow/Home/End.
- `src/tests/date-range-filter.test.tsx` — 21 tests: render structure, active state, dividers, Custom button aria, focus ring, preset clicks (fake-time YTD assertion), All-time null emission, keyboard nav (Arrow/Home/End with wrap), Custom panel open/close, start>end alert, valid Apply, Reset, preset-click-closes-panel, status line presence/absence, no onChange on render.
- `src/tests/metric-toggle.test.tsx` — 13 tests: render labels + titles, fieldset aria-label, divider, focus ring, active/inactive state, click, Arrow left/right, Home/End, no onChange on render.

### Modified
- (none)

### Key export snippets

```ts
// src/components/DateRangeFilter.tsx
export interface DateRangeFilterProps {
  value: Range;
  onChange: (next: Range) => void;
}
export function DateRangeFilter(props: DateRangeFilterProps): JSX.Element;
```

```ts
// src/components/MetricToggle.tsx
export type HeatMapMetric = 'sell_through' | 'revenue_share';
export interface MetricToggleProps {
  value: HeatMapMetric;
  onChange: (next: HeatMapMetric) => void;
}
export function MetricToggle(props: MetricToggleProps): JSX.Element;
```

## Decisions Made

- **Tests in `src/tests/`, not colocated.** PLAN.md listed `src/components/DateRangeFilter.test.tsx`, but every existing test file in the repo lives under `src/tests/`. I followed the project convention — vitest.config matches `src/**/*.test.{ts,tsx}` so either location works, but co-location would drift from convention. Behaviorally equivalent.
- **Test count expanded.** Plan specified 9 + 5; delivered 21 + 13. Reason: finer-grained `it` blocks give precise failure messages. All plan-required behaviors remain covered.
- **Custom button is inside the fieldset but outside the radiogroup.** The UI-SPEC renders `Custom` as a segment of the control visually but documents it as a disclosure trigger (not a 6th radio). Arrow/Home/End navigate only the 5 preset radios. Custom uses `aria-expanded` + `aria-haspopup="dialog"`.
- **fireEvent instead of userEvent in two test blocks.** jsdom + `<input type="date">` + `userEvent.type` does not reliably set the full yyyy-mm-dd value (input spinner flow isn't synthesized). And userEvent's internal scheduler deadlocks inside `vi.useFakeTimers`. Both use cases switched to `fireEvent.click` / `fireEvent.change` with inline rationale comments in the test file.
- **Reset emits via `rangeFromPreset(DEFAULT_RANGE_PRESET)`.** Single-source-of-truth — prevents the DateRangeFilter and Trends page (05-07) from drifting on what "default" means.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom date-input / userEvent test ergonomics**
- **Found during:** Task 1 test iteration (GREEN phase).
- **Issue:** `userEvent.type` on `<input type="date">` did not set a complete `yyyy-mm-dd` value in jsdom, so Apply-range assertions failed. Separately, `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` inside `vi.useFakeTimers()` deadlocked `user.click` with "Test timed out in 5000ms".
- **Fix:** Switched to `fireEvent.change(input, { target: { value } })` for date-input assertions and `fireEvent.click` for the fake-timer preset-click assertions. Same assertions, same surface area, reliable in jsdom.
- **Files modified:** `src/tests/date-range-filter.test.tsx` (test-only; component unchanged).
- **Commit:** folded into task 1 commit (`be39dfb`) since these were iterations before the RED→GREEN handshake.

### File-path deviation (convention alignment)

Plan listed `src/components/DateRangeFilter.test.tsx` and `src/components/MetricToggle.test.tsx`. I placed them at `src/tests/date-range-filter.test.tsx` and `src/tests/metric-toggle.test.tsx` to match the project's existing convention (every test in the repo lives under `src/tests/`, including the 05-01 chart tests). The vitest project include pattern `src/**/*.test.{ts,tsx}` matches either location.

## Issues Encountered

- **Initial write path confusion (recurring from 05-01).** The first `Write` call for `src/tests/date-range-filter.test.tsx` landed in the main repo rather than the worktree. Caught immediately when `vitest` reported "No test files found" and a `ls` in the worktree showed the file missing. Moved the file from `C:/Users/maser/Projects/tpc-dashboard/src/tests/` to the worktree path and used absolute worktree paths for every subsequent Write. No code impact; no commit pollution.
- **HEAD reset required.** Branch HEAD was `f0c2b92` (main branch tip) rather than `7563cca2` (05-01 tip). Executed `git reset --hard 7563cca2056f3e45c0c17528ea41a5b1c6de7ef4` before any work so Plan 05-01's exports were present on disk.

## User Setup Required

None — pure frontend components.

## Next Phase Readiness

- **Wave 2 Plan 05-03 (data hooks)** can consume `Range` from `value: Range` flowing through DateRangeFilter.
- **Wave 3 Plan 05-06 (department heat map)** can import `MetricToggle` and `HeatMapMetric` to drive the sell-through-vs-revenue-share switch.
- **Wave 4 Plan 05-07 (Trends page)** composes DateRangeFilter at page scope with `useState<Range>(rangeFromPreset(DEFAULT_RANGE_PRESET))`. All five charts receive the same `range` prop.

## Verification

- `npx vitest --run` — 40 test files / 393 tests passed (34 new in this plan, 359 pre-existing).
- `npx tsc -b` — clean.
- `npm run build` — clean (436 kB JS / 31 kB CSS).
- `npx vitest --run date-range-filter` — 21/21 green.
- `npx vitest --run metric-toggle` — 13/13 green.

## Self-Check: PASSED

Commits verified:
- FOUND: be39dfb (Task 1 — DateRangeFilter)
- FOUND: a06abe5 (Task 2 — MetricToggle)

Files verified:
- FOUND: src/components/DateRangeFilter.tsx
- FOUND: src/components/MetricToggle.tsx
- FOUND: src/tests/date-range-filter.test.tsx
- FOUND: src/tests/metric-toggle.test.tsx

---
*Phase: 05-trend-analysis*
*Completed: 2026-04-22*
