import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';

const COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', 
  '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'
];

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onSelect }) => {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
      <View className="flex-row gap-4 px-1">
        {COLORS.map(color => (
          <TouchableOpacity
            key={color}
            onPress={() => onSelect(color)}
            style={{ backgroundColor: color }}
            className={`w-12 h-12 rounded-full border-2 ${
              selectedColor === color ? 'border-white' : 'border-transparent'
            }`}
          />
        ))}
      </View>
    </ScrollView>
  );
};
