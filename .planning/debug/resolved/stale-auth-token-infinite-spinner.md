---
status: resolved
trigger: "stale-auth-token-infinite-spinner: Stale/expired Supabase auth token in localStorage causes infinite loading spinner on `/` because `useAuthStore.loading` never flips to `false`. User expected redirect to `/login`."
created: 2026-04-24T00:00:00Z
updated: 2026-04-24T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. `initialize()` relied solely on `onAuthStateChange` to flip `loading: false`. Replaced with dual-path bootstrap: explicit `getSession()` call (with expired-session purge via `signOut({ scope: 'local' })`) + existing `onAuthStateChange` subscription, coordinated by an `authEventHandled` flag so real INITIAL_SESSION events still win when Supabase does fire them. All failure branches wrapped in try/catch so `loading` is always flipped to `false`.
test: 4 new RED tests in `src/tests/auth-store.test.ts` covering (a) INITIAL_SESSION never firing, (b) expired stored session is purged, (c) live session hydrates without waiting for events, (d) getSession rejection still settles loading.
expecting: All 9 auth-store tests pass. Full suite 648/648 passes. Lint/types clean for modified files.
next_action: RESOLVED — human verified in browser; stale token clears and redirect to /login occurs within 1s.

## Symptoms

expected: On reopen with a stale/expired Supabase token in localStorage, the app should clear the token and redirect to `/login` within 1 second.
actual: App hangs on the centered blue spinner indefinitely. DevTools Network shows 190 requests / DOMContentLoaded 13s / no failing requests. Console shows no errors. The spinner is rendered by `ProtectedRoute` because `useAuthStore.loading` never flips to `false`.
errors: No console errors. No failed network requests. Just indefinite spinner.
reproduction: Sign in, close tab, wait for token expiry OR manually corrupt `sb-<ref>-auth-token` localStorage entry, reopen app, observe spinner.
started: During manual QA on `feature/phase-1-foundation-auth`. Not observed before because tokens had not previously expired between sessions.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-24T00:05:00Z
  checked: `src/stores/authStore.ts:33-85` (`initialize()`)
  found: `loading: true` is the default initial state (line 29). The ONLY line that flips it to `false` is inside the `onAuthStateChange` callback at line 40 (`set({ session, user, loading: false })`). There is no bootstrap `getSession()` call, no `finally`, and no timeout fallback. If the callback is never invoked or throws before line 40, `loading` stays `true` forever.
  implication: User hypothesis confirmed by static analysis. The spinner rendered by `ProtectedRoute` (`loading===true` at line 13 of ProtectedRoute.tsx) is never dismissed.
- timestamp: 2026-04-24T00:06:00Z
  checked: `src/lib/supabase.ts` (client creation)
  found: `createClient<Database>(supabaseUrl, supabaseAnonKey)` is called with ZERO options — no explicit `auth: { persistSession, autoRefreshToken, storage }` config. Defaults apply: persistSession=true, autoRefreshToken=true, storage=localStorage. So the client DOES read `sb-<ref>-auth-token` from localStorage at first `.auth` access.
  implication: A stale/expired token IS loaded from disk and fed into the auth subsystem. This can delay or corrupt the `INITIAL_SESSION` event. Public Supabase GitHub issues confirm that `getSession()` and `onAuthStateChange` can hang with expired/corrupt tokens (issue supabase/supabase#41968). Also, async awaits inside the `onAuthStateChange` callback are documented as a deadlock hazard (issue supabase/auth-js#762) — our callback does `await supabase.from('profiles')...` inside the listener.
- timestamp: 2026-04-24T00:07:00Z
  checked: `src/main.tsx:22-23` and `src/components/ProtectedRoute.tsx:13-23`
  found: `initialize()` is called at module load (before React mounts). ProtectedRoute reads `loading` from the store and renders a spinner the instant it is `true`. No independent timeout exists at the view layer either.
  implication: There is no fallback anywhere in the app. The only recovery path is for `onAuthStateChange` to fire or for the user to manually clear localStorage.
- timestamp: 2026-04-24T00:08:00Z
  checked: Public Supabase issues (web search)
  found: supabase/supabase#41968 — "onAuthStateChange does not trigger intermittently, and refreshSession/getUser hangs indefinitely". supabase/auth-js#762 — "Supabase operations in onAuthStateChange will cause the next call to supabase anywhere else in the code to not return." supabase/supabase-flutter#630 — "Supabase.initialize() blocks when access token has expired".
  implication: The class of bug is widely documented. Robust fix requires (a) bootstrap `getSession()` call guarded by a try/catch with a `finally` that always clears `loading`, (b) explicit purge of expired sessions with `signOut({ scope: 'local' })`, (c) keep `onAuthStateChange` for subsequent lifecycle events only, (d) move the profile fetch into a separate non-deadlocking code path (await a Promise that resolves in microtask to escape the listener — but since the existing tests already pass with `await` in the callback, keeping the structure is fine; the deadlock risk only matters for real Supabase clients).

## Resolution

root_cause: `useAuthStore.initialize()` never called `supabase.auth.getSession()` at bootstrap. `loading: false` was set exclusively inside the `onAuthStateChange` callback. When Supabase failed to fire `INITIAL_SESSION` promptly (known bug with expired tokens: supabase/supabase#41968) or the callback's `await supabase.from('profiles')...` deadlocked (known bug: supabase/auth-js#762), the spinner in ProtectedRoute never dismissed. No bootstrap `finally` and no timeout guaranteed `loading` would be cleared.
fix: Refactored `initialize()` in `src/stores/authStore.ts`. (1) Extracted the session-application logic into a shared `applySession(session)` helper with a try/catch around the profile fetch so any error still flips `profileLoading: false, profileLoaded: true` — ProtectedRoute can fall through to AccessDenied instead of spinning. (2) Subscribe to `onAuthStateChange` first, but call the handler via `void applySession(session)` without `await` to avoid the supabase/auth-js#762 deadlock. (3) Bootstrap IIFE calls `supabase.auth.getSession()` with full try/catch. If the returned session's `expires_at` is in the past, call `supabase.auth.signOut({ scope: 'local' })` to purge the stale localStorage token, then apply a null session. (4) Coordinate the two paths with an `authEventHandled` flag so real INITIAL_SESSION events (the happy path) remain authoritative and the bootstrap result does not stomp fresher state. All branches guarantee `loading` is flipped to `false`.
verification: 4 new RED-then-GREEN tests in `src/tests/auth-store.test.ts` cover (a) INITIAL_SESSION never fires → loading resolves via getSession, (b) expired stored session is purged via signOut({scope:'local'}) and loading resolves, (c) live session hydrates user+profile at bootstrap without waiting for events, (d) getSession rejection still settles loading=false. All 9 auth-store tests pass. Full suite 648/648 passes. Lint/TypeScript clean for modified files. Human verification (2026-04-24): user reproduced stale-token scenario in browser, confirmed fix resolves infinite spinner and redirects to /login.
files_changed:
  - src/stores/authStore.ts
  - src/tests/auth-store.test.ts
