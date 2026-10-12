import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import {
  CATEGORIES,
  DEFAULT_HABIT_ICON,
  HABIT_TINT_KEYS,
  HabitTemplate,
  TEMPLATE_BY_ID,
  TEMPLATES,
} from '@/domain/catalog';
import { orderedWeekdays, WEEKDAY_SHORT } from '@/domain/dates';
import type {
  AutoSource,
  CategoryId,
  DeviceMetric,
  Difficulty,
  HabitKind,
  HealthMetric,
  Schedule,
  ScreenScope,
} from '@/domain/types';
import { niceAmount, tinyVersion } from '@/domain/behavior';
import { BASE_XP } from '@/domain/xp';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { formatTime, IconSheet, TimeSheet } from '@/features/habits/pickers';
import { autoForTemplate } from '@/features/integrations/autoFor';
import { syncHabitNow } from '@/features/integrations/engine';
import { isValidGithubUsername } from '@/features/integrations/github';
import { healthSupported, requestHealthPermissions } from '@/features/integrations/health';
import { leetcodeSupported } from '@/features/integrations/leetcode';
import { rescheduleSoon, requestNotificationPermission } from '@/features/notifications/scheduler';
import { enableScreenTime, screenSupported } from '@/features/screen';
import { enableAutoSensing, sensingSupported } from '@/features/sensing';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon, IconName, isIconName } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { tint, useTheme } from '@/ui/theme';

type AutoChoice = 'none' | 'github' | 'leetcode' | HealthMetric | `dev-${DeviceMetric}` | `screen-${ScreenScope}`;

function autoToChoice(a: AutoSource | null): AutoChoice {
  if (!a) return 'none';
  if (a.provider === 'health') return a.metric;
  if (a.provider === 'device') return `dev-${a.metric}`;
  if (a.provider === 'screen') return `screen-${a.scope}`;
  return a.provider;
}

/** When-then plans ("After my coffee, I read") make follow-through far more likely. */
const CUES = ['After I wake up', 'After my morning coffee', 'After lunch', 'When I get home', 'Before bed'];

