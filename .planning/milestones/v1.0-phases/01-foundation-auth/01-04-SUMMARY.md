---
phase: 01-foundation-auth
plan: 04
subsystem: auth-ux

tags:
  - login-page
  - protected-route
  - access-denied
  - dashboard-layout
  - react-router-v7
  - ui-spec
  - rls-defense-in-depth
  - wave-0-tests
  - testing-library

# Dependency graph
requires:
  - phase: 01-foundation-auth
    plan: 03
    provides: "useAuthStore (session, user, profile, isAdmin, loading, profileLoading, signIn, signOut), Proxy-wrapped supabase client, BrowserRouter + QueryClientProvider in main.tsx"
  - phase: 01-foundation-auth
    plan: 02
    provides: "RLS policies on sales/sale_departments/departments/scraper_runs/saved_reports (authoritative server-side admin gate)"
  - phase: 01-foundation-auth
    plan: 01
    provides: "Scaffold with react-router@7.13.1, @testing-library/react, @testing-library/user-event, vitest@4.1.5"
provides:
  - "src/pages/Login.tsx — email/password login page with UI-SPEC copy (TPC Dashboard title, Auction analytics subtitle, Email/Password labels, Sign In CTA with spinner)"
  - "src/pages/Dashboard.tsx — placeholder 'Your KPIs land here.' page rendered inside DashboardLayout"
  - "src/components/ProtectedRoute.tsx — five-stage admin gate (loading / !session / profileLoading / !isAdmin / admin) from RESEARCH.md Pattern 4"
  - "src/components/AccessDenied.tsx — UI-SPEC access-denied card with user email + Sign out CTA (role='alert' on body)"
  - "src/layouts/DashboardLayout.tsx — w-60 sidebar with ANALYTICS section + 6 disabled nav links ('Coming soon'), sticky h-16 header with Welcome + account menu, max-w-7xl main content"
  - "src/App.tsx — route table: /login -> LoginPage, / -> ProtectedRoute > DashboardLayout > Dashboard, * -> Navigate to /"
  - "Wave 0 tests: login-page.test.tsx (5 cases) + protected-route.test.tsx (5 cases)"
affects:
  - "01-05 (QA + deploy): manual verification exercises the end-to-end login + admin + non-admin + sign-out flow documented in Verification section"
  - "02+ (data-facing phases): DashboardLayout main slot is the single content surface for future KPI cards, tables, charts"

# Tech tracking
tech-stack:
  added: []   # No new packages — everything was installed in Plan 01
  patterns:
    - "Three-stage ProtectedRoute gate with distinct data-testids for auth-loading and profile-loading spinners (prevents flash-of-protected-content per RESEARCH.md Pitfall 1)"
    - "AccessDenied as render (not redirect) — per UI-SPEC, non-admin users need to see the explanation + sign-out, not bounce back to /login"
    - "Nested route composition: ProtectedRoute wraps DashboardLayout, which wraps the content page via <Outlet />"
    - "Client-side admin gate as UX hint only; RLS (Plan 02) is the authoritative security boundary (defense in depth, T-04-04)"
    - "displayName derivation: profile?.display_name ?? user?.email?.split('@')[0] ?? 'User' (RESEARCH.md Pitfall 6 — UI-SPEC says full_name but schema has display_name)"
    - "vi.hoisted mockNavigate pattern to observe useNavigate calls in tests (mirrors TPC App login-page.test.tsx)"
    - "useAuthStore.setState(...) in test beforeEach to seed store state directly — zustand allows partial state patches"

key-files:
  created:
    - "src/pages/Login.tsx"
    - "src/pages/Dashboard.tsx"
    - "src/components/ProtectedRoute.tsx"
    - "src/components/AccessDenied.tsx"
    - "src/layouts/DashboardLayout.tsx"
    - "src/tests/login-page.test.tsx"
    - "src/tests/protected-route.test.tsx"
  modified:
    - "src/App.tsx — placeholder body replaced with <Routes> tree"

