import type { ReactNode } from 'react';

// Phase 1 / INFR-03 — shared UI kit (Phase 7 unified-design migration).
// Presentational KPI card. Parent computes `value`, `delta`, and `sparkline`
// from its own hook (useDateRange + a data query). KpiCard never fetches.
// Consumed by APP-01 (Today strip with deltas) and EXT-02 (KPI with sparkline).
//
// Phase 7: color/spacing tokens now flow through the unified design system
// (.tpc-card border + bg, ink/ink-3 text tokens). The semantic delta colors
// (green/red/gray) remain on Tailwind palette utilities for now — they
// represent positive/negative/neutral movement, not the brand accent, so the
// raw red/green/gray semantics are appropriate. Existing tests assert
// `text-green` / `text-red` / `text-gray` substring matches; keeping the
// class names preserves that contract.

export interface KpiDelta {
  value: string | number;
  direction: 'up' | 'down' | 'flat';
  label?: string;
}

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: KpiDelta;
  sparkline?: ReactNode;
  loading?: boolean;
}

const DELTA_CLASS_BY_DIRECTION: Record<KpiDelta['direction'], string> = {
  up: 'text-green-600 dark:text-green-400',
  down: 'text-red-600 dark:text-red-400',
  flat: 'text-gray-500 dark:text-gray-400',
};

export function KpiCard({
  label,
  value,
  delta,
  sparkline,
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div
        className="tpc-card flex flex-col gap-2 p-4"
        data-testid="kpi-card"
        aria-busy="true"
      >
        <div
          className="h-3 w-24 animate-pulse rounded bg-bg-3"
          data-testid="kpi-card-skeleton-label"
        />
        <div
          className="h-8 w-20 animate-pulse rounded bg-bg-3"
          data-testid="kpi-card-skeleton-value"
        />
        <div
          className="h-3 w-16 animate-pulse rounded bg-bg-3"
          data-testid="kpi-card-skeleton-delta"
        />
      </div>
    );
  }

  return (
    <div
      className="tpc-card flex flex-col gap-1 p-4"
      data-testid="kpi-card"
    >
      <div className="tpc-eyebrow">{label}</div>
      <div
        className="text-3xl font-semibold text-ink tnum"
        data-testid="kpi-card-value"
      >
        {value}
      </div>
      {delta && (
        <div
          className="flex items-baseline gap-1 text-sm"
          data-testid="kpi-card-delta"
        >
          <span className={DELTA_CLASS_BY_DIRECTION[delta.direction]}>
            {delta.value}
          </span>
          {delta.label && <span className="text-ink-3">{delta.label}</span>}
        </div>
      )}
      {sparkline && (
        <div className="mt-2" data-testid="kpi-card-sparkline-slot">
          {sparkline}
        </div>
      )}
    </div>
  );
}
