import { useMemo } from 'react';
import { useHabitStore } from '../stores/habitStore';
import { Habit, HabitCompletion } from '../types/habit.types';
import { format } from 'date-fns';

export interface TodayHabit extends Habit {
  completed: boolean;
  completionData?: HabitCompletion;
}

export const useToday = () => {
  const { habits, completions } = useHabitStore();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayHabits = useMemo(() => {
    const allHabits = Object.values(habits);
    
    // Filter habits due today
    // For simplicity right now, assume all active habits are due today
    const dueToday = allHabits.filter(h => h.is_active && !h.is_archived);
    
    // Attach completion status
    return dueToday.map(habit => {
      const habitCompletions = completions[habit.id] || {};
      const completionData = habitCompletions[todayStr];
      return {
        ...habit,
        completed: !!completionData,
        completionData,
      } as TodayHabit;
    }).sort((a, b) => a.sort_order - b.sort_order);
    
  }, [habits, completions, todayStr]);

  return {
    todayHabits,
    todayStr,
  };
};
