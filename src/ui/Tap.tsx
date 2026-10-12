import { forwardRef } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TapProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far the element shrinks while pressed (kept subtle: never below 0.95). */
  scaleTo?: number;
  /**
   * Haptic on press. Off by default: haptics are reserved for moments that mean something
   * (completing a habit, starting a workout), so they stay noticeable instead of becoming noise.
   */
  haptics?: 'tap' | 'light' | 'medium' | false;
}

const DOWN = { duration: 80, easing: Easing.out(Easing.quad) };
const UP = { duration: 160, easing: Easing.out(Easing.cubic) };

/** Pressable with a quiet press-in — the base of every tappable surface. */
export const Tap = forwardRef<View, TapProps>(function Tap(
  { style, scaleTo = 0.98, haptics = false, onPressIn, onPressOut, onPress, disabled, ...props },
  ref,
) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const target = Math.max(0.95, Math.min(1, scaleTo));
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduced && target < 1) scale.value = withTiming(target, DOWN);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // Eased, no overshoot: settles instead of bouncing.
        if (!reduced) scale.value = withTiming(1, UP);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic[haptics]();
        onPress?.(e);
      }}
      style={[animated, style, disabled ? { opacity: 0.45 } : null]}
    />
  );
});
