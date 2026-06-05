import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface HabitTemplateCardProps {
  template: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    difficulty: string;
  };
  selected: boolean;
  onToggle: () => void;
}

export const HabitTemplateCard: React.FC<HabitTemplateCardProps> = ({ template, selected, onToggle }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      className={`p-4 rounded-2xl mb-3 flex-row items-center border ${
        selected ? 'border-accent bg-accent/10' : 'border-white/5 bg-surface'
      }`}
    >
      <View 
        className="w-12 h-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: `${template.color}20` }}
      >
        <Text className="text-2xl">{template.emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white text-lg font-heading">{template.name}</Text>
        <Text className="text-textSecondary capitalize">{template.difficulty} difficulty</Text>
      </View>
      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
        selected ? 'border-accent bg-accent' : 'border-white/20'
      }`}>
        {selected && <Text className="text-white text-xs font-bold">✓</Text>}
      </View>
    </TouchableOpacity>
  );
};
