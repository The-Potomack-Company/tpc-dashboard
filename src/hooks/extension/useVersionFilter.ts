import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

// Phase 2 / EXT-09 — URL-state extension_version filter (D-17).
// The version filter input ONLY renders inside <DeveloperPanel> (D-15), but
// the underlying ?versions= URL param applies to charts on both surfaces.
// Same hook contract as useUserFilter; same single-closure write idiom.

export interface VersionFilterValue {
  versions: string[];
  setVersions: (next: string[]) => void;
}

export function useVersionFilter(): VersionFilterValue {
  const [params, setParams] = useSearchParams();

  const raw = params.get('versions');
  // Guard against `?versions=` (empty value) — `''.split(',')` returns `['']`.
  const versions = raw ? raw.split(',').filter((v) => v.length > 0) : [];

  const setVersions = useCallback(
    (next: string[]) => {
      // Single-closure write (useDateRange Pitfall 5): merge into one
      // setParams call so React Router 7 batches the update.
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next.length === 0) copy.delete('versions');
          else copy.set('versions', next.join(','));
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { versions, setVersions };
}
