# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## stale-auth-token-infinite-spinner — Stale/expired Supabase auth token caused infinite loading spinner
- **Date:** 2026-04-24
- **Error patterns:** infinite spinner, loading spinner, useAuthStore, loading never false, onAuthStateChange, INITIAL_SESSION, expired token, stale token, localStorage, supabase auth, ProtectedRoute, getSession hang, auth initialize, sb-auth-token
- **Root cause:** `useAuthStore.initialize()` never called `supabase.auth.getSession()` at bootstrap; `loading: false` was set only inside the `onAuthStateChange` callback. When Supabase failed to fire `INITIAL_SESSION` promptly (supabase/supabase#41968) or the listener's `await supabase.from(...)` deadlocked (supabase/auth-js#762), the spinner in `ProtectedRoute` never dismissed. No bootstrap `finally` or timeout guaranteed `loading` would clear.
- **Fix:** Refactored `initialize()` with dual-path bootstrap: (1) extracted `applySession(session)` helper with try/catch around profile fetch so errors still settle `profileLoading/profileLoaded`; (2) `onAuthStateChange` listener invokes `void applySession(session)` without `await` to avoid the auth-js#762 deadlock; (3) bootstrap IIFE calls `supabase.auth.getSession()` inside try/catch, purges expired sessions via `supabase.auth.signOut({ scope: 'local' })` when `expires_at` is in the past, then applies a null session; (4) `authEventHandled` flag coordinates paths so real INITIAL_SESSION events remain authoritative. All branches guarantee `loading` flips to `false`.
- **Files changed:** src/stores/authStore.ts, src/tests/auth-store.test.ts
---

