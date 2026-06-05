import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

// Required for web browser auth flow
WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!email || !password || !username) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        }
      }
    });
    setLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message);
    } else {
      if (data.session) {
        // Logged in
      } else {
        Alert.alert('Success', 'Please check your email to verify your account.');
      }
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      setOauthLoading(provider);
      const redirectUrl = Linking.createURL('/(tabs)');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success') {
          // Supabase auth listener handles session extraction from URL automatically
        }
      }
    } catch (error: any) {
      Alert.alert(`${provider} Login Failed`, error.message);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-10">
          <Text className="font-heading text-textPrimary text-4xl mb-2">Create Account</Text>
          <Text className="font-body text-textSecondary text-base">Start building your Ritual today.</Text>
        </View>

        <Input
          label="Username"
          placeholder="Choose a unique username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Input
          label="Password"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          title="Sign Up"
          className="mt-6"
          loading={loading && !oauthLoading}
          disabled={!email || !password || !username || !!oauthLoading}
          onPress={handleSignup}
        />

        <View className="my-6 flex-row items-center justify-center">
          <View className="flex-1 h-[1px] bg-white/10" />
          <Text className="text-textSecondary mx-4">OR</Text>
          <View className="flex-1 h-[1px] bg-white/10" />
        </View>

        <Button
          title="Sign Up with Google"
          variant="outlined"
          className="mb-4"
          loading={oauthLoading === 'google'}
          disabled={!!oauthLoading || loading}
          onPress={() => handleOAuthLogin('google')}
        />

        <Button
          title="Sign Up with Apple"
          variant="outlined"
          className="mb-6"
          loading={oauthLoading === 'apple'}
          disabled={!!oauthLoading || loading}
          onPress={() => handleOAuthLogin('apple')}
        />

        <Button
          title="Back"
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E14',
  },
});