function templateChoice(tpl: HabitTemplate | undefined): AutoChoice {
  if (!tpl) return 'none';
  const auto = autoForTemplate(tpl);
  if (auto) return autoToChoice(auto);
  if (tpl.autoHint === 'github' || (tpl.autoHint === 'leetcode' && leetcodeSupported)) return tpl.autoHint;
  return 'none';
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
  const [icon, setIcon] = useState(seed?.icon ?? DEFAULT_HABIT_ICON);
  const [color, setColor] = useState<string>(seed?.color ?? 'lime');
  const [kind, setKind] = useState<HabitKind>(seed?.kind ?? 'check');
  const [target, setTarget] = useState(String(seed?.target ?? 1));
  const [unit, setUnit] = useState(seed?.unit ?? '');
  const [schedule, setSchedule] = useState<Schedule>(seed?.schedule ?? { type: 'daily' });
  const [difficulty, setDifficulty] = useState<Difficulty>(seed?.difficulty ?? 'medium');
  const [category, setCategory] = useState<CategoryId | null>(seed?.category ?? null);
  const [reminders, setReminders] = useState<string[]>(existing?.reminders ?? (template ? ['09:00'] : []));
  const [intention, setIntention] = useState(existing?.intention ?? '');
  const [cue, setCue] = useState(existing?.cue ?? '');
  const [tiny, setTiny] = useState(existing?.tiny ?? '');
  const [limit, setLimit] = useState(
    String(existing?.auto?.provider === 'screen' ? existing.auto.limitMin : (template?.screen?.limitMin ?? 120)),
  );
  const [ladder, setLadder] = useState(!!existing?.goalTarget && existing.goalTarget > existing.target);
  const [goal, setGoal] = useState(existing?.goalTarget ? String(existing.goalTarget) : '');
  const [autoChoice, setAutoChoice] = useState<AutoChoice>(
    existing ? autoToChoice(existing.auto) : templateChoice(template),
  );
  const [autoUser, setAutoUser] = useState(
    existing?.auto && (existing.auto.provider === 'github' || existing.auto.provider === 'leetcode')
      ? existing.auto.username
      : template?.autoHint === 'github'
        ? (integrations.github?.username ?? '')
        : template?.autoHint === 'leetcode'
          ? (integrations.leetcode?.username ?? '')
          : '',
  );
  const [iconOpen, setIconOpen] = useState(false);
  const [more, setMore] = useState(!!existing?.intention);
  const [timeOpen, setTimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyTemplate = (tpl: HabitTemplate) => {
    setName(tpl.name);
    setIcon(tpl.icon);
    setColor(tpl.color);
    setKind(tpl.kind);
    setTarget(String(tpl.target));
    setUnit(tpl.unit ?? '');
    setSchedule(tpl.schedule);
    setDifficulty(tpl.difficulty);
    setCategory(tpl.category);
    if (tpl.screen) setLimit(String(tpl.screen.limitMin));
    if (!reminders.length && !tpl.screen) setReminders(['09:00']);
    const choice = templateChoice(tpl);
    setAutoChoice(choice);
    if (choice === 'github' || choice === 'leetcode') {
      const linked = choice === 'github' ? integrations.github?.username : integrations.leetcode?.username;
      if (linked) setAutoUser(linked);
    }
  };

  const targetNum = Math.max(1, Number(target.replace(',', '.')) || 1);
  const limitNum = Math.max(5, Math.round(Number(limit) || 120));
  const goalNum = Math.max(0, Number(goal.replace(',', '.')) || 0);
  const isScreen = autoChoice.startsWith('screen-');
  const autoSource: AutoSource | null = useMemo((): AutoSource | null => {
    if (autoChoice === 'none') return null;
    if (autoChoice === 'github' || autoChoice === 'leetcode') {
      return autoUser.trim() ? { provider: autoChoice, username: autoUser.trim() } : null;
    }
    if (autoChoice.startsWith('dev-')) return { provider: 'device', metric: autoChoice.slice(4) as DeviceMetric };
    if (autoChoice.startsWith('screen-'))
      return { provider: 'screen', scope: autoChoice.slice(7) as ScreenScope, limitMin: limitNum };
    return { provider: 'health', metric: autoChoice as HealthMetric };
  }, [autoChoice, autoUser, limitNum]);

  const autoOptions: { value: AutoChoice; label: string; icon: IconName }[] = [
    { value: 'none', label: 'Manual', icon: 'hand-waving' },
    ...(sensingSupported
      ? [
          { value: 'dev-steps' as const, label: 'Phone steps', icon: 'footprints' as IconName },
          { value: 'dev-walk' as const, label: 'Walks', icon: 'person-simple-walk' as IconName },
          { value: 'dev-run' as const, label: 'Runs', icon: 'person-simple-run' as IconName },
          { value: 'dev-ride' as const, label: 'Rides', icon: 'person-simple-bike' as IconName },
        ]
      : []),
    ...(screenSupported
      ? [
          { value: 'screen-all' as const, label: 'Screen time limit', icon: 'hourglass-high' as IconName },
          { value: 'screen-guarded' as const, label: 'Guarded apps limit', icon: 'device-mobile-slash' as IconName },
        ]
      : []),
    { value: 'github', label: 'GitHub', icon: 'github-logo' },
    ...(leetcodeSupported ? [{ value: 'leetcode' as const, label: 'LeetCode', icon: 'code' as IconName }] : []),
    ...(healthSupported
      ? [
          { value: 'steps' as const, label: 'Health steps', icon: 'heartbeat' as IconName },
          { value: 'exercise' as const, label: 'Workouts', icon: 'heartbeat' as IconName },
          { value: 'sleep' as const, label: 'Sleep', icon: 'moon-stars' as IconName },
        ]
      : []),
  ];

  const pickAuto = (choice: AutoChoice) => {
    setAutoChoice(choice);
    if (choice.startsWith('screen-')) {
      setKind('check');
      return;
    }
    if (choice === 'dev-steps') {
      setKind('count');
      setUnit('steps');
      if (targetNum < 1000) setTarget('8000');
    } else if (choice === 'dev-walk' || choice === 'dev-run' || choice === 'dev-ride') {
      if (kind === 'count' && !/km|mi|step/i.test(unit)) {
        setKind('duration');
        if (targetNum < 5) setTarget('30');
      }
    } else if (choice === 'steps') {
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
    if (ladder && kind !== 'check' && !isScreen && goalNum <= targetNum) {
      toast('Your goal should be bigger than where you start', { tone: 'error' });
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
      icon,
      color,
      kind: isScreen ? ('check' as const) : kind,
      target: kind === 'check' || isScreen ? 1 : targetNum,
      unit: kind === 'check' || isScreen ? null : kind === 'duration' ? 'min' : unit.trim() || null,
      goalTarget: ladder && kind !== 'check' && !isScreen && goalNum > targetNum ? goalNum : null,
      cue: cue.trim() || null,
      tiny: tiny.trim() || null,
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
    if (autoSource?.provider === 'device') {
      const res = await enableAutoSensing().catch(() => ({ steps: false, activity: false }));
      if (!res.steps && !res.activity) toast('Allow Physical activity so your phone can track this', { tone: 'error' });
    }
    if (autoSource?.provider === 'screen' && !enableScreenTime()) {
      toast('Allow Usage access for Ritual, then come back', { icon: 'hourglass-high' });
    }
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
          (n) =>
            n > 0 && toast(`Imported ${n} day${n > 1 ? 's' : ''} of history`, { icon: 'lightning', tone: 'success' }),
        )
        .catch((e) => toast(e instanceof Error ? e.message : 'Sync failed', { tone: 'error' }));
    }
    setSaving(false);
    if (!existing) toast(`${name.trim()} added`, { tone: 'success' });
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
      <Screen
        back="close"
        title={isEdit ? 'Edit habit' : 'New habit'}
        footer={
          <Button title={isEdit ? 'Save changes' : 'Create habit'} size="lg" full loading={saving} onPress={save} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Tap onPress={() => setIconOpen(true)} scaleTo={0.9} accessibilityLabel="Change icon">
            <HabitIcon icon={icon} color={color} size={62} />
            <View
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: t.surface3,
                borderWidth: 2.5,
                borderColor: t.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="pencil-simple" size={11} color={t.text} />
            </View>
          </Tap>
          <View style={{ flex: 1 }}>
            <TextField
              big
              value={name}
              onChangeText={setName}
              placeholder="Name your habit"
              maxLength={40}
              returnKeyType="done"
              autoFocus={!isEdit && !template}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {HABIT_TINT_KEYS.map((k) => {
            const on = color === k;
            return (
              <Tap
                key={k}
                onPress={() => setColor(k)}
                scaleTo={0.85}
                accessibilityLabel={`${k} colour`}
                accessibilityState={{ selected: on }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: on ? t.text : 'transparent',
                }}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: tint(k, t) }} />
              </Tap>
            );
          })}
        </View>

        {!isEdit ? (
          <Section title="Or start from a template">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
              style={{ marginHorizontal: -20 }}
            >
              {TEMPLATES.map((tpl) => (
                <Chip
                  key={tpl.id}
                  icon={isIconName(tpl.icon) ? tpl.icon : undefined}
                  label={tpl.name}
                  selected={name === tpl.name}
                  color={tint(tpl.color, t)}
                  onPress={() => applyTemplate(tpl)}
                />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        <Section title="Goal">
          {isScreen ? (
            <TextField
              label={
                autoChoice === 'screen-all'
                  ? 'Daily screen time limit (minutes)'
                  : 'Daily limit for guarded apps (minutes)'
              }
              value={limit}
              onChangeText={setLimit}
              keyboardType="numeric"
              maxLength={4}
              hint="Counts as done while you stay under. Aim a little below today, not a detox."
            />
          ) : (
            <>
              <Segmented<HabitKind>
                value={kind}
                onChange={(k) => {
                  setKind(k);
                  if (k === 'duration' && targetNum < 5) setTarget('15');
                  if (k === 'count' && targetNum < 2) setTarget('8');
                }}
                options={[
                  { value: 'check', label: 'Yes / No', icon: 'check-circle' },
                  { value: 'count', label: 'Count', icon: 'plus-circle' },
                  { value: 'duration', label: 'Time', icon: 'timer' },
                ]}
              />
              {kind !== 'check' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label={kind === 'duration' ? 'Minutes a day' : 'Target'}
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
              {kind !== 'check' ? (
                <>
                  <View style={{ flexDirection: 'row' }}>
                    <Chip
                      icon="stairs"
                      label="Build up to it"
                      selected={ladder}
                      onPress={() => {
                        const next = !ladder;
                        setLadder(next);
                        if (next && !goal) {
                          // Start at about 40% of the goal: easy enough to repeat, big enough to count.
                          setGoal(String(targetNum));
                          setTarget(
                            String(niceAmount({ kind, unit }, Math.max(kind === 'duration' ? 2 : 1, targetNum * 0.4))),
                          );
                        }
                      }}
                    />
                  </View>
                  {ladder ? (
                    <TextField
                      label={kind === 'duration' ? 'Where you are heading (minutes)' : 'Where you are heading'}
                      value={goal}
                      onChangeText={setGoal}
                      keyboardType="numeric"
                      maxLength={6}
                      hint="You start at the target above. When it gets easy, the coach suggests the next step up, never past this goal."
                    />
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </Section>

        <Section title="Schedule">
          <Segmented<Schedule['type']>
            value={schedule.type}
            onChange={(type) =>
              setSchedule(
                type === 'daily' ? { type } : type === 'days' ? { type, days: [1, 2, 3, 4, 5] } : { type, times: 3 },
              )
            }
            options={[
              { value: 'daily', label: 'Every day' },
              { value: 'days', label: 'Some days' },
              { value: 'weekly', label: 'X a week' },
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
                    accessibilityLabel={WEEKDAY_SHORT[d]}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? t.text : t.surface2,
                    }}
                  >
                    <Text variant="caption" weight="semibold" color={on ? t.bg : t.textMuted}>
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
                  label={`${n}× a week`}
                  selected={schedule.times === n}
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
                onPress={() => setReminders(reminders.filter((x) => x !== r))}
              />
            ))}
            <Chip icon="plus" label={reminders.length ? 'Add' : 'Add a reminder'} onPress={() => setTimeOpen(true)} />
          </View>
          {reminders.length ? (
            <Text variant="caption" tone="faint">
              Tap a time to remove it. Reminders have a Done button, so you can log without opening the app.
            </Text>
          ) : null}
        </Section>

        {!isScreen ? (
          <Section title="When, exactly?">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CUES.map((c) => (
                <Chip key={c} label={c} size="sm" selected={cue === c} onPress={() => setCue(cue === c ? '' : c)} />
              ))}
            </View>
            <TextField
              value={cue}
              onChangeText={setCue}
              placeholder="After I…"
              maxLength={60}
              hint="Tie it to something you already do. A specific moment beats a vague intention."
            />
          </Section>
        ) : null}

        <Section title="Auto-track">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {autoOptions.map((o) => (
              <Chip
                key={o.value}
                icon={o.icon}
                label={o.label}
                selected={autoChoice === o.value}
                onPress={() => pickAuto(o.value)}
              />
            ))}
          </View>
          {autoChoice === 'github' || autoChoice === 'leetcode' ? (
            <TextField
              icon="at"
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
          ) : isScreen ? (
            <Text variant="caption" tone="faint">
              {autoChoice === 'screen-all'
                ? 'Measured from Android’s own usage log, even with Ritual closed and offline. Needs Usage access once.'
                : 'Counts only the apps you guard in Screen time (social, video, games…). Needs Usage access once.'}
            </Text>
          ) : autoChoice.startsWith('dev-') ? (
            <Text variant="caption" tone="faint">
              {autoChoice === 'dev-steps'
                ? 'Counted by your phone’s step sensor, even with Ritual closed, offline and without GPS.'
                : 'Detected automatically when you walk, run or ride, plus anything you record with the workout tracker. Duration habits count minutes; km habits count distance.'}
            </Text>
          ) : autoChoice !== 'none' ? (
            <Text variant="caption" tone="faint">
              Reads{' '}
              {autoChoice === 'steps' ? 'daily steps' : autoChoice === 'sleep' ? 'sleep sessions' : 'exercise sessions'}{' '}
              from Health Connect (Google Fit, Samsung Health, Fitbit…) and completes itself when you hit the target.
            </Text>
          ) : null}
        </Section>

        <Tap
          onPress={() => setMore(!more)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: more }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">More options</Text>
            <Text variant="caption" tone="muted">
              Two-minute version, difficulty, category and your why
            </Text>
          </View>
          <Icon name={more ? 'caret-up' : 'caret-down'} size={16} color={t.textMuted} />
        </Tap>

        {more ? (
          <>
            <TextField
              label="Two-minute version"
              value={tiny}
              onChangeText={setTiny}
              placeholder={tinyVersion({ name, kind, target: targetNum, unit, tiny: null }).label}
              maxLength={60}
              hint="The smallest version that still counts. On hard days and in easy mode it keeps the streak alive."
            />

            <Section title="Difficulty">
              <Segmented<Difficulty>
                value={difficulty}
                onChange={setDifficulty}
                options={(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => ({
                  value: d,
                  label: `${d[0].toUpperCase()}${d.slice(1)} · ${BASE_XP[d]}`,
                }))}
              />
            </Section>

            <Section title="Category">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    icon={isIconName(cat.icon) ? cat.icon : undefined}
                    label={cat.name}
                    size="sm"
                    selected={category === cat.id}
                    onPress={() => setCategory(category === cat.id ? null : cat.id)}
                  />
                ))}
              </View>
            </Section>

            <TextField
              label="Why does this matter to you?"
              value={intention}
              onChangeText={setIntention}
              placeholder="So I have energy to play with my kids"
              multiline
              maxLength={200}
              hint="Shown on the habit. It helps on hard days."
            />
          </>
        ) : null}

        {existing ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button
              title={existing.archived ? 'Unarchive' : 'Archive'}
              variant="secondary"
              icon="archive"
              style={{ flex: 1 }}
              onPress={() => {
                useApp.getState().archiveHabit(existing.id, !existing.archived);
                toast(existing.archived ? 'Habit restored' : 'Archived. History kept', { icon: 'archive' });
                router.dismissAll();
                router.replace('/');
              }}
            />
            <Button title="Delete" variant="danger" icon="trash" style={{ flex: 1 }} onPress={confirmDelete} />
          </View>
        ) : null}
      </Screen>
      <IconSheet visible={iconOpen} onClose={() => setIconOpen(false)} onPick={setIcon} color={color} selected={icon} />
      <TimeSheet
        visible={timeOpen}
        onClose={() => setTimeOpen(false)}
        onPick={(v) => setReminders((r) => [...new Set([...r, v])].sort())}
      />
    </>
  );
}
