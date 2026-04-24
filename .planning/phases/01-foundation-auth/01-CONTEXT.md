# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold a new Vite + React 19 + TypeScript + Tailwind v4 web application that connects to the existing TPC App Supabase project, enforces admin-only access behind Supabase email/password login, and lands the authenticated user on a placeholder dashboard shell. Provision all dashboard-owned PostgreSQL tables (`sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`) via Supabase CLI migrations without touching any TPC App tables, and seed the `departments` reference table.

Phase 1 does NOT import PDFs, render charts, or expose any sale data — those belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Project Scaffold & Structure
- Standalone repo rooted at `c:/Users/maser/Projects/tpc-dashboard/` (not a workspace of TPC App)
- Mirror TPC App src layout: `src/components`, `src/pages`, `src/layouts`, `src/lib`, `src/db`, `src/hooks`, `src/stores`, `src/services`, `src/utils`, `src/tests`
- Scaffold TanStack Query (`QueryClient` + `QueryClientProvider`) in Phase 1 so later phases (Sale Views, KPIs, Trends) plug into an existing provider
- Environment variables live in `.env.local` (gitignored); same var names as TPC App: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `package.json` scripts match TPC App: `dev`, `build` (`tsc -b && vite build`), `lint`, `test`, `preview`, `db:push`, `db:types`

### Authentication & Routing
- **Access model: single-admin.** Only the existing admin profile (the `info` email already present in the shared Supabase) is authorized to use the dashboard in v1. All other profiles (specialists) are blocked at the auth gate.
- Sign-in uses Supabase `auth.signInWithPassword` (email + password) — no magic link
- Login page styling matches TPC App's `Login.tsx` (Tailwind, minimal card, visible error state)
- Role is read from the shared `profiles` table (`profiles.role === 'admin'`) after a successful session — same source TPC App uses
- `ProtectedRoute` wrapper: unauthenticated → redirect to `/login`; authenticated non-admin → show "Access denied — this dashboard is restricted to admin accounts." with a sign-out button
- Post-login landing: `/` renders a `Dashboard` placeholder page (layout shell + "Welcome, {profile.full_name}" + empty KPI grid stub) so Phase 4 can drop KPIs into the slot
- Nav/layout shell reflects the target dashboard IA: sidebar with placeholder links (Sales, Trends, Departments, Team, Reports, Custom Charts) stubbed as "Coming soon"
- Session persistence handled by `@supabase/supabase-js` defaults (localStorage)

### Database Schema
- All tables use plain names — no `dash_` prefix. Collision check against TPC App migrations confirms none of these names are used: `sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`
- Primary keys: UUID `id DEFAULT gen_random_uuid()` on every table, plus business keys with UNIQUE constraints where applicable (e.g., `sales.sale_number`)
- All monetary columns use `numeric(14,2)` (PostgreSQL DECIMAL) — no `bigint` cents, no `float`. This satisfies INFR-04 end-to-end when aggregations run server-side
- Timestamps: `created_at`, `updated_at` (`timestamptz`) on all tables, default `now()`, with an `updated_at` trigger pattern reused from TPC App
- Migrations managed by Supabase CLI in `supabase/migrations/` as timestamped `.sql` files
- Regenerate types via `npm run db:types` into `src/db/database.types.ts`

### RLS & Role Enforcement
- RLS enabled on every dashboard-owned table (no exceptions)
- Read scope for `sales`, `sale_departments`, `departments`, `scraper_runs`: authenticated admin only (policy: `auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`). This aligns with the single-admin access model above while leaving the policy in a form that works for any future admin account.
- Write scope for `sales`, `sale_departments`, `departments`, `scraper_runs`: service role only (no INSERT/UPDATE/DELETE policies for authenticated — import/scraper run via server-side scripts using service key)
- `saved_reports`: per-user rows. Policies: authenticated admin can SELECT/INSERT/UPDATE/DELETE WHERE `user_id = auth.uid()`
- Client-side role state: Zustand `useAuthStore` holds `{ session, profile, isAdmin }`, hydrated after `auth.onAuthStateChange` fires; UI gates read from the store
- Seed `departments` reference table at migration time with known codes from PROJECT.md: AMER, ASD, ASN, ASNP, BKS, CER, CLK, DEC, DRW, ENT, FRN, GEN, GLS, MAP, MDF, MUS, PER, PND, PNT, SPT, SIL, TXTL (plus display names where known). Additional codes discovered during Phase 2 PDF import extend this table via follow-on migration.

### Claude's Discretion
- Exact sidebar link labels and ordering
- Tailwind class choices for the login page and shell (aim to visually match TPC App without copying pixel-for-pixel)
- Loading/error state components for auth transitions (simple spinner + error text acceptable)
- Tests: cover auth flow happy path + non-admin redirect via Vitest + Testing Library; additional depth at discretion
- Whether to include an `updated_at` trigger migration as a shared helper or inline per table

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from sibling TPC App — for reference/pattern, not import)
- TPC App `src/lib/supabase.ts` — Proxy-wrapped lazy `SupabaseClient<Database>` reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Reuse this exact pattern.
- TPC App `src/db/database.types.ts` — Generated via `supabase gen types`. Reuse generation script.
- TPC App `src/pages/Login.tsx` — Visual reference for the dashboard login page.
- TPC App `supabase/migrations/20260318000005_rls_policies.sql` — Reference for RLS policy shape.
- TPC App `supabase/migrations/20260318000000_create_profiles.sql` — Defines the shared `profiles` table with `role` column; dashboard reads this as-is, does NOT modify.

### Established Patterns
- Env-driven Supabase client, not global singleton construction, to allow SSR-safe lazy init
- Supabase CLI for migrations + type generation (scripts `db:push`, `db:types`)
- Zustand stores for client state (auth, UI)
- Tailwind v4 via `@tailwindcss/vite` plugin (not PostCSS)
- ESLint flat config (v9)
- Vitest + Testing Library for tests, jsdom env

### Integration Points
- Shared Supabase project — same URL/anon key values as TPC App (both apps authenticate against the same auth schema and `profiles` table)
- Dashboard ONLY reads from TPC App tables (`profiles`, later `sessions`, `items`, `export_history`, `photos`). Never writes to them.
- Dashboard OWNS its new tables — migrations are idempotent and namespaced by filename date
- Vercel deployment target — env vars configured in Vercel project settings for prod

</code_context>

<specifics>
## Specific Ideas

- Only the `info` email account (current admin in shared Supabase) accesses the dashboard in v1. Any login attempt from a specialist profile reaches the gate, authenticates successfully, then hits the "Access denied" screen.
- Match TPC App versions exactly where possible; CLAUDE.md pins versions.
- Seed the known department codes from PROJECT.md into `departments` at migration time.

</specifics>

<deferred>
## Deferred Ideas

- Specialist role UI (AUTH-03 specialist-restricted view) — out of v1 access model; revisit when more admins/users need access.
- Password reset / change-password flow — use Supabase dashboard for v1; add in-app if needed later.
- Multi-admin invite flow / user management UI — TPC App handles profile creation; dashboard reuses profiles as-is.
- Session-based audit log of admin activity — not required in v1.

</deferred>
