import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatInTimeZone } from 'date-fns-tz';
import { useEventVolume } from '../../hooks/extension/useEventVolume';
import { useDateRange } from '../../hooks/useDateRange';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import type { VolumeRow } from '../../services/extension/queries';

// Phase 2 / EXT-01 — 14-day stacked bar of event volume by event_type.
// 5-event vocab is locked here so a malformed RPC payload (defensive) cannot
// inject extra series. Color palette + isAnimationActive=false are UI-SPEC
// + Phase 1 invariants. tickFormatter is range-aware (D-08): hourly when
// useDateRange.range === 'today', daily otherwise.

const EVENT_TYPE_ORDER = [
  'catalog_single',
  'catalog_batch',
  'portal_upload',
  'spreadsheet_transform',
  'data_import',
] as const;
type EventTypeLiteral = (typeof EVENT_TYPE_ORDER)[number];

const EVENT_COLORS: Record<EventTypeLiteral, string> = {
  catalog_single: '#64748b', // slate-500
  catalog_batch: '#0284c7', // sky-600
  portal_upload: '#0d9488', // teal-600
  spreadsheet_transform: '#d97706', // amber-600
  data_import: '#7c3aed', // violet-600
};

const ET = 'America/New_York';

interface WideRow {
  bucket: string;
  catalog_single?: number;
  catalog_batch?: number;
  portal_upload?: number;
  spreadsheet_transform?: number;
  data_import?: number;
}

// Pivot RPC long-form rows to Recharts wide-form rows. Drops any event_type
// not in the locked 5-vocab (D-02 — defense in depth; should be impossible
// since the RPC enforces, but a future ALTER could leak `catalog_item`).
function pivotForRecharts(rows: VolumeRow[]): WideRow[] {
  const byBucket = new Map<string, WideRow>();
  for (const r of rows) {
    if (!EVENT_TYPE_ORDER.includes(r.event_type as EventTypeLiteral)) continue;
    const wide = byBucket.get(r.bucket_start) ?? { bucket: r.bucket_start };
    (wide as unknown as Record<string, unknown>)[r.event_type] = Number(r.event_count);
    byBucket.set(r.bucket_start, wide);
  }
  return [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export function EventVolumeChart() {
  const query = useEventVolume();
  const { range } = useDateRange();
  const isHourly = range === 'today';

  const tickFormatter = (iso: string) =>
    isHourly
      ? formatInTimeZone(iso, ET, 'h a').toUpperCase() // '2 PM'
      : formatInTimeZone(iso, ET, 'M/d'); // '4/29'

  if (query.isLoading) {
    return (
      <div
        className="h-full w-full animate-pulse rounded bg-gray-100"
        data-testid="event-volume-skeleton"
        aria-busy="true"
      />
    );
  }

  if (query.error) {
    // LOCKED ErrorState contract (Phase 1): heading + body (string) + onRetry.
    // No children, no sibling Retry button — the component renders one internally.
    return (
      <ErrorState
        heading="Couldn't load event volume"
        body="Something went wrong loading the chart. Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const wide = pivotForRecharts(query.data ?? []);
  if (wide.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center"
        data-testid="event-volume-empty"
      >
        <EmptyState heading="No events in this range">
          <></>
        </EmptyState>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={wide} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="bucket" tickFormatter={tickFormatter} />
        <YAxis />
        <Tooltip />
        <Legend />
        {EVENT_TYPE_ORDER.map((t) => (
          <Bar
            key={t}
            dataKey={t}
            stackId="events"
            fill={EVENT_COLORS[t]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
