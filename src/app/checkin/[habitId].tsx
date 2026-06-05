import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHabitStore } from '../../stores/habitStore';
import { Button } from '../../components/ui/Button';
import { uploadToCloudinary } from '../../lib/cloudinary';

export default function CheckinScreen() {
  const { habitId } = useLocalSearchParams();
  const router = useRouter();
  const habit = useHabitStore((state) => state.habits[habitId as string]);
  const addCompletion = useHabitStore((state) => state.addCompletion);
  
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!habit) return null;

  const handlePickImage = async () => {
    setPhotoUri('file:///mock-image-path.jpg');
  };

  const handleComplete = async () => {
    let finalUrl = null;
    if (photoUri) {
      setIsUploading(true);
      try {
        finalUrl = await uploadToCloudinary(photoUri, 'checkins');
      } catch (e) {
        console.warn("Upload failed", e);
      }
      setIsUploading(false);
    }
    
    // Add completion for today
    const today = new Date().toISOString().split('T')[0];
    addCompletion({
      id: Math.random().toString(),
      habit_id: habit.id,
      completed_date: today,
      note: note,
      photo_url: finalUrl || null,
      user_id: 'local_user', // Mock user id since offline
      value: 1,
      mood: 'neutral',
      energy_level: 3,
      voice_url: null,
      created_at: new Date().toISOString()
    });
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4">
      <Text className="font-hero text-textPrimary text-4xl mb-2">Check In</Text>
      <Text className="font-heading text-primary text-xl mb-8">{habit.name}</Text>

      <Text className="font-heading text-textPrimary text-lg mb-2">How did it go?</Text>
      <TextInput
        className="bg-surface2 text-textPrimary font-body p-4 rounded-xl h-32 mb-6"
        placeholder="Add a note to your journal..."
        placeholderTextColor="#666"
        multiline
        value={note}
        onChangeText={setNote}
      />

      <Text className="font-heading text-textPrimary text-lg mb-2">Add a Photo</Text>
      {photoUri ? (
        <View className="mb-6 relative">
          <Image source={{ uri: photoUri }} className="w-full h-48 rounded-xl" />
          <Button 
            title="Change" 
            variant="outlined" 
            className="absolute bottom-4 right-4"
            onPress={handlePickImage} 
          />
        </View>
      ) : (
        <Button 
          title="Take Photo" 
          variant="outlined" 
          className="mb-6 h-32 border border-dashed border-white/20"
          onPress={handlePickImage}
        />
      )}

      <Button 
        title={isUploading ? "Uploading..." : "Complete Habit"} 
        variant="filled" 
        className="mt-4 mb-12"
        disabled={isUploading}
        onPress={handleComplete}
      />
    </ScrollView>
  );
}
