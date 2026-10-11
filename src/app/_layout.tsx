import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { InterTight_400Regular } from '@expo-google-fonts/inter-tight/400Regular';
import { InterTight_500Medium } from '@expo-google-fonts/inter-tight/500Medium';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { InterTight_700Bold } from '@expo-google-fonts/inter-tight/700Bold';
import { InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight/800ExtraBold';
import { useFonts } from 'expo-font';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useClockDriver } from '@/data/hooks';
import { startSession, useSession } from '@/data/session';
import { useForegroundTasks, useGamificationWatcher, useNotificationResponses } from '@/features/effects';
import '@/features/sensing/background';
import { CelebrationHost } from '@/features/gamification/CelebrationHost';
import { setupNotifications } from '@/features/notifications/scheduler';
import { useSocialLive } from '@/features/social/live';
import { ConfettiLayer } from '@/ui/Confetti';
import { LogoMark } from '@/ui/Logo';
import { brand, useTheme } from '@/ui/theme';
import { ToastHost } from '@/ui/Toasts';
import { WebFrame } from '@/ui/WebFrame';

SplashScreen.preventAutoHideAsync().catch(() => {});
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // The app scrolls inside its own ScrollViews; never let the document itself scroll.
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
}
setupNotifications().catch(() => {});

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: brand.ink,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
      }}
    >
      <LogoMark size={56} color={brand.bone} dot={brand.volt} />
      <Text style={{ color: brand.bone, fontSize: 22, fontWeight: '700', marginTop: 8 }}>Something broke</Text>
      <Text style={{ color: '#8F8F8A', textAlign: 'center', lineHeight: 20 }}>{error.message}</Text>
      <Text
        onPress={retry}
        style={{
          color: brand.ink,
          backgroundColor: brand.volt,
          fontWeight: '700',
          marginTop: 12,
          paddingHorizontal: 22,
          paddingVertical: 12,
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        Try again
      </Text>
    </View>
  );
}

function AppEffects() {
  useClockDriver();
  useGamificationWatcher();
  useNotificationResponses();
  useForegroundTasks();
  useSocialLive();
  return null;
}

export default function RootLayout() {
  const t = useTheme();
  const status = useSession((s) => s.status);
  const [fontsLoaded, fontError] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
    GeistMono_500Medium,
  });

  useEffect(() => {
    startSession();
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  const fontsReady = fontsLoaded || !!fontError;
  const booting = status === 'booting' || status === 'loading';

  useEffect(() => {
    if (fontsReady && status !== 'booting') SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, status]);

  if (!fontsReady || booting) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {status === 'loading' ? (
          <>
            <LogoMark size={52} />
            <ActivityIndicator color={t.textMuted} />
          </>
        ) : null}
      </View>
    );
  }

  const inApp = status === 'ready';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <WebFrame>
        <SafeAreaProvider>
          <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: t.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Protected guard={inApp}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="habit/[id]" />
              <Stack.Screen name="habit/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="log" options={{ presentation: 'transparentModal', animation: 'fade' }} />
              <Stack.Screen name="coach" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="focus/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
              <Stack.Screen name="integrations" />
              <Stack.Screen name="achievements" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="account" />
              <Stack.Screen name="friends" />
              <Stack.Screen name="user/[uid]" />
              <Stack.Screen name="challenge/[id]" />
              <Stack.Screen name="challenge/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="archive" />
              <Stack.Screen name="upgrade" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen
                name="workout"
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="activity/index" />
              <Stack.Screen name="activity/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'signedOut'}>
              <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            </Stack.Protected>
          </Stack>
          <AppEffects />
          <CelebrationHost />
          <ConfettiLayer />
          <ToastHost />
        </SafeAreaProvider>
      </WebFrame>
    </GestureHandlerRootView>
  );
}
