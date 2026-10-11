import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
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
import { useApp } from '@/data/store';
import { useForegroundTasks, useGamificationWatcher, useNotificationResponses } from '@/features/effects';
import { CelebrationHost } from '@/features/gamification/CelebrationHost';
import { setupNotifications } from '@/features/notifications/scheduler';
import { useSocialLive } from '@/features/social/live';
import { ConfettiLayer } from '@/ui/Confetti';
import { useTheme } from '@/ui/theme';
import { ToastHost } from '@/ui/Toasts';

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
        backgroundColor: '#0A0A0F',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 44 }}>🫠</Text>
      <Text style={{ color: '#F5F5F7', fontSize: 20, fontWeight: '700' }}>Something broke</Text>
      <Text style={{ color: '#A1A1AC', textAlign: 'center' }}>{error.message}</Text>
      <Text onPress={retry} style={{ color: '#FF6A3D', fontWeight: '700', marginTop: 8 }}>
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
  const onboarded = useApp((s) => s.onboarded);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_600SemiBold,
    Outfit_700Bold,
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
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        {status === 'loading' ? <ActivityIndicator color={t.accent} /> : null}
      </View>
    );
  }

  const signedOut = status === 'signedOut';
  const inApp = status === 'ready' && onboarded;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
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
          </Stack.Protected>
          <Stack.Protected guard={status === 'ready' && !onboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={signedOut}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
        <AppEffects />
        <CelebrationHost />
        <ConfettiLayer />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
