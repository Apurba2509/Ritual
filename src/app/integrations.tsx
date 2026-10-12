import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import {
  fetchGithubDaily,
  getGithubToken,
  githubTokenSupported,
  isValidGithubUsername,
  setGithubToken,
} from '@/features/integrations/github';
import { healthAvailability, healthSupported, requestHealthPermissions } from '@/features/integrations/health';
import { fetchLeetcodeDaily, leetcodeSupported } from '@/features/integrations/leetcode';
import {
  disableAutoSensing,
  enableAutoSensing,
  openBatterySettings,
  refreshSensing,
  sensingSupported,
  useSensing,
} from '@/features/sensing';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Pill } from '@/ui/Chip';
import { Icon, IconName } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, useTheme } from '@/ui/theme';

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
    icon: tpl.icon,
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

function linkedTo(habits: Habit[], match: (a: AutoSource) => boolean) {
  return habits.filter((h) => h.auto && match(h.auto));
}

function ServiceHeader({ icon, title, body, on }: { icon: IconName; title: string; body: string; on?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={t.text} weight="fill" />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
      {on ? <Pill label="On" color={t.accentInk} icon="check" /> : null}
    </View>
  );
}

// ─── This phone ──────────────────────────────────────────────────────────────

const DEVICE_TEMPLATES = ['steps', 'walk', 'run5k', 'cycle'];

function PhoneSensing() {
  const t = useTheme();
  const habits = useHabitList();
  const caps = useSensing((s) => s.caps);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshSensing();
    }, []),
  );

  if (!sensingSupported) {
    return (
      <Card style={{ gap: 12 }}>
        <ServiceHeader
          icon="device-mobile"
          title="Phone sensors"
          body="Steps, walks, runs and rides counted by the phone itself."
        />
        <Text variant="caption" tone="faint">
          Available in the Android app. The web demo can’t read phone sensors.
        </Text>
      </Card>
    );
  }

  const on = !!caps?.stepsEnabled || !!caps?.activityDetectionEnabled;

  const toggle = async () => {
    setBusy(true);
    if (on) {
      disableAutoSensing();
      toast('Phone tracking off', { icon: 'device-mobile' });
    } else {
      const res = await enableAutoSensing();
      if (res.steps || res.activity) {
        toast('Phone tracking on', { icon: 'lightning', tone: 'success' });
        runAutoTracking({ reason: 'manual', force: true }).catch(() => 0);
      } else toast('Allow Physical activity to turn this on', { tone: 'error' });
    }
    setBusy(false);
  };

  const add = async (templateId: string) => {
    const tpl = TEMPLATE_BY_ID.get(templateId)!;
    if (!on) await enableAutoSensing();
    const habit = createFromTemplate(templateId, { provider: 'device', metric: tpl.deviceMetric! });
    const n = await syncHabitNow(habit).catch(() => 0);
    toast(`${habit.name} now tracks itself${n ? ` · ${n} day${n > 1 ? 's' : ''} filled in` : ''}`, { tone: 'success' });
  };

  return (
    <View style={{ gap: 10 }}>
      <Card style={{ gap: 14 }}>
        <ServiceHeader
          icon="device-mobile"
          title="Phone sensors"
          body="Counts steps and notices walks, runs and rides with Ritual closed. No GPS or internet needed."
          on={on}
        />
        <View style={{ gap: 8 }}>
          {[
            {
              label: 'Step counter',
              ok: !!caps?.stepsEnabled,
              detail: caps?.stepCounter ? (caps.stepsEnabled ? 'Counting' : 'Off') : 'No sensor on this phone',
            },
            {
              label: 'Activity detection',
              ok: !!caps?.activityDetectionEnabled,
              detail: caps?.activityDetectionEnabled ? 'Listening' : 'Off',
            },
            {
              label: 'Barometer (elevation)',
              ok: !!caps?.barometer,
              detail: caps?.barometer ? 'Available' : 'Not on this phone, GPS used',
            },
          ].map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.ok ? t.accentInk : t.textFaint }}
              />
              <Text variant="caption" style={{ flex: 1 }}>
                {r.label}
              </Text>
              <Text variant="caption" tone="muted">
                {r.detail}
              </Text>
            </View>
          ))}
        </View>
        <Button
          title={on ? 'Turn off' : 'Turn on phone tracking'}
          variant={on ? 'secondary' : 'primary'}
          loading={busy}
          onPress={toggle}
          full
        />
        {on && caps && !caps.batteryUnrestricted ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: t.surface2,
            }}
          >
            <Icon name="warning" size={18} color={t.warning} />
            <Text variant="caption" style={{ flex: 1 }}>
              Some phones pause background apps to save battery. Let Ritual run unrestricted for reliable counting.
            </Text>
            <Button title="Allow" size="sm" variant="secondary" onPress={openBatterySettings} />
          </View>
        ) : null}
      </Card>

      <ListGroup>
        {DEVICE_TEMPLATES.map((id, i) => {
          const tpl = TEMPLATE_BY_ID.get(id)!;
          const linked = linkedTo(habits, (a) => a.provider === 'device' && a.metric === tpl.deviceMetric).length > 0;
          return (
            <ListRow
              key={id}
              leading={<HabitIcon icon={tpl.icon} color={tpl.color} size={34} />}
              title={tpl.name}
              subtitle={linked ? 'Tracking automatically' : undefined}
              right={
                linked ? (
                  <Icon name="check-circle" size={22} color={t.accentInk} weight="fill" />
                ) : (
                  <Button title="Add" size="sm" variant="secondary" onPress={() => add(id)} />
                )
              }
              last={i === DEVICE_TEMPLATES.length - 1}
            />
          );
        })}
      </ListGroup>

      <Card onPress={() => router.push('/workout')} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="play" size={20} color={t.onAccent} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Record a workout</Text>
          <Text variant="caption" tone="muted">
            GPS route, pace, splits, elevation. Offline.
          </Text>
        </View>
        <Icon name="caret-right" size={16} color={t.textFaint} />
      </Card>
    </View>
  );
}

