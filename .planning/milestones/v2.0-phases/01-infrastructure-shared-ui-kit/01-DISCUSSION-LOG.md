# Phase 1: Infrastructure & Shared UI Kit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 01-infrastructure-shared-ui-kit
**Areas discussed:** Schema drift repair (INFR-02), Admin-client location (INFR-06), UI kit scope & demo surface (INFR-03), Date-range URL contract (INFR-04), analytics_events RLS resilience (INFR-05), v1.0 component audit

---

## Gray Area Selection

**Question:** Which Phase 1 gray areas do you want to discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| Schema drift repair (INFR-02) | Concrete shape of migration reconciliation against linked Supabase | ✓ |
| Admin-client location (INFR-06) | Where the service-role Supabase client lives | ✓ |
| UI kit scope & demo surface (INFR-03) | Validation surface + component depth + Recharts timing | ✓ |
| Date-range URL contract (INFR-04) | URL serialization shape for Today/7d/30d/custom | ✓ |

**User's choice:** All four (via multi-select).
**Notes:** After the main four were resolved, user opted to also discuss INFR-05 RLS resilience and the v1.0 component audit.

---

## Area 1: Schema Drift Repair (INFR-02)

### Q1.1: Reconciliation strategy for the linked Supabase `schema_migrations` table

| Option | Description | Selected |
|--------|-------------|----------|
| Reverted + drop migration | `migration repair --status reverted` + new idempotent drop migration | ✓ (Recommended) |
| Idempotent drop migration only | Don't touch `schema_migrations`, just ship drop table if exists | |
| Squash baseline | Collapse history into a single v2.0 baseline | |
| Dry-run first | Run `db push --dry-run` + `migration list --linked` first, then pick | |

**User's choice:** Reverted + drop migration.
**Notes:** Clean audit trail was the deciding factor.

### Q1.2: Scope of the drop migration

| Option | Description | Selected |
|--------|-------------|----------|
| v1.0 dashboard-owned only | `sales, sale_departments, departments, scraper_runs, saved_reports, import_runs` + related RPCs | ✓ (Recommended) |
| Everything + verify | Drop v1.0 tables + audit `pg_tables` for unexpected objects | |
| List during research | Don't commit a scope; researcher queries `information_schema` and user approves | |

**User's choice:** v1.0 dashboard-owned only.
**Notes:** Matches "dashboard-owned" boundary from v1.0 CONTEXT.

### Q1.3: Who runs the destructive `supabase migration repair --status reverted` commands?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude runs them during plan execution | Executor runs repair commands automatically | ✓ |
| Claude generates runbook, user runs | Runbook with exact commands; user runs against prod | (Recommended — not chosen) |
| Staging Supabase project first | Throwaway project, full sequence, then replay on prod | |

**User's choice:** Claude runs them during plan execution.
**Notes:** User overrode the recommended "generate runbook" option. Captured in D-03 with rationale that `migration repair` is reversible (only mutates the tracking table), and the actual destructive SQL lives in a committed migration file under code review.

### Q1.4: Proof that drift is repaired

| Option | Description | Selected |
|--------|-------------|----------|
| `db push` clean + list empty | `supabase db push` returns no errors, `migration list --linked` shows parity | ✓ (Recommended) |
| Fresh-project round-trip | Spin up new Supabase project, verify schema matches prod | |
| Claude's discretion | Planner picks pragmatic verification | |

**User's choice:** `db push` returns clean + list is empty.

---

## Area 2: Admin-Client Location (INFR-06)

### Q2.1: Location of service-role Supabase admin module

| Option | Description | Selected |
|--------|-------------|----------|
| `scraper/lib/supabase-admin.ts` | Scaffold scraper/ workspace now; Phase 4 extends | ✓ (Recommended) |
| `server/lib/supabase-admin.ts` | Generic non-frontend home | |
| `ops/lib/supabase-admin.ts` | Admin/ops scripts home | |
| Document convention, no module yet | CLAUDE.md rule only; Phase 4 creates the module | |

**User's choice:** `scraper/lib/supabase-admin.ts`.

