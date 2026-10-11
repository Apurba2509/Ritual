import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { alpha, radius, useTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  /** Custom leading element (e.g. the Google "G"). */
  leading?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHT: Record<Size, number> = { sm: 38, md: 50, lg: 56 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  leading,
  loading,
  disabled,
  full,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const t = useTheme();
  const height = HEIGHT[size];
  const inverseBg = t.scheme === 'dark' ? '#FFFFFF' : t.text;
  const inverseFg = t.scheme === 'dark' ? '#0B0B0C' : '#FFFFFF';

  const fg = {
    primary: t.onAccent,
    secondary: t.text,
    outline: t.text,
    ghost: t.textMuted,
    danger: t.danger,
    inverse: inverseFg,
  }[variant];
  const bg = {
    primary: t.accent,
    secondary: t.surface2,
    outline: 'transparent',
    ghost: 'transparent',
    danger: t.dangerSoft,
    inverse: inverseBg,
  }[variant];
  const iconSize = size === 'sm' ? 16 : 19;

  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      haptics={variant === 'primary' ? 'light' : 'tap'}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        {
          height,
          paddingHorizontal: size === 'sm' ? 14 : 22,
          borderRadius: size === 'sm' ? radius.sm + 2 : radius.md + 3,
          backgroundColor: bg,
          alignSelf: full ? 'stretch' : 'auto',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        },
        variant === 'outline' && { borderWidth: 1, borderColor: t.borderStrong },
        variant === 'inverse' && t.scheme === 'dark' && { borderWidth: 1, borderColor: alpha('#000000', 0.06) },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {leading}
          {icon ? <Icon name={icon} size={iconSize} color={fg} /> : null}
          <Text variant="bodyStrong" color={fg} size={size === 'sm' ? 14 : 16} style={{ letterSpacing: -0.2 }}>
            {title}
          </Text>
          {iconRight ? <Icon name={iconRight} size={iconSize} color={fg} /> : null}
        </>
      )}
    </Tap>
  );
}

export function IconButton({
  name,
  onPress,
  size = 40,
  tint,
  background,
  accessibilityLabel,
  badge,
  weight = 'bold',
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  tint?: string;
  background?: string;
  accessibilityLabel: string;
  badge?: boolean;
  weight?: 'regular' | 'bold' | 'fill';
}) {
  const t = useTheme();
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ?? t.surface2,
      }}
    >
      <Icon name={name} size={Math.round(size * 0.45)} color={tint ?? t.text} weight={weight} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: size * 0.16,
            right: size * 0.16,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: t.accent,
            borderWidth: 2,
            borderColor: background ?? t.surface2,
          }}
        />
      ) : null}
    </Tap>
  );
}
