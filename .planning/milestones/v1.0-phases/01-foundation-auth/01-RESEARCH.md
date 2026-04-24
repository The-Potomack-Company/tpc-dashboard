# Phase 1: Foundation & Auth — Research

**Researched:** 2026-04-21
**Domain:** Greenfield web app scaffold (Vite + React 19 + TS + Tailwind v4), Supabase auth against shared database, RLS-protected schema provisioning
**Confidence:** HIGH (scaffold, auth, schema); MEDIUM (migration coordination across two codebases on one database)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Scaffold & Structure**
- Standalone repo at `c:/Users/maser/Projects/tpc-dashboard/` (not a workspace of TPC App)
- Mirror TPC App src layout: `src/components`, `src/pages`, `src/layouts`, `src/lib`, `src/db`, `src/hooks`, `src/stores`, `src/services`, `src/utils`, `src/tests`
- Scaffold TanStack Query (`QueryClient` + `QueryClientProvider`) in Phase 1 so later phases plug into an existing provider
- Environment variables live in `.env.local` (gitignored); same var names as TPC App: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `package.json` scripts match TPC App: `dev`, `build` (`tsc -b && vite build`), `lint`, `test`, `preview`, `db:push`, `db:types`

**Authentication & Routing**
- **Access model: single-admin.** Only the existing admin profile (the `info` email) is authorized in v1. All other profiles (specialists) are blocked at the auth gate.
- Sign-in uses Supabase `auth.signInWithPassword` (email + password) — no magic link
- Login page styling matches TPC App's `Login.tsx` (Tailwind, minimal card, visible error state)
- Role is read from the shared `profiles` table (`profiles.role === 'admin'`) after a successful session
- `ProtectedRoute` wrapper: unauthenticated → redirect to `/login`; authenticated non-admin → show "Access denied" + sign-out button
- Post-login landing: `/` renders a `Dashboard` placeholder page (layout shell + welcome + empty KPI grid stub)
- Nav/layout shell reflects the target IA: sidebar with placeholder links (Sales, Trends, Departments, Team, Reports, Custom Charts) stubbed as "Coming soon"
- Session persistence handled by `@supabase/supabase-js` defaults (localStorage)

**Database Schema**
- All tables use plain names — no `dash_` prefix. Confirmed no collision against TPC App (`sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports` do not exist in TPC App migrations)
- Primary keys: UUID `id DEFAULT gen_random_uuid()` on every table, plus business keys with UNIQUE constraints where applicable (e.g., `sales.sale_number`)
- All monetary columns use `numeric(14,2)` (PostgreSQL DECIMAL) — no `bigint` cents, no `float`
- Timestamps: `created_at`, `updated_at` (`timestamptz`) on all tables, default `now()`, with `updated_at` trigger pattern reused from TPC App
- Migrations managed by Supabase CLI in `supabase/migrations/` as timestamped `.sql` files
- Regenerate types via `npm run db:types` into `src/db/database.types.ts`

**RLS & Role Enforcement**
- RLS enabled on every dashboard-owned table (no exceptions)
- Read scope for `sales`, `sale_departments`, `departments`, `scraper_runs`: authenticated admin only
- Write scope for `sales`, `sale_departments`, `departments`, `scraper_runs`: service role only
- `saved_reports`: per-user rows. Policies: authenticated admin SELECT/INSERT/UPDATE/DELETE WHERE `user_id = auth.uid()`
- Client-side role state: Zustand `useAuthStore` holds `{ session, profile, isAdmin }`, hydrated after `auth.onAuthStateChange`
- Seed `departments` with codes from PROJECT.md: AMER, ASD, ASN, ASNP, BKS, CER, CLK, DEC, DRW, ENT, FRN, GEN, GLS, MAP, MDF, MUS, PER, PND, PNT, SPT, SIL, TXTL

### Claude's Discretion

- Exact sidebar link labels and ordering (UI-SPEC now locks the copy — see `<user_constraints>` section below about UI-SPEC)
- Tailwind class choices for the login page and shell (UI-SPEC locks these)
- Loading/error state components for auth transitions (UI-SPEC locks these)
- Tests: cover auth flow happy path + non-admin redirect via Vitest + Testing Library
- Whether to include an `updated_at` trigger migration as a shared helper or inline per table

### Deferred Ideas (OUT OF SCOPE)

- Specialist role UI (AUTH-03 specialist-restricted view)
- Password reset / change-password flow
- Multi-admin invite flow / user management UI
- Session-based audit log of admin activity

### UI-SPEC Contract (approved 2026-04-21)

All login page, dashboard shell, access-denied, and auth-loading visuals are locked by `.planning/phases/01-foundation-auth/01-UI-SPEC.md`. The planner MUST treat UI-SPEC copy, spacing, color, and typography as authoritative. Key excerpts:

- Login page title: `TPC Dashboard`; subtitle: `Auction analytics for The Potomack Company`
- Access-denied heading: `Access denied`; body: `This dashboard is restricted to admin accounts. You're signed in as {email}, which doesn't have dashboard access. Contact your admin if you need to be added.`
- Sidebar has 6 links (Sales, Trends, Departments, Team, Reports, Custom Charts), all rendered with `aria-disabled="true"` and `text-gray-500`, each with "Coming soon" aside
- Accent color `#2563eb` (Tailwind custom `--color-accent`), declared in `src/index.css` via `@theme` block — same shape as TPC App's `index.css`
- Header shows `Welcome, {profile.full_name}` with fallback to email local-part when `full_name` is null

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Dashboard is a web app deployed to Vercel | Vite scaffold + Vercel deploy defaults; TPC App is already on Vercel — same pattern |
| INFR-02 | Dashboard uses Supabase (shared project with TPC App) | Reuse TPC App's `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; supabase-js Proxy-wrapped client pattern documented below |
| INFR-04 | All financial aggregations happen in PostgreSQL | `numeric(14,2)` on every money column; Phase 1 provisions the columns, later phases MUST write aggregation queries server-side |
| AUTH-01 | User can log in using existing Supabase credentials from TPC App | Shared Supabase project = shared `auth.users` table; `signInWithPassword` works verbatim against the same users |
| AUTH-02 | Admin role sees all data, all activity, all reports | RLS `private.is_admin()` function pattern copied from TPC App (`20260318000004_helper_functions.sql`); admin gate at `ProtectedRoute` level |
| AUTH-03 | Specialist role sees sale data, trends, and own activity only | **PARTIAL COVERAGE.** CONTEXT locks v1 access model as single-admin; specialists hit access-denied screen. Planner must either (a) document that AUTH-03 is implemented-as-access-denial for v1 (with specialist view deferred), or (b) split AUTH-03 into a new `AUTH-03-DEFERRED` row in REQUIREMENTS.md. Recommended approach: (a) — specialists ARE blocked from seeing any data they're not entitled to, which technically satisfies the negative portion of AUTH-03 ("not other specialists' details"). The planner should add a plan-note and a row in the STATE.md decisions log. |
| AUTH-04 | Unauthenticated users cannot access any dashboard data | Two gates: (1) `ProtectedRoute` redirect to `/login` when `session === null`; (2) RLS policies deny all reads when `auth.uid()` is null |

</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffold of a Vite + React 19 + TS + Tailwind v4 app that joins an existing Supabase project and stands up an admin-only gate. It's not a net-new problem — TPC App has already solved the identical stack in the same Supabase project, and their source is available locally as a line-by-line pattern reference. The work is largely "follow TPC App's conventions, rename where needed, add TanStack Query + dashboard-specific tables."

