import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { AuthForm } from '@/features/auth/AuthForm';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

/** Guests (and people exploring sample data) create an account from inside the app. */
export default function UpgradeScreen() {
  const t = useTheme();
  const user = useSession((s) => s.user);
  const demo = useApp((s) => s.demo);
  const hasHabits = useApp((s) => Object.values(s.habits).some((h) => !h.deleted));

  useEffect(() => {
    if (!user) return;
    toast('You’re signed in. Everything is synced.', { icon: 'cloud-check', tone: 'success' });
    if (router.canGoBack()) router.back();
  }, [user]);

  const perks: [Parameters<typeof Icon>[0]['name'], string][] = [
    ['cloud-check', 'Your streaks, backed up and synced across devices'],
    ['users-three', 'Friends, leaderboards and challenges'],
    ['sparkle', 'AI logging and your weekly review'],
  ];

  return (
    <Screen
      back="close"
      title={demo ? 'Start your own ritual' : 'Save your progress'}
      subtitle={
        demo
          ? 'The sample data is cleared when you sign in, so you start fresh.'
          : hasHabits
            ? 'Everything you’ve logged so far comes with you.'
            : undefined
      }
    >
      <View style={{ gap: 12, marginBottom: 4 }}>
        {perks.map(([icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.xs,
                backgroundColor: t.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={16} color={t.accentInk} />
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <AuthForm initialMode="signUp" />
    </Screen>
  );
}
