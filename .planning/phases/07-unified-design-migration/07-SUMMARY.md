# Phase 7 — Unified Design Migration: SUMMARY

**Status:** Complete (human_needed) — pending operator UAT.
**Branch:** `feature/v2-pivot-reset`
**Date:** 2026-05-12

## What shipped

Pure visual treatment migration — no logic / no feature changes. The
dashboard now reads from the same token system as the voice cataloger
(Phase 22) and the AI Cataloger Chrome extension. One brand, three apps.

### Foundations

- `docs/design-handoff/` — canonical design assets copied from cataloger
  (`tpc-unified-tokens.css`, `tpc-unified-base.css`,
  `tpc-unified-tokens.ts`, `prototype-primitives.jsx`,
  `prototype-icons.jsx`).
- `src/ui/tokens/{tokens.css,base.css,tokens.ts,initTheme.ts,index.ts}` —
  runtime mirror, .tpc + .tpc-dark wrapper classes, base .tpc-btn /
  .tpc-card / .tpc-input / .tpc-eyebrow primitives.
- `src/index.css` — Tailwind v4 `@theme inline` bridge maps
  `--color-bg / --color-ink / --color-accent / …` to the runtime tokens.
  `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` enables
  class-based dark mode so existing `dark:` utilities continue to work.
- `index.html` — `<html class="tpc">` + pre-paint dark bootstrap
  `<script>` + favicon swap.

### Primitives + Icons (`src/ui/`)

- 7 typed React primitives: `Button`, `Badge`, `Input`, `Card`,
  `Eyebrow`, `Bar`, `Placeholder`.
- ~56 SVG icons ported from `prototype-icons.jsx` to a typed
  `manifest.tsx` consumed by `<Icon name="…" />`.
- 3 app icons (`Dashboard / Voice / Extension`) with full-tile +
  inline-mark variants.

### Shared kit (`src/components/kit/`)

- `KpiCard`, `Sparkline`, `DateRangeFilter`, `PayloadViewerModal` —
  migrated to token classes. Public APIs and test selectors unchanged.
  Sparkline default stroke shifted from `currentColor` to `var(--accent)`.

### Page + component sweep

- `DashboardLayout` — sidebar bg/border tokens, inline NavLink SVGs
  replaced with `<Icon name="…" />`, app-tile slot renders the
  `DashboardAppMark`, account-menu surface uses `.tpc-card`.
- Pages: `Login`, `Home`, `Activity`, `Extension`, `SessionDetail`,
  `StuckItems`, `Kit` — header text + section cards migrated.
- 32 components under `src/components/{activity,extension}/` swept
  through a token mapping via `/tmp/migrate-tokens.py`.
- Live indicator dots `bg-green-500` → `bg-ok`, paused dots
  `bg-gray-400` → `bg-ink-4`.
- AI status chips swapped to `bg-ok-wash text-ok` / `bg-err-wash text-err`.
- 16 test files updated in lock-step with class-substring assertions.

### Favicon + app mark

- `public/favicon.svg` ships the unified `DashboardAppIcon` dial motif
  with sRGB-converted token colors. `public/vite.svg` removed.
- DashboardAppMark inline variant lands in the sidebar header + Login +
  Home pages.

### Playwright visual smoke

- `playwright.config.ts` + `tests/e2e/visual-smoke.spec.ts`:
  - Boots `npm run dev` on port 5173 via the Playwright webServer
    config (reused across runs locally; fresh boot in CI).
  - Smokes 5 routes (/login, /, /extension, /activity, /activity/stuck)
    — captures full-page screenshots per route and asserts no console
    errors. Routes behind `<ProtectedRoute>` redirect to /login, which
    is the verified empty-state path.
  - Flips `.tpc-dark` on `<html>` and asserts the body's computed
    background color changes — proves dark mode actually engages.
  - Fetches `/favicon.svg` and asserts the dial icon body shipped (the
    `#0089b4` accent needle is the load-bearing visual proof).
- `src/ui/__tests__/tokens-a11y.test.ts` — 5 OKLCH lightness-envelope
  guards that catch the obvious regressions (bg/ink collapse, ramp
  inversion, accent-ink == accent).

## Commits (7)

| # | SHA | Title |
|---|------|-------|
| 1 | `dcea4ca` | feat(unified-design): bootstrap docs/design-handoff/ assets + Phase 7 scaffold |
| 2 | `7c1ac48` | feat(unified-design): wire tokens + dark mode into src/index.css |
| 3 | `5e47532` | feat(unified-design): build src/ui primitives + Icon library |
| 4 | `914ef61` | feat(unified-design): migrate shared kit (KpiCard, Sparkline, DateRangeFilter, PayloadViewerModal) |
| 5 | `f0b0709` | feat(unified-design): migrate page + component sweep |
| 6 | `a76a046` | feat(unified-design): swap favicon + app-tile to DashboardAppIcon |
| 7 | _(this commit)_ | test(unified-design): add Playwright visual smoke + token a11y test |

## Verification

| Gate | Result |
|------|--------|
| `tsc -b --noEmit` | clean |
| `npm run lint` | 17 problems, 7 errors, 10 warnings — identical to pre-migration baseline (no new lint introduced) |
| `npm run prebuild` | 11/11 verifiers green |
| `npm run build` | succeeds (50.65 kB CSS, 1.08 MB JS) |
| `vitest --run --project=src` | 78 files, 629/629 tests pass (was 598 — added 31 new tests: 13 primitives, 6 icons, 7 tokens, 5 a11y) |
| `vitest --run --project=scripts` | 0 tests (unchanged) |
| `playwright test` | 7/7 tests pass (5 route smokes + dark flip + favicon) |

## Known follow-ups (for operator UAT + future phases)

- Phase 2 + Phase 3 already have 10 + 7 outstanding human-UAT items
  (`02-09-HUMAN-UAT.md`, `03-09-HUMAN-UAT.md`). Neither blocks this
  visual-only migration — they're tracked for separate operator sessions.
- The semantic delta colors in `KpiCard` (`text-green-600` /
  `text-red-600` / `text-gray-500`) intentionally remain on Tailwind
  palette utilities. They encode positive / negative / neutral movement,
  not brand identity; collapsing them into a single accent would erase
  meaning. Future iteration can introduce token-backed `text-ok` /
  `text-err` semantics here if a stricter cross-app color contract is
  desired.
- The differentiated category chip palette in `UiRecentEventsFeed`
  (slate / sky / teal / violet / amber per UI-interaction type) is
  similarly preserved — encodes distinct event types, not brand accent.
- Severity tones (`STUCK_ITEMS_TONE` amber/red) preserved — encodes
  graduated warning, not brand accent.
- No raster favicon shipped (modern browsers handle SVG favicons
  natively). If a 192x192 / 512x512 PNG fallback is needed for older
  clients, render `DashboardAppIcon` via a small node script.

## Out of scope

- Font hosting (EB Garamond / IBM Plex Mono). The CSS variable falls
  back to system serif / system mono. A future phase can ship hosted
  webfonts.
- User-selectable dark mode (Phase 7 is system-pref only; the
  `initTheme()` opts.override hook is wired for a future preference UI).
- Schema changes. No SQL touched.
