---
phase: 02-extension-analytics-extension
plan: 04
subsystem: extension-analytics
tags: [components, recharts, ext-01, ext-02, ext-03, charts, kpi, tdd]
requires:
  - phase: 02-extension-analytics-extension
    provides: "Wave 2 hooks (Plan 02-03): useEventVolume, useKpiTotals, useErrorRate; Phase 1 UI kit (KpiCard with KpiDelta export, Sparkline), EmptyState, ErrorState (locked heading/body/onRetry contract); src/lib/format.ts (formatCount, formatPercent, EMPTY)"
provides:
  - "src/components/extension/EventVolumeChart.tsx — EXT-01 14-day stacked bar (range-aware tickFormatter, 5 locked colors, defensive catalog_item exclusion)"
  - "src/components/extension/KpiStrip.tsx — EXT-02 5-card KPI strip with previous-period delta math (D-05) + Sparkline pass-through"
  - "src/components/extension/ErrorRateChart.tsx — EXT-03 horizontal error-rate bar (single neutral fill, red text >= 5%)"
affects:
  - "Plan 02-08 (page composition): imports the three components into ExtensionPage card slots"
tech-stack:
  added: []
  patterns:
    - "Phase 1 Recharts JSDom mock pattern (Sparkline.test.tsx lines 13-32) reused verbatim across all 3 colocated test files; cloned ResponsiveContainer dimensions are sized per-card (chart 800x288, sparkline 200x32)"
    - "5-event vocabulary defense in depth: EVENT_TYPE_ORDER constant in EventVolumeChart.tsx + KpiStrip.tsx drops any off-vocab event_type (e.g., catalog_item) before rendering; verified by Test 6 in EventVolumeChart.test.tsx"
    - "Locked ErrorState contract (heading: string, body: string, onRetry: () => void) used by all 3 components; no children, no sibling Retry buttons (Phase 1 component renders one internally)"
    - "Per-card loading/empty/error branches per D-21: each component owns its own skeleton + EmptyState + ErrorState; one slow query never blocks the others"
    - "Recharts horizontal-bars idiom: BarChart layout='vertical' + YAxis type='category' (the layout flag refers to axis direction, not bar direction)"
key-files:
  created:
    - "src/components/extension/EventVolumeChart.tsx"
    - "src/components/extension/EventVolumeChart.test.tsx"
    - "src/components/extension/KpiStrip.tsx"
    - "src/components/extension/KpiStrip.test.tsx"
    - "src/components/extension/ErrorRateChart.tsx"
    - "src/components/extension/ErrorRateChart.test.tsx"
  modified: []
decisions:
  - "Recharts emits Bar fill on the underlying <path> element (not <rect>); the ErrorRateChart Test 6 asserts fill via path[fill='#9ca3af'] selector (single test-side adjustment captured during GREEN phase)"
  - "Recharts LabelList content callback typed via Recharts' wider Props shape (string | number | undefined positional args); component coerces to numbers internally via Number(...) — keeps strict typecheck happy without runtime impact"
  - "EmptyState requires a children prop (Phase 1 contract); both EventVolumeChart and ErrorRateChart pass an empty fragment <></> for the empty branch since the heading carries the full message"
metrics:
  completed: "2026-04-30"
  duration_minutes: 7
  task_count: 3
  file_count: 6
  test_count_added: 21
  test_count_total_after: 164
requirements: [EXT-01, EXT-02, EXT-03]
---

# Phase 02 Plan 04: Admin Charts (Stacked Bar / KPI Strip / Error Rate) Summary

**One-liner:** Three colocated TypeScript React components (`EventVolumeChart`, `KpiStrip`, `ErrorRateChart`) consuming the Wave-2 hooks and rendering the primary admin-surface visuals via Recharts, with locked-color palettes, range-aware bucketing, defense-in-depth event-vocab filtering, and the Phase 1 per-card loading/empty/error contract intact.

## What Shipped

### Component files (3 source + 3 colocated test)

| File | Purpose | Test count |
|------|---------|-----------|
| `src/components/extension/EventVolumeChart.tsx` | EXT-01 14-day stacked bar; 5 locked-color series; range-aware `M/d` ↔ `h a` tickFormatter; defensive `catalog_item` drop | 6 |
| `src/components/extension/KpiStrip.tsx` | EXT-02 5 KPI cards; computeDelta(cur, prev) → up/down/flat with `vs prev period` label; Sparkline pass-through; EMPTY for zero counts | 8 |
| `src/components/extension/ErrorRateChart.tsx` | EXT-03 horizontal bar (`layout="vertical"`); single neutral `#9ca3af` fill; LabelList renderRateLabel switches to `fill-red-600` at ≥ 5% | 7 |
| **Total** | | **21** |

