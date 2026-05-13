import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

// Phase 3 / APP-08 / D-21 — URL-state specialist email multi-select filter.
// Comma-separated single-key form mirrors Phase 2 useUserFilter exactly.
// Empty array = "no filter" (D-19).
//
// Sort semantics: this hook preserves insertion order from the URL. The
// consumer hook (e.g. activity hooks added by Plan 03-03) is responsible
// for sorting before placing the array into a TanStack Query queryKey
// (RESEARCH Pitfall 3).
//
// Note: this is a URL-state primitive (NOT under src/hooks/activity/),
// so the @filterScope JSDoc tag introduced for activity hooks does not
// apply here — the verifier `verify-activity-filter-scope.mjs` only
// scans src/hooks/activity/.

export interface SpecialistFilterValue {
  specialists: string[]; // emails
  setSpecialists: (next: string[]) => void;
}

export function useSpecialistFilter(): SpecialistFilterValue {
  const [params, setParams] = useSearchParams();

  const raw = params.get('specialists');
  // Guard against `?specialists=` (empty value) — `''.split(',')` returns `['']`.
  const specialists = raw ? raw.split(',').filter((v) => v.length > 0) : [];

  const setSpecialists = useCallback(
    (next: string[]) => {
      // Single-closure write (useDateRange Pitfall 5): merge into one
      // setParams call so React Router 7 batches the update.
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next.length === 0) copy.delete('specialists');
          else copy.set('specialists', next.join(','));
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { specialists, setSpecialists };
}
