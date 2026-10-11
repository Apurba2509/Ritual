import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabit, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { useUI } from '@/data/ui';
import { addProgress } from '@/features/habits/actions';
import { formatAmount } from '@/features/habits/format';
import { cancelNotification, scheduleAt } from '@/features/notifications/scheduler';
import { haptic } from '@/lib/haptics';
import { Button, IconButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ProgressRing } from '@/ui/ProgressRing';
import { Text } from '@/ui/Text';
import { alpha, useTheme, shadow } from '@/ui/theme';

type Phase = 'setup' | 'running' | 'paused' | 'done';
const NOTIF_ID = 'focus:end';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function FocusScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabit(id);
  const today = useToday();
  const logged = useApp((s) => (habit ? (s.entries[`${habit.id}_${today}`]?.value ?? 0) : 0));
  const remainingTarget = habit ? Math.max(5, Math.round(habit.target - logged)) : 25;
  const [minutes, setMinutes] = useState(remainingTarget);
  const [phase, setPhase] = useState<Phase>('setup');
  // Timestamps, not a ticking counter — accurate even if the app is backgrounded.
  const [startedAt, setStartedAt] = useState(0);
  const [bankedMs, setBankedMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);
  const pulse = useSharedValue(1);

  const totalMs = minutes * 60_000;
  const elapsedMs = phase === 'running' ? bankedMs + (now - startedAt) : bankedMs;
  const remaining = Math.max(0, totalMs - elapsedMs);

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    const sub = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [phase]);

  useEffect(() => {
    pulse.value =
      phase === 'running'
        ? withRepeat(withSequence(withTiming(1.04, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1)
        : withTiming(1);
  }, [phase, pulse]);
  const glow = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const finish = (completed: boolean) => {
    if (!habit || finished.current) return;
    finished.current = true;
    cancelNotification(NOTIF_ID);
    const mins = Math.round(elapsedMs / 60_000);
    setPhase('done');
    if (mins >= 1) {
      addProgress(habit.id, today, mins, 'timer');
      if (completed) {
        haptic.success();
        useUI.getState().burst();
      }
    }
  };

  useEffect(() => {
    if (phase === 'running' && remaining <= 0) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  if (!habit) return null;

  const start = () => {
    finished.current = false;
    const at = Date.now();
    setStartedAt(at);
    setNow(at);
    setPhase('running');
    haptic.medium();
    scheduleAt(
      NOTIF_ID,
      new Date(at + totalMs - bankedMs),
      `${habit.emoji} Session complete`,
      `${minutes} minutes of ${habit.name}. Nice work — it's logged.`,
    );
  };

  const pause = () => {
    setBankedMs(bankedMs + (Date.now() - startedAt));
    setPhase('paused');
    cancelNotification(NOTIF_ID);
    haptic.light();
  };

  const close = () => {
    cancelNotification(NOTIF_ID);
    router.back();
  };

  const progress = phase === 'setup' ? 0 : 1 - remaining / totalMs;
  const minutesDone = Math.round(elapsedMs / 60_000);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 24,
      }}
    >
      {phase === 'running' ? <KeepAwake /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton
          name="x"
          accessibilityLabel="Close"
          onPress={() => (phase === 'running' || phase === 'paused' ? finish(false) : close())}
        />
        <Text variant="label" tone="muted">
          Focus · {habit.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Animated.View style={glow}>
          <View
            style={{
              borderRadius: 999,
              ...shadow(habit.color, phase === 'running' ? 0.55 : 0.2, 50),
            }}
          >
            <ProgressRing
              progress={progress}
              size={280}
              stroke={14}
              color={habit.color}
              colorEnd={t.accent}
              track={alpha(habit.color, 0.12)}
              duration={300}
            >
              <Text size={46}>{habit.emoji}</Text>
              <Text variant="hero" size={58} style={{ fontVariant: ['tabular-nums'] }}>
                {phase === 'done' ? '✓' : fmt((phase === 'setup' ? totalMs : remaining) / 1000)}
              </Text>
              <Text variant="caption" tone="muted">
                {phase === 'setup'
                  ? `${formatAmount(habit, logged)} of ${formatAmount(habit, habit.target)} today`
                  : phase === 'paused'
                    ? 'Paused'
                    : phase === 'done'
                      ? `${minutesDone} min logged`
                      : 'Stay with it'}
              </Text>
            </ProgressRing>
          </View>
        </Animated.View>

        {phase === 'setup' ? (
          <Animated.View
            entering={FadeIn}
            style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}
          >
            {[...new Set([5, 10, 15, 25, 45, 60, remainingTarget])]
              .sort((a, b) => a - b)
              .map((m) => (
                <Chip
                  key={m}
                  label={`${m} min`}
                  selected={minutes === m}
                  color={habit.color}
                  onPress={() => setMinutes(m)}
                />
              ))}
          </Animated.View>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        {phase === 'setup' ? (
          <Button title={`Start ${minutes} min`} icon="play" size="lg" full onPress={start} />
        ) : null}
        {phase === 'running' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Pause" icon="pause" variant="secondary" size="lg" style={{ flex: 1 }} onPress={pause} />
            <Button title="Finish" icon="check" size="lg" style={{ flex: 1 }} onPress={() => finish(true)} />
          </View>
        ) : null}
        {phase === 'paused' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Resume" icon="play" size="lg" style={{ flex: 1 }} onPress={start} />
            <Button
              title={`Log ${minutesDone} min`}
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              onPress={() => finish(true)}
            />
          </View>
        ) : null}
        {phase === 'done' ? <Button title="Done" size="lg" full onPress={close} /> : null}
      </View>
    </View>
  );
}
