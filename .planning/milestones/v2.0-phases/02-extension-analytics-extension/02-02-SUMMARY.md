---
phase: 02-extension-analytics-extension
plan: 02
subsystem: extension-analytics
tags: [foundation, url-state, formatters, dev-gate, tdd]
requires:
  - "react-router useSearchParams (already in repo from Phase 1 / useDateRange)"
  - "date-fns-tz (already in repo from Phase 1 / useTimezone)"
provides:
  - "src/hooks/extension/useUserFilter.ts — `?users=` URL-state filter (EXT-07)"
  - "src/hooks/extension/useVersionFilter.ts — `?versions=` URL-state filter (EXT-09)"
  - "src/lib/devAccess.ts — `isDevAccount(email)` allowlist gate + `DEV_EMAILS` constant (D-16)"
  - "src/lib/format.ts — `formatPercent`, `formatCount`, `formatTimestampShort`, `EMPTY` (UI-SPEC § Typography)"
affects:
  - "Plan 02-03 (services/hooks): folds `users[]` + `versions[]` into queryKeys; sorts before keying (RESEARCH Pitfall 3)"
  - "Plan 02-05 / 02-06 (tables + LiveFeed): import `formatTimestampShort` for timestamp columns; gate row-click payload viewer on `isDevAccount`"
  - "Plan 02-07 (DeveloperPanel): gates render on `isDevAccount(profile.email)`; consumes `useVersionFilter`"
tech_stack:
  added: []
  patterns:
    - "URL-state filter hook (single-closure setParams write, mirrors useDateRange Pitfall 5)"
    - "Empty-array sentinel for 'no filter' — clearing removes the URL param entirely"
    - "Email allowlist as render gate, lowercased on both sides (RFC 5321)"
key_files:
  created:
    - "src/hooks/extension/useUserFilter.ts"
    - "src/hooks/extension/useUserFilter.test.tsx"
    - "src/hooks/extension/useVersionFilter.ts"
    - "src/hooks/extension/useVersionFilter.test.tsx"
    - "src/lib/devAccess.ts"
    - "src/lib/devAccess.test.ts"
    - "src/lib/format.ts"
    - "src/lib/format.test.ts"
    - ".planning/phases/02-extension-analytics-extension/deferred-items.md"
  modified: []
decisions:
  - "Followed PATTERNS.md / RESEARCH.md canonical excerpts verbatim — no deviations"
  - "Added one extra `formatTimestampShort` test (EST in January, alongside the spec'd EDT-in-April test) per the action block's verbatim test file content; total format.ts tests = 9 (vs. behavior block's 8-test count)"
metrics:
  completed: "2026-04-30"
  duration_minutes: 5
  task_count: 2
  file_count: 8
requirements: [EXT-07, EXT-09]
---

# Phase 02 Plan 02: Foundation Modules Summary

**One-liner:** Four foundation modules — two URL-state filter hooks (`useUserFilter`, `useVersionFilter`), the dev-account allowlist (`devAccess.ts`), and a shared formatter library (`format.ts` with `formatTimestampShort`) — shipped via TDD with 27 colocated Vitest tests, all green, no Supabase, no new dependencies.

## What Shipped

### Source modules (4)

| File | Exports | Purpose |
|------|---------|---------|
| `src/hooks/extension/useUserFilter.ts` | `useUserFilter`, `UserFilterValue` | URL-driven `?users=` filter; returns `{ users: string[], setUsers(next): void }` |
| `src/hooks/extension/useVersionFilter.ts` | `useVersionFilter`, `VersionFilterValue` | URL-driven `?versions=` filter; identical contract |
| `src/lib/devAccess.ts` | `isDevAccount`, `DEV_EMAILS` | Email allowlist gate; case-insensitive match per RFC 5321 |
| `src/lib/format.ts` | `formatPercent`, `formatCount`, `formatTimestampShort`, `EMPTY` | Pure formatters; `formatTimestampShort` outputs `MM/dd HH:mm` in `America/New_York` |

### Test modules (4)

| Test file | Test count | Coverage |
|-----------|-----------|----------|
| `useUserFilter.test.tsx` | 7 | empty/parse/set/clear/sibling-preserve/empty-value-guard/round-trip |
| `useVersionFilter.test.tsx` | 6 | empty/parse/set/clear/sibling-preserve/empty-value-guard |
| `devAccess.test.ts` | 5 | allowlist match / case-insensitive / non-allowlist / nullish / DEV_EMAILS shape |
| `format.test.ts` | 9 | formatPercent (3) + formatCount (2) + formatTimestampShort (3) + EMPTY (1) |
| **Total new tests** | **27** | All green; project total grew from 81 → 108, no regressions |

## Pattern Conformance

The two URL-state hooks follow `src/hooks/useDateRange.ts` (Phase 1 / INFR-04) verbatim:

- `useSearchParams` import block (line 2 in `useDateRange.ts` lines 1-4)
- Single-closure `setParams((prev) => { const copy = new URLSearchParams(prev); ... return copy; }, { replace: false })` body (`useDateRange.ts` lines 71-103)
- `'?users='` empty-value guard mirrors `useDateRange.ts`'s defensive parsing of `?from=` / `?to=`
- Test wrapper conventions (`makeWrapper`, `useHookWithLocation`) lifted from `useDateRange.test.tsx` lines 9-27

