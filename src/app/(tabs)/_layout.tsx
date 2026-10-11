import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/data/session';
import { useSocial } from '@/features/social/live';
import { Icon, IconName } from '@/ui/Icon';
import { MAX_COLUMN, useFrameWidth } from '@/ui/layout';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, shadow, useTheme } from '@/ui/theme';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'house', label: 'Today' },
  insights: { icon: 'chart-bar', label: 'Insights' },
  social: { icon: 'users-three', label: 'Friends' },
  profile: { icon: 'user-circle', label: 'You' },
};

const ACTIONS: { icon: IconName; title: string; body: string; href: Parameters<typeof router.push>[0] }[] = [
  { icon: 'sparkle', title: 'Log with words', body: '“Ran 5k, read 20 pages”', href: '/log' },
  { icon: 'plus-circle', title: 'New habit', body: 'Template or from scratch', href: '/habit/edit' },
  { icon: 'person-simple-run', title: 'Record workout', body: 'GPS, elevation, steps', href: '/workout' },
  { icon: 'magic-wand', title: 'AI coach', body: 'Turn a goal into a plan', href: '/coach' },
];

function QuickActions({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const go = (href: Parameters<typeof router.push>[0]) => {
    onClose();
    setTimeout(() => router.push(href), 180);
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: 4 }}>
        {ACTIONS.map((a, i) => (
          <Tap
            key={a.title}
            onPress={() => go(a.href)}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={a.title}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: i === 0 ? t.accent : t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={a.icon} size={22} color={i === 0 ? t.onAccent : t.text} weight="fill" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="subheading">{a.title}</Text>
              <Text variant="caption" tone="muted">
                {a.body}
              </Text>
            </View>
            <Icon name="caret-right" size={16} color={t.textFaint} />
          </Tap>
        ))}
      </View>
    </Sheet>
  );
}

function TabItem({
  icon,
  label,
  focused,
  badge,
  onPress,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
  badge: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const dot = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    dot.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 260 });
  }, [focused, dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value, transform: [{ scale: 0.4 + dot.value * 0.6 }] }));
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.88}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 58, gap: 5 }}
    >
      <View>
        <Icon name={icon} size={25} color={focused ? t.text : t.textFaint} weight={focused ? 'fill' : 'regular'} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -1,
              right: -4,
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: t.danger,
              borderWidth: 2,
              borderColor: t.tabBar,
            }}
          />
        ) : null}
      </View>
      <Animated.View
        style={[
          { width: 5, height: 5, borderRadius: 3, backgroundColor: t.scheme === 'dark' ? t.accent : t.accentInk },
          dotStyle,
        ]}
      />
    </Tap>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const [open, setOpen] = useState(false);
  const uid = useSession((s) => s.user?.uid);
  const pending = useSocial(
    (s) =>
      s.friendships.filter((f) => f.status === 'pending' && f.requester !== uid).length +
      s.inbox.filter((i) => !i.read).length,
  );
  const barShadow = shadow('#000000', t.scheme === 'dark' ? 0.55 : 0.12, 30, 12);

  return (
    <>
      <View
        style={{
          pointerEvents: 'box-none',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: Math.max(insets.bottom, 12),
          alignItems: 'center',
        }}
      >
        {/* Content fades out before it reaches the floating bar instead of sliding under it. */}
        <LinearGradient
          colors={[`${t.bg}00`, t.bg]}
          locations={[0, 0.5]}
          style={{ position: 'absolute', left: 0, right: 0, top: -36, bottom: 0, pointerEvents: 'none' }}
        />
        <View
          style={{
            pointerEvents: 'box-none',
            width: Math.min(width, MAX_COLUMN),
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 62,
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: radius.pill,
              backgroundColor: t.tabBar,
              borderWidth: 1,
              borderColor: t.borderStrong,
              paddingHorizontal: 8,
              ...barShadow,
            }}
          >
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const tab = TABS[route.name] ?? { icon: 'sparkle' as IconName, label: route.name };
              return (
                <TabItem
                  key={route.key}
                  icon={tab.icon}
                  label={tab.label}
                  focused={focused}
                  badge={route.name === 'social' && pending > 0}
                  onPress={() => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                  }}
                />
              );
            })}
          </View>
          <Tap
            onPress={() => setOpen(true)}
            scaleTo={0.88}
            haptics="medium"
            accessibilityLabel="Create"
            accessibilityRole="button"
            style={{
              width: 62,
              height: 62,
              borderRadius: 31,
              backgroundColor: t.text,
              alignItems: 'center',
              justifyContent: 'center',
              ...barShadow,
            }}
          >
            <Icon name="plus" size={26} color={t.bg} weight="bold" />
          </Tap>
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
