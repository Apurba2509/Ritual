import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useUIStore } from '../../stores/uiStore';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

export const CelebrationModal = () => {
  const { celebrationData, dismissCelebration } = useUIStore();
  const visible = !!celebrationData;

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      
      // Auto dismiss after 4s
      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(dismissCelebration)();
    });
    scale.value = withTiming(0.8, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Pressable style={styles.container} onPress={handleDismiss}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        
        {/* React Native Skia Confetti placeholder since actual Skia confetti logic is large and would go into a dedicated Skia component */}
        <View style={StyleSheet.absoluteFill} className="items-center justify-center pointer-events-none">
           {/* Confetti canvas would render here */}
        </View>

        <Animated.View style={[styles.modalCard, animatedStyle]} className="bg-surface2 border border-white/10">
          <Text className="text-6xl mb-4">🔥</Text>
          <Text className="font-hero text-textPrimary text-4xl mb-2 text-center">
            {celebrationData?.streakCount} Day Streak!
          </Text>
          <Text className="font-body text-textSecondary text-center">
            {celebrationData?.message || "You're on fire. Keep it up!"}
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(12, 14, 20, 0.8)',
  },
  modalCard: {
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  }
});
