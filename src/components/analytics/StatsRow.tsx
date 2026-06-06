import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
        <LinearGradient
          key={index}
          colors={['#1A1D2B', '#11131A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.chip}
          className="mb-3"
        >
          <View className="flex-row items-center mb-1">
            {stat.icon && <Text className="mr-1 text-sm">{stat.icon}</Text>}
            <Text className="text-textSecondary font-stat text-xs uppercase tracking-wider">{stat.label}</Text>
          </View>
          <View className="flex-row items-end mt-1">
            <Text className="text-white font-hero text-3xl tracking-tight">{stat.value}</Text>
            {stat.trend === 'up' && <Text className="text-success text-xs ml-2 mb-2 font-bold">↑</Text>}
            {stat.trend === 'down' && <Text className="text-danger text-xs ml-2 mb-2 font-bold">↓</Text>}
          </View>
        </LinearGradient>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  }
});
