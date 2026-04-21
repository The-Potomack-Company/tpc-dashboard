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

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  profileLoading: false,
  profileLoaded: false,

  initialize: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });

      if (session?.user) {
        set({ profileLoading: true, profileLoaded: false });
        // maybeSingle() returns { data: null } instead of an error when no
        // row exists, so a user without a profiles row doesn't get stuck.
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
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
      } else {
        set({
          profile: null,
          isAdmin: false,
          profileLoading: false,
          profileLoaded: true,
        });
      }
    });

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
