# Phase 7 Plan — Unified Design Migration

## Wave 1 — Foundations (sequential)

### 07-01 — Bootstrap design assets
- Copy `tpc-unified-tokens.css`, `tpc-unified-base.css`,
  `tpc-unified-tokens.ts`, `prototype-primitives.jsx`,
  `prototype-icons.jsx` from cataloger to
  `dashboard/docs/design-handoff/`.

### 07-02 — Wire tokens + dark mode
- Create `src/ui/tokens/tokens.css` (mirror of design-handoff CSS).
- Create `src/ui/tokens/base.css` (mirror of companion base primitives).
- Create `src/ui/tokens/tokens.ts` (TS mirror for JS consumers).
- Create `src/ui/tokens/initTheme.ts` (runtime dark-mode listener).
- Create `src/ui/tokens/index.ts` (barrel).
- Rewrite `src/index.css`:
  - `@import "tailwindcss"`
  - `@import "./ui/tokens/tokens.css"`
  - `@import "./ui/tokens/base.css"`
  - `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))`
  - `@theme inline { --color-bg: var(--bg); … --radius-sm: var(--radius-sm); … --font-display: var(--font-display); … }`
- Update `index.html`: add `class="tpc"` to `<html>`, drop in the
  pre-paint dark script.
- Update `src/main.tsx`: call `initTheme()` before render.

## Wave 2 — Primitives + Icons

### 07-03 — UI primitives
React translations of `prototype-primitives.jsx`. Each file under
`src/ui/primitives/`:
- `Button.tsx` — variants: `primary | secondary | ghost | danger`,
  sizes: `sm | md | lg`, `fullWidth`, optional `icon` / `iconRight`.
- `Badge.tsx` — tones: `neutral | ok | warn | err | info`, optional `dot`.
- `Input.tsx` — applies `.tpc-input` class.
- `Card.tsx` — applies `.tpc-card`.
- `Eyebrow.tsx` — applies `.tpc-eyebrow`.
- `Bar.tsx` — bar track/fill primitive (`<Bar value={0.42} />`).
- `Placeholder.tsx` — hatched placeholder for missing imagery.

### 07-04 — Icon library
- Port ~50 SVG icons from `prototype-icons.jsx`'s `Icon` + `IconExt`
  exports to a typed `src/ui/icons/manifest.tsx` (each entry returns a
  `<svg>` React element with `currentColor`).
- Create `src/ui/icons/Icon.tsx` — `<Icon name="search" size={14} />`
  reads from manifest.
- Port the three app icons (`VoiceAppIcon`, `ExtensionAppIcon`,
  `DashboardAppIcon`) to `src/ui/icons/AppIcons.tsx` (rounded tile +
  glyph variants).

## Wave 3 — Shared kit migration

### 07-05 — Migrate KpiCard / Sparkline / DateRangeFilter / PayloadViewerModal
- Preserve public API (props + test selectors).
- Replace `bg-white`, `border-gray-200`, etc. with token-backed
  Tailwind classes (e.g. `bg-bg border-rule`).
- Sparkline default `stroke` switches from `currentColor` (which inherits
  context) to `var(--accent)` for the explicit accent line; the prop
  remains overridable.
- DateRangeFilter "active" preset goes from `bg-gray-900` to
  `bg-accent text-accent-ink`.
- Existing colocated tests must still pass.

## Wave 4 — Page + component sweep

### 07-06 — Migrate Extension, Activity, SessionDetail, StuckItems pages + DashboardLayout + helpers
- `DashboardLayout.tsx` — replace `bg-white / bg-gray-50 / border-gray-*`
  with token classes; sidebar uses `bg-bg-2 border-rule`. Header initial
  avatar uses `bg-accent text-accent-ink`. Sidebar app-tile uses the
  unified `DashboardAppIcon` (with `corner={null}` mark variant).
- Sweep `bg-blue-* / text-blue-* / focus:ring-blue-* / accent` literal
  usages across `src/components/`, `src/pages/`, helpers.
- Replace inline nav SVGs with `<Icon name=…/>`.

## Wave 5 — Favicon + Playwright

### 07-07 — Swap favicon to DashboardAppIcon
- Write `public/favicon.svg` rendering the dial-icon glyph (uses literal
  hex colors derived from light-mode tokens — favicons can't read CSS
  vars).
- Update `index.html` `<link rel="icon">` to the new SVG.
- Remove `public/vite.svg`.

### 07-08 — Playwright visual smoke
- Install `@playwright/test`.
- Add `playwright.config.ts` with a `webServer` that runs `npm run dev`
  on port 5173 (skip if `VITE_SUPABASE_URL` env not set).
- Add `tests/e2e/visual-smoke.spec.ts`:
  - Visit `/`, capture screenshot.
  - Visit `/login`, capture.
  - Toggle `.tpc-dark` on `<html>`, capture.
  - Assert no console errors.
- Add unit test asserting `src/ui/tokens/tokens.ts` matches expected
  shape (regression guard for token drift between CSS / TS).

## Verification

- `npm run typecheck` (via `tsc -b --noEmit` in `build`)
- `npm run lint`
- `npm run build` (full prebuild verifier chain + Vite build)
- `npm test` (Vitest — 598+ tests)
- `npx playwright test` (only if `@playwright/test` installed)
