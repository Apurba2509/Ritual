import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { HABIT_COLORS, TEMPLATE_BY_ID, TEMPLATES, HabitTemplate, CATEGORIES } from '@/domain/catalog';
import { orderedWeekdays, WEEKDAY_SHORT } from '@/domain/dates';
import { scheduleLabel } from '@/domain/habits';
import type { AutoSource, CategoryId, Difficulty, HabitKind, HealthMetric, Schedule } from '@/domain/types';
import { BASE_XP } from '@/domain/xp';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { formatAmount } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { EmojiSheet, formatTime, TimeSheet } from '@/features/habits/pickers';
import { syncHabitNow } from '@/features/integrations/engine';
import { isValidGithubUsername } from '@/features/integrations/github';
import { healthSupported, requestHealthPermissions } from '@/features/integrations/health';
import { leetcodeSupported } from '@/features/integrations/leetcode';
import { rescheduleSoon, requestNotificationPermission } from '@/features/notifications/scheduler';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';

type AutoChoice = 'none' | 'github' | 'leetcode' | HealthMetric;

function autoToChoice(a: AutoSource | null): AutoChoice {
  if (!a) return 'none';
  if (a.provider === 'health') return a.metric;
  return a.provider;
}

export default function EditHabitScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string; template?: string }>();
  const existing = useApp((s) => (params.id ? s.habits[params.id] : undefined));
  const integrations = useApp((s) => s.integrations);
  const template = params.template ? TEMPLATE_BY_ID.get(params.template) : undefined;
  const isEdit = !!existing;

  const seed = existing ?? template;
  const [name, setName] = useState(seed?.name ?? '');
  const [emoji, setEmoji] = useState(seed?.emoji ?? '✨');
  const [color, setColor] = useState(seed?.color ?? HABIT_COLORS[0]);
  const [kind, setKind] = useState<HabitKind>(seed?.kind ?? 'check');
  const [target, setTarget] = useState(String(seed?.target ?? 1));
  const [unit, setUnit] = useState(seed?.unit ?? '');
  const [schedule, setSchedule] = useState<Schedule>(seed?.schedule ?? { type: 'daily' });
  const [difficulty, setDifficulty] = useState<Difficulty>(seed?.difficulty ?? 'medium');
  const [category, setCategory] = useState<CategoryId | null>(seed?.category ?? null);
  const [reminders, setReminders] = useState<string[]>(existing?.reminders ?? (template ? ['09:00'] : []));
  const [intention, setIntention] = useState(existing?.intention ?? '');
  const [autoChoice, setAutoChoice] = useState<AutoChoice>(
    existing
      ? autoToChoice(existing.auto)
      : template?.autoHint === 'health'
        ? (template.autoMetric ?? 'none')
        : (template?.autoHint ?? 'none'),
  );
  const [autoUser, setAutoUser] = useState(
    existing?.auto && existing.auto.provider !== 'health'
      ? existing.auto.username
      : template?.autoHint === 'github'
        ? (integrations.github?.username ?? '')
        : template?.autoHint === 'leetcode'
          ? (integrations.leetcode?.username ?? '')
          : '',
  );
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyTemplate = (tpl: HabitTemplate) => {
    setName(tpl.name);
    setEmoji(tpl.emoji);
    setColor(tpl.color);
    setKind(tpl.kind);
    setTarget(String(tpl.target));
    setUnit(tpl.unit ?? '');
    setSchedule(tpl.schedule);
    setDifficulty(tpl.difficulty);
    setCategory(tpl.category);
    if (!reminders.length) setReminders(['09:00']);
    if (tpl.autoHint === 'health') setAutoChoice(healthSupported ? (tpl.autoMetric ?? 'none') : 'none');
    else if (tpl.autoHint) {
      setAutoChoice(tpl.autoHint);
      const linked = tpl.autoHint === 'github' ? integrations.github?.username : integrations.leetcode?.username;
      if (linked) setAutoUser(linked);
    } else setAutoChoice('none');
  };

  const targetNum = Math.max(1, Number(target.replace(',', '.')) || 1);
  const autoSource: AutoSource | null = useMemo(() => {
    if (autoChoice === 'none') return null;
    if (autoChoice === 'github' || autoChoice === 'leetcode') {
      return autoUser.trim() ? { provider: autoChoice, username: autoUser.trim() } : null;
    }
    return { provider: 'health', metric: autoChoice };
  }, [autoChoice, autoUser]);

  const autoOptions: { value: AutoChoice; label: string; emoji: string }[] = [
    { value: 'none', label: 'Manual', emoji: '✋' },
    { value: 'github', label: 'GitHub', emoji: '🐙' },
    ...(leetcodeSupported ? [{ value: 'leetcode' as const, label: 'LeetCode', emoji: '🧩' }] : []),
    ...(healthSupported
      ? [
          { value: 'steps' as const, label: 'Steps', emoji: '🚶' },
          { value: 'exercise' as const, label: 'Workouts', emoji: '🏋️' },
          { value: 'sleep' as const, label: 'Sleep', emoji: '😴' },
        ]
      : []),
  ];

  const pickAuto = (choice: AutoChoice) => {
    setAutoChoice(choice);
    if (choice === 'steps') {
      setKind('count');
      setUnit('steps');
      if (targetNum < 1000) setTarget('8000');
    } else if (choice === 'exercise') {
      setKind('duration');
      if (targetNum < 5) setTarget('30');
    } else if (choice === 'sleep') {
      setKind('duration');
      if (targetNum < 180) setTarget('420');
    } else if (choice === 'github' || choice === 'leetcode') {
      const linked = choice === 'github' ? integrations.github?.username : integrations.leetcode?.username;
      if (linked && !autoUser) setAutoUser(linked);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast('Give your habit a name', { tone: 'error' });
      return;
    }
    if ((autoChoice === 'github' || autoChoice === 'leetcode') && !autoUser.trim()) {
      toast(`Add your ${autoChoice === 'github' ? 'GitHub' : 'LeetCode'} username`, { tone: 'error' });
      return;
    }
    if (autoChoice === 'github' && !isValidGithubUsername(autoUser)) {
      toast("That doesn't look like a GitHub username", { tone: 'error' });
      return;
    }
    if (schedule.type === 'days' && schedule.days.length === 0) {
      toast('Pick at least one day', { tone: 'error' });
      return;
    }
    setSaving(true);
    const app = useApp.getState();
    const data = {
      name: name.trim(),
      emoji,
      color,
      kind,
      target: kind === 'check' ? 1 : targetNum,
      unit: kind === 'check' ? null : kind === 'duration' ? 'min' : unit.trim() || null,
      schedule,
      reminders: [...new Set(reminders)].sort(),
      auto: autoSource,
      category,
      difficulty,
      intention: intention.trim() || null,
    };
    let id = existing?.id;
    if (existing) app.updateHabit(existing.id, data);
    else id = app.createHabit({ ...data, challengeId: null });

    if (autoSource?.provider === 'github')
      app.setIntegration('github', { username: autoSource.username, lastSyncAt: null, error: null });
    if (autoSource?.provider === 'leetcode')
      app.setIntegration('leetcode', { username: autoSource.username, lastSyncAt: null, error: null });
    if (autoSource?.provider === 'health') {
      const ok = await requestHealthPermissions().catch(() => false);
      if (!ok) toast('Health Connect permission is needed for auto-tracking', { tone: 'error' });
    }
    if (reminders.length) await requestNotificationPermission();
    rescheduleSoon(300);

    const habit = useApp.getState().habits[id!];
    if (habit?.auto) {
      syncHabitNow(habit)
        .then(
          (n) => n > 0 && toast(`Imported ${n} day${n > 1 ? 's' : ''} of history`, { emoji: '⚡', tone: 'success' }),
        )
        .catch((e) => toast(e instanceof Error ? e.message : 'Sync failed', { tone: 'error' }));
    }
    setSaving(false);
    if (!existing) toast(`${emoji} ${name.trim()} added`, { tone: 'success' });
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    const run = () => {
      useApp.getState().deleteHabit(existing.id);
      rescheduleSoon(300);
      router.dismissAll();
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${existing.name}" and all its history?`)) run();
      return;
    }
    Alert.alert(
      'Delete habit?',
      `"${existing.name}" and all of its history will be removed everywhere. Archive it instead to keep your stats.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ],
    );
  };

  const weekStart = useApp((s) => s.settings.weekStart);

  return (
    <>
      <Screen back="close" title={isEdit ? 'Edit habit' : 'New habit'}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Tap onPress={() => setEmojiOpen(true)} scaleTo={0.9} accessibilityLabel="Change icon">
            <HabitIcon emoji={emoji} color={color} size={58} filled />
          </Tap>
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>
              {name || 'Your new habit'}
            </Text>
            <Text variant="caption" tone="muted">
              {kind === 'check'
                ? 'Done / not done'
                : `Target ${formatAmount({ kind, unit: kind === 'duration' ? 'min' : unit }, targetNum)}`}{' '}
              · {scheduleLabel(schedule)}
            </Text>
          </View>
        </Card>

        {!isEdit ? (
          <Section title="Start from a template">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              style={{ marginHorizontal: -20 }}
            >
              <View style={{ width: 12 }} />
              {TEMPLATES.map((tpl) => (
                <Chip
                  key={tpl.id}
                  emoji={tpl.emoji}
                  label={tpl.name}
                  selected={name === tpl.name}
                  color={tpl.color}
                  onPress={() => applyTemplate(tpl)}
                />
              ))}
              <View style={{ width: 12 }} />
            </ScrollView>
          </Section>
        ) : null}

        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Read before bed"
          maxLength={40}
          returnKeyType="done"
        />

        <Section title="How do you measure it?">
          <Segmented<HabitKind>
            value={kind}
            onChange={(k) => {
              setKind(k);
              if (k === 'duration' && targetNum < 5) setTarget('15');
              if (k === 'count' && targetNum < 2) setTarget('8');
            }}
            options={[
              { value: 'check', label: 'Yes / No' },
              { value: 'count', label: 'Count' },
              { value: 'duration', label: 'Time' },
            ]}
          />
          {kind !== 'check' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={kind === 'duration' ? 'Minutes' : 'Target'}
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
              {kind === 'count' ? (
                <View style={{ flex: 1.3 }}>
                  <TextField
                    label="Unit"
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="pages, glasses…"
                    maxLength={16}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </Section>

        <Section title="When?">
          <Segmented<Schedule['type']>
            value={schedule.type}
            onChange={(type) =>
              setSchedule(
                type === 'daily' ? { type } : type === 'days' ? { type, days: [1, 2, 3, 4, 5] } : { type, times: 3 },
              )
            }
            options={[
              { value: 'daily', label: 'Every day' },
              { value: 'days', label: 'Pick days' },
              { value: 'weekly', label: 'X per week' },
            ]}
          />
          {schedule.type === 'days' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {orderedWeekdays(weekStart).map((d) => {
                const on = schedule.days.includes(d);
                return (
                  <Tap
                    key={d}
                    onPress={() =>
                      setSchedule({
                        type: 'days',
                        days: on ? schedule.days.filter((x) => x !== d) : [...schedule.days, d],
                      })
                    }
                    scaleTo={0.88}
                    accessibilityState={{ selected: on }}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? color : t.surface,
                      borderWidth: 1,
                      borderColor: on ? color : t.border,
                    }}
                  >
                    <Text
                      variant="caption"
                      color={on ? '#FFF' : t.textMuted}
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                    >
                      {WEEKDAY_SHORT[d].slice(0, 2)}
                    </Text>
                  </Tap>
                );
              })}
            </View>
          ) : null}
          {schedule.type === 'weekly' ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Chip
                  key={n}
                  label={`${n}×`}
                  selected={schedule.times === n}
                  color={color}
                  onPress={() => setSchedule({ type: 'weekly', times: n })}
                />
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Reminders">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {reminders.map((r) => (
              <Chip
                key={r}
                icon="bell"
                label={formatTime(r)}
                selected
                color={color}
                onPress={() => setReminders(reminders.filter((x) => x !== r))}
              />
            ))}
            <Chip icon="plus" label={reminders.length ? 'Add' : 'Add reminder'} onPress={() => setTimeOpen(true)} />
          </View>
          {reminders.length ? (
            <Text variant="caption" tone="faint">
              Tap a time to remove it. Reminders have a ✓ Done button — log without opening the app.
            </Text>
          ) : null}
        </Section>

        <Section title="Auto-track">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {autoOptions.map((o) => (
              <Chip
                key={o.value}
                emoji={o.emoji}
                label={o.label}
                selected={autoChoice === o.value}
                color={t.xp}
                onPress={() => pickAuto(o.value)}
              />
            ))}
          </View>
          {autoChoice === 'github' || autoChoice === 'leetcode' ? (
            <TextField
              icon="at-sign"
              value={autoUser}
              onChangeText={setAutoUser}
              placeholder={autoChoice === 'github' ? 'GitHub username' : 'LeetCode username'}
              autoCapitalize="none"
              autoCorrect={false}
              hint={
                autoChoice === 'github'
                  ? 'Any public contribution (commit, PR, review) counts. A year of history is imported.'
                  : 'Days with a LeetCode submission count. Your submission calendar is imported.'
              }
            />
          ) : autoChoice !== 'none' ? (
            <Text variant="caption" tone="faint">
              Reads{' '}
              {autoChoice === 'steps' ? 'daily steps' : autoChoice === 'sleep' ? 'sleep sessions' : 'exercise sessions'}{' '}
              from Health Connect (Google Fit, Samsung Health, Fitbit…). Completes itself when you hit the target.
            </Text>
          ) : null}
        </Section>

        <Section title="Color">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {HABIT_COLORS.map((c) => (
              <Tap
                key={c}
                onPress={() => setColor(c)}
                scaleTo={0.85}
                accessibilityLabel={`Color ${c}`}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: c,
                  borderWidth: 3,
                  borderColor: color === c ? t.text : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {color === c ? <Icon name="check" size={16} color="#FFF" /> : null}
              </Tap>
            ))}
          </View>
        </Section>

        <Section title="Difficulty">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <Chip
                key={d}
                label={`${d[0].toUpperCase()}${d.slice(1)} · ${BASE_XP[d]} XP`}
                selected={difficulty === d}
                onPress={() => setDifficulty(d)}
              />
            ))}
          </View>
        </Section>

        <Section title="Category">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                emoji={c.emoji}
                label={c.name}
                size="sm"
                selected={category === c.id}
                color={c.color}
                onPress={() => setCategory(category === c.id ? null : c.id)}
              />
            ))}
          </View>
        </Section>

        <TextField
          label="Why does this matter? (optional)"
          value={intention}
          onChangeText={setIntention}
          placeholder="So I have energy to play with my kids"
          multiline
          maxLength={200}
          hint="Your reason shows up on the habit — it helps on hard days."
        />

        <Button title={isEdit ? 'Save changes' : 'Create habit'} size="lg" full loading={saving} onPress={save} />
        {existing ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title={existing.archived ? 'Unarchive' : 'Archive'}
              variant="secondary"
              icon="archive"
              style={{ flex: 1 }}
              onPress={() => {
                useApp.getState().archiveHabit(existing.id, !existing.archived);
                toast(existing.archived ? 'Habit restored' : 'Archived — history kept', { emoji: '📦' });
                router.dismissAll();
                router.replace('/');
              }}
            />
            <Button title="Delete" variant="danger" icon="trash-2" style={{ flex: 1 }} onPress={confirmDelete} />
          </View>
        ) : null}
      </Screen>
      <EmojiSheet visible={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={setEmoji} />
      <TimeSheet
        visible={timeOpen}
        onClose={() => setTimeOpen(false)}
        onPick={(v) => setReminders((r) => [...new Set([...r, v])].sort())}
      />
    </>
  );
}
