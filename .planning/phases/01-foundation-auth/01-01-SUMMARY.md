---
phase: 01-foundation-auth
plan: 01
subsystem: infra

tags:
  - vite
  - react
  - typescript
  - tailwindcss-v4
  - vitest
  - eslint
  - pnpm-lock
  - scaffold

# Dependency graph
requires: []
provides:
  - "Installable Vite + React 19 + TypeScript project with all pinned dependencies resolved"
  - "Composite tsconfig (app + node) matching TPC App strict settings"
  - "Tailwind v4 wired via @tailwindcss/vite plugin (no tailwind.config.js, no postcss.config.js)"
  - "Vitest configured with jsdom environment + @testing-library/jest-dom setup"
  - "ESLint 9 flat config with typescript-eslint + react-hooks + react-refresh"
  - "Empty src/ directory skeleton matching CONTEXT.md (components, pages, layouts, lib, db, hooks, stores, services, utils)"
  - ".env.example template for VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY"
  - "Placeholder App.tsx rendering 'TPC Dashboard' ready for Plan 02 to replace with real composition"
affects:
  - "01-02 (Supabase client + auth store) — main.tsx/App.tsx will be replaced"
  - "01-03 (Database migrations) — uses supabase CLI already pinned"
  - "01-04 (Routes + AuthGuard) — extends App.tsx with React Router"
  - "01-05 (Login UI + QA) — uses Tailwind v4 tokens --color-accent"
  - "All future plans — inherits package.json scripts, tsconfig settings, ESLint rules"

# Tech tracking
tech-stack:
  added:
    - "react@19.2.5, react-dom@19.2.5"
    - "react-router@7.14.2 (NOT react-router-dom; v7 is the package)"
    - "@supabase/supabase-js@2.104.0"
    - "@tanstack/react-query@5.99.2 + devtools (dashboard-specific; not in TPC App)"
    - "zustand@5.0.12, zod@4.3.6"
    - "vite@7.3.2, @vitejs/plugin-react@5.2.0"
    - "tailwindcss@4.2.4, @tailwindcss/vite@4.2.4"
    - "typescript@5.9.3, typescript-eslint@8.59.0"
    - "vitest@4.1.5, jsdom@28.1.0, @testing-library/{react@16.3.2, jest-dom@6.9.1, user-event@14.6.1}"
    - "eslint@9.39.4, @eslint/js@9.39.4, eslint-plugin-react-hooks@7.1.1, eslint-plugin-react-refresh@0.4.26"
    - "supabase@2.93.0 (CLI), @types/node@24.12.2, @types/react@19.2.14, @types/react-dom@19.2.3"
  patterns:
    - "Tailwind v4 CSS-first theming: @import \"tailwindcss\" + @theme block in src/index.css (NO tailwind.config.js, NO postcss.config.js)"
    - "ESLint 9 flat config (eslint.config.js default export with defineConfig)"
    - "Composite TypeScript project: tsconfig.json references tsconfig.app.json + tsconfig.node.json"
    - "Strict TS settings mirrored from TPC App: noUnusedLocals, noUnusedParameters, erasableSyntaxOnly, verbatimModuleSyntax, noUncheckedSideEffectImports"
    - "Vitest co-located with Vite: single vite.config.ts with /// <reference types=\"vitest/config\" /> and inline test block"
    - "Directory skeleton enforced via .gitkeep in nine src/ subdirs"

key-files:
  created:
    - "package.json — pinned runtime + dev deps, scripts dev/build/lint/test/preview/db:push/db:types"
    - "package-lock.json — locks exact transitive versions (322 packages)"
    - "tsconfig.json, tsconfig.app.json, tsconfig.node.json — composite TS project"
    - "vite.config.ts — React plugin + Tailwind v4 plugin + Vitest jsdom test block"
    - "eslint.config.js — flat v9 config (verbatim from TPC App)"
    - "src/index.css — Tailwind import + @theme with --color-accent #2563eb, --color-accent-hover #1d4ed8"
    - "src/main.tsx — placeholder React 19 mount (no router yet, Plan 02 replaces)"
    - "src/App.tsx — placeholder 'TPC Dashboard' page with Tailwind utility classes"
    - "src/tests/setup.ts — @testing-library/jest-dom/vitest matcher augmentation"
    - "src/vite-env.d.ts — Vite client types reference"
    - "src/{components,pages,layouts,lib,db,hooks,stores,services,utils}/.gitkeep — nine skeleton placeholders"
    - ".env.example — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY template"
    - ".gitignore — node_modules, dist, .env, .env.local, supabase/.temp, .vercel (verbatim from TPC App + explicit .env.local)"
    - "index.html — 'TPC Dashboard' title, #root div, /src/main.tsx script"
    - "public/vite.svg — favicon asset"
  modified: []

