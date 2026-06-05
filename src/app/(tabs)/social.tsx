import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { useSocial } from '../../hooks/useSocial';
import { formatDistanceToNow } from 'date-fns';
import { FadeIn } from '../../components/animations/FadeIn';

export default function SocialScreen() {
  const { feed, isLoadingFeed } = useSocial();

  const handleAddFriend = () => {
    Alert.prompt('Add Friend', 'Enter the username of the person you want to add:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Request', onPress: (username) => Alert.alert('Request Sent', `Friend request sent to ${username}!`) }
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="font-hero text-textPrimary text-4xl tracking-tight">Community</Text>
        <TouchableOpacity onPress={handleAddFriend}>
          <Text className="text-primary font-heading">Add Friend</Text>
        </TouchableOpacity>
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
        {isLoadingFeed ? (
          <Text className="text-textSecondary text-center py-4">Loading feed...</Text>
        ) : !feed || feed.length === 0 ? (
          <Text className="text-textSecondary text-center py-4">No recent activity in your community.</Text>
        ) : (
          feed.map((item, index) => (
            <FadeIn key={item.id} delay={index * 100} duration={400} direction="up">
              <View className="flex-row items-center mb-4 pb-4 border-b border-white/5">
                <Avatar name={item.profiles?.username || 'User'} size={40} />
                <View className="ml-3 flex-1">
                  <Text className="font-body text-textPrimary">
                    <Text className="font-heading">{item.profiles?.username || 'User'}</Text> {item.type.replace(/_/g, ' ')}
                  </Text>
                  <Text className="font-stat text-textSecondary text-xs mt-1">
                    {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
                  </Text>
                </View>
                <Text className="text-xl">🔥</Text>
              </View>
            </FadeIn>
          ))
        )}
      </View>
    </ScrollView>
  );
}
