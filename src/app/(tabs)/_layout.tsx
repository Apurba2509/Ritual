import { router } from 'expo-router';
import { BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSocial } from '@/features/social/live';
import { useSession } from '@/data/session';
import { Icon, IconName } from '@/ui/Icon';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, radius, useTheme, shadow } from '@/ui/theme';

const ICONS: Record<string, IconName> = {
  index: 'sun',
  insights: 'bar-chart-2',
  social: 'users',
  profile: 'user',
};

const LABELS: Record<string, string> = {
  index: 'Today',
  insights: 'Insights',
  social: 'Social',
  profile: 'You',
};

function QuickActions({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const go = (href: Parameters<typeof router.push>[0]) => {
    onClose();
    setTimeout(() => router.push(href), 180);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Quick actions">
      <ListGroup>
        <ListRow
          icon="message-circle"
          title="Tell Ritual what you did"
          subtitle="“Ran 5k and read 20 pages” → logged"
          onPress={() => go('/log')}
        />
        <ListRow
          icon="plus-circle"
          title="New habit"
          subtitle="Start from a template or scratch"
          onPress={() => go('/habit/edit')}
        />
        <ListRow
          icon="compass"
          iconColor="#9D8CFF"
          title="AI coach"
          subtitle="Turn a goal into a habit plan"
          onPress={() => go('/coach')}
        />
        <ListRow
          icon="zap"
          iconColor="#34D399"
          title="Auto-tracking"
          subtitle="GitHub, LeetCode, Health Connect"
          onPress={() => go('/integrations')}
          last
        />
      </ListGroup>
    </Sheet>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const uid = useSession((s) => s.user?.uid);
  const pending = useSocial(
    (s) =>
      s.friendships.filter((f) => f.status === 'pending' && f.requester !== uid).length +
      s.inbox.filter((i) => !i.read).length,
  );

  const tab = (route: (typeof state.routes)[number], index: number) => {
    const focused = state.index === index;
    return (
      <Tap
        key={route.key}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        scaleTo={0.9}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={LABELS[route.name]}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: 56 }}
      >
        <View>
          <Icon name={ICONS[route.name] ?? 'circle'} size={21} color={focused ? t.text : t.textFaint} />
          {route.name === 'social' && pending > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -3,
                right: -6,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: t.accent,
                borderWidth: 1.5,
                borderColor: t.surface,
              }}
            />
          ) : null}
        </View>
        <Text
          variant="caption"
          size={10}
          tone={focused ? 'default' : 'faint'}
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          {LABELS[route.name]}
        </Text>
      </Tap>
    );
  };

  return (
    <>
      <View
        style={{
          pointerEvents: 'box-none',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: radius.xl,
            backgroundColor: t.scheme === 'dark' ? alpha('#16161F', 0.97) : alpha('#FFFFFF', 0.98),
            borderWidth: 1,
            borderColor: t.borderStrong,
            paddingHorizontal: 6,
            ...shadow('#000000', t.scheme === 'dark' ? 0.5 : 0.12, 24, 10),
          }}
        >
          {state.routes.slice(0, 2).map((r, i) => tab(r, i))}
          <View style={{ width: 64, alignItems: 'center' }}>
            <Tap
              onPress={() => setOpen(true)}
              scaleTo={0.88}
              haptics="medium"
              accessibilityLabel="Quick actions"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[t.accent, t.emberDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="plus" size={26} color="#FFFFFF" />
              </LinearGradient>
            </Tap>
          </View>
          {state.routes.slice(2).map((r, i) => tab(r, i + 2))}
        </View>
      </View>
      <QuickActions visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="social" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
