import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from './theme';

/**
 * The Ritual mark: a lowercase "r" whose dot is one more day done.
 * Geometry lives on a 100×100 grid so it matches the generated app icons exactly.
 */
export function LogoMark({ size = 32, color, dot }: { size?: number; color?: string; dot?: string }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Ritual">
      <Path
        d="M29 75 V45 A20 20 0 0 1 49 25"
        fill="none"
        stroke={color ?? t.text}
        strokeWidth={15}
        strokeLinecap="round"
      />
      <Circle cx={69.5} cy={25} r={8.6} fill={dot ?? (t.scheme === 'dark' ? t.accent : t.accentInk)} />
    </Svg>
  );
}

export function Wordmark({ size = 26, color, dot }: { size?: number; color?: string; dot?: string }) {
  const t = useTheme();
  return (
    <Text
      weight="heavy"
      size={size}
      color={color ?? t.text}
      style={{ letterSpacing: -size * 0.055, lineHeight: size * 1.1 }}
      accessibilityRole="header"
    >
      ritual
      <Text weight="heavy" size={size} color={dot ?? (t.scheme === 'dark' ? t.accent : t.accentInk)}>
        .
      </Text>
    </Text>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }}>
      <LogoMark size={size * 1.2} />
      <Wordmark size={size} />
    </View>
  );
}
