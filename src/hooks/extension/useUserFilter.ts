import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

// Phase 2 / EXT-07 — URL-state user-email filter (D-17).
// Single source of truth = URL. Comma-separated single key form mirrors
// useDateRange's `?range=` precedent (UI-SPEC § Open Items "URL filter param
// naming"). Empty array means "no filter" — caller passes [] to clear.
//
// Sort semantics: this hook preserves insertion order from the URL. The
// consumer hook (e.g. useEventVolume) is responsible for sorting before
// placing the array into a TanStack Query queryKey (RESEARCH Pitfall 3).

export interface UserFilterValue {
  users: string[];
  setUsers: (next: string[]) => void;
}

export function useUserFilter(): UserFilterValue {
  const [params, setParams] = useSearchParams();

  const raw = params.get('users');
  // Guard against `?users=` (empty value) — `''.split(',')` returns `['']`.
  const users = raw ? raw.split(',').filter((v) => v.length > 0) : [];

  const setUsers = useCallback(
    (next: string[]) => {
      // Single-closure write (useDateRange Pitfall 5): merge into one
      // setParams call so React Router 7 batches the update.
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next.length === 0) copy.delete('users');
          else copy.set('users', next.join(','));
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { users, setUsers };
}
