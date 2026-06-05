import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useStats = () => {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['stats', session?.user?.id],
    queryFn: async () => {
      const { data: completions, error } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', session?.user?.id);

      if (error) throw error;

      // Process raw completions into aggregated stats (weekly, monthly, heatmap data)
      const totalCompletions = completions.length;
      
      return {
        totalCompletions,
        rawCompletions: completions,
      };
    },
    enabled: !!session?.user?.id,
  });
};