`devAccess.ts` is a verbatim copy of the canonical excerpt in RESEARCH.md lines 875-889 (cited in PATTERNS.md lines 326-340). No deviations.

`format.ts` reuses `formatInTimeZone` from `date-fns-tz` and the `'America/New_York'` constant pattern established in `useTimezone.ts`. `formatTimestampShort` adds the new `MM/dd HH:mm` short form for table cells (UI-SPEC § Typography).

## Verification

| Step | Command | Result |
|------|---------|--------|
| All four new test files | `npx vitest --run src/hooks/extension/useUserFilter.test.tsx src/hooks/extension/useVersionFilter.test.tsx src/lib/devAccess.test.ts src/lib/format.test.ts` | **27 passed** |
| Full project test suite | `npm run test` | **108 passed** (16 files) |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Lint, scoped to new files | `npx eslint src/hooks/extension/ src/lib/devAccess.ts src/lib/devAccess.test.ts src/lib/format.ts src/lib/format.test.ts` | clean |
| Lint, full project | `npm run lint` | 1 pre-existing error in `DateRangeFilter.tsx` (Phase 1, NOT plan 02-02 scope — see Deferred Issues) |

## Commits

| Order | Hash | Type | Summary |
|-------|------|------|---------|
| 1 | `989e742` | test | RED — failing tests for `useUserFilter` and `useVersionFilter` (13 tests) |
| 2 | `56f6c1b` | feat | GREEN — implement both URL-state filter hooks |
| 3 | `21b5b05` | test | RED — failing tests for `devAccess` and `format` (14 tests) |
| 4 | `47bdf29` | feat | GREEN — implement `devAccess` allowlist + `format` library |

TDD gate compliance: every implementation commit (`feat`) is preceded by a failing-test commit (`test`). RED commits were verified to fail (module-not-found errors) before GREEN was written.

## TDD Gate Compliance

This plan executed two independent TDD cycles, one per task. Both followed RED → GREEN strictly:

- Task 1 RED: `989e742` (tests fail; modules absent)
- Task 1 GREEN: `56f6c1b` (tests pass with minimal implementation)
- Task 2 RED: `21b5b05` (tests fail; modules absent)
- Task 2 GREEN: `47bdf29` (tests pass with minimal implementation)

No REFACTOR commits — implementations are direct copies of the canonical PATTERNS.md / RESEARCH.md excerpts; no cleanup needed.

## Deviations from Plan

None. The plan listed expected behaviors and a verbatim action block; the action block prevailed where the behavior block undercounted (the action block prescribes 3 `it()` blocks for `formatTimestampShort` — EDT in April, EST in January, Date/string equivalence — totaling 9 format tests, where the behavior block's count of 8 tests omitted the explicit second DST case). Following the action block verbatim was the correct call: it ensures both DST and standard-time behavior are pinned by tests.

## Deferred Issues

`src/components/kit/DateRangeFilter.tsx:37` reports a `react-hooks/set-state-in-effect` ESLint error. The file is unchanged by Plan 02-02 — the error is pre-existing from Phase 1. Logged to `.planning/phases/02-extension-analytics-extension/deferred-items.md` per the scope-boundary rule (only auto-fix issues directly caused by this plan's changes). Two unrelated `authStore.ts` warnings (unused eslint-disable directives) logged in the same file.

## Threat Model Compliance

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-07 (URL value tampering) | accept (per plan) | Filter values flow through `useSearchParams` parsing; never echoed into HTML; downstream consumers (Plan 02-03) feed them into parameterized `.eq`/`.in`/`.rpc` calls |
| T-02-08 (allowlist case-mismatch) | mitigate | `email.toLowerCase()` on input + `'josh@potomackco.com'` (lowercase) in `DEV_EMAILS`; covered by `devAccess.test.ts` "is case-insensitive (RFC 5321)" |
| T-02-09 (allowlist in bundle) | accept (per plan + D-16) | Single email in `DEV_EMAILS`; emails are not secrets per RFC 5321 |
| T-02-10 (URL parsing DoS) | accept (per plan) | `''.split(',').filter(...)` is O(n); empty-value guard tested ("handles ?users= (empty value) by returning []") |

## Stub Tracking

No stubs introduced. All four modules are self-contained pure functions or hooks with concrete implementations.

## Threat Flags

None. The four modules introduce no new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

Files created (verified via `[ -f path ]`):
- FOUND: src/hooks/extension/useUserFilter.ts
- FOUND: src/hooks/extension/useUserFilter.test.tsx
- FOUND: src/hooks/extension/useVersionFilter.ts
- FOUND: src/hooks/extension/useVersionFilter.test.tsx
- FOUND: src/lib/devAccess.ts
- FOUND: src/lib/devAccess.test.ts
- FOUND: src/lib/format.ts
- FOUND: src/lib/format.test.ts
- FOUND: .planning/phases/02-extension-analytics-extension/deferred-items.md

Commits (verified via `git log --oneline | grep`):
- FOUND: 989e742
- FOUND: 56f6c1b
- FOUND: 21b5b05
- FOUND: 47bdf29
