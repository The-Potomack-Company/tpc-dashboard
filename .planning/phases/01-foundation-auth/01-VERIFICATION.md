---
phase: 01-foundation-auth
verified: 2026-04-21T18:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
pivot_note: "Phase 1 is RETAINED for v2.0 — auth, routing, layout, deploy config remain foundation. Deploy-smoke UAT stays pending (deploy is still needed for v2)."
human_verification:
  - test: "Vercel deploy: create Vercel project, set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, deploy, confirm /login loads without console errors, confirm admin can log in on deployed URL"
    expected: "Deployed URL returns /login page without console errors when visited unauthenticated; admin credentials sign in successfully"
    why_human: "INFR-01 requires an actual Vercel project to be created and deployed. The codebase is deploy-ready (build passes, env vars documented) but the deployment itself is a user-action with external service access."
    status: pending
---

# Phase 1: Foundation & Auth Verification Report

**Phase Goal:** The application skeleton exists with working authentication and a verified database schema that safely coexists with the TPC App
**Verified:** 2026-04-21T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can log in to the dashboard using their existing TPC App Supabase credentials | VERIFIED | `src/pages/Login.tsx` (102 lines): form calls `useAuthStore.signIn(email, password)` which delegates to `supabase.auth.signInWithPassword`. `authStore.ts` subscribes to `onAuthStateChange`. 5 login-page tests pass (23/23 total test suite green). Manual QA confirmed by user per 01-05-SUMMARY. |
| 2 | Admin user sees a placeholder dashboard page after login; specialist user sees a restricted version | VERIFIED | `src/components/ProtectedRoute.tsx` (55 lines): five-stage gate — admin hits `<Outlet />` rendering `DashboardPage` ("Your KPIs land here."); non-admin hits `<AccessDenied />` with explanation + sign-out. 5 protected-route tests cover all branches. Manual QA of AccessDenied screen confirmed by user. |
| 3 | Unauthenticated users are redirected to login and cannot access any data endpoints | VERIFIED | ProtectedRoute stage 2: `!session` → `<Navigate to="/login" replace />`. RLS policies in `20260421000007_rls_policies.sql` block anon SELECT on all 5 dashboard tables via `(select private.is_admin())`. SQL checks A + B confirmed by user (per 01-05-SUMMARY). Protected-route test case 2 asserts /login content renders on unauthenticated access. |
| 4 | Database schema exists with all dashboard-owned tables (sales, sale_departments, departments, scraper_runs, saved_reports) and does not modify any TPC App tables | VERIFIED | All 5 migrations exist (`20260421000001`–`20260421000005`). RLS enabled on all 5 tables (grep-confirmed). `src/db/database.types.ts` (712 lines) contains all 5 tables AND `profiles` (confirming shared schema; TPC App tables untouched). Seed: 22 departments with `on conflict (code) do nothing`. 12× `numeric(14,2)` in sales migration, 5× in sale_departments. |
| 5 | All financial aggregation queries use PostgreSQL DECIMAL arithmetic, not JavaScript | VERIFIED (schema-level) | `20260421000002_create_sales.sql` has 12 `numeric(14,2)` columns. `20260421000003_create_sale_departments.sql` has 5 `numeric(14,2)` columns. No `float`, `double precision`, or bigint-cents anywhere in migrations. Schema-shape test (`schema-shape.test.ts`, 4 cases) uses `expectTypeOf` to assert all 12 monetary columns on `SaleRow` type as `number \| null` — passes in 23/23 test run. |

**Score:** 5/5 roadmap success criteria verified

### INFR-01 Human Verification Item

