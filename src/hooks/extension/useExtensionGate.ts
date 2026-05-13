import { useQuery } from '@tanstack/react-query';
import { fetchExtensionGate } from '../../services/extension/queries';

// Phase 2 / D-19 — Lifetime emptiness probe for /extension.
// Single network call per session; never refetched (staleTime: Infinity).
// Documented trade-off (CONTEXT § Deferred — "Empty-state polling"):
// if events arrive mid-session, user must refresh to see them.
//
// D-01 is enforced inside fetchExtensionGate (queries.ts).

export function useExtensionGate() {
  const q = useQuery({
    queryKey: ['extension', 'gate'],
    queryFn: () => fetchExtensionGate(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  return {
    isLoading: q.isLoading,
    isEmpty: !q.isLoading && !q.error && q.data?.hasAny === false,
    error: q.error,
  };
}
