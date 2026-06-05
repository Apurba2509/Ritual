import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { useSocialStore } from '../../stores/socialStore';
import { formatDistanceToNow } from 'date-fns';

export default function SocialScreen() {
  const { feed } = useSocialStore();

  const mockFeed = [
    { id: 'm1', user: 'Alex', action: 'hit a 7 day streak on', habit: 'Meditation', time: '2h ago' },
    { id: 'm2', user: 'Sarah', action: 'completed', habit: 'Morning Run', time: '5h ago' },
  ];

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="font-hero text-textPrimary text-4xl tracking-tight">Community</Text>
        <Text className="text-primary font-heading">Add Friend</Text>
      </View>
      
      <View className="mb-8">
        <Text className="font-heading text-textPrimary text-xl mb-4">Active Challenges</Text>
        <Card elevated className="p-4 bg-surface2">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-3">💦</Text>
            <View>
              <Text className="font-heading text-textPrimary text-lg">75 Hard Water</Text>
              <Text className="font-body text-textSecondary text-sm">24 participants</Text>
            </View>
          </View>
          <Text className="font-stat text-primary mt-2">You are ranked #3</Text>
        </Card>
      </View>

      <View>
        <Text className="font-heading text-textPrimary text-xl mb-4">Activity Feed</Text>
        {feed.length === 0 ? (
          mockFeed.map(item => (
            <View key={item.id} className="flex-row items-center mb-4 pb-4 border-b border-white/5">
              <Avatar name={item.user} size={40} />
              <View className="ml-3 flex-1">
                <Text className="font-body text-textPrimary">
                  <Text className="font-heading">{item.user}</Text> {item.action} <Text className="font-heading text-primary">{item.habit}</Text>
                </Text>
                <Text className="font-stat text-textSecondary text-xs mt-1">{item.time}</Text>
              </View>
              <Text className="text-xl">🔥</Text>
            </View>
          ))
        ) : (
          feed.map(item => (
            <View key={item.id} className="flex-row items-center mb-4 pb-4 border-b border-white/5">
              <Avatar name={item.user?.username || 'User'} size={40} />
              <View className="ml-3 flex-1">
                <Text className="font-body text-textPrimary">
                  <Text className="font-heading">{item.user?.username || 'User'}</Text> {item.type.replace('_', ' ')}
                </Text>
                <Text className="font-stat text-textSecondary text-xs mt-1">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </Text>
              </View>
              <Text className="text-xl">🔥</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
