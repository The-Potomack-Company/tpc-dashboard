import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchActiveSessions } from '../../services/activity/queries';

/**
 * @filterScope right-now — APP-02 / D-15. Active sessions list (status='active').
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 */
export function useActiveSessions() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: ['activity', 'activeSessions', { specialists: specialistsKey, mode }] as const,
    queryFn: () => fetchActiveSessions({ specialists, mode }),
  });
}
