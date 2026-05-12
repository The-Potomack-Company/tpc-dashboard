import { useCallback, useSyncExternalStore } from 'react';
import { useAuthStore } from '../stores/authStore';

// Phase 8 (PR #2 follow-up) — dev-only "include my testing/debug data" toggle.
//
// Background: Josh's profile is used as the daily TPC dev account; the data
// he generates pollutes admin analytics (skewed item counts, fake sessions,
// stray failures). The server-side RPCs (see migration
// 20260512000000_filter_dev_user_in_analytics_rpcs.sql) accept a
// `p_include_dev` boolean default `false`. Admin views never flip it.
//
// This hook is the client-side toggle:
//   - Admin (not dev): `includeDev` is always `false`, `setIncludeDev` is a no-op.
//     The toggle UI is hidden — admin can never see Josh's data through the
//     dashboard analytics surface.
//   - Dev: `includeDev` defaults to `false` (matches admin view at first
//     paint, so dev sees what admin sees by default), `setIncludeDev` persists
//     to localStorage so the dev's preference survives reload.
//
// Why localStorage (not URL state): the toggle is a per-device user preference,
// not part of a shareable filter set. Mixing it into the URL would cause it
// to leak into screen shares and shared-link flows.
//
// Why useSyncExternalStore (not Context or useEffect/useState): every
// analytics hook needs to read `includeDev` to thread it through the RPC
// call. A Context would force every consumer to be wrapped in a Provider;
// useSyncExternalStore is React's canonical primitive for subscribing to
// external module-level state with concurrent-rendering safety and no
// cascading-effect lint hits.

const STORAGE_KEY = 'tpc-dashboard.includeDev';

type Listener = () => void;

// Module-level state — initialised lazily from localStorage on first access.
// `useSyncExternalStore` calls `getSnapshot()` on every render to read the
// current value, and re-subscribes when the listener fan-out fires.
let moduleValue: boolean | null = null;
const listeners = new Set<Listener>();

function readFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // Only the literal string 'true' counts as enabled — anything else is
    // treated as `false` so a corrupted/missing key never silently leaks
    // dev data into admin analytics.
    return raw === 'true';
  } catch {
    return false;
  }
}

function getSnapshot(): boolean {
  if (moduleValue === null) {
    moduleValue = readFromStorage();
  }
  return moduleValue;
}

// SSR snapshot — the hook is only used in client-rendered routes, but the
// useSyncExternalStore contract requires this function to be stable and
// deterministic. Always returns `false` (admin-equivalent default) so a
// server render never accidentally enables dev-data inclusion.
function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setModuleValue(next: boolean): void {
  if (moduleValue === next) return;
  moduleValue = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
    } catch {
      // localStorage may be unavailable in private-browsing or quota-exceeded
      // scenarios. The in-memory module value still updates so the rest of
      // the session sees the new value; the preference just won't survive
      // a reload.
    }
  }
  for (const fn of listeners) fn();
}

export interface DevInclusionState {
  /** Whether RPCs should include dev (Josh's) data in their result set. */
  includeDev: boolean;
  /**
   * Flip the toggle. No-op for non-dev callers (see header rationale —
   * admins must never be able to flip this themselves).
   */
  setIncludeDev: (next: boolean) => void;
}

// Test-only — resets the module-level state. Imported only from test files;
// keeps tests independent without exposing a "reset" affordance in the API.
export function __resetDevInclusionForTests(): void {
  moduleValue = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  // Don't drop listeners — active hook instances are still subscribed.
  // Fire a notification so they re-read the fresh default snapshot.
  for (const fn of listeners) fn();
}

export function useDevDataInclusion(): DevInclusionState {
  const isDev = useAuthStore((s) => s.isDev);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setIncludeDev = useCallback(
    (next: boolean) => {
      // Hard server-side gate at the client edge: only the dev account is
      // allowed to flip this. Defense-in-depth — the UI is also hidden for
      // non-dev (so this branch should never be reached in practice), but a
      // future regression or stray test harness call MUST NOT be able to
      // toggle it on for a non-dev session.
      if (!isDev) return;
      setModuleValue(next);
    },
    [isDev],
  );

  // ADMIN-only behavior (non-dev): force `includeDev=false` regardless of
  // any stale localStorage state. This way if a developer signs in, toggles
  // it on, then signs out and a non-dev admin signs in on the same browser,
  // the admin's session does NOT inherit the stale `true` value.
  return {
    includeDev: isDev ? value : false,
    setIncludeDev,
  };
}
