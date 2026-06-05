import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Challenge } from '../../types/social.types';
import { formatDistanceToNow } from 'date-fns';

interface ChallengeCardProps {
  challenge: Challenge;
  onPress: () => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onPress }) => {
  const endDate = new Date(challenge.end_date);
  const isEndingSoon = endDate.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3; // 3 days

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="bg-surface p-5 rounded-3xl mb-4 border border-white/5"
    >
      <View className="flex-row items-center mb-3">
        <View className="w-12 h-12 bg-accent/20 rounded-2xl items-center justify-center mr-4">
          <Text className="text-2xl">{challenge.emoji}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-white text-xl font-heading">{challenge.title}</Text>
          <Text className="text-textSecondary text-sm">
            {challenge.participant_count} participants
          </Text>
        </View>
      </View>
      
      {challenge.description && (
        <Text className="text-textSecondary mb-4" numberOfLines={2}>
          {challenge.description}
        </Text>
      )}

      <View className="flex-row justify-between items-center mt-2">
        <View className="px-3 py-1 bg-surface2 rounded-full">
          <Text className={`text-xs ${isEndingSoon ? 'text-rose-500' : 'text-textSecondary'}`}>
            Ends in {formatDistanceToNow(endDate)}
          </Text>
        </View>
        <Text className="text-accent font-bold">View</Text>
      </View>
    </TouchableOpacity>
  );
};
