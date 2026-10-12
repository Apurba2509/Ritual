import { router } from 'expo-router';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { tinyVersion } from '@/domain/behavior';
import type { DayKey } from '@/domain/dates';
import { progressOf, scheduleLabel } from '@/domain/habits';
import { formatMinutes, MIN, screenMinutes } from '@/domain/screen';
import { useApp } from '@/data/store';
import { useScreen } from '@/features/screen';
import type { Entry, Habit } from '@/domain/types';
import { haptic } from '@/lib/haptics';
import { Icon, isIconName } from '@/ui/Icon';
import { ProgressRing } from '@/ui/ProgressRing';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { tint, useTheme } from '@/ui/theme';
import { addProgress, completeHabit, logTinyHabit, setProgress, toggleHabit } from './actions';
import { autoIcon, formatAmount, formatProgress, stepFor } from './format';

interface Props {
  habit: Habit;
  entry: Entry | undefined;
  day: DayKey;
  streak: number;
  streakUnit: 'day' | 'week';
  weekProgress?: { done: number; target: number };
  index: number;
  onLongPress: (habit: Habit) => void;
  last?: boolean;
  /** Easy mode: the two-minute version counts in full. */
  easy?: boolean;
}

const SIZE = 36;
const PRESS = { duration: 90, easing: Easing.out(Easing.quad) };
const SWIPE_DONE = 84;

/** Swipe right to complete (or to undo a done habit). Vertical scrolling still wins. */
function useSwipe(onCommit: () => void) {
  const x = useSharedValue(0);
  const armed = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(140, e.translationX));
      const next = x.value > SWIPE_DONE ? 1 : 0;
      if (next !== armed.value) {
        armed.value = next;
        if (next) scheduleOnRN(haptic.light);
      }
    })
    .onEnd(() => {
      if (x.value > SWIPE_DONE) scheduleOnRN(onCommit);
      x.value = withSpring(0, { damping: 26, stiffness: 260 });
      armed.value = 0;
    });
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const reveal = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, 24], [0, 1], 'clamp') }));
  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(x.value, [20, SWIPE_DONE], [0.5, 1.1], 'clamp') }],
  }));
  return { pan, row, reveal, mark };
}

function Glyph({ habit, size = 42 }: { habit: Habit; size?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        name={isIconName(habit.icon) ? habit.icon : 'sparkle'}
        size={Math.round(size * 0.5)}
        color={tint(habit.color, t)}
        weight="fill"
      />
    </View>
  );
}

