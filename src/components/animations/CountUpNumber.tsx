import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import { useSharedValue, withTiming, Easing, runOnJS, useAnimatedReaction } from 'react-native-reanimated';

interface CountUpNumberProps extends TextProps {
  value: number;
  duration?: number;
}

export const CountUpNumber = ({ value, duration = 1000, style, ...props }: CountUpNumberProps) => {
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  useAnimatedReaction(
    () => Math.floor(animatedValue.value),
    (currentValue, previousValue) => {
      if (currentValue !== previousValue) {
        runOnJS(setDisplayValue)(currentValue);
      }
    }
  );

  return <Text style={style} {...props}>{displayValue}</Text>;
};
