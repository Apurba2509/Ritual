import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { BottomSheet, BottomSheetRef } from '../ui/BottomSheet';
import { ConfettiCelebration } from '../animations/ConfettiCelebration';

interface StreakMilestoneSheetProps {
  visible: boolean;
  onClose: () => void;
  streak: number;
}

export const StreakMilestoneSheet: React.FC<StreakMilestoneSheetProps> = ({ visible, onClose, streak }) => {
  const sheetRef = useRef<BottomSheetRef>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  return (
    <BottomSheet ref={sheetRef} onClose={onClose} snapPoints={['50%']}>
      {visible && <ConfettiCelebration isActive={visible} />}
      <View className="flex-1 items-center justify-center p-6 pb-12">
        <View className="w-24 h-24 bg-accent/20 rounded-full items-center justify-center mb-6">
          <Text className="text-5xl">🔥</Text>
        </View>
        <Text className="text-accent text-lg font-bold tracking-widest uppercase mb-2">
          Milestone Reached!
        </Text>
        <Text className="text-white text-4xl font-heading text-center mb-4">
          {streak} Day Streak
        </Text>
        <Text className="text-textSecondary text-center text-lg">
          You are on fire! Keep up the amazing work. 
          Consistency is the key to building lasting habits.
        </Text>
      </View>
    </BottomSheet>
  );
};
