import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchPerUserSummary } from '../../services/extension/queries';

// Phase 2 / EXT-04 — Per-user table summary (D-04: NULL emails grouped as 'Unknown' inside the RPC).

export function usePerUserSummary() {
  const { from, to } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'perUserSummary',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
      },
    ],
    queryFn: () => fetchPerUserSummary({ from, to, users, versions }),
  });
}
