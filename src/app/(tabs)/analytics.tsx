import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StatsRow } from '../../components/analytics/StatsRow';
import { ContributionHeatmap } from '../../components/analytics/ContributionHeatmap';
import { WeeklyBarChart } from '../../components/analytics/WeeklyBarChart';
import { useStats } from '../../hooks/useStats';

export default function AnalyticsScreen() {
  const { data, isLoading } = useStats();

  const totalCompletions = data?.totalCompletions || 0;
  
  // Calculate perfect days or other mock stats derived from data if available
  const statsList = [
    { label: 'Total Completions', value: totalCompletions.toString(), icon: '⚡', trend: 'up' as const },
    { label: 'Current Level', value: '1', icon: '🏅' }, // Assuming level is managed elsewhere or we update it
    { label: 'Perfect Days', value: '0', icon: '✨', trend: 'up' as const },
    { label: 'Longest Streak', value: '0', icon: '🔥' },
  ];

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
      <Text className="font-hero text-textPrimary text-4xl mb-6 tracking-tight">Stats</Text>
      <StatsRow stats={statsList} />
      
      <View className="mt-8">
        <Text className="font-heading text-textPrimary text-xl mb-4">Weekly Progress</Text>
        <View className="bg-surface1 rounded-2xl border border-white/5 overflow-hidden p-4">
          <WeeklyBarChart />
        </View>
      </View>

      <View className="mt-8">
        <Text className="font-heading text-textPrimary text-xl mb-4">Contribution</Text>
        <View className="bg-surface1 rounded-2xl border border-white/5 overflow-hidden py-4">
          <ContributionHeatmap />
        </View>
      </View>
    </ScrollView>
  );
}
