import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHabitStore } from '../../../stores/habitStore';
import { Button } from '../../../components/ui/Button';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const habits = useHabitStore((state: any) => state.habits);
  const upsertHabit = useHabitStore((state: any) => state.upsertHabit);
  
  const habit = habits[id as string];
  const [name, setName] = useState(habit?.name || '');
  const [description, setDescription] = useState(habit?.description || '');

  if (!habit) return null;

  const handleSave = () => {
    upsertHabit({ ...habit, name, description });
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4">
      <Text className="font-hero text-textPrimary text-4xl mb-8">Edit Habit</Text>
      
      <View className="mb-6">
        <Text className="font-heading text-textPrimary text-lg mb-2">Habit Name</Text>
        <TextInput
          className="bg-surface2 text-textPrimary font-body p-4 rounded-xl"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Read 10 pages"
          placeholderTextColor="#666"
        />
      </View>

      <View className="mb-8">
        <Text className="font-heading text-textPrimary text-lg mb-2">Description</Text>
        <TextInput
          className="bg-surface2 text-textPrimary font-body p-4 rounded-xl"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional notes"
          placeholderTextColor="#666"
          multiline
        />
      </View>

      <Button title="Save Changes" variant="filled" onPress={handleSave} />
    </ScrollView>
  );
}
