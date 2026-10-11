import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TEMPLATE_BY_ID } from '@/domain/catalog';
import { scheduleLabel } from '@/domain/habits';
import { useHabitList } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { CoachHabit, coachPlan, CoachPlan } from '@/features/ai/features';
import { aiConfigured, aiErrorMessage } from '@/features/ai/gemini';
import { formatAmount } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { formatTime } from '@/features/habits/pickers';
import { rescheduleSoon, requestNotificationPermission } from '@/features/notifications/scheduler';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip, Pill } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';

const GOALS = [
  { emoji: '🏃', text: 'Run my first 10K in 3 months' },
  { emoji: '💼', text: 'Crack coding interviews by next semester' },
  { emoji: '😴', text: 'Fix my sleep and wake up with energy' },
  { emoji: '📚', text: 'Read 24 books this year' },
  { emoji: '🧘', text: 'Feel less anxious and more focused' },
  { emoji: '💪', text: 'Build muscle and eat better' },
];

/** Offline fallback: curated bundles keyed by goal words. */
function localPlan(goal: string): CoachPlan {
  const g = goal.toLowerCase();
  const pick = (ids: string[]) =>
    ids
      .map((id) => TEMPLATE_BY_ID.get(id)!)
      .map<CoachHabit>((tpl) => ({
        name: tpl.name,
        emoji: tpl.emoji,
        kind: tpl.kind,
        target: tpl.target,
        unit: tpl.unit,
        schedule: tpl.schedule,
        difficulty: tpl.difficulty,
        reminder: '09:00',
        why: 'A proven starter habit for this goal.',
        color: tpl.color,
      }));
  if (/run|10k|marathon|fit|cardio|weight|muscle|gym/.test(g))
    return {
      title: 'Fitness foundation',
      summary: 'Move daily, train consistently, recover well.',
      habits: pick(['steps', 'workout', 'sleep', 'water']),
      tips: ['Lay out your gear the night before.'],
    };
  if (/code|interview|leetcode|dsa|developer|program/.test(g))
    return {
      title: 'Interview-ready',
      summary: 'Daily reps on problems plus shipping code builds the muscle.',
      habits: pick(['leetcode', 'code', 'deep_work']),
      tips: ['Solve, then explain the solution out loud.'],
    };
  if (/sleep|tired|energy|wake/.test(g))
    return {
      title: 'Sleep reset',
      summary: 'Protect your mornings and wind down earlier.',
      habits: pick(['sleep', 'no_phone', 'stretch']),
      tips: ['Same wake-up time, even on weekends.'],
    };
  if (/read|book/.test(g))
    return {
      title: 'Reader mode',
      summary: 'Small daily pages add up to dozens of books.',
      habits: pick(['read', 'journal']),
      tips: ['Keep the book where your phone usually is.'],
    };
  return {
    title: 'Calm & focused',
    summary: 'Start with your mind; everything else gets easier.',
    habits: pick(['meditate', 'journal', 'gratitude', 'deep_work']),
    tips: ['Attach new habits to something you already do.'],
  };
}

