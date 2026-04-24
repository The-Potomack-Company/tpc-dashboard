// Phase 6 Plan 06-04 — Sticky footer for /sales with Clear + Compare (N) controls.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md § SaleSelectionFooter.
// REQ-ID: SALE-04.
// Renders null when selectedSaleNumbers.length === 0 (parent also gates; double safety).
// Compare (N) is accent-filled at size 2-4 (UI-SPEC accent reservation #8) — the
// one new accent use in Phase 6. Disabled when size < 2 (gray fill; cursor-not-allowed).
//
// Uses react-router v7 useNavigate for programmatic navigation. URL shape is
// /sales/compare?sales=<csv> where csv is selectedSaleNumbers.join(CSV_SEPARATOR).
// CSV_SEPARATOR is imported from parse-sales-param.ts — single source of truth
// for the separator character shared with the parser on the landing page.

import { useNavigate } from 'react-router';
import { CSV_SEPARATOR } from '../lib/parse-sales-param';

export interface SaleSelectionFooterProps {
  selectedSaleNumbers: readonly string[];
  onClear: () => void;
  /** When non-null, renders a role="status" hint above the footer. */
  maxHint?: string | null;
}

export function SaleSelectionFooter({
  selectedSaleNumbers,
  onClear,
  maxHint = null,
}: SaleSelectionFooterProps) {
  const navigate = useNavigate();
  const size = selectedSaleNumbers.length;

  // Parent should gate this render (footer appears when size >= 1), but we
  // double-guard here so the component is safe to drop into any tree. An
  // empty selection has no meaningful content — return null so the DOM
  // footprint is zero and sticky-bottom layout math is undisturbed.
  if (size === 0) return null;

  const canCompare = size >= 2 && size <= 4;

  const handleCompare = () => {
    if (!canCompare) return;
    const csv = selectedSaleNumbers.join(CSV_SEPARATOR);
    navigate('/sales/compare?sales=' + csv);
  };

  const compareBtnClass = canCompare
    ? 'px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
    : 'px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-semibold cursor-not-allowed';

  return (
    <div className="relative">
      {maxHint != null && (
        <p
          role="status"
          className="absolute bottom-16 left-0 right-0 text-center text-sm text-gray-600 dark:text-gray-400 py-2 transition-opacity duration-200"
        >
          {maxHint}
        </p>
      )}
      <div
        role="region"
        aria-label="Sale selection actions"
        className="sticky bottom-0 h-16 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-[2]"
      >
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline decoration-gray-300 hover:decoration-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            Clear selection
          </button>
          <div className="flex items-center gap-4">
            {size === 1 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Select at least 2 sales to compare
              </span>
            )}
            <button
              type="button"
              disabled={!canCompare}
              aria-disabled={!canCompare}
              onClick={handleCompare}
              className={compareBtnClass}
            >
              Compare ({size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
