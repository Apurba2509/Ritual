import { createContext, createElement, ReactNode, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { tintKey, TintKey } from '@/domain/catalog';
import { useApp } from '@/data/store';

/**
 * Ritual's brand system — "Volt".
 * Ink black + bone white, one electric accent. Colour is used sparingly: the accent means
 * "done / progress", everything else is neutral so that moment stands out.
 */
export const brand = {
  ink: '#0B0B0C',
  bone: '#F4F4F1',
  volt: '#D4FF3F',
};

export const dark = {
  scheme: 'dark' as 'dark' | 'light',
  bg: brand.ink,
  bgElevated: '#121213',
  surface: '#151516',
  surface2: '#1C1C1E',
  surface3: '#262628',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',
  text: brand.bone,
  textMuted: '#8F8F8A',
  textFaint: '#5C5C57',
  /** Fill for primary buttons, done states, progress. */
  accent: brand.volt,
  /** Text/icons placed on top of `accent`. */
  onAccent: brand.ink,
  /** Accent used as a line or text on the background (rings, links, highlights). */
  accentInk: brand.volt,
  accentSoft: 'rgba(212,255,63,0.12)',
  success: brand.volt,
  successSoft: 'rgba(212,255,63,0.12)',
  warning: '#FFC94D',
  danger: '#FF6B5E',
  dangerSoft: 'rgba(255,107,94,0.13)',
  info: '#7FD8FF',
  overlay: 'rgba(0,0,0,0.66)',
  tabBar: '#18181A',
  /** Heatmap levels: empty → full. */
  heat: ['#1A1A1C', '#34400F', '#5E7A16', '#9CC72A', brand.volt],
  shadow: '#000000',
};

export type Theme = typeof dark;

export const light: Theme = {
  scheme: 'light',
  bg: brand.bone,
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#EDEDE8',
  surface3: '#E1E1DB',
  border: 'rgba(11,11,12,0.07)',
  borderStrong: 'rgba(11,11,12,0.13)',
  text: brand.ink,
  textMuted: '#6B6B66',
  textFaint: '#A3A39D',
  accent: brand.volt,
  onAccent: brand.ink,
  // Volt has no contrast on white, so lines and text go ink-olive in light mode.
  accentInk: '#3F5A00',
  accentSoft: 'rgba(120,170,0,0.13)',
  success: '#3F5A00',
  successSoft: 'rgba(120,170,0,0.13)',
  warning: '#B97800',
  danger: '#D93A2B',
  dangerSoft: 'rgba(217,58,43,0.10)',
  info: '#0A84C6',
  overlay: 'rgba(11,11,12,0.42)',
  tabBar: '#FFFFFF',
  heat: ['#E6E6E0', '#E3F5A6', '#C6EA55', '#94C21A', '#5C8000'],
  shadow: '#3A3A30',
};

const ForcedScheme = createContext<'dark' | 'light' | null>(null);

/** Render a subtree in a fixed scheme (e.g. share cards are always brand-dark). */
export function ForceTheme({ scheme, children }: { scheme: 'dark' | 'light'; children: ReactNode }) {
  return createElement(ForcedScheme.Provider, { value: scheme }, children);
}

export function useTheme(): Theme {
  const forced = useContext(ForcedScheme);
  const pref = useApp((s) => s.settings.theme);
  const system = useColorScheme();
  const scheme = forced ?? (pref === 'system' ? (system ?? 'dark') : pref);
  return scheme === 'light' ? light : dark;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { xs: 8, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  heavy: 'InterTight_800ExtraBold',
  mono: 'GeistMono_500Medium',
};

export type FontWeight = Exclude<keyof typeof fonts, 'mono'>;

// ─── Habit colours ───────────────────────────────────────────────────────────
// Stored on habits as a key. Each has a bright tone for dark mode and a deeper one for light.

export const HABIT_TINTS = {
  lime: { dark: '#D4FF3F', light: '#5E8500' },
  sky: { dark: '#7FD8FF', light: '#0A7FC0' },
  mint: { dark: '#6FF0C2', light: '#0B9C70' },
  lilac: { dark: '#C4A6FF', light: '#7046E8' },
  rose: { dark: '#FF8FAB', light: '#D23468' },
  coral: { dark: '#FF8A6B', light: '#DE4A28' },
  peach: { dark: '#FFB977', light: '#C76A12' },
  butter: { dark: '#FFE27A', light: '#A88000' },
  slate: { dark: '#C3C8D1', light: '#59606B' },
} satisfies Record<TintKey, { dark: string; light: string }>;

/** Display colour for a habit's tint key (or legacy hex) in the current scheme. */
export function tint(color: string | null | undefined, t: Pick<Theme, 'scheme'>): string {
  return HABIT_TINTS[tintKey(color)][t.scheme];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Translucent version of a hex colour, e.g. alpha('#D4FF3F', 0.15). */
export function alpha(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Cross-platform drop shadow (RN 0.76+ `boxShadow`, also native on web). */
export function shadow(color: string, opacity: number, blur: number, y = 0) {
  return { boxShadow: `0px ${y}px ${blur}px ${alpha(color, opacity)}` } as const;
}

/** The soft card shadow used in light mode (dark mode relies on borders instead). */
export function cardShadow(t: Theme) {
  return t.scheme === 'light' ? shadow(t.shadow, 0.07, 18, 6) : null;
}
