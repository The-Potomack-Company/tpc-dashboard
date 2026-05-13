---
phase: 01-infrastructure-shared-ui-kit
plan: 06
subsystem: ui-kit
tags: [INFR-03, ui-kit, vite, tree-shaking, dev-only-route, dynamic-import, top-level-await, dogfooding]

requires:
  - phase: 01-infrastructure-shared-ui-kit
    provides: "src/components/kit/Sparkline | KpiCard | PayloadViewerModal | DateRangeFilter (plan 01-05 — primitives consumed by /kit demo)"
  - phase: 01-infrastructure-shared-ui-kit
    provides: "src/hooks/useDateRange + useTimezone (plan 01-04 — DateRangeFilter consumes useDateRange directly; Kit page renders useTimezone DST spot-check)"
provides:
  - "src/pages/Kit — dev-only /kit demo page rendering every UI-kit primitive in multiple states (DateRangeFilter, 3 sparkline shapes, 6 KpiCard variations, PayloadViewerModal, useTimezone DST spot-check)"
  - "src/App.tsx — router gated /kit route via top-level `await import('./pages/Kit')` behind `import.meta.env.DEV` ternary, tree-shaken from production by Rollup"
  - "scripts/verify-no-kit-in-dist.mjs — post-build assertion that production dist/ contains no `KitPage`, `routes/kit`, or `\"/kit\"` literal"
affects:
  - "Phase 1 closes — INFR-03 fully validated (UI-kit primitives shipped 01-05, demo page + tree-shake guarantee 01-06)"
  - "Phase 2 (/extension), Phase 3 (/activity), Phase 5 (/live) — dogfooding surface for future kit additions; tree-shake verifier extensible to other dev-only routes"

tech-stack:
  added: []
  patterns:
    - "Dev-only route via top-level `await import('./pages/Kit')` gated by `import.meta.env.DEV` ternary — Vite substitutes literal `false` in production, Rollup drops the dynamic-import branch"
    - "Post-build forbidden-string grep over dist/ as a CI-grade tree-shake assertion (parallel to plan 01-02's prebuild service-role-key grep over src/)"
    - "Conditional JSX route registration `{KitPage && <Route ... />}` as belt-and-braces alongside the import-time gate"

key-files:
  created:
    - "src/pages/Kit.tsx — Dev-only /kit demo page; renders DateRangeFilter, 3 Sparklines (up/down/flat), 6 KpiCards (loading + 5 variations), PayloadViewerModal with extension-shaped catalog_batch payload, useTimezone DST spot-check (Jan + Jul ET), useDateRange URL display"
    - "scripts/verify-no-kit-in-dist.mjs — Recursive walker over dist/ scanning `.js|.mjs|.cjs|.html|.css` for forbidden strings `KitPage`, `routes/kit`, `\"/kit\"`. Excludes source maps. Exits 1 on missing dist/ or any leak; exits 0 with `OK:` summary on clean bundle."
  modified:
    - "src/App.tsx — Replaced minimal router with import.meta.env.DEV-gated /kit route via top-level await dynamic import; conditional JSX route registration; comment block citing tsconfig ES2022/ESNext requirement"
    - ".planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md — Appended 'Plan 01-06' section recording 18 errors / 34 warnings of pre-existing ESLint debt on the 01-05 base commit (out-of-scope for this plan per SCOPE BOUNDARY rule)"

key-decisions:
  - "Three forbidden strings instead of one (`KitPage`, `routes/kit`, `\"/kit\"`) — covers exported symbol, chunk directory, and inline path literal independently. Any single one in dist/ is a tree-shake regression."
  - "Source maps (.map) excluded from the verifier scan — minified-but-mapped production builds can legitimately retain symbol names in sourcemaps for debugging; the SC2 contract is the runtime bundle, not debug assets."
  - "Pre-existing lint debt (52 problems, 18 errors / 34 warnings on base commit `0e3f92b`) deferred to a future cleanup plan. Plan 01-06's three modified files lint clean independently. SCOPE BOUNDARY rule applied: only auto-fix issues directly caused by the current task's changes."
  - "Top-level await is intentional — `tsconfig.app.json` is already at `target: ES2022` + `module: ESNext`, so no compiler change needed. RESEARCH Pitfall 7 documents the failure mode if a future contributor downgrades the target."

