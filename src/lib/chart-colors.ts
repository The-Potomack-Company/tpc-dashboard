// Phase 5 — 8-color categorical palette for Recharts series. DO NOT import
// from UI chrome components. Charts only. Contract:
// .planning/phases/05-trend-analysis/05-UI-SPEC.md § Color → Chart Palette.
//
// Disambiguation — `chart-blue` (CHART_PALETTE[0] = #2563eb) and the Phase 1
// `--color-accent` token resolve to the same hex but carry different semantic
// intent. Chart series colors encode "which data is which" (data identity);
// the accent encodes "primary actionable element" (UI chrome). A future
// palette shift in one role must not ripple to the other — hence two
// references to what is currently the same value.

/**
 * 8-color categorical palette. Downstream chart components import by index
 * (e.g. `CHART_PALETTE[0]` for TRND-01 net revenue stroke). Frozen tuple so
 * accidental reassignment at runtime is impossible.
 */
export const CHART_PALETTE = [
  '#2563eb', // 0 blue-600    — TRND-01 net revenue; TRND-06 registered bidders (left axis)
  '#059669', // 1 emerald-600 — TRND-02 sell-through; TRND-05 within-estimate band
  '#d97706', // 2 amber-600   — TRND-05 below-estimate band
  '#e11d48', // 3 rose-600    — TRND-05 above-estimate band
  '#7c3aed', // 4 violet-600  — reserved (future 5th+ series)
  '#0891b2', // 5 cyan-600    — rolling-3 trend overlay on TRND-01/02 (dashed)
  '#ea580c', // 6 orange-600  — TRND-06 winning buyers (right axis)
  '#65a30d', // 7 lime-600    — reserved (future series / drill-down highlight)
] as const;

/** Cartesian-grid stroke — gray-200. Neutral, low-contrast so data sits on top. */
export const CHART_GRID_STROKE = '#e5e7eb';

/** Axis-tick label fill — gray-500. Meets WCAG AA on white/dark surfaces. */
export const CHART_AXIS_TICK_FILL = '#6b7280';

/**
 * ChartTooltip background — gray-900. 18.1:1 contrast with white text per
 * UI-SPEC § Accessibility Floor. Inverted to gray-100 in dark mode via
 * Tailwind classes on the tooltip component itself — these constants cover
 * the light-mode surface for any component that needs a raw hex.
 */
export const CHART_TOOLTIP_BG = '#111827';

/** ChartTooltip primary text — white. Header and value rows. */
export const CHART_TOOLTIP_TEXT = '#ffffff';

/** ChartTooltip secondary/label text — gray-200. Row labels (e.g. "Net revenue:"). */
export const CHART_TOOLTIP_LABEL = '#e5e7eb';
