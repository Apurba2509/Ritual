import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface TrackingTypeSelectorProps {
  value: 'boolean' | 'counter' | 'timer' | 'checklist';
  onChange: (value: 'boolean' | 'counter' | 'timer' | 'checklist') => void;
}

export const TrackingTypeSelector: React.FC<TrackingTypeSelectorProps> = ({ value, onChange }) => {
  const options: { label: string; val: 'boolean' | 'counter' | 'timer' | 'checklist'; icon: string }[] = [
    { label: 'Yes/No', val: 'boolean', icon: '✅' },
    { label: 'Timer', val: 'timer', icon: '⏱️' },
    { label: 'Counter', val: 'counter', icon: '🔢' },
    { label: 'Checklist', val: 'checklist', icon: '📝' },
  ];

  return (
    <View className="flex-row flex-wrap gap-3">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.val}
          onPress={() => onChange(opt.val)}
          className={`flex-row items-center gap-2 px-4 py-3 rounded-xl border w-[47%] ${
            value === opt.val 
              ? 'bg-accent/20 border-accent' 
              : 'bg-surface border-white/10'
          }`}
        >
          <Text className="text-xl">{opt.icon}</Text>
          <Text className={value === opt.val ? 'text-accent' : 'text-textSecondary'}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
