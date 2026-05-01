// src/lib/chartPalette.ts
// Phase 3 / D-104 (CONTEXT) + Open Q1 (locked) + UI-SPEC § Chart Palettes —
// shared chart color tokens for all four Phase 3 chart families.
//
// All four palettes follow the Phase 2 chart-palette convention: 600 shade
// for chart marks, semantic ordering, color-blind-friendly hue separation,
// no accent blue. Where a category overlaps with Phase 2's mapping (e.g.
// `processing` → `sky-600`, `queued` → `amber-600`), Phase 3 reuses the
// same hex deliberately (different chart, different page section, same
// semantic).
//
// Open Q1 lock (CONTEXT): SESSION_STATUS_COLOR includes 'completed' as the
// 5th key (#64748b slate-500). TPC App migration 20260320000000 added the
// 'completed' status; Phase 3 surfaces it as a 5th segment on the Export
// Pipeline horizontal stacked bar.

export type AiStatus =
  | 'pending'
  | 'processing'
  | 'queued'
  | 'done'
  | 'failed';

export type SessionStatus =
  | 'active'
  | 'submitted'
  | 'returned'
  | 'exported'
  | 'completed';

export type SessionMode = 'house' | 'sale';

// APP-04 AI-Status Donut palette — UI-SPEC § Chart Palettes / AI-Status.
export const AI_STATUS_COLOR: Record<AiStatus, string> = {
  pending: '#9ca3af', // gray-400 — flat slice
  processing: '#0284c7', // sky-600 — flat slice; same hex as Phase 2 catalog_batch
  queued: '#d97706', // amber-600 — flat slice; same hex as Phase 2 spreadsheet_transform
  done: '#16a34a', // green-600 — flat slice; "done = good" semantic
  failed: '#dc2626', // red-600 — pulled-out slice (visually distinct via Recharts)
};

// APP-05 Export Pipeline horizontal stacked bar palette — UI-SPEC § Chart
// Palettes / Export Pipeline. Order is left-to-right pipeline progression:
// active → submitted → returned → exported → completed (Open Q1 5th key).
export const SESSION_STATUS_COLOR: Record<SessionStatus, string> = {
  active: '#94a3b8', // slate-400 — calm, work in progress
  submitted: '#0284c7', // sky-600 — handed off, awaiting review
  returned: '#d97706', // amber-600 — needs attention; pipeline regression
  exported: '#16a34a', // green-600 — pipeline success terminus
  completed: '#64748b', // slate-500 — Open Q1 lock; final archived state
};

// APP-12 House-vs-Sale palette — UI-SPEC § Chart Palettes / House-vs-Sale.
// Indigo-600 chosen distinct from accent #2563eb (different hue family).
export const SESSION_MODE_COLOR: Record<SessionMode, string> = {
  house: '#4f46e5', // indigo-600 — cool, indoor connotation
  sale: '#0d9488', // teal-600 — reuses Phase 2 portal_upload hex
};

// APP-03 14-day items-per-specialist stacked bar palette — UI-SPEC § Chart
// Palettes / Specialist Cycle. Up to N specialists per stack; dynamic
// allocation. The 8th+ specialist falls back to slate (calmer hue) — at
// 8+ specialists the stack is too tall for color-by-color readability and
// operators rely on the legend.
//
// Why slate-600 is at the END (not start as in Phase 2): on this chart the
// most active specialist consumes the largest visual stack area; reserving
// the most distinct hues for the first-listed specialists ensures a
// 5-specialist team gets sky / teal / violet / amber / indigo — all distinct,
// none gray.
export const SPECIALIST_COLOR_CYCLE = [
  '#0284c7', // sky-600
  '#0d9488', // teal-600
  '#7c3aed', // violet-600
  '#d97706', // amber-600
  '#4f46e5', // indigo-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#475569', // slate-600 — END of cycle (fallback hue)
] as const;

/**
 * Returns a stable color for a specialist, given the FULL sorted list of
 * active specialist emails (alphabetical by email or display_name — the
 * caller decides). Deterministic: same (email, sortedEmails) → same hex.
 *
 * Pitfall (UI-SPEC "Why slate-600 is at the END"): if the active specialist
 * set changes mid-page-life (e.g. operator extends the date range and a
 * deactivated former specialist appears), colors may swap. The legend
 * always shows the current mapping, so this is acceptable.
 *
 * Fallback: if `email` is not in `sortedEmails` (`indexOf < 0`), returns
 * the cycle's first color. UI-SPEC line 382: `if (i < 0) return cycle[0]`.
 */
export function colorForSpecialist(
  email: string,
  sortedEmails: readonly string[],
): string {
  const i = sortedEmails.indexOf(email);
  if (i < 0) return SPECIALIST_COLOR_CYCLE[0];
  return SPECIALIST_COLOR_CYCLE[i % SPECIALIST_COLOR_CYCLE.length];
}
