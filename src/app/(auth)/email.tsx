import { useLocalSearchParams } from 'expo-router';
import { AuthForm, AuthMode } from '@/features/auth/AuthForm';
import { Screen } from '@/ui/Screen';

export default function EmailAuthScreen() {
  const { mode } = useLocalSearchParams<{ mode?: AuthMode }>();
  return (
    <Screen back title="Welcome to Ritual" subtitle="Sign in to keep your streaks safe and synced across devices.">
      <AuthForm initialMode={mode === 'signUp' ? 'signUp' : 'signIn'} />
    </Screen>
  );
}
