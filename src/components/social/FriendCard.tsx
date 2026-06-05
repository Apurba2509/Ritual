import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Avatar } from '../ui/Avatar';
import { LevelBadge } from '../gamification/LevelBadge';
import { Profile } from '../../types/user.types';

interface FriendCardProps {
  friend: Profile;
  onPress: () => void;
  actionButton?: React.ReactNode;
}

export const FriendCard: React.FC<FriendCardProps> = ({ friend, onPress, actionButton }) => {
  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={onPress}
      className="flex-row items-center p-4 bg-surface rounded-2xl mb-3 border border-white/5"
    >
      <Avatar url={friend.avatar_url || ''} name={friend.username} size={40} />
      <View className="flex-1 ml-4">
        <Text className="text-white font-bold text-base">{friend.display_name || friend.username}</Text>
        <Text className="text-textSecondary text-sm">@{friend.username}</Text>
      </View>
      <View className="items-end">
        <LevelBadge level={friend.level} size={32} />
        {actionButton && <View className="mt-2">{actionButton}</View>}
      </View>
    </TouchableOpacity>
  );
};
