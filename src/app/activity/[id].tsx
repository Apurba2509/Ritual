import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { runAutoTracking } from '@/features/integrations/engine';
import { WORKOUT_META, WorkoutSummary } from '@/features/sensing/WorkoutSummary';
import { IconButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useApp((s) => (id ? s.workouts[id] : undefined));

  if (!workout || workout.deleted) {
    return (
      <Screen back>
        <EmptyState icon="magnifying-glass" title="Workout not found" />
      </Screen>
    );
  }

  const remove = () => {
    const run = () => {
      useApp.getState().deleteWorkout(workout.id);
      runAutoTracking({ reason: 'manual', force: true }).catch(() => 0);
      toast('Workout deleted', { icon: 'trash' });
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this workout?')) run();
      return;
    }
    Alert.alert('Delete workout?', 'It will be removed from your history everywhere.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen
      back
      title={WORKOUT_META[workout.type].label}
      subtitle={new Date(workout.startedAt).toLocaleString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })}
      right={<IconButton name="trash" accessibilityLabel="Delete workout" onPress={remove} />}
    >
      <WorkoutSummary workout={workout} />
    </Screen>
  );
}
