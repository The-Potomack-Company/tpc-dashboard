// Shared chart wrapper with title + optional subtitle + optional action +
// h-80 | h-[400px] body slot. Contract: 05-UI-SPEC.md § ChartCard component
// (lines 538-566).
//
// Pure layout component — does NOT import Recharts. Consumers pass a
// Recharts chart (wrapped in <ResponsiveContainer width="100%" height="100%">)
// as children; alternatively, the TRND-04 heat map passes its CSS-grid
// body into the same slot without modification.

import type { ReactNode } from 'react';

interface ChartCardProps {
  /** Card title, rendered as a text-sm font-semibold `<h2>`. */
  title: string;
  /** Optional muted line under the title — e.g. "Net revenue with
   *  3-sale rolling trend". */
  subtitle?: string;
  /** Optional header-right slot — used by TRND-04 for the MetricToggle.
   *  Rendered inside the `<header>` alongside the title block. */
  action?: ReactNode;
  /** `'sm'` (default, h-80) matches line/area charts; `'lg'` (h-[400px])
   *  matches the TRND-04 heat map. */
  height?: 'sm' | 'lg';
  /** Chart body. Typically a Recharts `<ResponsiveContainer>`. */
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  action,
  height = 'sm',
  children,
}: ChartCardProps) {
  const bodyHeight = height === 'lg' ? 'h-[400px]' : 'h-80';
  return (
    <section className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className={`mt-4 ${bodyHeight}`}>{children}</div>
    </section>
  );
}
