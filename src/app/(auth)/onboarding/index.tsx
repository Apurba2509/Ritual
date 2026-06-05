import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Button } from '../../../components/ui/Button';

export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <View style={styles.container} className="flex-1 px-6 justify-between pt-20 pb-12">
      <View className="items-center">
        <Animated.Text 
          entering={FadeInDown.springify().damping(12).mass(0.9)}
          className="font-hero text-textPrimary text-4xl mb-4 text-center"
        >
          Welcome to Ritual
        </Animated.Text>
        
        <Animated.Text 
          entering={FadeInDown.springify().damping(12).mass(0.9).delay(100)}
          className="font-body text-textSecondary text-lg text-center max-w-xs"
        >
          Let's build a system that makes consistency inevitable.
        </Animated.Text>
      </View>

      <Animated.View 
        entering={FadeInUp.springify().damping(14).delay(300)}
        className="items-center justify-center flex-1"
      >
        <View style={styles.floatingCardPlaceholder}>
          <Text className="text-textSecondary font-stat">Animated Hero</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.springify().damping(12).delay(500)}>
        <Button 
          title="Let's Go" 
          onPress={() => router.push('/(auth)/onboarding/step-goals')} 
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0E14',
  },
  floatingCardPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  }
});
