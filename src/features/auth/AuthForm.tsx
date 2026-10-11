import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { authErrorMessage, signIn, signUp } from '@/data/auth';
import { useApp } from '@/data/store';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Segmented } from '@/ui/Segmented';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, useTheme } from '@/ui/theme';
import { googleSupported } from '@/lib/googleAuth';
import { GoogleButton } from './GoogleButton';

export type AuthMode = 'signIn' | 'signUp';

/** Email + password, both directions in one place, with Google one tap below. */
export function AuthForm({ initialMode = 'signIn' }: { initialMode?: AuthMode }) {
  const t = useTheme();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  // A guest upgrading keeps the name they already gave us.
  const [name, setName] = useState(() => (useApp.getState().demo ? '' : useApp.getState().profile.displayName));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const signingUp = mode === 'signUp';

  const submit = async () => {
    setError(null);
    if (signingUp && !name.trim()) return setError('What should we call you?');
    if (!email.includes('@')) return setError('Enter your email address.');
    if (signingUp && password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      if (signingUp) await signUp({ email, password, displayName: name });
      else await signIn(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Segmented
        options={[
          { value: 'signIn', label: 'Sign in' },
          { value: 'signUp', label: 'Create account' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
      />
      <Animated.View layout={LinearTransition.springify().damping(22)} style={{ gap: 12, marginTop: 4 }}>
        {signingUp ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <TextField
              label="Name"
              icon="user"
              value={name}
              onChangeText={setName}
              placeholder="What should we call you?"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              maxLength={40}
            />
          </Animated.View>
        ) : null}
        <TextField
          ref={emailRef}
          label="Email"
          icon="envelope-simple"
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
          icon="lock-simple"
          value={password}
          onChangeText={setPassword}
          placeholder={signingUp ? 'At least 8 characters' : 'Your password'}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          textContentType={signingUp ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={submit}
          right={
            <Tap
              onPress={() => setShow(!show)}
              hitSlop={12}
              accessibilityLabel={show ? 'Hide password' : 'Show password'}
            >
              <Icon name={show ? 'eye-slash' : 'eye'} size={20} color={t.textMuted} weight="regular" />
            </Tap>
          }
        />
        {!signingUp ? (
          <Text
            variant="caption"
            weight="semibold"
            align="right"
            onPress={() => router.push({ pathname: '/(auth)/forgot', params: { email } })}
            suppressHighlighting
            style={{ paddingVertical: 2 }}
          >
            Forgot password?
          </Text>
        ) : null}
        {error ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: t.dangerSoft,
            }}
          >
            <Icon name="warning" size={18} color={t.danger} />
            <Text variant="caption" tone="danger" style={{ flex: 1 }}>
              {error}
            </Text>
          </Animated.View>
        ) : null}
        <Button
          title={signingUp ? 'Create account' : 'Sign in'}
          iconRight="arrow-right"
          size="lg"
          full
          loading={busy}
          onPress={submit}
          style={{ marginTop: 6 }}
        />
      </Animated.View>
      {googleSupported ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.borderStrong }} />
            <Text variant="caption" tone="faint">
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.borderStrong }} />
          </View>
          <GoogleButton onError={setError} />
        </>
      ) : null}
      {signingUp ? (
        <Text variant="caption" tone="faint" align="center" style={{ marginTop: 4 }}>
          You'll get a username automatically — change it any time.
        </Text>
      ) : null}
    </View>
  );
}
