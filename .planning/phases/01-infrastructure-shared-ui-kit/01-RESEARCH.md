# Phase 1: Infrastructure & Shared UI Kit — Research

**Researched:** 2026-04-24
**Domain:** Cross-cutting foundation — schema-drift repair, shared UI primitives, URL-state hooks, RLS on `analytics_events`, service-role admin client
**Confidence:** HIGH (schema / existing code / CLAUDE.md pins) · MEDIUM (React Router 7 `useSearchParams` batching semantics) · HIGH (extension schema — verbatim from extension repo)

## Summary

Phase 1 is a foundation phase with five independent-but-co-landed deliverables. The research reduces ambiguity on all six critical foci: (1) the extension's `public.analytics_events` canonical schema was extracted verbatim from `~/Projects/TPC_AI_Cataloger/supabase/migrations/001_analytics_events.sql` (migration is live in the shared Supabase project since 2026-04-21, confirmed in its own VERIFICATION.md — migrations 002/003/004 are newer and NOT yet applied, so our `create if not exists` must mirror migration 001 exactly or we cause a conflict); (2) the drift-repair methodology is a three-step pipeline (enumerate remote-only rows via `supabase migration list --linked` + a `pg_tables` admin-client query, `supabase migration repair --status reverted <version>` per orphaned row, ship an idempotent drop migration); (3) the service-role admin-client module follows the exact v1.0 `scripts/lib/supabase-admin.ts` shape but re-homed to `scraper/lib/supabase-admin.ts` with its own `package.json` — no npm workspace, types imported by file path; (4) Recharts 3.8.1 sparkline = bare `<LineChart>` + `<Line>` wrapped in `<ResponsiveContainer>`, no axis/grid/tooltip components rendered; (5) `useDateRange` via React Router 7.13.1 `useSearchParams` with functional-updater awareness (known non-batched-stale quirk — must not double-call in the same tick); (6) the `create table if not exists` + `alter add column if not exists` pattern is genuinely idempotent against the extension's future 002/003/004 migrations as long as column names + types match.

**Primary recommendation:** Land Phase 1 as five tightly-scoped sub-plans (repair + drop migration, `analytics_events` migration, shared UI kit + `/kit` route, `useDateRange`/`useTimezone` hooks, `scraper/` workspace + admin client). Keep the `create table if not exists` body **byte-identical to the extension's migration 001** where feasible — this is the contract that makes the idempotent-handoff promise real.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema Drift Repair (INFR-02)**
- **D-01:** Reconciliation strategy is **reverted-row repair + drop migration**. For each v1.0 dashboard migration that exists in the linked project's `supabase_migrations.schema_migrations` table but not in local `supabase/migrations/`, run `supabase migration repair --status reverted <version>` to clear the row. Then ship a new dated migration `20260424xxxxxx_drop_retired_v1_tables.sql` with idempotent `drop table if exists <t> cascade;` statements.
- **D-02:** Drop migration scope is **dashboard-owned objects only**: `sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`, `import_runs`, plus any RPCs / views / functions v1.0 created for those tables. Does NOT drop TPC App tables (`profiles`, `sessions`, `items`, `photos`, `export_history`), shared helpers (`private.is_admin()`, `updated_at` trigger), or the to-be-provisioned `analytics_events`.
- **D-03:** Claude executes the `supabase migration repair --status reverted` commands during plan execution (not handed to a user runbook). Rationale: `migration repair` mutates only the tracking table, not schema objects, and is reversible by repairing back to `applied`. The actual destructive statements (`drop table`) live in a committed migration file that goes through code review before execution.
- **D-04:** Success proof is `supabase db push` returning clean + `supabase migration list --linked` showing identical local and remote columns. No fresh-project round-trip required.
- **D-05:** Before writing the drop migration, the plan runs a discovery step (`supabase migration list --linked` + a `pg_tables` / `pg_proc` query via the service-role admin client) to confirm the actual v1.0 remnant set in prod; the committed migration reflects what was observed, not only what was listed in D-02.

**Admin-Client Location (INFR-06)**
- **D-06:** Service-role Supabase admin module lives at **`scraper/lib/supabase-admin.ts`**. Phase 1 scaffolds the `scraper/` sibling workspace (`scraper/package.json` + `scraper/lib/` + README). Phase 4 extends with actual scraper code and Dockerfile.
- **D-07:** Module shape for Phase 1 is a **typed stub with working exports**: `getAdminClient(): SupabaseClient<Database>` reads `SUPABASE_SERVICE_ROLE_KEY` from `process.env` (NOT `import.meta.env`), lazily constructs via `@supabase/supabase-js`, throws a clear error if the key is missing. Includes a README explaining the "never in frontend" rule.
- **D-08:** Phase 1 is the first consumer of the admin client — the migration discovery step (D-05) imports `getAdminClient` to query `pg_tables` / `pg_proc`. This validates the module end-to-end before Phase 4 depends on it.
- **D-09:** Enforcement is **CI/build grep + CLAUDE.md Conventions rule**. Add a `prebuild` npm script: `grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/ && exit 1 || exit 0`. Document the rule in CLAUDE.md's Conventions section. Phase 6 adds a matching post-build check against `dist/`.
- **D-10:** The `scraper/` workspace has its own `package.json` with `@supabase/supabase-js` as a dependency; it is NOT added to the root `package.json`. Root `package.json` stays frontend-only. `scraper/tsconfig.json` does not extend `src/tsconfig.app.json`. Types are shared via file imports (`scraper/lib/supabase-admin.ts` imports `../../src/db/database.types.ts`) — the one-way physical path makes a frontend leak visible.

**UI Kit & Demo Surface (INFR-03)**
- **D-11:** Validation surface is a **dev-only `/kit` route** in the app, gated by `import.meta.env.DEV`, that renders every component with sample props. No Storybook. Behavior coverage via **Vitest + Testing Library**. `/kit` is stripped from production bundles by tree-shaking the `DEV`-guarded import.
- **D-12:** Sparkline **uses Recharts** (installed in Phase 1 — `recharts@^3.8.1` added to root `package.json`). Sparkline wraps `<LineChart>` configured with no axes, no grid, no tooltips by default, compact padding. Phases 2/3/5 reuse Recharts for bars/donuts/lines.
- **D-13:** `<KpiCard>` props: `{ label: string, value: string | number, delta?: { value: string | number, direction: 'up' | 'down' | 'flat', label?: string }, sparkline?: ReactNode, loading?: boolean }`. Built-in loading skeleton when `loading` is true. Matches APP-01 (KPI strip with prev-period deltas) and EXT-02 (KPI with sparkline slot).
- **D-14:** `<PayloadViewerModal>` ships at **minimal depth**: modal shell + close on Esc/backdrop, `<pre>` block with 2-space JSON pretty-print (`JSON.stringify(payload, null, 2)`), copy-to-clipboard button. No syntax highlighting, no tree viewer. Covers EXT-06 exactly; can be upgraded in v2.1 if payloads get deeply nested.
- **D-15:** `<DateRangeFilter>` is the only one of the four that has non-trivial internal UX — see Date-Range decisions below (D-16 through D-18) for its contract.

**Date-Range URL Contract & Timezone (INFR-04)**
- **D-16:** URL serialization is **preset + optional dates**: `?range=today|7d|30d|custom`. When `range=custom`, append `&from=YYYY-MM-DD&to=YYYY-MM-DD` (ISO dates, no time component). When `range` is a preset, `from`/`to` are absent from the URL.
- **D-17:** Default range when no `range` param is present is **`7d`** (rolling last 7 days inclusive of today). Applied consistently across `/activity`, `/extension`, and between-sales `/live`.
- **D-18:** "Custom" UX is **segmented preset buttons + inline popover with two native `<input type="date">` fields**. Popover has Apply / Cancel buttons. Apply updates the URL; Cancel dismisses without change. No date-picker library dependency.
- **D-19:** `useTimezone` returns **formatter functions** hard-coded to `America/New_York` via `date-fns` + `date-fns-tz`. Shape: `{ formatDate(d): 'MMM d, yyyy', formatDateTime(d): 'MMM d, yyyy h:mm a ET', formatTime(d): 'h:mm a ET', formatRange(from, to): 'MMM d – MMM d, yyyy', nowET(): Date }`. No context provider, no switchable zone. If multi-TZ ever needed, it's a v2.1+ refactor.
- **D-20:** `useDateRange` returns `{ range: 'today'|'7d'|'30d'|'custom', from: Date, to: Date, setRange(next), setCustom(from, to) }`. Internally reads/writes URL via React Router's `useSearchParams`. `from`/`to` are always resolved to concrete `Date` objects in ET (via `useTimezone.nowET`), even when range is a preset — downstream consumers never have to resolve presets themselves.

