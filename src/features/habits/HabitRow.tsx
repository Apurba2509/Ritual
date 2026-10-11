import { router } from 'expo-router';
import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { DayKey } from '@/domain/dates';
import { isEntryDone, progressOf, scheduleLabel } from '@/domain/habits';
import type { Entry, Habit } from '@/domain/types';
import { Icon } from '@/ui/Icon';
import { ProgressRing } from '@/ui/ProgressRing';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, radius, useTheme } from '@/ui/theme';
import { addProgress, toggleHabit } from './actions';
import { autoLabel, formatProgress, stepFor } from './format';
import { HabitIcon } from './HabitIcon';

interface Props {
  habit: Habit;
  entry: Entry | undefined;
  day: DayKey;
  streak: number;
  streakUnit: 'day' | 'week';
  weekProgress?: { done: number; target: number };
  index: number;
  onLongPress: (habit: Habit) => void;
}

function CheckControl({ done, color, onPress }: { done: boolean; color: string; onPress: () => void }) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(done ? 1 : 0, { duration: 220 });
  }, [done, fill]);
  const clear = alpha(color, 0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(fill.value, [0, 1], [clear, color]),
  }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.6 + fill.value * 0.4 }] }));
  return (
    <Tap
      onPress={() => {
        scale.value = withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, { damping: 8, stiffness: 300 }));
        onPress();
      }}
      haptics={false}
      scaleTo={1}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? 'Mark as not done' : 'Mark as done'}
    >
      <Animated.View
        style={[
          {
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2.5,
            borderColor: done ? color : alpha(t.text, 0.18),
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Animated.View style={iconStyle}>
          <Icon name="check" size={22} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Tap>
  );
}

function RingControl({
  progress,
  color,
  icon,
  done,
  onPress,
  onLongPress,
  label,
}: {
  progress: number;
  color: string;
  icon: 'plus' | 'play';
  done: boolean;
  onPress: () => void;
  onLongPress: () => void;
  label: string;
}) {
  return (
    <Tap
      onPress={onPress}
      onLongPress={onLongPress}
      haptics={false}
      scaleTo={0.88}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <ProgressRing progress={progress} size={46} stroke={4.5} color={color} duration={450}>
        <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          {/* Filled disc drawn in SVG so it is perfectly round on every platform. */}
          {done ? (
            <Svg width={32} height={32} style={{ position: 'absolute' }}>
              <Circle cx={16} cy={16} r={16} fill={color} />
            </Svg>
          ) : null}
          <Icon name={done ? 'check' : icon} size={done ? 18 : 16} color={done ? '#FFFFFF' : color} />
        </View>
      </ProgressRing>
    </Tap>
  );
}

export const HabitRow = memo(function HabitRow({
  habit,
  entry,
  day,
  streak,
  streakUnit,
  weekProgress,
  index,
  onLongPress,
}: Props) {
  const t = useTheme();
  const done = isEntryDone(habit, entry);
  const skipped = !!entry?.skipped && !entry.deleted;
  const value = entry && !entry.deleted ? entry.value : 0;
  const auto = autoLabel(habit.auto);

  const meta: string[] = [];
  if (habit.kind !== 'check') meta.push(formatProgress(habit, value));
  if (weekProgress) meta.push(`${weekProgress.done}/${weekProgress.target} this week`);
  else meta.push(scheduleLabel(habit.schedule));

  const control =
    habit.kind === 'check' ? (
      <CheckControl done={done} color={habit.color} onPress={() => toggleHabit(habit.id, day)} />
    ) : habit.kind === 'count' ? (
      <RingControl
        progress={progressOf(habit, entry)}
        color={habit.color}
        icon="plus"
        done={done}
        label={`Add ${stepFor(habit)} ${habit.unit ?? ''}`}
        onPress={() => addProgress(habit.id, day, stepFor(habit))}
        onLongPress={() => onLongPress(habit)}
      />
    ) : (
      <RingControl
        progress={progressOf(habit, entry)}
        color={habit.color}
        icon="play"
        done={done}
        label="Start focus timer"
        onPress={() => (done ? onLongPress(habit) : router.push(`/focus/${habit.id}`))}
        onLongPress={() => onLongPress(habit)}
      />
    );

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45)
        .springify()
        .damping(18)}
      layout={LinearTransition.springify().damping(20)}
    >
      <Tap
        onPress={() => router.push(`/habit/${habit.id}`)}
        onLongPress={() => onLongPress(habit)}
        delayLongPress={350}
        scaleTo={0.985}
        haptics={false}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 12,
          paddingRight: 14,
          borderRadius: radius.lg,
          backgroundColor: done ? alpha(habit.color, t.scheme === 'dark' ? 0.08 : 0.06) : t.surface,
          borderWidth: 1,
          borderColor: done ? alpha(habit.color, 0.28) : t.border,
        }}
      >
        <HabitIcon emoji={habit.emoji} color={habit.color} filled={done} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="subheading" numberOfLines={1} tone={skipped ? 'faint' : 'default'}>
            {habit.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {streak > 0 ? (
              <Text variant="caption" color={t.accent} style={{ fontFamily: 'Inter_600SemiBold' }}>
                🔥 {streak}
                {streakUnit === 'week' ? 'w' : ''}
              </Text>
            ) : null}
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {skipped ? 'Rest day · streak protected' : meta.join(' · ')}
            </Text>
            {auto ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 6,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: t.xpSoft,
                }}
              >
                <Icon name="zap" size={10} color={t.xp} />
                <Text variant="caption" size={10} color={t.xp} style={{ fontFamily: 'Inter_600SemiBold' }}>
                  {auto}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {skipped ? (
          <View style={{ width: 44, alignItems: 'center' }}>
            <Icon name="moon" size={20} color={t.textFaint} />
          </View>
        ) : (
          control
        )}
      </Tap>
    </Animated.View>
  );
});
