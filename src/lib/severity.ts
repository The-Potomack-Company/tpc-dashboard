// src/lib/severity.ts
// Phase 3 / D-22 + UI-SPEC § Severity Tone Constants — Stuck-Items severity
// thresholds, tone palette, and pure classifier function.
//
// Source of truth for thresholds (D-22): N >= 5 → yellow; oldest > 6h → red
// (overrides yellow). N == 0 → none (quiet success state). 1 ≤ N < 5 still
// surfaces yellow rather than introducing a third "info" tone — see UI-SPEC
// decision note.
//
// Tunable: edit constants here only. Card and any future re-use stay in sync.

export const STUCK_ITEMS_THRESHOLDS = {
  yellowCount: 5, // N >= 5 stuck items → yellow tone
  redAgeHours: 6, // oldest > 6h → red tone (overrides yellow)
} as const;

// Severity tone palette — chosen at the 50/200/700 shade for low-vibration
// banner contrast (background-tinted card with deeper border + text).
// Yellow uses Tailwind 'amber' to avoid the `yellow-50` warm-cream wash that
// reads as "highlighter" rather than "warning". Amber is the same family as
// the Phase 2 spreadsheet_transform chart series (amber-600), but at 50/200/700
// these are distinct shades and a different visual role (banner vs chart bar).
export const STUCK_ITEMS_TONE = {
  none: {
    // N=0 quiet success: white card, no left border, gray icon, gray text.
    container: 'bg-white border border-gray-200',
    leftBorder: '', // no border for quiet state
    icon: 'text-gray-400',
    headline: 'text-gray-900',
    body: 'text-gray-500',
  },
  yellow: {
    // N >= 1 (with no red trigger): amber tint banner.
    container: 'bg-amber-50 border border-amber-200',
    leftBorder: 'border-l-4 border-l-amber-500',
    icon: 'text-amber-600',
    headline: 'text-amber-900',
    body: 'text-amber-800',
  },
  red: {
    // oldest > 6h: red banner. Trumps yellow.
    container: 'bg-red-50 border border-red-200',
    leftBorder: 'border-l-4 border-l-red-500',
    icon: 'text-red-600',
    headline: 'text-red-900',
    body: 'text-red-800',
  },
} as const;

export type StuckSeverity = 'none' | 'yellow' | 'red';

/**
 * Severity classifier — pure function. Used by StuckItemsAlertCard (Plan 03-06).
 *
 * Test invariants (UI-SPEC § Severity Tone Constants):
 *   classifyStuckSeverity({ count: 0,   oldestAgeHours: 999    }) === 'none'
 *   classifyStuckSeverity({ count: 100, oldestAgeHours: 6.5    }) === 'red'   (age trumps count)
 *   classifyStuckSeverity({ count: 1,   oldestAgeHours: 1      }) === 'yellow' (any N≥1 surfaces yellow)
 *   classifyStuckSeverity({ count: 5,   oldestAgeHours: 6      }) === 'yellow' (boundary stays yellow at exactly 6h — strict >, not >=)
 *   classifyStuckSeverity({ count: 5,   oldestAgeHours: 6.0001 }) === 'red'   (fractional excess flips red)
 */
export function classifyStuckSeverity(args: {
  count: number;
  oldestAgeHours: number;
}): StuckSeverity {
  if (args.count === 0) return 'none';
  if (args.oldestAgeHours > STUCK_ITEMS_THRESHOLDS.redAgeHours) return 'red';
  if (args.count >= STUCK_ITEMS_THRESHOLDS.yellowCount) return 'yellow';
  return 'yellow'; // N >= 1 but < 5 still surfaces (operator wants to see it)
}
