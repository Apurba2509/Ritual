import { View } from 'react-native';
import { Icon, isIconName } from '@/ui/Icon';
import { alpha, tint, useTheme } from '@/ui/theme';

/** A habit's icon on a softly tinted tile. `solid` fills the tile (used for done / selected). */
export function HabitIcon({
  icon,
  color,
  size = 44,
  solid,
}: {
  icon: string;
  color: string;
  size?: number;
  solid?: boolean;
}) {
  const t = useTheme();
  const c = tint(color, t);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? c : alpha(c, t.scheme === 'dark' ? 0.14 : 0.12),
      }}
    >
      <Icon
        name={isIconName(icon) ? icon : 'sparkle'}
        size={Math.round(size * 0.52)}
        color={solid ? (t.scheme === 'dark' ? t.onAccent : '#FFFFFF') : c}
        weight={solid ? 'fill' : 'duotone'}
      />
    </View>
  );
}
