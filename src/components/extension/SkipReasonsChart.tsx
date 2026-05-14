import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { useSkipReasons } from '../../hooks/extension/useSkipReasons';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

// category-filtered-batch — Skip Reasons donut.
//
// 5 slices, one per skip-reason bucket. Sums come from useSkipReasons which
// aggregates the typed analytics_events columns client-side. When all 5
// totals are 0 (historical-only periods or genuinely quiet ranges) the chart
// renders an EmptyState rather than a zero-radius arc.
//
// Modeled on ErrorRateChart for loading/error/empty branches and on
// AiStatusDonut for the PieChart composition.

const SLICES = [
  { key: 'no_photos', label: 'No photos', fill: '#9ca3af' }, // gray-400 — neutral / unsalvageable input
  { key: 'fields_filled', label: 'Fields filled', fill: '#0d9488' }, // teal-600 — already complete (good outcome)
  { key: 'manually', label: 'Manual skip', fill: '#0284c7' }, // sky-600 — user-initiated
  { key: 'category_filter', label: 'Category filter', fill: '#7c3aed' }, // violet-600 — filter-driven (new behavior)
  { key: 'classification_failed', label: 'Classification failed', fill: '#dc2626' }, // red-600 — failure
] as const;

type SliceKey = (typeof SLICES)[number]['key'];

export function SkipReasonsChart() {
  const query = useSkipReasons();

  if (query.isLoading) {
    return (
      <div
        className="h-full w-full animate-pulse rounded bg-bg-3"
        data-testid="skip-reasons-skeleton"
        aria-busy="true"
      />
    );
  }

  if (query.error) {
    return (
      <ErrorState
        heading="Couldn't load skip reasons"
        body="Something went wrong. Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const totals = query.data;
  if (!totals || totals.total === 0) {
    return (
      <div
        className="flex h-full items-center justify-center"
        data-testid="skip-reasons-empty"
      >
        <EmptyState heading="No skipped items in this range">
          <p>
            Either no batches ran, or every batched item was generated. The 5
            skip-reason columns only populate for batches run on extension
            v2.x+ (migration 007).
          </p>
        </EmptyState>
      </div>
    );
  }

  const data = SLICES.map((s) => ({
    name: s.label,
    key: s.key as SliceKey,
    value: totals[s.key],
    fill: s.fill,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="60%"
          outerRadius="85%"
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((slice) => (
            <Cell key={slice.key} fill={slice.fill} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => Number(v).toLocaleString()} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
