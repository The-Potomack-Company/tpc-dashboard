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

## Importing Auction Profile PDFs

Phase 2 delivers `scripts/import-pdfs.ts` — a local CLI that parses the 457 historical RFC
auction profile PDFs into the `sales` + `sale_departments` tables, cross-validates department
sums against sale totals, auto-discovers unknown department codes, and records every
invocation in `scraper_runs`.

### Prerequisites

1. **Service role key** — the importer bypasses RLS (bulk inserts require it). Copy
   `.env.example` to `.env.local` if you haven't already, then paste the **service_role**
   secret from Supabase dashboard → Project Settings → API:

   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-secret-here>
   ```

   The key is **not** `VITE_`-prefixed on purpose — that would leak it into the browser
   bundle. The importer reads it from `.env.local` at runtime only.

2. **PDF files** — the 457 auction profiles live at
   `$HOME/Projects/rfc_profiles/rfc_profiles/` by default. Override with `--source <dir>`
   if yours live elsewhere. PDFs are NOT committed to this repo (too large).

3. **Node 18+** — the CLI uses built-in `node:util` `parseArgs`. `npm install` already
   provides `tsx` for TypeScript execution.

### Commands

```bash
# Dry-run — parse + validate only, no DB writes. Safe first step.
npm run import:pdfs -- --dry-run --limit 10

# Full import — writes to the shared Supabase project. Live. ~5-15 minutes.
npm run import:pdfs

# Process only the first N PDFs (alphabetical by filename):
npm run import:pdfs -- --limit 50

# Extra per-file diagnostics (PDF page counts, parse timing, skip reasons):
npm run import:pdfs -- --verbose

# Custom source directory:
npm run import:pdfs -- --source /absolute/path/to/pdf/dir

# Widen cross-validation tolerance (default is ±$0.25):
npm run import:pdfs -- --cross-validation-tolerance 0.50

# Help:
npm run import:pdfs -- --help
```

Before any live write, the CLI prints a banner (source dir, target Supabase URL, file
count, mode) and waits **3 seconds** so you can Ctrl+C if it's pointed at the wrong
project. Dry-runs skip the delay.

### What happens during import

- Reads every `.PDF` under `--source` (sorted alphabetically for deterministic order).
- Parses page 1 as the "All Departments" sale summary, pages 2..N as per-department
  breakdowns.
- Cross-validates `SUM(dept.*)` against sale totals with a default tolerance of **±$0.25**
  (accounts for `numeric(14,2)` rounding across up to ~20 department rows). Mismatches
  set `sales.validation_warning = true` but do **not** fail the insert.
- Auto-discovers unknown department codes — any code not already in `departments` is
  inserted with `auto_discovered = true` and the display name parsed from the PDF footer.
- **Skips duplicates** — same `sale_number` not imported twice (DATA-07).
- **Skips empty placeholders** — 1182-byte files with no extractable text (RFC uses these
  for withdrawn/cancelled sales; ~62 of the 457 files are empty placeholders).
- Logs each invocation to `scraper_runs` with status, counts, duration, and per-file
  failure messages.

### Inspecting results

```sql
-- How many sales got flagged for manual review?
select count(*) from sales where validation_warning = true;

-- Which department codes were auto-discovered?
select code, display_name from departments where auto_discovered = true order by code;

-- Most recent import run:
select status, started_at, finished_at, sales_found, sales_imported, logs
from scraper_runs order by started_at desc limit 1;

-- Spot-check a specific sale's department breakdown vs its sale-level totals:
select s.sale_number, s.hammer_total, s.total_sold_value,
       (select sum(sd.hammer_price) from sale_departments sd where sd.sale_id = s.id) as dept_hammer_sum,
       (select sum(sd.total_sold_value) from sale_departments sd where sd.sale_id = s.id) as dept_sold_sum
from sales s where s.sale_number = 'IT0123';
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ERROR: SUPABASE_SERVICE_ROLE_KEY missing` | Copy `.env.example` → `.env.local`, paste the `service_role` key from Supabase dashboard. |
| `ERROR: could not read source directory` | Pass `--source <absolute-path>`. Default is `$HOME/Projects/rfc_profiles/rfc_profiles/`. |
| Specific PDF `failed` in the summary | Run with `--verbose` for the per-file error. Most failures are legitimately malformed PDFs; re-running will not retry them automatically. |
| Many `skipped: empty_placeholder` lines | Expected — ~62 of the 457 files are 1182-byte empty placeholders (withdrawn sales). They are correctly classified, not failures. |
| High `validation_warnings` count | Open flagged sales and confirm the drift is within the documented ±$0.25 rounding envelope. Widen tolerance with `--cross-validation-tolerance` only if drift is legitimate. |
| Re-running the importer | Safe. The unique constraint on `sales.sale_number` + the pre-insert dup check mean a second run inserts 0 and marks everything `skipped: duplicate` (DATA-07). |

### Security warning

- `SUPABASE_SERVICE_ROLE_KEY` **bypasses RLS**. Anyone who has it can read/write any
  table in the shared Supabase project (including TPC App data).
- Keep it **only** in `.env.local`. `.env.local` is git-ignored.
- **Never** commit `.env.local`. **Never** prefix the key with `VITE_` (Vite would inject
  it into the browser bundle, exposing it to every site visitor).
- If the key is ever pasted into chat, pushed to git, or logged to a terminal screenshare,
  **rotate it immediately**: Supabase dashboard → Project Settings → API → "Reset
  service_role secret".

## Phase history

- **Phase 1** — Foundation & Auth. Scaffold, schema, admin-only login, placeholder dashboard shell.
- **Phase 2** (current) — PDF import pipeline. Migrations, parser + Zod schemas, per-sale RPC with cross-validation + auto-discovery, CLI with scraper_runs lifecycle. Live 457-PDF run pending operator execution.
- Further phases: Sale Views, KPI, Trends, Department Analysis, Team Activity, Reporting, Custom Charts, RFC Scraper.
