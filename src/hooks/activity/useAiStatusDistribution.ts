import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { useDevDataInclusion } from '../useDevDataInclusion';
import { fetchAiStatusDistribution } from '../../services/activity/queries';

/**
 * @filterScope range-driven — APP-04 / D-17. Reads ?range=, ?specialists=, ?mode=.
 *   Phase 8: passes `includeDev` to the RPC (defaults false; dev opt-in).
 */
export function useAiStatusDistribution() {
  const { from, to } = useDateRange();
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const { includeDev } = useDevDataInclusion();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'aiStatusDistribution',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        specialists: specialistsKey,
        mode,
        includeDev,
      },
    ] as const,
    queryFn: () =>
      fetchAiStatusDistribution({ from, to, specialists, mode, includeDev }),
  });
}
