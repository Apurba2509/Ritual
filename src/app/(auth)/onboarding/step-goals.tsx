import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../../components/ui/Button';

export default function Step() {
  const router = useRouter();
  
  return (
    <View className="flex-1 justify-center items-center bg-[#0C0E14]">
      <Text className="text-white mb-4">Goals Step</Text>
      <Button 
        title="Next" 
        onPress={() => router.push('/(auth)/onboarding/step-templates')} 
      />
    </View>
  );
}
