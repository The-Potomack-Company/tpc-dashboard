---
phase: 01-foundation-auth
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 35
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
  - src/db/database.types.ts
  - src/tests/setup.ts
  - src/tests/supabase-client.test.ts
  - src/tests/auth-store.test.ts
  - src/tests/schema-shape.test.ts
  - src/tests/login-page.test.tsx
  - src/tests/protected-route.test.tsx
  - supabase/migrations/20260421000000_create_updated_at_trigger.sql
  - supabase/migrations/20260421000001_create_departments.sql
  - supabase/migrations/20260421000002_create_sales.sql
  - supabase/migrations/20260421000003_create_sale_departments.sql
  - supabase/migrations/20260421000004_create_scraper_runs.sql
  - supabase/migrations/20260421000005_create_saved_reports.sql
  - supabase/migrations/20260421000006_rls_helper_functions.sql
  - supabase/migrations/20260421000007_rls_policies.sql
  - supabase/migrations/20260421000008_seed_departments.sql
  - vite.config.ts
  - eslint.config.js
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - package.json
  - index.html
  - src/index.css
  - .env.example
  - .gitignore
  - README.md
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Phase 1 delivers a clean, well-scoped greenfield React + Supabase foundation. Version pins match TPC App exactly per CLAUDE.md. The Proxy-wrapped Supabase client, Zustand auth store, five-stage `ProtectedRoute`, and RLS helper function all follow defensible, reviewed patterns. Migrations are idempotent-friendly, use `security definer` with locked search_path, and correctly rely on the default-deny behavior of RLS (no write policies = service-role-only writes) for the dashboard-owned tables.

No critical security issues. However, there are two correctness gaps that will surface the first time a real user hits an unexpected edge case:

1. A user with a valid Supabase session but **no `profiles` row** (or one where the row fetch fails) gets stuck on an infinite "Checking your session" spinner because `ProtectedRoute` treats `profile === null` as "still loading."
2. The profile fetch in `authStore.initialize` swallows its `error` field entirely — no logging, no user feedback, no retry. Combined with #1, a transient network error during profile fetch silently locks the user out of the dashboard with no escape.

Both are fixable in a few lines. Also flagged: a handful of smaller code-quality items (menu missing click-outside, `tsc -b` not type-checking `src/tests`, README inconsistencies).

## Warnings

### WR-01: `ProtectedRoute` can hang forever when user has no profile row

