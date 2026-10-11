import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { Tap } from './Tap';
import { radius, useTheme, shadow } from './theme';

export interface CardProps extends ViewProps {
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'raised' | 'outline';
}

export function Card({ padded = true, onPress, style, tone = 'default', children, ...props }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: tone === 'outline' ? 'transparent' : tone === 'raised' ? t.surface2 : t.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    padding: padded ? 16 : 0,
    ...(t.scheme === 'light' && tone !== 'outline' ? shadow(t.shadow, 0.06, 12, 4) : null),
  };
  if (onPress) {
    return (
      <Tap onPress={onPress} scaleTo={0.985} accessibilityRole="button" style={[base, style]} {...props}>
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
