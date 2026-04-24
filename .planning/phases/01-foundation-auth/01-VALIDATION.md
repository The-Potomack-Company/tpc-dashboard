---
phase: 1
slug: foundation-auth
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
finalized: 2026-04-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom |
| **Config file** | `vite.config.ts` (test block — matches TPC App) |
| **Quick run command** | `npm test` (= `vitest --run`) |
| **Full suite command** | `npm test && npm run lint && npm run build` |
| **Estimated runtime** | ~5 seconds (test only), ~30s with lint + build |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-??-01 | scaffold | 0 | INFR-01 | — | `package.json` + Vite scaffold build succeeds | build | `npm run build` | ❌ W0 | ⬜ pending |
| 1-??-01 | supabase-client | 1 | INFR-02 | T-01 (env secret) | Client throws when env vars missing; lazy init via Proxy | unit | `npm test -- supabase-client` | ❌ W0 | ⬜ pending |
| 1-??-01 | migrations | 2 | INFR-04 | T-02 (float drift) | Money columns materialize as `numeric(14,2)` in generated types | schema | `npm run db:types && npm test -- schema-shape` | ❌ W0 | ⬜ pending |
| 1-??-01 | auth-store | 3 | AUTH-01, AUTH-02 | — | `signInWithPassword` called; `authStore` fetches profile and sets `isAdmin` when `role==='admin'` | unit | `npm test -- auth-store` | ❌ W0 | ⬜ pending |
| 1-??-02 | login-page | 3 | AUTH-01 | T-05 (user enum) | Login form submits credentials; generic error surfaces on fail | unit | `npm test -- login-page` | ❌ W0 | ⬜ pending |
| 1-??-03 | protected-route | 3 | AUTH-02, AUTH-03, AUTH-04 | T-03 (flash), T-04 (spoof) | Four states: loading / unauth → redirect / non-admin → AccessDenied / admin → Outlet | unit | `npm test -- protected-route` | ❌ W0 | ⬜ pending |
| (manual) | migrations | 2 | AUTH-04 (RLS) | T-06 (open RLS) | `anon` role SELECT returns 0 rows on `sales` | manual SQL | Supabase SQL editor `set role anon; select count(*) from sales;` | n/a | ⬜ pending |
| (manual) | migrations | 2 | AUTH-04 (RLS) | T-06 | Non-admin authenticated SELECT returns 0 rows on `sales` | manual SQL | Supabase SQL editor as specialist JWT | n/a | ⬜ pending |
| (manual) | deploy | last | INFR-01 | — | Vercel deployment loads | manual E2E | Visit deployed URL, confirm `/login` renders | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install test framework: `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`
- [ ] `vite.config.ts` — add `test:` block (environment: `jsdom`, setupFiles: `./src/tests/setup.ts`)
- [ ] `src/tests/setup.ts` — import `@testing-library/jest-dom/vitest`
- [ ] `src/tests/supabase-client.test.ts` — env var missing → throws; lazy init works
- [ ] `src/tests/auth-store.test.ts` — profile fetch + `isAdmin` derivation
- [ ] `src/tests/login-page.test.tsx` — form submit + error state
- [ ] `src/tests/protected-route.test.tsx` — 4 gate states
- [ ] `src/tests/schema-shape.test.ts` — assert generated types contain required columns (imports `Database` from `src/db/database.types.ts`)

*Until Wave 0 completes, no automated assertions exist for any requirement. Wave 0 MUST land before or alongside the feature waves it validates.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `info@` admin logs in, lands on `/` dashboard | AUTH-01, AUTH-02 | Real Supabase Auth call + live profile row; cannot be fully unit-tested end-to-end | 1. `npm run dev`. 2. Open `/login`. 3. Enter `info@…` + password. 4. Expect redirect to `/` with "Welcome, {name}" header. |
| Non-admin user sees Access Denied screen | AUTH-03 | Requires second Supabase user with `role != 'admin'` | Same as above with specialist credentials; expect Access Denied card with Sign out button. |
| RLS denies anon SELECT on `sales` | AUTH-04 | Easier to script in SQL than Vitest | Supabase dashboard SQL editor: `set role anon; select count(*) from sales;` returns 0 / policy error. |
| RLS denies non-admin authenticated SELECT on `sales` | AUTH-04 | Requires generating a JWT as specialist user | Use Supabase Studio → impersonate specialist → run `select count(*) from sales;` → 0. |
| Vercel deployment loads at the dashboard URL | INFR-01 | No test can verify production deployment from CI | Visit Vercel deployment URL, confirm `/login` renders and assets load. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
