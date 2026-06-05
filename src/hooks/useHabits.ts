import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useHabitStore } from '../stores/habitStore';
import { useUserStore } from '../stores/userStore';
import { Habit, NewHabit } from '../types/habit.types';
import * as Crypto from 'expo-crypto';

export const useHabits = () => {
  const { user } = useUserStore();
  const { setHabits, upsertHabit, addToSyncQueue, deleteHabit: deleteLocalHabit } = useHabitStore();

  // Fetch habits from Supabase and sync local store
  const { isLoading, error, refetch } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false);
      
      if (error) throw error;
      
      // Update local store with server truth
      setHabits(data as Habit[]);
      return data as Habit[];
    },
    enabled: !!user,
  });

  // Create habit mutation
  const createHabit = useMutation({
    mutationFn: async (newHabit: NewHabit) => {
      const currentUser = useUserStore.getState().user || (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('Not authenticated');
      
      const habit: Habit = {
        ...newHabit,
        id: Crypto.randomUUID(),
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        is_archived: false,
      };

      // 1. Optimistic update to MMKV
      upsertHabit(habit);

      // 2. Queue for sync
      addToSyncQueue({ type: 'INSERT_HABIT', payload: habit });

      // 3. Attempt Supabase push immediately
      const { data, error } = await supabase
        .from('habits')
        .insert(habit)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Update habit mutation
  const updateHabit = useMutation({
    mutationFn: async (habit: Habit) => {
      const updated = { ...habit, updated_at: new Date().toISOString() };
      
      upsertHabit(updated);
      addToSyncQueue({ type: 'UPDATE_HABIT', payload: updated });

      const { data, error } = await supabase
        .from('habits')
        .update(updated)
        .eq('id', updated.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Delete habit mutation
  const deleteHabit = useMutation({
    mutationFn: async (id: string) => {
      deleteLocalHabit(id);
      addToSyncQueue({ type: 'DELETE_HABIT', payload: id });

      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
  });

  return {
    isLoading,
    error,
    refetch,
    createHabit: createHabit.mutateAsync,
    updateHabit: updateHabit.mutateAsync,
    deleteHabit: deleteHabit.mutateAsync,
  };
};
