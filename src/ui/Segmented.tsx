import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Tap } from './Tap';
import { Text } from './Text';
import { radius, useTheme } from './theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = width / options.length;

  const thumb = useAnimatedStyle(() => ({
    width: segment - 4,
    transform: [{ translateX: withSpring(index * segment, { damping: 20, stiffness: 260 }) }],
  }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: t.surface2,
        borderRadius: radius.md,
        padding: 2,
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: 2,
              borderRadius: radius.md - 3,
              backgroundColor: t.scheme === 'dark' ? t.surface3 : t.surface,
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((o) => (
        <Tap
          key={o.value}
          onPress={() => onChange(o.value)}
          scaleTo={0.96}
          style={{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
        >
          <Text
            variant="caption"
            tone={o.value === value ? 'default' : 'muted'}
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            {o.label}
          </Text>
        </Tap>
      ))}
    </View>
  );
}
