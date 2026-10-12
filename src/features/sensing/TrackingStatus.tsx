import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { formatDistance, formatDuration, type Segment } from '@/domain/activity';
import { timeAgo } from '@/features/habits/format';
import { Button } from '@/ui/Button';
import { Icon, IconName } from '@/ui/Icon';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';
import {
  activitySegments,
  disableAutoSensing,
  enableAutoSensing,
  liveWorkout,
  LiveWorkout,
  refreshSensing,
  sensingSupported,
  useSensing,
  workoutList,
} from './index';
import { WORKOUT_META } from './WorkoutSummary';

/** A softly pulsing dot — the "it's on" signal used everywhere sensing is active. */
export function LiveDot({ color, size = 8 }: { color?: string; size?: number }) {
  const t = useTheme();
  const c = color ?? (t.scheme === 'dark' ? t.accent : t.accentInk);
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })),
      -1,
    );
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: c }, halo]}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />
    </View>
  );
}

function useLiveWorkout(active: boolean) {
  const [live, setLive] = useState<LiveWorkout | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!active) {
        setLive(null);
        return;
      }
      const tick = () => setLive(liveWorkout());
      tick();
      const id = setInterval(tick, 2000);
      return () => clearInterval(id);
    }, [active]),
  );
  return live;
}

const TYPE_ICON: Record<Segment['type'], IconName> = {
  walk: 'person-simple-walk',
  run: 'person-simple-run',
  ride: 'person-simple-bike',
};

/** "● Tracking · 6,240 steps" — always tells you, at a glance, whether your phone is sensing. */
export function TrackingPill() {
  const t = useTheme();
  const caps = useSensing((s) => s.caps);
  const steps = useSensing((s) => s.stepsToday);
  const [open, setOpen] = useState(false);
  const on = !!caps?.stepsEnabled || !!caps?.activityDetectionEnabled;
  const live = useLiveWorkout(!!caps?.workoutActive);

  if (!sensingSupported || !caps) return null;

  const label = live
    ? `Recording ${WORKOUT_META[live.type].label.toLowerCase()} · ${formatDistance(live.distanceM)} · ${formatDuration(live.movingSec)}`
    : on
      ? `Tracking${steps !== null ? ` · ${steps.toLocaleString()} steps` : ''}`
      : 'Auto-tracking is off';

  return (
    <>
      <Tap
        onPress={() => (live ? router.push('/workout') : setOpen(true))}
        scaleTo={0.96}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Shows what Ritual is tracking.`}
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 30,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          backgroundColor: live ? t.accent : t.surface2,
        }}
      >
        {on || live ? (
          <LiveDot color={live ? t.onAccent : undefined} size={7} />
        ) : (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.textFaint }} />
        )}
        <Text variant="caption" weight="semibold" color={live ? t.onAccent : on ? t.text : t.textMuted} tabular>
          {label}
        </Text>
      </Tap>
      <TrackingSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function Status({ ok, label, detail, last }: { ok: boolean; label: string; detail: string; last?: boolean }) {
  const t = useTheme();
  return (
    <ListRow
      leading={
        <View style={{ width: 34, alignItems: 'center' }}>
          {ok ? (
            <LiveDot size={9} />
          ) : (
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.textFaint }} />
          )}
        </View>
      }
      title={label}
      subtitle={detail}
      last={last}
    />
  );
}

/** Exactly what's on, what it last saw, and the switch to turn it off. */
export function TrackingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const caps = useSensing((s) => s.caps);
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    if (!visible) return;
    refreshSensing();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    setSegments(activitySegments(midnight.getTime()));
  }, [visible]);

  const on = !!caps?.stepsEnabled || !!caps?.activityDetectionEnabled;
  const today = new Date().toDateString();
  const workoutsToday = workoutList().filter((w) => new Date(w.startedAt).toDateString() === today);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="What Ritual is tracking"
      subtitle="Counted on this phone. Works offline and with the app closed."
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title={on ? 'Pause tracking' : 'Turn on'}
            variant={on ? 'secondary' : 'primary'}
            style={{ flex: 1 }}
            onPress={async () => {
              if (on) disableAutoSensing();
              else await enableAutoSensing();
            }}
          />
          <Button
            title="Manage"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => {
              onClose();
              setTimeout(() => router.push('/integrations'), 200);
            }}
          />
        </View>
      }
    >
      <ListGroup>
        <Status
          ok={!!caps?.stepsEnabled}
          label="Step counter"
          detail={
            !caps?.stepCounter
              ? 'This phone has no step sensor'
              : caps.stepsEnabled
                ? caps.lastStepSnapshotAt
                  ? `On · last counted ${timeAgo(caps.lastStepSnapshotAt)}`
                  : 'On · first count coming up'
                : 'Off'
          }
        />
        <Status
          ok={!!caps?.activityDetectionEnabled}
          label="Walk, run & ride detection"
          detail={caps?.activityDetectionEnabled ? 'On · Android tells Ritual when you start moving' : 'Off'}
        />
        <Status
          ok={!!caps?.usageAccess}
          label="Screen time"
          detail={
            caps?.usageAccess
              ? caps.pauseServiceEnabled
                ? 'On · mindful pause active for guarded apps'
                : 'On · read from Android’s usage log'
              : 'Off'
          }
        />
        <Status
          ok={on}
          label="Background checks"
          detail={on ? 'About every 15 minutes, even with the app closed' : 'Off'}
          last={!on || !!caps?.batteryUnrestricted}
        />
        {on && caps && !caps.batteryUnrestricted ? (
          <ListRow
            icon="warning"
            iconColor={t.warning}
            title="Battery saver may pause it"
            subtitle="See how to keep Ritual running on this phone"
            onPress={() => {
              onClose();
              setTimeout(() => router.push('/reliability'), 200);
            }}
            last
          />
        ) : null}
      </ListGroup>

      <View style={{ gap: 10 }}>
        <Text variant="bodyStrong">Noticed today</Text>
        {segments.length || workoutsToday.length ? (
          <View style={{ gap: 10 }}>
            {workoutsToday.map((w) => (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name={WORKOUT_META[w.type].icon} size={18} color={t.text} />
                <Text variant="caption" style={{ flex: 1 }}>
                  Recorded {WORKOUT_META[w.type].label.toLowerCase()} · {formatDistance(w.distanceM)}
                </Text>
                <Text variant="caption" tone="muted" tabular>
                  {new Date(w.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            ))}
            {segments.map((s) => (
              <View key={`${s.type}-${s.start}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name={TYPE_ICON[s.type]} size={18} color={t.text} />
                <Text variant="caption" style={{ flex: 1 }}>
                  {WORKOUT_META[s.type].label} · {Math.round((s.end - s.start) / 60000)} min
                </Text>
                <Text variant="caption" tone="muted" tabular>
                  {new Date(s.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} –{' '}
                  {new Date(s.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="muted">
            Nothing yet today. Walks, runs and rides of 3 minutes or more show up here.
          </Text>
        )}
      </View>
    </Sheet>
  );
}
