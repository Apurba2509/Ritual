import { router } from 'expo-router';
import { View } from 'react-native';
import { useHabitList, useSnapshot } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function ArchiveScreen() {
  const habits = useHabitList({ archived: true });
  const snapshot = useSnapshot();
  return (
    <Screen back title="Archived habits" subtitle="Paused habits keep their history and XP.">
      {habits.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="Nothing archived"
          body="Archive a habit from its edit screen to pause it without losing history."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {habits.map((h) => {
            const s = snapshot.habitStats.get(h.id);
            return (
              <Card
                key={h.id}
                onPress={() => router.push(`/habit/${h.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <HabitIcon emoji={h.emoji} color={h.color} size={42} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{h.name}</Text>
                  <Text variant="caption" tone="muted">
                    {s?.totalDone ?? 0} check-ins · best streak {s?.streak.longest ?? 0}
                  </Text>
                </View>
                <Button
                  title="Restore"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    useApp.getState().archiveHabit(h.id, false);
                    toast(`${h.name} is back on your list`, { emoji: '♻️' });
                  }}
                />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
