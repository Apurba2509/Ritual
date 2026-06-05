import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Button } from '../ui/Button';

interface ShareCardProps {
  habitName: string;
  streakCount: number;
  emoji: string;
}

export const ShareCard = ({ habitName, streakCount, emoji }: ShareCardProps) => {
  const viewShotRef = useRef<any>(null);

  const captureAndShare = async () => {
    if (viewShotRef.current && viewShotRef.current.capture) {
      const uri = await viewShotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    }
  };

  return (
    <View className="items-center w-full">
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
        <View style={styles.card} className="bg-background border border-white/10 rounded-3xl p-8 items-center w-80">
          <Text className="text-6xl mb-4">{emoji}</Text>
          <Text className="font-heading text-textPrimary text-2xl mb-1">{habitName}</Text>
          <Text className="font-hero text-primary text-5xl my-4 tracking-tighter">
            {streakCount}
          </Text>
          <Text className="font-stat text-textSecondary uppercase tracking-widest text-xs mb-6">
            Day Streak
          </Text>
          
          <View className="flex-row items-center border-t border-white/5 pt-4 w-full justify-center">
            <Text className="font-heading text-textPrimary mr-2">Ritual</Text>
            <Text className="font-body text-textSecondary text-xs">Habit Tracker</Text>
          </View>
        </View>
      </ViewShot>

      <Button 
        title="Share Milestone" 
        variant="outlined" 
        className="mt-6 w-80" 
        onPress={captureAndShare} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  }
});
