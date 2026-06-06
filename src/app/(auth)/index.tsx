import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay } from 'react-native-reanimated';

const { height } = Dimensions.get('window');

export default function AuthLandingScreen() {
  const router = useRouter();
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
    opacity.value = withTiming(1, { duration: 800 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <View style={styles.container} className="flex-1 justify-between px-6 pb-12 pt-24">
      <Animated.View style={animatedStyle} className="items-center mt-20">
        <Text className="font-hero text-textPrimary text-6xl tracking-tighter mb-4 text-center">
          Ritual
        </Text>
        <Text className="font-body text-textSecondary text-center text-lg max-w-xs leading-relaxed">
          Premium, focused, and deeply satisfying to interact with.
        </Text>
      </Animated.View>

      <Animated.View style={animatedStyle} className="w-full">
        <Button
          title="Sign Up"
          variant="gradient"
          className="mb-6 shadow-lg shadow-primary/20"
          onPress={() => router.push('/(auth)/signup')}
        />
        <Button
          title="Log In"
          variant="ghost"
          onPress={() => router.push('/(auth)/login')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0E14', // background
  },
});
