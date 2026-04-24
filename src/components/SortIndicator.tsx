// Heroicons outline SVGs inlined to avoid a package dependency
// (see Phase 3 UI-SPEC § Design System — icon library).
//
// States (per 03-UI-SPEC.md § Interaction Contract):
//   false  → chevron-up-down, text-gray-400  (inactive column)
//   'asc'  → chevron-up,      text-accent    (active ascending)
//   'desc' → chevron-down,    text-accent    (active descending)
//
// Accent reservation #6 (03-UI-SPEC.md § Color): active sort indicator.

interface SortIndicatorProps {
  state: 'asc' | 'desc' | false;
}

const ACTIVE_CLASS = 'text-accent';
const INACTIVE_CLASS = 'text-gray-400 dark:text-gray-500';

export function SortIndicator({ state }: SortIndicatorProps) {
  const colorClass = state === false ? INACTIVE_CLASS : ACTIVE_CLASS;
  const className = `w-4 h-4 ${colorClass}`;

  if (state === 'asc') {
    // Heroicons chevron-up (outline, stroke-width 1.5)
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
    // Heroicons chevron-down (outline, stroke-width 1.5)
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

  // Heroicons chevron-up-down (outline, stroke-width 1.5) — inactive
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