key-decisions:
  - "Used direct file scaffolding instead of interactive `npm create vite@7.3.1` to guarantee deterministic output without prompts (produces identical result for pinned Vite 7.3)"
  - "Added `.env.local` explicitly to .gitignore (TPC App relies on `*.local` glob only; explicit entry removes ambiguity for the acceptance criteria grep)"
  - "Set build script to `tsc -b && vite build` (composite project build, matches TPC App exactly)"
  - "Kept `db:push` / `db:types` scripts using bare `supabase` (not `npx supabase`) because the CLI is a local devDependency"

patterns-established:
  - "Pattern 1: Version-lockstep with TPC App for all shared dependencies (react, vite, tailwind, eslint, vitest, supabase, etc.) so migrations and learnings port both ways"
  - "Pattern 2: Tailwind v4 CSS-first tokens in @theme block; ONLY --color-accent and --color-accent-hover per UI-SPEC (no other custom tokens allowed)"
  - "Pattern 3: Placeholder/scaffold tasks commit main.tsx/App.tsx with explicit comments that later plans will replace them (Plan 02 wires auth + router + QueryClient)"
  - "Pattern 4: Empty .gitkeep files lock directory structure so future generators know where components/pages/layouts/lib/db/hooks/stores/services/utils live"

requirements-completed:
  - INFR-02

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 01 Plan 01: Standalone App Scaffold Summary

**Vite 7.3 + React 19 + TypeScript 5.9 + Tailwind v4 project bootstrapped with 322 pinned packages, TPC-App-aligned tsconfig / ESLint flat config / Vitest jsdom setup, and an empty-but-clean `src/` skeleton producing a lint-clean, build-clean, test-runnable foundation for Plans 02–05.**

## Performance

- **Duration:** ~5 min (scaffolding dominated by `npm install` at 30s)
- **Started:** 2026-04-21T16:29:32Z
- **Completed:** 2026-04-21T16:34:02Z
- **Tasks:** 3 committed atomically
- **Files created:** 26 (9 .gitkeep + 17 real files)
- **Files modified:** 0

## Accomplishments

- All seven runtime deps + twenty-one dev deps pinned to exact TPC-App versions (where shared) plus TanStack Query 5.99 as the dashboard's sole stack addition
- Composite TypeScript project compiles clean (`tsc -b` passes, strict + noUnusedLocals + erasableSyntaxOnly all on)
- Tailwind v4 wired via `@tailwindcss/vite` plugin with the `@theme` block containing exactly the two UI-SPEC tokens (`--color-accent`, `--color-accent-hover`) — zero extras
- Vitest framework wired with jsdom environment and `@testing-library/jest-dom/vitest` matchers; `npm test --passWithNoTests` exits 0
- ESLint 9 flat config (copied verbatim from TPC App) lints the placeholder `App.tsx`/`main.tsx` with zero errors and zero warnings
- Build produces `dist/index.html` + hashed JS (193.58 kB, 60.81 kB gzipped) + hashed CSS (6.76 kB, 2.11 kB gzipped)
- Full verification chain passes cleanly: `npm install && npm run lint && npm run build && npm test --passWithNoTests` all exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Vite + React + TS baseline and install all pinned dependencies** — `21a3fd1` (chore)
2. **Task 2: Wire Tailwind v4, Vitest, ESLint flat config, and directory skeleton** — `c9e07d9` (chore)
3. **Task 3: Write placeholder main.tsx + App.tsx, validate full build/lint/test chain** — `d932c94` (feat)

_Note: Plan metadata commit is created by the orchestrator after all waves complete._

## Pinned Versions (Resolved)

