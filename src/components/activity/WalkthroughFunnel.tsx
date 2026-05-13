// src/components/activity/WalkthroughFunnel.tsx
// Phase 3 / D-32 / D-34 — Walkthrough funnel horizontal bar.
//
// RIGHT-NOW per-user state — IGNORES all filters (range, specialists, mode).
// useWalkthroughFunnel takes no args; the underlying RPC computes distinct
// users per step across the canonical walkthrough step list.
//
// Recharts BarChart with layout="vertical" produces horizontal bars (axis
// inversion). Single neutral fill `gray-400` (#9ca3af) — UI-SPEC committed:
// no semantic palette here, the bar lengths carry meaning.
//
// Compact card body (h-32) — funnel is a small dev sub-panel.
// Per-card states (D-35): animate-pulse skeleton / EmptyState / locked
// ErrorState contract.

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useWalkthroughFunnel } from '../../hooks/activity/useWalkthroughFunnel';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

// gray-400 — single neutral hue (UI-SPEC § Color)
const BAR_FILL = '#9ca3af';

export function WalkthroughFunnel() {
  const query = useWalkthroughFunnel();

  return (
    <section
      className="rounded border border-rule bg-bg p-4"
      data-testid="walkthrough-funnel"
    >
      <header className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-2">Walkthrough funnel</h4>
        <span className="text-xs text-ink-3">
          Distinct users at each step · ignores date range
        </span>
      </header>
      <div className="h-32">
        {query.isLoading ? (
          <div
            className="h-full w-full motion-safe:animate-pulse animate-pulse rounded bg-bg-3"
            aria-busy="true"
          />
        ) : query.error ? (
          <ErrorState
            heading="Couldn't load walkthrough funnel"
            body="Retry below."
            onRetry={() => void query.refetch()}
          />
        ) : (query.data ?? []).length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState heading="No walkthrough events">
              <p>The TPC App walkthrough emitter may not be live yet.</p>
            </EmptyState>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={query.data ?? []}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 16 }}
            >
              <CartesianGrid stroke="var(--rule)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="step_name" width={100} />
              <Tooltip />
              <Bar
                dataKey="distinct_users"
                fill={BAR_FILL}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
