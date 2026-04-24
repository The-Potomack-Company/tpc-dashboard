---
phase: 04-kpi-landing-page
plan: 02
subsystem: kpi-landing-page
tags: [wave-0, pure-functions, zod, tdd, formatters, period-math]
dependency-graph:
  requires:
    - Plan 04-01 (kpi_summary RPC migration + regenerated database.types.ts)
  provides:
    - src/lib/period.ts — Period enum + computePeriodBounds + toIsoDateLocal
    - src/lib/format.ts — formatDelta + DeltaDirection + DeltaType + FormattedDelta
    - src/lib/kpi-schema.ts — kpiSummarySchema + KpiSummary + KpiWindow
  affects:
    - Plan 04-03 (Dashboard page, useKpiSummary hook, KpiCard) — consumes every export above
tech-stack:
  added: []
  patterns:
    - Zod v4 numericLike union (number | string→number) for PostgREST precision preservation
    - Half-open interval period math with injectable `now` for deterministic tests
    - Structured formatter return (glyph + text + direction + aria) for atomic span coloring
key-files:
  created:
    - src/lib/period.ts
    - src/lib/kpi-schema.ts
    - src/tests/period.test.ts
    - src/tests/format-delta.test.ts
    - src/tests/kpi-schema.test.ts
  modified:
    - src/lib/format.ts (appended formatDelta + DeltaDirection + DeltaType + FormattedDelta + NO_BASELINE; pre-existing exports untouched)
decisions:
  - Assumption A2 resolved in code — `delta === 0` treated as no-baseline (direction 'none', glyph '—'), documented in formatDelta doc comment.
  - `percentage-points` literal chosen for DeltaType (NOT `absolute-pp` from early RESEARCH draft) — locks UI-SPEC copy contract.
  - Month-end rollover in `addMonths` relies on native Date setMonth semantics (Jan 31 − 6mo → Jul 31) — acceptable per Assumption A1, documented in addMonths doc comment.
  - Zod v4 `numericLike` uses `.refine(Number.isFinite)` after `.transform(Number)` to reject `"bogus"` / `"null"` without building a custom refinement ctx — simpler than the v3 `ctx.addIssue` pattern the plan sketched.
metrics:
  duration: ~6 minutes
  completed: 2026-04-22
  tasks: 3
  tests_added: 41
---

# Phase 4 Plan 02: Wave 0 Library Modules Summary

Landed three pure-function modules with complete Wave 0 test coverage — period-bounds math, delta formatter, and the Zod schema for the `kpi_summary` RPC payload. Plan 04-03 can now import every contract without touching the database or a mock.

## Tasks Completed

| # | Task                                              | Commit   | Files                                                         |
| - | ------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 1 | `src/lib/period.ts` + tests                       | 43da41e  | `src/lib/period.ts`, `src/tests/period.test.ts`               |
| 2 | Extend `src/lib/format.ts` with `formatDelta` + tests | 3fde775  | `src/lib/format.ts` (appended), `src/tests/format-delta.test.ts` |
| 3 | `src/lib/kpi-schema.ts` + tests                   | 989b905  | `src/lib/kpi-schema.ts`, `src/tests/kpi-schema.test.ts`       |

## Test Counts (as required by `<output>` block)

- `src/tests/period.test.ts` — **14 cases** (YTD/L6M/L12M × current/previous bounds, default-now shape, Period type narrowing, toIsoDateLocal zero-pad / December / UTC-drift regression)
- `src/tests/format-delta.test.ts` — **15 cases** (relative positive/negative/flat-zero/previous-zero/rounding, percentage-points positive/negative/flat/previous-zero, no-baseline null/undefined on both sides, aria string locking)
- `src/tests/kpi-schema.test.ts` — **12 cases** (happy path, null sell_through, string-numeric on both currency and count fields, missing fields, null root, non-finite string, `"null"` literal string, boolean rejection, missing previous window, `expectTypeOf` type narrowing × 2)

Existing `src/tests/format.test.ts` (28 cases) — **still passing, no modifications**. Full vitest run: **28 files, 246 tests, all green.**

## Public API (export lines)

### `src/lib/period.ts`
```typescript
export type Period = 'ytd' | 'l6m' | 'l12m';
export interface PeriodBounds { current: { start: Date; end: Date }; previous: { start: Date; end: Date }; }
export function computePeriodBounds(period: Period, now: Date = new Date()): PeriodBounds;
export function toIsoDateLocal(d: Date): string;
```

