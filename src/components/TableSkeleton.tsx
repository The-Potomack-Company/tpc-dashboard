// Shimmer rows for table loading state.
//
// Rendered inside a `<table>` (as the full tbody). Row height matches the
// locked 44px (`h-11`) from 03-UI-SPEC.md § Spacing Scale. Each cell contains
// a pulsing bar sized to the column's expected width.
//
// `motion-safe:animate-pulse` respects prefers-reduced-motion (03-UI-SPEC.md
// § Accessibility Floor).

interface TableSkeletonProps {
  /** Number of shimmer rows to render. */
  rows: number;
  /**
   * Per-column Tailwind width classes for the inner shimmer bar
   * (e.g. ['w-20', 'w-full', 'w-24']). Defaults to 8 full-width bars.
   */
  columnWidths?: string[];
}

export function TableSkeleton({ rows, columnWidths }: TableSkeletonProps) {
  const widths = columnWidths ?? Array(8).fill('w-full');
  return (
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="h-11">
          {widths.map((w, j) => (
            <td key={j} className="px-4">
              <div
                className={`h-4 ${w} bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
