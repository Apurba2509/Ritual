import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface XPProgressBarProps {
  currentXP: number;
  minXP: number;
  maxXP: number;
  color?: string;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({ currentXP, minXP, maxXP, color = '#10B981' }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const totalRequired = maxXP - minXP;
    const currentEarned = currentXP - minXP;
    const percentage = Math.min(Math.max(currentEarned / totalRequired, 0), 1);
    progress.value = withSpring(percentage * 100, { damping: 15, stiffness: 90 });
  }, [currentXP, minXP, maxXP]);

  const rStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
    };
  });

  return (
    <View className="w-full">
      <View className="h-3 w-full bg-surface2 rounded-full overflow-hidden">
        <Animated.View 
          className="h-full rounded-full" 
          style={[{ backgroundColor: color }, rStyle]} 
        />
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="text-textSecondary text-xs">{currentXP} XP</Text>
        <Text className="text-textSecondary text-xs">{maxXP} XP</Text>
      </View>
    </View>
  );
};