/** Right-hand control: an empty check, or a progress ring with + / ▶ for amounts. */
function Control({
  habit,
  entry,
  day,
  onLongPress,
  easy,
}: {
  habit: Habit;
  entry: Entry | undefined;
  day: DayKey;
  onLongPress: () => void;
  easy?: boolean;
}) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isCheck = habit.kind === 'check';
  const press = () => {
    scale.set(
      withSequence(withTiming(0.88, PRESS), withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) })),
    );
    if (easy) logTinyHabit(habit.id, day);
    else if (isCheck) toggleHabit(habit.id, day);
    else if (habit.kind === 'count') addProgress(habit.id, day, stepFor(habit));
    else router.push(`/focus/${habit.id}`);
  };
  return (
    <Tap
      onPress={press}
      onLongPress={isCheck ? undefined : onLongPress}
      haptics={false}
      scaleTo={1}
      hitSlop={12}
      accessibilityRole={isCheck ? 'checkbox' : 'button'}
      accessibilityState={isCheck ? { checked: false } : undefined}
      accessibilityLabel={
        easy
          ? `Do the two-minute version of ${habit.name}`
          : isCheck
            ? `Mark ${habit.name} as done`
            : habit.kind === 'count'
              ? `Add ${formatAmount(habit, stepFor(habit))} to ${habit.name}`
              : `Start a focus timer for ${habit.name}`
      }
    >
      <Animated.View style={[{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }, pop]}>
        {isCheck || easy ? (
          <View
            style={{
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              borderWidth: 2,
              borderColor: t.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {easy ? <Icon name="plant" size={14} color={t.textMuted} weight="fill" /> : null}
          </View>
        ) : (
          <>
            <View style={{ position: 'absolute' }}>
              <ProgressRing progress={progressOf(habit, entry)} size={SIZE} stroke={3} duration={450} />
            </View>
            <Icon name={habit.kind === 'count' ? 'plus' : 'play'} size={14} color={t.text} weight="bold" />
          </>
        )}
      </Animated.View>
    </Tap>
  );
}

/** Screen-limit habits measure themselves: show how much of today's allowance is used. */
function ScreenMeter({ habit }: { habit: Habit }) {
  const t = useTheme();
  const today = useScreen((s) => s.days.find((d) => !d.final));
  const guarded = useApp((s) => s.guard.apps);
  if (habit.auto?.provider !== 'screen') return null;
  const used = today ? screenMinutes(today, habit.auto.scope, new Set(guarded)) : 0;
  const share = Math.min(1, used / Math.max(1, habit.auto.limitMin));
  return (
    <Tap
      onPress={() => router.push('/screen-time')}
      hitSlop={12}
      accessibilityLabel={`${used} of ${habit.auto.limitMin} minutes used`}
      style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute' }}>
        <ProgressRing
          progress={share}
          size={SIZE}
          stroke={3}
          duration={450}
          color={share >= 1 ? t.danger : undefined}
        />
      </View>
      <Icon name="hourglass-high" size={14} color={t.text} weight="bold" />
    </Tap>
  );
}

export function screenMeta(habit: Habit, todayUsedMs: number | null): string | null {
  if (habit.auto?.provider !== 'screen') return null;
  const limit = formatMinutes(habit.auto.limitMin * MIN);
  return todayUsedMs === null ? `Limit ${limit}` : `${formatMinutes(todayUsedMs)} of ${limit}`;
}

/** A habit that still needs doing today. */
export const HabitRow = memo(function HabitRow({
  habit,
  entry,
  day,
  streak,
  streakUnit,
  weekProgress,
  index,
  onLongPress,
  last,
  easy,
}: Props) {
  const t = useTheme();
  const skipped = !!entry?.skipped && !entry.deleted;
  const value = entry && !entry.deleted ? entry.value : 0;
  const auto = autoIcon(habit.auto);
  const isScreen = habit.auto?.provider === 'screen';
  const tinyMode = !!easy && !isScreen;
  const screenToday = useScreen((s) => s.days.find((d) => !d.final));
  const guarded = useApp((s) => s.guard.apps);
  const swipe = useSwipe(() => {
    if (isScreen) return;
    if (tinyMode) logTinyHabit(habit.id, day);
    else completeHabit(habit.id, day, 'manual');
  });

  const meta: string[] = [];
  if (skipped) meta.push('Rest day · streak protected');
  else if (isScreen && habit.auto?.provider === 'screen') {
    const used = screenToday ? screenMinutes(screenToday, habit.auto.scope, new Set(guarded)) * MIN : null;
    meta.push(screenMeta(habit, used)!);
  } else if (tinyMode) {
    meta.push(`Tiny: ${tinyVersion(habit).label}`);
  } else {
    if (habit.kind !== 'check') meta.push(formatProgress(habit, value));
    if (weekProgress) meta.push(`${weekProgress.done} of ${weekProgress.target} this week`);
    else if (habit.kind === 'check') meta.push(scheduleLabel(habit.schedule));
  }

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 8) * 35).duration(260)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}
    >
      <GestureDetector gesture={swipe.pan}>
        <View style={{ overflow: 'hidden' }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: t.accent, justifyContent: 'center', paddingLeft: 26 },
              swipe.reveal,
            ]}
          >
            <Animated.View style={swipe.mark}>
              <Icon name="check" size={24} color={t.onAccent} weight="bold" />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[{ backgroundColor: t.bg }, swipe.row]}>
            <Tap
              onPress={() => router.push(`/habit/${habit.id}`)}
              onLongPress={() => onLongPress(habit)}
              delayLongPress={350}
              scaleTo={0.99}
              haptics={false}
              accessibilityHint="Opens details. Swipe right to complete, long-press to log details."
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 }}
            >
              <Glyph habit={habit} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="subheading" numberOfLines={1} tone={skipped ? 'muted' : 'default'}>
                  {habit.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {streak > 0 && !skipped ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Icon name="fire" size={12} color={t.text} weight="fill" />
                      <Text variant="caption" weight="bold" tabular>
                        {streak}
                        {streakUnit === 'week' ? 'w' : ''}
                      </Text>
                    </View>
                  ) : null}
                  {auto ? <Icon name={auto} size={12} color={t.textMuted} weight="fill" /> : null}
                  <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {meta.join(' · ')}
                  </Text>
                </View>
              </View>
              {skipped ? (
                <View style={{ width: SIZE, alignItems: 'center' }}>
                  <Icon name="moon" size={18} color={t.textFaint} />
                </View>
              ) : isScreen ? (
                <ScreenMeter habit={habit} />
              ) : (
                <Control habit={habit} entry={entry} day={day} onLongPress={() => onLongPress(habit)} easy={tinyMode} />
              )}
            </Tap>
          </Animated.View>
          {last ? null : (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.borderStrong, marginLeft: 56 }} />
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
});

