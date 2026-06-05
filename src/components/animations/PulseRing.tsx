import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';
import { View } from 'react-native';

interface PulseRingProps {
  color: string;
  size?: number;
}

export const PulseRing = ({ color, size = 60 }: PulseRingProps) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1.5]) }],
      opacity: interpolate(progress.value, [0, 0.8, 1], [0.8, 0, 0]),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          zIndex: -1,
        },
        animatedStyle,
      ]}
    />
  );
};
