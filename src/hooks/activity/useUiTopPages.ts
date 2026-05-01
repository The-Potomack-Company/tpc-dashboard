import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { fetchUiTopPages } from '../../services/activity/queries';

/**
 * @filterScope range-driven — D-32 dev. Reads ?range=. Specialist + mode do
 *   NOT apply (D-34 — UI dev panels are app-wide and intentionally ignore the
 *   activity surface filters).
 */
export function useUiTopPages() {
  const { from, to } = useDateRange();

  return useQuery({
    queryKey: [
      'activity',
      'uiTopPages',
      { from: from.toISOString(), to: to.toISOString() },
    ] as const,
    queryFn: () => fetchUiTopPages({ from, to }),
  });
}
