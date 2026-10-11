import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { Tap } from './Tap';
import { cardShadow, radius, useTheme } from './theme';

export interface CardProps extends ViewProps {
  padded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'raised' | 'outline' | 'accent';
}

export function Card({ padded = true, onPress, onLongPress, style, tone = 'default', children, ...props }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor:
      tone === 'outline' ? 'transparent' : tone === 'raised' ? t.surface2 : tone === 'accent' ? t.accent : t.surface,
    borderRadius: radius.lg + 2,
    borderWidth: tone === 'accent' ? 0 : 1,
    borderColor: tone === 'outline' ? t.borderStrong : t.border,
    padding: padded ? 18 : 0,
    ...(tone === 'default' ? cardShadow(t) : null),
  };
  if (onPress || onLongPress) {
    return (
      <Tap
        onPress={onPress}
        onLongPress={onLongPress}
        scaleTo={0.985}
        accessibilityRole="button"
        style={[base, style]}
        {...props}
      >
        {children}
      </Tap>
    );
  }
  return (
    <View style={[base, style]} {...props}>
      {children}
    </View>
  );
}
