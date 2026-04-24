---
phase: 01-foundation-auth
plan: 03
subsystem: client-auth

tags:
  - supabase-client
  - zustand
  - auth-store
  - tanstack-query
  - react-router
  - vitest
  - tdd
  - schema-shape

# Dependency graph
requires:
  - phase: 01-foundation-auth
    plan: 01
    provides: "Vite + React 19 + TypeScript scaffold with pinned @supabase/supabase-js, zustand, @tanstack/react-query(+devtools), react-router, vitest"
  - phase: 01-foundation-auth
    plan: 02
    provides: "src/db/database.types.ts with Database type + 5 dashboard tables + shared profiles table; live RLS policies"
provides:
  - "src/lib/supabase.ts — Proxy-wrapped lazy SupabaseClient<Database> singleton with env-var guards"
  - "src/stores/authStore.ts — Zustand useAuthStore exposing { session, user, profile, isAdmin, loading, profileLoading, initialize, signIn, signOut }"
  - "src/main.tsx — root composition: BrowserRouter + QueryClientProvider + ReactQueryDevtools (dev-only) + pre-render auth initialize()"
  - "Module-level QueryClient (staleTime=60s, refetchOnWindowFocus=false, retry=1)"
  - "Wave 0 test suite: 3 files, 12 passing cases (supabase-client, auth-store, schema-shape)"
affects:
  - "01-04 (Routes + ProtectedRoute): imports useAuthStore + supabase client directly"
  - "01-05 (Login UI + QA): Login form calls useAuthStore.getState().signIn"
  - "02+ (all future phases): TanStack Query provider available; auth guards gate all data calls"

# Tech tracking
tech-stack:
  added: []   # All packages were installed in Plan 01
  patterns:
    - "Proxy-wrapped lazy SupabaseClient singleton — deferred createClient() so tests can mutate env before first access"
    - "Zustand store with onAuthStateChange subscription that fetches the profiles row and derives isAdmin from role==='admin'"
    - "Module-level QueryClient + HMR dispose cleanup for auth subscription"
    - "TDD red→green: failing tests committed first, implementation committed second"
    - "vi.stubEnv / vi.unstubAllEnvs for Vite-inlined import.meta.env.VITE_* values (direct mutation does not work)"
    - "Mock-side __resetAuthCallbacks helper to prevent onAuthStateChange subscribers accumulating across tests"

key-files:
  created:
    - "src/lib/supabase.ts"
    - "src/stores/authStore.ts"
    - "src/tests/supabase-client.test.ts"
    - "src/tests/auth-store.test.ts"
    - "src/tests/schema-shape.test.ts"
  modified:
    - "src/main.tsx — placeholder replaced with full BrowserRouter + QueryClientProvider + auth-init composition"

key-decisions:
  - "Supabase gen types emits numeric(14,2) as `number | null` (confirmed empirically against the live-generated src/db/database.types.ts for all 12 sales monetary columns). Phase 2+ can treat monetary reads as JS numbers directly; server-side aggregation via SQL still required per INFR-04 to avoid float drift on large sums."
  - "Used vi.stubEnv instead of direct import.meta.env mutation (plan's snippet used direct mutation). Vite statically inlines VITE_* at transform time, so direct mutation after module load does not affect the already-compiled supabase.ts. vi.stubEnv is the Vitest-sanctioned override that properly resets with vi.unstubAllEnvs."
  - "Added __resetAuthCallbacks to the mock supabase.auth. Without it, each call to initialize() appends a new callback to a shared array, so multi-test runs trigger all stores for a single fired event — the final 'non-admin' case was receiving both a 'specialist' response AND the default 'admin' response, leaving isAdmin=true."

patterns-established:
  - "Pattern 1: Wave 0 tests sit next to implementation (src/tests/*.test.ts), mirror TPC App layout."
  - "Pattern 2: Mocking supabase at the module boundary with vi.mock('../lib/supabase', ...) is the standard test isolation for Zustand stores that call into Supabase."
  - "Pattern 3: schema-shape tests use expectTypeOf from Vitest — no runtime behavior assertions on type shape, just compile-time guarantees plus expect(true) placeholders so Vitest registers the assertion."

