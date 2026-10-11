import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CATEGORY_BY_ID } from '@/domain/catalog';
import { addDays, DayKey, fromDayKey, orderedWeekdays, toDayKey, WEEKDAY_LETTER } from '@/domain/dates';
import { isEntryDone, isEntrySkipped, isScheduledOn, progressOf, scheduleLabel, targetLabel } from '@/domain/habits';
import { nextMilestone } from '@/domain/xp';
import type { Habit } from '@/domain/types';
import { useHabit, useSnapshot, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { autoLabel, formatAmount, MOODS, timeAgo } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { LogSheet } from '@/features/habits/LogSheet';
import { syncHabitNow } from '@/features/integrations/engine';
import { thumb } from '@/lib/cloudinary';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Heatmap, Meter } from '@/ui/charts';
import { Pill } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, radius, useTheme } from '@/ui/theme';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, gap: 2, alignItems: 'center' }}>
      <Text variant="number" size={22} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="label" tone="muted" size={9} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text variant="caption" tone="faint" size={10} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
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

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="subheading" style={{ flex: 1 }}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <IconButton
          name="chevron-left"
          size={34}
          accessibilityLabel="Previous month"
          onPress={() => setOffset(offset - 1)}
        />
        <View style={{ width: 8 }} />
        <IconButton
          name="chevron-right"
          size={34}
          accessibilityLabel="Next month"
          onPress={() => offset < 0 && setOffset(offset + 1)}
        />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {orderedWeekdays(weekStart).map((d) => (
          <Text key={d} variant="caption" tone="faint" align="center" style={{ flex: 1 }} size={11}>
            {WEEKDAY_LETTER[d]}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const entry = byDay?.get(d);
          const done = isEntryDone(habit, entry);
          const skipped = isEntrySkipped(entry);
          const partial = !done && progressOf(habit, entry) > 0;
          const scheduled = isScheduledOn(habit.schedule, d);
          const future = d > today;
          return (
            <View key={d} style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <Tap
                disabled={future}
                onPress={() => onPick(d)}
                scaleTo={0.85}
                accessibilityLabel={fromDayKey(d).toDateString()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? habit.color : partial ? alpha(habit.color, 0.25) : 'transparent',
                  borderWidth: d === today ? 1.5 : 0,
                  borderColor: t.text,
                  opacity: future ? 0.3 : 1,
                }}
              >
                {skipped ? (
                  <Icon name="moon" size={14} color={t.textFaint} />
                ) : (
                  <Text
                    variant="caption"
                    color={done ? '#FFF' : scheduled ? t.text : t.textFaint}
                    style={{ fontFamily: done ? 'Inter_700Bold' : 'Inter_500Medium' }}
                  >
                    {fromDayKey(d).getDate()}
                  </Text>
                )}
              </Tap>
            </View>
          );
        })}
      </View>
      <Text variant="caption" tone="faint" align="center" size={11}>
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
        <EmptyState emoji="🫥" title="Habit not found" body="It may have been deleted on another device." />
      </Screen>
    );
  }

  const unit = stats.streak.unit;
  const next = nextMilestone(unit, stats.streak.current);
  const category = habit.category ? CATEGORY_BY_ID.get(habit.category) : null;
  const auto = autoLabel(habit.auto);
  const providerState =
    habit.auto?.provider === 'github'
      ? integrations.github
      : habit.auto?.provider === 'leetcode'
        ? integrations.leetcode
        : habit.auto
          ? integrations.health
          : null;

  const syncNow = async () => {
    setSyncing(true);
    try {
      const n = await syncHabitNow(habit);
      toast(n ? `Updated ${n} day${n > 1 ? 's' : ''}` : 'Already up to date', { emoji: '⚡', tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sync failed', { tone: 'error' });
    }
    setSyncing(false);
  };

  return (
    <>
      <Screen
        back
        right={
          <IconButton
            name="edit-2"
            accessibilityLabel="Edit habit"
            onPress={() => router.push({ pathname: '/habit/edit', params: { id: habit.id } })}
          />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <HabitIcon emoji={habit.emoji} color={habit.color} size={64} filled />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" numberOfLines={2}>
              {habit.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Pill label={scheduleLabel(habit.schedule)} color={habit.color} icon="calendar" />
              <Pill
                label={habit.kind === 'check' ? 'Yes / No' : targetLabel(habit)}
                color={habit.color}
                icon="target"
              />
              {category ? <Pill label={`${category.emoji} ${category.name}`} color={category.color} /> : null}
              {habit.archived ? <Pill label="Archived" icon="archive" /> : null}
            </View>
          </View>
        </View>

        {habit.intention ? (
          <Card tone="raised" style={{ flexDirection: 'row', gap: 10 }}>
            <Text size={18}>💭</Text>
            <Text tone="muted" style={{ flex: 1, fontStyle: 'italic' }}>
              {habit.intention}
            </Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Streak" value={`${stats.streak.current}🔥`} sub={`${unit}s`} />
          <Stat label="Best" value={`${stats.streak.longest}`} sub={`${unit}s`} />
          <Stat label="Rate" value={stats.rate30 === null ? '—' : `${Math.round(stats.rate30 * 100)}%`} sub="30 days" />
          <Stat label="Done" value={`${stats.totalDone}`} sub={`${stats.xp} XP`} />
        </View>

        {next ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">
                Next milestone: {next} {unit}s
              </Text>
              <Text variant="caption" tone="muted">
                {next - stats.streak.current} to go
              </Text>
            </View>
            <Meter ratio={stats.streak.current / next} color={habit.color} />
          </Card>
        ) : null}

        {habit.kind === 'duration' && !habit.archived ? (
          <Button
            title="Start focus session"
            icon="play"
            size="lg"
            full
            onPress={() => router.push(`/focus/${habit.id}`)}
          />
        ) : (
          <Button title="Log today" icon="edit-3" variant="secondary" full onPress={() => setLogDay(today)} />
        )}

        {habit.auto ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: alpha(t.xp, 0.35) }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: t.xpSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="zap" size={18} color={t.xp} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Auto-tracked · {auto}</Text>
              <Text variant="caption" tone={providerState?.error ? 'danger' : 'muted'} numberOfLines={2}>
                {providerState?.error
                  ? providerState.error
                  : habit.auto.provider !== 'health'
                    ? `@${habit.auto.username} · ${providerState?.lastSyncAt ? `synced ${timeAgo(providerState.lastSyncAt)}` : 'not synced yet'}`
                    : providerState?.lastSyncAt
                      ? `Health Connect · synced ${timeAgo(providerState.lastSyncAt)}`
                      : 'Health Connect'}
              </Text>
            </View>
            <Button title="Sync" size="sm" variant="secondary" loading={syncing} onPress={syncNow} />
          </Card>
        ) : null}

        <Section title="Last 6 months">
          <Card>
            <Heatmap
              today={today}
              weeks={26}
              weekStart={weekStart}
              color={habit.color}
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
              {journal.map((e) => (
                <Card key={e.id} onPress={() => setLogDay(e.date)} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text size={22}>{e.mood ? MOODS[e.mood - 1].emoji : '📝'}</Text>
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
                    ) : e.mood ? (
                      <Text tone="faint">Feeling {MOODS[e.mood - 1].label.toLowerCase()}</Text>
                    ) : null}
                  </View>
                  {e.photoUrl ? (
                    <Image
                      source={{ uri: thumb(e.photoUrl, 160) }}
                      style={{ width: 56, height: 56, borderRadius: radius.sm }}
                      contentFit="cover"
                    />
                  ) : null}
                </Card>
              ))}
            </View>
          ) : (
            <Card tone="outline">
              <Text tone="muted" align="center">
                Long-press a habit on Today (or tap a day above) to add notes, moods and photos. Ritual finds patterns
                in them.
              </Text>
            </Card>
          )}
        </Section>

        <View style={{ borderRadius: radius.md, gap: 4 }}>
          <Text variant="caption" tone="faint" align="center">
            Created{' '}
            {new Date(habit.createdAt).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      </Screen>
      <LogSheet habit={logDay ? habit : null} day={logDay ?? today} onClose={() => setLogDay(null)} />
    </>
  );
}