| Package | Pin | Resolved | TPC App |
|---------|-----|----------|---------|
| react | ^19.2.0 | 19.2.5 | ^19.2.0 ✓ |
| react-dom | ^19.2.0 | 19.2.5 | ^19.2.0 ✓ |
| react-router | ^7.13.1 | 7.14.2 | ^7.13.1 ✓ |
| @supabase/supabase-js | ^2.101.1 | 2.104.0 | ^2.99.2 (dashboard newer) |
| @tanstack/react-query | ^5.99.2 | 5.99.2 | — (dashboard-only) |
| @tanstack/react-query-devtools | ^5.99.2 | 5.99.2 | — (dashboard-only) |
| zustand | ^5.0.11 | 5.0.12 | ^5.0.11 ✓ |
| zod | ^4.3.6 | 4.3.6 | ^4.3.6 ✓ |
| vite | ^7.3.1 | 7.3.2 | ^7.3.1 ✓ |
| @vitejs/plugin-react | ^5.1.1 | 5.2.0 | ^5.1.1 ✓ |
| tailwindcss | ^4.2.1 | 4.2.4 | ^4.2.1 ✓ |
| @tailwindcss/vite | ^4.2.1 | 4.2.4 | ^4.2.1 ✓ |
| typescript | ~5.9.3 | 5.9.3 | ~5.9.3 ✓ |
| typescript-eslint | ^8.48.0 | 8.59.0 | ^8.48.0 ✓ |
| eslint | ^9.39.1 | 9.39.4 | ^9.39.1 ✓ |
| @eslint/js | ^9.39.1 | 9.39.4 | ^9.39.1 ✓ |
| eslint-plugin-react-hooks | ^7.0.1 | 7.1.1 | ^7.0.1 ✓ |
| eslint-plugin-react-refresh | ^0.4.24 | 0.4.26 | ^0.4.24 ✓ |
| globals | ^16.5.0 | 16.5.0 | ^16.5.0 ✓ |
| vitest | ^4.0.18 | 4.1.5 | ^4.0.18 ✓ |
| jsdom | ^28.1.0 | 28.1.0 | ^28.1.0 ✓ |
| @testing-library/jest-dom | ^6.9.1 | 6.9.1 | ^6.9.1 ✓ |
| @testing-library/react | ^16.3.2 | 16.3.2 | ^16.3.2 ✓ |
| @testing-library/user-event | ^14.6.1 | 14.6.1 | ^14.6.1 ✓ |
| @types/node | ^24.10.1 | 24.12.2 | ^24.10.1 ✓ |
| @types/react | ^19.2.7 | 19.2.14 | ^19.2.7 ✓ |
| @types/react-dom | ^19.2.3 | 19.2.3 | ^19.2.3 ✓ |
| supabase | ^2.81.3 | 2.93.0 | ^2.81.3 ✓ |

**Alignment:** All shared packages satisfy the TPC App pin expressions exactly. The only dashboard-only additions (TanStack Query + devtools) are not in TPC App.

## Files Created/Modified

All files created (none modified — dashboard started empty):

- `package.json` — pinned deps + scripts (dev/build/lint/test/preview/db:push/db:types)
- `package-lock.json` — 322-package lockfile
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — composite TS project
- `vite.config.ts` — React + Tailwind v4 + Vitest jsdom
- `eslint.config.js` — flat v9 config (TPC App verbatim)
- `index.html` — 'TPC Dashboard' title, `#root`, `/src/main.tsx` entry
- `.gitignore` — node_modules / dist / .env / .env.local / supabase temp / .vercel
- `.env.example` — Supabase URL + anon key template
- `public/vite.svg` — placeholder favicon
- `src/index.css` — `@import "tailwindcss"` + `@theme { --color-accent #2563eb; --color-accent-hover #1d4ed8; }`
- `src/main.tsx` — StrictMode + createRoot (placeholder; Plan 02 will add BrowserRouter, QueryClientProvider, auth init)
- `src/App.tsx` — placeholder page rendering `<h1>TPC Dashboard</h1>`
- `src/tests/setup.ts` — `@testing-library/jest-dom/vitest` import
- `src/vite-env.d.ts` — Vite client type reference
- `src/{components,pages,layouts,lib,db,hooks,stores,services,utils}/.gitkeep` — nine skeleton placeholders

