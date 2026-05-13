# Phase 7 — Unified Design Migration

## What

Bring the dashboard onto the same unified TPC design system shared with
the **voice cataloger** and the **AI Cataloger Chrome extension**. Net-new
scope inserted into v2.0 (after Phase 3 / before Phase 4) — pure visual
treatment, no logic changes.

Canonical source of design record:
`tpc-voice-cataloger/docs/design-handoff/` —

- `tpc-unified-tokens.css` (single source of truth for color / type / shape)
- `tpc-unified-base.css` (companion base primitives — buttons, badges, inputs, cards)
- `tpc-unified-tokens.ts` (mirror for JS consumers)
- `prototype-primitives.jsx` (React prototype primitives)
- `prototype-icons.jsx` (~50 inline SVG icons + 3 app icons; dashboard's
  is the analog dial/gauge motif).

## Why

Today the dashboard ships its own palette (`--color-accent: #2563eb` blue,
gray neutrals, no inline SVG icon library). The cataloger landed Phase 22
which standardized the cross-app palette (cool near-white surfaces,
teal-blue accent, sand for data viz) on top of OKLCH tokens + Tailwind v4
`@theme inline` + class-based dark mode (`.tpc-dark`). The extension is
on the same system.

The dashboard is the odd one out — different palette, no icon library,
no dark mode wiring — which makes it visually disjoint from the other
two TPC apps an admin user moves between. Phase 7 fixes that.

## Scope (in)

1. Bootstrap `docs/design-handoff/` from cataloger canonical files.
2. Wire tokens into the build at `src/ui/tokens/{tokens.css, base.css,
   tokens.ts, initTheme.ts, index.ts}` (mirrors cataloger Phase 22).
3. Replace `src/index.css` palette with `@theme inline` bridge to
   `--color-bg / --color-ink / --color-accent / …` tokens; add
   `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))`.
4. Add `<html class="tpc">` + pre-paint dark bootstrap script in
   `index.html`.
5. Build `src/ui/primitives/{Button,Badge,Input,Card,Eyebrow,Bar,Placeholder,Icon}.tsx`
   as typed React translations of `prototype-primitives.jsx`.
6. Port ~50 inline SVGs from `prototype-icons.jsx` to a typed icon
   manifest (`src/ui/icons/manifest.tsx`) consumed by `<Icon name=…/>`.
7. Migrate shared kit (`KpiCard`, `Sparkline`, `DateRangeFilter`,
   `PayloadViewerModal`) from raw Tailwind gray palette to token-backed
   classes. Public props unchanged.
8. Sweep `bg-blue-*` / `text-blue-*` / `--color-accent` usage across
   `src/pages/`, `src/components/`, `src/layouts/` and migrate to
   token-backed classes.
9. Replace `public/vite.svg` favicon with the unified `DashboardAppIcon`
   (analog dial). Drop the dial mark into the sidebar header app-tile.
10. Add Playwright visual smoke (`tests/e2e/visual-smoke.spec.ts`):
    boot dev server, visit each route, take screenshots, toggle
    `.tpc-dark`, assert no console errors. Gate gracefully if Supabase
    env not present.

## Scope (out)

- No feature changes. No new analytics flows. No SQL.
- No font hosting changes (CSS variable falls back to system fonts —
  Phase 25 / 26 can ship hosted EB Garamond / IBM Plex Mono if desired).
- No replacement for the `focus:ring-accent` Tailwind token semantics —
  we keep those names so the cascade still works; tokens just change
  what they resolve to.

## Constraints

- **D-13 (cataloger Phase 22)**: tokens live in `src/ui/tokens/`, NOT
  scattered. The base.css companion reads CSS vars only — never
  hard-codes color. `@theme inline` MUST live in `src/index.css`
  (Tailwind v4 ignores `@theme` inside `@import-ed` CSS).
- **Class-based dark**: `.tpc-dark` toggles via `<html>`. Existing
  Tailwind `dark:` utilities continue to work because
  `@custom-variant dark` rewrites the dark variant to match `.tpc-dark`.
- **No behavior changes**: all 50+ pages/components keep their props,
  hooks, queries, RLS contracts.
- **All existing tests must keep passing** (598 src tests + 11 prebuild
  verifiers).
