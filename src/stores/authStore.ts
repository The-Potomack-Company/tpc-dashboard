import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  // True after the first profile fetch attempt resolves (success or failure).
  // Distinguishes "still loading" from "loaded but no row / error" so
  // ProtectedRoute can avoid an infinite spinner when profile is null.
  profileLoaded: boolean;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  profileLoading: false,
  profileLoaded: false,

  initialize: () => {
    // Shared handler so both the bootstrap getSession() path and subsequent
    // onAuthStateChange events converge on one code path. Always settles
    // session/user/loading regardless of whether the profile fetch errors.
    const applySession = async (session: Session | null) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });

      if (session?.user) {
        // Capture the user id at dispatch time. Supabase does not await
        // onAuthStateChange callbacks, so if two events fire in rapid
        // succession (INITIAL_SESSION + token refresh, or sign-out right
        // after sign-in) two fetches can be in flight. Without this guard
        // an older response can stomp newer state.
        const fetchingFor = session.user.id;
        set({ profileLoading: true, profileLoaded: false });
        try {
          // maybeSingle() returns { data: null } instead of an error when no
          // row exists, so a user without a profiles row doesn't get stuck.
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', fetchingFor)
            .maybeSingle();
          // Discard response if the current session has moved on (user
          // changed or signed out during the fetch).
          if (get().user?.id !== fetchingFor) return;
          if (error) {
            // Surface fetch failures (RLS reject, network, Supabase outage).
            // Without this, any failure silently locks the user out with no
            // signal to the user or future observability pipeline.
            // eslint-disable-next-line no-console
            console.error('[authStore] profile fetch failed', error);
          }
          set({
            profile: data ?? null,
            isAdmin: data?.role === 'admin',
            profileLoading: false,
            profileLoaded: true,
          });
        } catch (err) {
          // Any thrown error (network, Supabase deadlock — see
          // supabase/auth-js#762 for the documented await-in-listener
          // hazard) must still settle profileLoading/profileLoaded so
          // ProtectedRoute can render AccessDenied instead of spinning.
          if (get().user?.id !== fetchingFor) return;
          // eslint-disable-next-line no-console
          console.error('[authStore] profile fetch threw', err);
          set({
            profile: null,
            isAdmin: false,
            profileLoading: false,
            profileLoaded: true,
          });
        }
      } else {
        set({
          profile: null,
          isAdmin: false,
          profileLoading: false,
          profileLoaded: true,
        });
      }
    };

    // Track whether any onAuthStateChange event has already populated the
    // store. When Supabase does fire INITIAL_SESSION (the happy path), the
    // event wins and the bootstrap getSession() path becomes a no-op so it
    // can't stomp fresher state. When Supabase does NOT fire the event (the
    // stale-token bug), the bootstrap path is the sole authority and
    // guarantees `loading` flips to false.
    let authEventHandled = false;

    // 1. Subscribe to lifecycle events BEFORE the bootstrap call so we
    //    don't miss a SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT that lands
    //    during getSession().
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventHandled = true;
      // Intentionally not awaited — onAuthStateChange must return quickly
      // to avoid the documented deadlock (supabase/auth-js#762). The
      // internal `set()` + profile fetch inside applySession() happen on
      // their own microtask chain.
      void applySession(session);
    });

    // 2. Bootstrap: explicitly read the stored session so we don't depend
    //    solely on INITIAL_SESSION firing. Handles the
    //    stale-auth-token-infinite-spinner bug where INITIAL_SESSION is
    //    delayed/skipped with expired tokens in localStorage
    //    (supabase/supabase#41968). Wrapped so `loading` is ALWAYS flipped
    //    to false even on network failure — the UI must never strand on
    //    the spinner.
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        // If an auth event already landed, it's the fresher signal —
        // don't overwrite state with the (possibly stale) bootstrap read.
        if (authEventHandled) return;
        if (error) {
          console.error('[authStore] getSession failed', error);
          if (!authEventHandled) await applySession(null);
          return;
        }
        const session = data.session;
        // Purge expired sessions from localStorage so the next reload
        // starts clean. `scope: 'local'` clears the client-side token
        // without hitting the network (no revoke call), which is safe
        // because the token is already expired.
        if (session?.expires_at && session.expires_at * 1000 <= Date.now()) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (e) {
            console.error('[authStore] signOut for expired session failed', e);
          }
          if (!authEventHandled) await applySession(null);
          return;
        }
        if (!authEventHandled) await applySession(session);
      } catch (err) {
        // Network failure / Supabase outage at bootstrap. Never strand
        // the spinner — fall through to a clean signed-out state so the
        // user is redirected to /login.
        console.error('[authStore] bootstrap threw', err);
        if (!authEventHandled) await applySession(null);
      }
    })();

    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'local' });
  },
}));
