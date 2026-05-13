---
phase: 1
slug: infrastructure-shared-ui-kit
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react (already pinned in root package.json) |
| **Config file** | `vitest.config.ts` (to be created if missing — Wave 0 task) |
| **Quick run command** | `npm run test -- --run --reporter=dot` |
| **Full suite command** | `npm run test -- --run && npm run lint && npm run build` |
| **Estimated runtime** | ~45 seconds (test+lint+build for this phase's surface) |

Supabase integration tests run out-of-band against the linked project using the service-role admin client (no Postgres testcontainers; project uses a shared prod-like Supabase project per CONTEXT.md).

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run --reporter=dot` (scoped by changed files where possible)
- **After every plan wave:** Run full suite `npm run test -- --run && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green AND Supabase integration checks (INFR-02, INFR-05) signed off
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Populated by gsd-planner with per-task rows as PLAN.md files are written. Each row below is a seed covering the success-criteria surface; the planner fills in concrete Task IDs once plans exist.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01   | 2    | INFR-02     | T-1-SRK / T-1-ADMIN-SESS | Drift-discovery script enumerates v1.0 remnants via admin client; no src/ import of service-role key | integration | `npx tsx scripts/discover-drift.ts 2>&1 \| tee /tmp/drift-report.txt` | ❌ W0 | ⬜ pending |
| 01-01-T2 | 01   | 2    | INFR-02     | T-1-REPAIR-MISFIRE | `supabase migration repair --status reverted <V>` only for versions remote-only AND not-local | integration | `npx supabase migration list --linked 2>&1 \| tee /tmp/drift-post-repair.txt && ! grep -E "^\s*│\s+\d{14}\s+│" /tmp/drift-post-repair.txt` | ✅ | ⬜ pending |
| 01-01-T3 | 01   | 2    | INFR-02     | T-1-SCHEMA | Drop migration scoped to 6 dashboard-owned tables only; no TPC App / analytics_events names present | prebuild | `test -f supabase/migrations/20260424120000_drop_retired_v1_tables.sql && grep -q "drop table if exists public.sales cascade" supabase/migrations/20260424120000_drop_retired_v1_tables.sql && grep -q "drop table if exists public.import_runs cascade" supabase/migrations/20260424120000_drop_retired_v1_tables.sql && ! grep -E "drop table.+(profiles\|sessions\|items\|photos\|export_history\|analytics_events)" supabase/migrations/20260424120000_drop_retired_v1_tables.sql` | ❌ W0 | ⬜ pending |
| 01-01-T4 | 01   | 2    | INFR-02     | T-1-SCHEMA | Operator approves the destructive push against shared-prod before Task 5 | behavior | Checkpoint orchestrator resumes on explicit operator `approve-push` or `abort` reply | ✅ | ⬜ pending |
| 01-01-T5 | 01   | 2    | INFR-02     | T-1-PUSH-RACE | `supabase db push` applies both Phase 1 migrations atomically; tracker parity verified | integration | `npx supabase migration list --linked 2>&1 \| tee /tmp/post-push-migration-list.txt && grep -q "20260424120000" /tmp/post-push-migration-list.txt` | ✅ | ⬜ pending |
| 01-01-T6 | 01   | 2    | INFR-02     | —          | Regenerated Supabase types reflect post-push schema (no v1.0 remnants, analytics_events present) | integration | `npm run db:types && test -f src/db/database.types.ts && grep -q "analytics_events" src/db/database.types.ts && ! grep -q "^\s*sales:" src/db/database.types.ts && ! grep -q "^\s*scraper_runs:" src/db/database.types.ts` | ✅ | ⬜ pending |
| 01-01-T7 | 01   | 2    | INFR-05     | T-1-RLS    | Three-client RLS verification (admin / non-admin / anon) passes D-24 5-step sequence | integration | `npx tsx scripts/verify-analytics-rls.ts` | ❌ W0 | ⬜ pending |
| 01-02-T1 | 02   | 1    | INFR-06     | T-1-SRK    | Scraper workspace scaffold (package.json / tsconfig / .env.example / .gitignore / README) in place | build | `cd scraper && test -f package.json && test -f tsconfig.json && test -f .env.example && npm run typecheck` | ❌ W0 | ⬜ pending |
| 01-02-T2 | 02   | 1    | INFR-06     | T-1-SRK    | Node walker `scripts/check-no-service-role-in-src.mjs` blocks any `SUPABASE_SERVICE_ROLE_KEY` reference under src/ + index.html + vite.config.ts | prebuild | `node scripts/check-no-service-role-in-src.mjs` | ❌ W0 | ⬜ pending |
| 01-02-T3 | 02   | 1    | INFR-06     | —          | `getAdminClient()` throws clear error when env missing; constructs `SupabaseClient<Database>` with persistSession:false + autoRefreshToken:false | unit | `cd scraper && vitest run lib/supabase-admin.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-T4 | 02   | 1    | INFR-06     | T-1-SRK    | `npm run prebuild` wired; `npm run build` runs prebuild guard before vite build | build | `npm run build` | ✅ | ⬜ pending |
| 01-02-T5 | 02   | 1    | INFR-06     | —          | CLAUDE.md Conventions documents the service-role / src split and the prebuild guard | prebuild | `grep -q "SUPABASE_SERVICE_ROLE_KEY" CLAUDE.md && grep -q "scraper/lib/supabase-admin" CLAUDE.md` | ✅ | ⬜ pending |
| 01-03-T1 | 03   | 1    | INFR-05     | T-1-RLS / T-1-INS / T-1-SCHEMA | analytics_events migration idempotent; admin SELECT TO authenticated using private.is_admin(); anon INSERT preserved | prebuild | `test -f supabase/migrations/20260424120500_create_analytics_events.sql && grep -q "analytics_admin_select" supabase/migrations/20260424120500_create_analytics_events.sql && grep -q "(select private.is_admin())" supabase/migrations/20260424120500_create_analytics_events.sql` | ❌ W0 | ⬜ pending |
| 01-03-T2 | 03   | 1    | INFR-05     | T-1-RLS    | `scripts/verify-analytics-rls.ts` constructs 3 distinct clients + runs 5-step D-24 sequence + cleans up fixture | unit | `test -f scripts/verify-analytics-rls.ts && grep -q "signInWithPassword" scripts/verify-analytics-rls.ts && grep -q "getAdminClient" scripts/verify-analytics-rls.ts` | ❌ W0 | ⬜ pending |
| 01-03-T3 | 03   | 1    | INFR-05     | T-1-RLS    | Static migration-shape check asserts all required statements present + forbidden migration-002/003/004 content absent | prebuild | `test -f scripts/verify-migration-shape.mjs && node scripts/verify-migration-shape.mjs` | ❌ W0 | ⬜ pending |
| 01-04-T1 | 04   | 2    | INFR-04     | T-1-SRK    | date-fns + date-fns-tz installed at pinned versions; build still clean | build | `grep -q "\"date-fns\": \"\^4.1.0\"" package.json && grep -q "\"date-fns-tz\": \"\^3.2.0\"" package.json && test -d node_modules/date-fns && test -d node_modules/date-fns-tz && npm run build` | ✅ | ⬜ pending |
| 01-04-T2 | 04   | 2    | INFR-04     | T-1-DST-REGRESSION | useTimezone ET formatters; DST coverage via Jan (EST) + Jul (EDT) tests | unit | `test -f src/hooks/useTimezone.ts && test -f src/hooks/useTimezone.test.ts && grep -q "America/New_York" src/hooks/useTimezone.ts && grep -q "formatInTimeZone" src/hooks/useTimezone.ts && npm run test -- --run src/hooks/useTimezone.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-T3 | 04   | 2    | INFR-04     | T-1-URL-TAMPER / T-1-REACT-BATCHING | useDateRange uses URL as single source of truth; single-closure-write pattern; default 7d | unit | `test -f src/hooks/useDateRange.ts && grep -q "useSearchParams" src/hooks/useDateRange.ts && grep -q "from './useTimezone'" src/hooks/useDateRange.ts && grep -q "setParams(" src/hooks/useDateRange.ts` | ❌ W0 | ⬜ pending |
| 01-04-T4 | 04   | 2    | INFR-04     | T-1-URL-TAMPER | useDateRange tests cover default, presets, custom parse, invalid fallback, URL idempotency | unit | `test -f src/hooks/useDateRange.test.ts && grep -q "MemoryRouter" src/hooks/useDateRange.test.ts && grep -q "setCustom" src/hooks/useDateRange.test.ts && grep -q "banana" src/hooks/useDateRange.test.ts && npm run test -- --run src/hooks/useDateRange.test.ts src/hooks/useTimezone.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-T1 | 05   | 2    | INFR-03     | —          | recharts installed; Sparkline renders Recharts LineChart without axes/grid/tooltip | unit | `grep -q "\"recharts\"" package.json && test -f src/components/kit/Sparkline.tsx && npm run test -- --run src/components/kit/Sparkline.test.tsx` | ❌ W0 | ⬜ pending |
| 01-05-T2 | 05   | 2    | INFR-03     | —          | KpiCard renders label/value/delta/sparkline slot with loading skeleton + delta direction colour | unit | `test -f src/components/kit/KpiCard.tsx && npm run test -- --run src/components/kit/KpiCard.test.tsx` | ❌ W0 | ⬜ pending |
| 01-05-T3 | 05   | 2    | INFR-03     | —          | PayloadViewerModal opens/closes on Esc + backdrop; copy button writes to clipboard | unit | `test -f src/components/kit/PayloadViewerModal.tsx && npm run test -- --run src/components/kit/PayloadViewerModal.test.tsx` | ❌ W0 | ⬜ pending |
| 01-05-T4 | 05   | 2    | INFR-03     | T-1-URL-TAMPER | DateRangeFilter binds presets + custom popover to useDateRange; Apply/Cancel write URL atomically | unit | `test -f src/components/kit/DateRangeFilter.tsx && npm run test -- --run src/components/kit/DateRangeFilter.test.tsx` | ❌ W0 | ⬜ pending |
| 01-06-T1 | 06   | 3    | INFR-03     | —          | `/kit` route mounts only when `import.meta.env.DEV`; demo page renders all 4 primitives | unit | `test -f src/pages/Kit.tsx && grep -q "import.meta.env.DEV" src/App.tsx && npm run test -- --run src/App.test.tsx` | ❌ W0 | ⬜ pending |
| 01-06-T2 | 06   | 3    | INFR-03     | —          | Production bundle contains no `/kit` route artifacts (tree-shake verified) | build | `npm run build && node scripts/verify-no-kit-in-dist.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — present and configured for React 19 + TSX + JSDom environment
- [ ] `src/test/setup.ts` — shared setup: `@testing-library/jest-dom`, `afterEach(cleanup)`, mock `window.matchMedia` if needed
- [ ] `scraper/lib/supabase-admin.ts` + `scraper/lib/supabase-admin.test.ts` — module and unit test stubs for INFR-06
- [ ] `scripts/check-no-service-role-in-src.mjs` — cross-platform Node script (NOT bash grep) for Windows portability
- [ ] `scripts/discover-drift.ts` — admin-client-backed script to enumerate v1.0 remnants for INFR-02 (must run before the drop migration is authored)
- [ ] `scripts/verify-analytics-rls.ts` — three-client integration test harness for INFR-05 (`admin` / `non-admin` / `anon`)
- [ ] `src/hooks/useDateRange.test.ts` + `src/hooks/useTimezone.test.ts` — hook test stubs including January + July DST cases
- [ ] `src/components/kit/*.test.tsx` — component test stubs for each of the four primitives

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh-project `supabase db push` against an unlinked Supabase project reproduces schema with no drift errors | INFR-02 (Success Criterion 1) | Requires creating/destroying a throwaway Supabase project; out of scope for CI | Create a free-tier Supabase project, link via `supabase link`, run `supabase db push`, assert clean output, confirm `supabase migration list --linked` shows identical local+remote sets, then delete project |
| Dev-only `/kit` route renders each component visually in the browser | INFR-03 (Success Criterion 2) | Tailwind v4 class correctness and visual polish are human-eyeball judgments | `npm run dev`, navigate to `/kit`, confirm each primitive renders in multiple states (loading, empty, with-sparkline) without console errors |
| URL back/forward behavior preserves range across navigation and page reload | INFR-04 (Success Criterion 3) | Browser-history interaction is awkward to automate meaningfully with jsdom | In dev, pick 30d, navigate to `/kit?range=30d` manually, refresh, hit Back from a different page — assert filter state persists |
| CLAUDE.md Conventions section documents the admin-client rule and the `process.env` vs `import.meta.env` split | INFR-06 (Success Criterion 5) | Docs review | Read CLAUDE.md after plan execution; confirm a "Conventions" entry exists and references both `scraper/lib/supabase-admin.ts` and the prebuild grep |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest config, drift-discovery script, three-client RLS harness, service-role grep script)
- [ ] No watch-mode flags (all `vitest` invocations use `--run`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates Task IDs

**Approval:** approved 2026-04-24
