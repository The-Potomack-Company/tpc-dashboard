import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module BEFORE importing authStore. The mock exposes a
// `__fireAuthEvent` helper so tests can simulate onAuthStateChange callbacks.
vi.mock('../lib/supabase', () => {
  const onAuthStateChangeCallbacks: Array<(evt: string, session: unknown) => void> = [];
  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        onAuthStateChange: vi.fn((cb: (evt: string, session: unknown) => void) => {
          onAuthStateChangeCallbacks.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        __fireAuthEvent: (evt: string, session: unknown) => {
          onAuthStateChangeCallbacks.forEach((cb) => cb(evt, session));
        },
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({
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
      loading: true,
      profileLoading: false,
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
      single: vi.fn(async () => ({
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
});
