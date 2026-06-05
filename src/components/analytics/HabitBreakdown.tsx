import React from 'react';
import { View, Text } from 'react-native';

interface HabitBreakdownProps {
  stats: {
    total: number;
    completed: number;
    skipped: number;
    missed: number;
  };
}

export const HabitBreakdown: React.FC<HabitBreakdownProps> = ({ stats }) => {
  const completedPct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const skippedPct = stats.total > 0 ? (stats.skipped / stats.total) * 100 : 0;
  const missedPct = stats.total > 0 ? (stats.missed / stats.total) * 100 : 0;

  return (
    <View className="bg-surface rounded-3xl p-5 mb-6 border border-white/5">
      <Text className="text-white text-lg font-heading mb-4">Completion Breakdown</Text>
      
      {/* Progress Bar Segmented */}
      <View className="h-4 w-full flex-row rounded-full overflow-hidden mb-6 bg-surface2">
        <View style={{ width: `${completedPct}%` }} className="h-full bg-accent" />
        <View style={{ width: `${skippedPct}%` }} className="h-full bg-amber-500" />
        <View style={{ width: `${missedPct}%` }} className="h-full bg-rose-500" />
      </View>

      {/* Legend */}
      <View className="flex-row justify-between">
        <View className="items-center">
          <View className="w-3 h-3 rounded-full bg-accent mb-1" />
          <Text className="text-white font-bold">{stats.completed}</Text>
          <Text className="text-textSecondary text-xs">Completed</Text>
        </View>
        <View className="items-center">
          <View className="w-3 h-3 rounded-full bg-amber-500 mb-1" />
          <Text className="text-white font-bold">{stats.skipped}</Text>
          <Text className="text-textSecondary text-xs">Skipped</Text>
        </View>
        <View className="items-center">
          <View className="w-3 h-3 rounded-full bg-rose-500 mb-1" />
          <Text className="text-white font-bold">{stats.missed}</Text>
          <Text className="text-textSecondary text-xs">Missed</Text>
        </View>
      </View>
    </View>
  );
};
