// Phase 3 / APP-01 / D-14 — right-now KPI strip ("Today's Snapshot").
// Filter scope: ignores ?range=; applies ?specialists= and ?mode= via the hook.
// Delta = "today vs yesterday" (N=1 day).
//
// Mirrors src/components/extension/KpiStrip.tsx structure verbatim:
//   - computeDelta() with same direction semantics (zero-current + positive-previous = 'down')
//   - error branch lifted into a col-span-full wrapper (strip-level error, not per-card)
//   - per-card loading via KpiCard.loading prop
//
// Per UI-SPEC § Per-Card Copy Contract: NO sparklines on the Today strip
// (planner default — the 4 KpiCards omit the sparkline prop entirely).
//
// Right-now indicator pip: pattern lifted verbatim from
// src/components/extension/LiveEventFeed.tsx:151-159.

import { KpiCard, type KpiDelta } from '../kit/KpiCard';
import { useTodayKpis } from '../../hooks/activity/useTodayKpis';
import { ErrorState } from '../ErrorState';
import { formatCount, formatPercent, EMPTY } from '../../lib/format';

const DELTA_LABEL = 'vs yesterday';

/**
 * computeDelta — same shape and direction semantics as Phase 2 KpiStrip's
 * computeDelta (D-14). Rules:
 *   - current === previous → flat
 *   - previous === 0       → absolute delta with direction (avoids div/0);
 *                            current=0, prev=0 hits the equality branch above
 *   - otherwise            → percent delta with sign and direction
 *
 * Zero-current with positive-previous yields direction='down' (current=0 < prev>0
 * triggers the percent branch which computes a negative percent → 'down').
 */
function computeDelta(current: number, previous: number): KpiDelta {
  if (current === previous) {
    return { value: '0', direction: 'flat', label: DELTA_LABEL };
  }
  if (previous === 0) {
    return {
      value: current > 0 ? `+${current}` : `${current}`,
      direction: current > 0 ? 'up' : 'down',
      label: DELTA_LABEL,
    };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  return {
    value: `${pct >= 0 ? '+' : ''}${pct}%`,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
    label: DELTA_LABEL,
  };
}

/**
 * pctValue — render value for the % AI done card.
 * Returns EMPTY ('—') when denom is 0 (no AI items today → no percent makes sense).
 * Else returns formatPercent(rate) where rate is num/denom * 100, 1-decimal precision.
 */
function pctValue(num: number, denom: number): string {
  if (denom === 0) return EMPTY;
  const pct = Math.round((num / denom) * 1000) / 10; // 1-decimal
  return formatPercent(pct);
}

/**
 * pctRate — same computation as pctValue but returns the raw number, used for
 * the delta calculation. Returns 0 when denom is 0.
 */
function pctRate(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

export function TodayKpiStrip() {
  const query = useTodayKpis();

  return (
    <section data-testid="app-01-card" className="space-y-2">
      <header className="flex items-center gap-2 mb-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse"
        />
        <span className="sr-only">Live</span>
        <h2 className="text-sm font-semibold text-gray-700">Today's Snapshot</h2>
      </header>

      {query.error ? (
        // Strip-level error (Phase 2 KpiStrip idiom). LOCKED ErrorState contract:
        // heading + body (string) + onRetry. No children, no sibling Retry.
        <div className="col-span-full">
          <ErrorState
            heading="Couldn't load this KPI"
            body="Retry below or refresh the page."
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Sessions today"
            value={
              query.isLoading
                ? ''
                : formatCount(Number(query.data?.sessions_today ?? 0))
            }
            delta={
              query.isLoading || !query.data
                ? undefined
                : computeDelta(
                    Number(query.data.sessions_today),
                    Number(query.data.sessions_yday),
                  )
            }
            loading={query.isLoading}
          />
          <KpiCard
            label="Items today"
            value={
              query.isLoading
                ? ''
                : formatCount(Number(query.data?.items_today ?? 0))
            }
            delta={
              query.isLoading || !query.data
                ? undefined
                : computeDelta(
                    Number(query.data.items_today),
                    Number(query.data.items_yday),
                  )
            }
            loading={query.isLoading}
          />
          <KpiCard
            label="Items exported today"
            value={
              query.isLoading
                ? ''
                : formatCount(Number(query.data?.exports_today ?? 0))
            }
            delta={
              query.isLoading || !query.data
                ? undefined
                : computeDelta(
                    Number(query.data.exports_today),
                    Number(query.data.exports_yday),
                  )
            }
            loading={query.isLoading}
          />
          <KpiCard
            label="% AI done today"
            value={
              query.isLoading
                ? ''
                : pctValue(
                    Number(query.data?.items_done_today ?? 0),
                    Number(query.data?.items_total_today ?? 0),
                  )
            }
            delta={
              query.isLoading ||
              !query.data ||
              Number(query.data.items_total_today) === 0
                ? undefined
                : computeDelta(
                    pctRate(
                      Number(query.data.items_done_today),
                      Number(query.data.items_total_today),
                    ),
                    pctRate(
                      Number(query.data.items_done_yday),
                      Number(query.data.items_total_yday),
                    ),
                  )
            }
            loading={query.isLoading}
          />
        </div>
      )}
    </section>
  );
}
