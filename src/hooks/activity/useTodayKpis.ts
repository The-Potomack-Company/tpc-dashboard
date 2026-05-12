import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { useDevDataInclusion } from '../useDevDataInclusion';
import { fetchTodayKpis } from '../../services/activity/queries';

/**
 * @filterScope right-now — APP-01 / D-14. Anchored to today (server-computed).
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 *   Previous-period delta = "today vs yesterday" (N=1 day).
 *   Phase 8: passes `includeDev` to the RPC so admin views exclude Josh's
 *   testing data by default; dev can opt in via the DeveloperPanel toggle.
 */
export function useTodayKpis() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const { includeDev } = useDevDataInclusion();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'todayKpis',
      { specialists: specialistsKey, mode, includeDev },
    ] as const,
    queryFn: () => fetchTodayKpis({ specialists, mode, includeDev }),
  });
}
