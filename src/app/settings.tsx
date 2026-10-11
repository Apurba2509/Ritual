import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import { signOut } from '@/data/auth';
import { continueAsGuest, useSession } from '@/data/session';
import { ThemePref, useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { formatTime, TimeSheet } from '@/features/habits/pickers';
import {
  sendTestReminder,
  notificationPermission,
  requestNotificationPermission,
  rescheduleSoon,
} from '@/features/notifications/scheduler';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

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
    await Share.share({ message: json, title: 'Ritual export' });
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
              icon="calendar"
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
              icon="smartphone"
              title="Haptics"
              toggle={settings.haptics}
              onToggle={(haptics) => update({ haptics })}
            />
            <ListRow
              icon="star"
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
            <ListGroup>
              {perm !== 'granted' ? (
                <ListRow
                  icon="bell-off"
                  iconColor={t.warning}
                  title="Notifications are off"
                  subtitle="Tap to allow reminders"
                  onPress={async () => {
                    const ok = await requestNotificationPermission();
                    if (!ok) Linking.openSettings();
                    setPerm(await notificationPermission());
                    rescheduleSoon(300);
                  }}
                />
              ) : null}
              <ListRow
                icon="send"
                title="Send a test reminder"
                subtitle="Arrives in 5 seconds — try the ✓ Done button"
                onPress={async () => {
                  const ok = await requestNotificationPermission();
                  if (!ok) return toast('Allow notifications first', { tone: 'error' });
                  const name = await sendTestReminder();
                  toast(name ? `Reminder for “${name}” on its way` : 'Add a habit first', { emoji: '🔔' });
                }}
              />
              <ListRow
                icon="sunrise"
                title="Morning brief"
                subtitle={settings.morningBrief.enabled ? `Daily at ${formatTime(settings.morningBrief.time)}` : 'Off'}
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
                title="Streak-at-risk nudge"
                subtitle={
                  settings.eveningNudge.enabled
                    ? `Only when habits are left · ${formatTime(settings.eveningNudge.time)}`
                    : 'Off'
                }
                toggle={settings.eveningNudge.enabled}
                onToggle={(enabled) => setPref({ eveningNudge: { ...settings.eveningNudge, enabled } })}
                last={!settings.eveningNudge.enabled}
              />
              {settings.eveningNudge.enabled ? (
                <ListRow
                  icon="clock"
                  title="Nudge time"
                  value={formatTime(settings.eveningNudge.time)}
                  onPress={() => setTimeFor('evening')}
                  last
                />
              ) : null}
            </ListGroup>
          )}
        </Section>

        <Section title="Data">
          <ListGroup>
            <ListRow
              icon="download"
              title="Export my data"
              subtitle="All habits and history as JSON"
              onPress={exportData}
            />
            {!user ? (
              <ListRow
                icon="trash-2"
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
                    toast('Fresh start', { emoji: '🧹' });
                    router.replace('/');
                  }
                }}
                last
              />
            ) : (
              <ListRow
                icon="log-out"
                danger
                title="Sign out"
                subtitle="Your data stays safe in the cloud"
                onPress={async () => {
                  if (
                    await confirmAsync('Sign out?', 'Local data is cleared from this device after syncing.', 'Sign out')
                  ) {
                    await signOut().catch((e) => toast(e.message, { tone: 'error' }));
                  }
                }}
                last
              />
            )}
          </ListGroup>
        </Section>

        <Section title="About">
          <ListGroup>
            <ListRow icon="info" title="Version" value={`${Constants.expoConfig?.version ?? '2.0.0'}`} />
            <ListRow
              icon="github"
              title="Source code"
              onPress={() => Linking.openURL('https://github.com/Apurba2509/Ritual')}
              last
            />
          </ListGroup>
          <Text variant="caption" tone="faint" align="center">
            Made with 🔥 by Apurba · Ritual, the habit tracker that tracks itself
          </Text>
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