The three substantive engineering questions are:
1. **How to safely add migrations to a database that already has another app's migrations** — answered: the Supabase CLI's `supabase_migrations.schema_migrations` table tracks by timestamp ID, so new migrations with later timestamps just append. The risk is `supabase db pull` pulling in TPC App's schema — we must NOT do that in Phase 1. We push only.
2. **How TanStack Query composes with Supabase auth in React Router v7** — answered: standard `QueryClientProvider` at the root, a single module-level `QueryClient`, and invalidate/clear on `SIGNED_OUT` to purge cached data on logout.
3. **How to prevent the authenticated-but-non-admin user from flashing protected content** — answered: a three-state ProtectedRoute (`loading` / `unauthenticated` / `authenticated`) PLUS a three-state admin check (`profile-loading` / `not-admin` / `admin`). Both states collapse to a single full-screen spinner until resolved.

**Primary recommendation:** Copy TPC App's `src/lib/supabase.ts`, `src/stores/authStore.ts`, and `src/components/ProtectedRoute.tsx` verbatim as starting points. Extend `authStore` to also load the profile row (not just the session), collapse `ProtectedRoute` + `AdminRouteGuard` into a single admin-gating ProtectedRoute (since the dashboard has one access level in v1), and add TanStack Query at the router root. Mirror TPC App's migration style for all five new tables, use `security definer` helper functions for RLS policies (TPC App pattern), and seed departments inline in the migration that creates the table.

---

## Standard Stack

### Core (verified against npm registry 2026-04-21)

| Package | Pinned Version | Latest on npm | Purpose | Notes |
|---------|---------------|---------------|---------|-------|
| `react` | `^19.2.0` | 19.2.5 | UI framework | [CITED: CLAUDE.md] — exact match to TPC App |
| `react-dom` | `^19.2.0` | 19.2.5 | DOM renderer | Paired with react |
| `react-router` | `^7.13.1` | 7.14.2 | Routing (v7 package; NOT `react-router-dom`) | [VERIFIED: npm view] — TPC App uses this exact name and pattern |
| `typescript` | `~5.9.3` | 6.0.3 | Type system | [CITED: CLAUDE.md] — `~` pins minor version; do NOT auto-upgrade to 6.x |
| `vite` | `^7.3.1` | 8.0.9 | Build tool | [CITED: CLAUDE.md] — `^7.3.1` pins to v7; do NOT auto-upgrade to 8.x |
| `tailwindcss` | `^4.2.1` | 4.2.4 | Styling | [VERIFIED: npm view] — v4 current |
| `@tailwindcss/vite` | `^4.2.1` | 4.2.4 | Tailwind Vite plugin (not PostCSS) | [VERIFIED: npm view] |
| `@supabase/supabase-js` | `^2.101.1` | 2.104.0 | DB + auth client | [VERIFIED: npm view] — `^` will resolve latest compatible |
| `@tanstack/react-query` | `^5.99.2` | 5.99.2 | Server state / caching | [VERIFIED: npm view] — current |
| `@tanstack/react-query-devtools` | `^5.99.2` | 5.99.2 | Devtools (dev only) | [VERIFIED: npm view] |
| `zustand` | `^5.0.11` | 5.0.12 | Client state | [CITED: CLAUDE.md] |
| `zod` | `^4.3.6` | 4.3.6 | Schema validation | [CITED: CLAUDE.md] — not strictly required in Phase 1, but install now because TPC App has it and later phases need it |

### Dev Dependencies (verified against npm registry 2026-04-21)

| Package | Pinned Version | Latest on npm | Notes |
|---------|---------------|---------------|-------|
| `@vitejs/plugin-react` | `^5.1.1` | — | Match TPC App; [CITED: TPC App package.json] |
| `@types/react` | `^19.2.7` | 19.2.14 | Match React major |
| `@types/react-dom` | `^19.2.3` | 19.2.3 | Match React major |
| `@types/node` | `^24.10.1` | — | Match TPC App |
| `@eslint/js` | `^9.39.1` | 10.0.1 | Use TPC App's pinned 9.x |
| `eslint` | `^9.39.1` | 10.2.1 | Pin to 9.x per CLAUDE.md |
| `eslint-plugin-react-hooks` | `^7.0.1` | 7.1.1 | — |
| `eslint-plugin-react-refresh` | `^0.4.24` | 0.5.2 | — |
| `typescript-eslint` | `^8.48.0` | 8.59.0 | — |
| `globals` | `^16.5.0` | 17.5.0 | — |
| `vitest` | `^4.0.18` | 4.1.5 | [VERIFIED: npm view] |
| `@testing-library/react` | `^16.3.2` | 16.3.2 | [VERIFIED: npm view] |
| `@testing-library/user-event` | `^14.6.1` | 14.6.1 | — |
| `@testing-library/jest-dom` | `^6.9.1` | 6.9.1 | — |
| `jsdom` | `^28.1.0` | 29.0.2 | — |
| `supabase` | `^2.81.3` | 2.93.0 | CLI; used via `npx supabase ...` |

### Not Installed in Phase 1 (later phases)

- `recharts` (Phase 4 KPI / Phase 5 Trends)
- `@tanstack/react-table` (Phase 3 Sale Views)
- `pdf-parse` (Phase 2 PDF Import — server-side only, not frontend bundle)
- `playwright` (Phase 10 Scraper)
- `@react-pdf/renderer` (Phase 8 Reports)
- `papaparse` (Phase 8 CSV Export)

### Version-Pin Discipline

Every package above exactly matches TPC App's `package.json` (or is net-new and matches the "(latest)" marker in CLAUDE.md). The planner MUST NOT use `npm install <pkg>` without an explicit version — it'll pull latest and drift away from TPC App. Use `npm install <pkg>@<version>` or edit `package.json` first then run `npm install`.

**Installation** (single command after `npm init` / Vite scaffold):

```bash
# Scaffold (creates the Vite + React + TS baseline)
npm create vite@7.3.1 . -- --template react-ts

# Core runtime deps (match TPC App + dashboard-new additions)
npm install \
  react@^19.2.0 react-dom@^19.2.0 \
  react-router@^7.13.1 \
  @supabase/supabase-js@^2.101.1 \
  @tanstack/react-query@^5.99.2 \
  zustand@^5.0.11 \
  zod@^4.3.6

# Tailwind v4 via Vite plugin (NOT PostCSS)
npm install -D tailwindcss@^4.2.1 @tailwindcss/vite@^4.2.1

# Testing
npm install -D \
  vitest@^4.0.18 \
  @testing-library/react@^16.3.2 \
  @testing-library/user-event@^14.6.1 \
  @testing-library/jest-dom@^6.9.1 \
  jsdom@^28.1.0

# Linting (flat config, v9)
npm install -D \
  eslint@^9.39.1 \
  @eslint/js@^9.39.1 \
  eslint-plugin-react-hooks@^7.0.1 \
  eslint-plugin-react-refresh@^0.4.24 \
  typescript-eslint@^8.48.0 \
  globals@^16.5.0

# Supabase CLI (invoked via npx)
npm install -D supabase@^2.81.3

# TypeScript + Vite React plugin + types
npm install -D \
  typescript@~5.9.3 \
  @vitejs/plugin-react@^5.1.1 \
  @types/react@^19.2.7 \
  @types/react-dom@^19.2.3 \
  @types/node@^24.10.1

# Devtools (optional but recommended)
npm install -D @tanstack/react-query-devtools@^5.99.2
```

---

## Architecture Patterns

