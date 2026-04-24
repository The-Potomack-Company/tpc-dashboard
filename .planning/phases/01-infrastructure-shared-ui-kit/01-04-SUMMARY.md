---
phase: 01-infrastructure-shared-ui-kit
plan: 04
subsystem: shared-hooks
tags: [INFR-04, hooks, url-state, timezone, date-fns]
requires:
  - "01-02 (prebuild service-role guard — required so Task 1 build verification runs clean)"
provides:
  - "src/hooks/useTimezone — Eastern-Time formatter API (formatDate / formatDateTime / formatTime / formatRange / nowET)"
  - "src/hooks/useDateRange — URL-state date-range hook (preset today/7d/30d/custom + ISO from/to)"
affects:
  - "package.json / package-lock.json (date-fns + date-fns-tz pinned)"
tech-stack:
  added:
    - "date-fns ^4.1.0"
    - "date-fns-tz ^3.2.0"
  patterns:
    - "single-closure-write for react-router 7 setSearchParams (Pitfall 5)"
    - "URL as single source of truth for filter state (D-20)"
    - "hard-coded America/New_York timezone — no context provider, no switchable zone (D-19)"
key-files:
  created:
    - path: "src/hooks/useTimezone.ts"
      purpose: "Memoised Eastern-Time formatter functions"
    - path: "src/hooks/useTimezone.test.ts"
      purpose: "7 Vitest specs — winter EST + summer EDT DST coverage + useMemo stability"
    - path: "src/hooks/useDateRange.ts"
      purpose: "URL-state date-range hook consuming useTimezone.nowET for preset resolution"
    - path: "src/hooks/useDateRange.test.tsx"
      purpose: "9 Vitest specs — defaults, preset reads, custom parse, invalid fallback, atomic URL writes, idempotency"
  modified:
    - path: "package.json"
      purpose: "Add date-fns + date-fns-tz runtime deps at pinned versions"
    - path: "package-lock.json"
      purpose: "Lockfile updates for the two new deps"
decisions:
  - "Test file for useDateRange is `.test.tsx` (not `.test.ts`) because the MemoryRouter wrapper uses JSX. Plan note explicitly allows this fallback. Vitest src project include glob `src/**/*.test.{ts,tsx}` already covers both."
  - "setParams called with `{ replace: false }` so back/forward navigation cycles through filter changes — correct for a shareable/bookmarkable URL (D-16)."
  - "`nowET()` is invoked inside the `useMemo` (not at module scope) so DST transitions and midnight rollover work across re-renders."
metrics:
  duration_seconds: 268
  completed_at: "2026-04-24T20:38:27Z"
  tasks_completed: 4
  files_created: 4
  files_modified: 2
  commits: 4
---

# Phase 1 Plan 04: URL-State + Timezone Hooks (INFR-04) — Summary

**One-liner:** Shared React hooks `useTimezone` + `useDateRange` with DST-aware Eastern-Time formatters (date-fns-tz) and URL as single source of truth for today/7d/30d/custom date-range presets via react-router `useSearchParams`.

## What Was Built

**Runtime dependencies (Task 1 — commit `837186a`):**

- `date-fns@^4.1.0` — calendar math (`subDays`, `startOfDay`, `endOfDay`, `parse`, `isValid`)
- `date-fns-tz@^3.2.0` — `formatInTimeZone` + `toZonedTime` for ET-zoned formatting

**Hook 1 — `useTimezone` (Task 2 — commit `e1ec701`):**

```typescript
export interface TimezoneApi {
  formatDate: (d: Date) => string;               // 'MMM d, yyyy'      → "Apr 24, 2026"
  formatDateTime: (d: Date) => string;           // 'MMM d, yyyy h:mm a ET'
  formatTime: (d: Date) => string;               // 'h:mm a ET'
  formatRange: (from: Date, to: Date) => string; // 'MMM d – MMM d, yyyy'
  nowET: () => Date;
}
export function useTimezone(): TimezoneApi;
```