/** A finished habit, folded into the compact "Done" group. Tap the check (or swipe) to undo. */
export const DoneRow = memo(function DoneRow({
  habit,
  entry,
  day,
  onLongPress,
}: {
  habit: Habit;
  entry: Entry | undefined;
  day: DayKey;
  onLongPress: (habit: Habit) => void;
}) {
  const t = useTheme();
  // Screen limits are measured, not ticked: there's nothing to undo by hand.
  const undo = () =>
    habit.auto?.provider === 'screen'
      ? undefined
      : habit.kind === 'check'
        ? toggleHabit(habit.id, day)
        : setProgress(habit.id, day, 0);
  const swipe = useSwipe(undo);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const value = entry && !entry.deleted ? entry.value : 0;
  const at = entry?.completedAt
    ? new Date(entry.completedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;
  const detail = habit.kind === 'check' ? at : formatAmount(habit, value);
  const auto = !!entry && ['device', 'workout', 'github', 'leetcode', 'health'].includes(entry.source);
  const fill = t.scheme === 'dark' ? t.accent : t.accentInk;

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(140)}
      layout={LinearTransition.springify().damping(22)}
    >
      <GestureDetector gesture={swipe.pan}>
        <View style={{ overflow: 'hidden' }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: t.surface3, justifyContent: 'center', paddingLeft: 22 },
              swipe.reveal,
            ]}
          >
            <Animated.View style={swipe.mark}>
              <Icon name="arrow-counter-clockwise" size={20} color={t.text} />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[{ backgroundColor: t.bg }, swipe.row]}>
            <Tap
              onPress={() => router.push(`/habit/${habit.id}`)}
              onLongPress={() => onLongPress(habit)}
              delayLongPress={350}
              scaleTo={0.99}
              haptics={false}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9 }}
            >
              <Tap
                onPress={undo}
                hitSlop={10}
                haptics="light"
                scaleTo={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: true }}
                accessibilityLabel={`Undo ${habit.name}`}
              >
                <Animated.View style={[{ width: 42, height: 28, alignItems: 'center', justifyContent: 'center' }, pop]}>
                  <Svg width={28} height={28} style={{ position: 'absolute', left: 7 }}>
                    <Circle cx={14} cy={14} r={14} fill={fill} />
                  </Svg>
                  <Icon name="check" size={15} color={t.scheme === 'dark' ? t.onAccent : '#FFFFFF'} weight="bold" />
                </Animated.View>
              </Tap>
              <Text variant="body" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                {habit.name}
              </Text>
              {auto ? <Icon name="lightning" size={12} color={t.textFaint} weight="fill" /> : null}
              {detail ? (
                <Text variant="caption" tone="faint" tabular>
                  {detail}
                </Text>
              ) : null}
            </Tap>
          </Animated.View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
});
