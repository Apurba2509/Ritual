import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';

export const useAuth = () => {
  const { session, user, profile, isLoading, setSession, fetchProfile, signOut } = useUserStore();

  useEffect(() => {
    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    profile,
    isLoading,
    signOut,
  };
};
