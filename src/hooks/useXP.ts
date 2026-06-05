import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { calculateXP, getLevelFromXP } from '../utils/xpUtils';
import { useUserStore } from '../stores/userStore';

export const useXP = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { profile, setProfile } = useUserStore();

  const awardXP = useMutation({
    mutationFn: async ({ amount, reason, habitId }: { amount: number, reason: string, habitId?: string }) => {
      if (!session?.user?.id) return;
      
      const { data, error } = await supabase
        .from('xp_events')
        .insert({
          user_id: session.user.id,
          amount,
          reason,
          habit_id: habitId
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update profile total XP
      const { data: updatedProfile } = await supabase.rpc('increment_xp', { 
        x: amount, 
        uid: session.user.id 
      });

      return updatedProfile;
    },
    onSuccess: (data, variables) => {
      // Optimistically update local store
      if (profile) {
        setProfile({ ...profile, xp_total: profile.xp_total + variables.amount });
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  return { awardXP };
};