patterns-established:
  - "/kit dev demo as Phase 1's lightweight Storybook substitute (D-11 — no full Storybook commitment in v2.0)"
  - "Post-build verifier scripts under scripts/ scanning dist/ for forbidden strings — pattern reusable for any future production-bundle invariant"
  - "Conditional dynamic route registration — when adding more dev-only routes, use the same `const X = import.meta.env.DEV ? (await import(...)).X : null;` shape and `{X && <Route ... />}` JSX gate"

requirements-completed: [INFR-03]

duration: ~30min
completed: 2026-04-28
---

# Phase 1 Plan 06: `/kit` Demo Route + Tree-Shake Verifier (INFR-03) — Summary

**Dev-only `/kit` demo page rendering every shared UI-kit primitive (DateRangeFilter, Sparkline×3, KpiCard×6, PayloadViewerModal, useTimezone DST spot-check), gated behind `import.meta.env.DEV` with a top-level-await dynamic import so Rollup tree-shakes the route from production bundles, plus a post-build `dist/`-grep verifier asserting absence of `KitPage`, `routes/kit`, and `"/kit"` in shipped artifacts. Closes INFR-03 and Phase 1.**

## Performance

- **Duration:** ~30 min (across two executor sessions: TDD run for Tasks 1-3, then continuation for SUMMARY/STATE/ROADMAP)
- **Completed:** 2026-04-28
- **Tasks:** 4 (3 code + 1 operator visual-verify checkpoint, all complete)
- **Files created:** 2 (`src/pages/Kit.tsx`, `scripts/verify-no-kit-in-dist.mjs`)
- **Files modified:** 1 (`src/App.tsx`)
- **Plus:** 1 deferred-items.md append

## Accomplishments

- `/kit` demo page authored with every Phase 1 UI primitive in multiple states, plus a useTimezone DST spot-check (Jan 15 / Jul 15 ET) and the URL-bound DateRangeFilter window display.
- Production bundle proven kit-free: `npm run build && node scripts/verify-no-kit-in-dist.mjs` exit 0, verifier prints `OK: No references to KitPage, routes/kit, "/kit" in dist/. /kit is dev-only.`
- Operator visually verified `/kit` at `http://localhost:5173/kit` — all primitives render, modal Esc/backdrop/Copy interactions work, DST spot-check shows `12:00 PM ET` for both winter and summer test dates.
- D-11 tree-shake guarantee now CI-grade: any future regression in the `import.meta.env.DEV` gate (e.g., a `KitPage` import escaping into a shared module) trips the verifier on the next build.
- INFR-03 closed: ROADMAP Phase 1 Success Criterion 2 fully satisfied across plans 01-05 (primitives) + 01-06 (demo + tree-shake guarantee).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author /kit demo page rendering all UI-kit primitives** — `19bab79` (feat)
2. **Task 2: Wire dev-only /kit route via import.meta.env.DEV** — `17d330c` (feat)
3. **Task 3: Implement post-build /kit tree-shake verifier (TDD)** — `623eb57` (test, RED) → `ba2465d` (feat, GREEN)
4. **Task 4: Operator visual-verify checkpoint** — no commit (operator-verified, see Verification below)

**Out-of-scope deferral note:** `12a14de` (docs) — appended pre-existing lint debt to `.planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md`.

**Plan metadata commit:** authored by this continuation session — see `git log` for the final hash.

## Files Created/Modified

### Created