## Decisions Made

- **Manual file scaffolding vs `npm create vite`:** Direct `Write` of the exact target file contents produces a deterministic result that matches the plan's expected structure exactly, without interactive "non-empty directory" prompts. The result is byte-identical to what a clean `npm create vite@7.3.1 . -- --template react-ts` would produce after manual overrides.
- **Explicit `.env.local` in `.gitignore`:** TPC App relies only on the `*.local` glob, but the plan's acceptance criteria checks for `.env.local` literally. Adding the explicit line removes ambiguity without conflicting with the glob.
- **`db:push` / `db:types` use bare `supabase`:** The CLI is pinned as a devDependency, so the scripts resolve to the local binary via `npm run`'s PATH prefix. This matches how the TPC App scripts work in practice even though TPC App's `package.json` uses `npx` — both resolve to the same local binary.

## Deviations from Plan

None of Rules 1–3 triggered. Minor procedural adjustments documented above (Decisions Made) are within plan intent; no functional deviations from the plan tasks.

**Total deviations:** 0
**Impact on plan:** None. Plan executed task-by-task with identical outputs to the specified acceptance criteria.

## Issues Encountered

- **Worktree base mismatch at start:** The worktree branch was created from `f0c2b92` (pre-phase-plan-commit) instead of the orchestrator-expected `ce5594e`. The prompt's `<worktree_branch_check>` block prescribed a rebase-onto path, so after committing all three tasks I ran `git rebase --onto ce5594e f0c2b92 HEAD`, then reattached the branch ref. Rebase succeeded cleanly with no conflicts (task commits add new files only). Task commit hashes shifted from `1750ae7/3a125d6/4f37096` (pre-rebase) to `21a3fd1/c9e07d9/d932c94` (post-rebase). Full verification re-ran cleanly after rebase.
- **Windows CRLF warnings:** `git commit` emitted "LF will be replaced by CRLF" warnings on every text file (Windows environment, no `.gitattributes` yet). These are informational and do not affect content. A future plan may add `.gitattributes` to normalize line endings.

## User Setup Required

None — no external services were configured in this plan. `.env.local` (real Supabase URL + anon key) will be required starting in Plan 02 when the Supabase client first connects; `.env.example` is in place as the template.

## Next Phase Readiness

- **Plan 02 (Supabase client + auth store) unblocked:** `main.tsx` and `App.tsx` are minimal placeholders explicitly awaiting Plan 02 to add `BrowserRouter`, `QueryClientProvider`, and `authStore.initialize()`. All needed deps (`@supabase/supabase-js`, `react-router`, `@tanstack/react-query`, `zustand`) are already installed.
- **Plan 03 (Database migrations) unblocked:** `supabase` CLI installed; `db:push` and `db:types` scripts ready.
- **Plan 04 (Routes + AuthGuard) unblocked:** `react-router@7.14.2` installed; `src/layouts/`, `src/pages/`, `src/components/` directories created.
- **Plan 05 (Login UI + QA) unblocked:** Tailwind v4 tokens available; UI-SPEC compliance for colors already enforced in `src/index.css`.
- **No blockers or concerns.**

## Self-Check

Verified all task commits exist and all key files are present.

```
FOUND: 21a3fd1 (chore: scaffold baseline)
FOUND: c9e07d9 (chore: wire Tailwind/Vitest/ESLint/skeleton)
FOUND: d932c94 (feat: placeholder main.tsx + App.tsx)
FOUND: package.json
FOUND: package-lock.json
FOUND: tsconfig.json, tsconfig.app.json, tsconfig.node.json
FOUND: vite.config.ts
FOUND: eslint.config.js
FOUND: index.html
FOUND: .gitignore, .env.example
FOUND: src/main.tsx, src/App.tsx, src/index.css, src/tests/setup.ts, src/vite-env.d.ts
FOUND: src/{components,pages,layouts,lib,db,hooks,stores,services,utils}/.gitkeep (9 files)
MISSING: none
```

## Self-Check: PASSED

---
*Phase: 01-foundation-auth*
*Plan: 01*
*Completed: 2026-04-21*
