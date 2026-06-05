import React from 'react';
import { View, Text } from 'react-native';

interface AchievementCardProps {
  achievement: {
    key: string;
    title: string;
    description: string;
    icon: string;
  };
  earned: boolean;
  earnedAt?: string;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement, earned, earnedAt }) => {
  return (
    <View className={`p-4 rounded-2xl mb-3 flex-row items-center border ${
      earned ? 'bg-surface border-accent/30' : 'bg-surface/50 border-white/5 opacity-50'
    }`}>
      <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${
        earned ? 'bg-accent/20' : 'bg-white/5'
      }`}>
        <Text className="text-3xl">{earned ? achievement.icon : '🔒'}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white text-lg font-heading">{achievement.title}</Text>
        <Text className="text-textSecondary mt-1">{achievement.description}</Text>
        {earnedAt && (
          <Text className="text-accent text-xs mt-2 font-bold uppercase tracking-wider">
            Unlocked
          </Text>
        )}
      </View>
    </View>
  );
};
