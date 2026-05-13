import { LineChart, Line, ResponsiveContainer } from 'recharts';

// Phase 1 / INFR-03 — shared UI kit (Phase 7 unified-design migration).
// Recharts minimal sparkline. No axes, no grid, no tooltip by default (D-12).
// Parent controls size via `width` / `height` props or an outer div's dimensions.
// Used inside KpiCard (EXT-02, APP-01 deltas) and on /live pace indicator (LIVE-04).
//
// Phase 7: default stroke moved from `currentColor` to `var(--accent)` so the
// sparkline tracks the unified teal-blue accent token under both light and
// dark themes. Callers can still override via the `stroke` prop (some
// components, like the AI-status donut, pass an explicit chartPalette value).

export interface SparklineDatum {
  x: string | number;
  y: number;
}

export interface SparklineProps {
  data: SparklineDatum[];
  width?: number | string;
  height?: number;
  stroke?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = '100%',
  height = 32,
  stroke = 'var(--accent)',
  className,
}: SparklineProps) {
  return (
    <div
      className={className}
      style={{ width, height }}
      data-testid="sparkline"
      aria-hidden="true"  // sparkline is purely decorative; real numbers live in KpiCard value/delta
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
