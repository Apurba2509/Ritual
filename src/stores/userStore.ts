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
  isSavingSettings: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
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
  isSavingSettings: false,
  setSession: (session) => set({ session, user: session?.user || null, isLoading: false }),
  setProfile: (profile) => set({ profile }),
  updateSettings: async (newSettings) => {
    // Optimistic UI update
    set((state) => ({ 
      settings: { ...state.settings, ...newSettings },
      isSavingSettings: true 
    }));
    
    // Sync to backend
    const { session, settings } = useUserStore.getState();
    if (session?.user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ settings }) // Assuming a JSONB settings column
          .eq('id', session.user.id);
      } catch (e) {
        console.error('Failed to sync settings to Supabase:', e);
      } finally {
        set({ isSavingSettings: false });
      }
    } else {
      set({ isSavingSettings: false });
    }
  },
  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) throw error;
      set({ profile: data || null });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  },
  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    } finally {
      set({ session: null, user: null, profile: null });
    }
  },
}));