INFR-01 (Vercel deploy) was explicitly deferred at user request (documented in `01-05-SUMMARY.md`). The codebase is fully deploy-ready (build passes, env vars documented in README + `.env.example`, Vercel steps in README). The deploy itself requires user action against the external Vercel service.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Pinned runtime + dev deps, all 7 scripts | VERIFIED | `react: ^19.2.0`, `vite: ^7.3.1`, `tailwindcss: ^4.2.1`, `react-router: ^7.13.1`, `@tanstack/react-query: ^5.99.2`, `zustand: ^5.0.11`, `zod: ^4.3.6`. All 7 scripts present including `db:push` and `db:types`. |
| `vite.config.ts` | React plugin + Tailwind v4 plugin + Vitest config | VERIFIED | Contains `tailwindcss()` in plugins, `environment: 'jsdom'`, `setupFiles: ['src/tests/setup.ts']`, `/// <reference types="vitest/config" />` |
| `src/index.css` | Tailwind import + @theme with exactly 2 accent tokens | VERIFIED | `@import "tailwindcss"`, `--color-accent: #2563eb`, `--color-accent-hover: #1d4ed8`. No other `--color-*` tokens. |
| `src/tests/setup.ts` | @testing-library/jest-dom augmentation | VERIFIED | Contains `import '@testing-library/jest-dom/vitest'` |
| `.env.example` | VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY template | VERIFIED | Both vars present |
| `supabase/migrations/20260421000001_create_departments.sql` | departments table with code PK UNIQUE | VERIFIED | `create table public.departments`, `code text not null unique` |
| `supabase/migrations/20260421000002_create_sales.sql` | sales table with numeric(14,2) monetary columns | VERIFIED | 12× `numeric(14,2)` confirmed |
| `supabase/migrations/20260421000003_create_sale_departments.sql` | per-sale per-department fact table | VERIFIED | `references public.sales(id)`, 5× `numeric(14,2)` |
| `supabase/migrations/20260421000004_create_scraper_runs.sql` | scraper run audit table | VERIFIED | `create table public.scraper_runs` |
| `supabase/migrations/20260421000005_create_saved_reports.sql` | per-user saved report configs | VERIFIED | `user_id uuid`, `references auth.users(id)` |
| `supabase/migrations/20260421000006_rls_helper_functions.sql` | private.is_admin() SECURITY DEFINER | VERIFIED | `create or replace function private.is_admin()`, `security definer set search_path = ''` |
| `supabase/migrations/20260421000007_rls_policies.sql` | RLS policies using (select private.is_admin()) | VERIFIED | 9 policy blocks, all using `(select private.is_admin())` |
| `supabase/migrations/20260421000008_seed_departments.sql` | 22 department codes, ON CONFLICT DO NOTHING | VERIFIED | `on conflict (code) do nothing`, 22 quoted string values |
| `src/db/database.types.ts` | Generated Database type with 5 dashboard tables + profiles | VERIFIED | 712 lines, `export type Database`, all 6 tables confirmed |
| `src/lib/supabase.ts` | Proxy-wrapped lazy SupabaseClient<Database> singleton | VERIFIED | 25 lines, `new Proxy({} as SupabaseClient<Database>`, imports `Database`, both env-var error strings present |
| `src/stores/authStore.ts` | Zustand auth store with session + profile + isAdmin | VERIFIED | 95 lines, exports `useAuthStore`, `onAuthStateChange`, `role === 'admin'`, `signOut({ scope: 'local' })` |
| `src/main.tsx` | BrowserRouter + QueryClientProvider + auth init | VERIFIED | `BrowserRouter`, `QueryClientProvider`, `ReactQueryDevtools` (DEV-gated), `useAuthStore.getState().initialize()` before `createRoot` |
| `src/pages/Login.tsx` | Email/password login form matching UI-SPEC | VERIFIED | 102 lines, "TPC Dashboard" title, "Auction analytics for The Potomack Company" subtitle, `type="email"`, `type="password"`, `required`, `autoFocus`, `role="alert"` on error |
| `src/pages/Dashboard.tsx` | Placeholder dashboard content | VERIFIED | 14 lines, "Your KPIs land here.", "The scorecard shows up once Phase 4 lands. For now, you're all set up." |
| `src/components/ProtectedRoute.tsx` | Five-stage gate: loading / unauth / profile-loading / non-admin / admin | VERIFIED | 55 lines, `data-testid="auth-loading"`, `data-testid="profile-loading"`, `<Navigate to="/login" replace />`, `<AccessDenied />`, `<Outlet />` |
| `src/components/AccessDenied.tsx` | Access-denied card with sign-out button | VERIFIED | 40 lines, "Access denied" heading, `role="alert"` on body, "This dashboard is restricted to admin accounts.", "Sign out" button |
| `src/layouts/DashboardLayout.tsx` | Sidebar + header shell per UI-SPEC | VERIFIED | 100 lines, "ANALYTICS" label, 6-element NAV_LINKS array (Sales/Trends/Departments/Team/Reports/Custom Charts), `aria-disabled="true"` in map, "Coming soon" asides, `profile?.display_name` (not `full_name`) |
| `src/App.tsx` | Route table: /login → Login, / → ProtectedRoute > DashboardLayout > Dashboard | VERIFIED | 19 lines, `<Routes>`, `element={<ProtectedRoute />}` nesting, `/login` route, catch-all `*` → Navigate |
| `src/tests/login-page.test.tsx` | Submit + error-state assertions | VERIFIED | 130 lines, 5 cases: title+subtitle, labeled inputs, submit→signIn, error alert, success navigate |
| `src/tests/protected-route.test.tsx` | Four+ states: loading / unauth / non-admin / admin | VERIFIED | 163 lines, 5 cases covering all ProtectedRoute branches |
| `README.md` | Setup, env vars, forbidden commands, deploy steps | VERIFIED | 121 lines, `single-admin`, `supabase db pull` warning, VITE_SUPABASE_URL/ANON_KEY documented, Vercel steps included |
| `.planning/REQUIREMENTS.md` | AUTH-03 annotated with v1 interpretation | VERIFIED | `Partial (v1: single-admin — specialist blocked at auth gate; specialist-restricted view deferred to v2)` |
| `.planning/STATE.md` | Phase 1 complete + decision log | VERIFIED | `Status: Phase 1 complete (pending final human QA)`, 3+ `[Phase 1]` decision entries |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vite.config.ts` | `@tailwindcss/vite` | `plugins` array | WIRED | `tailwindcss()` in plugins array |
| `src/index.css` | Tailwind v4 engine | `@import` directive | WIRED | `@import "tailwindcss"` present |
| `src/lib/supabase.ts` | `src/db/database.types.ts` | `import type { Database }` | WIRED | `import type { Database } from '../db/database.types'` present |
| `src/stores/authStore.ts` | `src/lib/supabase.ts` | `supabase.auth.onAuthStateChange + supabase.from('profiles')` | WIRED | `import { supabase } from '../lib/supabase'`, both call sites present |
| `src/main.tsx` | `src/stores/authStore.ts` | `useAuthStore.getState().initialize()` | WIRED | Call present before `createRoot` |
| `src/App.tsx` | `src/components/ProtectedRoute.tsx` | route element | WIRED | `element={<ProtectedRoute />}` in route tree |
| `src/pages/Login.tsx` | `src/stores/authStore.ts` | `useAuthStore` selector for `signIn` | WIRED | `import { useAuthStore }`, `useAuthStore((s) => s.signIn)` |
| `src/components/ProtectedRoute.tsx` | `src/stores/authStore.ts` | session + isAdmin + loading + profileLoading | WIRED | 5 `useAuthStore` selectors in component |
| `src/layouts/DashboardLayout.tsx` | `src/stores/authStore.ts` | profile + signOut | WIRED | 3 `useAuthStore` selectors: profile, user, signOut |
| `supabase/migrations/20260421000007_rls_policies.sql` | `20260421000006_rls_helper_functions.sql` | `(select private.is_admin())` | WIRED | 9 policy clauses reference `private.is_admin()` |

### Data-Flow Trace (Level 4)

Dashboard tables contain no real auction data yet (Phase 2 imports the PDFs). However, the auth data flow from Supabase to ProtectedRoute is fully wired:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/components/ProtectedRoute.tsx` | `session`, `isAdmin`, `profile` | `useAuthStore` → `supabase.auth.onAuthStateChange` + `supabase.from('profiles').select('*')` | Yes — reads live `profiles` table in shared Supabase | FLOWING |
| `src/pages/Dashboard.tsx` | n/a | Static placeholder content (intentional Phase 1 empty state per ROADMAP) | N/A — Phase 4 lands KPI data | INTENTIONAL STATIC (Phase 1 goal is scaffold, not data) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npm test` | 5 files, 23 tests passed, 0 failures | PASS |
| Build produces dist/ | `npm run build` | 144 modules transformed, `dist/index.html` + hashed JS (459 kB) + CSS (15 kB) produced | PASS |
| 12× numeric(14,2) in sales migration | `grep -c "numeric(14,2)" supabase/migrations/20260421000002_create_sales.sql` | 12 | PASS |
| 5× numeric(14,2) in sale_departments migration | `grep -c "numeric(14,2)" supabase/migrations/20260421000003_create_sale_departments.sql` | 5 | PASS |
| RLS enabled on all 5 tables | `grep "enable row level security" supabase/migrations/2026042100000[1-5]*.sql` | All 5 migrations contain the clause | PASS |
| Database types contains all 5 dashboard tables + profiles | `grep "sales:\|sale_departments:\|departments:\|scraper_runs:\|saved_reports:\|profiles:" src/db/database.types.ts` | All 6 found | PASS |
| AUTH-03 annotation in REQUIREMENTS.md | `grep -E "AUTH-03.*single-admin" .planning/REQUIREMENTS.md` | Match found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFR-01 | 01-05-PLAN.md | Dashboard deployed to Vercel | HUMAN NEEDED | Build ready, env vars documented; deploy deferred at user request. Requires Vercel project creation by user. |
| INFR-02 | 01-01-PLAN.md, 01-03-PLAN.md | Dashboard uses Supabase (shared project with TPC App) | SATISFIED | Supabase CLI linked to shared project `wgrknodfxdjtddsirldw`. `src/lib/supabase.ts` creates `SupabaseClient<Database>` pointing to same URL/anon key as TPC App. 9 dashboard migrations pushed alongside TPC App's 12. |
| INFR-04 | 01-02-PLAN.md, 01-03-PLAN.md | Financial aggregations in PostgreSQL, not JavaScript | SATISFIED | All 17 monetary columns across `sales` (12) and `sale_departments` (5) are `numeric(14,2)`. No `float`, `double precision`, or bigint-cents. Schema-shape test proves generated types are `number \| null` (not string — direct numeric mapping). Phase 2+ will use SQL SUM/AVG, not JS reduce. |
| AUTH-01 | 01-03-PLAN.md, 01-04-PLAN.md | User can log in with existing TPC App Supabase credentials | SATISFIED | `supabase.auth.signInWithPassword` delegates to Supabase Auth (shared project). Login form wired to authStore.signIn. Manual QA confirmed login works with the info@ admin account. |
| AUTH-02 | 01-04-PLAN.md | Admin role sees all data, all activity, all reports | SATISFIED | ProtectedRoute stage 5 grants `<Outlet />` to `isAdmin === true`. RLS admin-only SELECT policies on all 4 data tables. Defense in depth: client gate (UX) + server gate (RLS). |
| AUTH-03 | 01-04-PLAN.md, 01-05-PLAN.md | Specialist role sees sale data, trends, own activity (v1: single-admin) | PARTIAL (intentional) | v1 interpretation: specialist sees AccessDenied screen with their email + sign-out. Specialist-restricted data view deferred to v2 per REQUIREMENTS.md annotation and STATE.md decision log. |
| AUTH-04 | 01-02-PLAN.md, 01-04-PLAN.md | Unauthenticated users cannot access any dashboard data | SATISFIED | ProtectedRoute stage 2: `!session` → redirect to /login. RLS with admin-only policies: anon role cannot SELECT any dashboard table (user confirmed via SQL check A in 01-05-SUMMARY). |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/pages/Dashboard.tsx` | "Your KPIs land here." placeholder content | INFO | Intentional Phase 1 empty state per ROADMAP.md and UI-SPEC. Phase 4 replaces with real KPI grid. Not a blocker. |
| `src/layouts/DashboardLayout.tsx` | 6 sidebar nav links with `aria-disabled="true"` and "Coming soon" | INFO | Intentional per UI-SPEC sidebar link state rules. Links become active in Phases 3/5/6/7/8/9. Not a blocker. |
| `src/layouts/DashboardLayout.tsx` | `v0.0.0` footer version | INFO | Literal string per UI-SPEC. Will be replaced with real version in a later phase. Not a blocker. |