key-decisions:
  - "Client-side admin check is UX-only; RLS remains authoritative. A spoofed isAdmin=true in devtools will still see zero rows from any protected table."
  - "Five-stage ProtectedRoute (loading -> !session -> profileLoading||profile===null -> !isAdmin -> Outlet) instead of TPC App's two-component split (ProtectedRoute + AdminRouteGuard). The dashboard has exactly one access level, so splitting adds no value."
  - "AccessDenied uses max-w-md (448px) instead of Login's max-w-sm (384px) to fit the longer body paragraph, per UI-SPEC Layout Specifications."
  - "User-event is used with `userEvent.setup()` per-test instead of static `userEvent.click(...)` — matches library v14 recommendation and TPC App tests."
  - "Test fixtures construct synthetic Session/Profile objects via typed factories (makeSession / makeProfile) with targeted casts instead of the plan's inline `as Partial<...> as ReturnType<...>` double-cast. Cleaner, still exact-typed at the call sites."

patterns-established:
  - "Pattern: per-test useAuthStore.setState in beforeEach seeds the store, then individual tests override specific fields. Works because zustand allows partial patches."
  - "Pattern: test mocks supabase at the module boundary (vi.mock('../lib/supabase', ...)) so authStore can still be imported at the top of the test without touching real env / network."
  - "Pattern: MemoryRouter + Routes + Route test tree to exercise Navigate redirects — asserting content of the /login route after render proves the redirect fired."

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04

# Metrics
duration: 20min
completed: 2026-04-21
started: 2026-04-21T17:10:00Z
---

# Phase 01 Plan 04: Login, ProtectedRoute, AccessDenied, DashboardLayout, Route Table Summary

**Admin-only dashboard shell wired end-to-end: login page matching UI-SPEC verbatim, five-stage ProtectedRoute that gates on session + profile + isAdmin (preventing any flash-of-protected-content), AccessDenied card for authenticated non-admin users, sidebar+header DashboardLayout with six disabled nav links, placeholder Dashboard page, and a nested route table in App.tsx — all covered by 10 new Wave 0 test cases that bring the total suite to 22/22 passing.**

## Performance

- **Duration:** ~20 minutes
- **Started:** 2026-04-21T17:10:00Z
- **Completed:** 2026-04-21T17:19:00Z
- **Tasks:** 2/2 committed atomically
- **Files created:** 7 (5 source + 2 test)
- **Files modified:** 1 (App.tsx)

## Accomplishments

- `src/pages/Login.tsx` matches the UI-SPEC copywriting contract verbatim: title "TPC Dashboard", subtitle "Auction analytics for The Potomack Company", Email / Password labels, `you@example.com` placeholder, Sign In CTA with inline spinner during submit. Form `onSubmit` calls `useAuthStore.getState().signIn(email, password)` via selector hook; on success `navigate('/', { replace: true })`; on failure surfaces `signInError.message || 'Incorrect email or password. Try again.'` in a `role="alert"` `<p>`. Email input has `type="email" required autoFocus`; password has `type="password" required`; submit button is `disabled` while submitting with `focus:ring-2 focus:ring-accent`.

- `src/components/ProtectedRoute.tsx` implements the five-stage admin gate from RESEARCH.md Pattern 4:
  1. `loading === true` -> full-page spinner with `data-testid="auth-loading"` + `aria-label="Checking your session"`
  2. `!session` -> `<Navigate to="/login" replace />`
  3. `profileLoading || profile === null` -> full-page spinner with `data-testid="profile-loading"` (prevents flash of protected content per RESEARCH.md Pitfall 1 / threat T-04-03)
  4. `!isAdmin` -> `<AccessDenied />` (render, not redirect — per UI-SPEC the user needs to see the explanation)
  5. authenticated admin -> `<Outlet />`

