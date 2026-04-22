// Phase 5 Plan 05-02 — WAI-ARIA radiogroup for the TRND-04 heat map metric.
// Pattern mirrors src/components/PeriodSelector.tsx. Kept independent
// rather than extracted — pattern has diverged 3x now (PeriodSelector,
// DateRangeFilter presets, and this). Post-Phase 6 refactor may consolidate.
//
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md
//   § Metric toggle (TRND-04 only) (lines 396-404).

import { useRef, type KeyboardEvent } from 'react';

export type HeatMapMetric = 'sell_through' | 'revenue_share';

export interface MetricToggleProps {
  value: HeatMapMetric;
  onChange: (next: HeatMapMetric) => void;
}

const OPTIONS: readonly HeatMapMetric[] = ['sell_through', 'revenue_share'];

const LABELS: Record<HeatMapMetric, string> = {
  sell_through: 'Sell-through %',
  revenue_share: 'Revenue share %',
};

const TITLES: Record<HeatMapMetric, string> = {
  sell_through: 'Lots sold divided by lots auctioned, per department',
  revenue_share: 'Department revenue divided by sale total revenue',
};

export function MetricToggle({ value, onChange }: MetricToggleProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusIndex(i: number) {
    const btn = refs.current[i];
    if (btn) {
      btn.focus();
      onChange(OPTIONS[i]);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex((i + 1) % OPTIONS.length);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex((i - 1 + OPTIONS.length) % OPTIONS.length);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      focusIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      focusIndex(OPTIONS.length - 1);
      return;
    }
  }

  return (
    <fieldset
      aria-label="Select heat map metric"
      className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900"
    >
      {OPTIONS.map((opt, i) => {
        const isActive = value === opt;
        const className = [
          'h-10 px-4 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
          i > 0 ? 'border-l border-gray-200 dark:border-gray-700' : '',
          isActive
            ? 'font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={opt}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={TITLES[opt]}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(opt)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={className}
          >
            {LABELS[opt]}
          </button>
        );
      })}
    </fieldset>
  );
}
