import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { capabilities, openBatterySettings, SensingCapabilities } from '@/features/sensing';
import { RitualSensing } from '@/features/sensing/native';
import { Button } from '@/ui/Button';
import { Icon, IconName } from '@/ui/Icon';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

/** What each phone maker calls the switch that lets apps run in the background. */
function vendorGuide(manufacturer: string): { name: string; steps: string[]; slug: string } {
  const m = manufacturer.toLowerCase();
  if (/xiaomi|redmi|poco/.test(m))
    return {
      name: 'Xiaomi (HyperOS / MIUI)',
      slug: 'xiaomi',
      steps: [
        'Turn on Autostart for Ritual (the button below opens it).',
        'Settings → Apps → Ritual → Battery saver → No restrictions.',
        'Recent apps: pull Ritual down to lock it, so cleaning recents doesn’t close it.',
      ],
    };
  if (/samsung/.test(m))
    return {
      name: 'Samsung (One UI)',
      slug: 'samsung',
      steps: [
        'Settings → Apps → Ritual → Battery → Unrestricted.',
        'Settings → Battery → Background usage limits → Never sleeping apps → add Ritual.',
      ],
    };
  if (/oneplus|oppo|realme/.test(m))
    return {
      name: 'OnePlus / OPPO / realme (OxygenOS / ColorOS)',
      slug: 'oneplus',
      steps: [
        'Settings → Apps → Ritual → Battery → Allow background activity (and Auto launch).',
        'Settings → Battery → More settings → turn off “Optimise battery use” for Ritual.',
      ],
    };
  if (/vivo|iqoo/.test(m))
    return {
      name: 'vivo / iQOO',
      slug: 'vivo',
      steps: ['Settings → Battery → Background power consumption → Ritual → Allow.', 'Turn on Autostart for Ritual.'],
    };
  if (/huawei|honor/.test(m))
    return {
      name: 'Huawei / Honor',
      slug: 'huawei',
      steps: ['Phone Manager → App launch → Ritual → Manage manually → turn on all three switches.'],
    };
  return {
    name: manufacturer || 'Your phone',
    slug: 'google',
    steps: ['Settings → Apps → Ritual → Battery → Unrestricted.'],
  };
}

export default function ReliabilityScreen() {
  const t = useTheme();
  const [caps, setCaps] = useState<SensingCapabilities | null>(() => capabilities());
  const [notif, setNotif] = useState<string>('undetermined');
  const [checkedAt, setCheckedAt] = useState(() => Date.now());

  const refresh = useCallback(() => {
    setCaps(capabilities());
    setCheckedAt(Date.now());
    Notifications.getPermissionsAsync()
      .then((p) => setNotif(p.status))
      .catch(() => {});
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (Platform.OS !== 'android' || !caps) {
    return (
      <Screen back title="Keep Ritual running">
        <Text tone="muted">Background tracking runs on the Android app.</Text>
      </Screen>
    );
  }

  const guide = vendorGuide(caps.manufacturer);
  const lastCheck = caps.lastStepSnapshotAt ? checkedAt - caps.lastStepSnapshotAt : null;
  const stale = caps.stepsEnabled && lastCheck !== null && lastCheck > 3 * 3_600_000;

  const checks: { icon: IconName; title: string; ok: boolean; detail: string; fix?: () => void; fixLabel?: string }[] =
    [
      {
        icon: 'battery-charging',
        title: 'Battery: unrestricted',
        ok: caps.batteryUnrestricted,
        detail: caps.batteryUnrestricted ? 'Android won’t hold Ritual back.' : 'Android may delay background checks.',
        fix: openBatterySettings,
        fixLabel: 'Allow',
      },
      {
        icon: 'bell',
        title: 'Notifications',
        ok: notif === 'granted',
        detail: notif === 'granted' ? 'Reminders and the coach can reach you.' : 'Reminders can’t reach you.',
        fix: () => Linking.openSettings(),
        fixLabel: 'Open',
      },
      {
        icon: 'footprints',
        title: 'Background checks',
        ok: !stale,
        detail: !caps.stepsEnabled
          ? 'Step tracking is off.'
          : lastCheck === null
            ? 'Waiting for the first check.'
            : `Last ran ${lastCheck < 3_600_000 ? `${Math.max(1, Math.round(lastCheck / 60_000))} min` : `${Math.round(lastCheck / 3_600_000)} h`} ago.`,
      },
    ];

  return (
    <Screen back title="Keep Ritual running" subtitle="Some phones pause apps in the background to save battery.">
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          padding: 16,
          borderRadius: radius.lg,
          backgroundColor: t.accentSoft,
        }}
      >
        <Icon name="shield-check" size={20} color={t.scheme === 'dark' ? t.accent : t.accentInk} weight="fill" />
        <Text variant="caption" style={{ flex: 1 }}>
          <Text variant="caption" weight="bold">
            Nothing is lost if it happens.{' '}
          </Text>
          Your phone counts steps and records app use by itself; Ritual catches up the next time it runs. What can be
          late is a reminder or an “it completed itself” alert.
        </Text>
      </View>

      <Section title="Status">
        <ListGroup>
          {checks.map((c, i) => (
            <ListRow
              key={c.title}
              icon={c.ok ? 'check-circle' : 'warning'}
              iconColor={c.ok ? (t.scheme === 'dark' ? t.accent : t.accentInk) : t.warning}
              title={c.title}
              subtitle={c.detail}
              right={
                !c.ok && c.fix ? (
                  <Button size="sm" variant="secondary" title={c.fixLabel ?? 'Fix'} onPress={c.fix} />
                ) : undefined
              }
              last={i === checks.length - 1}
            />
          ))}
        </ListGroup>
      </Section>

      <Section title={guide.name}>
        <View style={{ gap: 10 }}>
          {guide.steps.map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', gap: 12 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: t.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="caption" size={11} weight="bold">
                  {i + 1}
                </Text>
              </View>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {step}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button
            title="Open autostart settings"
            size="sm"
            icon="arrow-up-right"
            onPress={() => RitualSensing?.openAutostartSettings()}
          />
          <Button
            title="Guide for this phone"
            size="sm"
            variant="ghost"
            icon="globe-simple"
            onPress={() => Linking.openURL(`https://dontkillmyapp.com/${guide.slug}`)}
          />
        </View>
      </Section>
    </Screen>
  );
}
