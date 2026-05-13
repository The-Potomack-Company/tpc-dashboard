import { KpiCard } from '../kit/KpiCard';
import { useCancellationRates } from '../../hooks/extension/useCancellationRates';
import { ErrorState } from '../ErrorState';
import { formatPercent, EMPTY } from '../../lib/format';
import { computeFlippedDelta } from './computeFlippedDelta';
import type { CancelRateRow } from '../../services/extension/queries';

// Phase 2 / EXT-10 — Cancellation rate KPIs (D-07).
// W2 catalog_batch cancel rate + W3 portal_upload cancel rate.
//
// FLIPPED-direction math lives in ./computeFlippedDelta.ts (extracted so
// react-refresh/only-export-components stays clean and the helper can be
// unit-tested without mounting). See that module's header for the full
// direction-mapping rationale.
//
// previous_rate is provided by get_cancellation_rates (Plan 02-01 D-05
// extension). When the RPC returns previous_rate=NULL (denominator was 0
// in the previous period), the helper returns undefined and we omit the
// delta — never fake a direction. NOTE: Supabase gen-types emits
// previous_rate as `number` even though SQL can return NULL — Plan 02-01
// SUMMARY documents this gap. This component null-checks at runtime
// regardless of the type.

const TARGETS = [
  { event_type: 'catalog_batch', label: 'catalog_batch cancel rate' },
  { event_type: 'portal_upload', label: 'portal_upload cancel rate' },
] as const;

function rowFor(
  rows: CancelRateRow[] | undefined,
  type: string,
): CancelRateRow | undefined {
  return rows?.find((r) => r.event_type === type);
}

export function CancellationRateKpis() {
  const query = useCancellationRates();

  if (query.error) {
    // LOCKED ErrorState contract (Phase 1): heading + body (string) + onRetry.
    // No children, no sibling Retry button — the component renders one.
    return (
      <ErrorState
        heading="Couldn't load cancellation rates"
        body="Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {TARGETS.map(({ event_type, label }) => {
        if (query.isLoading) {
          return (
            <KpiCard key={event_type} label={label} value={EMPTY} loading />
          );
        }
        const row = rowFor(query.data, event_type);
        const total = Number(row?.total_count ?? 0);
        if (total === 0) {
          // Denominator zero — value EMPTY, delta omitted (no divide-by-zero).
          return <KpiCard key={event_type} label={label} value={EMPTY} />;
        }
        const currentRate = Number(row?.rate ?? 0);
        // Runtime null-check (gen-types nullability gap — see header comment).
        const previousRate =
          row?.previous_rate == null ? null : Number(row.previous_rate);
        const value = formatPercent(currentRate * 100);
        const delta = computeFlippedDelta(currentRate, previousRate);
        return (
          <KpiCard
            key={event_type}
            label={label}
            value={value}
            delta={delta}
          />
        );
      })}
    </div>
  );
}
