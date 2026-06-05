import { useMemo } from 'react';
import { useHabitStore } from '../stores/habitStore';
import { calculateStreak } from '../utils/streakUtils';

export const useStreak = (habitId: string) => {
  const { completions } = useHabitStore();

  const streak = useMemo(() => {
    const habitCompletions = completions[habitId] || {};
    // Extract dates of completion
    const dates = Object.keys(habitCompletions);
    
    return calculateStreak(dates);
  }, [completions, habitId]);

  return streak;
};
