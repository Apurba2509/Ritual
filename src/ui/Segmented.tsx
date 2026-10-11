import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { radius, shadow, useTheme } from './theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const pad = 4;
  const segment = (width - pad * 2) / options.length;
  const h = size === 'sm' ? 32 : 40;

  const thumb = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, { damping: 22, stiffness: 280 }) }],
  }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: t.surface2, borderRadius: radius.md, padding: pad }}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: pad,
              bottom: pad,
              left: pad,
              borderRadius: radius.md - 3,
              backgroundColor: t.scheme === 'dark' ? t.surface3 : t.surface,
              ...shadow('#000000', t.scheme === 'dark' ? 0.3 : 0.08, 6, 1),
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap
            key={o.value}
            onPress={() => onChange(o.value)}
            scaleTo={0.96}
            style={{ flex: 1, height: h, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={on ? t.text : t.textMuted} /> : null}
            <Text variant="caption" weight="semibold" tone={on ? 'default' : 'muted'} size={size === 'sm' ? 13 : 14}>
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}
