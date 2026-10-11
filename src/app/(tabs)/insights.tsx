import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { addDays, DayKey, fromDayKey, orderedWeekdays, WEEKDAY_SHORT } from '@/domain/dates';
import { localInsights, moodLinks, periodRate, weekdayRates } from '@/domain/insights';
import { useSnapshot, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { weeklyReview, WeeklyReview } from '@/features/ai/features';
import { aiConfigured, aiErrorMessage } from '@/features/ai/gemini';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { BarChart, Heatmap, Meter } from '@/ui/charts';
import { Pill } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { ProgressRing } from '@/ui/ProgressRing';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';

type Range = '7' | '30' | '365';

function Tile({ label, value, emoji, tint }: { label: string; value: string; emoji: string; tint?: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, gap: 4 }}>
      <Text size={18}>{emoji}</Text>
      <Text variant="number" size={24} color={tint}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" size={11}>
        {label}
      </Text>
    </Card>
  );
}

export default function InsightsScreen() {
  const t = useTheme();
  const snapshot = useSnapshot();
  const today = useToday();
  const weekStart = useApp((s) => s.settings.weekStart);
  const [range, setRange] = useState<Range>('30');
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const days = Number(range);
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);
  const rate = periodRate(snapshot, from, today);
  const prevRate = periodRate(snapshot, prevFrom, addDays(from, -1));

  const completions = useMemo(() => {
    let n = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) n += snapshot.days.get(d)?.done ?? 0;
    return n;
  }, [snapshot, from, today]);

  const perfect = useMemo(() => {
    let n = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) {
      const s = snapshot.days.get(d);
      if (s && s.due > 0 && s.done >= s.due) n++;
    }
    return n;
  }, [snapshot, from, today]);

  const bars = useMemo(() => {
    if (range === '7') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i - 6);
        return {
          label: fromDayKey(d).toLocaleDateString(undefined, { weekday: 'narrow' }),
          value: snapshot.days.get(d)?.done ?? 0,
          highlight: d === today,
        };
      });
    }
    if (range === '30') {
      // 6 buckets of 5 days
      return Array.from({ length: 6 }, (_, b) => {
        let v = 0;
        let last: DayKey = today;
        for (let i = 0; i < 5; i++) {
          const d = addDays(today, -29 + b * 5 + i);
          v += snapshot.days.get(d)?.done ?? 0;
          last = d;
        }
        return { label: `${fromDayKey(last).getDate()}`, value: v, highlight: b === 5 };
      });
    }
    const base = fromDayKey(today);
    return Array.from({ length: 12 }, (_, i) => {
      const m = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1);
      let v = 0;
      const daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysIn; d++) {
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        v += snapshot.days.get(key)?.done ?? 0;
      }
      return { label: m.toLocaleDateString(undefined, { month: 'narrow' }), value: v, highlight: i === 11 };
    });
  }, [range, snapshot, today]);

  const weekdays = useMemo(() => weekdayRates(snapshot), [snapshot]);
  const insights = useMemo(() => localInsights(snapshot), [snapshot]);
  const moods = useMemo(() => moodLinks(snapshot).slice(0, 3), [snapshot]);
  const habitRows = useMemo(
    () =>
      [...snapshot.habitStats.values()]
        .filter((s) => !s.habit.archived)
        .sort((a, b) => (b.rate30 ?? -1) - (a.rate30 ?? -1)),
    [snapshot],
  );

  if (snapshot.habitStats.size === 0) {
    return (
      <Screen title="Insights" bottomInset={110}>
        <EmptyState
          emoji="📊"
          title="Nothing to analyse yet"
          body="Add a habit and check in for a few days — patterns show up here."
          action="Add a habit"
          onAction={() => router.push('/habit/edit')}
        />
      </Screen>
    );
  }

  const delta = rate !== null && prevRate !== null ? Math.round((rate - prevRate) * 100) : null;

  const runReview = async () => {
    setReviewing(true);
    setReviewError(null);
    try {
      setReview(await weeklyReview(snapshot));
    } catch (e) {
      setReviewError(aiErrorMessage(e));
    }
    setReviewing(false);
  };

  return (
    <Screen title="Insights" bottomInset={110}>
      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '365', label: '12 months' },
        ]}
      />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 18, padding: 18 }}>
        <ProgressRing progress={rate ?? 0} size={96} stroke={10} color={t.accent} colorEnd="#FBBF24">
          <Text variant="number" size={24}>
            {rate === null ? '—' : `${Math.round(rate * 100)}%`}
          </Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">Consistency</Text>
          <Text variant="caption" tone="muted">
            Share of scheduled habits you completed in the last {range === '365' ? '12 months' : `${range} days`}.
          </Text>
          {delta !== null ? (
            <View style={{ flexDirection: 'row' }}>
              <Pill
                label={`${delta >= 0 ? '+' : ''}${delta} pts vs previous`}
                color={delta >= 0 ? t.success : t.danger}
                icon={delta >= 0 ? 'trending-up' : 'trending-down'}
              />
            </View>
          ) : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile emoji="✅" label="Check-ins" value={`${completions}`} />
        <Tile emoji="🌟" label="Perfect days" value={`${perfect}`} />
        <Tile emoji="⚡" label="XP this week" value={`${snapshot.weeklyXP}`} tint={t.xp} />
      </View>

      <Section title="Activity">
        <Card>
          <BarChart data={bars} height={110} formatValue={(v) => `${v}`} />
        </Card>
      </Section>

      <Section title="Your year">
        <Card style={{ gap: 10 }}>
          <Heatmap
            today={today}
            weeks={52}
            weekStart={weekStart}
            cell={12}
            value={(d) => {
              const s = snapshot.days.get(d);
              return s && s.due ? s.done / s.due : s && s.done ? 1 : null;
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <Text variant="caption" tone="faint" size={10}>
              Less
            </Text>
            {t.heat.map((c) => (
              <View key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
            ))}
            <Text variant="caption" tone="faint" size={10}>
              More
            </Text>
          </View>
        </Card>
      </Section>

      <Section title="AI weekly review">
        {review ? (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Card style={{ gap: 10, borderColor: alpha(t.xp, 0.4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="zap" size={16} color={t.xp} />
                <Text variant="subheading" style={{ flex: 1 }}>
                  {review.headline}
                </Text>
              </View>
              {review.wins.map((w) => (
                <Text key={w} variant="caption">
                  🏆 {w}
                </Text>
              ))}
              <Text variant="caption">
                🎯{' '}
                <Text variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Focus:
                </Text>{' '}
                {review.focus}
              </Text>
              <Text variant="caption">
                🧪{' '}
                <Text variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Try:
                </Text>{' '}
                {review.experiment}
              </Text>
            </Card>
          </Animated.View>
        ) : (
          <Card style={{ gap: 10 }}>
            <Text tone="muted">
              {aiConfigured
                ? 'Gemini reads your numbers and writes a short, honest review with one experiment for next week.'
                : 'Connect Firebase AI Logic to unlock AI reviews. Your on-device insights are below.'}
            </Text>
            {reviewError ? (
              <Text variant="caption" tone="danger">
                {reviewError}
              </Text>
            ) : null}
            {aiConfigured ? (
              <Button title="Generate my review" icon="zap" variant="xp" loading={reviewing} onPress={runReview} />
            ) : null}
          </Card>
        )}
      </Section>

      {insights.length ? (
        <Section title="Patterns">
          <View style={{ gap: 8 }}>
            {insights.map((i) => (
              <Card key={i.id} style={{ flexDirection: 'row', gap: 12 }}>
                <Text size={22}>{i.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" color={i.tone === 'warn' ? t.warning : undefined}>
                    {i.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {i.body}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="By weekday (last 12 weeks)">
        <Card>
          <BarChart
            height={80}
            color={t.xp}
            max={1}
            formatValue={(v) => `${Math.round(v * 100)}`}
            data={orderedWeekdays(weekStart).map((wd) => ({
              label: WEEKDAY_SHORT[wd].slice(0, 2),
              value: weekdays[wd] ?? 0,
              faded: weekdays[wd] === null,
            }))}
          />
        </Card>
      </Section>

      <Section title="Habits · last 30 days">
        <Card style={{ gap: 14 }}>
          {habitRows.map((s) => (
            <View key={s.habit.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <HabitIcon emoji={s.habit.emoji} color={s.habit.color} size={30} />
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {s.habit.name}
                </Text>
                <Text variant="caption" tone="muted">
                  🔥 {s.streak.current} · {s.rate30 === null ? '—' : `${Math.round(s.rate30 * 100)}%`}
                </Text>
              </View>
              <Meter ratio={s.rate30 ?? 0} color={s.habit.color} height={6} />
            </View>
          ))}
        </Card>
      </Section>

      {moods.length ? (
        <Section title="Mood links">
          <Card style={{ gap: 10 }}>
            {moods.map((m) => {
              const h = snapshot.habitStats.get(m.habitId)!.habit;
              const diff = m.withHabit - m.without;
              return (
                <View key={m.habitId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text size={18}>{h.emoji}</Text>
                  <Text variant="caption" style={{ flex: 1 }}>
                    Mood on {h.name} days:{' '}
                    <Text variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
                      {m.withHabit.toFixed(1)}
                    </Text>{' '}
                    vs {m.without.toFixed(1)}
                  </Text>
                  <Pill label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`} color={diff >= 0 ? t.success : t.danger} />
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