- `src/components/AccessDenied.tsx` renders centered card (max-w-md, per UI-SPEC) with neutral `Access denied` heading, `role="alert"` body paragraph containing the signed-in user's email verbatim, and outline-style Sign out button that calls `useAuthStore.getState().signOut()` then `navigate('/login', { replace: true })`.

- `src/layouts/DashboardLayout.tsx` is the grid shell: w-60 left sidebar (border-r, gray-50 bg) with title block + `ANALYTICS` small-caps label + six `aria-disabled="true"` nav links (Sales, Trends, Departments, Team, Reports, Custom Charts) each with "Coming soon" aside + `cursor-not-allowed` + gray-500 text + footer `v0.0.0` label. Right column: sticky h-16 header (border-b, right-aligned) with `Welcome, {displayName}` + circular accent avatar button that toggles a role="menu" dropdown containing a single `role="menuitem"` Sign out button; main area is `flex-1 overflow-y-auto` with inner `max-w-7xl mx-auto px-8 py-8` and `<Outlet />` for nested routes. `displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'` per RESEARCH.md Pitfall 6.

- `src/pages/Dashboard.tsx` is a minimal placeholder with the UI-SPEC empty-state heading `Your KPIs land here.` and body `The scorecard shows up once Phase 4 lands. For now, you're all set up.`

- `src/App.tsx` rewritten as the full route table: `/login` -> `LoginPage`; nested `ProtectedRoute` -> `DashboardLayout` -> `/` `DashboardPage`; catch-all `*` -> `<Navigate to="/" replace />`. All imports from `react-router` (never `react-router-dom`).

- Full Wave 0 test suite green: **5 files, 22 passing cases, 0 failures.** Plan 04 contributes 10 new cases across two files:

  **login-page.test.tsx (5 cases):**
  1. Renders title heading + UI-SPEC subtitle
  2. Email input (type=email, required, placeholder you@example.com) + Password input (type=password, required) + Sign In button all present
  3. Submit calls `signIn` with entered email + password
  4. Failed signIn shows `role="alert"` with error message
  5. Successful signIn navigates to `/` with `replace: true` (asserted via hoisted mockNavigate)

  **protected-route.test.tsx (5 cases):**
  1. `loading===true` -> auth-loading spinner visible, dashboard-content absent
  2. `loading===false, session===null` -> /login route content visible (Navigate works), dashboard-content absent
  3. `loading===false, session set, profileLoading===true, profile===null` -> profile-loading spinner visible, dashboard-content absent
  4. `session set, profile.role==='specialist', isAdmin===false` -> "Access denied" heading visible, dashboard-content absent
  5. `session set, profile.role==='admin', isAdmin===true` -> dashboard-content (Outlet) visible, login-page absent

- Full verification chain: `npm run lint` clean (0 warnings), `npm run build` succeeds (144 modules transformed, 263.79 kB / 83.39 kB gzipped JS — 9.4 kB larger than Plan 03 baseline, attributable to the five new components), `npx vitest --run` passes 22/22 in ~6s.

## Task Commits

| Task | Name                                                                            | Commit  | Files                                                                                                          |
| ---- | ------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | Build AccessDenied, DashboardLayout, Dashboard, Login, ProtectedRoute + routes  | 4a1f11d | src/components/AccessDenied.tsx, src/components/ProtectedRoute.tsx, src/layouts/DashboardLayout.tsx, src/pages/Dashboard.tsx, src/pages/Login.tsx, src/App.tsx |
| 2    | Add login-page and protected-route Wave 0 tests                                 | db8052e | src/tests/login-page.test.tsx, src/tests/protected-route.test.tsx                                              |

_Note: Plan metadata commit is created by the orchestrator after Plan 04 completes._

## UI-SPEC Copy Verification (Spot-check)

Every UI-SPEC copy string appears verbatim in the source (grep-verified). Key strings:

