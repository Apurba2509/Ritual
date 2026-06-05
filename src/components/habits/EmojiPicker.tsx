import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, SafeAreaView } from 'react-native';

const POPULAR_EMOJIS = ['💧', '📚', '💪', '🧘', '🏃', '🍎', '💤', '📝', '💊', '🎨'];

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onClose, onSelect }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView className="flex-1 bg-[#0C0E14] mt-20 rounded-t-3xl border border-white/10">
        <View className="p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-heading">Choose Icon</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-textSecondary">Close</Text>
            </TouchableOpacity>
          </View>
          
          <Text className="text-textSecondary mb-4">Popular</Text>
          <View className="flex-row flex-wrap gap-4">
            {POPULAR_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  onSelect(emoji);
                  onClose();
                }}
                className="w-14 h-14 bg-surface2 rounded-2xl items-center justify-center border border-white/5"
              >
                <Text className="text-3xl">{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
