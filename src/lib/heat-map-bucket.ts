// Phase 5 Plan 05-06 Task 1 — heat-map quintile bucketing + sorted dept codes.
//
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md § Heat-map color
// ramp (lines 245-283) and § Color → Quintile thresholds (lines 260-266).
//
// 5-bucket min-max ramp using Tailwind's blue-{100, 300, 500, 700, 900} tiers.
// We skip the even-hundred tiers so adjacent buckets are perceptually distinct
// at the 32×32px cell size (see UI-SPEC § Justification — why 5 buckets and
// not 9).
//
// SORTED_DEPT_CODES is the 22 seeded codes (migration
// 20260421000008_seed_departments) sorted alphabetically. All codes are
// uppercase letters, so ASCII compare === alphabetical order (SIL < SPT
// because I < P). Frozen so consumers (DepartmentHeatMap) can't mutate the
// canonical row order.

const DEPT_CODES_RAW = [
  'AMER',
  'ASD',
  'ASN',
  'ASNP',
  'BKS',
  'CER',
  'CLK',
  'DEC',
  'DRW',
  'ENT',
  'FRN',
  'GEN',
  'GLS',
  'MAP',
  'MDF',
  'MUS',
  'PER',
  'PND',
  'PNT',
  'SIL',
  'SPT',
  'TXTL',
];

/**
 * 22 department codes sorted alphabetically, frozen at module load. Used by
 * DepartmentHeatMap (plan 05-06) as the canonical row order so every dept
 * row renders whether or not it has data in the current range.
 */
export const SORTED_DEPT_CODES: readonly string[] = Object.freeze(
  [...DEPT_CODES_RAW].sort(),
);

const BUCKET_CLASSES = [
  'bg-blue-100 dark:bg-blue-900/40',
  'bg-blue-300 dark:bg-blue-800/60',
  'bg-blue-500 dark:bg-blue-700/80',
  'bg-blue-700 dark:bg-blue-600',
  'bg-blue-900 dark:bg-blue-500',
] as const;

/**
 * Returns one of the five blue-ramp Tailwind class strings based on the
 * min-max normalized position of `value` in `[min, max]`. Thresholds
 * (UI-SPEC lines 260-266):
 *   Q1: n < 0.2        → bg-blue-100 dark:bg-blue-900/40
 *   Q2: 0.2 <= n < 0.4 → bg-blue-300 dark:bg-blue-800/60
 *   Q3: 0.4 <= n < 0.6 → bg-blue-500 dark:bg-blue-700/80
 *   Q4: 0.6 <= n < 0.8 → bg-blue-700 dark:bg-blue-600
 *   Q5: n >= 0.8       → bg-blue-900 dark:bg-blue-500
 *
 * Edge case — `min === max`: every visible cell has the same value, so
 * min-max normalization is undefined (divide-by-zero). We return Q5
 * unconditionally: visually all cells are "the top of the ramp," which
 * matches the intuition "everything is at the maximum observed value."
 * Callers should NOT pass null values here — the no-data treatment
 * (NO_DATA_CELL_CLASS + NO_DATA_CELL_STYLE) is applied before bucketing.
 */
export function bucketClassFor(
  value: number,
  min: number,
  max: number,
): string {
  if (min === max) return BUCKET_CLASSES[4];
  const n = (value - min) / (max - min);
  if (n < 0.2) return BUCKET_CLASSES[0];
  if (n < 0.4) return BUCKET_CLASSES[1];
  if (n < 0.6) return BUCKET_CLASSES[2];
  if (n < 0.8) return BUCKET_CLASSES[3];
  return BUCKET_CLASSES[4];
}

/**
 * Tailwind class for cells with no data. Combine with NO_DATA_CELL_STYLE's
 * inline `backgroundImage` to render the 45deg diagonal hatch pattern.
 * Distinct from "zero" cells — a null sell-through or missing revenue gets
 * this treatment; a measured 0% gets Q1.
 */
export const NO_DATA_CELL_CLASS = 'bg-gray-50 dark:bg-gray-800';

/**
 * Inline `style={}` object for the diagonal hatch overlay applied to
 * no-data cells. UI-SPEC lines 274-283 — gray-400 @ 30% opacity at a 45deg
 * angle, 4px transparent band + 1px hatched line. Separate from the class
 * string because Tailwind utility classes can't express the repeating
 * gradient tokens as of Tailwind 4.2.
 */
export const NO_DATA_CELL_STYLE: Record<string, string> = {
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 5px)',
};
