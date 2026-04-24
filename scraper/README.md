# tpc-dashboard-scraper

Sibling workspace to `src/`. Hosts the service-role Supabase admin client and (starting Phase 4) the Playwright-based RFC auction scraper.

## Why a separate workspace?

The dashboard frontend in `src/` ships to the browser via `npm run build`. Anything imported from `src/` that ends up in the bundle is readable by every end user. The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security — leaking it into the bundle would give every site visitor full admin access to the shared Supabase project.

We enforce non-leakage structurally:

1. **Physical separation.** This `scraper/` dir is NOT an npm workspace. It has its own `package.json`, its own `node_modules`, and its own `tsconfig.json`. The root build pipeline (`tsc -b && vite build`) does not traverse this directory.
2. **Env-var split.** `scraper/` reads `SUPABASE_SERVICE_ROLE_KEY` via `process.env` (never `import.meta.env`). The frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` via `import.meta.env` — the `VITE_` prefix is what Vite exposes to the bundle, and the service-role name is intentionally NOT prefixed.
3. **Grep guard.** The root `package.json` has a `prebuild` script that runs `node scripts/check-no-service-role-in-src.mjs`. It walks `src/` and fails the build if it finds the string `SUPABASE_SERVICE_ROLE_KEY` anywhere.
4. **One-way type imports.** `scraper/lib/supabase-admin.ts` imports from `../../src/db/database.types.ts` (dashboard → scraper direction is physically disallowed by the grep guard). If a future change tries to import `getAdminClient` from `src/`, it would appear as `../../scraper/lib/supabase-admin` — a red flag in code review.

## Setup (local dev)

```bash
cd scraper
npm install
cp .env.example .env
# Edit .env — paste your Supabase URL and service-role key.
```

Never commit `.env`.

## Admin client usage

```typescript
import { getAdminClient } from './lib/supabase-admin';

const admin = getAdminClient();
const { data, error } = await admin.from('analytics_events').select('*').limit(10);
```

The client is memoised. Calling `getAdminClient()` repeatedly returns the same instance.

## Phase roadmap

- Phase 1 (now): `lib/supabase-admin.ts` — the admin-client module.
- Phase 4: Dockerfile, Playwright runtime, Railway deploy.