### Q2.2: What Phase 1 ships for the admin-client module

| Option | Description | Selected |
|--------|-------------|----------|
| Stub with typed exports + README | Working `getAdminClient()` + README, no scraper code yet | ✓ (Recommended) |
| Full module with migration helpers | Stub + helpers used by Phase 1 itself (couples areas) | |
| Just package.json + empty folder | Structure only, Phase 4 writes the module | |

**User's choice:** Stub with typed exports + README.
**Notes:** Phase 1's own migration-discovery step (D-05) imports `getAdminClient`, which dogfoods the module before Phase 4 depends on it.

### Q2.3: Mechanical enforcement of "service-role key never in frontend bundle"

| Option | Description | Selected |
|--------|-------------|----------|
| CI/build grep + CLAUDE.md rule | `prebuild` grep fails the build if `SUPABASE_SERVICE_ROLE_KEY` appears in `src/` | ✓ (Recommended) |
| ESLint no-restricted-imports rule | Lint catches `src/ → scraper/` imports at dev time | |
| Separate tsconfig with path boundaries | TypeScript project refs / paths make scraper unreachable from src | |
| Documentation only | CLAUDE.md Conventions + review discipline | |

**User's choice:** CI/build grep + CLAUDE.md rule.

---

## Area 3: UI Kit Scope & Demo Surface (INFR-03)

### Q3.1: How to validate the four components in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-only `/kit` route + Vitest | `/kit` renders components for eyeballing, Vitest covers behavior | ✓ (Recommended) |
| Storybook | Isolated component dev, adds ~200MB deps + separate dev server | |
| Vitest tests only | Behavior coverage, no visual | |
| Consume-in-place | Phase 2 is first real render site; skip Phase 1 validation | |

**User's choice:** Dev-only `/kit` route + Vitest.

### Q3.2: Sparkline implementation and Recharts timing

| Option | Description | Selected |
|--------|-------------|----------|
| Install Recharts in Phase 1 | Sparkline wraps Recharts; Phase 2 reuses for bars/donuts | ✓ (Recommended) |
| Hand-roll SVG sparkline, defer Recharts to Phase 2 | ~40-line pure-SVG component; Recharts enters with Phase 2 | |
| Install Recharts but hand-roll this sparkline | Amortize Recharts for downstream, keep Sparkline pure-SVG | |

**User's choice:** Install Recharts in Phase 1.

### Q3.3: KpiCard props shape

| Option | Description | Selected |
|--------|-------------|----------|
| `label + value + delta + sparkline slot` | Built-in delta + sparkline slot + loading skeleton | ✓ (Recommended) |
| Minimal label + value only | Caller composes delta/sparkline | |
| Full-featured (icon, link, trendLabel) | Maximal flexibility, more unused surface | |

**User's choice:** `label + value + delta + sparkline slot`.

### Q3.4: PayloadViewerModal depth

| Option | Description | Selected |
|--------|-------------|----------|
| Pretty-print + copy + scroll | Minimal; modal shell, `<pre>` 2-space JSON, copy button | ✓ (Recommended) |
| Pretty-print + syntax highlighting | Lightweight JSON highlighter, nicer UX | |
| Collapsible tree viewer | `react-json-view`, best for deeply nested payloads | |

**User's choice:** Pretty-print + copy + scroll.

---

## Area 4: Date-Range URL Contract + Timezone (INFR-04)

### Q4.1: URL serialization shape

| Option | Description | Selected |
|--------|-------------|----------|
| Preset + optional dates | `?range=today|7d|30d|custom` + `&from=&to=` when custom | ✓ (Recommended) |
| Dates only, preset inferred | `?from=&to=` always; preset inferred by matching today | |
| Semantic token | `?period=today|last7d|last30d|custom:...` | |

**User's choice:** Preset + optional dates.

### Q4.2: Default range when no param is present

| Option | Description | Selected |
|--------|-------------|----------|
| `7d` | Rolling last 7 days, consistent across all routes | ✓ (Recommended) |
| `today` | Matches APP-01's Today KPI strip | |
| `30d` | Broadest default | |
| Route-specific | Each route declares its own default | |

