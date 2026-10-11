import { View } from 'react-native';
import { averagePace, decodePolyline, formatDistance, formatDuration, formatPace } from '@/domain/activity';
import type { Workout } from '@/domain/types';
import { Card } from '@/ui/Card';
import { Icon, IconName } from '@/ui/Icon';
import { useFrameWidth } from '@/ui/layout';
import { Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { ElevationChart, RouteArt } from './RouteArt';

export const WORKOUT_META: Record<Workout['type'], { label: string; icon: IconName }> = {
  walk: { label: 'Walk', icon: 'person-simple-walk' },
  run: { label: 'Run', icon: 'person-simple-run' },
  ride: { label: 'Ride', icon: 'person-simple-bike' },
};

export function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: 12, paddingHorizontal: 4, gap: 2 }}>
      <Text weight="bold" size={26} tabular style={{ letterSpacing: -1 }}>
        {value}
        {unit ? (
          <Text weight="semibold" size={15} tone="muted">
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

/** Route, numbers, splits and elevation for a finished workout. */
export function WorkoutSummary({ workout }: { workout: Workout }) {
  const t = useTheme();
  const width = useFrameWidth() - 40;
  const pace = averagePace(workout);
  const points = workout.route ? decodePolyline(workout.route) : [];
  const fastest = workout.splits.length ? Math.min(...workout.splits) : null;
  const profile = workout.elevationProfile;
  const low = profile.length ? Math.min(...profile) : 0;
  const high = profile.length ? Math.max(...profile) : 0;
  // A flat line with "Low 0 m · High 0 m" says nothing, so only chart routes that climb.
  const hilly = profile.length >= 3 && high - low >= 3;

  return (
    <View style={{ gap: 18 }}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <RouteArt points={points} width={width} height={Math.round(width * 0.62)} strokeWidth={4.5} padding={28} />
      </Card>

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 }}>
        <StatCell
          label="Distance"
          value={formatDistance(workout.distanceM).split(' ')[0]}
          unit={formatDistance(workout.distanceM).split(' ')[1]}
        />
        <StatCell label="Moving time" value={formatDuration(workout.movingSec)} />
        <StatCell
          label={workout.type === 'ride' ? 'Avg speed' : 'Avg pace'}
          value={workout.type === 'ride' ? (pace ? (3600 / pace).toFixed(1) : '–') : formatPace(pace)}
          unit={workout.type === 'ride' ? 'km/h' : '/km'}
        />
        <StatCell label="Elevation gain" value={`${Math.round(workout.elevationGainM)}`} unit="m" />
        {workout.type !== 'ride' && workout.steps > 0 ? (
          <StatCell label="Steps" value={workout.steps.toLocaleString()} />
        ) : null}
        {workout.steps > 0 && workout.movingSec > 60 && workout.type !== 'ride' ? (
          <StatCell label="Cadence" value={`${Math.round(workout.steps / (workout.movingSec / 60))}`} unit="spm" />
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <SourcePill
          icon={workout.distanceSource === 'gps' ? 'crosshair' : 'footprints'}
          label={
            workout.distanceSource === 'gps'
              ? 'Distance by GPS'
              : workout.distanceSource === 'steps'
                ? 'Distance from steps (no GPS)'
                : 'No distance'
          }
        />
        {workout.elevationSource !== 'none' ? (
          <SourcePill
            icon="mountains"
            label={workout.elevationSource === 'barometer' ? 'Elevation by barometer' : 'Elevation by GPS'}
          />
        ) : null}
      </View>

      {hilly ? (
        <Section title="Elevation">
          <Card style={{ gap: 8 }}>
            <ElevationChart values={profile} width={width - 36} height={90} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="muted">
                Low {Math.round(low)} m
              </Text>
              <Text variant="caption" tone="muted">
                High {Math.round(high)} m
              </Text>
            </View>
          </Card>
        </Section>
      ) : null}

      {workout.splits.length ? (
        <Section title="Splits">
          <Card style={{ gap: 10 }}>
            {workout.splits.map((sec, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text variant="caption" tone="muted" tabular style={{ width: 40 }}>
                  km {i + 1}
                </Text>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.surface2, overflow: 'hidden' }}>
                  <View
                    style={{
                      width: `${Math.max(12, Math.min(100, ((fastest ?? sec) / sec) * 100))}%`,
                      height: '100%',
                      borderRadius: 4,
                      backgroundColor: sec === fastest ? t.accentInk : t.textFaint,
                    }}
                  />
                </View>
                <Text variant="caption" weight="semibold" tabular style={{ width: 52, textAlign: 'right' }}>
                  {formatPace(sec)}
                </Text>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </View>
  );
}

function SourcePill({ icon, label }: { icon: IconName; label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        height: 28,
        borderRadius: 14,
        backgroundColor: t.surface2,
      }}
    >
      <Icon name={icon} size={13} color={t.textMuted} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
