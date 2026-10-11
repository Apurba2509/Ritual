import { View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { alpha, radius, useTheme } from './theme';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  emoji,
  color,
  size = 'md',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  emoji?: string;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const t = useTheme();
  const tint = color ?? t.accent;
  const content = (
    <>
      {emoji ? <Text size={size === 'sm' ? 13 : 15}>{emoji}</Text> : null}
      {icon ? <Icon name={icon} size={14} color={selected ? tint : t.textMuted} /> : null}
      <Text variant="caption" color={selected ? (t.scheme === 'dark' ? t.text : tint) : t.textMuted}>
        {label}
      </Text>
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: size === 'sm' ? 30 : 36,
    paddingHorizontal: size === 'sm' ? 10 : 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: selected ? alpha(tint, 0.6) : t.border,
    backgroundColor: selected ? alpha(tint, t.scheme === 'dark' ? 0.18 : 0.1) : t.surface,
  };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Tap onPress={onPress} scaleTo={0.94} style={style} accessibilityRole="button" accessibilityState={{ selected }}>
      {content}
    </Tap>
  );
}

export function Pill({ label, color, icon }: { label: string; color?: string; icon?: IconName }) {
  const t = useTheme();
  const c = color ?? t.textMuted;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        height: 22,
        borderRadius: radius.pill,
        backgroundColor: alpha(c, 0.14),
      }}
    >
      {icon ? <Icon name={icon} size={11} color={c} /> : null}
      <Text variant="caption" size={11} color={c} style={{ fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}