### `src/lib/format.ts` (appended exports only — existing formatters unchanged)
```typescript
export type DeltaDirection = 'up' | 'down' | 'none';
export type DeltaType = 'relative' | 'percentage-points';
export interface FormattedDelta { glyph: '▲' | '▼' | '—'; text: string; direction: DeltaDirection; aria: string; }
export function formatDelta(current: number | null | undefined, previous: number | null | undefined, type: DeltaType): FormattedDelta;
```

### `src/lib/kpi-schema.ts`
```typescript
export const kpiSummarySchema: z.ZodObject<{ current: windowSchema; previous: windowSchema }>;
export type KpiWindow = z.infer<typeof windowSchema>;
export type KpiSummary = z.infer<typeof kpiSummarySchema>;
```

## DeltaType Literal Verification

`DeltaType = 'relative' | 'percentage-points'` — confirmed via grep. The string `'absolute-pp'` does NOT appear anywhere in `src/lib/format.ts` or its tests. Planning_guidance lock held.

```bash
$ grep -n "absolute-pp" src/lib/format.ts src/tests/format-delta.test.ts
(no matches)
$ grep -n "'percentage-points'" src/lib/format.ts
128:export type DeltaType = 'relative' | 'percentage-points';
```

## UTC Drift Regression Guard

`src/lib/period.ts` body does NOT call `toISOString()`. The only grep hit is a docstring warning future readers off the footgun:

```
71: * Local-TZ `yyyy-mm-dd`. Do NOT substitute `d.toISOString().slice(0, 10)` —
```

Test `'returns yyyy-mm-dd for Jan 31 in local TZ (NOT shifted to UTC Jan 30)'` locks the behavior.

## Deviations from Plan

None — plan executed exactly as written. Two minor implementation notes:

1. **Zod v4 numericLike construction** — the plan's sketch used `.string().transform((s, ctx) => { ctx.addIssue(...); return z.NEVER; })`. In Zod v4 the cleaner equivalent is `.transform(Number).refine(Number.isFinite)` which produces the same rejection behavior for `"bogus"` and `"null"` without a custom issue. Both approaches satisfy the acceptance criteria; the refine variant is 4 lines shorter and reads as intent.

2. **Test file for `formatDelta`** — kept in a separate `src/tests/format-delta.test.ts` (per plan) rather than appending to `src/tests/format.test.ts`. Keeps the Phase 3 regression test file byte-identical and narrows which file the Wave 0 gate depends on.

## Acceptance Criteria Verification

| Success criterion                                           | Result |
| ----------------------------------------------------------- | ------ |
| `src/lib/period.ts` + `src/tests/period.test.ts` land       | ✅     |
| `src/lib/format.ts` extended with `formatDelta` + tests     | ✅     |
| `src/lib/kpi-schema.ts` + `src/tests/kpi-schema.test.ts` land | ✅     |
| `npx vitest --run` exits 0                                  | ✅ (246 passing, 0 failing) |
| `delta === 0` treated as no-baseline                        | ✅ (test `'flat 0% change ... renders as no-baseline em-dash'`) |
| Pre-existing `format.test.ts` still passes unchanged        | ✅ (28/28, no file edits outside the bottom append) |
| `DeltaType` literal is `'percentage-points'` (not `absolute-pp`) | ✅ (grep verified) |
| `toIsoDateLocal` body contains no `toISOString`             | ✅ (only a warning-off docstring mentions it) |
| ESLint on all new/modified files                            | ✅ (no output = clean) |

## Downstream Contract Handoff for Plan 04-03

Plan 04-03 can now:

```typescript
import {
  computePeriodBounds,
  toIsoDateLocal,
  type Period,
  type PeriodBounds,
} from '../lib/period';

import {
  formatDelta,
  type DeltaDirection,
  type DeltaType,
  type FormattedDelta,
} from '../lib/format';

import {
  kpiSummarySchema,
  type KpiSummary,
  type KpiWindow,
} from '../lib/kpi-schema';
```

All three modules are pure — no Supabase client, no React, no DOM — which is what the `useKpiSummary` hook needs for its `queryFn` composition and what `KpiCard` needs for its pre-render formatting pass.

## Self-Check: PASSED

Verified on disk:
- `src/lib/period.ts` — FOUND
- `src/lib/format.ts` — FOUND (modified, 195 lines)
- `src/lib/kpi-schema.ts` — FOUND
- `src/tests/period.test.ts` — FOUND
- `src/tests/format-delta.test.ts` — FOUND
- `src/tests/kpi-schema.test.ts` — FOUND

Commits verified:
- `43da41e` — FOUND (feat(04-02): add period bounds + toIsoDateLocal with tests)
- `3fde775` — FOUND (feat(04-02): extend format.ts with formatDelta + tests)
- `989b905` — FOUND (feat(04-02): add kpi_summary Zod schema + tests)

Vitest final run: 28 files / 246 tests, 0 failures.
