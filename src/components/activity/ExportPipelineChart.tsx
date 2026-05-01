// Phase 3 / APP-05 / D-17 — range-driven Export Pipeline horizontal stacked bar.
// Pipeline progression order (left to right): active → submitted → returned → exported → completed.
// 5th 'completed' segment is the Plan 03-01 Open Q1 lock — TPC App migration
// 20260320000000 added the 'completed' status; we surface it as its own segment
// (slate-500) rather than collapsing it into 'exported'.
//
// Filter scope: applies ?range=, ?specialists=, ?mode= via the underlying
// useExportPipeline hook. Bar height h-32 (single horizontal bar) per UI-SPEC.

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
import { useExportPipeline } from '../../hooks/activity/useExportPipeline';
import { SESSION_STATUS_COLOR } from '../../lib/chartPalette';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

const STATUS_ORDER = [
  'active',
  'submitted',
  'returned',
  'exported',
  'completed',
] as const;
type SessionStatus = (typeof STATUS_ORDER)[number];

export function ExportPipelineChart() {
  const query = useExportPipeline();

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 mt-8"
      data-testid="app-05-card"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Export pipeline</h2>
        <span className="text-sm text-gray-500">
          Sessions by status · selected range
        </span>
      </div>
      <div className="h-32" data-testid="export-pipeline-body">
        {query.isLoading ? (
          <div
            className="h-full w-full animate-pulse rounded bg-gray-100"
            data-testid="export-pipeline-skeleton"
            aria-busy="true"
          />
        ) : query.error ? (
          <ErrorState
            heading="Couldn't load export pipeline"
            body="Retry below."
            onRetry={() => void query.refetch()}
          />
        ) : (
          (() => {
            const counts: Record<SessionStatus, number> = {
              active: 0,
              submitted: 0,
              returned: 0,
              exported: 0,
              completed: 0,
            };
            for (const row of query.data ?? []) {
              if ((STATUS_ORDER as readonly string[]).includes(row.status)) {
                counts[row.status as SessionStatus] = Number(row.session_count);
              }
            }
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            if (total === 0) {
              return (
                <div
                  className="flex h-full items-center justify-center"
                  data-testid="export-pipeline-empty"
                >
                  <EmptyState heading="No sessions in this range">
                    <p>Try widening the date range or clearing filters.</p>
                  </EmptyState>
                </div>
              );
            }
            // Single-row dataset for a horizontal stacked bar — Recharts'
            // layout='vertical' inverts the axes so the dataKey runs along X.
            const data = [{ pipeline: 'Sessions', ...counts }];
            return (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="pipeline" hide />
                  <Tooltip />
                  <Legend />
                  {STATUS_ORDER.map((status) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      stackId="pipeline"
                      fill={SESSION_STATUS_COLOR[status]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </div>
    </section>
  );
}