No blockers found. All intentional stubs are future-phase placeholders explicitly documented in ROADMAP.md and UI-SPEC.

### Human Verification Required

#### 1. Vercel Deploy (INFR-01)

**Test:** Follow README "Deploy to Vercel" section: (1) Push repo to GitHub if not already, (2) Create new Vercel project — framework: Vite, build command: `npm run build`, output: `dist`, (3) Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables in Project Settings for all three environments, (4) Trigger deploy.

**Expected:** Deployments tab shows "Ready". Visiting the deployed URL while unauthenticated renders `/login` page without console errors. Admin credentials (`info@` account) sign in successfully on the deployed URL and land on the placeholder dashboard.

**Why human:** INFR-01 requires an actual Vercel account, a GitHub-linked repository, and user action in the Vercel dashboard to create the project and set secrets. Claude cannot create external service accounts or trigger deployments. The codebase is fully deploy-ready (build passes cleanly, env vars templated in `.env.example`, deploy instructions in README).

---

## Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria are verified at the code level.

The only outstanding item is INFR-01 (Vercel deployment), which was explicitly deferred by the user during Plan 05 execution. This is documented in `01-05-SUMMARY.md` as an intentional deferral, not a gap in the implementation. The deploy path is fully documented in README.md.

AUTH-03 is intentionally "Partial" — the v1 single-admin interpretation is the agreed scope, annotated in REQUIREMENTS.md and STATE.md.

---

_Verified: 2026-04-21T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
