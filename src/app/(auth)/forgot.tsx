import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { authErrorMessage, resetPassword } from '@/data/auth';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { goBack, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, useTheme } from '@/ui/theme';

export default function ForgotScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <Screen back>
        <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'flex-start', gap: 14, marginTop: 24 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.lg,
              backgroundColor: t.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="paper-plane-tilt" size={30} color={t.onAccent} weight="fill" />
          </View>
          <Text variant="title">Check your inbox</Text>
          <Text tone="muted">
            If an account exists for {email}, a reset link is on its way. It can take a minute, so check spam too.
          </Text>
          <Button title="Back to sign in" variant="secondary" onPress={goBack} style={{ marginTop: 8 }} />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen back title="Reset password" subtitle="Enter your email and we’ll send you a link to set a new one.">
      <TextField
        label="Email"
        icon="envelope-simple"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={error}
        onSubmitEditing={submit}
        autoFocus
      />
      <Button title="Send reset link" size="lg" full loading={busy} disabled={!email.includes('@')} onPress={submit} />
    </Screen>
  );
}
