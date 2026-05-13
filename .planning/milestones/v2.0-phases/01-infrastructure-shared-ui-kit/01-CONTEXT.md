# Phase 1: Infrastructure & Shared UI Kit - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Repair the v1.0 → v2.0 schema drift in `supabase/migrations/` against the linked shared Supabase project, land four shared UI primitives (`<DateRangeFilter>`, `<Sparkline>`, `<KpiCard>`, `<PayloadViewerModal>`) and two shared hooks (`useDateRange`, `useTimezone`) with Tailwind v4 styling, establish a service-role admin-client module and convention outside `src/` (scaffolding the `scraper/` workspace), and land an admin-only SELECT RLS policy on `public.analytics_events` by provisioning the table ourselves with the extension's documented schema.

Phase 1 does NOT ship any route-level feature (`/activity`, `/extension`, `/live`), does NOT install the scraper runtime or Playwright, and does NOT touch TPC App tables or extension write policies.

Covers requirements: **INFR-02, INFR-03, INFR-04, INFR-05, INFR-06**.

</domain>

<decisions>
## Implementation Decisions

### Schema Drift Repair (INFR-02)

- **D-01:** Reconciliation strategy is **reverted-row repair + drop migration**. For each v1.0 dashboard migration that exists in the linked project's `supabase_migrations.schema_migrations` table but not in local `supabase/migrations/`, run `supabase migration repair --status reverted <version>` to clear the row. Then ship a new dated migration `20260424xxxxxx_drop_retired_v1_tables.sql` with idempotent `drop table if exists <t> cascade;` statements.
- **D-02:** Drop migration scope is **dashboard-owned objects only**: `sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`, `import_runs`, plus any RPCs / views / functions v1.0 created for those tables. Does NOT drop TPC App tables (`profiles`, `sessions`, `items`, `photos`, `export_history`), shared helpers (`private.is_admin()`, `updated_at` trigger), or the to-be-provisioned `analytics_events`.
- **D-03:** Claude executes the `supabase migration repair --status reverted` commands during plan execution (not handed to a user runbook). Rationale: `migration repair` mutates only the tracking table, not schema objects, and is reversible by repairing back to `applied`. The actual destructive statements (`drop table`) live in a committed migration file that goes through code review before execution.
- **D-04:** Success proof is `supabase db push` returning clean + `supabase migration list --linked` showing identical local and remote columns. No fresh-project round-trip required.
- **D-05:** Before writing the drop migration, the plan runs a discovery step (`supabase migration list --linked` + a `pg_tables` / `pg_proc` query via the service-role admin client) to confirm the actual v1.0 remnant set in prod; the committed migration reflects what was observed, not only what was listed in D-02.

### Admin-Client Location (INFR-06)

- **D-06:** Service-role Supabase admin module lives at **`scraper/lib/supabase-admin.ts`**. Phase 1 scaffolds the `scraper/` sibling workspace (`scraper/package.json` + `scraper/lib/` + README). Phase 4 extends with actual scraper code and Dockerfile.
- **D-07:** Module shape for Phase 1 is a **typed stub with working exports**: `getAdminClient(): SupabaseClient<Database>` reads `SUPABASE_SERVICE_ROLE_KEY` from `process.env` (NOT `import.meta.env`), lazily constructs via `@supabase/supabase-js`, throws a clear error if the key is missing. Includes a README explaining the "never in frontend" rule.
- **D-08:** Phase 1 is the first consumer of the admin client — the migration discovery step (D-05) imports `getAdminClient` to query `pg_tables` / `pg_proc`. This validates the module end-to-end before Phase 4 depends on it.
- **D-09:** Enforcement is **CI/build grep + CLAUDE.md Conventions rule**. Add a `prebuild` npm script: `grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/ && exit 1 || exit 0`. Document the rule in CLAUDE.md's Conventions section. Phase 6 adds a matching post-build check against `dist/`.
- **D-10:** The `scraper/` workspace has its own `package.json` with `@supabase/supabase-js` as a dependency; it is NOT added to the root `package.json`. Root `package.json` stays frontend-only. `scraper/tsconfig.json` does not extend `src/tsconfig.app.json`. Types are shared via file imports (`scraper/lib/supabase-admin.ts` imports `../../src/db/database.types.ts`) — the one-way physical path makes a frontend leak visible.

### UI Kit & Demo Surface (INFR-03)

