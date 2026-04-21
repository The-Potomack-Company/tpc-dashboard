# TPC Dashboard

Analytics dashboard for The Potomack Company. Consolidates auction profile data,
TPC App operational data, and Cataloger Extension analytics into a single read-only view.

**Status:** Phase 1 (Foundation & Auth) — scaffold, schema, admin-only login, placeholder dashboard.

## Stack

- React 19 · TypeScript 5.9 · Vite 7 · Tailwind v4 · React Router 7
- Supabase (shared project with TPC App) · Zustand · TanStack Query v5 · Zod
- Vitest 4 · Testing Library · ESLint flat config (v9)

Full version pin table: see `CLAUDE.md`.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure env vars

Copy the template and fill in the values from the TPC App Supabase project (or ask the admin):

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Both values are the same as TPC App's. The anon key is public by design (RLS policies are the security boundary).

### 3. Link Supabase CLI (one-time)

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

Verify: `npx supabase migration list --linked` shows both TPC App and dashboard migrations.

### 4. Run

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build, outputs to dist/
npm run lint       # eslint .
npm test           # vitest --run
npm run preview    # serve dist/
```

Supabase scripts:

```bash
npm run db:push    # apply migrations in supabase/migrations/ to linked project
npm run db:types   # regenerate src/db/database.types.ts from live schema
```

## Access model

Phase 1 uses a **single-admin** access model:

- Only users with `profiles.role === 'admin'` AND `profiles.is_active = true` can reach the dashboard.
- Non-admin users (specialists) authenticate successfully, then see the **Access denied** screen with a Sign Out button.
- Unauthenticated users are redirected to `/login`.

Server-side RLS policies enforce the same rule regardless of the client. Dashboard-owned tables
(`sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`) can only be read
by the admin role; writes are service-role only.

## Project structure

```
src/
  components/   # ProtectedRoute, AccessDenied
  layouts/      # DashboardLayout (sidebar + header)
  pages/        # Login, Dashboard
  lib/          # supabase.ts (Proxy-wrapped lazy client)
  stores/       # authStore (Zustand)
  db/           # database.types.ts (generated)
  tests/        # Vitest + Testing Library tests
  hooks/ services/ utils/   # (empty in Phase 1; arrive in later phases)
supabase/
  config.toml
  migrations/   # 9 dashboard migrations starting at 20260421000000
```

## Forbidden Supabase CLI commands

The dashboard and the TPC App share the same Supabase project. The following commands would
damage TPC App data or overwrite dashboard migrations; **never run them** against the linked project:

- `supabase db pull`         ← overwrites `supabase/migrations/` with TPC App's schema
- `supabase db reset --linked` ← DROPS ALL tables including TPC App's

Only `supabase db push` and `supabase gen types` are safe against the shared prod project.

## Deploy to Vercel (INFR-01)

1. Push this repo to GitHub (if not already).
2. vercel.com → Add New → Project → import the repo.
3. Framework: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Project Settings → Environment Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   to all three environments (Production, Preview, Development). Values match your `.env.local`.
5. Click Deploy.
6. After deploy: visit the URL. `/login` should render. Log in with the admin account from the
   shared Supabase project.

## Phase history

- **Phase 1** (current) — Foundation & Auth. Scaffold, schema, admin-only login, placeholder dashboard shell.
- **Phase 2** (next) — PDF import pipeline (457 historical auction profiles → DB).
- Further phases: Sale Views, KPI, Trends, Department Analysis, Team Activity, Reporting, Custom Charts, RFC Scraper.