**File:** `src/components/ProtectedRoute.tsx:31`
**Issue:** The guard is `if (profileLoading || profile === null)`. When a user authenticates successfully but has no row in `public.profiles` (e.g., an auth account created directly in the Supabase dashboard, or after a race with TPC App's profile-create trigger), the `authStore` initialize handler runs `single()`, gets `{ data: null, error: <PGRST116 or similar> }`, and sets `profile: null, profileLoading: false`. `ProtectedRoute` then renders the profile-loading spinner *forever* because `profile === null` is still true. Same effect if the query errors out (network failure, RLS rejection): `data` is undefined, `data ?? null` becomes null, and the user is permanently stuck on a spinner with no way out (not even a Sign Out button, since `AccessDenied` never renders).

**Fix:** Track profile-load completion separately from presence, or invert the check to use `profileLoading` alone once the fetch has started. Minimal patch:

```typescript
// authStore.ts — add a flag for "we tried to load and finished (success or failure)"
interface AuthState {
  // ...
  profileLoaded: boolean;  // true after first fetch attempt resolves, regardless of outcome
}

// in the onAuthStateChange handler:
if (session?.user) {
  set({ profileLoading: true, profileLoaded: false });
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();  // <- use maybeSingle so "no row" is not an error
  set({
    profile: data ?? null,
    isAdmin: data?.role === 'admin',
    profileLoading: false,
    profileLoaded: true,
  });
} else {
  set({ profile: null, isAdmin: false, profileLoading: false, profileLoaded: true });
}
```

```tsx
// ProtectedRoute.tsx — show spinner only while actively fetching; treat "loaded with null profile" as not-admin
if (profileLoading || !profileLoaded) { /* spinner */ }
if (!isAdmin) { return <AccessDenied />; }  // AccessDenied handles the no-profile case too
```

Also consider making `AccessDenied` gracefully handle the null-profile case (the existing `user?.email ?? 'unknown'` already covers it).

---

### WR-02: Profile fetch swallows errors silently

**File:** `src/stores/authStore.ts:40-44`
**Issue:** The call destructures only `{ data }` and discards `error`. Any failure — RLS rejection, transient network error, Supabase outage, CORS — results in `data = undefined`, `profile` set to `null`, no log, no surfaced UI state. Combined with WR-01 this means a flaky network silently locks the user out of the dashboard with no indication why. Even after WR-01 is fixed (user lands on `AccessDenied`), the actual cause (network error vs. genuinely non-admin) is invisible to both the user and any future observability pipeline.

**Fix:** Capture the error and expose it on the store (or at least log it):

```typescript
set({ profileLoading: true });
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .maybeSingle();
if (error) {
  console.error('[authStore] profile fetch failed', error);
  // Optionally: set({ profileError: error.message })
}
set({
  profile: data ?? null,
  isAdmin: data?.role === 'admin',
  profileLoading: false,
});
```

Future phases can add a `profileError` field and surface it in `AccessDenied` or a dedicated error boundary.

---

### WR-03: `onAuthStateChange` callback has an unawaited async race

**File:** `src/stores/authStore.ts:31-53`
**Issue:** The callback is `async (_event, session) => { ... }` but Supabase does not await callbacks. If two auth events fire in quick succession (e.g., `INITIAL_SESSION` immediately followed by a token refresh, or a logout shortly after login), two profile fetches can be in flight simultaneously. The second `await supabase.from('profiles')...single()` may resolve before the first, stomping newer state with older data. In practice, Phase 1's flows rarely trigger this, but it's a latent bug that will become visible once token auto-refresh runs in long-lived sessions.

**Fix:** Guard against stale resolutions by capturing the user id at call time and bailing if the current session has changed:

```typescript
if (session?.user) {
  const fetchingFor = session.user.id;
  set({ profileLoading: true });
  const { data } = await supabase.from('profiles').select('*').eq('id', fetchingFor).maybeSingle();
  // If a newer event has already changed the user, discard this response.
  if (useAuthStore.getState().user?.id !== fetchingFor) return;
  set({ profile: data ?? null, isAdmin: data?.role === 'admin', profileLoading: false });
}
```

Alternative: use an AbortController or a monotonically-increasing "generation" counter.

---

### WR-04: `src/tests/` excluded from `tsc -b`

**File:** `tsconfig.app.json:28`
**Issue:** `"exclude": ["src/tests"]` means `npm run build` (which runs `tsc -b && vite build`) never type-checks the test files. Type errors in tests — mismatched mock shapes, out-of-date `Database` row types, etc. — will silently pass `npm run build` and only surface when `npm test` is run. Since tests pin the app's typed API surface (especially `schema-shape.test.ts`), this defeats a lot of the value of having strict TS in the first place.

**Fix:** Either (a) include `src/tests` in `tsconfig.app.json` (Vite/Vitest don't care if test files are type-checked during the app build; Vite just won't bundle them), or (b) add a `tsconfig.test.json` referenced from the root `tsconfig.json` so `tsc -b` covers tests without pulling them into the app build. Option (a) is a one-line change:

```jsonc
// tsconfig.app.json
"include": ["src"],
// remove the exclude, or change it to just "src/tests/setup.ts" if needed
```

If there's a specific reason for the exclusion (e.g., jest-dom globals leaking), prefer option (b).

## Info

### IN-01: Account-menu dropdown has no click-outside or Escape-to-close handler

**File:** `src/layouts/DashboardLayout.tsx:62-88`
**Issue:** Once opened, the menu only closes when the Sign Out button is clicked (via `handleSignOut`) or the toggle button is clicked again. Clicking anywhere else on the page leaves it open, which is surprising UX and a mild accessibility concern (ARIA menus are expected to close on Escape or outside click).

**Fix:** Add a `useEffect` that binds `pointerdown`/`keydown` listeners while `menuOpen` is true:

```tsx
useEffect(() => {
  if (!menuOpen) return;
  const handler = (e: PointerEvent | KeyboardEvent) => {
    if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
    setMenuOpen(false);
  };
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
  return () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
}, [menuOpen]);
```

Caveat: also need to stop-propagation on the toggle button's own click so the listener doesn't close the menu the same tick it opens.

---

### IN-02: `DashboardLayout` initial computation can produce an empty string

**File:** `src/layouts/DashboardLayout.tsx:22-23`
**Issue:** `profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'` — if `email` is something pathological like `''` or `'@example.com'`, `split('@')[0]` returns `''`, which is *not* nullish, so the `?? 'User'` fallback doesn't fire. `initial` then becomes `''` and the avatar circle renders empty. Cosmetic-only in practice (Supabase enforces non-empty emails) but worth a tighter guard:

```tsx
const emailLocal = user?.email?.split('@')[0];
const displayName = profile?.display_name || emailLocal || 'User';  // || covers empty string
```

---

### IN-03: ESLint flat config doesn't cover `.js` config files or set test globals

**File:** `eslint.config.js:11`
**Issue:** `files: ['**/*.{ts,tsx}']` means `vite.config.ts` is covered (good) but e.g. future `scripts/*.js` helper scripts and this very `eslint.config.js` aren't lintable. Also, test files use Vitest globals via `vi.stubEnv` / `describe` etc., but those names are imported explicitly — so globals are fine today. If the project ever flips `globals: true` in `vite.config.ts` test config without importing them, ESLint will flag them as undefined.

**Fix:** Add a test-specific override block in `eslint.config.js`:

```js
{
  files: ['src/tests/**/*.{ts,tsx}'],
  languageOptions: { globals: { ...globals.browser, ...globals.node } },
  // vitest flat config plugin if/when added
}
```

Not blocking — current code imports Vitest APIs explicitly.

---

### IN-04: `departments` seed uses `code` as placeholder `display_name`

**File:** `supabase/migrations/20260421000008_seed_departments.sql:4-25`
**Issue:** Every row is seeded with `display_name = code` (e.g., `('AMER', 'AMER')`). The comment acknowledges this is temporary, but once Phase 2 imports real PDFs, we need to make sure the PDF import doesn't *overwrite* human-edited display names if someone fills them in manually. Recommend adding `ON CONFLICT (code) DO NOTHING` (already present — good) and a note in the code that future Phase 2 import logic should NOT `UPSERT` `display_name` — only `INSERT` when absent.

**Fix:** No code change needed for Phase 1. File a Phase 2 note: "Import logic must treat `departments.display_name` as human-authoritative once non-placeholder."

---

### IN-05: README migration count mismatch

**File:** `README.md:93`
**Issue:** The README says "9 dashboard migrations starting at 20260421000000." The directory contains 9 files (`000000` through `000008`), which matches. Minor nit: when Phase 2 adds migrations the count will drift unless the README is kept in sync. Consider removing the count and just describing the layout.

**Fix:** Replace "9 dashboard migrations starting at 20260421000000" with something like "dashboard migrations, timestamped starting 2026-04-21" so future additions don't require doc churn.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
