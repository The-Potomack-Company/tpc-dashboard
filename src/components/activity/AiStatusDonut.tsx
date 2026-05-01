// Phase 3 / APP-04 / D-17 — range-driven AI status donut.
// Filter scope: applies ?range=, ?specialists=, ?mode= via the underlying hook.
//
// Failed slice is pulled out by raising its outerRadius from 80% → 85% (per UI-SPEC § APP-04).
// Center label renders the integer percent of items in `done` status across the 5-status total
// (24px tabular-nums) plus a 14px muted "AI done" caption. When total = 0 (empty range) the
// component renders an EmptyState in the chart body instead of a zero-radius arc.

import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { useAiStatusDistribution } from '../../hooks/activity/useAiStatusDistribution';
import { AI_STATUS_COLOR } from '../../lib/chartPalette';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

const ORDER = ['pending', 'processing', 'queued', 'done', 'failed'] as const;
type AiStatus = (typeof ORDER)[number];

export function AiStatusDonut() {
  const query = useAiStatusDistribution();

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid="app-04-card"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">AI status</h2>
        <span className="text-sm text-gray-500">Items created in selected range</span>
      </div>
      <div className="h-72 relative">
        {query.isLoading ? (
          <div
            className="h-full w-full animate-pulse rounded bg-gray-100"
            data-testid="ai-status-skeleton"
            aria-busy="true"
          />
        ) : query.error ? (
          <ErrorState
            heading="Couldn't load AI status"
            body="Retry below."
            onRetry={() => void query.refetch()}
          />
        ) : (
          (() => {
            const counts: Record<AiStatus, number> = {
              pending: 0,
              processing: 0,
              queued: 0,
              done: 0,
              failed: 0,
            };
            for (const row of query.data ?? []) {
              if ((ORDER as readonly string[]).includes(row.ai_status)) {
                counts[row.ai_status as AiStatus] = Number(row.item_count);
              }
            }
            const total = Object.values(counts).reduce((a, b) => a + b, 0);

            if (total === 0) {
              return (
                <div
                  className="flex h-full items-center justify-center"
                  data-testid="ai-status-empty"
                >
                  <EmptyState heading="No items in this range">
                    <p>Try widening the date range.</p>
                  </EmptyState>
                </div>
              );
            }

            const slices = ORDER.map((s) => ({ name: s, value: counts[s] }));
            const pctDone = Math.round((counts.done / total) * 100);

            return (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {slices.map((slice) => (
                        // Per-Cell `outerRadius` is a runtime feature of Recharts but is
                        // missing from Cell's typed props in 3.8.1 (Cell type only exposes
                        // fill / stroke). Cast routes the prop through unchanged at runtime.
                        // [CITED: recharts.github.io/api/Pie/ — Cell outerRadius prop, RESEARCH § APP-04]
                        <Cell
                          key={slice.name}
                          fill={AI_STATUS_COLOR[slice.name]}
                          {...({ outerRadius: slice.name === 'failed' ? '85%' : '80%' } as Record<string, string>)}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  data-testid="ai-status-center-label"
                >
                  <span className="text-2xl font-semibold tabular-nums text-gray-900">
                    {pctDone}%
                  </span>
                  <span className="text-sm text-gray-500">AI done</span>
                </div>
              </>
            );
          })()
        )}
      </div>
    </section>
  );
}
