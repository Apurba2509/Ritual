import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, vec } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, withDelay, Easing, withRepeat, withSequence } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const PARTICLES = Array.from({ length: 40 }).map((_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height * 0.5,
  r: Math.random() * 6 + 2,
  color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF8C42', '#A05195'][Math.floor(Math.random() * 5)],
  delay: Math.random() * 500,
}));

export const ConfettiCelebration = ({ isActive }: { isActive: boolean }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 2500, easing: Easing.out(Easing.cubic) });
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {PARTICLES.map((p) => {
          // Calculate falling path
          return (
            <Circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.r}
              color={p.color}
              opacity={1}
            />
          );
        })}
      </Canvas>
    </View>
  );
};
