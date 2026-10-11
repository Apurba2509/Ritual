import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { addDays, DayKey, fromDayKey, startOfWeek } from '@/domain/dates';
import { countDoneInWeek, isEntryDone } from '@/domain/habits';
import { localInsights } from '@/domain/insights';
import { rankForLevel } from '@/domain/xp';
import { useDayList, useSnapshot, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { HabitRow } from '@/features/habits/HabitRow';
import { greeting } from '@/features/habits/format';
import { LogSheet } from '@/features/habits/LogSheet';
import { runAutoTracking } from '@/features/integrations/engine';
import type { Habit } from '@/domain/types';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { ProgressRing } from '@/ui/ProgressRing';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, radius, useTheme } from '@/ui/theme';

function WeekStrip({ selected, onSelect }: { selected: DayKey; onSelect: (d: DayKey) => void }) {
  const t = useTheme();
  const today = useToday();
  const weekStart = useApp((s) => s.settings.weekStart);
  const snapshot = useSnapshot();
  const start = startOfWeek(today, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d) => {
        const future = d > today;
        const s = snapshot.days.get(d);
        const ratio = s && s.due ? Math.min(1, s.done / s.due) : 0;
        const isSel = d === selected;
        const date = fromDayKey(d);
        return (
          <Tap
            key={d}
            disabled={future}
            onPress={() => onSelect(d)}
            scaleTo={0.9}
            accessibilityLabel={date.toDateString()}
            style={{
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              width: 44,
              borderRadius: radius.md,
              backgroundColor: isSel ? t.surface2 : 'transparent',
              borderWidth: isSel ? 1 : 0,
              borderColor: t.border,
              opacity: future ? 0.35 : 1,
            }}
          >
            <Text
              variant="caption"
              size={11}
              tone={d === today ? 'accent' : 'faint'}
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
            <ProgressRing progress={future ? 0 : ratio} size={30} stroke={3} color={ratio >= 1 ? t.success : t.accent}>
              <Text
                variant="caption"
                size={11}
                tone={isSel ? 'default' : 'muted'}
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {date.getDate()}
              </Text>
            </ProgressRing>
          </Tap>
        );
      })}
    </View>
  );
}

