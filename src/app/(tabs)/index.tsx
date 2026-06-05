import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useToday, TodayHabit } from '../../hooks/useToday';
import { HabitCard } from '../../components/habits/HabitCard';
import { useRouter } from 'expo-router';

export default function TodayScreen() {
  const { todayHabits, todayStr } = useToday();
  const router = useRouter();

  const renderItem = useCallback(({ item }: { item: TodayHabit }) => {
    return <HabitCard habit={item} todayStr={todayStr} />;
  }, [todayStr]);

  const ListEmptyComponent = () => (
    <View className="flex-1 justify-center items-center mt-20">
      <Text className="text-textSecondary font-body text-center px-8">
        Your day is a blank canvas. Tap the + button to build your Ritual.
      </Text>
    </View>
  );

  return (
    <View style={styles.container} className="flex-1 pt-16 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="font-hero text-textPrimary text-4xl tracking-tight">Today</Text>
          <Text className="font-stat text-textSecondary text-sm uppercase tracking-widest mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <Pressable 
          onPress={() => router.push('/habit/new')}
          className="w-12 h-12 rounded-full bg-surface2 items-center justify-center border border-white/10"
        >
          <Text className="text-white text-2xl font-light">+</Text>
        </Pressable>
      </View>

      <View className="flex-1">
        {/* @ts-ignore */}
        {React.createElement(FlashList as any, {
          data: todayHabits,
          renderItem,
          estimatedItemSize: 84,
          keyExtractor: (item: TodayHabit) => item.id,
          ListEmptyComponent,
          contentContainerStyle: { paddingBottom: 100 },
          showsVerticalScrollIndicator: false,
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0E14',
  },
});
