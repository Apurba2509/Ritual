import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { authErrorMessage, normalizeUsername, signIn, signUp, USERNAME_RE } from '@/data/auth';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { Button } from '@/ui/Button';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';

export function AuthForm({ mode, onSwitch }: { mode: 'signUp' | 'signIn'; onSwitch: () => void }) {
  const t = useTheme();
  // A guest upgrading keeps the name they already gave us.
  const [name, setName] = useState(() => useApp.getState().profile.displayName);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const userRef = useRef<TextInput>(null);

  const handle = normalizeUsername(username);
  const usernameError = username && !USERNAME_RE.test(handle) ? '3–20 characters: letters, numbers, _ or .' : null;

  const submit = async () => {
    setError(null);
    if (mode === 'signUp') {
      if (!name.trim()) return setError('What should we call you?');
      if (!USERNAME_RE.test(handle)) return setError('Pick a username (3–20 characters: letters, numbers, _ or .)');
      if (password.length < 8) return setError('Use at least 8 characters for your password.');
    }
    setBusy(true);
    try {
      if (mode === 'signUp') {
        await signUp({ email, password, displayName: name, username: handle });
        toast(`Welcome to Ritual, ${name.split(' ')[0]}!`, { emoji: '🔥', tone: 'success' });
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {mode === 'signUp' ? (
        <>
          <TextField
            label="Your name"
            icon="smile"
            value={name}
            onChangeText={setName}
            placeholder="Apurba"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => userRef.current?.focus()}
            maxLength={40}
          />
          <TextField
            ref={userRef}
            label="Username"
            icon="at-sign"
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
            placeholder="apurba"
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError}
            hint="Friends find you with this."
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            maxLength={20}
          />
        </>
      ) : null}
      <TextField
        ref={emailRef}
        label="Email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
      />
      <TextField
        ref={passRef}
        label="Password"
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder={mode === 'signUp' ? 'At least 8 characters' : 'Your password'}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
        textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
        returnKeyType="go"
        onSubmitEditing={submit}
        right={
          <Tap
            onPress={() => setShow(!show)}
            hitSlop={10}
            accessibilityLabel={show ? 'Hide password' : 'Show password'}
          >
            <Text variant="caption" tone="muted">
              {show ? 'Hide' : 'Show'}
            </Text>
          </Tap>
        }
      />
      {error ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: t.dangerSoft }}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </View>
      ) : null}
      <Button title={mode === 'signUp' ? 'Create account' : 'Sign in'} size="lg" full loading={busy} onPress={submit} />
      {mode === 'signIn' ? (
        <Tap
          onPress={() => router.push({ pathname: '/(auth)/forgot', params: { email } })}
          style={{ alignSelf: 'center' }}
        >
          <Text variant="caption" tone="muted">
            Forgot password?
          </Text>
        </Tap>
      ) : null}
      <Tap onPress={onSwitch} style={{ alignSelf: 'center', padding: 6 }}>
        <Text variant="caption" tone="muted">
          {mode === 'signUp' ? 'Already have an account? ' : 'New here? '}
          <Text variant="caption" tone="accent" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {mode === 'signUp' ? 'Sign in' : 'Create an account'}
          </Text>
        </Text>
      </Tap>
    </View>
  );
}
