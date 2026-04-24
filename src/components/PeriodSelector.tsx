import { useRef, type KeyboardEvent } from 'react';
import type { Period } from '../lib/period';

// Segmented control with WAI-ARIA radiogroup pattern — locked by
// 04-UI-SPEC.md § Layout Specifications → PeriodSelector component
// (lines 401–438), § Interaction Contract (period selector rows), and
// § Accessibility Floor (radiogroup pattern).
//
// Design notes:
//   - Active state uses bg-gray-50 + font-semibold, NOT accent. The Phase 1
//     UI-SPEC locks 5 accent reservations + Phase 3 adds 2 more for a total
//     of 7; a secondary always-visible control like this would be an 8th if
//     we used accent for the active background. Focus ring still uses accent
//     (reservation #2, focus rings — inherited).
//   - Roving tabIndex: active option has tabIndex 0, others -1 so Tab moves
//     past the whole selector; arrow keys cycle within it.
//   - Options 2+ have `border-l` to draw the vertical 1px divider between
//     segments. The outer fieldset has `overflow-hidden` + `rounded-lg` so
//     the first/last options inherit the rounded corners.

interface PeriodSelectorProps {
  value: Period;
  onChange: (next: Period) => void;
}

const OPTIONS: readonly Period[] = ['ytd', 'l6m', 'l12m'];

const LABELS: Record<Period, string> = {
  ytd: 'YTD',
  l6m: 'L6M',
  l12m: 'L12M',
};

const TITLES: Record<Period, string> = {
  ytd: 'Year to date',
  l6m: 'Last 6 months',
  l12m: 'Last 12 months',
};

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  // Move focus to the option at `i` and fire onChange. Matches the WAI-ARIA
  // radiogroup pattern — arrow-key navigation immediately selects.
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
      aria-label="Select reporting period"
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
            aria-pressed={isActive}
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
