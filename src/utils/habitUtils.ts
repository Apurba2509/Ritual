import { Database } from '../types/database.types';
import { isToday } from 'date-fns';

type Habit = Database['public']['Tables']['habits']['Row'];
type Completion = Database['public']['Tables']['habit_completions']['Row'];

export const isDueToday = (habit: Habit): boolean => {
  if (!habit.is_active || habit.is_archived) return false;
  
  if (habit.frequency_type === 'daily') return true;
  
  if (habit.frequency_type === 'weekdays') {
    const day = new Date().getDay();
    return day >= 1 && day <= 5; // Monday to Friday
  }
  
  if (habit.frequency_type === 'custom' && habit.frequency_days) {
    const day = new Date().getDay();
    return habit.frequency_days.includes(day);
  }

  return true; // Fallback for x_per_week where due date is loose
};

export const getCompletionStatus = (habitId: string, completions: Completion[], date: Date = new Date()): boolean => {
  return completions.some(c => 
    c.habit_id === habitId && 
    isToday(new Date(c.completed_date))
  );
};
