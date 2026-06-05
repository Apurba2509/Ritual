import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { NewHabit, TrackingType, FrequencyType, Difficulty } from '../../types/habit.types';
import { useHabits } from '../../hooks/useHabits';
import { useRouter } from 'expo-router';

export const HabitWizard = () => {
  const router = useRouter();
  const { createHabit } = useHabits();
  const [loading, setLoading] = useState(false);
  
  // Basic state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔥');
  const [color, setColor] = useState('#7C3AED');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [trackingType, setTrackingType] = useState<TrackingType>('boolean');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const habit: NewHabit = {
        name: name.trim(),
        emoji,
        color,
        difficulty,
        category: null,
        tracking_type: trackingType,
        target_value: trackingType === 'counter' ? 10 : null,
        target_unit: trackingType === 'counter' ? 'times' : null,
        frequency_type: frequencyType,
        frequency_days: [0, 1, 2, 3, 4, 5, 6],
        frequency_x: 1,
        group_id: null,
        sort_order: 0,
        reminder_enabled: false,
        reminder_time: null,
      };

      await createHabit(habit);
      router.back();
    } catch (error) {
      console.error('Failed to create habit:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text className="font-heading text-textPrimary text-2xl mb-6">Create New Habit</Text>
      
      <Input
        label="Habit Name"
        placeholder="e.g. Drink Water"
        value={name}
        onChangeText={setName}
      />

      <View className="mb-6">
        <Text className="font-stat text-textSecondary mb-2">Difficulty</Text>
        <View className="flex-row">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(level => (
            <Chip
              key={level}
              label={level.charAt(0).toUpperCase() + level.slice(1)}
              selected={difficulty === level}
              onPress={() => setDifficulty(level)}
            />
          ))}
        </View>
      </View>

      <View className="mb-6">
        <Text className="font-stat text-textSecondary mb-2">Tracking Type</Text>
        <View className="flex-row flex-wrap">
          {(['boolean', 'counter', 'timer', 'checklist'] as TrackingType[]).map(type => (
            <Chip
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              selected={trackingType === type}
              onPress={() => setTrackingType(type)}
            />
          ))}
        </View>
      </View>

      <View className="mb-8">
        <Text className="font-stat text-textSecondary mb-2">Frequency</Text>
        <View className="flex-row flex-wrap">
          {(['daily', 'weekdays', 'custom', 'x_per_week'] as FrequencyType[]).map(type => (
            <Chip
              key={type}
              label={type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}
              selected={frequencyType === type}
              onPress={() => setFrequencyType(type)}
            />
          ))}
        </View>
      </View>

      <Button
        title="Create Habit"
        onPress={handleSave}
        disabled={!name.trim() || loading}
        loading={loading}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E14',
  },
  content: {
    padding: 24,
  }
});