- `"TPC Dashboard"` — Login title + sidebar app title (2 locations)
- `"Auction analytics for The Potomack Company"` — Login subtitle
- `"Email"` / `"you@example.com"` / `"Password"` — Login form labels + placeholder
- `"Sign In"` — Login primary CTA
- `"Access denied"` — AccessDenied heading (neutral text-gray-900, NOT red, per UI-SPEC)
- `"This dashboard is restricted to admin accounts. You're signed in as {email}, which doesn't have dashboard access. Contact your admin if you need to be added."` — AccessDenied body (role="alert", with signed-in email interpolated)
- `"Sign out"` — AccessDenied CTA + header menu item (2 locations)
- `"Welcome, {displayName}"` — DashboardLayout header
- `"Your KPIs land here."` / `"The scorecard shows up once Phase 4 lands. For now, you're all set up."` — Dashboard placeholder
- `"ANALYTICS"` — sidebar section label
- Six nav link labels: `Sales`, `Trends`, `Departments`, `Team`, `Reports`, `Custom Charts` — each with `"Coming soon"` aside
- `"Checking your session"` — aria-label on both spinner stages
- `"v0.0.0"` — sidebar footer version label

UI-SPEC deviations from copy contract: **zero.** Every token matches verbatim.

One acceptable technical mapping (already documented as a RESEARCH-level decision, not a UI deviation): UI-SPEC uses `{profile.full_name}` in the header welcome; the schema column is `display_name`. Implementation uses `profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'` per RESEARCH.md Pitfall 6. The rendered surface matches the UI-SPEC tone ("Welcome, Admin") — only the variable name differs.

## Decisions Made

- **Simpler test typing without double-casts:** The plan's test snippet used `as Partial<ReturnType<typeof useAuthStore.getState>> as ReturnType<typeof useAuthStore.getState>` to work around TS strict mode. Zustand's `setState` already accepts `Partial<State>` at the type level, so the casts are unnecessary when you omit `signIn/signOut` (or provide them inline). I used `useAuthStore.setState({...partial...})` directly in `beforeEach` and dropped the casts for readability.

- **Typed factories for Session / Profile:** Synthesized `makeSession(userId, email)` and `makeProfile(role)` helpers in `protected-route.test.tsx` instead of inlining `as unknown as Session` casts throughout each test. Localized the type erasure to a single chokepoint per fixture type, matches the shape TPC App uses for session fixtures.

- **Hoisted `mockNavigate`:** Mirrors TPC App's `login-page.test.tsx` pattern — `vi.hoisted({ mockNavigate: vi.fn() })` + `vi.mock('react-router', () => ({ ...actual, useNavigate: () => mockNavigate }))`. Lets a single test observe that `navigate('/', { replace: true })` fired without needing a real navigate listener.

- **`user-event` setup per test:** `userEvent.setup()` at the top of each interaction test instead of the bare static import. Library v14 recommendation; already what TPC App uses. Solves a subtle pointer-events default that bites `userEvent.click` otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tooling path collision between main repo and worktree**
- **Found during:** Task 1 verification (after Write calls)
- **Issue:** The Write tool interpreted the absolute path `C:\Users\maser\Projects\tpc-dashboard\src\components\...` as the main repo, not the worktree at `C:\Users\maser\Projects\tpc-dashboard\.claude\worktrees\agent-a37086ff\src\components\...`. First round of Writes landed in the main repo's working tree, leaving the worktree empty.
- **Fix:** Copied the 5 new files plus updated App.tsx from the main repo into the worktree's `src/` tree, then reverted the main repo to its pre-task state (`git checkout -- src/App.tsx` + `rm` on the untracked tsx files). Subsequent Writes used full absolute worktree paths (`C:\Users\maser\Projects\tpc-dashboard\.claude\worktrees\agent-a37086ff\src\...`) to avoid the collision.
- **Files modified:** none net (the transient main-repo writes were fully reversed; the final state of the main repo is identical to its pre-task state modulo a pre-existing `.planning/ROADMAP.md` edit that was not ours)
- **Commit:** n/a (tooling workaround — files were committed from the worktree once they landed in the right place at 4a1f11d)

