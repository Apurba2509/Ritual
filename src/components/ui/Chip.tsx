import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

export const Chip = ({ label, selected = false, onPress, icon }: ChipProps) => {
  const Container = onPress ? TouchableOpacity : View;
  
  return (
    <Container
      // @ts-ignore
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        selected && styles.selectedContainer
      ]}
      className="flex-row items-center rounded-full px-4 h-10 mr-2 mb-2"
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.label,
          selected && styles.selectedLabel
        ]}
        className="font-stat"
      >
        {label}
      </Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectedContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)', // primary with 20% opacity
    borderColor: '#7C3AED', // primary
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  selectedLabel: {
    color: '#F9FAFB',
  },
  iconContainer: {
    marginRight: 6,
  },
});