requirements-completed:
  - INFR-02
  - AUTH-01

# Metrics
duration: 25min
completed: 2026-04-21
started: 2026-04-21T17:04:38Z
---

# Phase 01 Plan 03: Supabase Client + Auth Store + Root Composition Summary

**Proxy-lazy Supabase client (Database-typed), Zustand auth store with profiles-fetch + role-derived isAdmin, module-level TanStack QueryClient + BrowserRouter + pre-render auth-init wiring in main.tsx, and a 12-case Wave 0 test suite (3 files) that proves env-var guards, session/profile state transitions, and the generated-Database shape contract for the 5 dashboard tables.**

## Performance

- **Duration:** ~25 minutes (heavy read phase — 9 context files + 3 TPC App references)
- **Started:** 2026-04-21T17:04:38Z
- **Tasks:** 2/2 committed atomically (plus 1 TDD RED commit)
- **Files created:** 5 (supabase.ts, authStore.ts, 3 test files)
- **Files modified:** 1 (main.tsx)

## Accomplishments

- `src/lib/supabase.ts` created as Proxy-wrapped lazy `SupabaseClient<Database>` singleton. Matches TPC App's `supabase.ts` verbatim except for the `Database` import path (`../db/database.types`). Throws `VITE_SUPABASE_URL is not set` / `VITE_SUPABASE_ANON_KEY is not set` on first access when either env var is missing; memoized for every subsequent property read.
- `src/stores/authStore.ts` created with the dashboard-specific shape: `{ session, user, profile, isAdmin, loading, profileLoading, initialize, signIn, signOut }`. `initialize()` subscribes to `supabase.auth.onAuthStateChange`, fetches the `profiles` row on SIGNED_IN, and derives `isAdmin` from `profile.role === 'admin'`. Clears state on SIGNED_OUT. `signOut({ scope: 'local' })` matches TPC App's pattern to avoid the global sign-out foot-gun.
- `src/main.tsx` rewritten to compose the full root tree: module-level `QueryClient` (staleTime 60s, no refetch-on-focus, retry 1), `QueryClientProvider` wrapping `BrowserRouter` + `App`, `ReactQueryDevtools` gated on `import.meta.env.DEV`, and `useAuthStore.getState().initialize()` called before `createRoot`. HMR dispose hook cleans up the auth subscription on hot-reload.
- 12-case Wave 0 test suite green across 3 files:
  - `supabase-client.test.ts` — 3 cases (missing URL throws, missing key throws, both set returns a real memoized client)
  - `auth-store.test.ts` — 5 cases (signIn delegates with correct args, signOut uses scope:local, SIGNED_OUT clears everything, admin role sets isAdmin=true, specialist role sets isAdmin=false)
  - `schema-shape.test.ts` — 4 cases (5 tables present, 12 monetary columns = number|null, saved_reports.user_id = string, profiles.role is concrete string)
- Full verification chain green: `npm run lint` clean, `npm run build` succeeds (tsc -b + vite build producing 254 kB bundle), `npm test` passes 12/12.

## Task Commits

| Task | Name                                                                       | Commit  | Files                                                              |
| ---- | -------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| 1 RED| Add failing tests for supabase client + auth store                         | afeb38e | src/tests/supabase-client.test.ts, src/tests/auth-store.test.ts    |
| 1 GREEN| Implement Supabase client + Zustand auth store                           | a768c98 | src/lib/supabase.ts, src/stores/authStore.ts, 2 test fixes         |
| 2    | Wire root composition + schema-shape test                                  | 2e7e9c8 | src/main.tsx, src/tests/schema-shape.test.ts                       |

_Note: Plan metadata commit is created by the orchestrator after all waves complete._

## Key Answers Requested by Plan Output