### Recommended Project Structure (mirror TPC App exactly)

```
tpc-dashboard/
├── .env.example                          # Template — checked in
├── .env.local                            # Actual secrets — gitignored
├── .gitignore
├── CLAUDE.md                             # Already present
├── README.md                             # Create in Phase 1
├── eslint.config.js                      # Flat config (v9)
├── index.html                            # Vite entry
├── package.json                          # Scripts match TPC App
├── tsconfig.json                         # Composite, references app + node
├── tsconfig.app.json                     # Main source
├── tsconfig.node.json                    # Vite config
├── vite.config.ts                        # Tailwind v4 plugin + vitest config
├── vercel.json                           # (add in Phase 1 for Vercel deploy)
├── public/                               # Static assets
├── src/
│   ├── main.tsx                          # Root: BrowserRouter + QueryClientProvider + auth init
│   ├── App.tsx                           # Route table (Routes/Route)
│   ├── index.css                         # Tailwind import + @theme block
│   ├── vite-env.d.ts                     # Vite types
│   ├── lib/
│   │   └── supabase.ts                   # Proxy-wrapped lazy client (copy from TPC App)
│   ├── db/
│   │   └── database.types.ts             # Generated by `npm run db:types`
│   ├── stores/
│   │   └── authStore.ts                  # Zustand auth state
│   ├── hooks/
│   │   └── (useUserRole, etc. — future)
│   ├── components/
│   │   └── ProtectedRoute.tsx            # Admin-only gate
│   ├── layouts/
│   │   └── DashboardLayout.tsx           # Sidebar + header shell
│   ├── pages/
│   │   ├── Login.tsx                     # /login
│   │   └── Dashboard.tsx                 # / (placeholder per UI-SPEC)
│   ├── services/                         # Empty in Phase 1
│   ├── utils/                            # Empty in Phase 1
│   └── tests/
│       ├── setup.ts                      # @testing-library/jest-dom import
│       ├── login-page.test.tsx
│       ├── protected-route.test.tsx
│       ├── auth-store.test.ts
│       └── supabase-client.test.ts
└── supabase/
    ├── config.toml                       # Generated by `npx supabase init` — keep minimal
    └── migrations/
        ├── 20260421000000_create_updated_at_trigger.sql
        ├── 20260421000001_create_departments.sql
        ├── 20260421000002_create_sales.sql
        ├── 20260421000003_create_sale_departments.sql
        ├── 20260421000004_create_scraper_runs.sql
        ├── 20260421000005_create_saved_reports.sql
        ├── 20260421000006_rls_helper_functions.sql  # is_admin() reusable
        ├── 20260421000007_rls_policies.sql          # All SELECT policies
        └── 20260421000008_seed_departments.sql      # Reference data
```

Timestamps use `YYYYMMDDHHMMSS` — same as TPC App. Start at `20260421000000` (today) and increment by 1 per migration. This guarantees ordering after TPC App's latest (`20260330000000`) so CLI applies them last. [VERIFIED: Supabase docs — migration history table keyed on timestamp]

### Pattern 1: Proxy-Wrapped Lazy Supabase Client

**What:** A single `supabase` export that's a Proxy over an uninstantiated `SupabaseClient`. The real client is created on first property access. This allows the module to be imported in test files without throwing when env vars are missing (tests mock `supabase` entirely).

**When to use:** Always — this is the established TPC App pattern, and all tests mock `supabase` at the module level.

**Example** (copy-paste from TPC App verbatim, replacing `Database` import):

```typescript
// src/lib/supabase.ts
// Source: TPC App src/lib/supabase.ts (local file) — HIGH confidence [VERIFIED: file read]
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

let _client: SupabaseClient<Database> | null = null;

export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    if (!_client) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not set. Add it to .env.local');
      }
      if (!supabaseAnonKey) {
        throw new Error('VITE_SUPABASE_ANON_KEY is not set. Add it to .env.local');
      }
      _client = createClient<Database>(supabaseUrl, supabaseAnonKey);
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
```

