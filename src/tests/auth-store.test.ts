import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module BEFORE importing authStore. The mock exposes:
//   - `__fireAuthEvent` so tests can simulate onAuthStateChange callbacks.
//   - `__resetAuthCallbacks` so each test starts with an empty subscriber
//     list (otherwise callbacks accumulate across tests and multiple stores
//     all react to a single fired event, corrupting state).
//   - `__setGetSessionResult` so tests can seed what `getSession()` returns
//     at bootstrap (valid session, expired session, or null).
vi.mock('../lib/supabase', () => {
  const onAuthStateChangeCallbacks: Array<(evt: string, session: unknown) => void> = [];
  let nextGetSessionResult: { data: { session: unknown }; error: unknown } = {
    data: { session: null },
    error: null,
  };
  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        getSession: vi.fn(async () => nextGetSessionResult),
        onAuthStateChange: vi.fn((cb: (evt: string, session: unknown) => void) => {
          onAuthStateChangeCallbacks.push(cb);
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(() => {
                  const idx = onAuthStateChangeCallbacks.indexOf(cb);
                  if (idx >= 0) onAuthStateChangeCallbacks.splice(idx, 1);
                }),
              },
            },
          };
        }),
        __fireAuthEvent: (evt: string, session: unknown) => {
          onAuthStateChangeCallbacks.forEach((cb) => cb(evt, session));
        },
        __resetAuthCallbacks: () => {
          onAuthStateChangeCallbacks.length = 0;
        },
        __setGetSessionResult: (result: { data: { session: unknown }; error: unknown }) => {
          nextGetSessionResult = result;
        },
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({
          data: { id: 'u1', role: 'admin', display_name: 'Admin', is_active: true },
          error: null,
        })),
      })),
    },
  };
});

import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

type AuthWithHelper = {
  __fireAuthEvent: (evt: string, session: unknown) => void;
  __resetAuthCallbacks: () => void;
  __setGetSessionResult: (result: { data: { session: unknown }; error: unknown }) => void;
};

