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
import { addProgress, completeHabit, logTinyHabit } from '@/features/habits/actions';
import { formatAmount } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { cancelNotification, scheduleAt } from '@/features/notifications/scheduler';
import { haptic } from '@/lib/haptics';
import { Button, IconButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ProgressRing } from '@/ui/ProgressRing';
import { Text } from '@/ui/Text';
import { shadow, useTheme } from '@/ui/theme';

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
  const { id, minutes: preset } = useLocalSearchParams<{ id: string; minutes?: string }>();
  const habit = useHabit(id);
  const today = useToday();
  const logged = useApp((s) => (habit ? (s.entries[`${habit.id}_${today}`]?.value ?? 0) : 0));
  const remainingTarget = habit ? Math.max(5, Math.round(habit.target - logged)) : 25;
  // "Just start": a two-minute timer lowers the bar to begin; most people keep going.
  const presetMin = preset ? Math.max(1, Math.min(180, Number(preset) || 2)) : null;
  const [minutes, setMinutes] = useState(presetMin ?? remainingTarget);
  // Only time-based habits log minutes; for others the timer is a starting ramp.
  const logsTime = habit?.kind === 'duration';
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
    if (mins >= 1 && logsTime) {
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
      'Session complete',
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
              ...shadow(t.scheme === 'dark' ? t.accent : t.shadow, phase === 'running' ? 0.28 : 0.08, 60),
            }}
          >
            <ProgressRing progress={progress} size={290} stroke={10} duration={300}>
              <View style={{ marginBottom: 6 }}>
                <HabitIcon icon={habit.icon} color={habit.color} size={44} />
              </View>
              <Text weight="heavy" size={64} tabular style={{ letterSpacing: -3, lineHeight: 70 }}>
                {phase === 'done' ? 'Done' : fmt((phase === 'setup' ? totalMs : remaining) / 1000)}
              </Text>
              <Text variant="caption" tone="muted">
                {phase === 'setup'
                  ? `${formatAmount(habit, logged)} of ${formatAmount(habit, habit.target)} today`
                  : phase === 'paused'
                    ? 'Paused'
                    : phase === 'done'
                      ? logsTime
                        ? `${minutesDone} min logged`
                        : 'You started. That was the hard part.'
                      : presetMin && presetMin <= 5
                        ? 'Just start. Keep going if you like'
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
            {[...new Set([...(presetMin ? [presetMin] : []), 5, 10, 15, 25, 45, 60, remainingTarget])]
              .sort((a, b) => a - b)
              .map((m) => (
                <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
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
        {phase === 'done' && logsTime ? <Button title="Done" size="lg" full onPress={close} /> : null}
        {phase === 'done' && !logsTime ? (
          <View style={{ gap: 10 }}>
            <Button
              title="I finished it"
              icon="check"
              size="lg"
              full
              onPress={() => {
                completeHabit(habit.id, today, 'timer');
                close();
              }}
            />
            <Button
              title="Count the tiny version"
              icon="plant"
              variant="secondary"
              size="lg"
              full
              onPress={() => {
                logTinyHabit(habit.id, today);
                close();
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