**Note:** `@supabase/supabase-js` defaults `persistSession: true` (localStorage) and `autoRefreshToken: true`. No custom config needed. [CITED: https://supabase.com/docs/reference/javascript/auth-onauthstatechange]

### Pattern 2: Zustand Auth Store with `onAuthStateChange`

**What:** A single Zustand store holds `{ session, user, profile, isAdmin, loading }`. A module-level `initialize()` call in `main.tsx` (before `createRoot`) subscribes to `supabase.auth.onAuthStateChange`, which fires `INITIAL_SESSION` on page load (rehydrating from localStorage) and then `SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED` as the session evolves. The `loading: true` initial state flips to `false` after the first event fires (guaranteed by supabase-js).

**When to use:** Always — this is the established TPC App pattern for auth state.

**Dashboard-specific extension:** After the first `INITIAL_SESSION` / `SIGNED_IN` event, fetch the `profiles` row and store `{ profile, isAdmin }` in the same store. TPC App keeps the profile lookup in a separate `useUserRole` hook; the dashboard can do either, but folding profile into `authStore` lets the admin check run once at app load instead of on every route transition.

**Example:**

```typescript
// src/stores/authStore.ts
// Extends TPC App's authStore.ts with profile loading.
// Source: TPC App src/stores/authStore.ts (local file) — HIGH confidence [VERIFIED: file read]
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  profileLoading: false,

  initialize: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        set({ session, user: session?.user ?? null, loading: false });

        if (session?.user) {
          set({ profileLoading: true });
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          set({
            profile: data ?? null,
            isAdmin: data?.role === 'admin',
            profileLoading: false,
          });
        } else {
          set({ profile: null, isAdmin: false, profileLoading: false });
        }
      }
    );
    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'local' });
  },
}));
```

### Pattern 3: Root Composition — Router + QueryClientProvider + Auth Init

**What:** `main.tsx` initializes auth (starts the onAuthStateChange subscription), creates a single module-level `QueryClient`, and wraps the app with `BrowserRouter` + `QueryClientProvider`.

**When to use:** Always — this is the TanStack Query v5 + React Router v7 canonical pattern.

**Key choices:**
- **Single `QueryClient` at module scope**, not per-render. A per-render QueryClient invalidates its cache on every rerender. [CITED: https://tanstack.com/query/v5/docs/framework/react/reference/QueryClientProvider]
- **`BrowserRouter` (declarative routing)**, not `createBrowserRouter` (data mode). The dashboard doesn't need loaders/actions in Phase 1; TPC App uses declarative routes, so match that pattern.
- **DevTools off in production.** `import.meta.env.DEV` guards the `<ReactQueryDevtools />` mount.

**Example:**

```typescript
// src/main.tsx
// Source: TPC App src/main.tsx (local file) + TanStack Query v5 docs — HIGH confidence
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import App from './App';
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,          // 1 minute — read-heavy dashboard
      refetchOnWindowFocus: false,   // dashboard data is cold; no need to refetch on tab focus
      retry: 1,
    },
  },
});

// Initialize auth listener before React renders (matches TPC App pattern)
const unsubscribe = useAuthStore.getState().initialize();
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribe());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
```

### Pattern 4: Single-Stage Admin-Only ProtectedRoute

**What:** Combines "authenticated check" + "admin check" into one component. TPC App splits these (`ProtectedRoute` + `AdminRouteGuard`) because specialists are legitimate users; the dashboard has one access level, so fold them together.

**When to use:** Every route in the dashboard except `/login`.

**Key race-condition handling (critical):**
- On page load: `loading === true` until `onAuthStateChange` fires `INITIAL_SESSION`.
- Then: `loading === false`, `session === null | Session`.
- If authenticated, `profileLoading === true` until the profile row fetch completes.
- Then: `profileLoading === false`, `profile === null | Profile`, `isAdmin === boolean`.
- The component MUST NOT render children while either `loading` or `profileLoading` is true, or the non-admin user will flash the protected page for ~200ms.

**Example:**

```typescript
// src/components/ProtectedRoute.tsx
// Extends TPC App's pattern with inline admin check.
// Source: TPC App src/components/ProtectedRoute.tsx + AdminRouteGuard.tsx [VERIFIED: files read]
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { AccessDenied } from './AccessDenied';

export function ProtectedRoute() {
  const { session, loading, profile, profileLoading, isAdmin } = useAuthStore();

  // Stage 1: session resolving
  if (loading) {
    return (
      <div
        data-testid="auth-loading"
        aria-label="Checking your session"
        className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  // Stage 2: not signed in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Stage 3: signed in, profile still loading (prevents flash)
  if (profileLoading || profile === null) {
    return (
      <div
        data-testid="profile-loading"
        aria-label="Checking your session"
        className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  // Stage 4: signed in, not admin → access denied (NOT a redirect; see note)
  if (!isAdmin) {
    return <AccessDenied />;
  }

  // Stage 5: signed-in admin — render nested routes
  return <Outlet />;
}
```

**Why `AccessDenied` is a render, not a redirect:** Per UI-SPEC, the non-admin user needs to see the "Access denied — you're signed in as {email}" message and a Sign Out button. Redirecting to `/login` would hide the explanation and leave them confused. TPC App's AdminRouteGuard redirects to `/` because specialists ARE allowed on `/` — that doesn't apply here.

### Pattern 5: Tailwind v4 via `@tailwindcss/vite`

**What:** Tailwind v4 uses a Vite plugin (not PostCSS) and declares theme tokens in CSS via `@theme`, not in `tailwind.config.js`. There's no `tailwind.config.js` file. [CITED: https://tailwindcss.com/blog/tailwindcss-v4]

**Setup:**

```typescript
// vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
  },
});
```

```css
/* src/index.css */
/* Source: TPC App src/index.css [VERIFIED] */
@import "tailwindcss";

@theme {
  --color-accent: #2563eb;        /* blue-600 — primary CTA, focus rings, active nav */
  --color-accent-hover: #1d4ed8;  /* blue-700 — CTA hover */
}
```

Per UI-SPEC, only `--color-accent` and `--color-accent-hover` are needed. Everything else uses Tailwind's default palette (`gray-*`, `red-*`, `white`).

### Anti-Patterns to Avoid

- **Installing `postcss`/`autoprefixer`.** Tailwind v4 doesn't use them. [CITED: tailwindcss.com/blog/tailwindcss-v4]
- **Creating `tailwind.config.js`.** Also v3 pattern. Use `@theme` in CSS.
- **Calling `createClient()` at module top-level.** Breaks tests that mock `supabase`. Use the Proxy pattern.
- **Using `react-router-dom`.** Wrong package. Use `react-router` (v7+ consolidated package name). TPC App uses `react-router`.
- **Creating a new `QueryClient` inside a component.** Cache gets destroyed on rerender. Module-level singleton is the only correct pattern for client-only React apps.
- **`ProtectedRoute` returning `<Outlet />` before checking `isAdmin`.** Non-admin will see protected content for 1 frame. Always wait for `profileLoading === false` AND `profile !== null` before gating on `isAdmin`.
- **Calling `supabase db pull` before writing dashboard migrations.** That command would pull TPC App's full schema into `supabase/migrations/<timestamp>_remote_schema.sql`, making the dashboard's migration history carry TPC App's tables. In Phase 1 we push only, never pull.
- **Storing JWT or profile data outside of Supabase's managed session.** Don't manually write to localStorage — supabase-js handles it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence across page reloads | Custom localStorage wrapper | `@supabase/supabase-js` built-in `persistSession: true` | Default behavior handles refresh, token expiry, cross-tab sync |
| Auth state synchronization | Custom event emitter / context | `supabase.auth.onAuthStateChange` + Zustand | Built-in, receives `INITIAL_SESSION` / `SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED` |
| Admin role check SQL inside policies | Inline `EXISTS (SELECT 1 FROM profiles ...)` in every policy | `SECURITY DEFINER` function in private schema (`private.is_admin()`) called as `(select private.is_admin())` | TPC App pattern. PostgreSQL caches the SELECT-wrapped function result per-statement, giving 100x+ perf on large tables. [CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv] |
| Migration timestamp generation | Ad-hoc filenames | `npx supabase migration new <name>` | CLI generates timestamp in the required `YYYYMMDDHHMMSS_name.sql` format |
| TypeScript types for DB schema | Hand-write interfaces | `npx supabase gen types --lang=typescript --schema public > src/db/database.types.ts` | Regenerates after every migration push; matches TPC App exactly |
| CSV-of-department-codes seeding | Hard-code in a JS script | Inline `INSERT INTO departments ...` in a migration | Migration is idempotent with `ON CONFLICT (code) DO NOTHING`; survives database restore |
| Financial rounding | `toFixed(2)` in JavaScript | `numeric(14,2)` columns + PostgreSQL aggregation | INFR-04 explicitly prohibits JS floats. Phase 1 provisions the columns; later phases MUST use SQL |
| Cross-browser auth refresh | Custom interval | `autoRefreshToken: true` (default) | supabase-js handles token refresh automatically |

**Key insight:** Phase 1 has zero custom infrastructure. Every mechanism has a library/default that TPC App has already validated in production. The planner's tasks are all "configure the defaults" or "copy-then-rename from TPC App."

---

## Common Pitfalls

### Pitfall 1: Flash-of-Protected-Content for Non-Admin Users

**What goes wrong:** Non-admin logs in, sees the dashboard shell + placeholder content for ~100–400ms, then the access-denied screen appears. Leaks the existence of protected content.

**Why it happens:** A naive ProtectedRoute checks `session !== null` before checking `isAdmin`. Between `SIGNED_IN` (session set) and the `profiles` fetch resolving (isAdmin computed), the gate lets them through.

**How to avoid:** The three-stage gate in Pattern 4 above — wait for `profileLoading === false` before rendering children. Render a spinner during stage 3.

**Warning signs:** In manual QA, logging in as a specialist shows the dashboard shell briefly before the access-denied screen. If you see any frame of the real dashboard, the gate is broken.

### Pitfall 2: `supabase db push` Against Shared Database Without `supabase link` Coordination

**What goes wrong:** The dashboard's Supabase CLI is linked to the same project as TPC App. Running `db push` is safe (only pushes new migrations — never drops). But running `db pull` would overwrite dashboard `migrations/` with TPC App's full schema. Running `db reset` would DROP ALL TABLES in the local database (safe if local, catastrophic if pointed at prod).

**Why it happens:** `supabase db reset` drops and recreates. On a shared remote it would destroy TPC App.

**How to avoid:**
- **Never run `supabase db reset --linked`** in Phase 1 (or ever, against the shared prod project).
- **Never run `supabase db pull`** in Phase 1.
- Use only `npx supabase db push` (applies new migrations) and `npx supabase gen types` (read-only schema introspection).
- Optionally run the migrations locally against a disposable Postgres (docker-compose) first to catch syntax errors before pushing to prod.

**Warning signs:** The `supabase/migrations/` folder suddenly contains a `<timestamp>_remote_schema.sql` file. Delete it; someone ran `db pull`.

[VERIFIED: https://supabase.com/docs/reference/cli/supabase-db-push — "skips migrations already applied"; db-pull/db-reset are separate commands with destructive behavior]

### Pitfall 3: `numeric(14,2)` Too Narrow for Largest Auction Totals

**What goes wrong:** `numeric(14,2)` holds up to 999,999,999,999.99 (12 digits + 2 decimals = $999 billion). Auction profiles contain estimate ranges like "$533,300-880,550" and revenue totals — all well below this. But aggregations across all 457 sales could conceivably sum to tens of billions; still safe.

**Risk:** If a column is reused for a running total or aggregate view, watch for overflow. Department-level individual columns are definitely fine (max observed on any single field is a few million).

**How to avoid:** Use `numeric(14,2)` for individual monetary fields (hammer, premium, insurance, referral fees, lot charges, net revenue, estimates, reserves). If Phase 2/3 introduces materialized sums across all 457 sales, bump those specific columns to `numeric(18,2)` (16 digits + 2 decimals = $10 quadrillion, overkill but safe).

**Reference:** `numeric(14,2)` = ±99,999,999,999.99. [CITED: postgresql.org/docs/current/datatype-numeric.html]

### Pitfall 4: Missing `role="alert"` on Login Errors

**What goes wrong:** Screen readers don't announce the error. UI-SPEC Accessibility Floor requires all error messages to have `role="alert"`. TPC App's Login.tsx has it; copy that attribute verbatim.

**How to avoid:** Every error `<p>` in Phase 1 gets `role="alert"` on the element directly — not on a parent `<div>`, not on a sibling. Writing tests with `screen.getByRole('alert')` enforces this.

### Pitfall 5: `tsconfig.app.json` Excludes `src/tests` but `@testing-library/jest-dom` Types Are Needed

**What goes wrong:** TPC App's tsconfig.app.json has `"exclude": ["src/tests"]`. That's fine — test files don't need to be in the compilation output. But `src/tests/setup.ts` does `import "@testing-library/jest-dom"` which adds type augmentation for matchers like `toBeInTheDocument()`. If the test file's types aren't included in any tsconfig, TypeScript flags `.toBeInTheDocument()` as unknown.

**How to avoid:** Add a separate `tsconfig.test.json` or let Vitest's own config drive test type resolution. TPC App runs tests fine via `vitest --run` because vitest resolves types from `node_modules/@testing-library/jest-dom/types/*.d.ts` automatically. Copy TPC App's setup verbatim; if type errors appear, add `/// <reference types="@testing-library/jest-dom" />` at the top of the test files.

### Pitfall 6: UI-SPEC Uses `profile.full_name` — Schema Has `display_name`

**What goes wrong:** TPC App's `profiles` table has `display_name text not null` (per `20260318000000_create_profiles.sql` read 2026-04-21). UI-SPEC copy says `Welcome, {profile.full_name}` — that column DOES NOT exist.

**How to avoid:** Treat UI-SPEC's `full_name` as a generic token meaning "the person's display label". In code, use `profile.display_name` with fallback to the email local-part:

```typescript
const displayName = profile?.display_name
  ?? user?.email?.split('@')[0]
  ?? 'User';
```

The planner MUST flag this in PLAN.md and either (a) update UI-SPEC to say `display_name`, or (b) add a code-level alias. Recommended: (b) — UI-SPEC is a semantic contract, not a column name contract.

### Pitfall 7: `react-router` vs `react-router-dom` Package Confusion

**What goes wrong:** Old React Router tutorials import from `react-router-dom`. v7 consolidated into `react-router` (the v6 `react-router-dom` package is deprecated).

**How to avoid:** TPC App uses `react-router` (verified in `src/App.tsx`, `src/main.tsx`, `src/pages/Login.tsx`). All imports are `from 'react-router'`. Match exactly.

### Pitfall 8: `persistSession` + Logout on Same Tab Doesn't Clear Other Tabs

**What goes wrong:** TPC App uses `supabase.auth.signOut({ scope: 'local' })`. That signs out the local tab but leaves other tabs signed in. Both apps are on the same Supabase origin, so this is shared behavior.

**How to avoid:** Match TPC App — use `{ scope: 'local' }`. Cross-tab sync on sign-out is not a Phase 1 requirement. Noted as a known behavior, not a bug.

### Pitfall 9: Seeding Departments in Phase 1 vs Phase 2

**What goes wrong:** Seeding 22 department codes in Phase 1 is correct (DATA-06 is a v1 requirement, but satisfied by migration-level seed). Phase 2 PDF parsing may encounter codes NOT in this list (CLAUDE.md doesn't list every possible code; PROJECT.md lists only "known" ones).

**How to avoid:** (a) Seed the 22 known codes in Phase 1 with `ON CONFLICT (code) DO NOTHING`. (b) In Phase 2, when the parser finds an unknown code, either error-out with a "new department discovered" message (strict mode) or auto-insert it with a placeholder display name (permissive mode). The decision belongs to Phase 2 research; Phase 1 just seeds what's known.

**Where display names come from:** PROJECT.md lists codes only. Research was unable to find authoritative long-form display names for all codes. Seed with `display_name = code` where unknown; a follow-on migration fixes names once identified.

### Pitfall 10: Vercel Env Vars Not Set Before First Deploy

**What goes wrong:** Vite ships a production bundle; env vars are baked in at build time. If `VITE_SUPABASE_URL` isn't set in Vercel's project settings when the first deploy runs, the build succeeds but the deployed app throws "VITE_SUPABASE_URL is not set" on every page load.

**How to avoid:** Before running `vercel` (or opening a PR that triggers preview deploy), set both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel's project settings. Use the same values as the TPC App project (confirm with: "are these the same Supabase project?" — yes, per CONTEXT.md).

---

## Code Examples

### Login page (matches UI-SPEC copy + TPC App Tailwind classes)

```typescript
// src/pages/Login.tsx
// Source: TPC App src/pages/Login.tsx + UI-SPEC copywriting contract [VERIFIED]
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message || 'Incorrect email or password. Try again.');
      setSubmitting(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900">
      <div className="w-full max-w-sm mx-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center">
          TPC Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 mb-8">
          Auction analytics for The Potomack Company
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input id="email" type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoFocus
              className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input id="password" type="password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full min-h-12 rounded-lg bg-accent text-white font-semibold mt-6 disabled:opacity-50">
            {submitting
              ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block" />
              : 'Sign In'
            }
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3 text-center">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
```

### Migration — helper function (admin check)

```sql
-- supabase/migrations/20260421000006_rls_helper_functions.sql
-- Source: TPC App supabase/migrations/20260318000004_helper_functions.sql [VERIFIED]
-- Private schema for internal helper functions (not exposed via PostgREST API)
create schema if not exists private;

-- Check if current user is an active admin
create or replace function private.is_admin()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active = true
  );
end;
$$;
```

Note: This migration is **idempotent with TPC App's identical function**. Both codebases define `private.is_admin()` identically. `create or replace` makes the second one a no-op. However, to avoid redefining a function another codebase owns, the planner should consider whether to:
- **Option A (recommended):** Include this migration in dashboard. It's `create schema if not exists` + `create or replace function` — both safe against existing objects. Keeps dashboard self-sufficient.
- **Option B:** Assume TPC App's function exists, don't include the migration. Risk: if someone restores the dashboard from scratch to a fresh DB, it breaks.

Choose Option A.

### Migration — sale table (representative)

```sql
-- supabase/migrations/20260421000002_create_sales.sql
-- Source: TPC App migration style [VERIFIED]
-- All monetary columns are numeric(14,2). Auction profile fields per REQUIREMENTS DATA-02/03.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,                        -- Business key
  title text not null,
  sale_date date,

  -- Lot counts
  lots_auctioned integer,
  lots_sold integer,
  lots_unsold integer,

  -- All-Departments totals (numeric for precision)
  total_sold_value numeric(14,2),
  total_unsold_value numeric(14,2),
  total_low_estimate numeric(14,2),
  total_high_estimate numeric(14,2),
  total_reserves numeric(14,2),

  -- Revenue waterfall (hammer → net)
  hammer_total numeric(14,2),
  buyer_premium numeric(14,2),
  seller_commission numeric(14,2),
  insurance numeric(14,2),
  lot_charges numeric(14,2),
  referral_fees numeric(14,2),
  net_revenue numeric(14,2),

  -- Counts
  registered_bidders integer,
  winning_buyers integer,

  -- Payment status (free text until Phase 2 parser defines exact shape)
  payment_status text,

  -- Source provenance
  source_pdf_path text,                                    -- Relative path to PDF in Supabase Storage or repo
  imported_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales enable row level security;

create index idx_sales_sale_date on public.sales (sale_date);
```

**Note to planner:** The column list above is a Phase 1 placeholder based on REQUIREMENTS DATA-02. Phase 2 research will verify the exact fields by reading actual PDF profiles and may add/rename columns. Phase 1 creates a "good enough" schema for the admin gate to exist; Phase 2 refines via follow-on migrations. The planner MAY choose to provision a narrower schema (just PK + sale_number + title + created_at) and let Phase 2 ALTER TABLE to add columns. Recommend the broader schema above because financial columns are known from REQUIREMENTS and adding columns with `numeric(14,2)` is cheap.

### Migration — RLS policies (admin-only reads, service-role writes)

```sql
-- supabase/migrations/20260421000007_rls_policies.sql
-- Source: TPC App RLS pattern [VERIFIED] — adapted to admin-only read model

-- Admins can read sales (all other reads blocked by default deny)
create policy "Admins can view sales"
  on public.sales for select
  to authenticated
  using ( (select private.is_admin()) );

-- Same pattern for sale_departments
create policy "Admins can view sale_departments"
  on public.sale_departments for select
  to authenticated
  using ( (select private.is_admin()) );

-- Departments: admins read
create policy "Admins can view departments"
  on public.departments for select
  to authenticated
  using ( (select private.is_admin()) );

-- Scraper runs: admins read
create policy "Admins can view scraper_runs"
  on public.scraper_runs for select
  to authenticated
  using ( (select private.is_admin()) );

-- Saved reports: admin owns their rows
create policy "Admins view own saved_reports"
  on public.saved_reports for select
  to authenticated
  using ( (select private.is_admin()) and user_id = (select auth.uid()) );

create policy "Admins insert own saved_reports"
  on public.saved_reports for insert
  to authenticated
  with check ( (select private.is_admin()) and user_id = (select auth.uid()) );

create policy "Admins update own saved_reports"
  on public.saved_reports for update
  to authenticated
  using ( (select private.is_admin()) and user_id = (select auth.uid()) );

create policy "Admins delete own saved_reports"
  on public.saved_reports for delete
  to authenticated
  using ( (select private.is_admin()) and user_id = (select auth.uid()) );

-- NOTE: No INSERT/UPDATE/DELETE policies on sales / sale_departments / scraper_runs.
-- With RLS enabled and no policy, authenticated users cannot write. Service role (used
-- by import scripts + scraper) bypasses RLS, so it can write. departments is also
-- service-role-only for writes.
```

### Vercel env var template

```bash
# .env.example — checked into git
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

```
# .env.local — gitignored, real values
VITE_SUPABASE_URL=<same as TPC App>
VITE_SUPABASE_ANON_KEY=<same as TPC App>
```

The `.gitignore` should include `.env` and `.env.local`. Match TPC App's `.gitignore` verbatim for consistency.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite, TS, npm ecosystem | ✓ | v25.8.1 | — |
| npm | Package installs | ✓ | 11.11.0 | — |
| Supabase CLI (via npx) | Migrations, type gen | ✓ | 2.93.0 | — |
| Supabase project (shared with TPC App) | Auth + DB | ✓ (assumed — CONTEXT.md decision) | — | — |
| Vercel account | Hosting | ✓ (assumed — TPC App deploys there) | — | — |
| Git | Version control | ✓ | — (repo already initialized) | — |

**All required dependencies are available.** No fallback strategies needed. Node v25 is newer than Vite 7 was tested against, but Vite 7 supports Node 20+ and has been verified with Node 22+; v25 should be fine. [ASSUMED] If Vite 7 surfaces a Node 25 compatibility warning during `npm run dev`, document and either pin to a supported Node version or upgrade to Vite 8.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom |
| Config file | `vite.config.ts` (test config under `test:` key — matches TPC App) |
| Quick run command | `npm test` (which is `vitest --run`) |
| Full suite command | `npm test` (same — there's only one suite) |
| Setup file | `src/tests/setup.ts` — imports `@testing-library/jest-dom` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INFR-01 | App deploys to Vercel | manual | visit deployed URL, confirm load | manual-only (no test can verify Vercel) |
| INFR-02 | Supabase client reads env vars and connects | unit | `npm test -- supabase-client` | ❌ Wave 0 (create `src/tests/supabase-client.test.ts`) |
| INFR-04 | Money columns are `numeric(14,2)` | schema | `npx supabase gen types` succeeds + generated type has `number \| null` for monetary cols | ❌ Wave 0 (add `src/tests/schema-shape.test.ts` that imports Database types and asserts column presence) |
| AUTH-01 | User can log in with TPC App credentials | integration (manual in Phase 1) | manual E2E: log in as info@ admin | manual verification via browser |
| AUTH-01 | `signInWithPassword` is called with entered email/password | unit | `npm test -- login-page` | ❌ Wave 0 (create `login-page.test.tsx` — port from TPC App) |
| AUTH-02 | Admin user lands on `/` dashboard after login | integration | `npm test -- protected-route` | ❌ Wave 0 (create `protected-route.test.tsx`) |
| AUTH-02 | `authStore` fetches profile and sets isAdmin when role='admin' | unit | `npm test -- auth-store` | ❌ Wave 0 (port from TPC App, extend) |
| AUTH-03 | Non-admin user sees access-denied screen | unit | `npm test -- protected-route` — non-admin assertion | ❌ Wave 0 (same test file, added case) |
| AUTH-04 | Unauthenticated user is redirected to `/login` | unit | `npm test -- protected-route` — unauth assertion | ❌ Wave 0 (same test file, added case) |
| AUTH-04 | RLS denies unauthenticated reads to `sales` | manual SQL | Supabase SQL editor: `set role anon; select * from sales;` returns 0 rows | manual verification (can be scripted later) |
| (AUTH-04 stronger) | Non-admin authenticated user cannot SELECT from `sales` | manual SQL | Supabase SQL editor as specialist user: `select * from sales;` returns 0 rows | manual verification |

### Sampling Rate

- **Per task commit:** `npm test` — full suite runs fast (<5s for Phase 1 with <10 test files)
- **Per wave merge:** `npm test && npm run lint && npm run build` — confirms lint-clean + TS-clean + production build succeeds
- **Phase gate:** Full suite green + manual login verification (admin + non-admin) + manual SQL RLS check before `/gsd-verify-work`

### Wave 0 Gaps

All tests listed above need to be CREATED. Phase 1 starts with zero tests (greenfield). Wave 0 tasks:

- [ ] `vitest` config in `vite.config.ts` (test block matches TPC App)
- [ ] `src/tests/setup.ts` — bare-minimum (just `@testing-library/jest-dom`, no MediaRecorder mocks)
- [ ] `src/tests/supabase-client.test.ts` — verifies env var errors, verifies Proxy-wrapped lazy init
- [ ] `src/tests/auth-store.test.ts` — port from TPC App, extend with profile loading + isAdmin assertions
- [ ] `src/tests/login-page.test.tsx` — port from TPC App, update title/subtitle strings per UI-SPEC
- [ ] `src/tests/protected-route.test.tsx` — 4 states: loading / unauth / non-admin / admin
- [ ] Framework install: `npm install -D vitest @testing-library/{react,user-event,jest-dom} jsdom` (listed in Standard Stack above)

### Nyquist Interpretation for Phase 1

Per `workflow.nyquist_validation: true` in `.planning/config.json`, every requirement must be sampled by automated tests AT LEAST every wave. Phase 1 is small enough that a single test wave (`src/tests/`) covers all auth/scaffold requirements. The schema-shape and RLS SQL checks are the only manual-verification gates, and both are documented above.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-router-dom` v6 | `react-router` v7 (consolidated package) | v7 release (2024-11) | Import from `'react-router'` not `'react-router-dom'`. TPC App already migrated. |
| Tailwind v3 + PostCSS + `tailwind.config.js` | Tailwind v4 + `@tailwindcss/vite` + `@theme` in CSS | v4 GA (2025-01) | No config JS file; theme tokens are CSS variables. TPC App already on v4. |
| TanStack Query v4 with `useQuery<TData, TError>` overloads | v5 with single-argument generic + object form | v5 (2023-10) | `useQuery({ queryKey, queryFn })` instead of `useQuery('key', fn)`. Phase 1 doesn't use it yet; Phase 3+ will. |
| Supabase `auth.user()` / `auth.session()` sync getters (v1 gotrue-js) | `auth.getSession()` async + `auth.onAuthStateChange` for updates (v2) | supabase-js v2 (2022) | TPC App already on v2. |
| Inline `EXISTS (select 1 from profiles...)` in every RLS policy | `(select private.is_admin())` SECURITY DEFINER function | Supabase RLS perf guide (2023) | 100x+ perf on large tables; TPC App already using. [CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv] |

**Deprecated / outdated:**

- `react-router-dom` package (use `react-router`)
- `tailwind.config.js` (use `@theme` in CSS)
- PostCSS + autoprefixer for Tailwind (v4 bundles its own)
- `@supabase/auth-helpers-*` packages (superseded by `@supabase/ssr` for SSR apps; pure-client SPAs like this one don't need either — plain supabase-js is enough)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `info` email account's `profiles.role === 'admin'` is already set in the shared Supabase DB | User Constraints — Access model | If not, the admin will be stuck at access-denied. **Mitigation:** include a one-time manual verification step in Phase 1 Wave 3 ("Log in as info@, confirm you land on /. If not, SQL: `update profiles set role='admin' where id=(select id from auth.users where email='info@...')`"). |
| A2 | Department display names are either equal to codes or unknown; seeding with `display_name = code` is acceptable | Pitfall 9 | Low — Phase 2 can fix via follow-on migration. |
| A3 | Node v25.8.1 is compatible with Vite 7.3.1 without warnings | Environment Availability | Low — Vite 7 supports Node 20+; v25 is newer but should work. If it doesn't, pin Node via `.nvmrc` to 22.x. |
| A4 | The `numeric(14,2)` ceiling ($999B per field) is sufficient for every individual monetary field in the auction profile | Pitfall 3 | Low — largest observed single value is <$100M. If Phase 2 adds running totals across all 457 sales, those aggregate columns may need `numeric(18,2)`. |
| A5 | TPC App will not change its schema in a way that breaks dashboard reads of `profiles` (e.g., renaming `role`) | Integration | Low-medium — if TPC App renames `role` to `user_role`, dashboard's `is_admin()` function breaks silently. **Mitigation:** type generation (`npm run db:types`) will catch the rename at build time. |
| A6 | `supabase gen types --schema public` will include both TPC App tables AND dashboard tables in the generated file | Type generation strategy | High confidence — this is documented behavior. TPC App tables will appear as read-only types in `database.types.ts`; that's acceptable (we can even remove unused tables with `--schema` flag, but mixing is simpler). |
| A7 | The planner will split Phase 1 into ~5–8 waves (scaffold / auth / migrations / RLS / tests / polish) rather than one monolithic plan | Planning guidance | If the planner makes Phase 1 a single plan, risk of cognitive overload. Not blocking — planner has final call. |
| A8 | AUTH-03 is satisfied by "specialists see access-denied screen" for v1 scope | phase_requirements table, AUTH-03 row | Medium — if stakeholder later challenges "specialists should see their own activity", that requirement becomes v2. **Mitigation:** planner should update REQUIREMENTS.md with a note on AUTH-03 that says "v1 implementation: specialists blocked at auth gate (single-admin model). Specialist view deferred to v2." |

---

## Open Questions

1. **Should the Supabase CLI be linked to the same project as TPC App?**
   - What we know: Same `VITE_SUPABASE_URL` = same project. `supabase link --project-ref <ref>` takes the ref from the URL.
   - What's unclear: If both repos are linked to the same project, `npx supabase migration list` shows the combined migration history, which is correct. But if the dashboard runs `supabase db pull` or `db reset --linked`, it could affect TPC App data.
   - Recommendation: Yes, link. Document the forbidden commands (`db pull`, `db reset --linked`) in the dashboard's README. Possibly add a shell-level guard: a `db:pull-blocked` script that prints an error. Phase 1 should not pull; only push.

2. **Should dashboard migrations live in a separate `public` schema, a new `dashboard` schema, or share `public` with TPC App?**
   - What we know: CONTEXT.md says "All tables use plain names — no `dash_` prefix. Collision check confirms none of these names are used."
   - What's unclear: Is CONTEXT.md implicitly requiring `public` schema, or is a `dashboard` schema acceptable?
   - Recommendation: Use `public` schema. Same schema = same type file = same supabase-js interface. Separate schema would require additional `createClient` schema config and separate type generation. CONTEXT.md's "no dash_ prefix" decision implies public/flat namespace is the intent.

3. **Should Phase 1 include a vercel.json?**
   - What we know: INFR-01 requires Vercel deploy. Vite apps on Vercel often don't need a `vercel.json` (Vercel auto-detects Vite).
   - Recommendation: Skip `vercel.json` unless Phase 1 needs custom routing/headers. Framework detection handles the rest. If later phases add API routes (e.g., Phase 10 scraper), add then.

4. **Does the dashboard's `authStore.initialize()` need to handle the TPC App being signed in in another tab?**
   - What we know: Supabase uses localStorage which is origin-scoped. TPC App and dashboard are DIFFERENT origins (e.g., `tpc-app.vercel.app` vs `tpc-dashboard.vercel.app`). Localstorage is NOT shared.
   - Recommendation: No special handling needed. If the user is on both apps, they sign in twice. That's fine for v1.

5. **Should the dashboard seed a second admin role or reuse TPC App's admin?**
   - What we know: CONTEXT.md says "Only the existing admin profile (the `info` email already present in the shared Supabase)".
   - Recommendation: Reuse existing. No new user creation in Phase 1.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email + password). Credential storage, password hashing, rate limiting handled by Supabase. No custom auth. |
| V3 Session Management | yes | supabase-js handles JWT issuance, refresh, and localStorage persistence. `signOut({ scope: 'local' })` clears the local tab. |
| V4 Access Control | yes | **Primary concern.** Two layers: (1) client-side `ProtectedRoute` for UX, (2) server-side RLS policies for security. Layer 2 is authoritative. |
| V5 Input Validation | yes (limited) | Login form: `type="email"` + `required` on inputs. Email format enforced by browser + Supabase. No other user input in Phase 1. |
| V6 Cryptography | no | No cryptography authored by app. Supabase + PostgreSQL handle all. |
| V7 Error Handling & Logging | yes (limited) | Login errors are displayed (generic message per UI-SPEC: "Incorrect email or password. Try again.") to avoid user enumeration. |
| V8 Data Protection | yes | No PII stored in dashboard schema directly — `profiles` is read-only. No special protection needed in Phase 1. |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | supabase-js uses PostgREST parameterized queries. Never build raw SQL in app code. |
| Broken access control (non-admin sees admin pages) | Elevation of Privilege | Three-stage ProtectedRoute gate PLUS RLS policies. Defense in depth. |
| Privilege escalation via client-side role spoofing | Elevation of Privilege | Client-side `isAdmin` is a UX hint only. RLS on the server is the enforcement. Even if user manipulates `localStorage.isAdmin`, they still can't read tables without an admin JWT. |
| Session fixation / CSRF | Tampering | Supabase JWTs are not cookie-based (localStorage + Authorization header), so CSRF is not applicable. |
| User enumeration via login errors | Information Disclosure | Generic error message: "Incorrect email or password." Don't differentiate "email not found" from "wrong password". |
| Leaked env vars in repo | Information Disclosure | `.env.local` in `.gitignore`. `VITE_*` prefix means the anon key DOES ship to clients (intentional — anon key is public, RLS is the actual control). |
| Open RLS (forgot to enable) | Elevation of Privilege | Every migration includes `alter table ... enable row level security;`. Tests should verify via `select relrowsecurity from pg_class where relname = 'sales';` returning `true`. |
| Outdated dependencies | Tampering | `npm audit` + Renovate/Dependabot (out of Phase 1 scope; add in later phase). |

**Key reminder:** The anon key (`VITE_SUPABASE_ANON_KEY`) is designed to be public. It identifies the Supabase project, but confers NO privileges — RLS policies decide what any given JWT can see. Exposing the anon key in the client bundle is correct and intended. The service role key (not used in Phase 1 frontend) is the only key that must stay secret.

---

## Sources

### Primary (HIGH confidence)

- **TPC App local codebase** (`C:/Users/maser/Projects/TPC_App/TPC_App/`) — read directly:
  - `package.json` — version pins verified against CLAUDE.md
  - `src/lib/supabase.ts` — Proxy-wrapped lazy client pattern
  - `src/stores/authStore.ts` — Zustand + onAuthStateChange pattern
  - `src/components/ProtectedRoute.tsx` — auth gate pattern
  - `src/components/AdminRouteGuard.tsx` — admin check pattern
  - `src/hooks/useUserRole.ts` — profile role fetch pattern
  - `src/main.tsx`, `src/App.tsx` — root composition pattern
  - `src/pages/Login.tsx` — UI reference
  - `src/index.css` — Tailwind v4 @theme pattern
  - `src/tests/*.ts[x]` — test patterns (Vitest + Testing Library)
  - `vite.config.ts`, `tsconfig.*.json`, `eslint.config.js` — tool configs
  - `supabase/migrations/20260318000000_create_profiles.sql` — profiles schema
  - `supabase/migrations/20260318000004_helper_functions.sql` — `private.is_admin()` function
  - `supabase/migrations/20260318000005_rls_policies.sql` — policy shape
  - `supabase/migrations/20260318000001_create_sessions.sql` — table + RLS + index pattern
  - `.env.example` — env var template
  - `.gitignore` — exclusion patterns

- **npm registry** (verified 2026-04-21 via `npm view`): confirmed latest versions of all dependencies

- **Official Supabase docs:**
  - [Supabase CLI — db push](https://supabase.com/docs/reference/cli/supabase-db-push) — confirms `db push` skips already-applied migrations, does NOT drop
  - [Supabase Auth — onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) — INITIAL_SESSION event, persistSession defaults
  - [Supabase RLS Performance Guide](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select function())` optimization pattern

- **Official PostgreSQL docs:**
  - [Numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html) — `numeric(p,s)` precision/scale semantics

- **Official Tailwind docs:**
  - [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — `@theme` + Vite plugin

- **Official TanStack Query docs:**
  - [QueryClientProvider reference](https://tanstack.com/query/v5/docs/framework/react/reference/QueryClientProvider)
  - [Query Invalidation guide](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation)

- **Official React Router docs:**
  - [React Router v7 Authentication](https://www.robinwieruch.de/react-router-authentication/) (MEDIUM — community but high-quality; consistent with official patterns)

### Secondary (MEDIUM confidence)

- [makerkit.dev — Supabase + TanStack Query](https://makerkit.dev/blog/saas/supabase-react-query) — updated for v5 + @supabase/ssr 0.5.x
- [Robin Wieruch — React Router 7 Private Routes](https://www.robinwieruch.de/react-router-private-routes/) — wrapper + Outlet patterns
- [Supabase CLI on GitHub](https://github.com/supabase/cli) — source of truth for migration behavior

### Tertiary (LOW confidence / community tutorials)

- Various Medium / DEV tutorials on React Router v7 — used only for cross-reference, not authoritative

---

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every version pin verified against `npm view` today; every pattern matches TPC App's working code
- Architecture: **HIGH** — entire architecture is "copy TPC App with minor extensions"; patterns are battle-tested in production
- RLS + migrations: **HIGH** — TPC App's patterns copied verbatim; PostgreSQL + Supabase semantics well-documented
- Migration coordination on shared DB: **MEDIUM** — `db push` is safe, but `db pull` / `db reset` are dangerous and the planner must document guardrails
- AUTH-03 interpretation: **LOW** — planner + stakeholder need to confirm "specialists see access-denied" satisfies the requirement. Assumption A8 flags this.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days) — stack is stable, unlikely to shift in a month

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md enforces:

1. **GSD workflow:** All file edits must be initiated via `/gsd:*` commands. Phase 1 execution MUST use `/gsd:execute-phase`.
2. **Tech stack is pinned:** React 19.2.0, TS 5.9.3, Vite 7.3.1, Tailwind 4.2.1, supabase-js 2.101.1, Zustand 5.0.11, Zod 4.3.6, React Router 7.13.1, ESLint 9.39.1, Vitest 4.0.18, Supabase CLI 2.81.3. Planner MUST NOT drift.
3. **Match TPC App:** "Design Principle: Match TPC App" — every pattern choice should align.
4. **Shared Supabase:** Dashboard must not interfere with existing TPC App tables. Reads only on `profiles`, `sessions`, `items`, `export_history`, `photos`.
5. **No separate user management:** Reuse TPC App's auth.
6. **Desktop-first:** Dashboard uses sidebar, not bottom tabs (INFR-03, reinforced in UI-SPEC).
7. **Financial precision:** PostgreSQL DECIMAL (`numeric(14,2)`), never JS floats (INFR-04).

The planner MUST verify no task violates any of the above. Every version install should match the pinned version. Every pattern should reference TPC App's equivalent.

---

**READY FOR PLANNING.**
