import { useQuery } from '@tanstack/react-query';
import { fetchWalkthroughFunnel } from '../../services/activity/queries';

/**
 * @filterScope right-now — D-32 dev. Per-user state. IGNORES all filters
 *   (range, specialists, mode). The funnel is computed across the canonical
 *   walkthrough step list with current distinct-user-per-step counts.
 */
export function useWalkthroughFunnel() {
  return useQuery({
    queryKey: ['activity', 'walkthroughFunnel'] as const,
    queryFn: () => fetchWalkthroughFunnel(),
  });
}
