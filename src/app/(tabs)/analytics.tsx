import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StatsRow } from '../../components/analytics/StatsRow';
import { ContributionHeatmap } from '../../components/analytics/ContributionHeatmap';
import { WeeklyBarChart } from '../../components/analytics/WeeklyBarChart';

export default function AnalyticsScreen() {
  const stats = [
    { label: 'Total XP', value: '2,450', icon: '⚡', trend: 'up' as const },
    { label: 'Current Level', value: '4', icon: '🏅' },
    { label: 'Perfect Days', value: '12', icon: '✨', trend: 'up' as const },
    { label: 'Longest Streak', value: '14', icon: '🔥' },
  ];

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
      <Text className="font-hero text-textPrimary text-4xl mb-6 tracking-tight">Stats</Text>
      <StatsRow stats={stats} />
      
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