- **numeric(14,2) TypeScript mapping:** `number | null`. Verified for every monetary column on `sales`: `hammer_total`, `buyer_premium`, `seller_commission`, `insurance`, `lot_charges`, `referral_fees`, `net_revenue`, `total_sold_value`, `total_unsold_value`, `total_low_estimate`, `total_high_estimate`, `total_reserves`. Phase 2+ code can dereference these as `number` after a null check; server-side SUMs still required per INFR-04.
- **Test results:** 3 files, 12 passing cases, 0 failures, 0 skipped.
- **main.tsx boots cleanly:** `tsc -b` and `vite build` both succeed — no runtime errors surfaced by the bundler's module-graph transformation (139 modules now included, up from 29 at Plan 01).
- **Plan 04 unblocked:** `useAuthStore` is importable from `../stores/authStore`; `supabase` client is importable from `../lib/supabase`; `QueryClientProvider` is already in the tree so TanStack Query hooks will resolve without further wiring.

## Decisions Made

- **`vi.stubEnv` over direct `import.meta.env` mutation:** The plan's test snippet mutated `import.meta.env.VITE_SUPABASE_URL` directly in a test `beforeEach`. Vite statically inlines VITE_* values at transform time (they're replaced with literals before the module even runs), so mutations to the live `import.meta.env` object do not affect the already-compiled `supabase.ts`. `vi.stubEnv` correctly targets Vitest's env-override layer which *is* consulted at runtime. Paired with `vi.unstubAllEnvs` in `afterEach`, isolation is clean.
- **`__resetAuthCallbacks` on the mock:** `vi.mock('../lib/supabase', ...)` runs once per test file, not per test. The default factory captured a module-scoped `onAuthStateChangeCallbacks` array. Each test that called `initialize()` appended another callback; when a later test fired `SIGNED_IN`, every accumulated callback ran, so the mockReturnValueOnce specialist-role fixture was consumed by one callback and the default admin fixture by another — leaving `isAdmin=true` contrary to the test's intent. Resetting the array in `beforeEach` is the minimal, test-local fix. An `unsubscribe` that splices the callback out of the array was also added so production-style cleanup works in tests.
- **Test-running invocation:** Used `npm test` (the package script is already `vitest --run`). The plan's verify snippet used `npm test -- --run`, which on this configuration double-appends `--run` and crashes Vitest's CLI parser with `Expected a single value for option "--run"`. Plain `npm test` is the correct invocation going forward — this is a plan-wording fix only, not a script change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vi.stubEnv` required in supabase-client.test.ts**
- **Found during:** Task 1 GREEN (tests wouldn't pass with plan's direct env-mutation snippet)
- **Issue:** Vite inlines `import.meta.env.VITE_*` values as literals at transform time; mutating the live env object after import has no effect on already-compiled modules.
- **Fix:** Replaced `(import.meta as ... MutableEnv).env.X = 'y'` with `vi.stubEnv('X', 'y')` + `vi.unstubAllEnvs()` in `afterEach`. Kept the same 3-case coverage and all specified error-message regexes.
- **Files modified:** `src/tests/supabase-client.test.ts`
- **Commit:** a768c98

**2. [Rule 3 - Blocking] Mock-side callback accumulation leaking state across tests**
- **Found during:** Task 1 GREEN (the 5th auth-store case 'isAdmin=false when role==specialist' failed with isAdmin=true)
- **Issue:** `vi.mock` factory runs once per file. The `onAuthStateChangeCallbacks` array persisted across tests; each `initialize()` call added a callback; firing a single event triggered all stale callbacks, collapsing the `mockReturnValueOnce` trick.
- **Fix:** Added `__resetAuthCallbacks: () => { onAuthStateChangeCallbacks.length = 0; }` to the mock, called in `beforeEach`. Also made `unsubscribe` splice the callback out of the array so production cleanup semantics hold in tests too.
- **Files modified:** `src/tests/auth-store.test.ts`
- **Commit:** a768c98

**3. [Rule 3 - Blocking] `npm test -- --run` passes `--run` twice on this project**
- **Found during:** Initial baseline check
- **Issue:** The `test` npm script is already `vitest --run`. Adding `-- --run` forwards a second `--run` to Vitest, which rejects it with `Expected a single value for option "--run", received [true, true]`.
- **Fix:** Used plain `npm test` (already `--run`-equivalent). Behavior identical to the plan's intent (non-watch mode execution).
- **Files modified:** none (tooling invocation only; the package script from Plan 01 is correct)
- **Commit:** n/a (documentation fix — see SUMMARY for Plan 04+ reference)

### Inserted Non-Plan Test Code

- `schema-shape.test.ts` uses `toExtend<Tables>()` (Vitest 4.x) on the table-name union; the plan snippet used `toMatchTypeOf`. Both are valid in Vitest 4.1.5, but `toExtend` is the forward-compatible name. Coverage identical (same 5 table names asserted to exist in `keyof Database['public']['Tables']`).

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues that prevented plan verification); 0 architectural; 0 Rule 1 bugs; 0 Rule 2 missing functionality.

**Impact:** No scope or security drift. All acceptance criteria met as specified in the plan.

## Known Stubs

None. The plan intentionally defers Login UI and ProtectedRoute to Plan 04; that is not a stub (Plan 01-03 explicitly owns only the data layer and root composition).

## Threat Flags

No new security surface outside the plan's threat model. T-03-01 (anon key in bundle) remains the intentional accept; RLS (Plan 02) is the authoritative control, verified via the schema-shape test that confirms the Database type only surfaces tables we've RLS'd. T-03-04 (client-side role spoof) is mitigated by PostgREST's JWT check — `isAdmin` in Zustand is a UX hint, never a security boundary.

## Verification Results

| Gate              | Result | Detail                                                              |
| ----------------- | ------ | ------------------------------------------------------------------- |
| `npm run lint`    | PASS   | ESLint clean, 0 warnings                                            |
| `npm run build`   | PASS   | tsc -b + vite build, 139 modules, 254.40 kB JS / 80.79 kB gzipped   |
| `npm test`        | PASS   | 3 test files, 12/12 cases passing, 1.13s runtime                    |
| Manual smoke      | n/a    | Deferred to Plan 05 QA (no UI yet — main.tsx composes empty routes) |

## Issues Encountered

- **Worktree base mismatch:** The agent worktree was originally sitting at `f0c2b92` (pre-phase-plan) rather than `a0797c5` (plan 01-02 complete). A `git reset --hard a0797c5` synced the worktree so Plan 02's `database.types.ts` and migration files were available. Commits for Plan 01-03 applied cleanly on top.
- **Dependencies not installed in worktree:** Expected — fresh worktree. Ran `npm install` once (322 packages from the existing lockfile); no network issues.
- **Windows CRLF warnings:** Informational only. No content drift; every text file committed cleanly. A `.gitattributes` could normalize line endings in a future plan if desired.

## User Setup Required

- **`.env.local`:** Already exists in the main project tree (not in this worktree — gitignored). Tests mock the Supabase client directly, so they pass without real credentials. Plan 05 manual QA will exercise the real creds end-to-end via `npm run dev`.

## Next Phase Readiness

- **Plan 04 (Routes + ProtectedRoute + LoginPage) unblocked:** `useAuthStore` exposes every field the plan needs (`session`, `loading`, `profile`, `profileLoading`, `isAdmin`, `signIn`, `signOut`). `BrowserRouter` is already in the tree; Plan 04 adds the `<Routes>` tree inside `<App />`.
- **Plan 05 (QA + README + deploy) unblocked:** `QueryClientProvider` is in the tree with sensible defaults; any data-fetching Plan 05 needs for manual QA is ready to go.
- **Phase 2 (PDF Import) unblocked at the data-layer level:** the generated `Database` type surfaces all 5 dashboard tables with `number | null` on monetary cols, confirmed by schema-shape test.
- **No blockers or concerns.**

## Self-Check

```
FOUND: afeb38e (test: add failing tests)
FOUND: a768c98 (feat: implement client + auth store)
FOUND: 2e7e9c8 (feat: root composition + schema-shape test)
FOUND: src/lib/supabase.ts
FOUND: src/stores/authStore.ts
FOUND: src/main.tsx (modified from placeholder to full composition)
FOUND: src/tests/supabase-client.test.ts
FOUND: src/tests/auth-store.test.ts
FOUND: src/tests/schema-shape.test.ts
MISSING: none
```

## Self-Check: PASSED

---
*Phase: 01-foundation-auth*
*Plan: 03*
*Completed: 2026-04-21*