- **D-11:** Validation surface is a **dev-only `/kit` route** in the app, gated by `import.meta.env.DEV`, that renders every component with sample props. No Storybook. Behavior coverage via **Vitest + Testing Library**. `/kit` is stripped from production bundles by tree-shaking the `DEV`-guarded import.
- **D-12:** Sparkline **uses Recharts** (installed in Phase 1 — `recharts@^3.8.1` added to root `package.json`). Sparkline wraps `<LineChart>` configured with no axes, no grid, no tooltips by default, compact padding. Phases 2/3/5 reuse Recharts for bars/donuts/lines.
- **D-13:** `<KpiCard>` props: `{ label: string, value: string | number, delta?: { value: string | number, direction: 'up' | 'down' | 'flat', label?: string }, sparkline?: ReactNode, loading?: boolean }`. Built-in loading skeleton when `loading` is true. Matches APP-01 (KPI strip with prev-period deltas) and EXT-02 (KPI with sparkline slot).
- **D-14:** `<PayloadViewerModal>` ships at **minimal depth**: modal shell + close on Esc/backdrop, `<pre>` block with 2-space JSON pretty-print (`JSON.stringify(payload, null, 2)`), copy-to-clipboard button. No syntax highlighting, no tree viewer. Covers EXT-06 exactly; can be upgraded in v2.1 if payloads get deeply nested.
- **D-15:** `<DateRangeFilter>` is the only one of the four that has non-trivial internal UX — see Date-Range decisions below (D-16 through D-18) for its contract.

### Date-Range URL Contract & Timezone (INFR-04)

- **D-16:** URL serialization is **preset + optional dates**: `?range=today|7d|30d|custom`. When `range=custom`, append `&from=YYYY-MM-DD&to=YYYY-MM-DD` (ISO dates, no time component). When `range` is a preset, `from`/`to` are absent from the URL.
- **D-17:** Default range when no `range` param is present is **`7d`** (rolling last 7 days inclusive of today). Applied consistently across `/activity`, `/extension`, and between-sales `/live`.
- **D-18:** "Custom" UX is **segmented preset buttons + inline popover with two native `<input type="date">` fields**. Popover has Apply / Cancel buttons. Apply updates the URL; Cancel dismisses without change. No date-picker library dependency.
- **D-19:** `useTimezone` returns **formatter functions** hard-coded to `America/New_York` via `date-fns` + `date-fns-tz`. Shape: `{ formatDate(d): 'MMM d, yyyy', formatDateTime(d): 'MMM d, yyyy h:mm a ET', formatTime(d): 'h:mm a ET', formatRange(from, to): 'MMM d – MMM d, yyyy', nowET(): Date }`. No context provider, no switchable zone. If multi-TZ ever needed, it's a v2.1+ refactor.
- **D-20:** `useDateRange` returns `{ range: 'today'|'7d'|'30d'|'custom', from: Date, to: Date, setRange(next), setCustom(from, to) }`. Internally reads/writes URL via React Router's `useSearchParams`. `from`/`to` are always resolved to concrete `Date` objects in ET (via `useTimezone.nowET`), even when range is a preset — downstream consumers never have to resolve presets themselves.

### analytics_events Admin RLS (INFR-05)

