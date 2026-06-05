import '../../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { CelebrationModal } from '../components/gamification/CelebrationModal';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Outfit_700Bold } from '@expo-google-fonts/outfit';

const queryClient = new QueryClient();

import { registerBackgroundTasks } from '../lib/backgroundTasks';
import { useRealtime } from '../hooks/useRealtime';

// Register background fetch early
registerBackgroundTasks();

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <CelebrationModal />
        <StatusBar style="light" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
