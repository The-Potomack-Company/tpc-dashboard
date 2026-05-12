import type { ReactElement } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { useErrorRate } from '../../hooks/extension/useErrorRate';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { formatPercent } from '../../lib/format';
import type { ErrorRateRow } from '../../services/extension/queries';

// Phase 2 / EXT-03 — Horizontal error-rate bar (one row per event_type).
// Recharts: layout="vertical" inverts axis (horizontal bars). Single neutral
// fill #9ca3af (UI-SPEC § Color); per-bar value label switches to red-600
// when rate ≥ 5% to flag attention without bespoke chart palette.

const BAR_FILL = '#9ca3af'; // gray-400
const HIGH_RATE_THRESHOLD = 0.05; // 5% — UI-SPEC § Color "EXT-03"

interface ChartRow {
  event_type: string;
  rate_pct: number;
  errors: number;
  total: number;
}

function rowsForChart(rows: ErrorRateRow[] | undefined): ChartRow[] {
  return (rows ?? []).map((r) => ({
    event_type: r.event_type,
    rate_pct: Number(r.rate) * 100, // RPC returns 0..1; chart uses 0..100
    errors: Number(r.errors),
    total: Number(r.total),
  }));
}

// Recharts' LabelList content function receives positional props (x/y/width/height/value)
// as `string | number | undefined`. We coerce to numbers for positioning math; the value
// itself comes from the chart's `dataKey="rate_pct"` so it's always a number at runtime.
interface LabelContentProps {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number;
}

function renderRateLabel(props: LabelContentProps) {
  const { x, y, width, height, value } = props;
  const xn = Number(x ?? 0);
  const yn = Number(y ?? 0);
  const wn = Number(width ?? 0);
  const hn = Number(height ?? 0);
  const v = Number(value ?? 0);
  const isHigh = v >= HIGH_RATE_THRESHOLD * 100;
  return (
    <text
      x={xn + wn + 4}
      y={yn + hn / 2}
      dominantBaseline="middle"
      className={`text-sm ${isHigh ? 'fill-red-600' : 'fill-gray-700'}`}
    >
      {formatPercent(v)}
    </text>
  );
}

export function ErrorRateChart() {
  const query = useErrorRate();

  if (query.isLoading) {
    return (
      <div
        className="h-full w-full animate-pulse rounded bg-bg-3"
        data-testid="error-rate-skeleton"
        aria-busy="true"
      />
    );
  }

  if (query.error) {
    // LOCKED ErrorState contract — heading + body + onRetry; no children, no sibling button.
    return (
      <ErrorState
        heading="Couldn't load error rates"
        body="Something went wrong. Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = rowsForChart(query.data);
  if (data.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center"
        data-testid="error-rate-empty"
      >
        <EmptyState heading="No events in this range">
          <></>
        </EmptyState>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 8, right: 48, bottom: 8, left: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={(v: number) => `${v}%`} domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="event_type" width={140} />
        <Tooltip formatter={(v) => formatPercent(Number(v))} />
        <Bar dataKey="rate_pct" fill={BAR_FILL} isAnimationActive={false}>
          <LabelList
            dataKey="rate_pct"
            content={renderRateLabel as unknown as (props: unknown) => ReactElement}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
