import { useQuery } from '@tanstack/react-query';
import { fetchDistinctVersions } from '../../services/extension/queries';

// Phase 2 / EXT-09 — Distinct extension_version option list for the
// ExtensionVersionFilter (Plan 02-07). Cached for 5 minutes; versions
// change rarely. Filter-independent queryKey: the version OPTIONS don't
// narrow with user/date filters — only the chart data does.
//
// Sole source of truth for Plan 02-07's ExtensionVersionFilter option list
// (Checker WARNING #4 fix — no inline supabase queries in components).
// D-01 invariant lives inside fetchDistinctVersions (queries.ts).

export function useDistinctVersions() {
  return useQuery({
    queryKey: ['extension', 'distinctVersions'],
    queryFn: () => fetchDistinctVersions(),
    staleTime: 5 * 60_000, // 5 minutes
  });
}
