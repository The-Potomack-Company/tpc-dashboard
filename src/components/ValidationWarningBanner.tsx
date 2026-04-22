// Amber validation warning banner for /sales/:saleNumber when
// `sale.validation_warning === true` (dept sums ≠ sale totals).
//
// Contract: 03-UI-SPEC.md § Copywriting (locked banner text), § Color
// (amber-50 / amber-500/50 / amber-900 light surface), § Layout
// Specifications → Validation banner component (JSX verbatim),
// § Interaction Contract (Reload calls
// queryClient.invalidateQueries({ queryKey: ['sale', saleNumber] })).
//
// Threat model: T-03-01 — React auto-escapes the only dynamic value
// (saleNumber) and it never enters the DOM; it only flows into the
// invalidateQueries query key. No raw-HTML injection sinks.

import { useQueryClient } from '@tanstack/react-query';

interface ValidationWarningBannerProps {
  saleNumber: string;
}

export function ValidationWarningBanner({
  saleNumber,
}: ValidationWarningBannerProps) {
  const qc = useQueryClient();
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex items-center gap-3"
    >
      {/* Heroicons outline exclamation-triangle (stroke-width 1.5) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="text-sm text-amber-900 dark:text-amber-100 flex-1">
        Department totals don't match the sale totals for this sale. Values
        may be off — spot-check against the source PDF before relying on them.
      </p>
      <button
        type="button"
        onClick={() =>
          qc.invalidateQueries({ queryKey: ['sale', saleNumber] })
        }
        className="text-sm font-semibold text-amber-900 dark:text-amber-100 underline decoration-amber-600/50 hover:decoration-amber-600 focus:ring-2 focus:ring-accent rounded outline-none"
      >
        Reload sale
      </button>
    </div>
  );
}
