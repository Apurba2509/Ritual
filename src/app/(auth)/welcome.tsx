import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { continueAsGuest } from '@/data/session';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { WelcomeHero } from '@/features/auth/WelcomeHero';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Button } from '@/ui/Button';
import { useFrameWidth } from '@/ui/layout';
import { Logo } from '@/ui/Logo';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

export default function WelcomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const [error, setError] = useState<string | null>(null);
  // Sized so "track themselves." always fits on one line.
  const headline = Math.min(46, (width - 48) / 8.3);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + 14,
        paddingBottom: Math.max(insets.bottom, 12) + 12,
      }}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={{ paddingHorizontal: 24 }}>
        <Logo size={24} />
      </Animated.View>

      <WelcomeHero width={width} />

      <View style={{ paddingHorizontal: 24, gap: 22 }}>
        <Animated.View entering={FadeInUp.delay(250).springify().damping(18)} style={{ gap: 12 }}>
          <Text variant="display" size={headline} style={{ lineHeight: headline * 1.04 }}>
            Habits that{'\n'}track themselves.
          </Text>
          <Text tone="muted" size={16} style={{ lineHeight: 23 }}>
            Steps, workouts, commits and LeetCode check off on their own. For everything else, just say what you did.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).springify().damping(18)} style={{ gap: 10 }}>
          {isFirebaseConfigured ? (
            <>
              <GoogleButton onError={setError} />
              <Button
                title="Continue with email"
                icon="envelope-simple"
                variant="secondary"
                size="lg"
                full
                onPress={() => router.push('/(auth)/email')}
              />
              {error ? (
                <Text variant="caption" tone="danger" align="center">
                  {error}
                </Text>
              ) : null}
              <Button
                title="Look around first"
                variant="ghost"
                size="sm"
                onPress={() => continueAsGuest({ demo: true })}
                style={{ alignSelf: 'center', marginTop: 2 }}
              />
            </>
          ) : (
            <>
              <Button title="Get started" size="lg" full iconRight="arrow-right" onPress={() => continueAsGuest()} />
              <Button
                title="Explore with sample data"
                variant="ghost"
                size="sm"
                onPress={() => continueAsGuest({ demo: true })}
                style={{ alignSelf: 'center' }}
              />
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