export default function TodayScreen() {
  const t = useTheme();
  const today = useToday();
  // null = follow "today" (so the screen rolls over at midnight)
  const [picked, setPicked] = useState<DayKey | null>(null);
  const day = picked && picked < today ? picked : today;
  const setSelected = (d: DayKey) => setPicked(d === today ? null : d);
  const items = useDayList(day);
  const snapshot = useSnapshot();
  const profile = useApp((s) => s.profile);
  const weekStart = useApp((s) => s.settings.weekStart);
  const [logHabit, setLogHabit] = useState<Habit | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Same rules as the stats engine: flexible "N× a week" habits only count toward today once done.
  const isFlexible = (i: (typeof items)[number]) =>
    i.habit.schedule.type === 'weekly' && !isEntryDone(i.habit, i.entry);
  const due = items.filter((i) => i.due && !isFlexible(i));
  const flexible = items.filter((i) => i.due && isFlexible(i));
  const optional = items.filter((i) => !i.due);
  const doneCount = due.filter((i) => isEntryDone(i.habit, i.entry)).length;
  const ratio = due.length ? doneCount / due.length : 0;
  const allDone = due.length > 0 && doneCount === due.length;
  const insight = useMemo(() => localInsights(snapshot)[0], [snapshot]);
  const rank = rankForLevel(snapshot.level.level);
  const isToday = day === today;

  const onRefresh = async () => {
    setRefreshing(true);
    await runAutoTracking({ reason: 'manual', force: true }).catch(() => 0);
    setRefreshing(false);
  };

  const renderRow = (habit: Habit, entry: (typeof items)[number]['entry'], index: number) => {
    const stats = snapshot.habitStats.get(habit.id);
    const weekly =
      habit.schedule.type === 'weekly'
        ? { done: countDoneInWeek(habit, snapshot.index.get(habit.id), day, weekStart), target: habit.schedule.times }
        : undefined;
    return (
      <HabitRow
        key={habit.id}
        habit={habit}
        entry={entry}
        day={day}
        index={index}
        streak={stats?.streak.current ?? 0}
        streakUnit={stats?.streak.unit ?? 'day'}
        weekProgress={weekly}
        onLongPress={setLogHabit}
      />
    );
  };

  return (
    <>
      <Screen
        bottomInset={110}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              {fromDayKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text variant="title" size={27} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {greeting()}
              {profile.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}
            </Text>
          </View>
          <Tap onPress={() => router.push('/(tabs)/profile')} scaleTo={0.92} accessibilityLabel="Your profile">
            <ProgressRing progress={snapshot.level.ratio} size={50} stroke={3.5} color={t.xp} colorEnd={t.accent}>
              <Avatar
                emoji={profile.avatar.emoji}
                color={profile.avatar.color}
                photoUrl={profile.avatar.photoUrl}
                size={38}
              />
            </ProgressRing>
            <View
              style={{
                position: 'absolute',
                bottom: -4,
                alignSelf: 'center',
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: t.xp,
              }}
            >
              <Text variant="caption" size={10} color="#FFF" style={{ fontFamily: 'Inter_700Bold' }}>
                {snapshot.level.level}
              </Text>
            </View>
          </Tap>
        </View>

        <WeekStrip selected={day} onSelect={setSelected} />

        {items.length > 0 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 }}>
            <ProgressRing
              progress={ratio}
              size={86}
              stroke={9}
              color={allDone ? t.success : t.accent}
              colorEnd={allDone ? '#22D3EE' : '#FBBF24'}
            >
              <Text variant="number" size={22}>
                {Math.round(ratio * 100)}%
              </Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="heading">
                {allDone ? 'Perfect day 🌟' : due.length === 0 ? 'Nothing due' : `${doneCount} of ${due.length} done`}
              </Text>
              <Text variant="caption" tone="muted">
                {isToday
                  ? allDone
                    ? snapshot.perfectRun > 1
                      ? `${snapshot.perfectRun} perfect days in a row. Unreal.`
                      : 'Everything checked off. Enjoy the rest of your day.'
                    : `${due.length - doneCount} to go · ${snapshot.weeklyXP} XP this week`
                  : `Editing ${fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long' })} — tap Today to go back`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text size={13}>🔥</Text>
                  <Text variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {snapshot.bestStreak.days} best streak
                  </Text>
                </View>
                <Text variant="caption" tone="faint">
                  ·
                </Text>
                <Text variant="caption" color={rank.color} style={{ fontFamily: 'Inter_600SemiBold' }}>
                  {rank.emoji} {rank.title}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {isToday && items.length > 0 ? (
          <Tap
            onPress={() => router.push('/log')}
            scaleTo={0.98}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              height: 50,
              paddingHorizontal: 16,
              borderRadius: radius.pill,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: alpha(t.xp, 0.35),
            }}
            accessibilityLabel="Tell Ritual what you did"
            accessibilityRole="button"
          >
            <Icon name="message-circle" size={18} color={t.xp} />
            <Text tone="faint" style={{ flex: 1 }} numberOfLines={1}>
              Tell Ritual what you did…
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                height: 22,
                borderRadius: 11,
                backgroundColor: t.xpSoft,
                justifyContent: 'center',
              }}
            >
              <Text variant="caption" size={11} color={t.xp} style={{ fontFamily: 'Inter_600SemiBold' }}>
                AI
              </Text>
            </View>
          </Tap>
        ) : null}

        {!isToday ? (
          <Tap onPress={() => setSelected(today)} style={{ alignSelf: 'center' }}>
            <Text variant="bodyStrong" tone="accent">
              ← Back to today
            </Text>
          </Tap>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="Build your first ritual"
            body="Start tiny. One habit you can't fail beats five you'll skip. Or let the AI coach design a plan for your goal."
            action="Add a habit"
            onAction={() => router.push('/habit/edit')}
            secondary="Ask the AI coach"
            onSecondary={() => router.push('/coach')}
          />
        ) : (
          <Section title={due.length ? (isToday ? 'Today' : 'Due') : undefined}>
            <View style={{ gap: 10 }}>{due.map((i, idx) => renderRow(i.habit, i.entry, idx))}</View>
          </Section>
        )}

        {flexible.length > 0 ? (
          <Section title="This week · any day">
            <View style={{ gap: 10 }}>{flexible.map((i, idx) => renderRow(i.habit, i.entry, due.length + idx))}</View>
          </Section>
        ) : null}

        {optional.length > 0 ? (
          <Section title="Not scheduled · bonus">
            <View style={{ gap: 10, opacity: 0.85 }}>
              {optional.map((i, idx) => renderRow(i.habit, i.entry, due.length + flexible.length + idx))}
            </View>
          </Section>
        ) : null}

        {insight && isToday ? (
          <Animated.View entering={FadeIn.delay(300)}>
            <Card
              onPress={() => router.push('/(tabs)/insights')}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
            >
              <Text size={26}>{insight.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{insight.title}</Text>
                <Text variant="caption" tone="muted">
                  {insight.body}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={t.textFaint} />
            </Card>
          </Animated.View>
        ) : null}
      </Screen>
      <LogSheet habit={logHabit} day={day} onClose={() => setLogHabit(null)} />
    </>
  );
}
