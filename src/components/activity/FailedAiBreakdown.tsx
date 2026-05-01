// src/components/activity/FailedAiBreakdown.tsx
// Phase 3 / D-29 — Failed-AI breakdown 3-column grid.
//
// Range-driven via useFailedAiBreakdown (which consumes useDateRange,
// useSpecialistFilter, useModeFilter). The hook returns long-form rows
// (one per dimension × dim_key); this component pivots the rows
// client-side into 3 columns: by specialist, by mode, by category.
//
// The component does NOT internally gate by isDev — the parent
// <DeveloperPanel> render-conditional gate handles that. If this component
// somehow rendered standalone for a non-dev, the underlying RPC would still
// run (admin RLS allows reading items aggregates), but the dev surface is
// never reachable for non-devs anyway.
//
// Per-card states (D-35): loading skeleton, empty state, locked ErrorState.
// Card grid uses the simple `<ul>` list rendering described in UI-SPEC
// § Failed-AI Breakdown sub-panel — visual density beats KpiCard chrome
// when each row is "label + count".

import { useFailedAiBreakdown } from '../../hooks/activity/useFailedAiBreakdown';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { formatCount } from '../../lib/format';

const DIMENSIONS: ReadonlyArray<{
  key: 'specialist' | 'mode' | 'category';
  heading: string;
}> = [
  { key: 'specialist', heading: 'By specialist' },
  { key: 'mode',       heading: 'By mode' },
  { key: 'category',   heading: 'By category' },
];

export function FailedAiBreakdown() {
  const query = useFailedAiBreakdown();

  return (
    <section className="space-y-3" data-testid="failed-ai-breakdown">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Failed-AI breakdown
        </h3>
        <span className="text-xs text-gray-500">
          Items where ai_status = 'failed' · selected range
        </span>
      </header>

      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded bg-gray-100 motion-safe:animate-pulse animate-pulse"
            />
          ))}
        </div>
      ) : query.error ? (
        // LOCKED Phase 1 ErrorState contract — heading + body + onRetry.
        // No children, no sibling Retry button (D-35).
        <ErrorState
          heading="Couldn't load failed-AI breakdown"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState heading="No AI failures in this range">
          <p>Healthy AI run.</p>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DIMENSIONS.map(({ key, heading }) => {
            const rows = (query.data ?? []).filter((r) => r.dimension === key);
            return (
              <div
                key={key}
                className="rounded border border-gray-200 bg-white p-4"
              >
                <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                  {heading}
                </h4>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">None</p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.dim_key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span
                          className="text-gray-700 truncate"
                          title={row.dim_label}
                        >
                          {row.dim_label}
                        </span>
                        <span className="font-semibold text-gray-900 tabular-nums">
                          {formatCount(Number(row.item_count))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
