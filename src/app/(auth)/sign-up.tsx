import { router } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function SignUpScreen() {
  return (
    <Screen back title="Create your account">
      <Text tone="muted">Free forever. Your habits sync across devices and you can add friends.</Text>
      <AuthForm mode="signUp" onSwitch={() => router.replace('/(auth)/sign-in')} />
    </Screen>
  );
}
