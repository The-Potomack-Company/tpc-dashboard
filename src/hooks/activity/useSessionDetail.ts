import { useQuery } from '@tanstack/react-query';
import {
  fetchSessionDetail,
  fetchSessionItems,
} from '../../services/activity/queries';

/**
 * @filterScope one-shot — APP-06. Single record; no filter folding.
 *   Disabled when sessionId is undefined.
 */
export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['activity', 'sessionDetail', sessionId] as const,
    queryFn: () =>
      sessionId ? fetchSessionDetail({ sessionId }) : Promise.resolve(null),
    enabled: !!sessionId,
  });
}

/**
 * @filterScope one-shot — APP-06. Co-located with useSessionDetail because the
 *   Session Detail page mounts both side by side. Returns the item list with
 *   embedded photo_count (derived from PostgREST `photos(count)` aggregate).
 *   Per-item photo URLs are fetched lazily by useSessionPhotos when a row is expanded.
 */
export function useSessionItems(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['activity', 'sessionItems', sessionId] as const,
    queryFn: () =>
      sessionId ? fetchSessionItems({ sessionId }) : Promise.resolve([]),
    enabled: !!sessionId,
  });
}
