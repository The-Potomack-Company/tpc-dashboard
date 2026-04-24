---
phase: 01-foundation-auth
fixed_at: 2026-04-21T00:00:00Z
review_path: .planning/phases/01-foundation-auth/01-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-04-21T00:00:00Z
**Source review:** .planning/phases/01-foundation-auth/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (0 Critical + 4 Warning; Info deferred per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

All in-scope findings landed cleanly. Test suite grew from 22 to 23 passing tests (added regression test for the "authenticated with no profile row" path). `npm run build` (tsc -b + vite build) runs clean with the expanded type-check scope.

## Fixed Issues

### WR-01: `ProtectedRoute` can hang forever when user has no profile row

**Files modified:** `src/stores/authStore.ts`, `src/components/ProtectedRoute.tsx`, `src/tests/auth-store.test.ts`, `src/tests/protected-route.test.tsx`
**Commit:** `edda737`
**Applied fix:** Added a `profileLoaded: boolean` flag to `AuthState` that flips `true` only after the first fetch attempt resolves (success *or* failure). Switched the Supabase query from `.single()` to `.maybeSingle()` so a missing `profiles` row returns `{ data: null }` instead of erroring. Changed `ProtectedRoute`'s stage-3 guard from `profileLoading || profile === null` to `profileLoading || !profileLoaded`, so a resolved-but-null profile now falls through to Stage 4 and renders `AccessDenied` (which already handles the null-profile case via `user?.email ?? 'unknown'`). Updated both test files to seed `profileLoaded: true/false` in `beforeEach` and per-test state, updated the `supabase.from` mock chain to expose `maybeSingle` instead of `single`, and added a new regression test (`'shows AccessDenied when authenticated with no profile row (profileLoaded but null)'`) to lock the fix in place.

### WR-02: Profile fetch swallows errors silently

**Files modified:** `src/stores/authStore.ts`
**Commit:** `f704bf0`
**Applied fix:** Destructured `error` alongside `data` from the `profiles` query and logged it via `console.error('[authStore] profile fetch failed', error)` when non-null. Added a one-line ESLint suppression for the project's default `no-console` convention and a comment explaining that the log is the seam where a future `profileError` field / observability pipeline can hook in. No behavioral change to the authenticated admin path; only adds visibility for failures.

### WR-03: `onAuthStateChange` callback has an unawaited async race

**Files modified:** `src/stores/authStore.ts`
**Commit:** `1cb3de8`
**Applied fix:** Added `get` to the Zustand `create` callback signature (previously only `set` was destructured). Captured the user id at dispatch time as `const fetchingFor = session.user.id`, used it in the `.eq(...)` query, and after the await added `if (get().user?.id !== fetchingFor) return;` to discard stale responses when a newer auth event has already changed the user. Chose the "getState check" approach over AbortController / monotonic generation counter per the reviewer's primary suggestion — minimal surface area, no new state field, works with Supabase's non-awaited callback model.

### WR-04: `src/tests/` excluded from `tsc -b`

**Files modified:** `tsconfig.app.json`
**Commit:** `4d3c14d`
**Applied fix:** Removed `"exclude": ["src/tests"]` from `tsconfig.app.json`, which brings the test files into the `tsc -b` scope so `npm run build` now type-checks them alongside app code (option (a) from the review). Confirmed: `npm run build` still succeeds (vite does not bundle test files since they aren't imported by app entry points), and `npx vitest --run` still passes all 23 tests. No `tsconfig.test.json` needed — the existing app config's `lib` + `types` are sufficient for the current test files (jest-dom matchers come via the `src/tests/setup.ts` side-effect import).

---

_Fixed: 2026-04-21T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
