import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { authErrorMessage, resetPassword } from '@/data/auth';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

export default function ForgotScreen() {
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

  return (
    <Screen back title="Reset password">
      {sent ? (
        <Card style={{ gap: 6 }}>
          <Text variant="heading">Check your inbox 📬</Text>
          <Text tone="muted">
            If an account exists for {email}, a reset link is on its way. It can take a minute — check spam too.
          </Text>
        </Card>
      ) : (
        <>
          <Text tone="muted">Enter your email and we’ll send you a link to set a new password.</Text>
          <TextField
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={error}
            onSubmitEditing={submit}
          />
          <Button
            title="Send reset link"
            size="lg"
            full
            loading={busy}
            disabled={!email.includes('@')}
            onPress={submit}
          />
        </>
      )}
    </Screen>
  );
}
