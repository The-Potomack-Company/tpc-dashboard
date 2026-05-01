import { useQuery } from '@tanstack/react-query';
import { useSpecialistFilter } from '../useSpecialistFilter';
import { useModeFilter } from '../useModeFilter';
import { fetchItemsPerSpecialist14d } from '../../services/activity/queries';

/**
 * @filterScope fixed-window — APP-03 / D-16. Trailing 14 days, server-computed.
 *   Applies ?specialists= and ?mode=. IGNORES ?range=.
 *
 *   The fixed-window classification is load-bearing: this hook MUST NOT
 *   import useDateRange. The `verify-activity-filter-scope.mjs` verifier
 *   enforces the @filterScope tag; the test file enforces the no-from/to
 *   contract at runtime.
 */
export function useItemsPerSpecialist() {
  const { specialists } = useSpecialistFilter();
  const { mode } = useModeFilter();
  const specialistsKey = [...specialists].sort();

  return useQuery({
    queryKey: [
      'activity',
      'itemsPerSpecialist14d',
      { specialists: specialistsKey, mode },
    ] as const,
    queryFn: () => fetchItemsPerSpecialist14d({ specialists, mode }),
  });
}
