// src/ui/tokens/index.ts — Phase 7 barrel.
//
// Stable public API for src/ui consumers. Mirrors the cataloger
// Phase 22 surface so a future shared package can extract this without
// divergence.

export {
  tpcUnifiedLight,
  tpcUnifiedDark,
  fonts,
  radii,
  fontSizes,
  space,
  paletteFor,
} from "./tokens";
export type { TpcUnifiedPalette } from "./tokens";

export { initTheme } from "./initTheme";
export type { InitThemeOpts, ThemeOverride } from "./initTheme";
