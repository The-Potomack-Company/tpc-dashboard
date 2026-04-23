// Phase 6 Plan 06-04 — URL ?sales= parser for /sales/compare.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-RESEARCH.md § Pattern 5.
// REQ-ID: SALE-04, SALE-05 (URL handling).
// CSV_SEPARATOR is shared with SaleSelectionFooter — change in one place.
// Character whitelist [A-Za-z0-9_-]+ mitigates T-06-04-01 (URL tampering / XSS).

export const CSV_SEPARATOR = ',' as const;

export type ParsedSales =
  | { kind: 'ok'; saleNumbers: string[] }
  | {
      kind: 'invalid';
      reason: 'empty' | 'too-few' | 'too-many' | 'malformed';
    };

// Literal regex — no user-input concat. Matches the whitelist used by the
// 06-01 hook's T-06-01-05 mitigation: the only characters allowed in a sale
// number are letters, digits, hyphen, underscore. Anything else (quote,
// angle bracket, slash, period) flips the ?sales= param to 'malformed'.
const SALE_NUMBER_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Parses a URL `?sales=` query value into a discriminated union.
 *
 * Empty: `raw == null` OR `raw.trim() === ''` → `{ kind: 'invalid', reason: 'empty' }`.
 * Split/trim/dedup: split on CSV_SEPARATOR, trim each token, drop empty
 * strings, then deduplicate preserving first-seen order (so ?sales=A,A,B
 * becomes ['A', 'B']).
 *
 * Validation order matters:
 *   1. malformed (any token fails whitelist) — reject BEFORE length checks
 *      so an injection attempt with 2-4 tokens doesn't slip through as
 *      'ok' because the count branch fires first.
 *   2. too-few (< 2)
 *   3. too-many (> 4)
 *   4. ok
 *
 * Deduplication uses Set iteration order (insertion order per ES2015+).
 */
export function parseSalesParam(raw: string | null): ParsedSales {
  if (raw == null || raw.trim() === '') {
    return { kind: 'invalid', reason: 'empty' };
  }

  const tokens = raw
    .split(CSV_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Dedup preserving first-seen order. Array.from(new Set(...)) retains
  // insertion order per ES spec; no additional sort.
  const list = Array.from(new Set(tokens));

  if (list.some((s) => !SALE_NUMBER_RE.test(s))) {
    return { kind: 'invalid', reason: 'malformed' };
  }

  if (list.length < 2) {
    return { kind: 'invalid', reason: 'too-few' };
  }

  if (list.length > 4) {
    return { kind: 'invalid', reason: 'too-many' };
  }

  return { kind: 'ok', saleNumbers: list };
}
