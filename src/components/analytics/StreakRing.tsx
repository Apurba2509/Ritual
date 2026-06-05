import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import Animated, { useSharedValue, withTiming, Easing, useAnimatedProps } from 'react-native-reanimated';

interface StreakRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export const StreakRing: React.FC<StreakRingProps> = ({ 
  progress, 
  size = 120, 
  strokeWidth = 12,
  color = '#10B981'
}) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  
  const path = Skia.Path.Make();
  path.addCircle(center, center, radius);

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Canvas style={{ width: size, height: size, position: 'absolute' }}>
        {/* Background Ring */}
        <Path
          path={path}
          color="rgba(255,255,255,0.05)"
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
        {/* Foreground Animated Ring */}
        <Path
          path={path}
          color={color}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          start={0}
          end={animatedProgress}
        />
      </Canvas>
    </View>
  );
};
