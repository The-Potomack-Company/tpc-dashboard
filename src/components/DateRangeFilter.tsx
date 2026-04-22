// TRND-03: TRND date range presets + custom range picker
//
// Phase 5 Plan 05-02 — WAI-ARIA radiogroup for the trends-page date range.
// Five preset buttons (YTD / L6M / L12M / L24M / All time) share a fieldset
// with a `Custom` disclosure button that opens a date-input panel.
//
// Contract: .planning/phases/05-trend-analysis/05-UI-SPEC.md
//   § DateRangeFilter component (lines 739-808)
//   § Copywriting Contract → DateRangeFilter (lines 337-356)
//   § Interaction Contract (lines 448-465)
//
// Pattern mirror: src/components/PeriodSelector.tsx for the radiogroup +
// roving tabIndex + Arrow/Home/End handling. Kept independent rather than
// extracted — pattern has only diverged 2x (PeriodSelector + here), and
// MetricToggle makes 3x; post-Phase 6 refactor may consolidate.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  DEFAULT_RANGE_PRESET,
  rangeFromPreset,
  type Range,
  type RangePreset,
} from '../lib/period';
import { formatDate } from '../lib/format';

export interface DateRangeFilterProps {
  value: Range;
  onChange: (next: Range) => void;
}

const PRESETS: readonly RangePreset[] = ['ytd', 'l6m', 'l12m', 'l24m', 'all'];

const LABELS: Record<RangePreset, string> = {
  ytd: 'YTD',
  l6m: 'L6M',
  l12m: 'L12M',
  l24m: 'L24M',
  all: 'All time',
};

const TITLES: Record<RangePreset, string> = {
  ytd: 'Year to date',
  l6m: 'Last 6 months',
  l12m: 'Last 12 months',
  l24m: 'Last 24 months',
  all: 'All time',
};

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3v2M16 3v2M4 7h16M5 7h14v13H5V7Z"
      />
    </svg>
  );
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [startInput, setStartInput] = useState<string>(value.start ?? '');
  const [endInput, setEndInput] = useState<string>(value.end ?? '');
  const [error, setError] = useState<string | null>(null);

  // Keep local inputs in sync when the parent resets `value` externally.
  // Runs only when the incoming start/end strings actually change so edits
  // the user types into the panel aren't clobbered mid-edit.
  useEffect(() => {
    setStartInput(value.start ?? '');
    setEndInput(value.end ?? '');
  }, [value.start, value.end]);

  function applyPreset(preset: RangePreset) {
    setCustomOpen(false);
    setError(null);
    onChange(rangeFromPreset(preset));
  }

  function focusIndex(i: number) {
    const btn = refs.current[i];
    if (btn) {
      btn.focus();
      applyPreset(PRESETS[i]);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex((i + 1) % PRESETS.length);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex((i - 1 + PRESETS.length) % PRESETS.length);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      focusIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      focusIndex(PRESETS.length - 1);
      return;
    }
  }

  function toggleCustom() {
    setCustomOpen((open) => {
      const next = !open;
      if (next) {
        // Pre-populate from current value on open.
        setStartInput(value.start ?? '');
        setEndInput(value.end ?? '');
        setError(null);
      }
      return next;
    });
  }

  function onApply() {
    if (!startInput || !endInput) {
      setError('Start date must be on or before end date.');
      return;
    }
    // Lexicographic compare is safe for yyyy-mm-dd.
    if (startInput > endInput) {
      setError('Start date must be on or before end date.');
      return;
    }
    setError(null);
    setCustomOpen(false);
    onChange({ start: startInput, end: endInput, preset: 'custom' });
  }

  function onReset() {
    setError(null);
    setCustomOpen(false);
    onChange(rangeFromPreset(DEFAULT_RANGE_PRESET));
  }

  const isCustom = value.preset === 'custom';

  return (
    <div className="inline-flex flex-col items-end gap-2">
      <fieldset
        aria-label="Select date range"
        className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900"
      >
        {PRESETS.map((preset, i) => {
          const isActive = value.preset === preset;
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
              key={preset}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={TITLES[preset]}
              tabIndex={isActive ? 0 : -1}
              onClick={() => applyPreset(preset)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={className}
            >
              {LABELS[preset]}
            </button>
          );
        })}

        <button
          type="button"
          onClick={toggleCustom}
          aria-expanded={customOpen}
          aria-haspopup="dialog"
          className={[
            'h-10 px-4 text-sm',
            'border-l border-gray-200 dark:border-gray-700',
            'inline-flex items-center gap-1',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
            isCustom
              ? 'font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
          ].join(' ')}
        >
          <CalendarIcon />
          Custom
        </button>
      </fieldset>

      {customOpen && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 inline-flex flex-col gap-2">
          <div className="inline-flex items-end gap-2">
            <div>
              <label
                htmlFor="range-start"
                className="block text-sm text-gray-700 dark:text-gray-300"
              >
                Start
              </label>
              <input
                id="range-start"
                type="date"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="h-10 px-4 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label
                htmlFor="range-end"
                className="block text-sm text-gray-700 dark:text-gray-300"
              >
                End
              </label>
              <input
                id="range-end"
                type="date"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="h-10 px-4 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={onApply}
              className="h-10 px-4 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              Apply range
            </button>
            <button
              type="button"
              onClick={onReset}
              className="h-10 px-4 text-sm font-normal text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              Reset
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      {isCustom && !customOpen && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Custom range: {formatDate(value.start)} – {formatDate(value.end)}
        </p>
      )}
    </div>
  );
}
