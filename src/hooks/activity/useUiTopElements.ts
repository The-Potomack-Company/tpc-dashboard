import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { fetchUiTopElements } from '../../services/activity/queries';

/**
 * @filterScope range-driven — D-32 dev. Reads ?range=. Specialist + mode do
 *   NOT apply (D-34).
 */
export function useUiTopElements() {
  const { from, to } = useDateRange();

  return useQuery({
    queryKey: [
      'activity',
      'uiTopElements',
      { from: from.toISOString(), to: to.toISOString() },
    ] as const,
    queryFn: () => fetchUiTopElements({ from, to }),
  });
}
