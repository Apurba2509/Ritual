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
import { BarChart, Heatmap, Meter, Sparkline } from '@/ui/charts';
import { Pill } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Icon, IconName, isIconName } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { useFrameWidth } from '@/ui/layout';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { tint, useTheme } from '@/ui/theme';

type Range = '7' | '30' | '365';

function Stat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        gap: 4,
        paddingHorizontal: 14,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: t.border,
      }}
    >
      <Text weight="bold" size={26} tabular>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function ReviewLine({ icon, label, text }: { icon: IconName; label?: string; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 2 }}>
        <Icon name={icon} size={16} color={t.accentInk} weight="fill" />
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {label ? <Text variant="bodyStrong">{label} </Text> : null}
        {text}
      </Text>
    </View>
  );
}

export default function InsightsScreen() {
  const t = useTheme();
  const width = useFrameWidth();
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

  // Daily completion for the trend line (weekly averages for the 12-month view).
  const trend = useMemo(() => {
    const ratio = (d: DayKey) => {
      const s = snapshot.days.get(d);
      return s && s.due ? Math.min(1, s.done / s.due) : null;
    };
    if (range !== '365') return Array.from({ length: days }, (_, i) => ratio(addDays(today, i - days + 1)));
    return Array.from({ length: 52 }, (_, w) => {
      const vals = Array.from({ length: 7 }, (_, i) => ratio(addDays(today, (w - 51) * 7 + i - 6))).filter(
        (v): v is number => v !== null,
      );
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
  }, [range, days, snapshot, today]);

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
          icon="chart-line-up"
          title="Nothing to analyse yet"
          body="Add a habit and check in for a few days. Patterns show up here."
          action="Add a habit"
          onAction={() => router.push('/habit/edit')}
        />
      </Screen>
    );
  }

  const delta = rate !== null && prevRate !== null ? Math.round((rate - prevRate) * 100) : null;
  const rangeLabel = range === '365' ? '12 months' : `${range} days`;

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

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text variant="caption" weight="semibold" tone="muted">
              Consistency · {rangeLabel}
            </Text>
            <Text weight="heavy" size={72} tabular style={{ lineHeight: 76, letterSpacing: -3.4 }}>
              {rate === null ? '—' : Math.round(rate * 100)}
              <Text weight="heavy" size={34} tone="faint">
                %
              </Text>
            </Text>
          </View>
          {delta !== null ? (
            <View style={{ marginBottom: 14 }}>
              <Pill
                label={`${delta >= 0 ? '+' : ''}${delta} pts vs before`}
                color={delta >= 0 ? t.accentInk : t.danger}
                icon={delta >= 0 ? 'trend-up' : 'trend-down'}
              />
            </View>
          ) : null}
        </View>
        <Sparkline values={trend} width={width - 40} height={72} />
      </View>

      <Card padded={false} style={{ flexDirection: 'row', paddingVertical: 16 }}>
        <Stat label="Check-ins" value={`${completions}`} />
        <Stat label="Perfect days" value={`${perfect}`} />
        <Stat label="XP this week" value={`${snapshot.weeklyXP}`} last />
      </Card>

      <Section title="Activity">
        <Card>
          <BarChart data={bars} height={120} formatValue={(v) => `${v}`} />
        </Card>
      </Section>

      <Section title="Your year">
        <Card style={{ gap: 12 }}>
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
            <Text variant="small" tone="faint" size={10}>
              Less
            </Text>
            {t.heat.map((c) => (
              <View key={c} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
            ))}
            <Text variant="small" tone="faint" size={10}>
              More
            </Text>
          </View>
        </Card>
      </Section>

      <Section title="AI weekly review">
        {review ? (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkle" size={18} color={t.accentInk} weight="fill" />
                <Text variant="label" tone="muted">
                  This week
                </Text>
              </View>
              <Text variant="heading">{review.headline}</Text>
              <View style={{ gap: 10 }}>
                {review.wins.map((w) => (
                  <ReviewLine key={w} icon="trophy" text={w} />
                ))}
                <ReviewLine icon="target" label="Focus:" text={review.focus} />
                <ReviewLine icon="flask" label="Try:" text={review.experiment} />
              </View>
              <Button
                title="Regenerate"
                icon="arrows-clockwise"
                variant="ghost"
                size="sm"
                onPress={runReview}
                loading={reviewing}
                style={{ alignSelf: 'flex-start', marginLeft: -12 }}
              />
            </Card>
          </Animated.View>
        ) : (
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="sparkle" size={22} color={t.accentInk} weight="fill" />
              </View>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {aiConfigured
                  ? 'Gemini reads your numbers and writes a short, honest review with one experiment for next week.'
                  : 'AI reviews need Firebase AI Logic. Your on-device patterns are below.'}
              </Text>
            </View>
            {reviewError ? (
              <Text variant="caption" tone="danger">
                {reviewError}
              </Text>
            ) : null}
            {aiConfigured ? (
              <Button title="Write my review" icon="sparkle" loading={reviewing} onPress={runReview} full />
            ) : null}
          </Card>
        )}
      </Section>

      {insights.length ? (
        <Section title="Patterns">
          <View style={{ gap: 8 }}>
            {insights.map((i) => (
              <Card key={i.id} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: i.tone === 'warn' ? `${t.warning}22` : t.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={isIconName(i.icon) ? i.icon : 'sparkle'}
                    size={20}
                    color={i.tone === 'warn' ? t.warning : t.text}
                    weight="duotone"
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{i.title}</Text>
                  <Text variant="caption" tone="muted">
                    {i.body}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="By weekday · last 12 weeks">
        <Card>
          <BarChart
            height={90}
            max={1}
            formatValue={(v) => `${Math.round(v * 100)}`}
            data={orderedWeekdays(weekStart).map((wd) => ({
              label: WEEKDAY_SHORT[wd].slice(0, 2),
              value: weekdays[wd] ?? 0,
              faded: weekdays[wd] === null,
              highlight: weekdays[wd] !== null && weekdays[wd] === Math.max(...weekdays.map((w) => w ?? 0)),
            }))}
          />
        </Card>
      </Section>

      <Section title="Habits · last 30 days">
        <Card style={{ gap: 16 }}>
          {habitRows.map((s) => (
            <View key={s.habit.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <HabitIcon icon={s.habit.icon} color={s.habit.color} size={32} />
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {s.habit.name}
                </Text>
                {s.streak.current > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Icon name="fire" size={12} color={t.accentInk} weight="fill" />
                    <Text variant="caption" weight="bold" tabular>
                      {s.streak.current}
                    </Text>
                  </View>
                ) : null}
                <Text
                  variant="caption"
                  weight="semibold"
                  tone="muted"
                  tabular
                  style={{ width: 40, textAlign: 'right' }}
                >
                  {s.rate30 === null ? '—' : `${Math.round(s.rate30 * 100)}%`}
                </Text>
              </View>
              <Meter ratio={s.rate30 ?? 0} color={tint(s.habit.color, t)} height={6} />
            </View>
          ))}
        </Card>
      </Section>

      {moods.length ? (
        <Section title="Mood links">
          <Card style={{ gap: 14 }}>
            {moods.map((m) => {
              const h = snapshot.habitStats.get(m.habitId)!.habit;
              const diff = m.withHabit - m.without;
              return (
                <View key={m.habitId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <HabitIcon icon={h.icon} color={h.color} size={32} />
                  <Text variant="caption" style={{ flex: 1 }}>
                    Mood on {h.name} days:{' '}
                    <Text variant="caption" weight="bold">
                      {m.withHabit.toFixed(1)}
                    </Text>{' '}
                    vs {m.without.toFixed(1)}
                  </Text>
                  <Pill
                    label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`}
                    color={diff >= 0 ? t.accentInk : t.danger}
                  />
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
