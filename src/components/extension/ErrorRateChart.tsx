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

interface RateLabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}

function renderRateLabel(props: RateLabelProps) {
  const { x, y, width, height, value } = props;
  const v = Number(value ?? 0);
  const isHigh = v >= HIGH_RATE_THRESHOLD * 100;
  return (
    <text
      x={(x ?? 0) + (width ?? 0) + 4}
      y={(y ?? 0) + (height ?? 0) / 2}
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
        className="h-full w-full animate-pulse rounded bg-gray-100"
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
        <Tooltip formatter={(v: number) => formatPercent(v)} />
        <Bar dataKey="rate_pct" fill={BAR_FILL} isAnimationActive={false}>
          <LabelList dataKey="rate_pct" content={renderRateLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
