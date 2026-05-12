// Phase 3 / APP-12 / D-17 — range-driven House-vs-Sale paired KPIs.
// UI-SPEC committed: this is a paired-KPI layout, NOT a pie. Two tiles in a
// single bordered card with mode-color left borders (House: indigo-600,
// Sale: teal-600) — tile borders surface SESSION_MODE_COLOR semantically
// without ever introducing a chart.
//
// Filter scope: applies ?range=, ?specialists=, ?mode= via the underlying
// useHouseSaleSplit hook (which reads useDateRange).

import { useHouseSaleSplit } from '../../hooks/activity/useHouseSaleSplit';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { formatCount } from '../../lib/format';

const MODES: ReadonlyArray<{
  mode: 'house' | 'sale';
  label: string;
  borderClass: string;
}> = [
  // SESSION_MODE_COLOR.house indigo-600 — Tailwind class equivalent of the palette hex
  { mode: 'house', label: 'House', borderClass: 'border-l-4 border-l-indigo-600' },
  // SESSION_MODE_COLOR.sale  teal-600  — Tailwind class equivalent of the palette hex
  { mode: 'sale', label: 'Sale', borderClass: 'border-l-4 border-l-teal-600' },
];

export function HouseSaleSplit() {
  const query = useHouseSaleSplit();

  return (
    <section
      className="rounded-lg border border-rule bg-bg p-4"
      data-testid="app-12-card"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink-2">House vs sale</h2>
        <span className="text-sm text-ink-3">Selected range</span>
      </div>
      <div className="h-72">
        {query.isLoading ? (
          <div className="h-full grid grid-cols-2 gap-4" data-testid="house-sale-loading">
            <div
              className="rounded bg-bg-3 animate-pulse"
              data-testid="house-sale-skeleton-house"
              aria-busy="true"
            />
            <div
              className="rounded bg-bg-3 animate-pulse"
              data-testid="house-sale-skeleton-sale"
              aria-busy="true"
            />
          </div>
        ) : query.error ? (
          <ErrorState
            heading="Couldn't load house vs sale"
            body="Retry below."
            onRetry={() => void query.refetch()}
          />
        ) : (
          (() => {
            const rows = query.data ?? [];
            const byMode = new Map(rows.map((r) => [r.mode, r] as const));
            const totalSessions = rows.reduce(
              (a, r) => a + Number(r.n_sessions),
              0,
            );

            if (totalSessions === 0) {
              return (
                <div
                  className="flex h-full items-center justify-center"
                  data-testid="house-sale-empty"
                >
                  <EmptyState heading="No sessions in this range">
                    <p>Try widening the date range.</p>
                  </EmptyState>
                </div>
              );
            }

            return (
              <div className="h-full grid grid-cols-2 gap-4">
                {MODES.map(({ mode, label, borderClass }) => {
                  const row = byMode.get(mode);
                  const nSessions = Number(row?.n_sessions ?? 0);
                  const nItems = Number(row?.n_items ?? 0);
                  return (
                    <div
                      key={mode}
                      className={`rounded ${borderClass} bg-bg border border-rule p-6 flex flex-col justify-center`}
                      data-testid={`house-sale-tile-${mode}`}
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-ink-3">
                        {label}
                      </div>
                      <div className="text-3xl font-semibold tabular-nums text-ink mt-2">
                        {formatCount(nSessions)}
                      </div>
                      <div className="text-sm text-ink-3 mt-1">
                        {nSessions} {nSessions === 1 ? 'session' : 'sessions'} ·{' '}
                        {formatCount(nItems)} {nItems === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </section>
  );
}
