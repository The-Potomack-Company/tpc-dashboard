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
        set({ profileLoading: true });
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({
          profile: data ?? null,
          isAdmin: data?.role === 'admin',
          profileLoading: false,
        });
      } else {
        set({ profile: null, isAdmin: false, profileLoading: false });
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
