import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface CompletionButtonProps {
  completed: boolean;
  color: string;
  onToggle: () => void;
  size?: number;
}

export const CompletionButton = ({ completed, color, onToggle, size = 32 }: CompletionButtonProps) => {
  const scale = useSharedValue(1);
  const progress = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(completed ? 1 : 0, { damping: 14, stiffness: 120 });
  }, [completed]);

  const handlePress = () => {
    // scale 0.92 -> 1.08 -> 1.0
    scale.value = withSequence(
      withTiming(0.92, { duration: 50 }),
      withSpring(1.08, { damping: 12, stiffness: 200 }),
      withSpring(1.0, { damping: 12, stiffness: 200 })
    );
    onToggle();
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['transparent', color]
      ),
      borderColor: interpolateColor(
        progress.value,
        [0, 1],
        ['rgba(255,255,255,0.2)', color]
      ),
    };
  });

  return (
    <Pressable onPress={handlePress} hitSlop={12}>
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          animatedStyle,
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
  },
});
