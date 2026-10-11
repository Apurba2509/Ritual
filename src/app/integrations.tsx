import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { TEMPLATE_BY_ID } from '@/domain/catalog';
import type { AutoSource, Habit, HealthMetric } from '@/domain/types';
import { useHabitList } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { aiConfigured } from '@/features/ai/gemini';
import { timeAgo } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { runAutoTracking, syncHabitNow } from '@/features/integrations/engine';
import { fetchGithubDaily, isValidGithubUsername } from '@/features/integrations/github';
import { healthAvailability, healthSupported, requestHealthPermissions } from '@/features/integrations/health';
import { fetchLeetcodeDaily, leetcodeSupported } from '@/features/integrations/leetcode';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Pill } from '@/ui/Chip';
import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { alpha, useTheme } from '@/ui/theme';

/** Attach the source to a matching manual habit if one exists, otherwise create it from the template. */
function createFromTemplate(templateId: string, auto: AutoSource): Habit {
  const tpl = TEMPLATE_BY_ID.get(templateId)!;
  const app = useApp.getState();
  const match = Object.values(app.habits).find(
    (h) => !h.deleted && !h.archived && !h.auto && h.name.trim().toLowerCase() === tpl.name.toLowerCase(),
  );
  if (match) {
    app.updateHabit(match.id, { auto });
    return useApp.getState().habits[match.id];
  }
  const id = app.createHabit({
    name: tpl.name,
    emoji: tpl.emoji,
    color: tpl.color,
    kind: tpl.kind,
    target: tpl.target,
    unit: tpl.unit,
    schedule: tpl.schedule,
    reminders: [],
    auto,
    category: tpl.category,
    difficulty: tpl.difficulty,
    intention: null,
    challengeId: null,
  });
  return useApp.getState().habits[id];
}

function linkedHabits(habits: Habit[], provider: AutoSource['provider'], metric?: HealthMetric) {
  return habits.filter(
    (h) => h.auto?.provider === provider && (!metric || (h.auto.provider === 'health' && h.auto.metric === metric)),
  );
}

