import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, StyleSheet, ActivityIndicator } from 'react-native';

export type ButtonVariant = 'filled' | 'outlined' | 'ghost' | 'gradient';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = ({ title, variant = 'filled', loading = false, style, className, disabled, ...props }: ButtonProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return styles.outlined;
      case 'ghost':
        return styles.ghost;
      case 'gradient':
        return styles.gradient; // Note: We'd use expo-linear-gradient for real gradient, fallback here
      case 'filled':
      default:
        return styles.filled;
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

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        getVariantStyles(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      className={`rounded-xl flex-row justify-center items-center h-14 px-6 ${className || ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]} className="font-heading">
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minWidth: 120,
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
  gradient: {
    backgroundColor: '#7C3AED', // Fallback for gradient, we can implement LinearGradient wrapper later
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
