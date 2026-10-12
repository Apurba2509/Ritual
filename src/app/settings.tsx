import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { signOut } from '@/data/auth';
import { continueAsGuest, leaveDemo, useSession } from '@/data/session';
import type { NotifyStyle } from '@/domain/notifications';
import { ThemePref, useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { formatTime, TimeSheet } from '@/features/habits/pickers';
import {
  sendTestReminder,
  notificationPermission,
  requestNotificationPermission,
  rescheduleSoon,
} from '@/features/notifications/scheduler';
import { pinTodayWidget, widgetSupported } from '@/widget/register';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Logo } from '@/ui/Logo';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { shareText } from '@/lib/share';

const STYLE_COPY: Record<NotifyStyle, string> = {
  calm: 'Morning brief, the reminder times you set, and an evening nudge. Nothing else.',
  balanced: 'Adds a midday check-in and a weekly recap.',
  coach:
    'Ritual keeps you moving: smart nudges for habits without a time, an afternoon walk push when steps are behind, and a last call before a long streak breaks.',
};

function confirmAsync(title: string, message: string, cta: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: cta, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const user = useSession((s) => s.user);
  const demo = useApp((s) => s.demo);
  const [perm, setPerm] = useState<string>('undetermined');
  const [timeFor, setTimeFor] = useState<'morning' | 'evening' | null>(null);

  useFocusEffect(
    useCallback(() => {
      notificationPermission().then(setPerm);
    }, []),
  );

  const setPref = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    rescheduleSoon(400);
  };

  const exportData = async () => {
    const s = useApp.getState();
    const data = {
      exportedAt: new Date().toISOString(),
      app: 'Ritual',
      profile: s.profile,
      habits: Object.values(s.habits).filter((h) => !h.deleted),
      entries: Object.values(s.entries).filter((e) => !e.deleted),
      achievements: s.unlocked,
    };
    const json = JSON.stringify(data, null, 2);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ritual-export-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      return;
    }
    await shareText(json, { title: 'Ritual export' });
  };

  return (
    <>
      <Screen back title="Settings">
        <Section title="Appearance">
          <Segmented<ThemePref>
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
          <ListGroup>
            <ListRow
              icon="calendar-blank"
              title="Week starts on"
              right={
                <View style={{ width: 150 }}>
                  <Segmented<'1' | '0'>
                    value={String(settings.weekStart) as '1' | '0'}
                    onChange={(v) => setPref({ weekStart: Number(v) as 0 | 1 })}
                    options={[
                      { value: '1', label: 'Mon' },
                      { value: '0', label: 'Sun' },
                    ]}
                  />
                </View>
              }
            />
            <ListRow
              icon="device-mobile"
              title="Haptics"
              toggle={settings.haptics}
              onToggle={(haptics) => update({ haptics })}
            />
            <ListRow
              icon="confetti"
              title="Celebrations & confetti"
              toggle={settings.celebrations}
              onToggle={(celebrations) => update({ celebrations })}
              last
            />
          </ListGroup>
        </Section>

        <Section title="Notifications">
          {Platform.OS === 'web' ? (
            <Text variant="caption" tone="muted">
              Reminders run in the mobile app.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {perm !== 'granted' ? (
                <ListGroup>
                  <ListRow
                    icon="bell-slash"
                    iconColor={t.warning}
                    title="Notifications are off"
                    subtitle="Tap to allow reminders"
                    onPress={async () => {
                      const ok = await requestNotificationPermission();
                      if (!ok) Linking.openSettings();
                      setPerm(await notificationPermission());
                      rescheduleSoon(300);
                    }}
                    last
                  />
                </ListGroup>
              ) : null}
              <Segmented<NotifyStyle>
                value={settings.notifyStyle ?? 'coach'}
                onChange={(notifyStyle) => setPref({ notifyStyle })}
                options={[
                  { value: 'calm', label: 'Calm' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'coach', label: 'Coach' },
                ]}
              />
              <Text variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>
                {STYLE_COPY[settings.notifyStyle ?? 'coach']}
              </Text>
              <ListGroup>
                <ListRow
                  icon="sun-horizon"
                  title="Morning brief"
                  subtitle={settings.morningBrief.enabled ? formatTime(settings.morningBrief.time) : 'Off'}
                  toggle={settings.morningBrief.enabled}
                  onToggle={(enabled) => setPref({ morningBrief: { ...settings.morningBrief, enabled } })}
                />
                {settings.morningBrief.enabled ? (
                  <ListRow
                    icon="clock"
                    title="Brief time"
                    value={formatTime(settings.morningBrief.time)}
                    onPress={() => setTimeFor('morning')}
                  />
                ) : null}
                <ListRow
                  icon="moon"
                  title="Evening nudge"
                  subtitle={
                    settings.eveningNudge.enabled
                      ? `Only if something's left · ${formatTime(settings.eveningNudge.time)}`
                      : 'Off'
                  }
                  toggle={settings.eveningNudge.enabled}
                  onToggle={(enabled) => setPref({ eveningNudge: { ...settings.eveningNudge, enabled } })}
                />
                {settings.eveningNudge.enabled ? (
                  <ListRow
                    icon="clock"
                    title="Nudge time"
                    value={formatTime(settings.eveningNudge.time)}
                    onPress={() => setTimeFor('evening')}
                  />
                ) : null}
                <ListRow
                  icon="lightning"
                  title="Auto-tracking alerts"
                  subtitle="When a habit completes itself in the background"
                  toggle={settings.autoAlerts ?? true}
                  onToggle={(autoAlerts) => update({ autoAlerts })}
                />
                <ListRow
                  icon="moon-stars"
                  title="Quiet hours"
                  subtitle={
                    settings.quietHours?.enabled
                      ? `${formatTime(settings.quietHours.start)} – ${formatTime(settings.quietHours.end)} · your own reminder times still ring`
                      : 'Off'
                  }
                  toggle={settings.quietHours?.enabled ?? true}
                  onToggle={(enabled) => setPref({ quietHours: { ...settings.quietHours, enabled } })}
                />
                <ListRow
                  icon="paper-plane-tilt"
                  title="Send a test reminder"
                  subtitle="Arrives in 5 seconds. Try the Done button"
                  onPress={async () => {
                    const ok = await requestNotificationPermission();
                    if (!ok) return toast('Allow notifications first', { tone: 'error' });
                    const name = await sendTestReminder();
                    toast(name ? `Reminder for “${name}” on its way` : 'Add a habit first', { icon: 'bell' });
                  }}
                  last
                />
              </ListGroup>
            </View>
          )}
        </Section>

        {Platform.OS === 'android' ? (
          <Section title="Phone">
            <ListGroup>
              <ListRow
                icon="hourglass-high"
                title="Screen time & mindful pause"
                subtitle="See where your time goes, add a breath before apps that pull you in"
                onPress={() => router.push('/screen-time')}
              />
              <ListRow
                icon="battery-charging"
                title="Keep Ritual running"
                subtitle="Battery settings for reliable background tracking"
                onPress={() => router.push('/reliability')}
                last
              />
            </ListGroup>
          </Section>
        ) : null}

        {widgetSupported ? (
          <Section title="Home screen">
            <ListGroup>
              <ListRow
                icon="squares-four"
                title="Add the Today widget"
                subtitle="Your day ring on the home screen. Tap a habit there to complete it."
                onPress={async () => {
                  const ok = await pinTodayWidget();
                  if (!ok) toast('Long-press your home screen → Widgets → Ritual', { icon: 'squares-four' });
                }}
                last
              />
            </ListGroup>
          </Section>
        ) : null}

        <Section title="Data">
          <ListGroup>
            <ListRow
              icon="download-simple"
              title="Export my data"
              subtitle="All habits and history as JSON"
              onPress={exportData}
            />
            {demo ? (
              <ListRow
                icon="sign-out"
                title="Leave the demo"
                subtitle="Clear the sample data and go back to the start"
                onPress={leaveDemo}
                last
              />
            ) : !user ? (
              <ListRow
                icon="trash"
                danger
                title="Erase everything on this device"
                onPress={async () => {
                  if (
                    await confirmAsync(
                      'Erase all data?',
                      'Every habit, check-in and badge on this device will be deleted. This cannot be undone.',
                      'Erase',
                    )
                  ) {
                    useApp.getState().resetForUser(null);
                    continueAsGuest();
                    toast('Fresh start', { icon: 'sparkle' });
                    router.replace('/');
                  }
                }}
                last
              />
            ) : (
              <>
                <ListRow
                  icon="sign-out"
                  title="Sign out"
                  subtitle="Your data stays safe in the cloud"
                  onPress={async () => {
                    if (
                      await confirmAsync(
                        'Sign out?',
                        'Local data is cleared from this device after syncing.',
                        'Sign out',
                      )
                    ) {
                      await signOut().catch((e) => toast(e.message, { tone: 'error' }));
                    }
                  }}
                />
                <ListRow
                  icon="trash"
                  danger
                  title="Delete account"
                  subtitle="Permanently erase your account and all data"
                  onPress={() => router.push({ pathname: '/account', params: { delete: '1' } })}
                  last
                />
              </>
            )}
          </ListGroup>
        </Section>

        <Section title="About">
          <ListGroup>
            <ListRow icon="info" title="Version" value={`${Constants.expoConfig?.version ?? '2.0.0'}`} />
            <ListRow
              icon="github-logo"
              title="Source code"
              onPress={() => Linking.openURL('https://github.com/Apurba2509/Ritual')}
              last
            />
          </ListGroup>
          <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Logo size={18} />
            <Text variant="caption" tone="faint" align="center">
              Habits that track themselves. Made by Apurba Das.
            </Text>
          </View>
        </Section>
      </Screen>
      <TimeSheet
        visible={timeFor !== null}
        title={timeFor === 'morning' ? 'Morning brief' : 'Evening nudge'}
        initial={timeFor === 'morning' ? settings.morningBrief.time : settings.eveningNudge.time}
        onClose={() => setTimeFor(null)}
        onPick={(time) =>
          timeFor === 'morning'
            ? setPref({ morningBrief: { ...settings.morningBrief, time } })
            : setPref({ eveningNudge: { ...settings.eveningNudge, time } })
        }
      />
    </>
  );
}