function AccountIntegration({
  provider,
  title,
  emoji,
  description,
  templateId,
  supported,
}: {
  provider: 'github' | 'leetcode';
  title: string;
  emoji: string;
  description: string;
  templateId: string;
  supported: boolean;
}) {
  const t = useTheme();
  const state = useApp((s) => s.integrations[provider]);
  const habits = useHabitList();
  const linked = linkedHabits(habits, provider);
  const [username, setUsername] = useState(state?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ days: number; total: number } | null>(null);

  const connect = async () => {
    const u = username.trim().replace(/^@/, '');
    if (!u || (provider === 'github' && !isValidGithubUsername(u))) {
      toast(`Enter a valid ${title} username`, { tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const data = provider === 'github' ? await fetchGithubDaily(u) : await fetchLeetcodeDaily(u);
      const days = Object.keys(data).length;
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      setPreview({ days, total });
      useApp.getState().setIntegration(provider, { username: u, lastSyncAt: Date.now(), error: null });
      // Re-point existing linked habits to the new account.
      for (const h of linked) useApp.getState().updateHabit(h.id, { auto: { provider, username: u } });
      if (!linked.length) {
        const habit = createFromTemplate(templateId, { provider, username: u });
        const n = await syncHabitNow(habit);
        toast(`${habit.emoji} ${habit.name} created · ${n} days imported`, { tone: 'success' });
      } else {
        await runAutoTracking({ reason: 'manual', force: true });
        toast(`${title} connected`, { emoji: '⚡', tone: 'success' });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not connect', { tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text size={30}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">{title}</Text>
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        </View>
        {state ? <Pill label="Connected" color={t.success} icon="check" /> : null}
      </View>
      {!supported ? (
        <Text variant="caption" tone="faint">
          Available in the Android/iOS app (the {title} API blocks browsers).
        </Text>
      ) : (
        <>
          <TextField
            icon="at-sign"
            value={username}
            onChangeText={setUsername}
            placeholder={`${title} username`}
            autoCapitalize="none"
            autoCorrect={false}
            error={state?.error ?? null}
            hint={state?.lastSyncAt ? `Last synced ${timeAgo(state.lastSyncAt)}` : undefined}
          />
          {preview ? (
            <Text variant="caption" tone="success">
              Found {preview.total} {provider === 'github' ? 'contributions' : 'submissions'} across {preview.days} days
              in the last year.
            </Text>
          ) : null}
          <Button
            title={state ? 'Update & sync' : `Connect ${title}`}
            loading={busy}
            onPress={connect}
            variant={state ? 'secondary' : 'primary'}
          />
        </>
      )}
      {linked.map((h) => (
        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <HabitIcon emoji={h.emoji} color={h.color} size={30} />
          <Text variant="caption" style={{ flex: 1 }}>
            {h.name}
          </Text>
          <Text variant="caption" tone="faint">
            auto ⚡
          </Text>
        </View>
      ))}
    </Card>
  );
}

const HEALTH_OPTIONS: { metric: HealthMetric; templateId: string; label: string }[] = [
  { metric: 'steps', templateId: 'steps', label: 'Steps → “Walk 8,000 steps”' },
  { metric: 'exercise', templateId: 'workout', label: 'Workouts → “Work out 30 min”' },
  { metric: 'sleep', templateId: 'sleep', label: 'Sleep → “Sleep 7+ hours”' },
];

function HealthIntegration() {
  const t = useTheme();
  const habits = useHabitList();
  const state = useApp((s) => s.integrations.health);
  const [availability, setAvailability] = useState<'available' | 'needs-install' | 'unsupported' | 'checking'>(
    'checking',
  );
  const [busy, setBusy] = useState<HealthMetric | null>(null);

  useEffect(() => {
    healthAvailability().then(setAvailability);
  }, []);

  const enable = async (metric: HealthMetric, templateId: string) => {
    setBusy(metric);
    try {
      const ok = await requestHealthPermissions();
      if (!ok) throw new Error('Permission not granted in Health Connect.');
      let habit = linkedHabits(habits, 'health', metric)[0];
      if (!habit) habit = createFromTemplate(templateId, { provider: 'health', metric });
      const n = await syncHabitNow(habit);
      useApp.getState().setIntegration('health', { lastSyncAt: Date.now(), error: null });
      toast(`${habit.emoji} ${habit.name} now tracks itself${n ? ` · ${n} days imported` : ''}`, { tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Health Connect error', { tone: 'error' });
    }
    setBusy(null);
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text size={30}>❤️</Text>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">Health Connect</Text>
          <Text variant="caption" tone="muted">
            Steps, workouts & sleep from Google Fit, Samsung Health, Fitbit, Strava…
          </Text>
        </View>
        {state?.lastSyncAt ? <Pill label="Active" color={t.success} icon="check" /> : null}
      </View>
      {!healthSupported ? (
        <Text variant="caption" tone="faint">
          {Platform.OS === 'ios' ? 'Apple Health support is on the roadmap.' : 'Available in the Android app.'}
        </Text>
      ) : availability === 'needs-install' ? (
        <Button
          title="Install Health Connect"
          variant="secondary"
          onPress={() => Linking.openURL('market://details?id=com.google.android.apps.healthdata')}
        />
      ) : availability === 'unsupported' ? (
        <Text variant="caption" tone="faint">
          Health Connect isn’t available on this device.
        </Text>
      ) : (
        HEALTH_OPTIONS.map((o) => {
          const on = linkedHabits(habits, 'health', o.metric).length > 0;
          return (
            <View key={o.metric} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text variant="caption" style={{ flex: 1 }}>
                {o.label}
              </Text>
              <Button
                title={on ? 'Sync' : 'Enable'}
                size="sm"
                variant={on ? 'secondary' : 'primary'}
                loading={busy === o.metric}
                onPress={() => enable(o.metric, o.templateId)}
              />
            </View>
          );
        })
      )}
      {state?.error ? (
        <Text variant="caption" tone="danger">
          {state.error}
        </Text>
      ) : null}
    </Card>
  );
}

export default function IntegrationsScreen() {
  const t = useTheme();
  return (
    <Screen
      back
      title="Auto-tracking"
      subtitle="Habits that check themselves off. Synced on launch, on resume, and when you pull to refresh."
    >
      <AccountIntegration
        provider="github"
        title="GitHub"
        emoji="🐙"
        description="Any public contribution counts — commits, PRs, reviews."
        templateId="code"
        supported
      />
      <AccountIntegration
        provider="leetcode"
        title="LeetCode"
        emoji="🧩"
        description="Days you submit a solution count toward your DSA streak."
        templateId="leetcode"
        supported={leetcodeSupported}
      />
      <HealthIntegration />

      <Section title="Also hands-free">
        <Card style={{ gap: 10 }}>
          {[
            { emoji: '🔔', title: 'Notification ✓ Done', body: 'Log from the reminder without opening the app.' },
            { emoji: '⏳', title: 'Focus timer', body: 'Time-based habits log themselves when the session ends.' },
            {
              emoji: '🪄',
              title: 'Tell Ritual what you did',
              body: aiConfigured
                ? 'Gemini turns a sentence into check-ins.'
                : 'On-device parsing turns a sentence into check-ins.',
            },
          ].map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(t.xp, 0.14),
                }}
              >
                <Text size={16}>{f.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{f.title}</Text>
                <Text variant="caption" tone="muted">
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
          <Button title="Try quick log" variant="secondary" icon="message-circle" onPress={() => router.push('/log')} />
        </Card>
      </Section>
    </Screen>
  );
}