**User's choice:** `7d`.

### Q4.3: What `useTimezone` exposes

| Option | Description | Selected |
|--------|-------------|----------|
| Formatter functions | `{ formatDate, formatDateTime, formatTime, formatRange, nowET }` hard-coded to ET | ✓ (Recommended) |
| Context-provided with switchable zone | TimezoneProvider, default ET, switchable | |
| Plain utility module | Not a hook — `src/lib/datetime.ts` | |

**User's choice:** Formatter functions.

### Q4.4: Custom-range UX on the filter control

| Option | Description | Selected |
|--------|-------------|----------|
| Inline popover with two date inputs | Preset buttons + popover with two native `<input type="date">` + Apply/Cancel | ✓ (Recommended) |
| Popover with dual-month calendar | Needs date-picker library or ~200 LoC custom calendar | |
| Separate `from`/`to` always visible | No popover; preset buttons + two date inputs always rendered | |

**User's choice:** Inline popover with two date inputs.

---

## Area 5: analytics_events RLS Resilience (INFR-05)

### Q5.1: How to land the admin-SELECT policy given the table may not yet exist

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard creates the table itself | `create table if not exists` with extension's schema + both policies | ✓ (Recommended) |
| Defer INFR-05 to Phase 2 | Phase 2 verifies table readiness and lands the policy | |
| Coordinate with extension repo | PR in TPC_AI_Cataloger to ship both policies in extension's migration | |
| Wrap in a runbook task | SQL script admin runs manually once table appears | |

**User's choice:** Dashboard creates the table itself.
**Notes:** Decouples Phase 1 from extension ship schedule; accepts schema-drift coupling risk documented in D-22.

### Q5.2: How to protect against extension-side schema drift

| Option | Description | Selected |
|--------|-------------|----------|
| Pin to documented columns + `alter ... add column if not exists` | Minimal column set; add columns as extension introduces them | |
| Mirror the extension's exact v2.0 schema | Read TPC_AI_Cataloger planning docs, mirror columns/types/constraints | ✓ (Recommended) |
| Minimal columns + `raw jsonb` catchall | `id, event_type, user_email, created_at, raw jsonb` | |
| N/A (Option 2/3/4 above) | Not our problem if we didn't create the table | |

**User's choice:** Mirror the extension's exact v2.0 schema.
**Notes:** Phase-researcher task: extract canonical schema from `~/Projects/TPC_AI_Cataloger` planning docs / migration files before this migration is written.

---

## Area 6: v1.0 Component Audit

### Q6.1: What to do with existing v1.0 components

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is, reuse opportunistically | No audit in Phase 1; Phases 2/3/5 import what fits | ✓ (Recommended) |
| Audit and prune now | Review each component against v2 needs in Phase 1 | |
| Move to `src/components/legacy/` | Flag provenance, import from legacy/ explicitly | |
| Delete all non-auth components | Clean slate for v2 UI | |

**User's choice:** Keep as-is, reuse opportunistically.
**Notes:** Milestone-cleanup task post-Phase 6 prunes unreferenced components.

---

## Claude's Discretion

Items the user left open (captured in CONTEXT.md § Claude's Discretion):

- Tailwind class choices for KpiCard / Sparkline / PayloadViewerModal visuals
- `/kit` demo route layout
- Test depth beyond behavior contracts
- Migration filename timestamps
- Whether `prebuild` grep is inline in `package.json` or a shell script
- How the `scraper/` workspace is managed (npm workspaces vs. independent)
- Sparkline default point count, width, height, stroke color
- Exact wording of CLAUDE.md Conventions rule for service-role-key separation

---

## Deferred Ideas

Captured in CONTEXT.md § Deferred Ideas:

- Storybook / visual regression testing
- Context-provided timezone (multi-TZ support)
- Dual-month calendar custom-range UX
- PayloadViewer syntax highlighting / tree viewer
- ESLint no-restricted-imports guard for `src/ → scraper/`
- v1.0 component audit / prune / legacy move
- Fresh-Supabase-project round-trip verification for INFR-02
- Staging Supabase project for Phase 1 dry-run
