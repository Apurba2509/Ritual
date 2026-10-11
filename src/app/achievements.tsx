import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ACHIEVEMENTS, TIER_COLORS } from '@/domain/achievements';
import { useSnapshot } from '@/data/hooks';
import { useApp } from '@/data/store';
import { Card } from '@/ui/Card';
import { Meter } from '@/ui/charts';
import { Pill } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { alpha, radius } from '@/ui/theme';

export default function AchievementsScreen() {
  const snapshot = useSnapshot();
  const unlocked = useApp((s) => s.unlocked);
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const ua = unlocked[a.id] ? 1 : 0;
    const ub = unlocked[b.id] ? 1 : 0;
    if (ua !== ub) return ub - ua;
    const [ca, ga] = a.progress(snapshot.achievementStats);
    const [cb, gb] = b.progress(snapshot.achievementStats);
    return cb / gb - ca / ga;
  });

  return (
    <Screen back title="Achievements" subtitle={`${Object.keys(unlocked).length} of ${ACHIEVEMENTS.length} unlocked`}>
      <View style={{ gap: 10 }}>
        {sorted.map((a, i) => {
          const got = !!unlocked[a.id];
          const [cur, goal] = a.progress(snapshot.achievementStats);
          const color = TIER_COLORS[a.tier];
          return (
            <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)}>
              <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center', opacity: got ? 1 : 0.75 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: got ? alpha(color, 0.18) : 'rgba(127,127,127,0.1)',
                    borderWidth: 1.5,
                    borderColor: got ? color : 'rgba(127,127,127,0.2)',
                  }}
                >
                  <Text size={28} style={{ opacity: got ? 1 : 0.35 }}>
                    {got ? a.emoji : '🔒'}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="subheading" style={{ flexShrink: 1 }}>
                      {a.title}
                    </Text>
                    <Pill label={a.tier} color={color} />
                  </View>
                  <Text variant="caption" tone="muted">
                    {a.description}
                    {a.xp ? ` · +${a.xp} XP` : ''}
                  </Text>
                  {got ? (
                    <Text variant="caption" tone="faint" size={11}>
                      Unlocked{' '}
                      {new Date(unlocked[a.id]).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  ) : goal > 1 ? (
                    <View style={{ gap: 4 }}>
                      <Meter ratio={cur / goal} color={color} height={5} />
                      <Text variant="caption" tone="faint" size={11}>
                        {cur} / {goal}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            </Animated.View>
          );
        })}
      </View>
    </Screen>
  );
}
