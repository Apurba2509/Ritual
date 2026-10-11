import { View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { alpha, radius, useTheme } from './theme';

/** Selectable pill. Selected = solid ink/bone, which reads clearly in both themes. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  size = 'md',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Optional colour for the icon. */
  color?: string;
  size?: 'sm' | 'md';
}) {
  const t = useTheme();
  const fg = selected ? t.bg : t.text;
  const content = (
    <>
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} color={selected ? fg : (color ?? t.textMuted)} /> : null}
      <Text variant="caption" weight="semibold" color={selected ? fg : t.textMuted}>
        {label}
      </Text>
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: size === 'sm' ? 30 : 36,
    paddingHorizontal: size === 'sm' ? 11 : 14,
    borderRadius: radius.pill,
    backgroundColor: selected ? t.text : t.surface2,
  };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Tap onPress={onPress} scaleTo={0.94} style={style} accessibilityRole="button" accessibilityState={{ selected }}>
      {content}
    </Tap>
  );
}

/** Small read-only tag, e.g. "Auto · GitHub". */
export function Pill({
  label,
  color,
  icon,
  solid,
}: {
  label: string;
  color?: string;
  icon?: IconName;
  solid?: boolean;
}) {
  const t = useTheme();
  const c = color ?? t.textMuted;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        height: 20,
        borderRadius: 6,
        backgroundColor: solid ? c : color ? alpha(c, t.scheme === 'dark' ? 0.14 : 0.12) : t.surface2,
      }}
    >
      {icon ? <Icon name={icon} size={11} color={solid ? t.onAccent : c} /> : null}
      <Text variant="small" color={solid ? t.onAccent : c}>
        {label}
      </Text>
    </View>
  );
}
