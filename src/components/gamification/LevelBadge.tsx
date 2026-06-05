import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LevelBadgeProps {
  level: number;
  size?: number;
}

export const LevelBadge = ({ level, size = 48 }: LevelBadgeProps) => {
  return (
    <View 
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      className="bg-primary/20 border border-primary/50 items-center justify-center"
    >
      <Text className="text-primary font-hero" style={{ fontSize: size * 0.4 }}>
        {level}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  }
});
