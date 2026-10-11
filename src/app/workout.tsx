import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { formatDistance, formatDuration, formatPace } from '@/domain/activity';
import type { Workout, WorkoutType } from '@/domain/types';
import { toast } from '@/data/ui';
import { runAutoTracking } from '@/features/integrations/engine';
import {
  capabilities,
  discardWorkout,
  finishWorkout,
  liveWorkout,
  LiveWorkout,
  pauseWorkout,
  refreshSensing,
  resumeWorkout,
  sensingSupported,
  startWorkout,
} from '@/features/sensing';
import { RouteArt } from '@/features/sensing/RouteArt';
import { WORKOUT_META, WorkoutSummary } from '@/features/sensing/WorkoutSummary';
import { haptic } from '@/lib/haptics';
import { Button, IconButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { useFrameWidth } from '@/ui/layout';
import { goBack, Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

type Phase = 'setup' | 'live' | 'summary';

const GPS_LABEL: Record<LiveWorkout['gpsStatus'], string> = {
  searching: 'Finding GPS…',
  strong: 'GPS strong',
  ok: 'GPS good',
  weak: 'GPS weak',
  lost: 'No GPS · using steps',
};

function LiveStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text weight="bold" size={24} tabular style={{ letterSpacing: -0.8 }}>
        {value}
        {unit ? (
          <Text weight="semibold" size={13} tone="muted">
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export default function WorkoutScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const [type, setType] = useState<WorkoutType>('run');
  const [phase, setPhase] = useState<Phase>(() => (liveWorkout() ? 'live' : 'setup'));
  const [live, setLive] = useState<LiveWorkout | null>(() => liveWorkout());
  const [saved, setSaved] = useState<Workout | null>(null);
  const [starting, setStarting] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardArmed, setDiscardArmed] = useState(false);
  const card = useRef<View>(null);
  const caps = capabilities();

  // Poll the native recorder once a second while live.
  useEffect(() => {
    if (phase !== 'live') return;
    const tick = () => {
      const s = liveWorkout();
      if (s) setLive(s);
      else {
        // Finished from the notification while we were away.
        setPhase('setup');
        refreshSensing();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (!sensingSupported) {
    return (
      <Screen back="close" title="Record a workout">
        <EmptyState
          icon="person-simple-run"
          title="Recording runs on Android"
          body="The workout tracker uses your phone’s GPS, barometer and step counter. Install the Android app to record walks, runs and rides."
        />
      </Screen>
    );
  }

  const begin = async () => {
    setStarting(true);
    try {
      const mode = await startWorkout(type);
      if (mode === 'denied') {
        toast('Allow Location or Physical activity to record', { tone: 'error' });
      } else {
        haptic.success();
        if (mode === 'steps-only')
          toast('No location access. Distance will come from your steps', { icon: 'footprints' });
        setPhase('live');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start', { tone: 'error' });
    }
    setStarting(false);
  };

  const finish = () => {
    setDiscardArmed(false);
    setFinishOpen(true);
  };

  const save = async () => {
    setFinishOpen(false);
    const w = finishWorkout();
    haptic.success();
    if (!w) {
      toast('Too short to save', { icon: 'timer' });
      setPhase('setup');
      return;
    }
    setSaved(w);
    setPhase('summary');
    await runAutoTracking({ reason: 'manual', force: true }).catch(() => 0);
    refreshSensing();
  };

  // Discarding loses the whole recording, so it takes a second, deliberate tap.
  const discard = () => {
    if (!discardArmed) {
      haptic.warning();
      setDiscardArmed(true);
      return;
    }
    setFinishOpen(false);
    discardWorkout();
    refreshSensing();
    goBack();
  };

  const share = async () => {
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { dialogTitle: 'Share your workout', mimeType: 'image/png' });
    } catch {
      // cancelled
    }
  };

  // ── Summary ────────────────────────────────────────────────────────────
  if (phase === 'summary' && saved) {
    return (
      <Screen
        back="close"
        title={`${WORKOUT_META[saved.type].label} saved`}
        subtitle={new Date(saved.startedAt).toLocaleString(undefined, {
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
        })}
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Share" icon="export" variant="secondary" size="lg" style={{ flex: 1 }} onPress={share} />
            <Button title="Done" size="lg" style={{ flex: 1 }} onPress={() => router.replace('/(tabs)')} />
          </View>
        }
      >
        <View ref={card} collapsable={false} style={{ backgroundColor: t.bg }}>
          <WorkoutSummary workout={saved} />
        </View>
      </Screen>
    );
  }

  // ── Live ───────────────────────────────────────────────────────────────
  if (phase === 'live' && live) {
    const meta = WORKOUT_META[live.type];
    const route: [number, number][] = [];
    for (let i = 0; i + 1 < live.route.length; i += 2) route.push([live.route[i], live.route[i + 1]]);
    const [num, unit] = formatDistance(live.distanceM).split(' ');
    const gpsOk = live.gpsStatus === 'strong' || live.gpsStatus === 'ok';
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: insets.top + 10,
          paddingBottom: Math.max(insets.bottom, 12) + 12,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}
        >
          <IconButton name="caret-down" accessibilityLabel="Minimise" onPress={goBack} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              height: 32,
              borderRadius: 16,
              backgroundColor: t.surface2,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gpsOk ? t.accentInk : t.warning }} />
            <Text variant="caption" weight="semibold">
              {live.paused ? 'Paused' : GPS_LABEL[live.gpsStatus]}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ alignItems: 'center', marginTop: 18, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={meta.icon} size={16} color={t.textMuted} />
            <Text variant="label" tone="muted">
              {meta.label} · {live.distanceSource === 'steps' ? 'from steps' : 'distance'}
            </Text>
          </View>
          <Text weight="heavy" size={96} tabular style={{ lineHeight: 100, letterSpacing: -5 }}>
            {num}
          </Text>
          <Text weight="bold" size={18} tone="muted">
            {unit === 'm' ? 'metres' : 'kilometres'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 24, marginTop: 24 }}>
          <LiveStat label="Time" value={formatDuration(live.movingSec)} />
          <LiveStat
            label={live.type === 'ride' ? 'Speed' : 'Pace'}
            value={
              live.type === 'ride'
                ? live.paceSecPerKm
                  ? (3600 / live.paceSecPerKm).toFixed(1)
                  : '–'
                : formatPace(live.paceSecPerKm)
            }
            unit={live.type === 'ride' ? 'km/h' : '/km'}
          />
          <LiveStat label="Climb" value={`${Math.round(live.elevationGainM)}`} unit="m" />
          {live.type !== 'ride' ? <LiveStat label="Steps" value={Math.round(live.steps).toLocaleString()} /> : null}
        </View>

        <View style={{ flex: 1, margin: 20, borderRadius: radius.xl, backgroundColor: t.surface, overflow: 'hidden' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <RouteArt
              points={route}
              width={width - 40}
              height={Math.max(160, Math.min(320, width * 0.7))}
              padding={30}
              strokeWidth={5}
              emptyLabel={
                live.gpsStatus === 'searching'
                  ? 'Waiting for a GPS fix…'
                  : 'No GPS here. Distance is coming from your steps.'
              }
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            paddingHorizontal: 24,
          }}
        >
          <Tap
            onPress={() => {
              haptic.medium();
              if (live.paused) resumeWorkout();
              else pauseWorkout();
              setTimeout(() => setLive(liveWorkout()), 150);
            }}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={live.paused ? 'Resume' : 'Pause'}
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: live.paused ? t.accent : t.surface3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={live.paused ? 'play' : 'pause'}
              size={30}
              color={live.paused ? t.onAccent : t.text}
              weight="fill"
            />
          </Tap>
          <Tap
            onPress={finish}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Finish"
            style={{
              height: 76,
              paddingHorizontal: 34,
              borderRadius: 38,
              backgroundColor: t.text,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Icon name="flag" size={22} color={t.bg} weight="fill" />
            <Text weight="bold" size={18} color={t.bg}>
              Finish
            </Text>
          </Tap>
        </View>

        <Sheet
          visible={finishOpen}
          onClose={() => setFinishOpen(false)}
          title={`Finish your ${meta.label.toLowerCase()}?`}
          subtitle="Saving counts it toward your habits."
          scroll={false}
          footer={
            <View style={{ gap: 10 }}>
              <Button title="Save workout" icon="check" size="lg" full onPress={save} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  title="Keep going"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => setFinishOpen(false)}
                />
                <Button
                  title={discardArmed ? 'Tap to confirm' : 'Discard'}
                  icon="trash"
                  variant={discardArmed ? 'danger' : 'ghost'}
                  style={{ flex: 1 }}
                  onPress={discard}
                />
              </View>
            </View>
          }
        >
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: radius.lg,
              backgroundColor: t.surface2,
            }}
          >
            <LiveStat label="Distance" value={num} unit={unit} />
            <LiveStat label="Time" value={formatDuration(live.movingSec)} />
            <LiveStat label="Climb" value={`${Math.round(live.elevationGainM)}`} unit="m" />
          </View>
        </Sheet>
      </View>
    );
  }

  // ── Setup ──────────────────────────────────────────────────────────────
  return (
    <Screen back="close" title="Record a workout">
      <Segmented<WorkoutType>
        value={type}
        onChange={setType}
        options={[
          { value: 'walk', label: 'Walk', icon: 'person-simple-walk' },
          { value: 'run', label: 'Run', icon: 'person-simple-run' },
          { value: 'ride', label: 'Ride', icon: 'person-simple-bike' },
        ]}
      />

      <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Tap
          onPress={begin}
          disabled={starting}
          scaleTo={0.92}
          haptics="medium"
          accessibilityRole="button"
          accessibilityLabel={`Start ${WORKOUT_META[type].label.toLowerCase()}`}
          style={{
            width: 188,
            height: 188,
            borderRadius: 94,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Icon name={WORKOUT_META[type].icon} size={44} color={t.onAccent} weight="fill" />
          <Text weight="heavy" size={26} color={t.onAccent} style={{ letterSpacing: -1 }}>
            {starting ? 'Starting…' : 'Start'}
          </Text>
        </Tap>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 12 }}>
        {[
          {
            icon: 'crosshair' as const,
            title: 'GPS route, pace and splits',
            body: 'Recorded on the phone. No internet needed.',
          },
          {
            icon: 'mountains' as const,
            title: caps?.barometer ? 'Elevation by barometer' : 'Elevation from GPS',
            body: caps?.barometer
              ? 'Your phone has a pressure sensor, so climbs are precise.'
              : 'Your phone has no barometer, so GPS altitude is used.',
          },
          {
            icon: 'footprints' as const,
            title: 'No GPS? Still counts',
            body: 'Indoors or on a treadmill, distance comes from your steps.',
          },
          {
            icon: 'device-mobile' as const,
            title: 'Screen off is fine',
            body: 'Keeps recording in the background, with controls in your notifications.',
          },
        ].map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={f.icon} size={19} color={t.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{f.title}</Text>
              <Text variant="caption" tone="muted">
                {f.body}
              </Text>
            </View>
          </View>
        ))}
      </Animated.View>
    </Screen>
  );
}
