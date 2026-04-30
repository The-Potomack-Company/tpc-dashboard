import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { fetchLiveFeed } from '../../services/extension/queries';

// Phase 2 / EXT-08 / D-09 / D-10 / D-11 — Live event feed.
// Mechanism: TanStack `refetchInterval` at 10s (slow end of EXT-08 spec).
// Pause: function-form refetchInterval returns false (reactive to `paused`).
// Resume: setPaused(false) + queryClient.invalidateQueries({ queryKey: FEED_KEY })
// fires an immediate refetch (Pitfall 4 — flipping refetchInterval back to a
// number reschedules but does NOT fire immediately).

const FEED_KEY = ['extension', 'liveFeed'] as const;

export function useLiveFeed() {
  const [paused, setPaused] = useState(false);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => fetchLiveFeed({ limit: 50 }),
    refetchInterval: () => (paused ? false : 10_000), // D-10 (function form — D-09)
    staleTime: 0, // each refetch returns fresh rows
  });

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setPaused(false);
    void qc.invalidateQueries({ queryKey: FEED_KEY }); // D-11 immediate refetch
  }, [qc]);

  return { ...query, paused, pause, resume };
}
