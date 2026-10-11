import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CATEGORY_BY_ID } from '@/domain/catalog';
import { addDays, DayKey, fromDayKey, orderedWeekdays, toDayKey, WEEKDAY_LETTER } from '@/domain/dates';
import { isEntryDone, isEntrySkipped, isScheduledOn, progressOf, scheduleLabel, targetLabel } from '@/domain/habits';
import type { Habit } from '@/domain/types';
import { nextMilestone } from '@/domain/xp';
import { useHabit, useSnapshot, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { toggleHabit } from '@/features/habits/actions';
import { autoIcon, autoLabel, formatAmount, MOODS, timeAgo } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { LogSheet } from '@/features/habits/LogSheet';
import { syncHabitNow } from '@/features/integrations/engine';
import { thumb } from '@/lib/cloudinary';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Heatmap } from '@/ui/charts';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { ProgressRing } from '@/ui/ProgressRing';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Text weight="bold" size={20} tabular style={{ letterSpacing: -0.6 }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function MonthCalendar({ habit, onPick }: { habit: Habit; onPick: (d: DayKey) => void }) {
  const t = useTheme();
  const today = useToday();
  const weekStart = useApp((s) => s.settings.weekStart);
  const snapshot = useSnapshot();
  const byDay = snapshot.index.get(habit.id);
  const [offset, setOffset] = useState(0);
  const base = fromDayKey(today);
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const first = toDayKey(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() - weekStart + 7) % 7;
  const cells: (DayKey | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const D = 36;

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="subheading" style={{ flex: 1 }}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <IconButton
          name="caret-left"
          size={34}
          accessibilityLabel="Previous month"
          onPress={() => setOffset(offset - 1)}
        />
        <IconButton
          name="caret-right"
          size={34}
          accessibilityLabel="Next month"
          onPress={() => offset < 0 && setOffset(offset + 1)}
          tint={offset < 0 ? t.text : t.textFaint}
        />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {orderedWeekdays(weekStart).map((d) => (
          <Text key={d} variant="small" tone="faint" align="center" style={{ flex: 1 }}>
            {WEEKDAY_LETTER[d]}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
          const entry = byDay?.get(d);
          const done = isEntryDone(habit, entry);
          const skipped = isEntrySkipped(entry);
          const partial = !done && progressOf(habit, entry) > 0;
          const scheduled = isScheduledOn(habit.schedule, d);
          const future = d > today;
          return (
            <View key={d} style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Tap
                disabled={future}
                onPress={() => onPick(d)}
                scaleTo={0.85}
                accessibilityLabel={fromDayKey(d).toDateString()}
                style={{
                  width: D,
                  height: D,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: future ? 0.3 : 1,
                }}
              >
                {done || partial || d === today ? (
                  <Svg width={D} height={D} style={{ position: 'absolute' }}>
                    <Circle
                      cx={D / 2}
                      cy={D / 2}
                      r={done ? D / 2 : D / 2 - 1}
                      fill={done ? t.accent : partial ? t.accentSoft : 'none'}
                      stroke={d === today && !done ? t.text : 'none'}
                      strokeWidth={1.5}
                    />
                  </Svg>
                ) : null}
                {skipped ? (
                  <Icon name="moon" size={14} color={t.textFaint} />
                ) : (
                  <Text
                    variant="caption"
                    weight={done ? 'bold' : 'medium'}
                    tabular
                    color={done ? t.onAccent : scheduled ? t.text : t.textFaint}
                  >
                    {fromDayKey(d).getDate()}
                  </Text>
                )}
              </Tap>
            </View>
          );
        })}
      </View>
      <Text variant="caption" tone="faint" align="center">
        Tap any past day to fix your history
      </Text>
    </Card>
  );
}

export default function HabitDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabit(id);
  const snapshot = useSnapshot();
  const today = useToday();
  const weekStart = useApp((s) => s.settings.weekStart);
  const integrations = useApp((s) => s.integrations);
  const [logDay, setLogDay] = useState<DayKey | null>(null);
  const [syncing, setSyncing] = useState(false);

  const stats = habit ? snapshot.habitStats.get(habit.id) : undefined;
  const byDay = habit ? snapshot.index.get(habit.id) : undefined;

  const journal = useMemo(
    () =>
      byDay
        ? [...byDay.values()]
            .filter((e) => e.note || e.mood || e.photoUrl)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 12)
        : [],
    [byDay],
  );

  if (!habit || habit.deleted || !stats) {
    return (
      <Screen back>
        <EmptyState
          icon="magnifying-glass"
          title="Habit not found"
          body="It may have been deleted on another device."
        />
      </Screen>
    );
  }

  const unit = stats.streak.unit;
  const next = nextMilestone(unit, stats.streak.current);
  const category = habit.category ? CATEGORY_BY_ID.get(habit.category) : null;
  const auto = autoLabel(habit.auto);
  const sourceIcon = autoIcon(habit.auto);
  const todayEntry = byDay?.get(today);
  const doneToday = isEntryDone(habit, todayEntry);
  const providerState =
    habit.auto?.provider === 'github'
      ? integrations.github
      : habit.auto?.provider === 'leetcode'
        ? integrations.leetcode
        : habit.auto?.provider === 'health'
          ? integrations.health
          : null;

  const syncNow = async () => {
    setSyncing(true);
    try {
      const n = await syncHabitNow(habit);
      toast(n ? `Updated ${n} day${n > 1 ? 's' : ''}` : 'Already up to date', { icon: 'lightning', tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sync failed', { tone: 'error' });
    }
    setSyncing(false);
  };

  const meta = [scheduleLabel(habit.schedule), habit.kind === 'check' ? null : targetLabel(habit), category?.name]
    .filter(Boolean)
    .join(' · ');

  const footer = habit.archived ? undefined : habit.kind === 'duration' && !doneToday ? (
    <Button title="Start focus session" icon="play" size="lg" full onPress={() => router.push(`/focus/${habit.id}`)} />
  ) : habit.kind === 'check' ? (
    <Button
      title={doneToday ? 'Done for today' : 'Mark done for today'}
      icon={doneToday ? 'check-circle' : 'check'}
      variant={doneToday ? 'secondary' : 'primary'}
      size="lg"
      full
      onPress={() => toggleHabit(habit.id, today)}
    />
  ) : (
    <Button
      title={doneToday ? 'Done · log more' : 'Log progress'}
      icon="plus"
      variant={doneToday ? 'secondary' : 'primary'}
      size="lg"
      full
      onPress={() => setLogDay(today)}
    />
  );

  return (
    <>
      <Screen
        back
        footer={footer}
        right={
          <IconButton
            name="pencil-simple"
            accessibilityLabel="Edit habit"
            onPress={() => router.push({ pathname: '/habit/edit', params: { id: habit.id } })}
          />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}>
          <HabitIcon icon={habit.icon} color={habit.color} size={58} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" numberOfLines={2}>
              {habit.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {habit.archived ? 'Archived · ' : ''}
              {meta}
            </Text>
          </View>
        </View>

        {habit.intention ? (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 2 }}>
            <Icon name="quotes" size={18} color={t.textFaint} weight="fill" />
            <Text tone="muted" style={{ flex: 1, fontStyle: 'italic' }}>
              {habit.intention}
            </Text>
          </View>
        ) : null}

        {/* Hero: the streak, wrapped in progress toward the next milestone */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 6 }}>
          <ProgressRing progress={next ? stats.streak.current / next : 1} size={148} stroke={10}>
            <View style={{ alignItems: 'center' }}>
              <Text weight="heavy" size={stats.streak.current >= 100 ? 44 : 54} tabular style={{ letterSpacing: -2.5 }}>
                {stats.streak.current}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: -2 }}>
                <Icon name="fire" size={12} color={t.text} weight="fill" />
                <Text variant="caption" weight="semibold" tone="muted">
                  {unit} streak
                </Text>
              </View>
            </View>
          </ProgressRing>
          <View style={{ flex: 1, gap: 14 }}>
            <MiniStat
              label="Best streak"
              value={`${stats.streak.longest} ${unit}${stats.streak.longest === 1 ? '' : 's'}`}
            />
            <MiniStat label="Last 30 days" value={stats.rate30 === null ? '—' : `${Math.round(stats.rate30 * 100)}%`} />
            <MiniStat label="Times done" value={`${stats.totalDone}`} />
          </View>
        </View>
        {next ? (
          <Text variant="caption" tone="muted">
            {next - stats.streak.current} {unit}
            {next - stats.streak.current === 1 ? '' : 's'} to your {next}-{unit} milestone · bonus XP waiting
          </Text>
        ) : null}

        {habit.auto ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={sourceIcon ?? 'lightning'} size={20} color={t.text} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Auto-tracked · {auto}</Text>
              <Text variant="caption" tone={providerState?.error ? 'danger' : 'muted'} numberOfLines={2}>
                {providerState?.error
                  ? providerState.error
                  : habit.auto.provider === 'github' || habit.auto.provider === 'leetcode'
                    ? `@${habit.auto.username} · ${providerState?.lastSyncAt ? `synced ${timeAgo(providerState.lastSyncAt)}` : 'not synced yet'}`
                    : habit.auto.provider === 'device'
                      ? 'Counted by your phone, even with Ritual closed'
                      : providerState?.lastSyncAt
                        ? `Health Connect · synced ${timeAgo(providerState.lastSyncAt)}`
                        : 'Health Connect'}
              </Text>
            </View>
            <Button
              title="Sync"
              size="sm"
              variant="secondary"
              icon="arrows-clockwise"
              loading={syncing}
              onPress={syncNow}
            />
          </Card>
        ) : null}

        <Section title="Last 6 months">
          <Card>
            <Heatmap
              today={today}
              weeks={26}
              weekStart={weekStart}
              value={(d) => {
                const e = byDay?.get(d);
                if (isEntryDone(habit, e)) return 1;
                const p = progressOf(habit, e);
                return p > 0 ? p * 0.6 : null;
              }}
            />
          </Card>
        </Section>

        <Section title="History">
          <MonthCalendar habit={habit} onPick={setLogDay} />
        </Section>

        <Section title="Journal">
          {journal.length ? (
            <View style={{ gap: 8 }}>
              {journal.map((e) => {
                const mood = e.mood ? MOODS[e.mood - 1] : null;
                return (
                  <Card
                    key={e.id}
                    onPress={() => setLogDay(e.date)}
                    style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: t.surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={mood?.icon ?? 'quotes'} size={20} color={t.text} weight={mood ? 'duotone' : 'fill'} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption" tone="muted">
                        {fromDayKey(e.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {habit.kind !== 'check' ? ` · ${formatAmount(habit, e.value)}` : ''}
                      </Text>
                      {e.note ? (
                        <Text>{e.note}</Text>
                      ) : mood ? (
                        <Text tone="muted">Feeling {mood.label.toLowerCase()}</Text>
                      ) : null}
                    </View>
                    {e.photoUrl ? (
                      <Image
                        source={{ uri: thumb(e.photoUrl, 160) }}
                        style={{ width: 52, height: 52, borderRadius: radius.sm }}
                        contentFit="cover"
                      />
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card tone="outline" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Icon name="pencil-line" size={20} color={t.textMuted} />
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                Long-press this habit on Today, or tap a day above, to add notes, moods and photos.
              </Text>
            </Card>
          )}
        </Section>

        <Text variant="caption" tone="faint" align="center">
          Started{' '}
          {new Date(habit.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </Screen>
      <LogSheet habit={logDay ? habit : null} day={logDay ?? today} onClose={() => setLogDay(null)} />
    </>
  );
}
