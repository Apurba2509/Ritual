import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { FontAwesome } from '@expo/vector-icons';

// Required for web browser auth flow
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErrorMessage(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setErrorMessage('Please verify your email address before logging in.');
      } else {
        setErrorMessage(error.message);
      }
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      setOauthLoading(provider);
      setErrorMessage(null);
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
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      setErrorMessage(`${provider} login is not fully configured yet. Please use Email/Password.`);
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
          <Text className="font-heading text-textPrimary text-4xl mb-2">Welcome Back</Text>
          <Text className="font-body text-textSecondary text-base">Your streak is waiting for you.</Text>
        </View>

        {errorMessage && (
          <View className="bg-danger/10 p-4 rounded-xl mb-6 border border-danger/20">
            <Text className="text-danger font-body text-sm text-center">{errorMessage}</Text>
          </View>
        )}

        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={(text) => { setEmail(text); setErrorMessage(null); }}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={(text) => { setPassword(text); setErrorMessage(null); }}
          secureTextEntry
        />

        <Button
          title="Log In"
          variant="gradient"
          className="mt-6"
          loading={loading && !oauthLoading}
          disabled={!email || !password || !!oauthLoading}
          onPress={handleLogin}
        />

        <View className="my-6 flex-row items-center justify-center">
          <View className="flex-1 h-[1px] bg-white/10" />
          <Text className="text-textSecondary mx-4">OR</Text>
          <View className="flex-1 h-[1px] bg-white/10" />
        </View>

        <Button
          title="Continue with Google"
          variant="outlined"
          className="mb-6"
          icon={<FontAwesome name="google" size={20} color="#F9FAFB" />}
          loading={oauthLoading === 'google'}
          disabled={!!oauthLoading || loading}
          onPress={() => handleOAuthLogin('google')}
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