**analytics_events Admin RLS (INFR-05)**
- **D-21:** Phase 1 **creates `public.analytics_events` itself** with a `create table if not exists` migration. Rationale: the extension (TPC AI Cataloger) owns the table semantically but has not yet shipped its v2.0 migration; idempotent `create if not exists` + `alter ... add column if not exists` lets the extension's eventual migration run as a no-op.
- **D-22:** The created schema **mirrors the extension's documented v2.0 schema exactly** (same column types, constraints, indexes). Phase researcher reads `~/Projects/TPC_AI_Cataloger` planning docs / migration files to extract the canonical schema before this migration is written.
- **D-23:** Migration creates both RLS policies atomically: the admin-only SELECT policy (using `private.is_admin()`) and the anon INSERT policy (mirroring the extension's documented INSERT policy exactly). Grant: `grant insert on public.analytics_events to anon` and `grant select on public.analytics_events to authenticated`.
- **D-24:** Verification plan: (a) admin session can SELECT rows; (b) non-admin authenticated session gets zero rows; (c) anon session can INSERT a test row successfully; (d) admin can SELECT the just-inserted test row. Test rows are cleaned up at end of verification.

**v1.0 Component Retention**
- **D-25:** **Keep v1.0 components as-is** in `src/components/` (`AccessDenied`, `BackLink`, `EmptyState`, `ErrorState`, `FilterInput`, `ProtectedRoute`, `SortIndicator`, `TableSkeleton`). No audit, no move, no refactor in Phase 1. Phases 2/3/5 import them opportunistically. Milestone cleanup (post-Phase 6) deletes any component not imported by shipped code.

### Claude's Discretion
- Exact Tailwind class choices for KpiCard / Sparkline / PayloadViewerModal visuals — aim for consistency with existing v1.0 components; no designer specs.
- The specific layout of the `/kit` demo route (grid of sections, one per component).
- Test depth beyond behavior contracts (e.g., snapshot tests, interaction tests for the custom-range popover).
- Migration filename timestamps (use monotonically-increasing `YYYYMMDDHHMMSS` format).
- Where the `prebuild` grep lives (inline in `package.json` script vs. a `scripts/check-no-service-role-in-src.sh` — leaning inline for simplicity).
- How the `scraper/` workspace is referenced from root (npm workspaces vs. independent directory with its own `node_modules`).
- Sparkline default point count, width, height, stroke color when not overridden.

### Deferred Ideas (OUT OF SCOPE)
- **Storybook / visual regression testing** — rejected for Phase 1 (D-11).
- **Context-provided timezone** — rejected for Phase 1 (D-19).
- **Dual-month calendar for custom-date UX** — rejected for Phase 1 (D-18).
- **PayloadViewer syntax highlighting / tree viewer** — rejected for Phase 1 (D-14).
- **ESLint no-restricted-imports guard on `src/ → scraper/`** — rejected in favor of build grep (D-09).
- **v1.0 component audit / prune / legacy move** — rejected for Phase 1 (D-25).
- **Fresh-Supabase-project round-trip verification** — rejected for INFR-02 (D-04).
- **Staging Supabase project for Phase 1 dry-run** — rejected in favor of Claude-runs-repair-in-plan (D-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-02 | Repo `supabase/migrations/` reconciles with linked Supabase `schema_migrations` — no drift, no orphaned v1.0 tables, no migrations referencing dropped objects | § Schema Drift Repair Methodology; § Code Examples → drift-discovery SQL; `supabase migration repair --status reverted` syntax verified against Supabase CLI docs |
| INFR-03 | Shared UI-kit exports `<DateRangeFilter>`, `<Sparkline>`, `<KpiCard>`, `<PayloadViewerModal>` with typed props and Tailwind v4 styling | § UI Kit Component Contracts; § Code Examples → Sparkline minimal config, KpiCard prop shape, PayloadViewerModal skeleton; Recharts 3.8.1 verified via `npm view` |
| INFR-04 | Shared hooks `useDateRange` + `useTimezone` expose URL-state filter (Today / 7d / 30d / custom) + fixed Eastern-Time formatting via `date-fns` + `date-fns-tz` | § URL-State Hook Patterns; § Code Examples → `useDateRange` skeleton, `useTimezone` formatters, DST-aware `formatInTimeZone` usage; date-fns-tz 3.2.0 verified; React Router 7.14.2 available (repo pins 7.13.1) |
| INFR-05 | Admin-only SELECT RLS policy on `public.analytics_events`; extension's existing `anon INSERT` policy unchanged; `private.is_admin()` gates read | § Extension analytics_events Schema (verbatim from extension migration 001, live in shared project since 2026-04-21); § Code Examples → idempotent migration; § Verification Protocol for D-24 |
| INFR-06 | Service-role Supabase admin-client module placed outside `src/`, documented in repo | § Service-Role Admin-Client Module; § Code Examples → `getAdminClient` with `auth.persistSession:false` / `auth.autoRefreshToken:false`; § Windows-portable prebuild grep script |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted actionable directives. Planner MUST verify compliance:

| Directive | Source | Applies to |
|-----------|--------|-----------|
| Match TPC App versions exactly: React ^19.2.0, TypeScript ~5.9.3, Vite ^7.3.1, Tailwind ^4.2.1, Zustand ^5.0.11, Zod ^4.3.6, React Router ^7.13.1, ESLint ^9.39.1, Vitest ^4.0.18 | CLAUDE.md § Version Alignment | Any new dependency added in Phase 1 |
| `@supabase/supabase-js` ^2.101.1 (dashboard pinned) | CLAUDE.md § Version Alignment | Both root and `scraper/` package.json |
| Recharts ^3.8.1 (for charts) | CLAUDE.md § Charting | Phase 1 adds recharts to root — only pin to ^3.8.1, not latest |
| papaparse ^5.5.3 for CSV — NOT in Phase 1 scope | CLAUDE.md § CSV Export | Phase 5 (LIVE-10) — do not install in Phase 1 |
| Playwright ^1.59.1 — NOT in Phase 1 | CLAUDE.md § Scraping | Phase 4 adds it to `scraper/package.json` |
| pdf-parse — NOT in Phase 1 | CLAUDE.md § PDF Parsing | v1.0 concept; retired in v2.0 |
| Tailwind v4 via `@tailwindcss/vite` plugin, no PostCSS config, no `tw()` helper | CLAUDE.md § Conventions + existing `vite.config.ts` | `<Sparkline>`, `<KpiCard>`, `<DateRangeFilter>`, `<PayloadViewerModal>` |
| Migrations timestamped `YYYYMMDDHHMMSS_<name>.sql`, idempotent where possible, RLS calls `private.is_admin()` verbatim | CLAUDE.md + STATE.md § Decisions | Drop migration, analytics_events migration |
| Never run `supabase db pull` or `supabase db reset --linked` against shared prod | STATE.md § Decisions (v1.0 carryover) | Drift repair plan — only `supabase db push` + `supabase migration list --linked` |
| Frontend uses `VITE_*` prefix; admin/scraper uses non-prefixed names read via `process.env`, never `import.meta.env` | CLAUDE.md + STATE.md § Decisions | `scraper/lib/supabase-admin.ts` |
| GSD Workflow Enforcement: edits go through a GSD command | CLAUDE.md § GSD Workflow Enforcement | Plans execute within `/gsd:execute-phase` |

## Standard Stack

### Core (already installed, Phase 1 consumes)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| react | ^19.2.0 | UI | [VERIFIED: package.json line 18] |
| typescript | ~5.9.3 | Type safety | [VERIFIED: package.json line 43] |
| vite | ^7.3.1 | Build | [VERIFIED: package.json line 45] |
| @tailwindcss/vite | ^4.2.1 | Styling (v4 via plugin) | [VERIFIED: package.json line 26 + vite.config.ts line 3-7] |
| react-router | ^7.13.1 | Routing + `useSearchParams` | [VERIFIED: package.json line 20] |
| @supabase/supabase-js | ^2.101.1 | Supabase client | [VERIFIED: package.json line 16] |
| @tanstack/react-query | ^5.99.2 | Server state (used by `/kit` for auth gate only — no data fetching in Phase 1) | [VERIFIED: package.json line 17 + main.tsx line 12-20] |
| zustand | ^5.0.11 | Auth store | [VERIFIED: package.json line 22 + authStore.ts] |
| zod | ^4.3.6 | Schema validation (not exercised in Phase 1, available for D-07 env-var parse) | [VERIFIED: package.json line 21] |
| vitest | ^4.0.18 | Test runner (projects: src=jsdom, scripts=node) | [VERIFIED: package.json line 46 + vite.config.ts line 10-33] |
| @testing-library/react | ^16.3.2 | RTL for component behavior tests | [VERIFIED: package.json line 29] |
| @testing-library/user-event | ^14.6.1 | User interaction simulation | [VERIFIED: package.json line 30] |
| supabase (CLI) | ^2.81.3 | Migrations, type gen | [VERIFIED: package.json line 40] |
| tsx | ^4.21.0 | Run TS scripts (used by D-08 discovery step) | [VERIFIED: package.json line 42] |

### New additions required by Phase 1
| Library | Version | Purpose | Source | Confidence |
|---------|---------|---------|--------|------------|
| recharts | ^3.8.1 | Sparkline via `<LineChart>` | [VERIFIED: `npm view recharts version` returned `3.8.1`; CLAUDE.md pins this] | HIGH |
| date-fns | ^4.1.0 | Base date utilities | [VERIFIED: `npm view date-fns version` returned `4.1.0`; date-fns-tz 3.x peerDeps `^3.0.0 \|\| ^4.0.0`] | HIGH |
| date-fns-tz | ^3.2.0 | `formatInTimeZone`, `toZonedTime` for ET formatting | [VERIFIED: `npm view date-fns-tz version` returned `3.2.0`] | HIGH |

### Scraper workspace (sibling `scraper/package.json`)
| Library | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | ^2.101.1 | Service-role client (must match root pin to avoid two versions in a future monorepo view) |
| typescript | ~5.9.3 | Compilation / type-check for Phase 1 validation |
| tsx | ^4.21.0 | Run the discovery script for D-08 |
| @types/node | ^24.10.1 | `process.env` typing |

**No Playwright, pdf-parse, or runtime deps in Phase 1** — Phase 4 adds those. D-06 scopes `scraper/` in Phase 1 to the admin-client stub only.

### Alternatives Considered (rejected)
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| `recharts` sparkline | `react-sparklines` / `@visx/sparkline` | CLAUDE.md mandates Recharts for all charts [CITED: CLAUDE.md § Charting]; adding a second chart lib doubles bundle / mental model |
| `date-fns-tz` | Native `Intl.DateTimeFormat` with `timeZone: 'America/New_York'` | Works, but `date-fns` v4's time-zone support is still young; `date-fns-tz` 3.2.0 is the stable, battle-tested path. D-19 names it explicitly. |
| URL state | `nuqs` or `use-query-params` | Adds a dep for a ~40-line hook. React Router 7's `useSearchParams` covers every D-16/D-20 requirement. |
| `/kit` validation | Storybook | D-11 explicitly rejects Storybook. Dev-only route + Vitest/RTL is sufficient. |
| Admin-client via npm workspace | File-import types only | D-10 explicitly chooses file-import. Simpler; keeps root `package.json` frontend-only; one-way path makes leaks visible. |
| Prebuild via ESLint `no-restricted-imports` | `grep` script | D-09 explicitly chooses grep. Deferred Idea confirms this. |

**Installation commands:**
```bash
# Phase 1, root package.json
npm install recharts@^3.8.1 date-fns@^4.1.0 date-fns-tz@^3.2.0

# Phase 1, scraper/ — independent package.json; from scraper/ dir
cd scraper && npm install @supabase/supabase-js@^2.101.1
npm install --save-dev typescript@~5.9.3 tsx@^4.21.0 @types/node@^24.10.1
```

## Architecture Patterns

### Recommended Project Structure Additions

```
scraper/                           # NEW — sibling of src/, not a workspace
├── package.json                   # own deps; @supabase/supabase-js pinned to root
├── tsconfig.json                  # does NOT extend tsconfig.app.json (D-10)
├── README.md                      # "never in frontend" rule
├── .env.example                   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY stubs
└── lib/
    └── supabase-admin.ts          # getAdminClient() — the module

src/
├── components/
│   ├── kit/                       # NEW sub-dir for v2.0 shared UI
│   │   ├── DateRangeFilter.tsx
│   │   ├── Sparkline.tsx
│   │   ├── KpiCard.tsx
│   │   └── PayloadViewerModal.tsx
│   └── (existing v1.0 components kept as-is per D-25)
├── hooks/                         # EXISTS but empty (verified); Phase 1 populates
│   ├── useDateRange.ts
│   ├── useDateRange.test.ts
│   ├── useTimezone.ts
│   └── useTimezone.test.ts
├── pages/
│   └── Kit.tsx                    # NEW — dev-only /kit demo page
├── App.tsx                        # MODIFIED — conditional /kit route under DEV guard
└── tests/                         # existing — hook + component tests live alongside source

supabase/migrations/
├── (existing migrations untouched)
├── YYYYMMDDHHMMSS_drop_retired_v1_tables.sql   # NEW (INFR-02)
└── YYYYMMDDHHMMSS_create_analytics_events.sql  # NEW (INFR-05)

scripts/                          # NEW — local-only dev scripts (NOT scraper/)
└── discover-drift.ts              # D-05/D-08 — uses scraper/lib admin client
```

Rationale: `src/components/kit/` subfolder keeps v2.0 shared primitives visually separated from the v1.0 components that will be pruned post-Phase 6. The `scripts/` dir at repo root (previously deleted in the pivot per STATE.md) is re-introduced for dev-side orchestration only — NOT runtime code and NOT the admin-client home (that's `scraper/`).

### Pattern 1: Lazy, Memoised Supabase Client (service role)

**What:** Mirror the app's `src/lib/supabase.ts` Proxy-lazy pattern, re-typed for `process.env` + `auth.persistSession:false`.
**When to use:** Every server-side Supabase access from `scraper/` or `scripts/`.
**Example:** see [§ Code Examples → `scraper/lib/supabase-admin.ts`] below.

**Source:** Pattern adapted from `src/lib/supabase.ts` lines 1-25 (current repo) and `.planning/milestones/v1.0-phases/02-pdf-import-pipeline/02-CONTEXT.md` lines 30-31 (v1.0 precedent). Service-role flags from [CITED: Supabase JS v2 — `createClient` options, `auth.persistSession`, `auth.autoRefreshToken`].

### Pattern 2: Idempotent Cross-Repo Table Handoff

**What:** Use `create table if not exists` + `alter table ... add column if not exists` for tables co-owned by two repos with asymmetric release schedules.
**When to use:** Any table where repo A provisions but repo B logically owns the schema evolution.
**Contract:**
1. Repo A (dashboard) ships `create if not exists` mirroring repo B's current schema byte-for-byte.
2. Repo B (extension) ships its own migration with identical `create if not exists` + subsequent `alter add column if not exists` statements.
3. On linked project, both migrations apply without error. First-to-run creates; second-to-run is a no-op.
4. Only repo B owns column evolution (adding/renaming). Repo A freezes its copy.

**Proof it works:** PostgreSQL `CREATE TABLE IF NOT EXISTS` succeeds (no-op) when the table already exists with ANY schema — it does NOT verify column match [CITED: PostgreSQL docs, CREATE TABLE IF NOT EXISTS]. So if we race and extension's 001 lands first, our migration runs clean. If ours lands first, extension's 001 runs clean. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is similarly idempotent.

**Danger:** If the two `create` statements disagree on column types/defaults/NOT-NULL, whichever ran first wins and the other's migration completes with different in-DB state than the SQL suggests. Mitigation: byte-for-byte column definition match for shared columns.

### Pattern 3: URL-State Hook via React Router `useSearchParams`

**What:** Single source of truth = URL; hook reads+writes `?range=...&from=...&to=...`.
**When to use:** Any filter state that must survive refresh/back/forward and be deep-linkable.
**Gotcha:** React Router 7's `setSearchParams` functional-updater does NOT batch like `useState` — two synchronous calls both read the stale initial value [CITED: remix-run/react-router#9757 and #9950]. Hook implementation must combine all writes into one `setSearchParams` call per event.

### Anti-Patterns to Avoid

- **Reading `import.meta.env.SUPABASE_SERVICE_ROLE_KEY`** — Vite exposes `VITE_*` prefixed vars only [CITED: Vite docs — env variables]. Service role would be unset AND a leak risk. Always `process.env.SUPABASE_SERVICE_ROLE_KEY` in Node-only code.
- **Adding `anon SELECT` policy to `analytics_events`** — extension uses `Prefer: return=minimal` header precisely to avoid needing one [CITED: extension 29-RESEARCH.md line 295 — "Without this header, PostgREST performs a SELECT after INSERT"]. Adding one would let any user read raw events with the anon key.
- **`supabase db reset --linked` or `supabase db pull`** — forbidden against shared prod [STATE.md § Decisions, v1.0 carryover]. `migration repair` + `db push` is the only sanctioned path.
- **Calling `setSearchParams` twice in one event handler without merging** — stale params (see Pattern 3).
- **Relying on `new Date()` at module scope to define "today"** — `nowET()` must be called per-render/per-effect so DST transitions and midnight rollovers work correctly.
- **Storing Date objects in URL params** — dates serialize as `YYYY-MM-DD` (no time, no TZ); the hook re-parses them as "midnight ET" on read.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone conversion | Custom offset math / `getTimezoneOffset()` / string templates | `formatInTimeZone` from `date-fns-tz` | DST transitions (Mar/Nov in ET) silently break hand-rolled offset math; also, 2026 DST rules could shift and `date-fns-tz` uses the system tzdb |
| URL params reader/writer | `window.location.search` / `URLSearchParams` | React Router 7 `useSearchParams` | Needed for back/forward integration with Router history stack; direct `history.replaceState` desyncs the navigation API |
| Modal keyboard/backdrop handling | Custom `onKeyDown` + portal | HTML `<dialog>` OR a thin `onKeyDown={Escape}` + click-backdrop handler | D-14 allows minimal shell — use native `<dialog>` semantics or a ~30-line controlled modal; do not introduce `@headlessui/react` or `radix-ui` for one modal |
| JSON pretty-print | Custom recursive formatter | `JSON.stringify(payload, null, 2)` inside `<pre>` | Native, 2-space indent is the D-14 contract |
| Date range presets math | Custom duration add/subtract | `date-fns` `subDays`, `startOfDay`, `endOfDay` | Handles month boundaries, DST, leap years |
| Schema drift detection | Custom diff tool | `supabase migration list --linked` + `pg_tables` admin query | Supabase CLI already knows the schema_migrations table shape |
| Service-role client construction | Shared module with anon | Separate `scraper/lib/supabase-admin.ts` | Enforces the D-06/D-10 "never in frontend" boundary; grep guard relies on `SUPABASE_SERVICE_ROLE_KEY` never appearing in `src/` |
| Chart rendering | SVG by hand | Recharts `<LineChart>` + `<Line>` | Covers axis autoscaling, path smoothing, responsive resize |
| Copy-to-clipboard | `document.execCommand('copy')` (deprecated) | `navigator.clipboard.writeText(text)` | Modern browsers; TPC team is desktop-only Chrome per CLAUDE.md tone |

**Key insight:** Phase 1 is almost entirely about *configuration and integration* — the only hand-written logic of any complexity is `useDateRange`, the date/preset resolution, and the analytics_events migration. Everything else is composition.

## Runtime State Inventory

> Phase 1 is a repair + foundation phase. `supabase migration repair --status reverted` mutates the remote `supabase_migrations.schema_migrations` tracker table. This IS runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Remote `supabase_migrations.schema_migrations` table** contains rows for v1.0 dashboard migrations that no longer exist locally. Exact versions unknown until discovery (D-05). Pivot note confirms `sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`, `import_runs` + any associated migrations were dropped out-of-band [CITED: .planning/milestones/v1.0-MILESTONE-AUDIT.md lines 197-199]. | **`supabase migration repair --status reverted <version>`** per row, executed by Claude during Plan 1 (per D-03). |
| Stored data | **Actual tables/views/functions** in remote `public` schema left over from v1.0. Purged per the audit, but drop is "best belief" not verified. D-05 discovery queries `pg_tables` / `pg_proc` / `pg_views` to enumerate true state. | If any leftover is observed: include in the drop migration (D-05). If none: the drop migration contains pure `drop table if exists ... cascade` and is a safe no-op. |
| Stored data | **`public.analytics_events` rows** — live in prod since 2026-04-21 [CITED: extension 29-VERIFICATION.md line 69]. Extension sends events from real users. | Must NOT truncate or drop. INFR-05 migration uses `create table if not exists` so the live data is untouched. Admin SELECT policy goes on top of existing INSERT policy. |
| Live service config | None — extension configuration (Supabase URL, anon key) lives in the extension repo, not here. Dashboard's `.env.local` is per-developer, not remote config. | None. |
| OS-registered state | None — no Windows Task Scheduler / systemd / launchd / pm2 registration for Phase 1. Vercel / Railway cron not shipped yet (Phase 4/6). | None. |
| Secrets/env vars | **`SUPABASE_SERVICE_ROLE_KEY`** — new env var for `scraper/.env` that Phase 1 introduces but Phase 4 Railway deploy finalises. Phase 1 dev machine only. Added to `scraper/.env.example` but NOT `.env` / `.env.local`. | Document in `scraper/README.md`. Add `scraper/.env` to root `.gitignore` (verify not already) — the grep guard catches reads in `src/` but NOT commits of a `.env` file. |
| Secrets/env vars | **`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`** — existing, unchanged. | None — the dashboard already reads these [VERIFIED: src/lib/supabase.ts lines 13-14]. |
| Build artifacts / installed packages | None yet — Phase 1 adds `recharts`, `date-fns`, `date-fns-tz` to `node_modules` but these are fresh installs. `dist/` will be regenerated on next `npm run build`. | None. Running `npm install` picks up the new deps. |
| Build artifacts / installed packages | **`scraper/node_modules`** — doesn't exist yet. `cd scraper && npm install` bootstraps it. | Add `scraper/node_modules` to `.gitignore` if not covered by the root `node_modules` glob. |

**Critical non-obvious state:** The `supabase_migrations.schema_migrations` tracker table is live DB state that `migration repair` mutates. It is NOT captured in `supabase/migrations/` and is NOT in the types file. The drift is fundamentally "rows in this table without matching files on disk." Discovery + repair fixes the tracker; the drop migration then removes any actual leftover schema objects.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, scraper stub, vitest | assumed ✓ | — | — |
| npm | Deps install | assumed ✓ | — | — |
| `supabase` CLI (linked) | INFR-02 drift-repair flow | ✓ (installed as dev dep) | ^2.81.3 | — |
| Supabase project link (`supabase link`) | `supabase migration list --linked`, `supabase migration repair` | **Unverified — plan must check** | — | If unlinked, Plan 1 Task 1 runs `supabase link --project-ref <ref>` before anything else |
| `SUPABASE_SERVICE_ROLE_KEY` in `scraper/.env` | D-08 discovery step, D-24 verification | **Not yet set** | — | Plan Task asks operator to provide it once; script errors clearly if missing |
| Bash / grep / find (via Git Bash on Windows) | Prebuild `grep -rn` | ✓ (repo uses `bash` per env) | — | Provide PowerShell-portable alternative (§ Windows Portability below) |
| TPC App repo at `~/Projects/TPC_App` | Pattern reference only | ✓ | — | — |
| TPC AI Cataloger repo at `~/Projects/TPC_AI_Cataloger` | Schema extraction (INFR-05) | ✓ | migrations 001–004 present | Schema extracted in this research; no further reads needed at plan time |
| Network to Supabase prod | `supabase migration list --linked`, `db push`, admin SELECT | Required for verification | — | Without network: dry-run by reading local migrations + schema_migrations only via dump; plan assumes network available |

**Missing dependencies with no fallback:** None blocking — network + linked Supabase are standard dev requirements.

**Missing dependencies with fallback:** `SUPABASE_SERVICE_ROLE_KEY` — plan step captures it from operator the same way v1.0 Phase 2 did [CITED: v1.0 Phase 2 CONTEXT lines 30-31].

## Extension `analytics_events` Schema (verbatim)

**Source of truth:** `~/Projects/TPC_AI_Cataloger/supabase/migrations/001_analytics_events.sql` lines 1-84 [VERIFIED: read in full on 2026-04-24].

**Applied to shared Supabase project:** 2026-04-21 [CITED: extension 29-VERIFICATION.md line 69 — "User confirmed Supabase table + analytics_insert_anon policy live in Supabase dashboard (2026-04-21)"].

**Current live schema = migration 001 only.** Migrations 002 (`add started_at`), 003 (`catalog_item_rows`), 004 (`add ended_at`) exist in the extension repo but are dated 2026-04-24 and show NO evidence of being applied — they do not appear in the dashboard's generated `src/db/database.types.ts` (the `Row` type for `analytics_events` does not contain `started_at`, `ended_at`, `item_index`, `item_status`, nor the `catalog_item` CHECK option) [VERIFIED: src/db/database.types.ts lines 17-108]. The types were regenerated after the extension landed 001 but before 002-004.

### Canonical Column Set (from migration 001)

| # | Column | Type | Constraint | Notes |
|---|--------|------|-----------|-------|
| 1 | `id` | `uuid` | PRIMARY KEY DEFAULT `gen_random_uuid()` | Shared |
| 2 | `event_type` | `text` | NOT NULL, CHECK see below | Shared, enforced |
| 3 | `user_email` | `text` | nullable | Shared |
| 4 | `extension_version` | `text` | NOT NULL | Shared |
| 5 | `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | Shared |
| 6 | `error_message` | `text` | nullable | Shared |
| 7 | `receipt_number` | `text` | nullable | W1/W2/W4 |
| 8 | `category_id` | `text` | nullable | W1/W2 |
| 9 | `detection_method` | `text` | nullable | W1 |
| 10 | `photo_count` | `integer` | nullable | W1 |
| 11 | `generated_title` | `text` | nullable | W1 |
| 12 | `generated_description` | `text` | nullable | W1 |
| 13 | `field_mode` | `text` | nullable | W1/W2 |
| 14 | `field_selection` | `text` | nullable | W1/W2 |
| 15 | `session_id` | `uuid` | nullable | W2 |
| 16 | `total_items` | `integer` | nullable | W2/W3/W5 |
| 17 | `success_count` | `integer` | nullable | W2/W3/W5 |
| 18 | `skipped_count` | `integer` | nullable | W2/W3/W5 |
| 19 | `error_count` | `integer` | nullable | W2/W3/W5 |
| 20 | `execution_time_ms` | `integer` | nullable | W2/W3/W5 |
| 21 | `cancelled` | `boolean` | nullable | W2/W3 |
| 22 | `total_groups` | `integer` | nullable | W3 |
| 23 | `total_photos` | `integer` | nullable | W3 |
| 24 | `input_rows` | `integer` | nullable | W4 |
| 25 | `output_rows` | `integer` | nullable | W4 |
| 26 | `columns_mapped` | `integer` | nullable | W4 |
| 27 | `import_mode` | `text` | nullable | W5 |
| 28 | `items_content` | `jsonb` | nullable | Shared per-item content |

### Constraint: `event_type` CHECK (migration 001, lines 58-66)

```sql
ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_type_check
  CHECK (event_type IN (
    'catalog_single',
    'catalog_batch',
    'portal_upload',
    'spreadsheet_transform',
    'data_import'
  ));
```

**Note:** Migration 003 extends this to include `catalog_item`. Since 003 is NOT applied, Phase 1's migration must mirror 001's 5-value list exactly. When the extension later lands 003, its `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT` sequence drops our constraint and re-adds its own — idempotent hand-off works.

### RLS Policy (migration 001, lines 69-78)

```sql
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_insert_anon"
  ON public.analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Policy is already live** (2026-04-21). Our migration MUST:
- Use `create policy if not exists` OR guard with `DROP POLICY IF EXISTS "analytics_insert_anon" ON public.analytics_events; CREATE POLICY "analytics_insert_anon" ...` to be idempotent.
- PostgreSQL 17+ supports `CREATE POLICY IF NOT EXISTS`. Supabase is on Postgres 15 by default [VERIFIED: `database.types.ts` line 13: `PostgrestVersion: "14.4"` — PostgREST version, not Postgres. Supabase's default is 15.x as of 2026.]. **Use `DROP POLICY IF EXISTS` + `CREATE POLICY` to be safe on Postgres 15/16/17.**

### Index (migration 001, lines 81-83)

```sql
CREATE INDEX IF NOT EXISTS analytics_events_event_type_created_at_idx
  ON public.analytics_events (event_type, created_at DESC);
```

Already live. `CREATE INDEX IF NOT EXISTS` is idempotent.

### Migrations 002/003/004 — NOT APPLIED, but document for future-proofing

| Migration | Adds | Applied? | Our Phase 1 action |
|-----------|------|----------|---------------------|
| `002_add_started_at.sql` | `started_at timestamptz` nullable | **No** (confirmed via types file) | Don't add. When extension ships it, `ADD COLUMN IF NOT EXISTS` is no-op if we haven't added it. |
| `003_catalog_item_rows.sql` | `catalog_item` in CHECK enum; `item_index integer` nullable; `item_status text` nullable; `session_id` partial index | **No** | Don't add. Extension's migration is self-contained and idempotent. |
| `004_add_ended_at.sql` | `ended_at timestamptz` nullable | **No** | Don't add. |

**Flag for planner (ambiguity):** If the extension lands 002-004 BEFORE our Phase 1 ships, the live schema will have extra columns and an extended CHECK enum. Our `create table if not exists` is still safe (no-op on existing table), but our locally-generated `src/db/database.types.ts` from a post-plan `npm run db:types` will show the extension's new columns. This is fine — dashboard can ignore them. The planner should include a "regenerate types after migration" step (D-22 implicitly requires this).

### Verbatim SQL sketch for Phase 1 migration (`YYYYMMDDHHMMSS_create_analytics_events.sql`)

```sql
-- Phase 1 / INFR-05 — Provision analytics_events + admin SELECT RLS.
-- Mirrors TPC AI Cataloger extension migration 001 (applied to shared Supabase
-- project on 2026-04-21) so this file is a no-op on the live table and a
-- clean create against a fresh project. Extension-owned evolution (started_at,
-- ended_at, catalog_item rows) lands via future extension migrations using
-- `alter ... add column if not exists` — intentional forward-compat.

create table if not exists public.analytics_events (
  id                    uuid         primary key default gen_random_uuid(),
  event_type            text         not null,
  user_email            text,
  extension_version     text         not null,
  created_at            timestamptz  not null default now(),
  error_message         text,
  receipt_number        text,
  category_id           text,
  detection_method      text,
  photo_count           integer,
  generated_title       text,
  generated_description text,
  field_mode            text,
  field_selection       text,
  session_id            uuid,
  total_items           integer,
  success_count         integer,
  skipped_count         integer,
  error_count           integer,
  execution_time_ms     integer,
  cancelled             boolean,
  total_groups          integer,
  total_photos          integer,
  input_rows            integer,
  output_rows           integer,
  columns_mapped        integer,
  import_mode           text,
  items_content         jsonb
);

-- CHECK constraint — add only if not present (use a guarded ALTER).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'analytics_events_event_type_check'
      and conrelid = 'public.analytics_events'::regclass
  ) then
    alter table public.analytics_events
      add constraint analytics_events_event_type_check
      check (event_type in (
        'catalog_single',
        'catalog_batch',
        'portal_upload',
        'spreadsheet_transform',
        'data_import'
      ));
  end if;
end$$;

-- Enable RLS (idempotent).
alter table public.analytics_events enable row level security;

-- Anon INSERT — mirror extension's live policy exactly. Idempotent via drop+create.
drop policy if exists "analytics_insert_anon" on public.analytics_events;
create policy "analytics_insert_anon"
  on public.analytics_events
  for insert
  to anon
  with check (true);

-- Admin SELECT — NEW. Phase 1 INFR-05 target.
drop policy if exists "analytics_admin_select" on public.analytics_events;
create policy "analytics_admin_select"
  on public.analytics_events
  for select
  to authenticated
  using ( (select private.is_admin()) );

-- Grants (D-23). Supabase applies default grants but be explicit for forensics.
grant insert on public.analytics_events to anon;
grant select on public.analytics_events to authenticated;

-- Composite index (idempotent).
create index if not exists analytics_events_event_type_created_at_idx
  on public.analytics_events (event_type, created_at desc);
```

**Design choice — admin policy name:** I recommend `analytics_admin_select` (not `analytics_select_admin`) to match the `analytics_insert_anon` naming pattern (`{table}_{op}_{role}`). Planner discretion.

**Design choice — `(select private.is_admin())`:** The subquery wrapper is the TPC App pattern [CITED: TPC_App/supabase/migrations/20260318000005_rls_policies.sql lines 11-21]. It allows the planner to cache the function result per statement. Required by STATE.md carryover "RLS policy shape: `auth.uid() IS NOT NULL AND private.is_admin()`. Never inline a `SELECT 1 FROM profiles` — always call the helper."

## Schema Drift Discovery Methodology

### Step 1 — List remote-only migrations

```bash
# Assumes `supabase link --project-ref <ref>` already ran.
supabase migration list --linked
```

**Expected output shape** [CITED: Supabase CLI docs — migration-list]:

```
    Local          │      Remote         │      Time (UTC)
  ─────────────────┼─────────────────────┼───────────────────────
                   │ 20260401120000      │ 2026-04-01 12:00:00
  20260318000000   │ 20260318000000      │ 2026-03-18 00:00:00
  ...
```

Rows with a blank Local column = remote-only = candidates for `migration repair --status reverted`.
Rows with a blank Remote column = local-only = will be applied on next `db push` (fine).

**Parse strategy for the plan:** Use `--output json` (available in recent supabase-cli) if supported, else parse the text output with a defensive regex. Versions are 14-digit timestamps.

### Step 2 — Confirm actual schema objects leaked from v1.0

Executed via `scripts/discover-drift.ts` using `scraper/lib/supabase-admin.ts`:

```sql
-- Enumerate dashboard-owned tables still in public schema.
select tablename
from pg_tables
where schemaname = 'public'
  and tablename not in (
    -- TPC App tables (DO NOT drop)
    'profiles', 'sessions', 'items', 'photos', 'export_history',
    -- Extension table (DO NOT drop)
    'analytics_events'
  )
order by tablename;

-- Enumerate functions / RPCs in public schema (dashboard-owned candidates).
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname not in (
    -- Keep these (shared helpers the TPC App owns or both apps share)
    'handle_updated_at' -- example; verify by reading 20260421000000_create_updated_at_trigger.sql
  )
order by p.proname;

-- Enumerate views in public schema.
select viewname
from pg_views
where schemaname = 'public'
  and viewname not like 'pg_%'
order by viewname;

-- Enumerate non-TPC-App indexes (sanity check).
select tablename, indexname
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

**Known-safe TPC App object set** (from local TPC App migrations at `~/Projects/TPC_App/TPC_App/supabase/migrations/`):
- Tables: `profiles`, `sessions`, `items`, `photos`, `export_history`
- Functions: `handle_updated_at` (trigger func from `20260318000004_helper_functions.sql` — verify), plus `private.is_admin()`, `private.is_active_user()` (from local `20260421000006_rls_helper_functions.sql`)
- Indexes: any created in TPC App migrations

**Dashboard-owned candidates to drop** (from v1.0 REQUIREMENTS / CONTEXT / pivot note):
- Tables: `sales`, `sale_departments`, `departments`, `scraper_runs`, `saved_reports`, `import_runs`
- Functions / RPCs: any v1.0 created (e.g., atomic per-sale insert RPC from v1.0 Phase 2). Discover via `pg_proc` query above.
- Views: none known, but query confirms.

### Step 3 — `migration repair --status reverted`

**Verified syntax** [CITED: Supabase CLI reference — `supabase-migration-repair`]:

```bash
supabase migration repair --status reverted <version>
```

- `<version>` is the 14-digit timestamp string (no leading `/`, no suffix).
- `--dry-run` shows changes without applying [CITED: Supabase CLI reference].
- Semantics: marking `reverted` **deletes the row** from the remote `schema_migrations` tracker [CITED: Supabase CLI migration-repair docs — "Marking as reverted will delete an existing record"].
- Reversible: re-run with `--status applied` to re-insert.

**Example sequence Claude will run (subject to D-05 discovery):**

```bash
# Hypothetical v1.0 versions found in remote but not local:
supabase migration repair --status reverted 20260401120000
supabase migration repair --status reverted 20260402090000
# ... one per orphan ...
```

### Step 4 — Drop migration

File: `supabase/migrations/20260424xxxxxx_drop_retired_v1_tables.sql`

```sql
-- Phase 1 / INFR-02 — Drop v1.0 dashboard-owned objects retired in the
-- 2026-04-24 pivot. Idempotent: drops only what's present. Does NOT touch
-- TPC App tables or the extension's analytics_events.
--
-- To restore: original CREATE statements live in .planning/milestones/
-- v1.0-phases/ (see specifically 01-foundation-auth and 02-pdf-import-pipeline
-- CONTEXT files). This is forensic breadcrumbs, not an automated rollback.

-- Tables (scope = D-02 + D-05 discovery output).
drop table if exists public.import_runs cascade;
drop table if exists public.scraper_runs cascade;
drop table if exists public.saved_reports cascade;
drop table if exists public.sale_departments cascade;
drop table if exists public.sales cascade;
drop table if exists public.departments cascade;

-- Functions / RPCs discovered in Step 2 (example names — replace with actual
-- names from pg_proc output at plan execution time).
-- drop function if exists public.<v1_function_name>() cascade;
```

### Step 5 — Verify clean state

```bash
# Must return "up to date" with no pending migrations in either direction.
supabase migration list --linked

# Must apply clean with no errors.
supabase db push

# Regenerate types to reflect dropped tables removed from database.types.ts.
npm run db:types
```

## Service-Role Admin-Client Module

### Target shape (D-07): `scraper/lib/supabase-admin.ts`

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/db/database.types';

// Lazy, memoised service-role SupabaseClient. Intentionally NOT Proxy-lazy
// like src/lib/supabase.ts — the one place this is called (Node scripts and
// Phase 4 scraper) always reads env at process start, so eager read is fine.
// Keeping it explicit makes the "throw on missing key" path cover real Node
// environments where process.env is populated before any import.

let _client: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL is not set. Add it to scraper/.env (copy from scraper/.env.example).'
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to scraper/.env. ' +
      'Get the key from Supabase Dashboard > Settings > API > service_role. ' +
      'NEVER commit this key and NEVER expose it in the frontend.'
    );
  }

  _client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}
```

**Why those `auth` options:** The service role is a static key, not a user session. With `persistSession: true` (default) the SDK would try to write session to `localStorage` (not present in Node) [CITED: Supabase JS auth-js reference — `persistSession`]. With `autoRefreshToken: true` (default) the SDK schedules a token refresh timer that keeps the Node process alive after the task completes [CITED: supabase-js issues documenting the unhandled-timer pattern]. Both are disabled for server-side service-role clients.

**Env var naming:** `SUPABASE_URL` (not `VITE_SUPABASE_URL`) for scraper-side. The scraper conceptually *is* a separate app that happens to talk to the same project. Using the unprefixed name makes D-09's grep rule `SUPABASE_SERVICE_ROLE_KEY` cleaner — no `VITE_` prefix ambiguity. **Open question:** should `SUPABASE_URL` also be disallowed in `src/`? Low-risk (URL is public) — not required by INFR-06 but a nice-to-have follow-up.

### `scraper/package.json` (D-10)

```json
{
  "name": "tpc-dashboard-scraper",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Server-side Supabase admin client + (Phase 4) RFC scraper. NEVER imported by src/.",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.101.1"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "tsx": "^4.21.0",
    "typescript": "~5.9.3"
  }
}
```

### `scraper/tsconfig.json` (D-10)

Must NOT extend `../tsconfig.app.json` (which sets `types: ["vite/client"]` and browser libs). Must be able to resolve the file-path import to `../src/db/database.types.ts`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "lib/**/*.ts",
    "../src/db/database.types.ts"
  ]
}
```

Note the `include` lists the dashboard types file explicitly — this is the one-way physical coupling D-10 wants. If someone ever imports the admin client from `src/`, they have to import from `../../scraper/lib/supabase-admin.ts`, which stands out in code review.

### Prebuild grep (D-09) — Windows-portable variant

**Problem:** Windows `cmd.exe` doesn't ship `grep`. Git Bash does, but some devs may `npm run build` from PowerShell or `cmd`.

**Option A (recommended — uses Node, truly cross-platform):** Inline Node script in `package.json`.

```json
{
  "scripts": {
    "prebuild": "node -e \"const fs=require('fs'),path=require('path');let hit=false;function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(/\\.(ts|tsx|js|jsx)$/.test(f.name)){if(fs.readFileSync(p,'utf8').includes('SUPABASE_SERVICE_ROLE_KEY')){console.error('Forbidden reference to SUPABASE_SERVICE_ROLE_KEY in',p);hit=true;}}}}walk('src');process.exit(hit?1:0);\""
  }
}
```

**Option B (shorter, relies on repo running under Git Bash):**

```json
{
  "scripts": {
    "prebuild": "if grep -rln 'SUPABASE_SERVICE_ROLE_KEY' src/ ; then echo 'FATAL: SUPABASE_SERVICE_ROLE_KEY found in src/' >&2; exit 1; else exit 0; fi"
  }
}
```

The `grep -l` returns exit 1 when no matches — but combined with `if ... ; then ... else ... fi` inverts this. Git Bash treats this fine. Windows `cmd.exe` fails at `if`.

**Option C (dedicated script file):** `scripts/check-no-service-role-in-src.mjs`:

```javascript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';

const TARGET = 'SUPABASE_SERVICE_ROLE_KEY';
const EXTS = /\.(ts|tsx|js|jsx|cjs|mjs)$/;
let hits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(p);
    } else if (EXTS.test(entry)) {
      const contents = readFileSync(p, 'utf8');
      if (contents.includes(TARGET)) {
        console.error(`FATAL: '${TARGET}' must not appear in src/. Found in: ${p}`);
        hits++;
      }
    }
  }
}

