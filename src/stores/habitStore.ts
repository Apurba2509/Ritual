import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { Habit, HabitCompletion } from '../types/habit.types';

// @ts-ignore
export const storage = new MMKV({ id: 'habit-storage' });

const zustandStorage = {
  setItem: (name: string, value: string) => {
    return storage.set(name, value);
  },
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return storage.delete(name);
  },
};

interface HabitState {
  habits: Record<string, Habit>;
  completions: Record<string, Record<string, HabitCompletion>>; // habitId -> date -> completion
  syncQueue: any[]; // Items waiting to be pushed to Supabase
  setHabits: (habits: Habit[]) => void;
  upsertHabit: (habit: Habit) => void;
  deleteHabit: (id: string) => void;
  addCompletion: (completion: HabitCompletion) => void;
  removeCompletion: (habitId: string, date: string) => void;
  addToSyncQueue: (action: any) => void;
  clearSyncQueue: () => void;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      habits: {},
      completions: {},
      syncQueue: [],
      
      setHabits: (habitsList) => set((state) => {
        const newHabits = { ...state.habits };
        habitsList.forEach(h => { newHabits[h.id] = h; });
        return { habits: newHabits };
      }),
      
      upsertHabit: (habit) => set((state) => ({
        habits: { ...state.habits, [habit.id]: habit }
      })),
      
      deleteHabit: (id) => set((state) => {
        const newHabits = { ...state.habits };
        delete newHabits[id];
        return { habits: newHabits };
      }),
      
      addCompletion: (completion) => set((state) => {
        const { habit_id, completed_date } = completion;
        const habitCompletions = state.completions[habit_id] || {};
        return {
          completions: {
            ...state.completions,
            [habit_id]: { ...habitCompletions, [completed_date]: completion }
          }
        };
      }),
      
      removeCompletion: (habitId, date) => set((state) => {
        const habitCompletions = { ...state.completions[habitId] };
        delete habitCompletions[date];
        return {
          completions: {
            ...state.completions,
            [habitId]: habitCompletions
          }
        };
      }),
      
      addToSyncQueue: (action) => set((state) => ({
        syncQueue: [...state.syncQueue, action]
      })),
      
      clearSyncQueue: () => set({ syncQueue: [] }),
    }),
    {
      name: 'habit-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
