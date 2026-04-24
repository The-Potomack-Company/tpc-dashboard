// Phase 6 Plan 06-02 — DEPT-01 ranking metric selector.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § DeptRankingMetricToggle (Color: bg-gray-50 / bg-gray-800 active — NOT accent),
//   § Copywriting → /departments page (exact labels + titles).
// REQ-ID: DEPT-01.
//
// WAI-ARIA radiogroup with roving tabindex — matches Phase 5 MetricToggle
// exactly (arrow keys move focus + fire onChange, Home/End jump to ends).
// The page owns the value; this component is fully controlled. Active
// background intentionally uses gray-50 / gray-800 (Secondary surface), NOT
// `bg-accent`: accent reservations for Phase 6 stay limited to selection-
// indicator surfaces (cross-filter chip + highlighted ranking row) per
// UI-SPEC § Color Strategy → Accent reservation #7 extension.

import { useRef, type KeyboardEvent } from 'react';

export type RankingMetric =
  | 'revenue'
  | 'sell_through'
  | 'lots_above_estimate';

export interface DeptRankingMetricToggleProps {
  value: RankingMetric;
  onChange: (next: RankingMetric) => void;
}

const OPTIONS: readonly RankingMetric[] = [
  'revenue',
  'sell_through',
  'lots_above_estimate',
];

const LABELS: Record<RankingMetric, string> = {
  revenue: 'Revenue',
  sell_through: 'Sell-through',
  lots_above_estimate: 'Lots above estimate',
};

const TITLES: Record<RankingMetric, string> = {
  revenue: 'Total revenue across all sales in range',
  sell_through: 'Average sell-through rate across departments in range',
  lots_above_estimate:
    'Count of department lots that sold above their high estimate',
};

export function DeptRankingMetricToggle({
  value,
  onChange,
}: DeptRankingMetricToggleProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusIndex(i: number) {
    const btn = refs.current[i];
    if (btn) {
      btn.focus();
      onChange(OPTIONS[i]);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex((i + 1) % OPTIONS.length);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
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
    <div
      role="radiogroup"
      aria-label="Select ranking metric"
      className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 gap-1"
    >
      {OPTIONS.map((opt, i) => {
        const isActive = value === opt;
        const className = [
          'h-8 px-3 rounded-md text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
          isActive
            ? 'font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            : 'font-normal bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
        ].join(' ');

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
    </div>
  );
}