**2. [Rule 3 - Blocking] `npm test -- --run` double-passes `--run` to vitest**
- **Found during:** Initial verification
- **Issue:** The `test` script in `package.json` is `vitest --run`. The plan's `npm test -- --run` forwards a second `--run` to vitest, which crashes the CLI with `Expected a single value for option "--run"`.
- **Fix:** Used `npx vitest --run` directly for verification. Plain `npm test` would also work (same effective invocation). This is a plan-wording issue only; the package script is correct per Plan 01.
- **Files modified:** none
- **Commit:** n/a

### Inserted Non-Plan Test Code

- Added a 5th case to `login-page.test.tsx` asserting `navigate('/', { replace: true })` fires on success. The plan required a minimum of 4; 5 covers the explicit "navigates to / on success" behavior which would otherwise only be implicit from the `signIn` success path.
- `protected-route.test.tsx` defines typed `makeSession` / `makeProfile` factories (one-line helpers) instead of inlining the casts in each test. Cleaner and shorter; zero coverage impact.

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking tooling issues); 0 architectural; 0 Rule 1 bugs; 0 Rule 2 missing functionality; 0 UI-SPEC copy deviations.

**Impact:** No scope, security, or copy drift. All acceptance criteria met as specified in the plan.

## Known Stubs

- **Six sidebar nav links (`Sales`, `Trends`, `Departments`, `Team`, `Reports`, `Custom Charts`) are non-interactive placeholders.** This is intentional and documented in UI-SPEC ("Sidebar link state rules: All six links render with `aria-disabled='true'` and a muted `text-gray-500` color. Clicking does nothing."). Each link displays `Coming soon` in the aside. They become active in later phases (Sales = Phase 3, Trends = Phase 5, Departments = Phase 6, Team = Phase 7, Reports = Phase 8, Custom Charts = Phase 9, per ROADMAP.md).
- **Dashboard page renders a placeholder scorecard message** (`Your KPIs land here.`) — UI-SPEC explicitly defines this as the Phase 1 empty state. Phase 4 lands the real KPI grid.
- **`v0.0.0` sidebar footer** — literal string per UI-SPEC. Will be replaced with a real version tag in Plan 05 (deploy) or a later phase.

None of these stubs prevent Phase 1's goal (admin-only dashboard shell) from being achieved. They are all explicit future-phase placeholders.

## Threat Flags

No new security surface outside the plan's threat model. T-04-03 (flash of protected content) is mitigated by the three-stage spinner pattern — verified by `protected-route.test.tsx` cases 1 and 3 (auth-loading and profile-loading spinners both explicitly assert `dashboard-content` is absent). T-04-04 (client role spoof) is mitigated by RLS (Plan 02) being the authoritative gate — `isAdmin` in the client store is a UX hint. T-04-05 (user enumeration) is mitigated by surfacing Supabase's generic error verbatim with a neutral fallback. T-04-a11y is mitigated by `role="alert"` on every error `<p>` (Login + AccessDenied), verified by `screen.getByRole('alert')` in the tests.

No new trust boundaries introduced beyond the plan's threat register. No new network endpoints, schema changes, or file-access patterns.

## Verification Results

| Gate              | Result | Detail                                                                             |
| ----------------- | ------ | ---------------------------------------------------------------------------------- |
| `npm run lint`    | PASS   | ESLint clean, 0 warnings                                                           |
| `npm run build`   | PASS   | tsc -b + vite build, 144 modules, 263.79 kB JS / 83.39 kB gzipped                  |
| `npx vitest --run`| PASS   | 5 test files, 22/22 cases passing in ~6s                                           |
| UI-SPEC grep      | PASS   | 12+ unique copy strings verified verbatim                                          |
| Manual smoke      | n/a    | Deferred to Plan 05 QA (see Manual Verification Plan below)                        |

