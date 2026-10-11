import { router } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function SignInScreen() {
  return (
    <Screen back title="Welcome back">
      <Text tone="muted">Your streaks missed you.</Text>
      <AuthForm mode="signIn" onSwitch={() => router.replace('/(auth)/sign-up')} />
    </Screen>
  );
}
