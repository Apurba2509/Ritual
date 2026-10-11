import { Stack } from 'expo-router';
import { useTheme } from '@/ui/theme';

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email" />
      <Stack.Screen name="forgot" />
    </Stack>
  );
}