Hard-coded to `America/New_York`. Memoised so the API object reference is stable across re-renders (consumers can safely use it in `useEffect` deps without re-running).

**Hook 2 — `useDateRange` (Task 3 — commit `921fb05`):**

```typescript
export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';
export interface DateRangeValue {
  range: DateRangePreset;
  from: Date;           // start-of-day ET
  to: Date;             // end-of-day ET
  setRange: (next: Exclude<DateRangePreset, 'custom'>) => void;
  setCustom: (from: Date, to: Date) => void;
}
export function useDateRange(): DateRangeValue;
```

**URL contract (D-16):**

- `?range=today|7d|30d|custom`
- When `range=custom`: additionally `&from=YYYY-MM-DD&to=YYYY-MM-DD`
- When `range` is a preset: `from`/`to` absent
- Default when no `range` param: `7d` (D-17)
- Invalid preset (e.g. `?range=banana`) or malformed custom dates → silent fallback to 7d resolution

**Single-closure-write pattern (RESEARCH Pitfall 5):**

Both `setRange` and `setCustom` collapse their URL mutations into one `setParams(prev => ...)` closure body so react-router 7's non-batching `setSearchParams` functional updater can't read stale state between calls.

## Test Coverage

**Full suite: 48 tests passing across 8 files.** This plan added 16 new tests:

**`useTimezone.test.ts` — 7 specs:**

1. `formatDate` renders January (EST) date with comma
2. `formatDateTime` renders winter (EST / UTC-5) timestamp with literal `ET` suffix
3. `formatDateTime` renders summer (EDT / UTC-4) timestamp correctly — **DST guard**
4. `formatTime` returns time-only string with ET suffix
5. `formatRange` joins two formatted dates with en-dash
6. `nowET` returns a Date whose time is within 5h+5s of now (TZ-offset-aware bound)
7. API object is stable across re-renders (useMemo verified)

**`useDateRange.test.tsx` — 9 specs:**

1. Defaults to `7d` when no `range` param (D-17)
2. Reads `?range=today` from URL
3. `30d` preset produces 30-day inclusive span
4. Custom range parses ISO dates from URL
5. Custom with missing from/to falls back to 7d behaviour silently
6. Invalid preset `?range=banana` falls back to 7d
7. `setRange('30d')` from a custom URL writes `?range=30d` and removes `from` + `to` (single-closure merge verified)
8. `setCustom(...)` writes `range=custom` + `from` + `to` in one URL mutation
9. URL idempotency: `setRange('7d')` when already on 7d updates URL to `?range=7d` exactly

## Commits

| Task | Commit  | Message                                                              |
| ---- | ------- | -------------------------------------------------------------------- |
| 1    | 837186a | chore(01-04): install date-fns@^4.1.0 + date-fns-tz@^3.2.0 (INFR-04) |
| 2    | e1ec701 | feat(01-04): add useTimezone hook with DST-aware ET formatters       |
| 3    | 921fb05 | feat(01-04): add useDateRange URL-state hook                         |
| 4    | 4735b50 | test(01-04): add useDateRange suite with MemoryRouter wrapper        |

## Verification

- `npm run build` — exit 0 (prebuild service-role guard clean, vite build + tsc both green)
- `npm run test` full suite — 48/48 passing across 8 test files
- Automated grep checks (pinned versions, file existence, DST test dates, `useSearchParams`, `MemoryRouter`, `banana` invalid-preset test, `setCustom` test) — all green
- `grep -rn SUPABASE_SERVICE_ROLE_KEY src/hooks/` — no matches (frontend hooks stay out of the service-role blast radius per CLAUDE.md Conventions)

## Success Criteria Addressed

