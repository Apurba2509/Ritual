import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function AuthLandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container} className="flex-1 justify-center px-6">
      <View className="items-center mb-16">
        <Text className="font-hero text-textPrimary text-6xl tracking-tighter mb-4">
          Ritual
        </Text>
        <Text className="font-body text-textSecondary text-center text-lg max-w-xs">
          Premium, focused, and deeply satisfying to interact with.
        </Text>
      </View>

      <Card elevated className="p-6">
        <Button
          title="Sign Up"
          variant="filled"
          className="mb-4"
          onPress={() => router.push('/(auth)/signup')}
        />
        <Button
          title="Log In"
          variant="ghost"
          onPress={() => router.push('/(auth)/login')}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0E14', // background
  },
});
