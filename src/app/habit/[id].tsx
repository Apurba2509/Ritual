import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View className="flex-1 bg-background justify-center items-center">
      <Stack.Screen options={{ title: 'Habit Details' }} />
      <Text className="text-textPrimary font-heading text-2xl mb-2">Habit {id}</Text>
      <Text className="text-textSecondary font-body">Detail view coming in Phase 8.</Text>
    </View>
  );
}
