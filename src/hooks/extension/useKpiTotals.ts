import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchKpiTotals } from '../../services/extension/queries';

// Phase 2 / EXT-02 — KPI totals + previous-period counts + sparkline series.
// Sparkline resolution depends on the bucket arg (D-08), so bucket flows into
// both the queryKey and the fetch args.

export function useKpiTotals() {
  const { from, to, range } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const bucket: 'day' | 'hour' = range === 'today' ? 'hour' : 'day';
  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'kpiTotals',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
        bucket,
      },
    ],
    queryFn: () => fetchKpiTotals({ from, to, users, versions, bucket }),
  });
}
