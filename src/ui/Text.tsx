import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { fonts, Theme, useTheme } from './theme';

export type TextVariant =
  'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'number';

const VARIANTS: Record<TextVariant, TextStyle> = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
  number: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
};

type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'xp' | 'success' | 'danger' | 'inverse';

const toneColor = (t: Theme, tone: Tone) =>
  ({
    default: t.text,
    muted: t.textMuted,
    faint: t.textFaint,
    accent: t.accent,
    xp: t.xp,
    success: t.success,
    danger: t.danger,
    inverse: t.bg,
  })[tone];

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
  size?: number;
}

export function Text({ variant = 'body', tone = 'default', color, align, size, style, ...props }: TextProps) {
  const t = useTheme();
  const v = VARIANTS[variant];
  return (
    <RNText
      {...props}
      style={[
        v,
        { color: color ?? toneColor(t, tone), textAlign: align },
        size ? { fontSize: size, lineHeight: Math.round(size * 1.18) } : null,
        style,
      ]}
    />
  );
}