type MockableFrom = {
  mockReturnValueOnce: (value: unknown) => void;
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      isAdmin: false,
      isDev: false,
      loading: true,
      profileLoading: false,
      profileLoaded: false,
    });
    (supabase.auth as unknown as AuthWithHelper).__resetAuthCallbacks();
    // Default: no stored session — getSession() returns null so bootstrap
    // finishes without touching the profiles table.
    (supabase.auth as unknown as AuthWithHelper).__setGetSessionResult({
      data: { session: null },
      error: null,
    });
    vi.clearAllMocks();
  });

  it('signIn delegates to supabase.auth.signInWithPassword with credentials', async () => {
    await useAuthStore.getState().signIn('test@example.com', 'password123');
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('signOut calls supabase.auth.signOut with scope local', async () => {
    await useAuthStore.getState().signOut();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('initialize subscribes to onAuthStateChange and clears state on SIGNED_OUT', async () => {
    const unsubscribe = useAuthStore.getState().initialize();
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();

    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_OUT', null);
    await new Promise((r) => setTimeout(r, 0));

    const s = useAuthStore.getState();
    expect(s.loading).toBe(false);
    expect(s.session).toBe(null);
    expect(s.user).toBe(null);
    expect(s.profile).toBe(null);
    expect(s.isAdmin).toBe(false);
    expect(s.profileLoading).toBe(false);

    unsubscribe();
  });

  it('sets isAdmin=true when profile.role === "admin" after SIGNED_IN', async () => {
    useAuthStore.getState().initialize();
    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_IN', {
      user: { id: 'u1' },
    });

    // Wait for the async profile fetch to resolve.
    await new Promise((r) => setTimeout(r, 10));

    const s = useAuthStore.getState();
    expect(s.isAdmin).toBe(true);
    expect(s.profile?.role).toBe('admin');
    expect(s.profileLoading).toBe(false);
    expect(s.loading).toBe(false);
  });

  it('sets isAdmin=false when profile.role is not "admin"', async () => {
    (supabase.from as unknown as MockableFrom).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: { id: 'u2', role: 'specialist', display_name: 'Spec', is_active: true },
        error: null,
      })),
    });

    useAuthStore.getState().initialize();
    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_IN', {
      user: { id: 'u2' },
    });

    await new Promise((r) => setTimeout(r, 10));

    const s = useAuthStore.getState();
    expect(s.isAdmin).toBe(false);
    expect(s.profile?.role).toBe('specialist');
  });

  // Phase 8 (PR #2 follow-up) — `isDev` is sourced from the email allowlist
  // in src/lib/devAccess.ts (NOT from profiles.role). Two admins can have
  // role='admin' but only the dev-allowlisted email gets `isDev=true`.

  it('sets isDev=true when profile.email is in the dev allowlist', async () => {
    (supabase.from as unknown as MockableFrom).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'u-josh',
          role: 'admin',
          email: 'josh@potomackco.com',
          display_name: 'Josh',
          is_active: true,
        },
        error: null,
      })),
    });

    useAuthStore.getState().initialize();
    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_IN', {
      user: { id: 'u-josh' },
    });
    await new Promise((r) => setTimeout(r, 10));

    const s = useAuthStore.getState();
    expect(s.isAdmin).toBe(true);
    expect(s.isDev).toBe(true);
  });

  it('sets isDev=false when profile.email is admin but NOT in the dev allowlist (e.g. info@potomackco.com)', async () => {
    (supabase.from as unknown as MockableFrom).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'u-info',
          role: 'admin',
          email: 'info@potomackco.com',
          display_name: 'Info',
          is_active: true,
        },
        error: null,
      })),
    });

    useAuthStore.getState().initialize();
    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_IN', {
      user: { id: 'u-info' },
    });
    await new Promise((r) => setTimeout(r, 10));

    const s = useAuthStore.getState();
    expect(s.isAdmin).toBe(true);
    expect(s.isDev).toBe(false);
  });

  it('clears isDev=false on SIGNED_OUT', async () => {
    (supabase.from as unknown as MockableFrom).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'u-josh',
          role: 'admin',
          email: 'josh@potomackco.com',
          display_name: 'Josh',
          is_active: true,
        },
        error: null,
      })),
    });

    useAuthStore.getState().initialize();
    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_IN', {
      user: { id: 'u-josh' },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(useAuthStore.getState().isDev).toBe(true);

    (supabase.auth as unknown as AuthWithHelper).__fireAuthEvent('SIGNED_OUT', null);
    await new Promise((r) => setTimeout(r, 10));

    expect(useAuthStore.getState().isDev).toBe(false);
  });

  // ---------- Stale/expired token bootstrap (regression suite) ----------
  // These tests reproduce the infinite-spinner bug reported in
  // .planning/debug/stale-auth-token-infinite-spinner.md. The prior
  // implementation only set `loading: false` inside the onAuthStateChange
  // callback, so if INITIAL_SESSION was delayed/skipped the store stayed
  // `loading: true` forever and ProtectedRoute hung on its spinner.

  it('flips loading=false at bootstrap when no stored session exists (INITIAL_SESSION may never fire)', async () => {
    // Simulate the real-world scenario: localStorage has no token, Supabase
    // does not fire INITIAL_SESSION (or fires very late). Bootstrap must
    // still settle `loading: false` on its own via `getSession()`.
    (supabase.auth as unknown as AuthWithHelper).__setGetSessionResult({
      data: { session: null },
      error: null,
    });

    const unsubscribe = useAuthStore.getState().initialize();

    // Intentionally do NOT fire onAuthStateChange. The store must resolve
    // solely from getSession().
    await new Promise((r) => setTimeout(r, 20));

    const s = useAuthStore.getState();
    expect(s.loading).toBe(false);
    expect(s.session).toBe(null);
    expect(s.user).toBe(null);
    expect(s.profileLoaded).toBe(true);
    expect(supabase.auth.getSession).toHaveBeenCalled();

    unsubscribe();
  });

  it('purges an expired stored session and settles loading=false without hitting profiles', async () => {
    // Simulate reopening the app with a token whose `expires_at` is in the
    // past. The store must call signOut({scope:'local'}) to clear the bad
    // token and end in a clean signed-out state.
    const pastSeconds = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    (supabase.auth as unknown as AuthWithHelper).__setGetSessionResult({
      data: {
        session: {
          access_token: 'expired-token',
          refresh_token: 'expired-refresh',
          expires_at: pastSeconds,
          token_type: 'bearer',
          user: { id: 'u-expired' },
        },
      },
      error: null,
    });

    const unsubscribe = useAuthStore.getState().initialize();

    await new Promise((r) => setTimeout(r, 20));

    const s = useAuthStore.getState();
    expect(s.loading).toBe(false);
    expect(s.session).toBe(null);
    expect(s.user).toBe(null);
    expect(s.profile).toBe(null);
    expect(s.isAdmin).toBe(false);
    expect(s.profileLoaded).toBe(true);
    // Expired session must be purged locally so the next reload doesn't
    // trip the same bug.
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    unsubscribe();
  });

  it('hydrates user + profile at bootstrap when getSession returns a valid session', async () => {
    // A live (non-expired) session stored in localStorage should hydrate
    // the store without waiting for onAuthStateChange to fire.
    const futureSeconds = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    (supabase.auth as unknown as AuthWithHelper).__setGetSessionResult({
      data: {
        session: {
          access_token: 'live-token',
          refresh_token: 'live-refresh',
          expires_at: futureSeconds,
          token_type: 'bearer',
          user: { id: 'u1' },
        },
      },
      error: null,
    });

    const unsubscribe = useAuthStore.getState().initialize();

    // Allow microtasks for getSession() + profiles fetch to flush.
    await new Promise((r) => setTimeout(r, 20));

    const s = useAuthStore.getState();
    expect(s.loading).toBe(false);
    expect(s.session).not.toBe(null);
    expect(s.user?.id).toBe('u1');
    expect(s.profile?.role).toBe('admin');
    expect(s.isAdmin).toBe(true);
    expect(s.profileLoaded).toBe(true);
    // Must NOT have purged a live session.
    expect(supabase.auth.signOut).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('settles loading=false even when getSession rejects (never strands the spinner)', async () => {
    // Network failure / Supabase outage at bootstrap. The store must still
    // recover so the UI can redirect to /login instead of spinning forever.
    (supabase.auth.getSession as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void }).mockImplementationOnce(
      async () => {
        throw new Error('network error');
      },
    );

    const unsubscribe = useAuthStore.getState().initialize();

    await new Promise((r) => setTimeout(r, 20));

    const s = useAuthStore.getState();
    expect(s.loading).toBe(false);
    expect(s.session).toBe(null);
    expect(s.profileLoaded).toBe(true);

    unsubscribe();
  });
});
