import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchRecentErrors } from '../../services/extension/queries';

// Phase 2 / EXT-05 — Recent Errors table.
// Cap locked at 100 per UI-SPEC EXT-05 subheading copy.

const LIMIT = 100;

export function useRecentErrors() {
  const { from, to } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'recentErrors',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
        limit: LIMIT,
      },
    ],
    queryFn: () => fetchRecentErrors({ from, to, users, versions, limit: LIMIT }),
  });
}
