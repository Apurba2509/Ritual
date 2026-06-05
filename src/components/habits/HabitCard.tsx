import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../ui/Card';
import { TodayHabit } from '../../hooks/useToday';
import { CompletionButton } from './CompletionButton';
import { useHabitStore } from '../../stores/habitStore';
import { useStreak } from '../../hooks/useStreak';
import * as Crypto from 'expo-crypto';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

import { useUIStore } from '../../stores/uiStore';
import { calculateXP, MILESTONE_BONUSES } from '../../utils/xpUtils';
import { useUserStore } from '../../stores/userStore';

interface HabitCardProps {
  habit: TodayHabit;
  todayStr: string;
}

export const HabitCard = React.memo(({ habit, todayStr }: HabitCardProps) => {
  const { addCompletion, removeCompletion, addToSyncQueue } = useHabitStore();
  const streak = useStreak(habit.id);
  const router = useRouter();
  const { triggerCelebration } = useUIStore();
  const { profile, setProfile } = useUserStore();

  const handleToggle = useCallback(() => {
    if (habit.completed) {
      removeCompletion(habit.id, todayStr);
      addToSyncQueue({ type: 'DELETE_COMPLETION', payload: { habit_id: habit.id, date: todayStr } });
      // In a real app we might revert XP here, but for now we skip
    } else {
      const completion = {
        id: Crypto.randomUUID(),
        habit_id: habit.id,
        user_id: habit.user_id,
        completed_date: todayStr,
        value: 1,
        note: null,
        mood: null,
        energy_level: null,
        photo_url: null,
        voice_url: null,
        created_at: new Date().toISOString(),
      };
      addCompletion(completion as any);
      addToSyncQueue({ type: 'INSERT_COMPLETION', payload: completion });
      
      // Calculate XP
      const newStreak = streak.current + 1;
      const xpGained = calculateXP(10, habit.difficulty, newStreak);
      const bonus = MILESTONE_BONUSES[newStreak] || 0;
      const totalXpGained = xpGained + bonus;

      if (profile) {
        setProfile({ ...profile, xp_total: profile.xp_total + totalXpGained });
        // Assume we queue an XP upsert here as well
      }

      if (bonus > 0) {
        triggerCelebration({
          streakCount: newStreak,
          message: `Unstoppable! +${bonus} XP Milestone Bonus!`
        });
      }
    }
  }, [habit.completed, habit.id, habit.user_id, todayStr, streak.current, profile]);

  const handlePress = () => {
    // Navigate to habit detail
    router.push(`/habit/${habit.id}`);
  };

  return (
    <Card className="mb-3 px-4 py-3 flex-row items-center justify-between" elevated>
      <Pressable onPress={handlePress} className="flex-row items-center flex-1">
        <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: `${habit.color}20` }}>
          <Text className="text-2xl">{habit.emoji}</Text>
        </View>
        <View className="flex-1">
          <Text 
            className={`font-heading text-lg ${habit.completed ? 'text-textSecondary line-through' : 'text-textPrimary'}`}
          >
            {habit.name}
          </Text>
          <Text className="font-stat text-textSecondary text-xs mt-1">
            {streak.current} Day Streak 🔥
          </Text>
        </View>
      </Pressable>
      
      <View className="pl-4">
        <CompletionButton
          completed={habit.completed}
          color={habit.color}
          onToggle={handleToggle}
        />
      </View>
    </Card>
  );
});
