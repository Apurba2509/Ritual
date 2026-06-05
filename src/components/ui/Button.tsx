import React from 'react';
import { TouchableOpacity, Text, View, TouchableOpacityProps, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export type ButtonVariant = 'filled' | 'outlined' | 'ghost' | 'gradient';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const Button = ({ title, variant = 'filled', loading = false, icon, style, className, disabled, onPressIn, onPressOut, ...props }: ButtonProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    if (onPressOut) onPressOut(e);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return styles.outlined;
      case 'ghost':
        return styles.ghost;
      case 'gradient':
      case 'filled':
      default:
        // Background color handled by LinearGradient or base styles directly
        return variant === 'gradient' ? {} : styles.filled;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'outlined':
      case 'ghost':
        return '#F9FAFB'; // textPrimary
      case 'filled':
      case 'gradient':
      default:
        return '#FFFFFF';
    }
  };

  const innerContent = (
    <>
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && <View className="mr-2">{icon}</View>}
          <Text style={[styles.text, { color: getTextColor() }]} className="font-heading">
            {title}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.base,
        getVariantStyles(),
        (disabled || loading) && styles.disabled,
        animatedStyle,
        style,
      ]}
      className={`rounded-xl overflow-hidden ${variant !== 'gradient' ? 'flex-row justify-center items-center h-14 px-6' : ''} ${className || ''}`}
      {...props}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={['#7C3AED', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
          className="flex-row justify-center items-center h-14 px-6 w-full"
        >
          {innerContent}
        </LinearGradient>
      ) : (
        innerContent
      )}
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minWidth: 120,
  },
  gradientContainer: {
    width: '100%',
  },
  filled: {
    backgroundColor: '#7C3AED', // primary
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.08)', // border
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
