import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSequence, 
  withTiming, 
  withDelay, 
  runOnJS 
} from 'react-native-reanimated';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onHide: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onHide, duration = 3000 }) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSequence(
      withTiming(50, { duration: 300 }),
      withDelay(duration, withTiming(-100, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(onHide)();
        }
      }))
    );
    
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(duration, withTiming(0, { duration: 300 }))
    );
  }, [message]);

  const rStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-emerald-500';
      case 'error': return 'bg-rose-500';
      default: return 'bg-surface2';
    }
  };

  return (
    <Animated.View 
      style={rStyle} 
      className={`absolute top-0 left-6 right-6 p-4 rounded-2xl shadow-lg z-50 flex-row items-center justify-center border border-white/10 ${getBgColor()}`}
    >
      <Text className="text-white font-bold text-center">{message}</Text>
    </Animated.View>
  );
};
