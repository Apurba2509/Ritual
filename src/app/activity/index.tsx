import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  averagePace,
  dailyMinutes,
  decodePolyline,
  formatDistance,
  formatDuration,
  formatPace,
} from '@/domain/activity';
import { addDays, fromDayKey, todayKey } from '@/domain/dates';
import type { WorkoutType } from '@/domain/types';
import { useApp } from '@/data/store';
import { activitySegments, dailySteps, refreshSensing, sensingSupported, useSensing } from '@/features/sensing';
import { RouteArt } from '@/features/sensing/RouteArt';
import { WORKOUT_META } from '@/features/sensing/WorkoutSummary';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { BarChart } from '@/ui/charts';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

export default function ActivityScreen() {
  const t = useTheme();
  const workouts = useApp((s) => s.workouts);
  const caps = useSensing((s) => s.caps);
  const [steps, setSteps] = useState<Record<string, number>>({});
  const [minutes, setMinutes] = useState<Record<string, number>>({});

  const list = useMemo(
    () =>
      Object.values(workouts)
        .filter((w) => !w.deleted)
        .sort((a, b) => b.startedAt - a.startedAt),
    [workouts],
  );

  useFocusEffect(
    useCallback(() => {
      refreshSensing();
      dailySteps(7).then(setSteps);
      const segs = activitySegments(Date.now() - 8 * 86_400_000);
      const all = Object.values(useApp.getState().workouts).filter((w) => !w.deleted);
      const sum: Record<string, number> = {};
      for (const type of ['walk', 'run', 'ride'] as WorkoutType[]) {
        for (const [d, v] of Object.entries(dailyMinutes(type, all, segs))) sum[d] = (sum[d] ?? 0) + v;
      }
      setMinutes(sum);
    }, []),
  );

  const today = todayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekSteps = week.reduce((s, d) => s + (steps[d] ?? 0), 0);
  const weekMinutes = week.reduce((s, d) => s + (minutes[d] ?? 0), 0);
  const weekKm = list.filter((w) => w.date >= week[0]).reduce((s, w) => s + w.distanceM, 0) / 1000;

  return (
    <Screen
      back
      title="Activity"
      subtitle={sensingSupported ? 'Counted by your phone, even with Ritual closed.' : undefined}
      footer={
        sensingSupported ? (
          <Button title="Record a workout" icon="play" size="lg" full onPress={() => router.push('/workout')} />
        ) : undefined
      }
    >
      <Card padded={false} style={{ flexDirection: 'row', paddingVertical: 16 }}>
        {[
          { label: 'Steps · 7 days', value: caps?.stepsEnabled ? weekSteps.toLocaleString() : '—' },
          { label: 'Active min', value: `${weekMinutes}` },
          { label: 'Distance', value: `${weekKm.toFixed(1)} km` },
        ].map((s, i) => (
          <View
            key={s.label}
            style={{
              flex: 1,
              gap: 4,
              paddingHorizontal: 14,
              borderRightWidth: i < 2 ? 1 : 0,
              borderRightColor: t.border,
            }}
          >
            <Text weight="bold" size={22} tabular numberOfLines={1} adjustsFontSizeToFit>
              {s.value}
            </Text>
            <Text variant="caption" tone="muted">
              {s.label}
            </Text>
          </View>
        ))}
      </Card>

      {caps?.stepsEnabled ? (
        <Section title="Steps this week">
          <Card>
            <BarChart
              height={110}
              formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
              data={week.map((d) => ({
                label: fromDayKey(d).toLocaleDateString(undefined, { weekday: 'narrow' }),
                value: steps[d] ?? 0,
                highlight: d === today,
              }))}
            />
          </Card>
        </Section>
      ) : sensingSupported ? (
        <Card
          onPress={() => router.push('/integrations')}
          style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}
        >
          <Icon name="footprints" size={22} color={t.accentInk} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Turn on step counting</Text>
            <Text variant="caption" tone="muted">
              Uses the phone’s step sensor. Works offline and with the app closed.
            </Text>
          </View>
          <Icon name="caret-right" size={16} color={t.textFaint} />
        </Card>
      ) : null}

      <Section title={`Workouts · ${list.length}`}>
        {list.length === 0 ? (
          <EmptyState
            compact
            icon="person-simple-run"
            title="No workouts yet"
            body="Record a walk, run or ride. GPS route, pace, splits and elevation, all on your phone."
          />
        ) : (
          <View style={{ gap: 8 }}>
            {list.map((w) => {
              const meta = WORKOUT_META[w.type];
              const pts = w.route ? decodePolyline(w.route) : [];
              const pace = averagePace(w);
              return (
                <Card
                  key={w.id}
                  onPress={() => router.push(`/activity/${w.id}`)}
                  style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12 }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      backgroundColor: t.surface2,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pts.length > 1 ? (
                      <RouteArt points={pts} width={64} height={64} padding={8} strokeWidth={2.5} />
                    ) : (
                      <Icon name={meta.icon} size={26} color={t.text} weight="duotone" />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="subheading">
                      {formatDistance(w.distanceM)} {meta.label.toLowerCase()}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {formatDuration(w.movingSec)} ·{' '}
                      {w.type === 'ride' ? `${pace ? (3600 / pace).toFixed(1) : '–'} km/h` : `${formatPace(pace)}/km`}
                      {w.elevationGainM >= 5 ? ` · ↑${Math.round(w.elevationGainM)} m` : ''}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {new Date(w.startedAt).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <Icon name="caret-right" size={16} color={t.textFaint} />
                </Card>
              );
            })}
          </View>
        )}
      </Section>
    </Screen>
  );
}
