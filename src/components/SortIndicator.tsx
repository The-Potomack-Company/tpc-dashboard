// Sort-indicator chevron states — uses Heroicons-style inline SVG paths
// so the SortIndicator can remain a leaf component (no <Icon> dependency
// loop from inside table heads).
//
// States (per 03-UI-SPEC.md § Interaction Contract):
//   false  → chevron-up-down, ink-4              (inactive column)
//   'asc'  → chevron-up,      text-accent        (active ascending)
//   'desc' → chevron-down,    text-accent        (active descending)
//
// Phase 7: inactive color shifts to the token-backed `text-ink-4` (was
// `text-gray-400 dark:text-gray-500`) so it inherits the token under
// both themes. The active `text-accent` token already resolves to the
// unified accent.

interface SortIndicatorProps {
  state: 'asc' | 'desc' | false;
}

const ACTIVE_CLASS = 'text-accent';
const INACTIVE_CLASS = 'text-ink-4';

export function SortIndicator({ state }: SortIndicatorProps) {
  const colorClass = state === false ? INACTIVE_CLASS : ACTIVE_CLASS;
  const className = `w-4 h-4 ${colorClass}`;

  if (state === 'asc') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 15.75 7.5-7.5 7.5 7.5"
        />
      </svg>
    );
  }

  if (state === 'desc') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m19.5 8.25-7.5 7.5-7.5-7.5"
        />
      </svg>
    );
  }

  // Inactive chevron-up-down
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
      />
    </svg>
  );
}