// ─── GitHub / LeetCode ───────────────────────────────────────────────────────

function AccountIntegration({
  provider,
  title,
  icon,
  description,
  templateId,
  supported,
}: {
  provider: 'github' | 'leetcode';
  title: string;
  icon: IconName;
  description: string;
  templateId: string;
  supported: boolean;
}) {
  const t = useTheme();
  const state = useApp((s) => s.integrations[provider]);
  const habits = useHabitList();
  const linked = linkedTo(habits, (a) => a.provider === provider);
  const [username, setUsername] = useState(state?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ days: number; total: number } | null>(null);
  const withToken = provider === 'github' && githubTokenSupported;
  const [hasToken, setHasToken] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [token, setToken] = useState('');
  useEffect(() => {
    if (withToken) getGithubToken().then((v) => setHasToken(!!v));
  }, [withToken]);

  const saveToken = async (value: string | null) => {
    await setGithubToken(value);
    setHasToken(!!value);
    setToken('');
    setTokenOpen(false);
    toast(value ? 'Token saved on this phone' : 'Token removed', { icon: 'key', tone: 'success' });
  };

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
      for (const h of linked) useApp.getState().updateHabit(h.id, { auto: { provider, username: u } });
      if (!linked.length) {
        const habit = createFromTemplate(templateId, { provider, username: u });
        const n = await syncHabitNow(habit);
        toast(`${habit.name} created · ${n} days imported`, { tone: 'success' });
      } else {
        await runAutoTracking({ reason: 'manual', force: true });
        toast(`${title} connected`, { icon: 'lightning', tone: 'success' });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not connect', { tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <Card style={{ gap: 14 }}>
      <ServiceHeader icon={icon} title={title} body={description} on={!!state} />
      {!supported ? (
        <Text variant="caption" tone="faint">
          Available in the Android app (the {title} API blocks browsers).
        </Text>
      ) : (
        <>
          <TextField
            icon="at"
            value={username}
            onChangeText={setUsername}
            placeholder={`${title} username`}
            autoCapitalize="none"
            autoCorrect={false}
            error={state?.error ?? null}
            hint={state?.lastSyncAt ? `Last synced ${timeAgo(state.lastSyncAt)}` : undefined}
          />
          {preview ? (
            <Text variant="caption" tone="accent" weight="semibold">
              Found {preview.total} {provider === 'github' ? 'contributions' : 'submissions'} across {preview.days} days
              in the last year.
            </Text>
          ) : null}
          <Button
            title={state ? 'Update & sync' : `Connect ${title}`}
            loading={busy}
            onPress={connect}
            variant={state ? 'secondary' : 'primary'}
            full
          />
          {withToken ? (
            tokenOpen ? (
              <View style={{ gap: 10 }}>
                <TextField
                  icon="key"
                  value={token}
                  onChangeText={setToken}
                  placeholder="github_pat_…"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  hint="GitHub → Settings → Developer settings → Fine-grained tokens. No permissions are needed for public work. Stored encrypted on this phone only, never synced."
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Save token" size="sm" disabled={!token.trim()} onPress={() => saveToken(token)} />
                  <Button title="Cancel" size="sm" variant="ghost" onPress={() => setTokenOpen(false)} />
                </View>
              </View>
            ) : (
              <Tap onPress={() => setTokenOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="key" size={14} color={t.textMuted} />
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  {hasToken
                    ? 'Using your GitHub token (official API)'
                    : 'Add a GitHub token for the most reliable sync'}
                </Text>
                {hasToken ? (
                  <Tap onPress={() => saveToken(null)} hitSlop={8}>
                    <Text variant="caption" weight="bold">
                      Remove
                    </Text>
                  </Tap>
                ) : (
                  <Icon name="caret-right" size={14} color={t.textMuted} />
                )}
              </Tap>
            )
          ) : null}
        </>
      )}
      {linked.map((h) => (
        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <HabitIcon icon={h.icon} color={h.color} size={30} />
          <Text variant="caption" style={{ flex: 1 }}>
            {h.name}
          </Text>
          <Pill label="Auto" icon="lightning" />
        </View>
      ))}
    </Card>
  );
}

// ─── Health Connect ──────────────────────────────────────────────────────────

const HEALTH_OPTIONS: { metric: HealthMetric; templateId: string; label: string }[] = [
  { metric: 'steps', templateId: 'steps', label: 'Steps' },
  { metric: 'exercise', templateId: 'workout', label: 'Workouts' },
  { metric: 'sleep', templateId: 'sleep', label: 'Sleep' },
];

function HealthIntegration() {
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
      let habit = linkedTo(habits, (a) => a.provider === 'health' && a.metric === metric)[0];
      if (!habit) habit = createFromTemplate(templateId, { provider: 'health', metric });
      const n = await syncHabitNow(habit);
      useApp.getState().setIntegration('health', { lastSyncAt: Date.now(), error: null });
      toast(`${habit.name} now tracks itself${n ? ` · ${n} days imported` : ''}`, { tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Health Connect error', { tone: 'error' });
    }
    setBusy(null);
  };

  return (
    <Card style={{ gap: 14 }}>
      <ServiceHeader
        icon="heartbeat"
        title="Health Connect"
        body="Import from Google Fit, Samsung Health, Fitbit, Strava and other apps."
        on={!!state?.lastSyncAt}
      />
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {HEALTH_OPTIONS.map((o) => {
            const on = linkedTo(habits, (a) => a.provider === 'health' && a.metric === o.metric).length > 0;
            return (
              <Button
                key={o.metric}
                title={o.label}
                icon={on ? 'check' : 'plus'}
                size="sm"
                variant={on ? 'secondary' : 'outline'}
                loading={busy === o.metric}
                onPress={() => enable(o.metric, o.templateId)}
                style={{ flex: 1 }}
              />
            );
          })}
        </View>
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
  return (
    <Screen back title="Auto-tracking" subtitle="Habits that check themselves off, so you don’t have to.">
      <Section title="This phone">
        <PhoneSensing />
      </Section>

      <Section title="Accounts">
        <View style={{ gap: 10 }}>
          <AccountIntegration
            provider="github"
            title="GitHub"
            icon="github-logo"
            description="Any public contribution counts: commits, PRs, reviews."
            templateId="code"
            supported
          />
          <AccountIntegration
            provider="leetcode"
            title="LeetCode"
            icon="code"
            description="Days you submit a solution count toward your DSA streak."
            templateId="leetcode"
            supported={leetcodeSupported}
          />
        </View>
      </Section>

      <Section title="Other apps">
        <HealthIntegration />
      </Section>

      <Section title="Also hands-free">
        <ListGroup>
          <ListRow
            icon="bell"
            title="Done from the notification"
            subtitle="Log from a reminder without opening the app."
          />
          <ListRow
            icon="timer"
            title="Focus timer"
            subtitle="Time-based habits log themselves when the session ends."
          />
          <ListRow
            icon="sparkle"
            title="Tell Ritual what you did"
            subtitle={
              aiConfigured
                ? 'Gemini turns a sentence into check-ins.'
                : 'On-device parsing turns a sentence into check-ins.'
            }
            onPress={() => router.push('/log')}
            last
          />
        </ListGroup>
      </Section>
    </Screen>
  );
}
