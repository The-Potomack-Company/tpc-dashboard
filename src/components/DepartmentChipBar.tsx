// Phase 6 Plan 06-03 — DEPT-02 multi-select chip bar for DepartmentRevenueLineChart.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § DepartmentChipBar.
// REQ-ID: DEPT-02 (selection UI).
// Max-8 cap matches CHART_PALETTE size; 9th selection fires onMaxExceeded (no state change).
//
// Parent-owned state: the `selected` array lives in DepartmentsPage so the
// line chart can consume the same array directly. This component is pure
// view + event forwarding — no internal toggle state, no setTimeout. The
// "Max 8 departments — deselect one first" status line is rendered by the
// parent in response to onMaxExceeded so the 3-second fade timer is owned
// alongside the rest of the page's effect lifecycle.

import type { CSSProperties } from 'react';

export interface DepartmentChip {
  code: string;
  displayName: string | null;
}

export interface DepartmentChipBarProps {
  available: readonly DepartmentChip[];
  selected: readonly string[];
  onToggle: (code: string) => void;
  /** Default 8 (equals CHART_PALETTE.length). */
  maxSelected?: number;
  /** Fired when a user clicks a chip that would push selection past maxSelected. */
  onMaxExceeded?: () => void;
  /** Parent-supplied lookup: deterministic CHART_PALETTE index → hex. */
  colorForCode: (code: string) => string;
}

/** Tailwind classes shared across all chip states. */
const CHIP_BASE =
  'h-8 px-3 rounded-full inline-flex items-center gap-2 text-sm ' +
  'border transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset';

const ACTIVE_CLS =
  'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 ' +
  'font-semibold text-gray-900 dark:text-gray-100';

const INACTIVE_CLS =
  'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 ' +
  'text-gray-500 dark:text-gray-400';

const DISABLED_CLS =
  'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 ' +
  'text-gray-400 dark:text-gray-500 opacity-60 cursor-not-allowed';

export function DepartmentChipBar({
  available,
  selected,
  onToggle,
  maxSelected = 8,
  onMaxExceeded,
  colorForCode,
}: DepartmentChipBarProps) {
  const selectedSet = new Set(selected);
  const maxReached = selected.length >= maxSelected;

  return (
    <div
      role="group"
      aria-label="Department series selection"
      className="py-4 flex flex-wrap gap-2"
    >
      {available.map((chip) => {
        const isActive = selectedSet.has(chip.code);
        const isDisabled = !isActive && maxReached;

        // aria-label: `{code} — {displayName}` OR just `{code}` when displayName
        // is null (Pitfall 7 — auto-discovered departments). The visible text is
        // always just the code; the full name is announced by screen readers.
        const ariaLabel =
          chip.displayName != null
            ? `${chip.code} — ${chip.displayName}`
            : chip.code;

        // Native title provides a hover/focus tooltip for sighted users (UI-SPEC
        // § Accessibility → native tooltips for chips).
        const nativeTitle = ariaLabel;

        const stateCls = isActive
          ? ACTIVE_CLS
          : isDisabled
            ? DISABLED_CLS
            : INACTIVE_CLS;

        const dotStyle: CSSProperties = {
          backgroundColor: colorForCode(chip.code),
        };

        const handleClick = () => {
          if (isActive) {
            onToggle(chip.code);
            return;
          }
          if (maxReached) {
            onMaxExceeded?.();
            return;
          }
          onToggle(chip.code);
        };

        return (
          <button
            key={chip.code}
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={ariaLabel}
            aria-disabled={isDisabled ? true : undefined}
            title={nativeTitle}
            tabIndex={0}
            onClick={handleClick}
            className={`${CHIP_BASE} ${stateCls}`}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 shrink-0"
                style={dotStyle}
              />
            )}
            <span>{chip.code}</span>
          </button>
        );
      })}
    </div>
  );
}