### Test counts and project totals

- 3 colocated test files: **21 new tests** (plan estimate ~20 — matches)
- Full project test suite: **164 passed** (24 files); base after Wave 2 was **143 passed** → +21, no regressions
- Project typecheck: clean
- Lint scoped to new files (`src/components/extension`): clean
- Pre-existing lint issues in `src/components/kit/DateRangeFilter.tsx` and `src/stores/authStore.ts` are documented in `.planning/phases/02-extension-analytics-extension/deferred-items.md` (Plan 02-02 already filed them; not in scope here)

## Pattern Conformance

### Phase 1 Recharts JSDom mock — verbatim reuse

Each test file mounts the same `vi.mock('recharts', ...)` block lifted directly from `src/components/kit/Sparkline.test.tsx` lines 13-32. The only per-file delta is the cloned `width`/`height` numerals:

| Test file | Cloned ResponsiveContainer dimensions | Reason |
|-----------|---------------------------------------|--------|
| `EventVolumeChart.test.tsx` | 800 × 288 | Chart-card body height `h-72` = 288px |
| `KpiStrip.test.tsx` | 200 × 32 | Sparkline-default dimensions (Sparkline transitively renders Recharts) |
| `ErrorRateChart.test.tsx` | 800 × 288 | Same chart-card body height |

No new mock helpers, no shared `setupTests.ts` modifications.

### 5-event vocabulary

`EVENT_TYPE_ORDER` is locally re-declared in `EventVolumeChart.tsx` (lines 23-29) and `KpiStrip.tsx` (lines 19-25). It matches the Plan 02-03 service-module export `EXTENSION_EVENT_TYPES` byte-for-byte; the local copy is defense in depth so a Recharts-side render path can never see a sixth literal even if the RPC payload were tampered with. Verified by:

- **EventVolumeChart Test 6:** A fixture row with `event_type: 'catalog_item'` is injected into the dataset; the rendered DOM still has exactly 5 `<g class="recharts-bar">` groups and `screen.queryByText('catalog_item')` returns null.

### Locked colors

| Constant | Hex | UI-SPEC reference |
|----------|-----|-------------------|
| `EVENT_COLORS.catalog_single` | `#64748b` (slate-500) | UI-SPEC § Color line 199 |
| `EVENT_COLORS.catalog_batch` | `#0284c7` (sky-600) | line 200 |
| `EVENT_COLORS.portal_upload` | `#0d9488` (teal-600) | line 201 |
| `EVENT_COLORS.spreadsheet_transform` | `#d97706` (amber-600) | line 202 |
| `EVENT_COLORS.data_import` | `#7c3aed` (violet-600) | line 203 |
| `BAR_FILL` (ErrorRateChart) | `#9ca3af` (gray-400) | line 207 |
| `HIGH_RATE_THRESHOLD` | `0.05` (5%) | line 207 |

Zero color deviations.

### LOCKED ErrorState contract

All three components invoke `<ErrorState>` with the documented `(heading: string, body: string, onRetry: () => void)` shape — no children, no sibling buttons. Verified by:

- **EventVolumeChart Test 4:** Asserts `getByRole('alert')` carries the heading text, then clicks the built-in Retry button and confirms `refetch()` is called.
- **KpiStrip Test 8:** Same pattern with heading `Couldn't load KPIs`.
- **ErrorRateChart Test 5b:** Same pattern with heading `Couldn't load error rates`.

Implementation invocations:

```tsx
// EventVolumeChart.tsx
<ErrorState
  heading="Couldn't load event volume"
  body="Something went wrong loading the chart. Retry below."
  onRetry={() => void query.refetch()}
/>

// KpiStrip.tsx
<ErrorState
  heading="Couldn't load KPIs"
  body="Retry below or refresh the page."
  onRetry={() => void query.refetch()}
/>

// ErrorRateChart.tsx
<ErrorState
  heading="Couldn't load error rates"
  body="Something went wrong. Retry below."
  onRetry={() => void query.refetch()}
/>
```

