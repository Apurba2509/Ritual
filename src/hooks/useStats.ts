import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { parseISO, differenceInDays, startOfDay } from 'date-fns';

export const useStats = () => {
  const { session, profile } = useAuth();

  return useQuery({
    queryKey: ['stats', session?.user?.id],
    queryFn: async () => {
      const { data: completions, error } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      const totalCompletions = completions.length;
      
      let currentStreak = 0;
      let longestStreak = 0;
      let perfectDays = 0;
      
      if (completions.length > 0) {
        // Group completions by day to find unique active days
        const activeDays = new Set<string>();
        completions.forEach(c => {
          activeDays.add(startOfDay(parseISO(c.completed_at)).toISOString());
        });
        
        const sortedDays = Array.from(activeDays).map(d => parseISO(d)).sort((a, b) => b.getTime() - a.getTime());
        
        // Calculate Current Streak
        const today = startOfDay(new Date());
        let expectedDate = sortedDays[0].getTime() === today.getTime() ? today : undefined;
        
        // If the most recent completion is not today or yesterday, streak is 0
        if (sortedDays[0].getTime() !== today.getTime() && differenceInDays(today, sortedDays[0]) > 1) {
           currentStreak = 0;
        } else {
           let tempStreak = 0;
           let checkDate = sortedDays[0];
           for (let i = 0; i < sortedDays.length; i++) {
             if (differenceInDays(checkDate, sortedDays[i]) <= 1) {
               tempStreak++;
               checkDate = sortedDays[i];
             } else {
               break;
             }
           }
           currentStreak = tempStreak;
        }

        // Calculate Longest Streak
        let maxStreak = 1;
        let tempMax = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          if (differenceInDays(sortedDays[i-1], sortedDays[i]) === 1) {
            tempMax++;
            maxStreak = Math.max(maxStreak, tempMax);
          } else {
            tempMax = 1;
          }
        }
        longestStreak = Math.max(currentStreak, maxStreak);

        // Approximate Perfect days (days with 3+ completions as a fun metric)
        const dayCounts: Record<string, number> = {};
        completions.forEach(c => {
          const day = startOfDay(parseISO(c.completed_at)).toISOString();
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
        perfectDays = Object.values(dayCounts).filter(count => count >= 3).length;
      }

      return {
        totalCompletions,
        currentStreak,
        longestStreak,
        perfectDays,
        currentLevel: profile?.level || 1, // Will pull from profile if exists
        rawCompletions: completions,
      };
    },
    enabled: !!session?.user?.id,
  });
};
