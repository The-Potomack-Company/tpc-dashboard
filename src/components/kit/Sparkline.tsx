import { LineChart, Line, ResponsiveContainer } from 'recharts';

// Phase 1 / INFR-03 — shared UI kit.
// Recharts minimal sparkline. No axes, no grid, no tooltip by default (D-12).
// Parent controls size via `width` / `height` props or an outer div's dimensions.
// Used inside KpiCard (EXT-02, APP-01 deltas) and on /live pace indicator (LIVE-04).

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
  stroke = 'currentColor',
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
