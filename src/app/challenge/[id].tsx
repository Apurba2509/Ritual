import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams();

  // Mock data for the challenge
  const challenge = {
    title: '75 Hard Water',
    description: 'Drink a gallon of water every single day for 75 days straight. No exceptions. No excuses.',
    participants: 24,
    daysRemaining: 12,
    leaderboard: [
      { name: 'Sarah', score: 63 },
      { name: 'Alex', score: 60 },
      { name: 'You', score: 58 },
      { name: 'David', score: 42 },
    ]
  };

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4">
      <Text className="text-6xl mb-4">💦</Text>
      <Text className="font-hero text-textPrimary text-4xl mb-2">{challenge.title}</Text>
      <Text className="font-body text-textSecondary text-lg mb-6">{challenge.description}</Text>

      <View className="flex-row justify-between mb-8">
        <Card className="flex-1 mr-2 p-4 bg-surface2 items-center">
          <Text className="font-heading text-textSecondary mb-1">Participants</Text>
          <Text className="font-hero text-primary text-2xl">{challenge.participants}</Text>
        </Card>
        <Card className="flex-1 ml-2 p-4 bg-surface2 items-center">
          <Text className="font-heading text-textSecondary mb-1">Days Left</Text>
          <Text className="font-hero text-primary text-2xl">{challenge.daysRemaining}</Text>
        </Card>
      </View>

      <Text className="font-heading text-textPrimary text-xl mb-4">Leaderboard</Text>
      <Card className="p-4 bg-surface2 mb-8">
        {challenge.leaderboard.map((person, index) => (
          <View key={person.name} className={`flex-row items-center py-3 ${index !== challenge.leaderboard.length - 1 ? 'border-b border-white/5' : ''}`}>
            <Text className="font-hero text-textSecondary text-lg w-8">#{index + 1}</Text>
            <Avatar name={person.name} size={32} />
            <Text className={`font-heading flex-1 ml-3 ${person.name === 'You' ? 'text-primary' : 'text-textPrimary'}`}>
              {person.name}
            </Text>
            <Text className="font-stat text-textPrimary">{person.score} days</Text>
          </View>
        ))}
      </Card>

      <Button title="Invite Friends" variant="outlined" className="mb-12" />
    </ScrollView>
  );
}