walk('src');
exit(hits > 0 ? 1 : 0);
```

Then `"prebuild": "node scripts/check-no-service-role-in-src.mjs"`.

**Recommendation:** Option C. Trades one extra file for a diff-reviewable, testable, cross-platform guard. Aligns with "Claude's Discretion" on the grep location (D-09 allows both inline and script-file forms).

## UI Kit Component Contracts

### `<Sparkline>` — Recharts 3.8.1 minimal config

**Minimum props:** `data: Array<{ x: string | number; y: number }>`, plus optional `width`, `height`, `stroke`, `className`.

**Rendering:**
```tsx
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: Array<{ x: string | number; y: number }>;
  width?: number | string;
  height?: number;
  stroke?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = '100%',
  height = 32,
  stroke = 'currentColor',
  className,
}: SparklineProps) {
  return (
    <div className={className} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Source-verified facts:**
- `<LineChart>` + `<Line>` without `<XAxis>`, `<YAxis>`, `<CartesianGrid>`, `<Tooltip>` renders a bare path [CITED: Recharts GitHub + Chakra UI sparkline reference using recharts].
- `<ResponsiveContainer>` is the D-12 "compact padding" enabler — it responds to the parent `div`'s dimensions and eliminates hard-coded pixel math. [CITED: Recharts ResponsiveContainer guide.]
- `isAnimationActive={false}` matters for sparklines in KPI cards that mount / unmount rapidly during filter changes — default animations cause flicker. [CITED: Recharts docs — `<Line>` props.]
- Recharts 3.0 migration note: `<Tooltip>`'s `cursor` default changed from a solid line to a dashed one [CITED: Recharts 3.0 migration guide, github.com/recharts/recharts/wiki/3.0-migration-guide]. Not relevant here — sparkline has no tooltip.

**Default dimensions (D-72 discretion):** `height={32}`, `width='100%'`. KPI cards at ~200px wide give ~200×32 sparklines — reasonable density.

### `<KpiCard>` — prop shape (D-13 verbatim)

```tsx
interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: string | number;
    direction: 'up' | 'down' | 'flat';
    label?: string;
  };
  sparkline?: React.ReactNode;
  loading?: boolean;
}
```

**Behavior contract:**
- `loading={true}` renders a skeleton (Tailwind `animate-pulse` div with `bg-gray-200 dark:bg-gray-700`).
- Delta direction drives color: `up` = green, `down` = red, `flat` = gray. Semantic mapping (up=good vs up=bad) is *caller's* responsibility — KpiCard is presentational.
- `sparkline` slot accepts `<Sparkline>` but is structurally `ReactNode` — keeps KpiCard decoupled from Recharts.
- No date-range awareness inside KpiCard — parent computes `value`, `delta`, `sparkline` data from its own hook.

### `<PayloadViewerModal>` — D-14 minimal

```tsx
interface PayloadViewerModalProps {
  payload: unknown;
  open: boolean;
  onClose: () => void;
  title?: string; // optional; default "Payload"
}
```

**Implementation contract (per D-14):**
- Native HTML `<dialog>` element opens via `dialog.showModal()` in an effect when `open` flips true.
- Close triggers: `Escape` key (native `<dialog>` handles this), backdrop click (custom handler), close button.
- Body: `<pre>{JSON.stringify(payload, null, 2)}</pre>` in a scrollable container (Tailwind `max-h-[70vh] overflow-auto font-mono text-xs`).
- Copy button: `navigator.clipboard.writeText(JSON.stringify(payload, null, 2))` with a 2-second "Copied!" affordance.
- NO syntax highlighting, NO tree viewer, NO collapse/expand.

### `<DateRangeFilter>` — D-18 segmented + popover

```tsx
interface DateRangeFilterProps {
  // Presentational — reads from useDateRange inside the component, not
  // a controlled prop. Keeps callers from needing to wire the URL manually.
  className?: string;
}
```

**UX contract:**
- Segmented preset buttons: `Today | 7d | 30d | Custom`. Active preset highlighted.
- Click "Custom": opens a popover below the button group.
- Popover content: two `<input type="date">` fields labelled "From" / "To", plus "Apply" and "Cancel" buttons.
- Popover state is local to the component (`useState`) — only Apply writes to the URL.
- Cancel closes the popover without change.
- Close on backdrop click or Escape (use `<dialog>` or a controlled div + `useEffect` listener).

**Vitest + RTL test patterns:**

```tsx
// Pattern from @testing-library/user-event docs (available in dep list).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

test('clicking a preset updates the URL', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/activity']}>
      <DateRangeFilter />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: /30d/i }));
  // Assert URL via useSearchParams test helper, or render a ?range echoer inside the test.
});

test('custom popover applies two dates', async () => {
  const user = userEvent.setup();
  render(<WithRouter><DateRangeFilter /></WithRouter>);
  await user.click(screen.getByRole('button', { name: /custom/i }));
  const fromInput = screen.getByLabelText(/from/i);
  const toInput = screen.getByLabelText(/to/i);
  await user.type(fromInput, '2026-04-01');
  await user.type(toInput, '2026-04-15');
  await user.click(screen.getByRole('button', { name: /apply/i }));
  // assert URL is ?range=custom&from=2026-04-01&to=2026-04-15
});
```

### `/kit` dev-only route — tree-shaking guarantee

**Pattern to verify production stripping:**

```tsx
// App.tsx
import { Routes, Route, Navigate } from 'react-router';
// ...existing imports

// Dev-only lazy import. `import.meta.env.DEV` is replaced with `false` at
// build time by Vite; the dynamic import's callback becomes dead code and
// the Kit page chunk is never emitted. Verified by grep on dist/.
const KitPage = import.meta.env.DEV
  ? (await import('./pages/Kit')).KitPage
  : null;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomePage />} />
          {KitPage && <Route path="/kit" element={<KitPage />} />}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

**Gotcha:** Top-level `await import(...)` requires `target: ES2022` (satisfied by `tsconfig.app.json` line 4) and `module: ESNext`. Check that the output preserves tree-shaking of the dynamic import's unreachable branch.

**Build-size verification recipe:**

```bash
npm run build
# Production bundle must NOT contain "KitPage" or "kit" path literal.
grep -r 'KitPage' dist/ && echo 'LEAK: KitPage in production bundle' && exit 1
grep -r '"/kit"' dist/ && echo 'LEAK: /kit route in production bundle' && exit 1
echo 'OK: /kit stripped from production bundle'
```

**Alternative if top-level await isn't supported by the target:** move the guard to component mount time and use `React.lazy` — but `React.lazy` does not tree-shake when called conditionally (the import() reference is always present in the chunk graph). The top-level await pattern is the cleaner solution.

## URL-State Hook Patterns

### `useDateRange` skeleton (D-20)

```typescript
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { subDays, startOfDay, endOfDay, parse, isValid } from 'date-fns';
import { useTimezone } from './useTimezone';

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRangeValue {
  range: DateRangePreset;
  from: Date;
  to: Date;
  setRange: (next: Exclude<DateRangePreset, 'custom'>) => void;
  setCustom: (from: Date, to: Date) => void;
}

function isPreset(v: string | null): v is DateRangePreset {
  return v === 'today' || v === '7d' || v === '30d' || v === 'custom';
}

function parseISODate(v: string | null): Date | null {
  if (!v) return null;
  const d = parse(v, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
}

export function useDateRange(): DateRangeValue {
  const [params, setParams] = useSearchParams();
  const { nowET } = useTimezone();

  const rawRange = params.get('range');
  const range: DateRangePreset = isPreset(rawRange) ? rawRange : '7d'; // D-17 default

  const { from, to } = useMemo(() => {
    const now = nowET();
    if (range === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    if (range === '7d') {
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }; // inclusive
    }
    if (range === '30d') {
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    }
    // custom
    const parsedFrom = parseISODate(params.get('from'));
    const parsedTo = parseISODate(params.get('to'));
    if (parsedFrom && parsedTo) {
      return { from: startOfDay(parsedFrom), to: endOfDay(parsedTo) };
    }
    // Invalid custom → fall back to 7d
    return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  }, [range, params, nowET]);

  const setRange = useCallback(
    (next: Exclude<DateRangePreset, 'custom'>) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          copy.set('range', next);
          copy.delete('from');
          copy.delete('to');
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const setCustom = useCallback(
    (f: Date, t: Date) => {
      // Batch all three writes into a single setParams call (Pattern 3 gotcha).
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          copy.set('range', 'custom');
          copy.set('from', formatISODate(f));
          copy.set('to', formatISODate(t));
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { range, from, to, setRange, setCustom };
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

**Key decisions reflected:**
- Single source of truth = URL (D-20). Local state is derived only.
- `replace: false` so back/forward cycles through filter changes (UX-correct: treating filter changes as navigations matches user mental model of URL sharing).
- Functional updater `(prev) => ...` is used but NEVER called twice in one tick — all three writes collapse into one closure body (addresses React Router batching quirk [CITED: remix-run/react-router#9757]).
- Invalid `?range` or invalid custom dates fall back to default without throwing (resilient to bookmark rot).

**Test patterns:**

```tsx
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { useDateRange } from './useDateRange';

function wrapper({ children, initial }: { children: React.ReactNode; initial: string }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes><Route path="*" element={children} /></Routes>
    </MemoryRouter>
  );
}

test('defaults to 7d when no range param', () => {
  const { result } = renderHook(() => useDateRange(), {
    wrapper: (p) => wrapper({ ...p, initial: '/' }),
  });
  expect(result.current.range).toBe('7d');
});

test('setRange updates URL and clears from/to', () => {
  const { result } = renderHook(() => useDateRange(), {
    wrapper: (p) => wrapper({ ...p, initial: '/?range=custom&from=2026-04-01&to=2026-04-15' }),
  });
  act(() => result.current.setRange('30d'));
  // Assert URL. Requires a custom useSearchParams echo helper inside the renderHook wrapper.
});

test('custom range parses ISO dates correctly', () => {
  const { result } = renderHook(() => useDateRange(), {
    wrapper: (p) => wrapper({ ...p, initial: '/?range=custom&from=2026-04-01&to=2026-04-15' }),
  });
  expect(result.current.range).toBe('custom');
  expect(result.current.from.toISOString().slice(0, 10)).toBe('2026-04-01');
});

test('back button restores previous range', () => {
  // Use userEvent + programmatic history navigation or memory router entry list.
});
```

### `useTimezone` skeleton (D-19)

```typescript
import { useMemo } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const ET = 'America/New_York';

export interface TimezoneApi {
  formatDate: (d: Date) => string;        // 'MMM d, yyyy'       → "Apr 24, 2026"
  formatDateTime: (d: Date) => string;    // 'MMM d, yyyy h:mm a ET' → "Apr 24, 2026 3:47 PM ET"
  formatTime: (d: Date) => string;        // 'h:mm a ET'         → "3:47 PM ET"
  formatRange: (from: Date, to: Date) => string; // 'MMM d – MMM d, yyyy'
  nowET: () => Date;
}

export function useTimezone(): TimezoneApi {
  return useMemo<TimezoneApi>(
    () => ({
      formatDate: (d) => formatInTimeZone(d, ET, 'MMM d, yyyy'),
      formatDateTime: (d) => formatInTimeZone(d, ET, "MMM d, yyyy h:mm a 'ET'"),
      formatTime: (d) => formatInTimeZone(d, ET, "h:mm a 'ET'"),
      formatRange: (from, to) =>
        formatInTimeZone(from, ET, 'MMM d') +
        ' – ' +
        formatInTimeZone(to, ET, 'MMM d, yyyy'),
      nowET: () => toZonedTime(new Date(), ET),
    }),
    [],
  );
}
```

**Source-verified facts:**
- `formatInTimeZone(date, 'America/New_York', fmt)` correctly computes the DST offset for the *given date*, not the current system date [CITED: date-fns-tz README].
- In format strings, single quotes around `ET` escape it as a literal — `"h:mm a 'ET'"` outputs `3:47 PM ET` not `3:47 PM GMT-04:00T`.
- `toZonedTime(d, 'America/New_York')` returns a Date whose local clock reads ET time. **CAREFUL:** this Date's `toISOString()` misleads (it shows the ET clock time labelled as UTC). For `nowET()`'s use case (a "current moment in ET" value passed to `date-fns` date-manipulation functions like `subDays`, `startOfDay`), this is the right shape: the Date arithmetic treats the ET clock as the source-of-truth.

**Known pitfall:** DST transition days in ET (March spring-forward, November fall-back). `startOfDay(toZonedTime(..., 'America/New_York'))` correctly produces ET midnight, but if that midnight is the "spring forward" jump it may not exist — `date-fns-tz` handles this by snapping to the next valid instant [CITED: date-fns-tz GitHub issue tracker — DST handling]. Mitigation: add at least one winter (e.g., 2026-01-15) and one summer (e.g., 2026-07-15) test date in `useTimezone.test.ts` to guard against regressions.

**Bundle weight:** date-fns-tz 3.2.0 with selective imports (`formatInTimeZone`, `toZonedTime`) is ~6KB min+gzip [CITED: bundlephobia.com date-fns-tz v3.2.0]. date-fns v4 selective imports add ~3KB for `format`, `subDays`, `startOfDay`, `endOfDay`, `parse`, `isValid`. Total added weight ~10KB — negligible.

**Locale concern:** date-fns uses `enUS` locale by default which is what we want. Do NOT import `date-fns/locale/*` unless actually needed — the full locale import weighs ~30KB.

## Common Pitfalls

### Pitfall 1: `create table if not exists` races with extension migration 001

**What goes wrong:** If both migrations contain the CHECK constraint but written differently (e.g., extension names it with trailing spaces or different quoting), `ALTER TABLE ... ADD CONSTRAINT` fails on duplicate name.
**Why it happens:** `CREATE TABLE IF NOT EXISTS` doesn't create constraints when the table exists; a follow-up `ALTER TABLE ADD CONSTRAINT` runs unconditionally and explodes on duplicate.
**How to avoid:** Guard the `ALTER TABLE ... ADD CONSTRAINT` with a `DO $$ ... END $$` block that checks `pg_constraint` first (shown in § verbatim SQL sketch above).
**Warning signs:** `supabase db push` errors with `constraint "analytics_events_event_type_check" already exists`.

### Pitfall 2: Admin SELECT policy accidentally grants to `anon`

**What goes wrong:** Policy written with `TO authenticated, anon` or `TO public` — any user with the anon key reads all analytics events.
**Why it happens:** Copy-paste from a template or typo.
**How to avoid:** Always `TO authenticated` + `USING ((select private.is_admin()))`. Verify by explicit D-24 test: anon SELECT must fail / return zero rows.
**Warning signs:** Non-admin test in D-24 returns rows instead of `[]`.

### Pitfall 3: `supabase migration repair` executed against a migration that's actually applied

**What goes wrong:** Marking a still-applied migration as `reverted` deletes its tracker row; subsequent `supabase db push` re-runs it, causing duplicate-object errors.
**Why it happens:** Discovery step misses the "local" column when parsing `supabase migration list --linked`.
**How to avoid:** Only `repair --status reverted` versions that are in the Remote column AND NOT in the Local column. Add a dry-run print step in the plan: "about to revert these versions: <list>" with explicit operator confirmation before Claude runs the command.
**Warning signs:** Post-repair `supabase db push` errors on duplicate tables.

### Pitfall 4: Prebuild grep runs but always passes because `src/` doesn't exist or is empty

**What goes wrong:** `grep -r PATTERN src/` returns 0 (no match) if `src/` has no files, OR returns non-zero if PowerShell wraps `exit` differently.
**Why it happens:** Cross-shell edge cases.
**How to avoid:** Use Option C (Node script) — it explicitly walks the dir, handles "dir doesn't exist" as a test-time error, and its own exit code is deterministic.
**Warning signs:** Adding `SUPABASE_SERVICE_ROLE_KEY` to a src file and running `npm run build` does NOT fail.

### Pitfall 5: `useSearchParams` double-write in one tick

**What goes wrong:** Two calls to `setSearchParams` in the same event handler — the second reads `prev` from the pre-first-call state.
**Why it happens:** React Router 7's `setSearchParams` does not batch via React's update queue [CITED: remix-run/react-router#9757].
**How to avoid:** Always merge all writes into a single `setSearchParams` closure body (shown in § useDateRange skeleton).
**Warning signs:** Clicking a preset clears `from`/`to` but a subsequent set leaves stale values.

### Pitfall 6: `formatInTimeZone` bug during DST window

**What goes wrong:** Dates landing on the spring-forward hour (2am → 3am ET in March) or fall-back hour (ambiguous 1–2am ET in November) format incorrectly or throw.
**Why it happens:** `new Date('2026-03-08T02:30:00')` is ambiguous in ET — doesn't exist.
**How to avoid:** Always source times from UTC (`new Date()` is UTC internally) and use `formatInTimeZone` to *display* in ET. Never construct local times via date-fns in the ET zone and then use them as UTC.
**Warning signs:** Tests passing on some dates, failing on March 8 or November 1 of any year.

### Pitfall 7: Top-level `await import()` in `App.tsx` breaks SSR or older targets

**What goes wrong:** Top-level await requires `target: ES2022` + `module: ESNext`. Some Vite / Rollup configs can choke.
**Why it happens:** Project `tsconfig.app.json` line 4 IS `target: ES2022` [VERIFIED], so this is fine. But a future downgrade would break it silently.
**How to avoid:** Comment the top-level await with a pointer to the tsconfig target. Add a build test that greps `dist/` for `KitPage` (§ Build-size verification recipe).
**Warning signs:** Build succeeds but `/kit` route still loads in production.

### Pitfall 8: Scraper workspace types go stale when migrations evolve

**What goes wrong:** Phase 1 imports `../../src/db/database.types.ts`. When Phase 2/3/5 land migrations, the types file regenerates and breaks the scraper's type check silently (errors only surface when `cd scraper && tsc --noEmit`).
**Why it happens:** Root build (`tsc -b && vite build`) doesn't compile `scraper/`.
**How to avoid:** Add `scraper/` to the root CI pipeline (GitHub Actions, or Vercel preflight) via `cd scraper && npm install && npm run typecheck`. Out of scope for Phase 1 but document as a Phase 4 enhancement.
**Warning signs:** Scraper silently ships with broken types in Phase 4.

### Pitfall 9: `auth.persistSession: false` still attempts session refresh

**What goes wrong:** Even with `persistSession: false`, if `autoRefreshToken` defaults to true, Supabase JS sets up a recurring timer that prevents Node scripts from exiting.
**Why it happens:** Default `autoRefreshToken: true` is independent of `persistSession`.
**How to avoid:** Set BOTH `persistSession: false` AND `autoRefreshToken: false` (§ admin client example).
**Warning signs:** `tsx scripts/discover-drift.ts` hangs after logging "done".

## Code Examples

(All examples are repeated in-context above; this section lists pointers.)

- **Idempotent `analytics_events` migration:** § "Verbatim SQL sketch for Phase 1 migration"
- **Service-role admin client:** § "Service-Role Admin-Client Module" → `scraper/lib/supabase-admin.ts`
- **Drift-discovery SQL:** § "Schema Drift Discovery Methodology" → Step 2
- **Drop migration:** § "Schema Drift Discovery Methodology" → Step 4
- **Sparkline:** § "UI Kit Component Contracts" → `<Sparkline>`
- **`useDateRange`:** § "URL-State Hook Patterns" → skeleton
- **`useTimezone`:** § "URL-State Hook Patterns" → `useTimezone` skeleton
- **Prebuild grep guard:** § "Service-Role Admin-Client Module" → Option C

## v1.0 Carryover Audit (D-25)

### What's in `src/components/` today

Verified via `ls src/components/` on 2026-04-24:

- `AccessDenied.tsx`
- `BackLink.tsx`
- `EmptyState.tsx`
- `ErrorState.tsx`
- `FilterInput.tsx`
- `ProtectedRoute.tsx`
- `SortIndicator.tsx`
- `TableSkeleton.tsx`

**Phase 1 action:** NONE. Per D-25, keep as-is. Add `src/components/kit/` for the new primitives; do not touch the existing ones.

### `QueryClientProvider` already wired

Verified in `src/main.tsx` lines 12-20 and 30-39 — `QueryClient` is constructed at module scope with `staleTime: 60s`, `refetchOnWindowFocus: false`, `retry: 1`; wrapped around `<BrowserRouter>` and `<App />`. **Phase 1 adds NO new providers.** The `/kit` page inherits the provider tree.

### `private.is_admin()` exists

Verified in `supabase/migrations/20260421000006_rls_helper_functions.sql` lines 5-18. Function is `SECURITY DEFINER` with `search_path = ''` (preventing search-path injection). Returns true when `auth.uid()` maps to a `profiles` row with `role='admin'` AND `is_active=true`. **Phase 1's admin SELECT policy calls this verbatim** — `USING ((select private.is_admin()))`. No changes needed.

### `src/hooks/` is empty

Verified via `ls src/hooks/` — directory exists but has no files. Phase 1 populates it with `useDateRange.ts`, `useDateRange.test.ts`, `useTimezone.ts`, `useTimezone.test.ts`.

### Tests directory layout

Verified via `ls src/tests/` — existing tests: `auth-store.test.ts`, `filter-input.test.tsx`, `login-page.test.tsx`, `protected-route.test.tsx`, `setup.ts`, `sort-indicator.test.tsx`, `supabase-client.test.ts`. Phase 1 can either (a) add new tests co-located with source (`src/hooks/useDateRange.test.ts` — consistent with `vite.config.ts` glob `src/**/*.test.{ts,tsx}`) or (b) add to `src/tests/`. **Recommendation:** co-locate (closer to source, easier to find). Both paths work against the Vitest glob.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `date-fns` v3 without TZ support + manual offset math | `date-fns` v4 OR `date-fns` v3 + `date-fns-tz` v3.x | 2024 (date-fns v4 release) | First-class TZ; `date-fns-tz` still the battle-tested path |
| `XAxis hide={true} YAxis hide={true}` for sparklines | Simply omit `<XAxis>` / `<YAxis>` | Recharts 3.x | Smaller render tree |
| npm workspaces for sibling TS packages sharing types | File-path imports (D-10) | N/A — project-specific | Lower tooling overhead; coupling stays explicit |
| `CREATE POLICY` without `IF NOT EXISTS` | `DROP POLICY IF EXISTS ... CREATE POLICY` idiom | Postgres 15/16 idempotent-policy limitation | Migrations become re-runnable |
| React Router 6 `useSearchParams` (same API) | React Router 7 `useSearchParams` (same API, still has batching quirk) | 2024 RR7 release | No behavioral change for this hook; quirk documented [CITED: remix-run/react-router#9757] |

**Deprecated / outdated:**
- `document.execCommand('copy')` — replaced by `navigator.clipboard.writeText()`.
- `environmentMatchGlobs` in Vitest config — deprecated in Vitest 4; replaced by `projects` (already applied in repo's `vite.config.ts` lines 11-32).

## Assumptions Log

Claims here are flagged for the planner and discuss-phase to confirm before implementation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Extension migrations 002, 003, 004 have NOT been applied to the shared Supabase project as of 2026-04-24. Based on the dashboard's `src/db/database.types.ts` lines 17-108 missing `started_at`, `ended_at`, `item_index`, `item_status`, `catalog_item` in the CHECK enum. Extension STATE.md shows "Phase 31 ready for verification" (status `verifying`, completed 2026-04-21) — the 002-004 migrations exist as files but no application record. | § "Extension `analytics_events` Schema (verbatim)" | If applied: our `create table if not exists` still succeeds (no-op), but our CHECK constraint ADD may conflict with the extension's 003 constraint. Mitigated by the `DO $$ ... END $$` guard in our SQL. Low risk. |
| A2 | Supabase's hosted Postgres is version 15.x (which lacks `CREATE POLICY IF NOT EXISTS` — added in 17). I assume 15 based on Supabase's default project template as of early 2026. | § "Extension `analytics_events` Schema" → RLS Policy | If on 16 or 17, the `DROP POLICY IF EXISTS` + `CREATE POLICY` idiom still works. Zero risk — the safer idiom always works. |
| A3 | The live prod `supabase_migrations.schema_migrations` table has rows for v1.0 dashboard migrations that no longer exist locally. Based on the pivot note's "migrations reverted" phrasing [CITED: v1.0-MILESTONE-AUDIT.md line 197]. The exact version list is unknown until Step 1 discovery runs. | § "Schema Drift Discovery Methodology" | If no rows found: the `migration repair` step becomes a no-op. Zero risk. |
| A4 | Running `supabase migration repair --status reverted` does NOT require the migration file to exist locally. Based on Supabase CLI docs describing it as a "tracker row mutation." | § "Schema Drift Discovery Methodology" → Step 3 | If the CLI requires a file: the plan step would fail. Mitigation: dry-run first (`--dry-run`). Verify before committing to this flow. |
| A5 | React Router 7.13.1's `useSearchParams` behaves identically to 7.14.2 wrt the functional-updater batching quirk. Issue #9757 is still open in their tracker. | § "URL-State Hook Patterns" → Pitfall 5 | If fixed in 7.13.1: our "merge writes in one call" pattern is still correct, just unnecessary. Zero risk. |
| A6 | `npm view date-fns-tz version` returned `3.2.0` on 2026-04-24; no pending 4.0 release. | § "Standard Stack" → New additions | If a 4.0 lands between now and implementation: the API may have changed. Mitigation: pin `^3.2.0` explicitly. |
| A7 | The TPC App shared Supabase project's Postgres instance permits `CREATE POLICY` execution via the Supabase CLI `db push` pipeline (no additional auth setup needed). Based on v1.0 Phase 1 having shipped 6 RLS policies via the same pipeline [CITED: 20260421000006_rls_helper_functions.sql and referenced migrations]. | § "Verbatim SQL sketch" | If there's a permissions change: `db push` would fail with a privilege error. Mitigated by running a dry-run push first. |
| A8 | Windows `bash` environment in this repo is Git Bash (not WSL, not MSYS2). Based on the env block showing `Shell: bash` + `OS: Windows 11 Home`. | § "Service-Role Admin-Client Module" → Windows portability | If WSL: the shell grep still works, but path separators differ. Mitigation: Option C (Node script) is truly cross-platform. |

## Open Questions (RESOLVED)

1. **Exact v1.0 version strings to repair.** Unknown until Step 1 discovery runs. Plan should not hard-code version lists.
   - RESOLVED: Deferred to Wave 0 discovery step in Plan 01-01 Task 1 — versions are discovered at runtime via `scripts/discover-drift.ts` against the linked Supabase project, then Task 2 iterates the discovered list calling `supabase migration repair --status reverted <version>`. Not pre-declared in any plan artifact.

2. **Does the extension's live `analytics_events` already have any applied rows from real users?** Extension 29-VERIFICATION.md confirms the table is live as of 2026-04-21 and Phases 30/31 completed, meaning the extension is emitting events. Our admin SELECT policy must work against *real* rows in D-24 verification.
   - RESOLVED: D-24 test sequence in `scripts/verify-analytics-rls.ts` (Plan 01-03 Task 2) inserts a fixture row via anon client carrying a `__rls_verify__: true` marker, asserts admin SELECT sees it, then cleans up via service-role DELETE. Verification is correct against real data; fixture marker makes accidental retention discoverable.

3. **Where does `SUPABASE_URL` live for the admin client?** `VITE_SUPABASE_URL` is in dashboard `.env.local`. `scraper/.env` needs the same URL (so the admin client talks to the same project) but without the `VITE_` prefix.
   - RESOLVED: Plan 01-02 provisions `scraper/.env.example` listing `SUPABASE_URL` (no `VITE_` prefix) and `SUPABASE_SERVICE_ROLE_KEY`. `scraper/README.md` documents the manual copy-from-`.env.local` step. The admin client reads both vars via `process.env`.

4. **Is `grep -r SUPABASE_SERVICE_ROLE_KEY src/` really the right target?** `src/` is `.ts`/`.tsx` only. What about `index.html`, `vite.config.ts`, `eslint.config.js`?
   - RESOLVED: Plan 01-02 Task 2 implements the prebuild guard as a Node walker (`scripts/check-no-service-role-in-src.mjs`) that scans `src/` recursively AND explicitly checks `index.html` and `vite.config.ts`. These are the only additional files that reach the dev server or the production bundle. `eslint.config.js` is build-time only (not bundled) and is excluded.

5. **Should `/kit` also render a mock `<PayloadViewerModal>` state with real extension-shaped payload?** Improves Phase 2 confidence.
   - RESOLVED: Yes. Plan 01-05 `<PayloadViewerModal>` demo in the `/kit` route renders a sample `catalog_batch` event payload shape (pulled verbatim from extension migration 001 schema). Claude's discretion exercised per D-11.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 with @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1, jsdom ^28.1.0 [VERIFIED: package.json] |
| Config file | `vite.config.ts` — Vitest 4 `projects` config, split into `src` (jsdom) and `scripts` (node) [VERIFIED: vite.config.ts lines 10-32] |
| Quick run command | `npm test` (runs `vitest --run` — both projects) |
| Full suite command | `npm test` (same — the repo has only these two projects) |
| Scraper typecheck | `cd scraper && npm run typecheck` (new in Phase 1) |
| Build-bundle verification | `npm run build && node scripts/verify-no-kit-in-dist.mjs` (new in Phase 1) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-02 | Drift-discovery script lists remote-only versions correctly | integration (requires network) | `tsx scripts/discover-drift.ts --dry-run` | ❌ Wave 0 (new file) |
| INFR-02 | `supabase db push` returns clean after repair + drop migration | integration (requires network) | `npm run db:push` (then assert exit 0) | ✅ script exists |
| INFR-02 | `supabase migration list --linked` shows parity | integration (requires network) | `supabase migration list --linked` | ✅ CLI installed |
| INFR-03 | `<Sparkline>` renders a `<path>` when given data | unit | `vitest run src/components/kit/Sparkline.test.tsx` | ❌ Wave 0 |
| INFR-03 | `<KpiCard>` renders skeleton when `loading`, delta colour reflects direction | unit | `vitest run src/components/kit/KpiCard.test.tsx` | ❌ Wave 0 |
| INFR-03 | `<PayloadViewerModal>` opens/closes on Escape, copy button writes to clipboard | unit | `vitest run src/components/kit/PayloadViewerModal.test.tsx` | ❌ Wave 0 |
| INFR-03 | `<DateRangeFilter>` click on preset updates URL; Apply writes custom dates | unit + integration with MemoryRouter | `vitest run src/components/kit/DateRangeFilter.test.tsx` | ❌ Wave 0 |
| INFR-03 | `/kit` route is stripped from production bundle | integration (post-build) | `npm run build && node scripts/verify-no-kit-in-dist.mjs` | ❌ Wave 0 |
| INFR-04 | `useDateRange` defaults to `7d` when no param | unit | `vitest run src/hooks/useDateRange.test.ts` | ❌ Wave 0 |
| INFR-04 | `useDateRange` parses custom dates from URL | unit | same | ❌ Wave 0 |
| INFR-04 | `useDateRange` `setCustom` combines writes into one URL update | unit | same | ❌ Wave 0 |
| INFR-04 | Back/forward navigation restores range | unit via memory history | same | ❌ Wave 0 |
| INFR-04 | `useTimezone` formats ET in winter (January) correctly | unit | `vitest run src/hooks/useTimezone.test.ts` | ❌ Wave 0 |
| INFR-04 | `useTimezone` formats ET in summer (July) correctly (DST) | unit | same | ❌ Wave 0 |
| INFR-04 | `useTimezone` `nowET` returns zoned Date | unit | same | ❌ Wave 0 |
| INFR-05 | Migration file contains `create table if not exists` + `create policy analytics_admin_select` + `drop policy if exists analytics_insert_anon` | unit (static SQL inspection) | `node scripts/verify-migration-shape.mjs` | ❌ Wave 0 |
| INFR-05 | Admin user can SELECT rows | integration (live Supabase, 3 clients) | `tsx scripts/verify-analytics-rls.ts` | ❌ Wave 0 |
| INFR-05 | Non-admin authenticated user gets zero rows | integration | same | ❌ Wave 0 |
| INFR-05 | Anon user can INSERT a test row (extension's policy preserved) | integration | same | ❌ Wave 0 |
| INFR-05 | Admin can SELECT the just-inserted test row (round-trip) | integration | same | ❌ Wave 0 |
| INFR-06 | `getAdminClient` throws clear error when `SUPABASE_SERVICE_ROLE_KEY` missing | unit | `cd scraper && vitest run lib/supabase-admin.test.ts` | ❌ Wave 0 |
| INFR-06 | `getAdminClient` constructs a `SupabaseClient<Database>` | unit | same | ❌ Wave 0 |
| INFR-06 | Prebuild grep / Node-walk script exits 1 when a src file contains `SUPABASE_SERVICE_ROLE_KEY` | integration | `node scripts/check-no-service-role-in-src.mjs` (with a fixture file added temporarily) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (≤ 30s locally).
- **Per wave merge:** `npm test` + `npm run build` + `cd scraper && npm run typecheck`.
- **Phase gate (before `/gsd-verify-work`):** Full suite green + all INFR-05 integration tests against live Supabase green + `npm run build` produces `/kit`-free bundle.

### Wave 0 Gaps

All gaps are new files to create in the plan's first task:

- [ ] `src/components/kit/Sparkline.tsx` + `.test.tsx` — covers INFR-03
- [ ] `src/components/kit/KpiCard.tsx` + `.test.tsx` — covers INFR-03
- [ ] `src/components/kit/PayloadViewerModal.tsx` + `.test.tsx` — covers INFR-03
- [ ] `src/components/kit/DateRangeFilter.tsx` + `.test.tsx` — covers INFR-03
- [ ] `src/hooks/useDateRange.ts` + `.test.ts` — covers INFR-04
- [ ] `src/hooks/useTimezone.ts` + `.test.ts` — covers INFR-04 (include Jan 15 + Jul 15 test dates)
- [ ] `src/pages/Kit.tsx` — covers INFR-03 (dev-only demo page)
- [ ] `scripts/discover-drift.ts` — covers INFR-02 discovery (uses admin client)
- [ ] `scripts/verify-analytics-rls.ts` — covers INFR-05 D-24 (three-client verification)
- [ ] `scripts/verify-migration-shape.mjs` — covers INFR-05 static SQL inspection
- [ ] `scripts/verify-no-kit-in-dist.mjs` — covers INFR-03 tree-shaking guarantee
- [ ] `scripts/check-no-service-role-in-src.mjs` — covers INFR-06 prebuild guard
- [ ] `scraper/lib/supabase-admin.ts` + `.test.ts` — covers INFR-06
- [ ] `scraper/package.json`, `scraper/tsconfig.json`, `scraper/.env.example`, `scraper/README.md` — covers INFR-06 scaffold
- [ ] `supabase/migrations/YYYYMMDDHHMMSS_drop_retired_v1_tables.sql` — covers INFR-02
- [ ] `supabase/migrations/YYYYMMDDHHMMSS_create_analytics_events.sql` — covers INFR-05
- [ ] Modify `src/App.tsx` to conditionally mount `/kit` route
- [ ] Modify `package.json` to add `recharts`, `date-fns`, `date-fns-tz`, `prebuild` script
- [ ] Modify `CLAUDE.md` Conventions to document the service-role/src rule (D-09)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (existing Supabase auth reused; no changes in Phase 1) | Supabase `auth.signInWithPassword` already vetted in v1.0 Phase 1 |
| V3 Session Management | yes (existing session TTL; Phase 1 reads session via `useAuthStore`) | Supabase default session persistence in `localStorage`; no custom session logic |
| V4 Access Control | yes (admin SELECT RLS on `analytics_events`) | `private.is_admin()` helper gating authenticated reads; `anon INSERT` isolated |
| V5 Input Validation | partial (Phase 1 doesn't accept user input beyond URL params) | `zod` available; URL date parsing uses `date-fns parse` + `isValid` as the validator |
| V6 Cryptography | yes (Supabase service role key stored in environment, never in bundle) | Grep guard (D-09) prevents accidental bundle leak; `.env` gitignored |
| V7 Error Handling / Logging | partial (Phase 1 errors surface via existing Supabase SDK patterns) | No additional logging in Phase 1 |
| V8 Data Protection | yes (analytics_events contains `user_email` — PII-adjacent) | RLS gates read to admins only; extension's existing INSERT policy stays |
| V13 API / Web Service | yes (PostgREST via Supabase) | RLS enforces per-row authorization; `Prefer: return=minimal` header avoids unnecessary data exfil |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key leak to frontend bundle | Information Disclosure | Grep guard on `SUPABASE_SERVICE_ROLE_KEY` in `src/` (D-09) + physical separation via `scraper/` workspace (D-06/D-10) |
| RLS bypass via missing policy | Elevation of Privilege | Enable RLS with ZERO authenticated SELECT policy unless explicit; admin policy uses `private.is_admin()` function (not inlined `profiles` query) |
| anon user reads analytics via missing policy | Information Disclosure | `analytics_insert_anon` is the ONLY anon policy; no SELECT policy for anon; `Prefer: return=minimal` header on extension's INSERT suppresses auto-SELECT |
| URL-manipulation injection in `useDateRange` | Tampering | `date-fns parse` + `isValid` rejects malformed dates; `isPreset` narrow accepts only 4 string literals |
| XSS via `<pre>` in PayloadViewerModal | Injection | `JSON.stringify` escapes quote/backslash; React's default text-content escaping handles `<`/`>`; do NOT use `dangerouslySetInnerHTML` |
| CSRF on admin SELECT | Tampering | Supabase uses bearer tokens, not cookies, for the dashboard's admin session — CSRF not applicable to PostgREST |
| Secret in git history | Information Disclosure | `scraper/.env` in `.gitignore`; `.env.example` contains only placeholder text |
| SQL injection in discovery script | Injection | `scripts/discover-drift.ts` uses the Supabase client's query builder (parameterized) or static SQL strings — never string-concatenates user input |

**Phase 1 does not introduce new external attack surfaces.** The `/kit` route is dev-only (DEV guard + tree-shaken from production).

## Sources

### Primary (HIGH confidence)
- TPC AI Cataloger extension migration 001 — `~/Projects/TPC_AI_Cataloger/supabase/migrations/001_analytics_events.sql` (verbatim schema + RLS)
- TPC AI Cataloger extension 29-VERIFICATION.md — confirms migration 001 live in Supabase on 2026-04-21
- TPC Dashboard `src/db/database.types.ts` — confirms `analytics_events` schema shape matches migration 001 (and NOT 002/003/004)
- TPC Dashboard `src/lib/supabase.ts` — anon client pattern to mirror
- TPC Dashboard `supabase/migrations/20260421000006_rls_helper_functions.sql` — `private.is_admin()` definition
- TPC App `supabase/migrations/20260318000005_rls_policies.sql` — `(select private.is_admin())` policy shape
- TPC Dashboard `package.json` — locked versions
- TPC Dashboard `vite.config.ts` — Vitest projects config
- TPC Dashboard `src/main.tsx` — existing QueryClientProvider wiring
- TPC Dashboard `.planning/milestones/v1.0-MILESTONE-AUDIT.md` § Pivot Note — scope of v1.0 retirements
- TPC Dashboard `.planning/milestones/v1.0-phases/02-pdf-import-pipeline/02-CONTEXT.md` lines 30-31 — v1.0 admin-client pattern

### Secondary (MEDIUM confidence — verified with official sources)
- [Supabase CLI reference — supabase-migration-repair](https://supabase.com/docs/reference/cli/supabase-migration-repair) — `--status reverted` syntax
- [Supabase Docs — Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) — migration list / push flow
- [Recharts GitHub — recharts/recharts](https://github.com/recharts/recharts) — sparkline minimal config
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — 3.x changes
- [React Router useSearchParams API](https://reactrouter.com/api/hooks/useSearchParams) — v7 hook reference
- [remix-run/react-router issue #9757](https://github.com/remix-run/react-router/issues/9757) — setSearchParams stale updater quirk
- [remix-run/react-router discussion #9950](https://github.com/remix-run/react-router/discussions/9950) — functional updates for useSearchParams
- [date-fns-tz npm](https://www.npmjs.com/package/date-fns-tz) — v3.2.0
- [date-fns v4 time zone support](https://blog.date-fns.org/v40-with-time-zone-support/) — date-fns v4 native TZ
- [date-fns timeZones.md](https://github.com/date-fns/date-fns/blob/main/docs/timeZones.md) — DST guidance
- [Supabase PostgREST discussion #463](https://github.com/supabase/supabase/discussions/463) — `Prefer: return=minimal` requirement

### Tertiary (LOW confidence, cross-referenced but not primary)
- [BrowserStack Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer) — Phase 4 concern, not Phase 1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified via `npm view` + CLAUDE.md pins
- Architecture patterns: HIGH — derived from existing codebase + verified external docs
- Pitfalls: MEDIUM-HIGH — 7 of 9 documented by direct evidence (code, GitHub issues, Supabase docs); 2 based on domain experience (DST edge cases, top-level-await targeting) + corroborated by search
- Extension schema: HIGH — verbatim from source file, read in full
- Schema drift methodology: HIGH — verified against Supabase CLI docs
- RLS policy shape: HIGH — matches existing TPC App pattern verbatim
- `useDateRange` / `useTimezone`: MEDIUM — code skeleton is sound; exact edge-case behavior needs test coverage to lock in (especially DST)
- Admin-client: HIGH — v1.0 precedent + Supabase JS docs for `auth` options
- `/kit` tree-shaking: MEDIUM — pattern is standard but verification requires build artifact inspection

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (one month; schema-related claims about extension migrations 002/003/004 should be re-verified if plan execution delays past May)
