import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { useDevDataInclusion } from '../useDevDataInclusion';
import { fetchActiveSessions } from '../../services/activity/queries';

/**
 * @filterScope right-now — APP-02 / D-15. Active sessions list (status='active').
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 *   Phase 8: passes `includeDev` to the RPC (defaults false; dev opt-in).
 */
export function useActiveSessions() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const { includeDev } = useDevDataInclusion();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'activeSessions',
      { specialists: specialistsKey, mode, includeDev },
    ] as const,
    queryFn: () => fetchActiveSessions({ specialists, mode, includeDev }),
  });
}
