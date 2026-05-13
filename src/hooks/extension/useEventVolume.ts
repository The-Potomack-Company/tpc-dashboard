import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchEventVolume } from '../../services/extension/queries';

// Phase 2 / EXT-01 — 14-day stacked bar (or hourly when range=today, D-08).
// Folds URL filters into the queryKey so filter changes naturally invalidate
// (no manual invalidateQueries). Sorted arrays in the key (Pitfall 3) keep
// cache hits stable across user-input order; the fetch arg keeps URL order.

export function useEventVolume() {
  const { from, to, range } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const bucket: 'day' | 'hour' = range === 'today' ? 'hour' : 'day';
  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'eventVolume',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
        bucket,
      },
    ],
    queryFn: () => fetchEventVolume({ from, to, users, versions, bucket }),
    // staleTime/retry/refetchOnWindowFocus inherited from QueryClientProvider (src/main.tsx)
  });
}
