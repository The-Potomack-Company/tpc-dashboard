import { useQuery } from '@tanstack/react-query';
import { fetchActiveSpecialists } from '../../services/activity/queries';

/**
 * @filterScope one-shot — APP-08 / D-19. Static option list; consumes NO filters.
 *   Returns active specialists ordered by display_name. Excludes admins.
 *   60s staleTime (inherited from QueryClientProvider) is fine; admin
 *   deactivations propagate within a minute.
 */
export function useActiveSpecialists() {
  return useQuery({
    queryKey: ['activity', 'activeSpecialists'] as const,
    queryFn: () => fetchActiveSpecialists(),
  });
}
