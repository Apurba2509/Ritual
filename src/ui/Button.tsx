import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { radius, useTheme, shadow } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'xp';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHT: Record<Size, number> = { sm: 38, md: 48, lg: 56 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  full,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const t = useTheme();
  const height = HEIGHT[size];

  const fg =
    variant === 'primary' || variant === 'xp'
      ? '#FFFFFF'
      : variant === 'danger'
        ? t.danger
        : variant === 'ghost'
          ? t.textMuted
          : t.text;

  const bg = variant === 'secondary' ? t.surface2 : variant === 'danger' ? t.dangerSoft : 'transparent';

  const content = (
    <View
      style={{
        height,
        paddingHorizontal: size === 'sm' ? 14 : 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
          <Text variant="bodyStrong" color={fg} size={size === 'sm' ? 14 : size === 'lg' ? 16 : 15}>
            {title}
          </Text>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
        </>
      )}
    </View>
  );

  const gradient = variant === 'primary' ? [t.accent, t.emberDeep] : variant === 'xp' ? [t.xp, '#6D5AE6'] : null;

  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      haptics={variant === 'primary' ? 'light' : 'tap'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        {
          borderRadius: radius.md,
          overflow: 'hidden',
          alignSelf: full ? 'stretch' : 'auto',
          backgroundColor: bg,
        },
        variant === 'primary' && {
          ...shadow(t.accent, t.scheme === 'dark' ? 0.35 : 0.25, 16, 6),
        },
        variant === 'secondary' && { borderWidth: 1, borderColor: t.border },
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.md }}
        >
          {content}
        </LinearGradient>
      ) : (
        content
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
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  tint?: string;
  background?: string;
  accessibilityLabel: string;
  badge?: boolean;
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
        borderWidth: background ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <Icon name={name} size={size * 0.46} color={tint ?? t.text} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: size * 0.18,
            right: size * 0.18,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: t.accent,
          }}
        />
      ) : null}
    </Tap>
  );
}
