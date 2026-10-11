import { router } from 'expo-router';
import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { continueAsGuest } from '@/data/session';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Button } from '@/ui/Button';
import { Icon, IconName } from '@/ui/Icon';
import { ProgressRing } from '@/ui/ProgressRing';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';

const ORBIT = ['💧', '📖', '🏃', '🧘', '👨‍💻', '😴', '🧩', '✍️'];

function Orbit({ size }: { size: number }) {
  const t = useTheme();
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1);
  }, [spin]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360}deg` }] }));
  const r = size / 2 - 22;
  return (
    <Animated.View style={[{ width: size, height: size }, ring]}>
      {ORBIT.map((e, i) => {
        const a = (i / ORBIT.length) * Math.PI * 2;
        return (
          <Animated.View
            key={e}
            style={[
              {
                position: 'absolute',
                left: size / 2 + Math.cos(a) * r - 22,
                top: size / 2 + Math.sin(a) * r - 22,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.border,
              },
              counter,
            ]}
          >
            <Text size={22}>{e}</Text>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

function Feature({ icon, title, body, delay }: { icon: IconName; title: string; body: string; delay: number }) {
  const t = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(18)}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: t.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={16} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const orbit = Math.min(width - 40, height * 0.34, 340);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 24,
      }}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center', height: orbit + 10 }}>
        <View
          style={{
            position: 'absolute',
            width: orbit * 0.7,
            height: orbit * 0.7,
            borderRadius: orbit,
            backgroundColor: alpha(t.accent, 0.12),
          }}
        />
        <Orbit size={orbit} />
        <View style={{ position: 'absolute' }}>
          <ProgressRing
            progress={0.78}
            size={orbit * 0.42}
            stroke={10}
            color={t.accent}
            colorEnd="#FBBF24"
            duration={1600}
          >
            <Text size={orbit * 0.12}>🔥</Text>
          </ProgressRing>
        </View>
      </View>

      <Animated.View entering={FadeInUp.springify().damping(16)} style={{ gap: 6, marginTop: 8 }}>
        <Text variant="hero" size={46}>
          Ritual
        </Text>
        <Text variant="heading" tone="muted">
          The habit tracker that tracks itself.
        </Text>
      </Animated.View>

      <View style={{ gap: 14, marginTop: 22 }}>
        <Feature
          icon="zap"
          title="Auto-tracking"
          body="GitHub commits, LeetCode, steps, workouts and sleep check themselves off."
          delay={120}
        />
        <Feature
          icon="message-circle"
          title="Just say what you did"
          body="“Ran 5k and read 20 pages” — logged by AI."
          delay={200}
        />
        <Feature
          icon="users"
          title="Streaks, XP & friends"
          body="Level up, earn badges, and take on challenges together."
          delay={280}
        />
      </View>

      <View style={{ flex: 1 }} />

      <Animated.View entering={FadeInDown.delay(350)} style={{ gap: 10 }}>
        {isFirebaseConfigured ? (
          <>
            <Button
              title="Get started"
              size="lg"
              full
              iconRight="arrow-right"
              onPress={() => router.push('/(auth)/sign-up')}
            />
            <Button
              title="I already have an account"
              size="lg"
              variant="secondary"
              full
              onPress={() => router.push('/(auth)/sign-in')}
            />
            <Button title="Try it without an account" variant="ghost" onPress={continueAsGuest} />
          </>
        ) : (
          <>
            <Button title="Start building habits" size="lg" full iconRight="arrow-right" onPress={continueAsGuest} />
            <Text variant="caption" tone="faint" align="center">
              Offline mode — your data stays on this device.
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}
