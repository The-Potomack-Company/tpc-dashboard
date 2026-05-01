import { useQuery } from '@tanstack/react-query';
import { fetchSessionPhotos } from '../../services/activity/queries';

/**
 * @filterScope one-shot — D-09 lazy per-item. Mounts only when an item row is
 *   expanded. Fetches photo METADATA only; signed URLs are computed per-photo
 *   by `src/hooks/useSignedPhotoUrl.ts` (Plan 03-02 — NOT re-exported here).
 */
export function useSessionPhotos(itemId: string | undefined) {
  return useQuery({
    queryKey: ['activity', 'sessionPhotos', itemId] as const,
    queryFn: () =>
      itemId ? fetchSessionPhotos({ itemId }) : Promise.resolve([]),
    enabled: !!itemId,
  });
}