export default function CoachScreen() {
  const t = useTheme();
  const existing = useHabitList();
  const profile = useApp((s) => s.profile);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [engine, setEngine] = useState<'ai' | 'local'>('ai');

  const generate = async (g = goal) => {
    if (!g.trim()) return;
    setGoal(g);
    setBusy(true);
    setPlan(null);
    try {
      if (!aiConfigured) throw new Error('offline');
      const p = await coachPlan(g, { existing, name: profile.displayName });
      setPlan(p);
      setEngine('ai');
      setPicked(new Set(p.habits.map((_, i) => i)));
    } catch (e) {
      if (aiConfigured) toast(aiErrorMessage(e), { tone: 'error' });
      const p = localPlan(g);
      setPlan(p);
      setEngine('local');
      setPicked(new Set(p.habits.map((_, i) => i)));
    }
    setBusy(false);
  };

  const add = async () => {
    if (!plan) return;
    const app = useApp.getState();
    let n = 0;
    plan.habits.forEach((h, i) => {
      if (!picked.has(i)) return;
      app.createHabit({
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        kind: h.kind,
        target: h.target,
        unit: h.unit,
        schedule: h.schedule,
        reminders: h.reminder ? [h.reminder] : [],
        auto: null,
        category: null,
        difficulty: h.difficulty,
        intention: h.why,
        challengeId: null,
      });
      n++;
    });
    await requestNotificationPermission();
    rescheduleSoon(300);
    toast(`${n} habit${n > 1 ? 's' : ''} added to your ritual`, { emoji: '🧭', tone: 'success' });
    router.back();
  };

  return (
    <Screen back="close" title="AI coach">
      <Text tone="muted">
        Describe a goal. The coach designs a few small, specific habits that compound toward it — grounded in behaviour
        science.
      </Text>

      <TextField
        value={goal}
        onChangeText={setGoal}
        placeholder="I want to…"
        multiline
        maxLength={300}
        icon="compass"
      />
      <Button
        title={busy ? 'Designing your plan…' : 'Build my plan'}
        icon="zap"
        variant="xp"
        size="lg"
        full
        loading={busy}
        disabled={!goal.trim()}
        onPress={() => generate()}
      />

      {!plan && !busy ? (
        <Section title="Or start from a goal">
          <View style={{ gap: 8 }}>
            {GOALS.map((g) => (
              <Card
                key={g.text}
                onPress={() => generate(g.text)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
              >
                <Text size={22}>{g.emoji}</Text>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {g.text}
                </Text>
                <Icon name="arrow-right" size={16} color={t.textFaint} />
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      {plan ? (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="heading" style={{ flex: 1 }}>
              {plan.title}
            </Text>
            <Pill
              label={engine === 'ai' ? 'Gemini' : 'Curated'}
              color={engine === 'ai' ? t.xp : t.textMuted}
              icon={engine === 'ai' ? 'zap' : 'book'}
            />
          </View>
          <Text tone="muted">{plan.summary}</Text>
          {plan.habits.map((h, i) => {
            const on = picked.has(i);
            return (
              <Tap
                key={`${h.name}-${i}`}
                onPress={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                scaleTo={0.98}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 14,
                  borderRadius: 20,
                  backgroundColor: t.surface,
                  borderWidth: 1.5,
                  borderColor: on ? h.color : t.border,
                  opacity: on ? 1 : 0.6,
                }}
              >
                <HabitIcon emoji={h.emoji} color={h.color} size={44} filled={on} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="subheading">{h.name}</Text>
                  <Text variant="caption" tone="muted">
                    {h.kind === 'check' ? 'Yes/No' : formatAmount(h, h.target)} · {scheduleLabel(h.schedule)}
                    {h.reminder ? ` · ⏰ ${formatTime(h.reminder)}` : ''}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {h.why}
                  </Text>
                </View>
                <Icon name={on ? 'check-circle' : 'circle'} size={22} color={on ? h.color : t.textFaint} />
              </Tap>
            );
          })}
          {plan.tips.length ? (
            <Card tone="raised" style={{ gap: 6 }}>
              <Text variant="label" tone="muted">
                Coach tips
              </Text>
              {plan.tips.map((tip) => (
                <Text key={tip} variant="caption">
                  • {tip}
                </Text>
              ))}
            </Card>
          ) : null}
          <Button
            title={`Add ${picked.size} habit${picked.size === 1 ? '' : 's'}`}
            icon="plus"
            size="lg"
            full
            disabled={!picked.size}
            onPress={add}
          />
          <Button title="Try a different plan" variant="ghost" icon="refresh-cw" onPress={() => generate()} />
        </Animated.View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {!aiConfigured ? <Chip label="AI not configured · using curated plans" size="sm" icon="info" /> : null}
      </View>
    </Screen>
  );
}