- **D-21:** Phase 1 **creates `public.analytics_events` itself** with a `create table if not exists` migration. Rationale: the extension (TPC AI Cataloger) owns the table semantically but has not yet shipped its v2.0 migration; idempotent `create if not exists` + `alter ... add column if not exists` lets the extension's eventual migration run as a no-op.
- **D-22:** The created schema **mirrors the extension's documented v2.0 schema exactly** (same column types, constraints, indexes). Phase researcher reads `~/Projects/TPC_AI_Cataloger` planning docs / migration files to extract the canonical schema before this migration is written.
- **D-23:** Migration creates both RLS policies atomically: the admin-only SELECT policy (using `private.is_admin()`) and the anon INSERT policy (mirroring the extension's documented INSERT policy exactly). Grant: `grant insert on public.analytics_events to anon` and `grant select on public.analytics_events to authenticated`.
- **D-24:** Verification plan: (a) admin session can SELECT rows; (b) non-admin authenticated session gets zero rows; (c) anon session can INSERT a test row successfully; (d) admin can SELECT the just-inserted test row. Test rows are cleaned up at end of verification.

### v1.0 Component Retention

- **D-25:** **Keep v1.0 components as-is** in `src/components/` (`AccessDenied`, `BackLink`, `EmptyState`, `ErrorState`, `FilterInput`, `ProtectedRoute`, `SortIndicator`, `TableSkeleton`). No audit, no move, no refactor in Phase 1. Phases 2/3/5 import them opportunistically. Milestone cleanup (post-Phase 6) deletes any component not imported by shipped code.

### Claude's Discretion

- Exact Tailwind class choices for KpiCard / Sparkline / PayloadViewerModal visuals — aim for consistency with existing v1.0 components; no designer specs.
- The specific layout of the `/kit` demo route (grid of sections, one per component).
- Test depth beyond behavior contracts (e.g., snapshot tests, interaction tests for the custom-range popover).
- Migration filename timestamps (use monotonically-increasing `YYYYMMDDHHMMSS` format).
- Where the `prebuild` grep lives (inline in `package.json` script vs. a `scripts/check-no-service-role-in-src.sh` — leaning inline for simplicity).
- How the `scraper/` workspace is referenced from root (npm workspaces vs. independent directory with its own `node_modules`).
- Sparkline default point count, width, height, stroke color when not overridden.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current-milestone requirements
- `.planning/REQUIREMENTS.md` § v2.0 Requirements § Infrastructure & Cross-Cutting — INFR-02, INFR-03, INFR-04, INFR-05, INFR-06
- `.planning/ROADMAP.md` § Phase 1: Infrastructure & Shared UI Kit — phase goal, dependencies, success criteria
- `.planning/PROJECT.md` — v2.0 Live Ops scope, constraints, key decisions

### Project state & carryovers
- `.planning/STATE.md` § Accumulated Context § Decisions — v1.0 decisions still in force (forbidden CLI commands, migration shim pattern, admin-client key separation)
- `.planning/STATE.md` § Blockers/Concerns — Phase 1 v1.0 drift repair note, Phase 2 extension dependency note

### v1.0 forensics (read-only, for pattern reference)
- `.planning/milestones/v1.0-phases/01-foundation-auth/01-CONTEXT.md` — v1.0 Phase 1 decisions (stack, RLS pattern, Zustand auth store, migration conventions)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` § Pivot Note — why v1.0 closed, what carried forward
- `.planning/milestones/v1.0-phases/02-pdf-import-pipeline/02-CONTEXT.md` — v1.0 admin-client pattern (`scripts/lib/supabase-admin.ts`) that INFR-06 re-homes

### External repos (read for schema mirroring)
- `~/Projects/TPC_AI_Cataloger` — extension repo; read its v2.0 analytics pipeline migration and planning docs to extract the canonical `public.analytics_events` schema for D-22
- `~/TPC_App` — sibling app; read `src/lib/supabase.ts` and `supabase/migrations/` for the Supabase client lazy-init pattern and RLS policy shape INFR-05 mirrors

### Stack documentation
- `CLAUDE.md` § Technology Stack — version pins (React 19.2.0, TypeScript 5.9.3, Tailwind 4.2.1, Recharts 3.8.1, Supabase JS 2.101.1, date-fns, date-fns-tz)
- `CLAUDE.md` § GSD Workflow Enforcement — planning-artifact discipline for this repo

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/lib/supabase.ts`** — Anon `SupabaseClient<Database>` already set up with lazy init. INFR-05 RLS verification reads from this; `scraper/lib/supabase-admin.ts` (INFR-06) intentionally does NOT share code with this module — different clients, different env-var conventions.
- **`src/stores/authStore.ts`** — Zustand auth store with `{ session, profile, isAdmin }`. `/kit` demo route assumes the user is authenticated via `<ProtectedRoute>`.
- **`src/main.tsx`** — `QueryClientProvider` already wired at app root. Hooks that need caching (if any) plug in as-is.
- **`src/db/database.types.ts`** — Generated Supabase types. Extended by regenerating after INFR-05's `create table analytics_events` migration lands (`npm run db:types`).
- **`src/components/{EmptyState,ErrorState,FilterInput,SortIndicator,TableSkeleton,BackLink,AccessDenied,ProtectedRoute}.tsx`** — v1.0-era components. Per D-25, kept as-is, reused opportunistically by Phases 2/3/5.
- **`supabase/migrations/20260421000006_rls_helper_functions.sql`** — Existing `private.is_admin()` function. INFR-05's admin SELECT policy calls this.
- **`supabase/migrations/*_tpc_app_*.sql`** — TPC App shim migrations. Pattern: `DO NOT EDIT. DO NOT TREAT AS AUTHORITATIVE.` Source of truth is the TPC App repo. The INFR-02 drop migration follows the opposite pattern — it IS authoritative for dashboard-owned objects.

### Established Patterns

- **Migrations**: timestamped `YYYYMMDDHHMMSS_<name>.sql` files. Idempotent where possible (`create ... if not exists`, `create or replace function`). Never run `supabase db pull` or `supabase db reset --linked` against shared prod.
- **RLS policy shape**: `auth.uid() IS NOT NULL AND private.is_admin()`. Never inline a `SELECT 1 FROM profiles` — always call the helper.
- **Env vars**: frontend uses `VITE_*` prefix (exposed to bundle). Admin/scraper uses non-prefixed names (`SUPABASE_SERVICE_ROLE_KEY`) read via `process.env`, never `import.meta.env`.
- **Types**: regenerate `src/db/database.types.ts` via `npm run db:types` whenever migrations change table shapes. Commit the regenerated file.
- **Zustand**: stores live in `src/stores/`. Named hooks (`useAuthStore`). No Redux patterns.
- **TanStack Query**: module-level `QueryClient` in `src/main.tsx`. `staleTime: 60s`, `refetchOnWindowFocus: false`, `retry: 1`. Phase 1 does not add queries; Phase 2+ consume this provider.
- **Tailwind v4**: via `@tailwindcss/vite` plugin. No PostCSS config. Classes used directly in JSX; no `tw()` helper.
- **ESLint v9 flat config**: rules in `eslint.config.js`. If D-09 chooses the "lint rule" enforcement path (rejected in favor of grep), this is where it would land.

### Integration Points

- **Shared Supabase project**: same URL/anon key as TPC App (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`). Admin client (INFR-06) uses `SUPABASE_SERVICE_ROLE_KEY` only present in `scraper/.env` or Railway secret store — never committed, never in `VITE_*`.
- **`private.is_admin()` helper**: shipped in `20260421000006_rls_helper_functions.sql`. Every new RLS policy calls it. INFR-05's admin SELECT policy on `analytics_events` uses it verbatim.
- **Root `package.json` scripts**: current set is `dev / build / lint / test / preview / db:push / db:types`. Phase 1 adds `prebuild` (service-role grep guard — D-09) and possibly a dev script that starts both the frontend and a mock scraper if useful.
- **`scraper/` workspace**: new sibling dir created in Phase 1 (D-06). Has its own `package.json`, `tsconfig.json`, `lib/supabase-admin.ts`, and README. Phase 4 adds Dockerfile + scraper runtime code. Phase 6 audits `dist/` for scraper-only dependencies leaking into the frontend bundle.

</code_context>

<specifics>
## Specific Ideas

- **Follow v1.0 Phase 1's TPC-App-alignment philosophy**: when in doubt, match TPC App's patterns (see `~/TPC_App/src/` and `~/TPC_App/supabase/`). The dashboard is a sibling, not a fork.
- **Drop migration must be reversible-ish**: even though `drop table` is destructive, the migration file includes a commented "-- to restore: re-run original create" block with a pointer to `~/Projects/tpc-dashboard/.planning/milestones/v1.0-phases/` for the original CREATE statements. Not an automated rollback; just forensic breadcrumbs.
- **`scraper/` workspace layout**: think of it as a minimal monorepo sibling, not a Yarn/NPM workspace feature. Independent `node_modules`, independent `package.json`, shared only via relative file imports for types. Keeps Phase 1 free of workspace-management complexity.
- **`/kit` route is a dogfooding tool**: the `/kit` page renders each component in multiple states (normal, loading, empty, with-sparkline, etc.) so Phase 2 can eyeball integration before wiring charts. Accessible at `/kit` only in dev builds.
- **`analytics_events` schema mirror is brittle-on-purpose**: phase-researcher extracts the extension's exact column definitions. If the extension's schema later evolves (say a field rename), our migration becomes incorrect — treat this as a known coupling documented in D-22, not a bug to engineer around.

</specifics>

<deferred>
## Deferred Ideas

- **Storybook / visual regression testing** — rejected for Phase 1 (D-11). Revisit if the UI kit grows beyond ~6 components or multiple designers contribute.
- **Context-provided timezone** — rejected for Phase 1 (D-19). If the TPC team ever gains West-Coast staff or multi-TZ sales, revisit as v2.1+ refactor.
- **Dual-month calendar for custom-date UX** — rejected for Phase 1 (D-18). Native `<input type="date">` is sufficient for v2.0; upgrade if field research shows frequent custom-range usage.
- **PayloadViewer syntax highlighting / tree viewer** — rejected for Phase 1 (D-14). Ship minimal pretty-print; upgrade in v2.1+ if extension payloads grow deeply nested.
- **ESLint no-restricted-imports guard on `src/ → scraper/`** — rejected in favor of build grep (D-09). Revisit if a false-negative leaks slip through grep.
- **v1.0 component audit / prune / legacy move** — rejected for Phase 1 (D-25). Milestone-cleanup task post-Phase 6 prunes unreferenced v1.0 components.
- **Fresh-Supabase-project round-trip verification** — rejected for INFR-02 (D-04). Revisit if the simpler "db push returns clean" proof ever gives a false pass.
- **Staging Supabase project for Phase 1 dry-run** — rejected in favor of Claude-runs-repair-in-plan (D-03). If a later phase needs destructive DB work with higher reversibility risk, consider then.

</deferred>

---

*Phase: 01-infrastructure-shared-ui-kit*
*Context gathered: 2026-04-24*
