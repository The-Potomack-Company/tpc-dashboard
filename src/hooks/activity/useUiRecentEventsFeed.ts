import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { fetchUiRecentEvents } from '../../services/activity/queries';

// Phase 3 / D-32 dev panel — Recent Events Feed.
// Mirrors src/hooks/extension/useLiveFeed.ts verbatim:
//   - 10s polling via function-form refetchInterval (reactive to `paused`).
//   - Pause: setPaused(true) → next interval call returns `false` → polling halts.
//   - Resume: setPaused(false) + queryClient.invalidateQueries fires immediate
//     refetch (Pitfall 10 — flipping refetchInterval back to a number reschedules
//     the next tick but does NOT fire immediately).
//   - staleTime: 0 so each refetch returns fresh rows.
//
// Underlying fetch hits ui_interactions with `.eq('app_source', 'tpc-app')`
// (D-33 — enforced in the services layer; tested in queries.test.ts).

const FEED_KEY = ['activity', 'uiRecentEvents'] as const;

/**
 * @filterScope live-tail — D-32 dev. 10s polling; pause/resume; row click opens PayloadViewerModal.
 */
export function useUiRecentEventsFeed() {
  const [paused, setPaused] = useState(false);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => fetchUiRecentEvents({ limit: 50 }),
    refetchInterval: () => (paused ? false : 10_000),
    staleTime: 0,
  });

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setPaused(false);
    void qc.invalidateQueries({ queryKey: FEED_KEY });
  }, [qc]);

  return { ...query, paused, pause, resume };
}