- `src/pages/Kit.tsx` — Default-export-free named-export `KitPage`. Five sections in a max-w-4xl vertical stack: header with the dev-only callout, `<DateRangeFilter>` plus a "Window" label that round-trips through `useTimezone.formatRange(from, to)`, a 3-column grid of `<Sparkline>` (up / down / flat) inheriting color via `currentColor`, a 2- or 3-column grid of 6 `<KpiCard>` instances (loading skeleton, plain string/number, delta up green, delta down red, delta flat gray, sparkline slot), a `<PayloadViewerModal>` button + modal showing an extension-shaped `catalog_batch` payload (id / event_type / user_email / extension_version / created_at / session_id / counts / execution_time_ms / cancelled / error_message / items_content array — RFC 2606 `.example` TLD per T-1-FIXTURE-PII), and a `useTimezone` spot-check listing two DST test dates that should both render `12:00 PM ET`.
- `scripts/verify-no-kit-in-dist.mjs` — Pure ES module; uses `node:fs` and `node:path` only. Recursive `walk()` over `dist/`; checks file extension regex `\.(js|mjs|cjs|html|css)$` (excludes `.map` source maps, fonts, and images); for each matched file scans contents for any of `['KitPage', 'routes/kit', '"/kit"']`; prints `LEAK: '<needle>' found in production bundle: <path>` for each hit; exits 1 with summary if any hits, 0 with `OK:` line otherwise. Pre-flight check exits 1 if `dist/` doesn't exist (`Run \`npm run build\` first.`).

### Modified

- `src/App.tsx` — Replaced the minimal pre-v2.0 router with the dev-gated pattern from RESEARCH § `/kit` dev-only route:

```tsx
const KitPage = import.meta.env.DEV
  ? (await import('./pages/Kit')).KitPage
  : null;
```

Vite replaces `import.meta.env.DEV` with the literal `false` at build time; Rollup statically evaluates `false ? ... : null` to `null` and drops the dynamic-import chunk. The route registration is also wrapped: `{KitPage && <Route path="/kit" element={<KitPage />} />}` — belt-and-braces so the route never registers in production. A leading comment block cites the `tsconfig.app.json` ES2022 + ESNext requirement (RESEARCH Pitfall 7).

- `.planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md` — Appended `## Plan 01-06 (2026-04-28)` section documenting 52 pre-existing ESLint problems (18 errors / 34 warnings) measured on the 01-05 base commit `0e3f92b` (i.e., before any 01-06 change). Plan 01-06's three modified files lint clean independently. Sample violations cited (DateRangeFilter set-state-in-effect from plan 01-05; unused eslint-disable directives in authStore from v1.0). Resolution path: dedicated lint-cleanup plan in milestone close-out, or piecemeal fixes inside future plans that touch the offending files.

## Decisions Made

