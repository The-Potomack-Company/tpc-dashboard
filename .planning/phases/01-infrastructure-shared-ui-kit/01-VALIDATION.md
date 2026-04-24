---
phase: 1
slug: infrastructure-shared-ui-kit
status: draft
nyquist_compliant: false
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
| TBD     | 01   | 1    | INFR-02     | T-1-SCHEMA | Only dashboard-owned v1.0 objects dropped; TPC App + analytics_events untouched | integration | `supabase migration list --linked` clean + manual `pg_tables` assertion | ❌ W0 | ⬜ pending |
| TBD     | 02   | 1    | INFR-06     | T-1-SRK    | `SUPABASE_SERVICE_ROLE_KEY` never imported from `src/`; admin client has `persistSession:false` + `autoRefreshToken:false` | unit + prebuild grep | `node scripts/check-no-service-role-in-src.mjs` exits 0 | ❌ W0 | ⬜ pending |
| TBD     | 02   | 1    | INFR-06     | —          | `getAdminClient()` throws clear error when env var missing | unit | `vitest run scraper/lib/supabase-admin.test.ts` | ❌ W0 | ⬜ pending |
| TBD     | 03   | 1    | INFR-05     | T-1-RLS    | Admin SELECT works; non-admin SELECT returns 0 rows; anon INSERT works; admin sees inserted row | integration | Supabase three-client test script (admin/non-admin/anon) | ❌ W0 | ⬜ pending |
| TBD     | 04   | 2    | INFR-04     | —          | URL `?range=7d` serializes; back/forward preserves; `formatDateTime` returns ET in Jan (EST) and Jul (EDT) | unit + hook | `vitest run src/hooks/` | ❌ W0 | ⬜ pending |
| TBD     | 05   | 2    | INFR-03     | —          | `<Sparkline>` renders Recharts `<LineChart>` without axes/grid/tooltip; `<KpiCard>` renders label/value/delta/sparkline slot; `<PayloadViewerModal>` closes on Esc/backdrop with copy button; `<DateRangeFilter>` preset buttons + custom popover Apply/Cancel | unit + behavior | `vitest run src/components/kit/` | ❌ W0 | ⬜ pending |
| TBD     | 06   | 3    | INFR-03     | —          | `/kit` route mounts only when `import.meta.env.DEV` and is tree-shaken from `dist/` | build + grep | `npm run build && ! grep -R "routes/kit" dist/` | ❌ W0 | ⬜ pending |

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

**Approval:** pending
