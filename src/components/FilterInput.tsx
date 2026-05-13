// Controlled debounced-by-parent text filter input with a clear button.
//
// Debouncing is the parent's responsibility (via React.useDeferredValue per
// 03-RESEARCH.md Pattern 5). This component is intentionally simple: every
// keystroke calls onChange synchronously, parent chooses whether to pass the
// raw or deferred value to expensive consumers.
//
// Phase 7: shifts to .tpc-input + token-backed colors. The clear button
// uses the unified `x` Icon glyph.

import { Icon } from '../ui/icons/Icon';

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
          if (e.key === 'Escape' && value !== '') {
            e.preventDefault();
            onChange('');
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="tpc-input h-10 px-4 pr-10 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear filter"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink focus:ring-2 focus:ring-accent rounded outline-none"
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}
