import React from 'react';
import { View } from 'react-native';
import { HabitWizard } from '../../components/habits/HabitWizard';
import { Stack } from 'expo-router';

export default function NewHabitScreen() {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'New Habit', presentation: 'modal' }} />
      <HabitWizard />
    </View>
  );
}
