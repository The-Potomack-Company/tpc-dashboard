import { KpiCard, type KpiDelta } from '../kit/KpiCard';
import { Sparkline } from '../kit/Sparkline';
import { useKpiTotals } from '../../hooks/extension/useKpiTotals';
import { ErrorState } from '../ErrorState';
import { formatCount, EMPTY } from '../../lib/format';
import type { KpiRow } from '../../services/extension/queries';

// Phase 2 / EXT-02 — 5 KPI cards, one per event type. Delta semantics
// (D-05): previous_count is the same-length immediately-preceding period,
// computed inside get_kpi_totals. KpiStrip only renders; never recomputes
// the math beyond percent-vs-prev framing.
//
// Direction selection (UI-SPEC § Color "Caller chooses semantic direction"):
//   For event-count KPIs more = good: up if cur > prev, down if cur < prev,
//   flat if equal. KpiCard maps direction → color (up=green, down=red, flat=gray).

const EVENT_TYPE_ORDER = [
  'catalog_single',
  'catalog_batch',
  'portal_upload',
  'spreadsheet_transform',
  'data_import',
] as const;

interface SparkPoint {
  x: string;
  y: number;
}

function computeDelta(current: number, previous: number): KpiDelta {
  if (current === previous) {
    return { value: '0', direction: 'flat', label: 'vs prev period' };
  }
  if (previous === 0) {
    // Avoid divide-by-zero — show absolute delta with direction.
    return {
      value: current > 0 ? `+${current}` : `${current}`,
      direction: current > 0 ? 'up' : 'down',
      label: 'vs prev period',
    };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  return {
    value: `${pct >= 0 ? '+' : ''}${pct}%`,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
    label: 'vs prev period',
  };
}

function rowFor(rows: KpiRow[] | undefined, type: string): KpiRow | undefined {
  return rows?.find((r) => r.event_type === type);
}

export function KpiStrip() {
  const query = useKpiTotals();

  if (query.error) {
    // LOCKED ErrorState contract (Phase 1): heading + body (string) + onRetry.
    // No children, no sibling Retry button — the component renders one internally.
    return (
      <div className="col-span-full">
        <ErrorState
          heading="Couldn't load KPIs"
          body="Retry below or refresh the page."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  return (
    <>
      {EVENT_TYPE_ORDER.map((type) => {
        if (query.isLoading) {
          return <KpiCard key={type} label={type} value={EMPTY} loading />;
        }
        const row = rowFor(query.data, type);
        const cur = Number(row?.current_count ?? 0);
        const prev = Number(row?.previous_count ?? 0);
        const sparkData = (row?.sparkline as SparkPoint[] | null | undefined) ?? [];
        const value = cur > 0 ? formatCount(cur) : EMPTY;
        const delta = cur > 0 ? computeDelta(cur, prev) : undefined;
        const sparkline = sparkData.length > 0 ? <Sparkline data={sparkData} /> : undefined;
        return (
          <KpiCard
            key={type}
            label={type}
            value={value}
            delta={delta}
            sparkline={sparkline}
          />
        );
      })}
    </>
  );
}
