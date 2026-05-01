import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchTodayKpis } from '../../services/activity/queries';

/**
 * @filterScope right-now — APP-01 / D-14. Anchored to today (server-computed).
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 *   Previous-period delta = "today vs yesterday" (N=1 day).
 */
export function useTodayKpis() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: ['activity', 'todayKpis', { specialists: specialistsKey, mode }] as const,
    queryFn: () => fetchTodayKpis({ specialists, mode }),
  });
}