- **Top-level await + import.meta.env.DEV ternary as the tree-shake mechanism** — chosen over React.lazy because the goal is build-time elimination, not runtime code-splitting. With `lazy()`, the import factory is itself shipped to production and the chunk fetch could happen at runtime if anything ever pointed at `/kit`. The ternary at module scope evaluates to `null` at build time and Rollup drops the import expression entirely.
- **Three forbidden strings, not one** — `KitPage` (exported symbol), `routes/kit` (chunker-emitted directory if Vite's manualChunks ever auto-grouped routes), `"/kit"` (the inline path literal that would only exist if the conditional `<Route>` registered). The three checks are independent failure modes; covering all three keeps false negatives at zero.
- **Excluding source maps from the scan** — `.map` files can legitimately retain symbol names for production-debugging support without violating the SC2 contract, which is about runtime delivery to end users.
- **No vite.config.ts modification** — the plan had a contingency to set `build.target: 'esnext'` if Vite's default esbuild target was too low for top-level await. The default (ES2020+) was sufficient; `npm run dev` and `npm run build` both passed without changes.
- **Defer lint debt rather than fix** — the 52-problem total on the base commit is pre-existing; touching plan 01-05 or v1.0 files to clean them up would either be scope creep (Rule 1/2 only triggers when the current task introduces or relies on the issue) or carry merge-conflict risk against in-flight planning. Recorded in deferred-items.md so a future cleanup plan can pick it up.

## Deviations from Plan

None — plan executed exactly as written across Tasks 1-3. The operator visual-verify checkpoint (Task 4) returned `approved` and the orchestrator independently re-ran `npm run build && node scripts/verify-no-kit-in-dist.mjs` (both exit 0) before this continuation session. The deferred-items.md append in commit `12a14de` is not a deviation — it documents an out-of-scope discovery (pre-existing lint debt) per the SCOPE BOUNDARY rule.

## Issues Encountered

- **Operator visual-verify checkpoint** completed cleanly — no `issue:` reply needed. All five subsections rendered correctly (DateRangeFilter, Sparkline×3, KpiCard×6, PayloadViewerModal interactions, useTimezone DST spot-check); modal Copy / Esc / backdrop dismiss all worked; DST spot-check showed `12:00 PM ET` for both Jan 15 and Jul 15.

## Threat Mitigations Applied

| Threat ID | Mitigation |
| --------- | ---------- |
| T-1-DEMO-LEAK (Information Disclosure — Kit.tsx in production) | `import.meta.env.DEV` ternary + top-level await pattern in `src/App.tsx`; production bundle proven kit-free by `scripts/verify-no-kit-in-dist.mjs` (3 forbidden strings, all absent). Rollup tree-shakes the dynamic-import branch when DEV resolves to literal `false`. |
| T-1-FIXTURE-PII (Information Disclosure — SAMPLE_PAYLOAD) | Sample uses `specialist@tpc.example` (RFC 2606 `.example` TLD — guaranteed unowned), placeholder UUIDs, plausible-but-fake counts. Demo page is dev-only so even if the fixture leaked, it never reaches end users. |
| T-1-SRK (Information Disclosure — Service-role-key leak) | Neither `src/pages/Kit.tsx` nor `src/App.tsx` references `SUPABASE_SERVICE_ROLE_KEY`. Plan 01-02's prebuild guard (`scripts/check-no-service-role-in-src.mjs`) re-verified across `npm run build`. |
| T-1-TOP-LEVEL-AWAIT (Availability — module evaluation) | `tsconfig.app.json` already targets `ES2022` + `module: ESNext`. If a future contributor downgrades the target, `npm run build` errors out on `tsc -b` before any deploy. Comment block in `src/App.tsx` cites RESEARCH Pitfall 7 to make the dependency visible to readers. |

## Verification

- `npm run build` — exit 0 (prebuild service-role guard clean, tsc strict + Vite production build both green).
- `node scripts/verify-no-kit-in-dist.mjs` — exit 0 with stdout `OK: No references to KitPage, routes/kit, "/kit" in dist/. /kit is dev-only.`
- `npm run dev` — Vite served `/kit` at `http://localhost:5173/kit` without top-level-await errors; Network tab confirmed `Kit.tsx` loaded as a separate ES module dynamic import after `App.tsx` evaluated.
- Operator visual checklist (7 steps in `<how-to-verify>`) — all green; reply was `approved`.
- Orchestrator re-verified post-checkpoint: `npm run build && node scripts/verify-no-kit-in-dist.mjs` exited 0 again on commit `12a14de`.

## Success Criteria Addressed

- [x] `src/pages/Kit.tsx` renders every UI-kit primitive in multiple states plus a `useTimezone` DST spot-check
- [x] `src/App.tsx` uses `import.meta.env.DEV` + top-level await to tree-shake the route in production
- [x] `scripts/verify-no-kit-in-dist.mjs` exits 0 after `npm run build`; would exit 1 if the DEV guard were broken
- [x] Operator verified `/kit` page at `http://localhost:5173/kit` — all components render correctly + modal interactions work + DST timestamps correct
- [x] **ROADMAP Phase 1 Success Criterion 2 fully satisfied:** "A `<DateRangeFilter>` (Today / 7d / 30d / custom), `<Sparkline>`, `<KpiCard>`, and `<PayloadViewerModal>` render in a shared-kit Storybook/demo page with Tailwind v4 styling and typed props." (Components from plan 01-05; demo + visual verification from this plan.)

## Phase 1 Closeout: All 5 ROADMAP Success Criteria

| # | Criterion | Status | Plan(s) |
| - | --------- | ------ | ------- |
| 1 | Fresh dev can `supabase db push` against fresh project, reproduce prod schema, no drift, no orphaned v1.0 objects | ✅ | 01-01 |
| 2 | `<DateRangeFilter>` + `<Sparkline>` + `<KpiCard>` + `<PayloadViewerModal>` render in shared-kit demo page with Tailwind v4 + typed props | ✅ | 01-05 + 01-06 |
| 3 | `useDateRange` reflects filter state in URL (refresh/back/forward preserves) and `useTimezone` formats timestamps in ET via date-fns-tz | ✅ | 01-04 (hooks) + 01-05 (DateRangeFilter consumer) + 01-06 (DST spot-check rendered live) |
| 4 | Admin-only SELECT RLS on `public.analytics_events`; admin SELECTs rows, non-admin gets 0, anon INSERT still works (test insert) | ✅ | 01-03 (migration + RLS) + 01-01 (three-client RLS verification 5/5 pass) |
| 5 | Service-role admin-client module outside `src/`, documented in CLAUDE.md, `grep -r SUPABASE_SERVICE_ROLE_KEY src/` returns nothing | ✅ | 01-02 (admin client + prebuild guard + CLAUDE.md Conventions) |

**INFR-02 / INFR-03 / INFR-04 / INFR-05 / INFR-06 — all five Phase 1 requirements complete.**

## User Setup Required

None — Phase 1 is purely additive frontend + Supabase migrations. No new env vars, no dashboard configuration, no external service signups beyond what was already in place for v1.0.

## Next Phase Readiness

**Phase 1 closes here.** No blockers introduced. Ready to plan Phase 2 (`/extension` — Extension Analytics).

**What Phase 2 inherits from Phase 1:**

- `<KpiCard>` + `<Sparkline>` for EXT-02 five event-type KPI cards with previous-period deltas and per-day sparklines
- `<DateRangeFilter>` + `useDateRange` for EXT-07 date filter with URL state
- `<PayloadViewerModal>` for EXT-06 errors-table "view payload" action
- `useTimezone` for ET timestamp display across the page
- Admin-only SELECT RLS on `public.analytics_events` (plan 01-03) — Phase 2 queries can SELECT under the dashboard's authenticated session
- `analytics_events` table shape mirrors extension migration 001 — Phase 2 query keys + Zod schemas can be derived from the dashboard-side migration without depending on the extension repo
- Tree-shake verifier pattern — extensible to any future dev-only route Phase 2 ships (e.g., a `/kit/extension` sub-demo if EXT-02..05 introduce more primitives)

## Self-Check: PASSED

- FOUND: `src/pages/Kit.tsx`
- FOUND: `src/App.tsx` (modified — contains `import.meta.env.DEV`)
- FOUND: `scripts/verify-no-kit-in-dist.mjs`
- FOUND: `.planning/phases/01-infrastructure-shared-ui-kit/deferred-items.md` (Plan 01-06 section appended)
- FOUND: commit `19bab79` (Task 1 — Kit.tsx)
- FOUND: commit `17d330c` (Task 2 — App.tsx DEV gate)
- FOUND: commit `623eb57` (Task 3 RED — failing verifier stub)
- FOUND: commit `ba2465d` (Task 3 GREEN — verifier implementation)
- FOUND: commit `12a14de` (deferral note for pre-existing lint debt)

---
*Phase: 01-infrastructure-shared-ui-kit*
*Completed: 2026-04-28*
