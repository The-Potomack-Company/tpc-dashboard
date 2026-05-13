import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

// Phase 3 / APP-09 / D-20 / D-21 — URL-state session-mode toggle.
// Default = 'all' (NO ?mode= URL param). 'house' | 'sale' filters
// server-side via sessions.mode. Defensive parse: invalid values fall
// back to 'all'.
//
// Note: this is a URL-state primitive (NOT under src/hooks/activity/),
// so the @filterScope JSDoc tag introduced for activity hooks does not
// apply here — the verifier `verify-activity-filter-scope.mjs` only
// scans src/hooks/activity/.

export type SessionMode = 'house' | 'sale' | 'all';

export interface ModeFilterValue {
  mode: SessionMode;
  setMode: (next: SessionMode) => void;
}

function isMode(v: string | null): v is SessionMode {
  return v === 'house' || v === 'sale' || v === 'all';
}

export function useModeFilter(): ModeFilterValue {
  const [params, setParams] = useSearchParams();

  const raw = params.get('mode');
  const mode: SessionMode = isMode(raw) ? raw : 'all';

  const setMode = useCallback(
    (next: SessionMode) => {
      // Single-closure write idiom — same as useSpecialistFilter and
      // Phase 2 useUserFilter. React Router 7 batches the update.
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next === 'all') copy.delete('mode');
          else copy.set('mode', next);
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  return { mode, setMode };
}
