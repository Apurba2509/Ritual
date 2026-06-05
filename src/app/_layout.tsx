import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CelebrationModal } from '../components/gamification/CelebrationModal';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Outfit_700Bold } from '@expo-google-fonts/outfit';

const queryClient = new QueryClient();

import { registerBackgroundTasks } from '../lib/backgroundTasks';
import { useRealtime } from '../hooks/useRealtime';

// Register background fetch early
registerBackgroundTasks();

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  // Connect to realtime feed globally
  useRealtime();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0C0E14' } }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <CelebrationModal />
          <StatusBar style="light" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
