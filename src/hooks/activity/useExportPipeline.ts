import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchExportPipeline } from '../../services/activity/queries';

/**
 * @filterScope range-driven — APP-05 / D-17. Reads ?range=, ?specialists=, ?mode=.
 *   5-segment pipeline (includes 'completed' per Plan 03-01 Open Q1 lock).
 */
export function useExportPipeline() {
  const { from, to } = useDateRange();
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'exportPipeline',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        specialists: specialistsKey,
        mode,
      },
    ] as const,
    queryFn: () => fetchExportPipeline({ from, to, specialists, mode }),
  });
}
