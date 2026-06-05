import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export const Card = ({ elevated = false, style, className, children, ...props }: CardProps) => {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        style,
      ]}
      className={`rounded-xl p-4 overflow-hidden ${className || ''}`}
      {...props}
    >
      {children}
    </View>
  );
};

// Using StyleSheet for specific glass effects that are hard to do perfectly with just Tailwind
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  elevated: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
