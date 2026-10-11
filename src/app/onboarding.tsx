import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, HabitTemplate, TEMPLATES } from '@/domain/catalog';
import { scheduleLabel } from '@/domain/habits';
import type { CategoryId } from '@/domain/types';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { useUI } from '@/data/ui';
import { formatAmount } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { healthSupported } from '@/features/integrations/health';
import { leetcodeSupported } from '@/features/integrations/leetcode';
import { requestNotificationPermission, rescheduleSoon } from '@/features/notifications/scheduler';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { alpha, radius, useTheme } from '@/ui/theme';

const REMINDER_BY_CATEGORY: Partial<Record<CategoryId, string>> = {
  fitness: '07:00',
  health: '09:00',
  mind: '07:30',
  learning: '21:00',
  career: '18:00',
  productivity: '09:30',
  social: '19:00',
  finance: '20:30',
  creativity: '19:30',
  home: '18:30',
};

function Dots({ step, total }: { step: number; total: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} active={i === step} done={i < step} color={t.accent} idle={t.surface3} />
      ))}
    </View>
  );
}

function Dot({ active, done, color, idle }: { active: boolean; done: boolean; color: string; idle: string }) {
  const style = useAnimatedStyle(() => ({ width: withSpring(active ? 26 : 8, { damping: 16 }) }));
  return (
    <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: active || done ? color : idle }, style]} />
  );
}

function TemplateCard({ tpl, selected, onPress }: { tpl: HabitTemplate; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const autoAvailable =
    tpl.autoHint === 'github' ||
    (tpl.autoHint === 'leetcode' && leetcodeSupported) ||
    (tpl.autoHint === 'health' && healthSupported);
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: radius.lg,
        backgroundColor: selected ? alpha(tpl.color, t.scheme === 'dark' ? 0.12 : 0.08) : t.surface,
        borderWidth: 1.5,
        borderColor: selected ? tpl.color : t.border,
      }}
    >
      <HabitIcon emoji={tpl.emoji} color={tpl.color} size={42} filled={selected} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{tpl.name}</Text>
        <Text variant="caption" tone="muted">
          {tpl.kind === 'check' ? 'Yes / No' : formatAmount(tpl, tpl.target)} · {scheduleLabel(tpl.schedule)}
          {autoAvailable ? ' · ' : ''}
          {autoAvailable ? (
            <Text variant="caption" color={t.xp} style={{ fontFamily: 'Inter_600SemiBold' }}>
              ⚡ auto-tracks
            </Text>
          ) : null}
        </Text>
      </View>
      <Icon name={selected ? 'check-circle' : 'circle'} size={22} color={selected ? tpl.color : t.textFaint} />
    </Tap>
  );
}

