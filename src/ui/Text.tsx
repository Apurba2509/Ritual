import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { FontWeight, fonts, Theme, useTheme } from './theme';

export type TextVariant =
  | 'display'
  | 'hero'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'small'
  | 'label'
  | 'number';

// Inter Tight is set tight: large sizes get proportionally more negative tracking.
const VARIANTS: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.heavy, fontSize: 44, lineHeight: 46, letterSpacing: -2 },
  hero: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 40, letterSpacing: -1.4 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.9 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.45 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  number: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -1, fontVariant: ['tabular-nums'] },
};

export type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'success' | 'danger' | 'inverse' | 'onAccent';

const toneColor = (t: Theme, tone: Tone) =>
  ({
    default: t.text,
    muted: t.textMuted,
    faint: t.textFaint,
    accent: t.accentInk,
    success: t.success,
    danger: t.danger,
    inverse: t.bg,
    onAccent: t.onAccent,
  })[tone];

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
  size?: number;
  weight?: FontWeight;
  tabular?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'default',
  color,
  align,
  size,
  weight,
  tabular,
  style,
  ...props
}: TextProps) {
  const t = useTheme();
  const v = VARIANTS[variant];
  return (
    <RNText
      {...props}
      style={[
        v,
        { color: color ?? toneColor(t, tone), textAlign: align },
        size
          ? {
              fontSize: size,
              lineHeight: Math.round(size * (size >= 28 ? 1.12 : 1.3)),
              // keep the tight look when a size is overridden
              letterSpacing: size >= 24 ? -size * 0.035 : (v.letterSpacing ?? 0),
            }
          : null,
        weight ? { fontFamily: fonts[weight] } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