## Manual Verification Plan (for Plan 05 QA)

To be executed once the app is running via `npm run dev` against the live Supabase project:

1. **Unauthenticated redirect:** Visit `/` with no session -> expect redirect to `/login`. Confirm URL changes and login form appears.
2. **Valid admin login:** Enter the `info@` email + password -> Sign In spinner appears -> redirected to `/` -> header shows `Welcome, {admin display_name}` -> Dashboard placeholder ("Your KPIs land here.") renders in the main area -> sidebar shows 6 disabled links with "Coming soon".
3. **Invalid credentials:** Enter admin email + wrong password -> spinner stops -> inline error `role="alert"` appears with Supabase's "Invalid login credentials" (or the fallback string).
4. **Valid non-admin login (if a specialist account is available):** Enter specialist credentials -> authenticates successfully -> AccessDenied screen appears with the specialist's email shown verbatim -> Sign out returns to `/login`.
5. **Header sign-out:** Click account avatar -> Sign out menuitem appears -> click -> session clears -> redirected to `/login`.
6. **Keyboard navigation:** On `/login`, Tab order is Email -> Password -> Sign In button. Each control shows the 2px accent focus ring.
7. **Sidebar disabled links:** Hover each nav link -> cursor shows not-allowed, no navigation fires on click.
8. **Flash-of-protected-content sanity:** On a fast network, log in as admin -> observe that the spinner appears (even briefly) before the dashboard shell renders. Never see the dashboard shell for any duration before the welcome name is populated (this confirms the three-stage gate is holding).

## Issues Encountered

- **Worktree vs main-repo path collision:** The agent worktree is located at `C:\Users\maser\Projects\tpc-dashboard\.claude\worktrees\agent-a37086ff`, but absolute paths of the form `C:\Users\maser\Projects\tpc-dashboard\src\...` resolved to the main repo. First Write batch inadvertently modified the main repo's working tree. Recovered by copying files into the worktree and reverting the main repo via `git checkout --` and `rm` on untracked files. Subsequent Writes used the fully-qualified worktree path. Main repo is in its original state modulo a pre-existing ROADMAP edit that predates this plan and is not our work.
- **Windows CRLF warnings:** Informational only. All files committed cleanly. A future `.gitattributes` could normalize line endings.

## User Setup Required

- None. Tests mock supabase at the module boundary — no real credentials needed. Manual QA (see plan above) will be performed against the existing `.env.local` in the main project tree during Plan 05.

## Next Phase Readiness

- **Plan 05 (QA + README + deploy) unblocked:** all code complete. Plan 05 is polish + deploy only — no new components, routes, or tests required by the phase to be functionally complete. The Manual Verification Plan section above is the primary input for Plan 05's QA checklist.
- **Phase 2 (PDF Import) unblocked at the auth-gate level:** any Phase 2 UI will render inside `DashboardLayout` via `<Outlet />` and be transparently gated by ProtectedRoute.
- **Phase 3+ (Sale Views, KPIs, Trends):** sidebar links already reserved with the correct labels; converting them to active routes is a mechanical change per phase.
- **No blockers or concerns.**

## Self-Check

```
FOUND: 4a1f11d (feat: login, dashboard layout, protected route, access-denied, app routes)
FOUND: db8052e (test: login-page and protected-route Wave 0 tests)
FOUND: src/components/AccessDenied.tsx
FOUND: src/components/ProtectedRoute.tsx
FOUND: src/layouts/DashboardLayout.tsx
FOUND: src/pages/Dashboard.tsx
FOUND: src/pages/Login.tsx
FOUND: src/App.tsx (modified — Routes tree in place)
FOUND: src/tests/login-page.test.tsx
FOUND: src/tests/protected-route.test.tsx
MISSING: none
```

## Self-Check: PASSED

---
*Phase: 01-foundation-auth*
*Plan: 04*
*Completed: 2026-04-21*
