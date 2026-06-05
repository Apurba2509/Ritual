import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp_total: number;
  streak_grace_remaining: number;
  onboarding_completed: boolean;
}

interface Settings {
  morningBrief: boolean;
  streakWarning: boolean;
  darkTheme: boolean;
}

interface UserState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  settings: Settings;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  session: null,
  user: null,
  profile: null,
  settings: {
    morningBrief: true,
    streakWarning: true,
    darkTheme: true,
  },
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user || null, isLoading: false }),
  setProfile: (profile) => set({ profile }),
  updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      set({ profile: data });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
