import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  className?: string;
  style?: any;
}

export const FadeIn = ({
  children,
  delay = 0,
  direction = 'up',
  duration = 500,
  className,
  style,
}: FadeInProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(direction === 'up' ? 20 : direction === 'down' ? -20 : 0);
  const translateX = useSharedValue(direction === 'left' ? 20 : direction === 'right' ? -20 : 0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration }));
    
    if (direction !== 'none') {
      const springConfig = { damping: 15, stiffness: 100 };
      translateY.value = withDelay(delay, withSpring(0, springConfig));
      translateX.value = withDelay(delay, withSpring(0, springConfig));
    }
  }, [delay, direction, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
      ],
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]} className={className}>
      {children}
    </Animated.View>
  );
};
