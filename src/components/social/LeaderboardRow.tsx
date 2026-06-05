import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../ui/Avatar';

interface LeaderboardRowProps {
  rank: number;
  user: {
    username: string;
    avatar_url: string | null;
  };
  score: number;
  scoreLabel?: string;
  isCurrentUser?: boolean;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ 
  rank, 
  user, 
  score, 
  scoreLabel = 'XP',
  isCurrentUser = false
}) => {
  const getRankColor = () => {
    switch (rank) {
      case 1: return 'text-amber-400'; // Gold
      case 2: return 'text-slate-300'; // Silver
      case 3: return 'text-amber-600'; // Bronze
      default: return 'text-textSecondary';
    }
  };

  return (
    <View className={`flex-row items-center p-4 rounded-2xl mb-2 ${
      isCurrentUser ? 'bg-accent/10 border border-accent/30' : 'bg-surface border border-white/5'
    }`}>
      <View className="w-8 items-center justify-center mr-2">
        <Text className={`text-xl font-bold ${getRankColor()}`}>
          {rank}
        </Text>
      </View>
      <Avatar url={user.avatar_url || ''} name={user.username} size={32} />
      <View className="flex-1 ml-3">
        <Text className={`font-bold ${isCurrentUser ? 'text-accent' : 'text-white'}`}>
          {isCurrentUser ? 'You' : user.username}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-white font-heading text-lg">{score}</Text>
        <Text className="text-textSecondary text-xs">{scoreLabel}</Text>
      </View>
    </View>
  );
};
