import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { useDevDataInclusion } from '../useDevDataInclusion';
import { fetchHouseSaleSplit } from '../../services/activity/queries';

/**
 * @filterScope range-driven — APP-12 / D-17. Reads ?range=, ?specialists=, ?mode=.
 *   RPC always returns 2 rows (house, sale); the UI hides the unselected
 *   mode tile when ?mode=house or ?mode=sale.
 *   Phase 8: passes `includeDev` to the RPC (defaults false; dev opt-in).
 */
export function useHouseSaleSplit() {
  const { from, to } = useDateRange();
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const { includeDev } = useDevDataInclusion();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'houseSaleSplit',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        specialists: specialistsKey,
        mode,
        includeDev,
      },
    ] as const,
    queryFn: () =>
      fetchHouseSaleSplit({ from, to, specialists, mode, includeDev }),
  });
}
