import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../ui/Avatar';
import { formatDistanceToNow } from 'date-fns';
import { ActivityItem } from '../../types/social.types';

interface ActivityFeedItemProps {
  item: ActivityItem;
}

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({ item }) => {
  const renderContent = () => {
    switch (item.type) {
      case 'streak_milestone':
        return (
          <Text className="text-white text-base">
            hit a <Text className="text-accent font-bold">{item.metadata.streak} day streak</Text> on {item.metadata.habit_name}! 🔥
          </Text>
        );
      case 'achievement':
        return (
          <Text className="text-white text-base">
            unlocked the <Text className="text-amber-500 font-bold">{item.metadata.achievement_name}</Text> achievement! 🏆
          </Text>
        );
      case 'challenge_joined':
        return (
          <Text className="text-white text-base">
            joined the <Text className="text-blue-400 font-bold">{item.metadata.challenge_name}</Text> challenge! ⚔️
          </Text>
        );
      default:
        return <Text className="text-white">completed an activity.</Text>;
    }
  };

  return (
    <View className="flex-row p-4 border-b border-white/5">
      <Avatar url={item.profiles?.avatar_url || ''} name={item.profiles?.username || '?'} size={40} />
      <View className="flex-1 ml-4">
        <View className="flex-row items-center mb-1">
          <Text className="text-white font-bold mr-2">
            {item.profiles?.username}
          </Text>
          <Text className="text-textSecondary text-xs">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>
        {renderContent()}
      </View>
    </View>
  );
};
