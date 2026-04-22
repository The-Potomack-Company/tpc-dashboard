import { formatDelta, type DeltaType } from '../lib/format';

// Display-only KPI scorecard — locked by 04-UI-SPEC.md § Layout Specifications
// (lines 362–398) and § Copywriting Contract → Delta semantics (lines 249–264).
//
// Contract notes:
//   - Not interactive. No tabIndex, no role=button, no <Link> wrap. Phase 5
//     will decide whether cards click-through; a broken promise today would
//     mislead keyboard users. See § Interaction Contract.
//   - Delta math is delegated to formatDelta — KpiCard never does arithmetic.
//   - `deltaType="percentage-points"` is ONLY for the sell-through card
//     (both values are already ratios). Currency + count cards use
//     `deltaType="relative"`. See 04-RESEARCH.md § Pitfall 6.

interface KpiCardProps {
  /** e.g. "Total revenue" / "Avg sell-through" */
  label: string;
  /** Pre-formatted value string (e.g. `formatCurrency(current.revenue)`). */
  value: string;
  /** Current-window raw numeric (drives delta math). `null` → no-baseline. */
  current: number | null;
  /** Previous-window raw numeric (drives delta math). `null` → no-baseline. */
  previous: number | null;
  /** 'relative' for currency/count deltas; 'percentage-points' for sell-through. */
  deltaType: DeltaType;
  /** Short period label for the delta suffix — 'YTD' / '6mo' / '12mo'. */
  periodLabel: string;
}

const DELTA_COLOR: Record<'up' | 'down' | 'none', string> = {
  up: 'text-green-600 dark:text-green-500',
  down: 'text-red-600 dark:text-red-500',
  none: 'text-gray-500 dark:text-gray-400',
};

export function KpiCard({
  label,
  value,
  current,
  previous,
  deltaType,
  periodLabel,
}: KpiCardProps) {
  const delta = formatDelta(current, previous, deltaType);
  const colorClass = DELTA_COLOR[delta.direction];
  const hasDelta = delta.direction !== 'none';
  // When the delta has direction, append periodLabel so screen readers announce
  // the full "Up 12.4% versus previous 12mo". When there's no baseline, reuse
  // the helper's "No baseline comparison" verbatim.
  const ariaLabel = hasDelta ? `${delta.aria} ${periodLabel}` : delta.aria;
  // Delta glyph + text share one span so the color class applies to both
  // atomically (UI-SPEC Iconography note: glyph and number must read as one
  // unit — color splitting would add visual noise).
  const deltaContent = delta.text ? `${delta.glyph} ${delta.text}` : delta.glyph;

  return (
    <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[128px] space-y-2">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
      <p className="text-sm tabular-nums">
        <span className={colorClass} aria-label={ariaLabel}>
          {deltaContent}
        </span>
        {hasDelta && (
          <span className="text-gray-500 dark:text-gray-400">
            {' '}
            vs previous {periodLabel}
          </span>
        )}
      </p>
    </div>
  );
}
