import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { runAutoTracking } from '@/features/integrations/engine';
import { Icon } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';
import { enableAutoSensing, refreshSensing, sensingSupported, useSensing } from './index';

/** Today's movement from the phone's own sensors, with a one-tap workout recorder. */
export function MoveCard() {
  const t = useTheme();
  const caps = useSensing((s) => s.caps);
  const steps = useSensing((s) => s.stepsToday);
  const minutes = useSensing((s) => s.activeMinutesToday);
  const goal = useApp((s) => {
    const h = Object.values(s.habits).find(
      (x) =>
        !x.deleted && !x.archived && x.auto?.provider === 'device' && x.auto.metric === 'steps' && x.kind === 'count',
    );
    return h?.target ?? 8000;
  });
  const [enabling, setEnabling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!sensingSupported) return;
      refreshSensing();
      const id = setInterval(refreshSensing, 60_000);
      return () => clearInterval(id);
    }, []),
  );

  if (!sensingSupported || !caps) return null;

  const on = caps.stepsEnabled || caps.activityDetectionEnabled;

  if (on && !caps.stepCounter) {
    // Phones without a step sensor still get walk / run / ride detection.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Tap onPress={() => router.push('/activity')} style={{ flex: 1 }} scaleTo={0.99} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text weight="bold" size={28} tabular style={{ letterSpacing: -1.2 }}>
              {minutes}
            </Text>
            <Text variant="caption" tone="muted">
              active minutes today
            </Text>
          </View>
          <Text variant="caption" tone="muted">
            No step sensor on this phone. Walks, runs and rides are still detected.
          </Text>
        </Tap>
        <Tap
          onPress={() => router.push('/workout')}
          scaleTo={0.92}
          accessibilityLabel="Record a workout"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 38,
            paddingHorizontal: 14,
            borderRadius: 19,
            backgroundColor: t.surface2,
          }}
        >
          <Icon name="play" size={13} color={t.text} weight="fill" />
          <Text variant="caption" weight="bold">
            Record
          </Text>
        </Tap>
      </View>
    );
  }

  if (!on) {
    return (
      <Tap
        onPress={async () => {
          setEnabling(true);
          const res = await enableAutoSensing();
          setEnabling(false);
          if (res.steps || res.activity) {
            toast('Auto-tracking is on', { icon: 'lightning', tone: 'success' });
            runAutoTracking({ reason: 'manual', force: true }).catch(() => 0);
          } else toast('Allow Physical activity to turn this on', { tone: 'error' });
        }}
        disabled={enabling}
        scaleTo={0.98}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.borderStrong,
          borderStyle: 'dashed',
        }}
      >
        <Icon name="footprints" size={22} color={t.text} weight="fill" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{enabling ? 'Turning on…' : 'Let your phone track you'}</Text>
          <Text variant="caption" tone="muted">
            Steps, walks, runs and rides. Offline, even with the app closed.
          </Text>
        </View>
        <Icon name="arrow-right" size={18} color={t.text} />
      </Tap>
    );
  }

  const ratio = steps ? Math.min(1, steps / goal) : 0;
  const fill = t.scheme === 'dark' ? t.accent : t.accentInk;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Tap onPress={() => router.push('/activity')} style={{ flex: 1 }} scaleTo={0.99} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text weight="bold" size={28} tabular style={{ letterSpacing: -1.2 }}>
              {(steps ?? 0).toLocaleString()}
            </Text>
            <Text variant="caption" tone="muted">
              of {goal.toLocaleString()} steps
            </Text>
          </View>
          <Text variant="caption" tone="muted">
            {minutes > 0 ? `${minutes} active minutes today` : 'Counted by your phone'}
          </Text>
        </Tap>
        <Tap
          onPress={() => router.push('/workout')}
          scaleTo={0.92}
          accessibilityLabel="Record a workout"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 38,
            paddingHorizontal: 14,
            borderRadius: 19,
            backgroundColor: t.surface2,
          }}
        >
          <Icon name="play" size={13} color={t.text} weight="fill" />
          <Text variant="caption" weight="bold">
            Record
          </Text>
        </Tap>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface3, overflow: 'hidden' }}>
        <View
          style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: fill }}
        />
      </View>
    </View>
  );
}
