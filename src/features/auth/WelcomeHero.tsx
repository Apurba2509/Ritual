import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon, IconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { alpha, cardShadow, radius, tint, useTheme } from '@/ui/theme';

interface HeroItem {
  icon: IconName;
  color: string;
  title: string;
  meta: string;
  source: IconName;
  done: boolean;
}

const ITEMS: HeroItem[] = [
  {
    icon: 'person-simple-run',
    color: 'coral',
    title: 'Morning run',
    meta: '5.2 km · tracked offline',
    source: 'device-mobile',
    done: true,
  },
  {
    icon: 'git-commit',
    color: 'sky',
    title: 'Ship code',
    meta: '4 commits · GitHub',
    source: 'github-logo',
    done: true,
  },
  {
    icon: 'book-open-text',
    color: 'butter',
    title: 'Read 20 pages',
    meta: '“read 20 pages” · AI',
    source: 'sparkle',
    done: false,
  },
];

const TILT = [-3, 2.2, -1.4];
const SHIFT = [-6, 8, -2];

function HeroCard({ item, index, done }: { item: HeroItem; index: number; done: boolean }) {
  const t = useTheme();
  const float = useSharedValue(0);
  const pop = useSharedValue(1);
  const c = tint(item.color, t);

  useEffect(() => {
    float.value = withDelay(
      index * 400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [float, index]);

  useEffect(() => {
    if (done && !item.done) {
      pop.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 }));
    }
  }, [done, item.done, pop]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: SHIFT[index] }, { translateY: float.value * -6 }, { rotate: `${TILT[index]}deg` }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 130)
        .springify()
        .damping(16)}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            paddingRight: 14,
            borderRadius: radius.lg,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.borderStrong,
            ...cardShadow(t),
          },
          style,
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: alpha(c, t.scheme === 'dark' ? 0.15 : 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={item.icon} size={23} color={c} weight="duotone" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subheading">{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name={item.source} size={12} color={t.textMuted} weight="fill" />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {item.meta}
            </Text>
          </View>
        </View>
        <Animated.View
          style={[
            {
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: done ? t.accent : 'transparent',
              borderWidth: done ? 0 : 2,
              borderColor: t.borderStrong,
            },
            checkStyle,
          ]}
        >
          {done ? <Icon name="check" size={18} color={t.onAccent} /> : null}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** Product-as-hero: three habits checking themselves off, one by AI a beat later. */
export function WelcomeHero({ width }: { width: number }) {
  const t = useTheme();
  const [lastDone, setLastDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLastDone(true), 1900);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', minHeight: 230 }}>
      <Svg width={width} height={360} style={{ position: 'absolute', alignSelf: 'center' }} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop
              offset="0"
              stopColor={t.scheme === 'dark' ? t.accent : t.accentInk}
              stopOpacity={t.scheme === 'dark' ? 0.17 : 0.1}
            />
            <Stop offset="1" stopColor={t.bg} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={360} fill="url(#glow)" />
      </Svg>
      <View style={{ gap: 12, paddingHorizontal: 30 }}>
        {ITEMS.map((item, i) => (
          <HeroCard key={item.title} item={item} index={i} done={item.done || lastDone} />
        ))}
      </View>
    </View>
  );
}
