import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Stat {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface StatsRowProps {
  stats: Stat[];
}

export const StatsRow = ({ stats }: StatsRowProps) => {
  return (
    <View className="flex-row flex-wrap justify-between">
      {stats.map((stat, index) => (
        <View key={index} style={styles.chip} className="mb-3">
          <View className="flex-row items-center mb-1">
            {stat.icon && <Text className="mr-1 text-sm">{stat.icon}</Text>}
            <Text className="text-textSecondary font-stat text-xs uppercase tracking-wider">{stat.label}</Text>
          </View>
          <View className="flex-row items-end">
            <Text className="text-textPrimary font-hero text-2xl tracking-tight">{stat.value}</Text>
            {stat.trend === 'up' && <Text className="text-success text-xs ml-2 mb-1">↑</Text>}
            {stat.trend === 'down' && <Text className="text-danger text-xs ml-2 mb-1">↓</Text>}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  }
});