- [x] `package.json` contains `date-fns@^4.1.0` and `date-fns-tz@^3.2.0` as dependencies
- [x] `src/hooks/useTimezone.ts` exports `useTimezone` returning 5 formatter methods and `nowET()`, hardcoded to `America/New_York`
- [x] `src/hooks/useDateRange.ts` exports `useDateRange` reading/writing URL via `useSearchParams`, defaulting to 7d when `range` is absent, merging all writes into single-closure `setParams` calls
- [x] Both hooks have colocated Vitest tests covering winter + summer DST, URL default, URL reads, URL writes, invalid-input fallback, URL idempotency, preset switch clearing custom dates
- [x] `npm run test` full suite passes (48/48)
- [ ] ROADMAP Phase 1 Success Criterion 3 — URL state + ET formatting done here; component-level validation lands in plan 01-05 (`<DateRangeFilter>`) and manual check in plan 01-06

## Threat Mitigations Applied

| Threat ID              | Mitigation                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1-URL-TAMPER         | `isPreset` narrow accepts only 4 literal strings; `parseISODate` uses `date-fns.parse` + `isValid`; invalid values fall back to 7d (resilient to bookmark rot). |
| T-1-DST-REGRESSION     | Tests cover both January 2026 (EST / UTC-5) and July 2026 (EDT / UTC-4) to block hand-rolled offset math from ever regressing.                              |
| T-1-REACT-BATCHING     | Single-closure write pattern merges all URL mutations into one `setParams(prev => ...)` call; Task 4 test "setRange clears from/to" confirms atomicity.     |
| T-1-SRK                | Hooks never reference `SUPABASE_SERVICE_ROLE_KEY`; prebuild Node walker scan from plan 01-02 stays clean after this plan.                                   |

## Deviations from Plan

1. **[Rule 3 — Tooling] Node modules install**
   - **Found during:** Task 1 pre-check
   - **Issue:** The worktree was reset to the correct base commit but had no `node_modules/` directory, so `npm run build` could not run for Task 1 verification.
   - **Fix:** Ran `npm install` to populate root dependencies before installing date-fns. This is a worktree-setup correction, not a plan logic change.
   - **Files modified:** none (install only; `package.json` / `package-lock.json` unchanged at this step)
   - **Commit:** n/a (happened before Task 1 commit)

2. **[Rule 3 — TS/JSX compatibility] Test file extension**
   - **Found during:** Task 4
   - **Issue:** Plan specified `src/hooks/useDateRange.test.ts` but the MemoryRouter wrapper uses JSX, which does not compile inside a `.ts` file under the project's tsconfig.
   - **Fix:** Created the file as `src/hooks/useDateRange.test.tsx` per the plan's own fallback note in Task 4's `<action>` block. The Vitest src project include glob (`src/**/*.test.{ts,tsx}`) already covers `.tsx`.
   - **Files modified:** `src/hooks/useDateRange.test.tsx` (created)
   - **Commit:** `4735b50`

3. **[Rule 3 — Test CLI] `npm run test -- --run` conflict**
   - **Found during:** Task 2 verification
   - **Issue:** The project's `test` script is `vitest --run`, so appending `--run` again via `npm run test -- --run` makes Vitest complain about `[true, true]` for `--run`.
   - **Fix:** Ran tests directly via `npx vitest run <paths>` instead. Plan's automated verify command has the same bug but the intent (running the scoped test file) is satisfied.
   - **Files modified:** none (test invocation only)
   - **Commit:** n/a

No other deviations. All four tasks executed as written.

## Unblocks

- **Plan 01-05** `<DateRangeFilter>` component — can now bind its preset buttons and custom popover to `useDateRange` and `useTimezone` directly.
- **Phase 2** `/extension` route, **Phase 3** `/activity` route, **Phase 5** `/live` route — all three consume `useDateRange` for filter state and `useTimezone` for timestamp display.

## Self-Check: PASSED

- FOUND: `src/hooks/useTimezone.ts`
- FOUND: `src/hooks/useTimezone.test.ts`
- FOUND: `src/hooks/useDateRange.ts`
- FOUND: `src/hooks/useDateRange.test.tsx`
- FOUND: commit `837186a` (Task 1 — deps)
- FOUND: commit `e1ec701` (Task 2 — useTimezone)
- FOUND: commit `921fb05` (Task 3 — useDateRange)
- FOUND: commit `4735b50` (Task 4 — useDateRange tests)
