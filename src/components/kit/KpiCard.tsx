import type { ReactNode } from 'react';

// Phase 1 / INFR-03 — shared UI kit.
// Presentational KPI card. Parent computes `value`, `delta`, and `sparkline`
// from its own hook (useDateRange + a data query). KpiCard never fetches.
// Consumed by APP-01 (Today strip with deltas) and EXT-02 (KPI with sparkline).

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

// Direction → Tailwind classes. Semantic (up=good, down=bad) is the CALLER's
// responsibility — KpiCard only applies the color. If "up = bad" (e.g. error
// rate), the caller passes direction='down' for a decrease.
const DELTA_CLASS_BY_DIRECTION: Record<KpiDelta['direction'], string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  flat: 'text-gray-500',
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
        className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        data-testid="kpi-card"
        aria-busy="true"
      >
        <div
          className="h-3 w-24 animate-pulse rounded bg-gray-200"
          data-testid="kpi-card-skeleton-label"
        />
        <div
          className="h-8 w-20 animate-pulse rounded bg-gray-200"
          data-testid="kpi-card-skeleton-value"
        />
        <div
          className="h-3 w-16 animate-pulse rounded bg-gray-200"
          data-testid="kpi-card-skeleton-delta"
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-testid="kpi-card"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-3xl font-semibold text-gray-900" data-testid="kpi-card-value">
        {value}
      </div>
      {delta && (
        <div className="flex items-baseline gap-1 text-sm" data-testid="kpi-card-delta">
          <span className={DELTA_CLASS_BY_DIRECTION[delta.direction]}>{delta.value}</span>
          {delta.label && <span className="text-gray-500">{delta.label}</span>}
        </div>
      )}
      {sparkline && <div className="mt-2" data-testid="kpi-card-sparkline-slot">{sparkline}</div>}
    </div>
  );
}
