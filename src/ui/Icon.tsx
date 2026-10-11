import type { IconWeight } from 'phosphor-react-native';
import { ICONS, IconName, isIconName } from './icons';
import { useTheme } from './theme';

export type { IconName };
export { isIconName };

const ICON_STYLE = { position: 'relative' } as const;

export function Icon({
  name,
  size = 20,
  color,
  weight = 'bold',
  duotoneColor,
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
  duotoneColor?: string;
}) {
  const t = useTheme();
  const Glyph = ICONS[name] ?? ICONS.sparkle;
  return (
    <Glyph
      size={size}
      color={color ?? t.text}
      weight={weight}
      duotoneColor={duotoneColor}
      duotoneOpacity={weight === 'duotone' ? 0.28 : undefined}
      // Positioned, so icons paint above absolutely-positioned backgrounds (rings, discs) on web.
      style={ICON_STYLE}
    />
  );
}
