import React from 'react';
import { ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export const Card = ({ elevated = false, style, className, children, ...props }: CardProps) => {
  return (
    <BlurView
      intensity={20}
      tint="dark"
      style={[
        styles.card,
        elevated && styles.elevated,
        style,
      ]}
      className={`rounded-xl p-4 overflow-hidden ${className || ''}`}
      {...props}
    >
      {children}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  elevated: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
});
