import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { useDevDataInclusion } from '../useDevDataInclusion';
import { fetchStuckItems } from '../../services/activity/queries';

/**
 * @filterScope right-now — APP-11 / D-18 / D-24. 2-hour threshold hard-coded server-side.
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 *   Feeds BOTH `<StuckItemsAlertCard>` (count + maxAge derived client-side)
 *   AND `/activity/stuck` page.
 *   Phase 8: passes `includeDev` to the RPC (defaults false; dev opt-in).
 */
export function useStuckItems() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const { includeDev } = useDevDataInclusion();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'stuckItems',
      { specialists: specialistsKey, mode, includeDev },
    ] as const,
    queryFn: () => fetchStuckItems({ specialists, mode, includeDev }),
  });
}
