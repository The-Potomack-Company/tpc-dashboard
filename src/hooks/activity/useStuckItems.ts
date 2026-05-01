import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchStuckItems } from '../../services/activity/queries';

/**
 * @filterScope right-now — APP-11 / D-18 / D-24. 2-hour threshold hard-coded server-side.
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 *   Feeds BOTH `<StuckItemsAlertCard>` (count + maxAge derived client-side)
 *   AND `/activity/stuck` page.
 */
export function useStuckItems() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: ['activity', 'stuckItems', { specialists: specialistsKey, mode }] as const,
    queryFn: () => fetchStuckItems({ specialists, mode }),
  });
}
