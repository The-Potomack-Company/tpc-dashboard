// Controlled debounced-by-parent text filter input with a clear button.
//
// Debouncing is the parent's responsibility (via React.useDeferredValue per
// 03-RESEARCH.md Pattern 5). This component is intentionally simple: every
// keystroke calls onChange synchronously, parent chooses whether to pass the
// raw or deferred value to expensive consumers.
//
// Keyboard contract (03-UI-SPEC.md § Interaction Contract):
//   - Escape clears the filter (onChange('')).
//   - Type <input type="search"> so browsers render a native clear affordance
//     on platforms that support it; our explicit × button is the portable one.

interface FilterInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

export function FilterInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: FilterInputProps) {
  return (
    <div className={`relative w-full max-w-xs ${className ?? ''}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // WR-09: Guard the manual clear so it doesn't double-fire with
          // Safari's native <input type="search"> Escape-clear behavior.
          // Only clear if there is something to clear, and prevent the
          // browser from ALSO firing a second onChange('') after our
          // handler resolves.
          if (e.key === 'Escape' && value !== '') {
            e.preventDefault();
            onChange('');
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full h-10 px-4 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear filter"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:ring-2 focus:ring-accent rounded outline-none"
        >
          {/* Heroicons x-mark outline */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