export default function OnboardingScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useApp((s) => s.profile);
  const user = useSession((s) => s.user);
  const needsName = !profile.displayName;
  const steps = needsName
    ? (['name', 'goals', 'habits', 'reminders'] as const)
    : (['goals', 'habits', 'reminders'] as const);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState<CategoryId[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notif, setNotif] = useState<boolean | null>(null);
  const current = steps[step];

  const templates = useMemo(() => {
    const relevant = TEMPLATES.filter((tp) => goals.includes(tp.category));
    const rest = TEMPLATES.filter((tp) => !goals.includes(tp.category));
    return [...relevant, ...rest];
  }, [goals]);

  const finish = async (thenCoach = false) => {
    const app = useApp.getState();
    if (needsName && name.trim()) app.updateProfile({ displayName: name.trim() });
    app.updateProfile({ goals });
    let order = 0;
    for (const id of picked) {
      const tpl = TEMPLATES.find((x) => x.id === id);
      if (!tpl) continue;
      const auto =
        tpl.autoHint === 'health' && healthSupported && tpl.autoMetric
          ? ({ provider: 'health', metric: tpl.autoMetric } as const)
          : null;
      app.createHabit({
        name: tpl.name,
        emoji: tpl.emoji,
        color: tpl.color,
        kind: tpl.kind,
        target: tpl.target,
        unit: tpl.unit,
        schedule: tpl.schedule,
        reminders: notif ? [REMINDER_BY_CATEGORY[tpl.category] ?? '09:00'] : [],
        auto,
        category: tpl.category,
        difficulty: tpl.difficulty,
        intention: null,
        challengeId: null,
        order: order++,
      });
    }
    app.setOnboarded(true);
    rescheduleSoon(500);
    useUI.getState().burst();
    if (thenCoach) setTimeout(() => router.push('/coach'), 400);
    const needsAuto = TEMPLATES.some(
      (tp) => picked.has(tp.id) && (tp.autoHint === 'github' || tp.autoHint === 'leetcode'),
    );
    if (needsAuto) {
      useUI.getState().toast('Connect GitHub/LeetCode so coding habits check themselves', {
        emoji: '⚡',
        action: { label: 'Connect', onPress: () => router.push('/integrations') },
      });
    }
  };

  const next = async () => {
    if (current === 'reminders') {
      await finish();
      return;
    }
    setStep(step + 1);
  };

  const canNext =
    current === 'name'
      ? name.trim().length > 0
      : current === 'goals'
        ? goals.length > 0
        : current === 'habits'
          ? picked.size > 0
          : true;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}
    >
      <View
        style={{ paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Dots step={step} total={steps.length} />
        {step > 0 ? (
          <Tap onPress={() => setStep(step - 1)} hitSlop={10}>
            <Text variant="caption" tone="muted">
              Back
            </Text>
          </Tap>
        ) : null}
      </View>

      <Animated.View
        key={current}
        entering={FadeInRight.springify().damping(20)}
        exiting={FadeOutLeft.duration(120)}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          {current === 'name' ? (
            <>
              <Text variant="hero" size={36}>
                Hey there 👋
              </Text>
              <Text tone="muted">What should Ritual call you?</Text>
              <TextField
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                autoFocus
                maxLength={40}
                returnKeyType="next"
                onSubmitEditing={() => canNext && next()}
              />
            </>
          ) : null}

          {current === 'goals' ? (
            <>
              <Text variant="hero" size={34}>
                {user || name
                  ? `What are you working on${name ? `, ${name.split(' ')[0]}` : ''}?`
                  : 'What are you working on?'}
              </Text>
              <Text tone="muted">Pick as many as you like — we’ll suggest habits that fit.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.id}
                    emoji={c.emoji}
                    label={c.name}
                    color={c.color}
                    selected={goals.includes(c.id)}
                    onPress={() =>
                      setGoals((prev) => (prev.includes(c.id) ? prev.filter((g) => g !== c.id) : [...prev, c.id]))
                    }
                  />
                ))}
              </View>
            </>
          ) : null}

          {current === 'habits' ? (
            <>
              <Text variant="hero" size={34}>
                Start small
              </Text>
              <Text tone="muted">Pick 2–3 to begin. You can tweak targets or add your own later.</Text>
              <Tap
                onPress={() => finish(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: alpha(t.xp, 0.45),
                  backgroundColor: t.xpSoft,
                }}
              >
                <Icon name="compass" size={20} color={t.xp} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">Let the AI coach design it</Text>
                  <Text variant="caption" tone="muted">
                    Describe a goal, get a plan
                  </Text>
                </View>
                <Icon name="arrow-right" size={18} color={t.xp} />
              </Tap>
              <View style={{ gap: 10 }}>
                {templates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    selected={picked.has(tpl.id)}
                    onPress={() =>
                      setPicked((prev) => {
                        const n = new Set(prev);
                        if (n.has(tpl.id)) n.delete(tpl.id);
                        else n.add(tpl.id);
                        return n;
                      })
                    }
                  />
                ))}
              </View>
            </>
          ) : null}

          {current === 'reminders' ? (
            <>
              <Text variant="hero" size={34}>
                Nudges that respect you
              </Text>
              <Text tone="muted">
                Reminders only fire for habits you haven’t done yet, and come with a ✓ Done button so you can log
                without opening the app.
              </Text>
              {Platform.OS !== 'web' ? (
                <ListGroup>
                  <ListRow
                    icon="bell"
                    title={notif ? 'Notifications on' : 'Turn on reminders'}
                    subtitle={
                      notif === false
                        ? 'You can enable them later in Settings'
                        : 'Morning brief · habit reminders · evening nudge'
                    }
                    toggle={!!notif}
                    onToggle={async (v) => setNotif(v ? await requestNotificationPermission() : false)}
                    last
                  />
                </ListGroup>
              ) : (
                <Text variant="caption" tone="faint">
                  Reminders run in the mobile app.
                </Text>
              )}
              <View style={{ gap: 8, marginTop: 6 }}>
                {[
                  '🌅 8:00 — your plan for the day',
                  '⏰ At your habit’s time — ✓ Done right from the notification',
                  '🌙 8:30 pm — only if something’s left',
                ].map((l) => (
                  <Text key={l} variant="caption" tone="muted">
                    {l}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>

      <View style={{ paddingHorizontal: 24 }}>
        <Button
          title={current === 'reminders' ? `Start my ritual${picked.size ? ` (${picked.size})` : ''}` : 'Continue'}
          iconRight={current === 'reminders' ? undefined : 'arrow-right'}
          size="lg"
          full
          disabled={!canNext}
          onPress={next}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
