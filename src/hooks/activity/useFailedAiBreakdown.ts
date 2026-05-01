import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchFailedAiBreakdown } from '../../services/activity/queries';

/**
 * @filterScope range-driven — D-29 dev. Failed-AI breakdown by specialist × mode × category.
 *   Applies ?range=, ?specialists=, ?mode=. Returns long-form rows (one per
 *   dimension); the consuming component pivots to per-dimension panels.
 */
export function useFailedAiBreakdown() {
  const { from, to } = useDateRange();
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'failedAiBreakdown',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        specialists: specialistsKey,
        mode,
      },
    ] as const,
    queryFn: () => fetchFailedAiBreakdown({ from, to, specialists, mode }),
  });
}
