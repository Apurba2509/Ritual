import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface FrequencySelectorProps {
  value: 'daily' | 'weekdays' | 'custom' | 'x_per_week';
  onChange: (value: 'daily' | 'weekdays' | 'custom' | 'x_per_week') => void;
}

export const FrequencySelector: React.FC<FrequencySelectorProps> = ({ value, onChange }) => {
  const options: { label: string; val: 'daily' | 'weekdays' | 'custom' | 'x_per_week' }[] = [
    { label: 'Every Day', val: 'daily' },
    { label: 'Weekdays', val: 'weekdays' },
    { label: 'Custom Days', val: 'custom' },
    { label: 'X times/week', val: 'x_per_week' },
  ];

  return (
    <View className="flex-row flex-wrap gap-3">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.val}
          onPress={() => onChange(opt.val)}
          className={`px-4 py-2 rounded-xl border ${
            value === opt.val 
              ? 'bg-accent/20 border-accent' 
              : 'bg-surface border-white/10'
          }`}
        >
          <Text className={value === opt.val ? 'text-accent' : 'text-textSecondary'}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
