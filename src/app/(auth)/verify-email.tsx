import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/ui/Button';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <View style={styles.container} className="flex-1 justify-center px-6">
      <View className="items-center mb-10">
        <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-6">
          <Text className="text-4xl">✉️</Text>
        </View>
        <Text className="font-heading text-textPrimary text-3xl mb-4 text-center">
          Check your inbox
        </Text>
        <Text className="font-body text-textSecondary text-base text-center leading-relaxed">
          We've sent a verification link to
        </Text>
        <Text className="font-heading text-textPrimary text-base mt-1 mb-4">
          {email || 'your email address'}
        </Text>
        <Text className="font-body text-textSecondary text-sm text-center">
          Please tap the link in that email to activate your account and start your Ritual.
        </Text>
      </View>

      <Button
        title="I've verified my email"
        onPress={() => router.push('/(auth)/login')}
        className="mb-4"
      />
      
      <Button
        title="Back to login"
        variant="ghost"
        onPress={() => router.push('/(auth)/login')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E14',
  },
});
