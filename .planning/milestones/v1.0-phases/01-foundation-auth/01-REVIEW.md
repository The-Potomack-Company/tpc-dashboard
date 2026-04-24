---
phase: 01-foundation-auth
reviewed: 2026-04-21T00:00:00Z
depth: standard
iteration: 2
files_reviewed: 16
files_reviewed_list:
  - src/lib/supabase.ts
  - src/stores/authStore.ts
  - src/main.tsx
  - src/App.tsx
  - src/pages/Login.tsx
  - src/pages/Dashboard.tsx
  - src/components/ProtectedRoute.tsx
  - src/components/AccessDenied.tsx
  - src/layouts/DashboardLayout.tsx
  - src/tests/setup.ts
  - src/tests/supabase-client.test.ts
  - src/tests/auth-store.test.ts
  - src/tests/schema-shape.test.ts
  - src/tests/login-page.test.tsx
  - src/tests/protected-route.test.tsx
  - tsconfig.app.json
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 1: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** clean

## Summary

Re-review of the four iteration-1 Warning findings (WR-01 through WR-04) after the fix pass. All fixes hold and no new issues were introduced. `npx tsc -b` runs silent and `npx vitest --run` reports 23/23 tests passing across 5 test files.

### WR-01: `profileLoaded` guard — VERIFIED

- `src/stores/authStore.ts:18` adds `profileLoaded: boolean` to `AuthState`.
- `src/stores/authStore.ts:31` initializes it to `false`.
- `src/stores/authStore.ts:50` flips it to `false` at the start of each fetch (correct — re-entry must re-gate).
- `src/stores/authStore.ts:72,79` flips it to `true` on both the success branch and the signed-out branch.
- `src/stores/authStore.ts:57` switched the query from `.single()` to `.maybeSingle()`, so a missing profile row no longer errors out; it resolves with `{ data: null, error: null }`.
- `src/components/ProtectedRoute.tsx:33` now gates the profile-loading spinner on `profileLoading || !profileLoaded` instead of `profile === null`, so a resolved-but-null profile correctly falls through to Stage 4 → `AccessDenied`.
- `src/tests/protected-route.test.tsx:130-146` adds a regression test (`'shows AccessDenied when authenticated with no profile row (profileLoaded but null)'`) that locks in the fix.

### WR-02: Error logging — VERIFIED

- `src/stores/authStore.ts:53` now destructures `{ data, error }` (was `{ data }`).
- `src/stores/authStore.ts:61-67` logs the error via `console.error('[authStore] profile fetch failed', error)` when non-null, with a scoped `eslint-disable-next-line no-console` and an inline comment explaining the observability seam.
- Log emits are non-blocking — the `set(...)` call after still runs, so a failed fetch cleanly lands on `profile: null, profileLoaded: true` and the user reaches `AccessDenied` instead of spinning.

### WR-03: Stale profile-fetch guard — VERIFIED

- `src/stores/authStore.ts:24` now destructures both `set` and `get` from the Zustand create callback.
- `src/stores/authStore.ts:49` captures `const fetchingFor = session.user.id` at dispatch time.
- `src/stores/authStore.ts:56` uses `fetchingFor` in the `.eq(...)` predicate (so the query itself matches the captured id, not a later mutated session).
- `src/stores/authStore.ts:60` discards the response if `get().user?.id !== fetchingFor` — short-circuits before any `set`, so an older callback cannot stomp newer state.

Side-check: there is a narrow scenario where an older-event callback sets `profileLoading: true, profileLoaded: false` at line 50, then bails at line 60 without resetting those flags. In every realistic flow the newer event runs the same code path and lands on `profileLoaded: true` (user change) or hits the `else` branch (SIGNED_OUT) which explicitly resets them. Not a real bug, so not flagged.

### WR-04: `src/tests` in `tsc -b` scope — VERIFIED

- `tsconfig.app.json:27` now has `"include": ["src"]` with no `exclude` — tests are type-checked by `tsc -b`.
- `npx tsc -b` runs silent (no output = no errors).
- `npx vitest --run` reports 23 tests passed across 5 files, confirming tests still compile under the app's strict TS settings with jest-dom matchers pulled in via the `src/tests/setup.ts` side-effect import.

## Regression Scan

Re-scanned every file in scope for new issues introduced by the fixes:

- `authStore.ts`: `get` is a valid Zustand API (type-safe, captured via closure, returns live state at call time). No hidden closure / stale-state hazards beyond the one noted above.
- `ProtectedRoute.tsx`: The new `profileLoaded` selector is a plain primitive subscription — no ref-equality or render-loop risks.
- Test files: `auth-store.test.ts` and `protected-route.test.tsx` both seed `profileLoaded` in `beforeEach`; the per-test state overrides in `protected-route.test.tsx:105,120,138,156` are consistent. `login-page.test.tsx` omits `profileLoaded` from its `beforeEach` but `LoginPage` never reads that field, so this is harmless and not worth a finding.
- `tsconfig.app.json`: dropping the test exclude does not pull test files into the Vite bundle (Vite traverses from entry points, not tsconfig `include`).

No critical, warning, or info findings. Phase 1 is ready to merge.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
