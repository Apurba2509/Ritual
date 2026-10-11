import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { DayKey, fromDayKey } from '@/domain/dates';
import { countDoneInWeek, isEntryDone, progressOf } from '@/domain/habits';
import { localInsights } from '@/domain/insights';
import type { Habit } from '@/domain/types';
import { useDayList, useSnapshot, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { greeting } from '@/features/habits/format';
import { DoneRow, HabitRow } from '@/features/habits/HabitRow';
import { LogSheet } from '@/features/habits/LogSheet';
import { StarterPicker } from '@/features/habits/StarterPicker';
import { runAutoTracking } from '@/features/integrations/engine';
import { MoveCard } from '@/features/sensing/MoveCard';
import { TrackingPill } from '@/features/sensing/TrackingStatus';
import { DayRing } from '@/features/today/DayRing';
import { WeekBars } from '@/features/today/WeekBars';
import { Avatar } from '@/ui/Avatar';
import { Icon, isIconName } from '@/ui/Icon';
import { useLayout } from '@/ui/layout';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

type Item = ReturnType<typeof useDayList>[number];

export default function TodayScreen() {
  const t = useTheme();
  const today = useToday();
  const { width, compact } = useLayout();
  // null = follow "today" (so the screen rolls over at midnight)
  const [picked, setPicked] = useState<DayKey | null>(null);
  const day = picked && picked < today ? picked : today;
  const setSelected = (d: DayKey) => setPicked(d === today ? null : d);
  const items = useDayList(day);
  const snapshot = useSnapshot();
  const profile = useApp((s) => s.profile);
  const demo = useApp((s) => s.demo);
  const weekStart = useApp((s) => s.settings.weekStart);
  const [logHabit, setLogHabit] = useState<Habit | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone, setShowDone] = useState(true);

  const done = (i: Item) => isEntryDone(i.habit, i.entry);
  // Flexible "N× a week" habits only count toward today once done (same rule as the stats engine).
  const isFlexible = (i: Item) => i.habit.schedule.type === 'weekly' && !done(i);
  const due = items.filter((i) => i.due && !isFlexible(i));
  const upNext = due.filter((i) => !done(i));
  const flexible = items.filter((i) => i.due && isFlexible(i));
  const bonus = items.filter((i) => !i.due && !done(i));
  const finished = items.filter(done);
  const doneCount = due.filter(done).length;
  const allDone = due.length > 0 && doneCount === due.length;
  const insight = useMemo(() => localInsights(snapshot)[0], [snapshot]);
  const isToday = day === today;
  const firstName = profile.displayName.split(' ')[0];
  const ringSize = Math.round(Math.max(196, Math.min(width * (compact ? 0.56 : 0.66), 288)));

  const onRefresh = async () => {
    setRefreshing(true);
    await runAutoTracking({ reason: 'manual', force: true }).catch(() => 0);
    setRefreshing(false);
  };

  const row = (i: Item, index: number, last: boolean) => {
    const stats = snapshot.habitStats.get(i.habit.id);
    const weekly =
      i.habit.schedule.type === 'weekly'
        ? {
            done: countDoneInWeek(i.habit, snapshot.index.get(i.habit.id), day, weekStart),
            target: i.habit.schedule.times,
          }
        : undefined;
    return (
      <HabitRow
        key={i.habit.id}
        habit={i.habit}
        entry={i.entry}
        day={day}
        index={index}
        streak={stats?.streak.current ?? 0}
        streakUnit={stats?.streak.unit ?? 'day'}
        weekProgress={weekly}
        onLongPress={setLogHabit}
        last={last}
      />
    );
  };

  return (
    <>
      <Screen
        bottomInset={116}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.text} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" weight="semibold" tone="muted">
              {fromDayKey(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text variant="title" size={30} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
          </View>
          <Tap onPress={() => router.push('/(tabs)/profile')} scaleTo={0.92} accessibilityLabel="Your profile">
            <Avatar photoUrl={profile.avatar.photoUrl} name={profile.displayName || 'You'} size={42} />
          </Tap>
        </View>

        <TrackingPill />

        {demo ? (
          <Tap
            onPress={() => router.push('/upgrade')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}
            accessibilityRole="button"
          >
            <Icon name="sparkle" size={16} color={t.textMuted} weight="fill" />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              This is sample data. Nothing you tap is saved.
            </Text>
            <Text variant="caption" weight="bold">
              Start yours →
            </Text>
          </Tap>
        ) : null}

        {items.length === 0 ? (
          <StarterPicker />
        ) : (
          <>
            {/* Hero: the day ring */}
            <View style={{ alignItems: 'center', gap: compact ? 14 : 18, paddingTop: compact ? 0 : 6 }}>
              <DayRing
                segments={due.map((i) => progressOf(i.habit, i.entry))}
                size={ringSize}
                stroke={compact ? 14 : 16}
              >
                {allDone ? (
                  <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center', gap: 6 }}>
                    <Icon
                      name="check-circle"
                      size={ringSize * 0.2}
                      color={t.scheme === 'dark' ? t.accent : t.accentInk}
                      weight="fill"
                    />
                    <Text weight="bold" size={20}>
                      Perfect day
                    </Text>
                    <Text variant="caption" tone="muted">
                      {snapshot.perfectRun > 1 ? `${snapshot.perfectRun} in a row` : 'Everything done'}
                    </Text>
                  </Animated.View>
                ) : due.length === 0 ? (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text weight="bold" size={22}>
                      Free day
                    </Text>
                    <Text variant="caption" tone="muted">
                      Nothing due. Bonus round?
                    </Text>
                  </View>
                ) : (
                  // Explicit width: Android keeps a stale shrink-wrapped width when ringSize settles after
                  // the first layout, which wrapped "done today" onto a hidden second line.
                  <View style={{ alignItems: 'center', width: ringSize - 48 }}>
                    <Text weight="heavy" size={Math.round(ringSize * 0.27)} tabular style={{ letterSpacing: -3 }}>
                      {doneCount}
                      <Text weight="heavy" size={Math.round(ringSize * 0.13)} tone="faint">
                        /{due.length}
                      </Text>
                    </Text>
                    <Text
                      variant="caption"
                      tone="muted"
                      numberOfLines={1}
                      style={{ marginTop: -2, textAlign: 'center' }}
                    >
                      {isToday ? 'done today' : fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long' })}
                    </Text>
                  </View>
                )}
              </DayRing>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Stat icon="fire" value={`${snapshot.bestStreak.days}`} label="day streak" />
                <View style={{ width: 1, height: 14, backgroundColor: t.borderStrong }} />
                <Stat icon="lightning" value={snapshot.weeklyXP.toLocaleString()} label="weekly XP" />
                <View style={{ width: 1, height: 14, backgroundColor: t.borderStrong }} />
                <Stat icon="medal" value="Lv" label={`${snapshot.level.level}`} bold />
              </View>
            </View>

            <WeekBars selected={day} onSelect={setSelected} />

            {isToday ? (
              <Tap
                onPress={() => router.push('/log')}
                scaleTo={0.98}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  height: 54,
                  paddingLeft: 18,
                  paddingRight: 8,
                  borderRadius: radius.pill,
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.borderStrong,
                }}
                accessibilityLabel="Tell Ritual what you did"
                accessibilityRole="button"
              >
                <Icon name="sparkle" size={18} color={t.scheme === 'dark' ? t.accent : t.accentInk} weight="fill" />
                <Text tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                  Tell Ritual what you did…
                </Text>
                <Tap
                  onPress={() => router.push({ pathname: '/log', params: { voice: '1' } })}
                  scaleTo={0.88}
                  haptics="medium"
                  accessibilityLabel="Log by voice"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: t.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="microphone" size={18} color={t.text} weight="fill" />
                </Tap>
              </Tap>
            ) : (
              <Tap
                onPress={() => setSelected(today)}
                style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', padding: 6 }}
              >
                <Icon name="arrow-left" size={16} color={t.text} />
                <Text variant="bodyStrong">Back to today</Text>
              </Tap>
            )}

            {upNext.length ? (
              <Section title={isToday ? 'Up next' : 'Not done'} action={<Count n={upNext.length} />}>
                <View>{upNext.map((i, idx) => row(i, idx, idx === upNext.length - 1))}</View>
              </Section>
            ) : null}

            {flexible.length ? (
              <Section title="This week" action={<Count n={flexible.length} />}>
                <View>{flexible.map((i, idx) => row(i, upNext.length + idx, idx === flexible.length - 1))}</View>
              </Section>
            ) : null}

            {bonus.length ? (
              <Section title="Bonus" action={<Count n={bonus.length} />}>
                <View>
                  {bonus.map((i, idx) => row(i, upNext.length + flexible.length + idx, idx === bonus.length - 1))}
                </View>
              </Section>
            ) : null}

            {finished.length ? (
              <Section
                title="Done"
                action={
                  <Tap
                    onPress={() => setShowDone(!showDone)}
                    hitSlop={10}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Count n={finished.length} />
                    <Icon name={showDone ? 'caret-up' : 'caret-down'} size={14} color={t.textMuted} />
                  </Tap>
                }
              >
                {showDone ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    {finished.map((i) => (
                      <DoneRow key={i.habit.id} habit={i.habit} entry={i.entry} day={day} onLongPress={setLogHabit} />
                    ))}
                  </Animated.View>
                ) : null}
              </Section>
            ) : null}

            {isToday ? (
              <Section title="Movement">
                <MoveCard />
              </Section>
            ) : null}

            {insight && isToday ? (
              <Animated.View entering={FadeInDown.delay(250).springify().damping(18)}>
                <Tap
                  onPress={() => router.push('/(tabs)/insights')}
                  scaleTo={0.99}
                  style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingTop: 4 }}
                >
                  <Icon
                    name={isIconName(insight.icon) ? insight.icon : 'sparkle'}
                    size={20}
                    color={t.scheme === 'dark' ? t.accent : t.accentInk}
                    weight="fill"
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{insight.title}</Text>
                    <Text variant="caption" tone="muted">
                      {insight.body}
                    </Text>
                  </View>
                </Tap>
              </Animated.View>
            ) : null}
          </>
        )}
      </Screen>
      <LogSheet habit={logHabit} day={day} onClose={() => setLogHabit(null)} />
    </>
  );
}

function Stat({
  icon,
  value,
  label,
  bold,
}: {
  icon: 'fire' | 'lightning' | 'medal';
  value: string;
  label: string;
  bold?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={14} color={t.text} weight="fill" />
      <Text variant="caption" weight="bold" tabular>
        {value}
      </Text>
      <Text variant="caption" tone={bold ? 'default' : 'muted'} weight={bold ? 'bold' : undefined} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Text variant="caption" weight="semibold" tone="muted" tabular>
      {n}
    </Text>
  );
}
