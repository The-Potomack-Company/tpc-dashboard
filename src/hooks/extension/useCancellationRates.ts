import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchCancellationRates } from '../../services/extension/queries';

// Phase 2 / EXT-10 — Cancellation-rate KPIs (D-07).
// Returns rows for catalog_batch + portal_upload always (2-row VALUES left-join
// in the SQL keeps cardinality stable). Each row includes
// `previous_rate: number | null` (NULL when prev denominator = 0). Plan 02-04
// CancellationRateKpis must null-check before rendering a delta chip.

export function useCancellationRates() {
  const { from, to } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'cancellationRates',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
      },
    ],
    queryFn: () => fetchCancellationRates({ from, to, users, versions }),
  });
}
