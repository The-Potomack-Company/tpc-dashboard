// Recharts custom Tooltip content — dark-surface chip with color dot +
// label + value rows. Contract: 05-UI-SPEC.md § ChartTooltip component
// (lines 814-840) and 05-01-PLAN.md Task 2 <behavior>.
//
// Usage:
//   <Tooltip content={<ChartTooltip headerFormatter={…} valueFormatter={…} />} />
// Recharts clones the element at runtime and injects { active, label,
// payload }. Those three props are therefore optional — the component
// returns null whenever Recharts signals "no tooltip" (inactive hover or
// empty payload), matching Recharts' own convention.
//
// Not imported from 'recharts' on purpose: keeping the component tree
// decoupled from Recharts internals means we can render it directly in
// Vitest without booting a full <LineChart>.

/** Single series row injected by Recharts on hover. Mirrors the shape
 *  Recharts emits for `<Line>` / `<Area>` payload entries. */
interface ChartTooltipRow {
  name: string;
  value: number | string;
  dataKey: string;
  color?: string;
  /** Original data row — used by consumers that need off-series fields
   *  (e.g. `sale_number` for the TRND-01 header). */
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  // Recharts-injected props. All optional; Recharts omits them when inactive.
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipRow[];

  // Consumer-owned formatters. Required: `headerFormatter` controls the top
  // line (typically "{formatDate(sale_date)} · Sale {sale_number}"). Optional:
  // `valueFormatter` formats each row's value column; defaults to
  // `String(row.value)` when absent.
  headerFormatter: (
    label: string | number | undefined,
    firstRow: ChartTooltipRow | undefined,
  ) => string;
  valueFormatter?: (row: ChartTooltipRow) => string;
}

export function ChartTooltip({
  active,
  label,
  payload,
  headerFormatter,
  valueFormatter,
}: ChartTooltipProps) {
  // Recharts convention: render nothing for inactive hovers or empty
  // payloads. This short-circuit covers all three cases (inactive /
  // undefined payload / zero-length payload) and keeps the DOM free of
  // an invisible tooltip shell that would accumulate across re-renders.
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const headerText = headerFormatter(label, payload[0]);

  return (
    <div
      // aria-live=polite so screen readers announce the new value when the
      // hovered data point changes, without interrupting the user.
      aria-live="polite"
      className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 border border-gray-800 dark:border-gray-300 shadow-lg"
    >
      <p className="text-sm font-semibold text-white dark:text-gray-900 mb-1">
        {headerText}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((row) => {
          const formatted = valueFormatter
            ? valueFormatter(row)
            : String(row.value);
          return (
            <div
              key={row.dataKey}
              className="flex items-center gap-2"
            >
              {/* 8×8 colored square — NOT rounded (UI-SPEC line 838). Inline
                  style is the only way to pipe the series stroke color (a
                  runtime hex from Recharts / CHART_PALETTE) into the dot. */}
              <span
                className="w-2 h-2 shrink-0"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-200 dark:text-gray-700">
                {row.name}:
              </span>
              <span className="text-sm font-semibold text-white dark:text-gray-900 tabular-nums ml-auto">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
