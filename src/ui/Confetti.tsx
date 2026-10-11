import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useUI } from '@/data/ui';
import { useApp } from '@/data/store';

const COLORS = ['#FF6A3D', '#FBBF24', '#34D399', '#9D8CFF', '#38BDF8', '#FB7185', '#F5F5F7'];
const COUNT = 46;

interface Particle {
  x: number;
  drift: number;
  rotate: number;
  delay: number;
  size: number;
  color: string;
  round: boolean;
  duration: number;
}

function Piece({ p, height, seed }: { p: Particle; height: number; seed: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(p.delay, withTiming(1, { duration: p.duration, easing: Easing.out(Easing.quad) }));
  }, [seed, p, progress]);

  const style = useAnimatedStyle(() => {
    const v = progress.value;
    // launch upward, then fall with gravity
    const y = -height * 0.35 * Math.sin(Math.min(v * 2.2, 1) * Math.PI * 0.5) + v * v * height * 1.1;
    return {
      opacity: v === 0 ? 0 : 1 - Math.max(0, v - 0.75) * 4,
      transform: [
        { translateX: p.drift * v },
        { translateY: y },
        { rotate: `${p.rotate * v}deg` },
        { rotateX: `${v * 720}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: p.x,
          top: height * 0.55,
          width: p.size,
          height: p.round ? p.size : p.size * 0.45,
          borderRadius: p.round ? p.size / 2 : 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

/** Full-screen confetti burst. Fire it from anywhere with `useUI.getState().burst()`. */
export function ConfettiLayer() {
  const seed = useUI((s) => s.confetti);
  const enabled = useApp((s) => s.settings.celebrations);
  const { width, height } = useWindowDimensions();

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: width / 2 + (Math.random() - 0.5) * 60,
        drift: (Math.random() - 0.5) * width * 1.1,
        rotate: (Math.random() - 0.5) * 900,
        delay: Math.random() * 120,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
        duration: 1300 + Math.random() * 700,
      })),
    // regenerate per burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, width],
  );

  if (seed === 0 || !enabled) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]}>
      {particles.map((p, i) => (
        <Piece key={`${seed}-${i}`} p={p} height={height} seed={seed} />
      ))}
    </View>
  );
}
