import { useQuery } from '@tanstack/react-query';
import { fetchPhotoCoverage } from '../../services/activity/queries';

/**
 * @filterScope one-shot — APP-10. Per-session photo coverage stats.
 *   Single record; disabled when sessionId is undefined.
 */
export function usePhotoCoverage(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['activity', 'photoCoverage', sessionId] as const,
    queryFn: () =>
      sessionId ? fetchPhotoCoverage({ sessionId }) : Promise.resolve(null),
    enabled: !!sessionId,
  });
}
