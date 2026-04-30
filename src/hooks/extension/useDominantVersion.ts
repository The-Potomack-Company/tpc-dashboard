import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchDominantVersion } from '../../services/extension/queries';

// Phase 2 / EXT-09 — Dominant extension_version badge (D-06).
// Returns the single dominant row or null when the result set is empty.

export function useDominantVersion() {
  const { from, to } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'dominantVersion',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
      },
    ],
    queryFn: () => fetchDominantVersion({ from, to, users, versions }),
  });
}
