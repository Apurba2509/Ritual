import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { HabitCard } from './HabitCard';
import { TodayHabit } from '../../hooks/useToday';

interface HabitListProps {
  habits: TodayHabit[];
  onHabitPress: (habit: TodayHabit) => void;
  onHabitComplete: (habitId: string) => void;
  todayStr: string;
}

export const HabitList: React.FC<HabitListProps> = ({ habits, onHabitPress, onHabitComplete, todayStr }) => {
  return (
    <FlashList
      data={habits}
      keyExtractor={(item) => item.id}
      // @ts-ignore
      estimatedItemSize={88}
      renderItem={({ item }) => (
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={() => onHabitPress(item)}
          className="mb-3"
        >
          <HabitCard habit={item} todayStr={todayStr} />
        </TouchableOpacity>
      )}
      ListEmptyComponent={() => (
        <View className="flex-1 justify-center items-center pt-20">
          <Text className="text-textSecondary text-base text-center">
            No habits found. Time to start something new!
          </Text>
        </View>
      )}
    />
  );
};