`grep -c "<ErrorState" src/components/extension/*.tsx` returns 3 (one per component).

### KpiDelta type import

`KpiStrip.tsx` line 1 imports `KpiDelta` as a type from the Phase 1 module:

```tsx
import { KpiCard, type KpiDelta } from '../kit/KpiCard';
```

Confirmed by reading `src/components/kit/KpiCard.tsx` line 8: `export interface KpiDelta` shape `{ value: string | number; direction: 'up' | 'down' | 'flat'; label?: string }` — verbatim what the plan's `<interfaces>` block specified.

## Verification

| Step | Command | Result |
|------|---------|--------|
| Plan-scoped tests | `npx vitest --run src/components/extension/{EventVolumeChart,KpiStrip,ErrorRateChart}.test.tsx` | **21 passed** |
| Full project test suite | `npx vitest --run` | **164 passed** (24 files), no regressions |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Lint, scoped to new files | `npx eslint src/components/extension` | clean |
| Plan files exist | `[ -f path ]` | all 6 found (see Self-Check) |
| ErrorState contract | `grep -c "<ErrorState" src/components/extension/*.tsx` | 3 (one per component) |
| Locked palette intact | `grep -c "#64748b\|#0284c7\|#0d9488\|#d97706\|#7c3aed" src/components/extension/EventVolumeChart.tsx` | 5 |
| Neutral bar fill intact | `grep -c "#9ca3af" src/components/extension/ErrorRateChart.tsx` | 1 (BAR_FILL constant) |
| `isAnimationActive={false}` | `grep -c "isAnimationActive={false}" src/components/extension/{EventVolumeChart,ErrorRateChart}.tsx` | 2 (one per chart file; the value applies to all Bars in EventVolumeChart's mapped render) |

## Commits

| Order | Hash | Type | Summary |
|-------|------|------|---------|
| 1 | `64ed7e1` | test | RED — failing tests for EventVolumeChart (Task 1) |
| 2 | `37498c7` | feat | GREEN — implement EventVolumeChart EXT-01 (Task 1) |
| 3 | `263f19e` | test | RED — failing tests for KpiStrip (Task 2) |
| 4 | `798174a` | feat | GREEN — implement KpiStrip EXT-02 (Task 2) |
| 5 | `240d9b4` | test | RED — failing tests for ErrorRateChart (Task 3) |
| 6 | `275d974` | feat | GREEN — implement ErrorRateChart EXT-03 (Task 3) |
| 7 | `1aaed53` | fix | Satisfy strict typecheck on Recharts component callbacks (Rule 3 auto-fix) |

## TDD Gate Compliance

Three independent TDD cycles, one per task. Every implementation commit (`feat`) is preceded by a failing-test commit (`test`) that fails with module-not-found errors. RED commits were verified to fail before GREEN was written:

- Task 1 RED: `64ed7e1` (`Failed to resolve import "./EventVolumeChart"`)
- Task 1 GREEN: `37498c7` (6 tests pass)
- Task 2 RED: `263f19e` (`Failed to resolve import "./KpiStrip"`)
- Task 2 GREEN: `798174a` (8 tests pass)
- Task 3 RED: `240d9b4` (`Failed to resolve import "./ErrorRateChart"`)
- Task 3 GREEN: `275d974` (7 tests pass; one assertion needed test-side path-vs-rect adjustment captured in the same GREEN commit)

A separate `fix` commit (`1aaed53`) followed GREEN to satisfy `tsc -b --noEmit` (3 strict-mode errors on Recharts callback prop types — `Tooltip` formatter and `LabelList` content). The fix is type-only; runtime behavior is unchanged. Tests stayed green throughout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Strict typecheck on Recharts callback prop types**
- **Found during:** post-Task-3 plan-level verification (`npx tsc -b --noEmit`)
- **Issue:** Three TS2322/TS2352 errors:
  - `EventVolumeChart.tsx`: `WideRow` cast to `Record<string, unknown>` had insufficient index-signature overlap.
  - `ErrorRateChart.tsx` Tooltip formatter typed `(v: number) => string` — Recharts' `Formatter` expects `ValueType | undefined`.
  - `ErrorRateChart.tsx` LabelList content typed against a custom `RateLabelProps` — Recharts' `LabelContentType` provides `string | number | undefined` for x/y/width/height/value.
- **Fix:**
  - Cast via `(wide as unknown as Record<string, unknown>)` in `pivotForRecharts`.
  - Tooltip formatter accepts `ValueType` and Number-coerces internally.
  - LabelList content accepts `LabelContentProps` with `string | number | undefined` and Number-coerces all positional args before doing math.
- **Files modified:** `EventVolumeChart.tsx`, `ErrorRateChart.tsx`
- **Commit:** `1aaed53`

**2. [Test-side adjustment captured in Task 3 GREEN] Recharts emits Bar fill on `<path>`, not `<rect>`**
- **Found during:** Task 3 GREEN verification (Test 6 fail: `expected 0 to be greater than 0` querying `rect[fill="#9ca3af"]`)
- **Issue:** A debug `_debug.test.tsx` (subsequently deleted before commit) revealed that Recharts renders bar rectangles as `<g class="recharts-rectangle">` containing a `<path fill="#9ca3af" ...>` — the `<rect>` selector matched only the chart background, not the bars.
- **Fix:** Test 6 selector changed from `rect[fill="#9ca3af"]` to `path[fill="#9ca3af"]` (single line). The implementation behavior is unchanged; the test mechanism aligned with Recharts' actual DOM output.
- **Files modified:** `ErrorRateChart.test.tsx` (Task 3 RED already committed; the adjustment shipped in Task 3 GREEN commit `275d974`)

### EmptyState children prop (already documented in design)

`src/components/EmptyState.tsx` requires `children: ReactNode`. The plan's empty-branch sketch passed only `heading`. To compile, both `EventVolumeChart` and `ErrorRateChart` pass an empty fragment `<></>` for the children slot since the heading carries the full message ("No events in this range"). Tests still pass with this rendering — `screen.getByText('No events in this range')` finds the heading.

## Threat Model Compliance

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-15 (Tampering — future RPC ALTER returns extra event_type) | mitigate | `EVENT_TYPE_ORDER` constants in `EventVolumeChart.tsx` lines 23-29 and `KpiStrip.tsx` lines 19-25 filter unknown event_types; verified by EventVolumeChart Test 6 (catalog_item injection → still 5 bar groups, no `catalog_item` text in legend). Defense in depth on top of RPC's own predicate (D-02). |
| T-02-16 (Information Disclosure — wrong delta direction for cancellation rate) | n/a (this plan only covers count KPIs where more = good) | `KpiStrip.computeDelta` is hard-coded "more = good" because it serves only EXT-02 count KPIs. Plan 02-07's `<CancellationRateKpis>` will flip direction (more = bad) at its own caller layer per UI-SPEC § Color "Caller chooses semantic direction". |
| T-02-17 (DoS — chart re-renders 60Hz on every parent re-render) | accept | TanStack Query's structural sharing + `isAnimationActive={false}` keep React reconciliation cheap. Recharts re-renders are bounded to data changes (queryKey invalidation) not parent re-renders. |

## Stub Tracking

No stubs introduced. All three components pull data from real Wave-2 hooks (`useEventVolume`, `useKpiTotals`, `useErrorRate`); none short-circuit to hardcoded arrays, mock data, or "TODO" placeholders. The empty-state copy ("No events in this range") and ErrorState bodies are user-visible operator copy, not developer placeholders.

## Threat Flags

None. The three components are pure presentational consumers of typed query results — no new network endpoints, no new auth paths, no new file access patterns, no schema changes.

## Self-Check: PASSED

Files created (verified via `[ -f path ]`):
- FOUND: src/components/extension/EventVolumeChart.tsx
- FOUND: src/components/extension/EventVolumeChart.test.tsx
- FOUND: src/components/extension/KpiStrip.tsx
- FOUND: src/components/extension/KpiStrip.test.tsx
- FOUND: src/components/extension/ErrorRateChart.tsx
- FOUND: src/components/extension/ErrorRateChart.test.tsx

Commits (verified via `git log --oneline | grep`):
- FOUND: 64ed7e1 (test — Task 1 RED)
- FOUND: 37498c7 (feat — Task 1 GREEN)
- FOUND: 263f19e (test — Task 2 RED)
- FOUND: 798174a (feat — Task 2 GREEN)
- FOUND: 240d9b4 (test — Task 3 RED)
- FOUND: 275d974 (feat — Task 3 GREEN)
- FOUND: 1aaed53 (fix — strict typecheck)

---
*Phase: 02-extension-analytics-extension*
*Plan: 04*
*Status: COMPLETE*
