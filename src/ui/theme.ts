import { useColorScheme } from 'react-native';
import { useApp } from '@/data/store';

const shared = {
  ember: '#FF6A3D',
  emberDeep: '#E8461A',
  violet: '#9D8CFF',
  mint: '#34D399',
  amber: '#FBBF24',
  rose: '#FB7185',
  sky: '#38BDF8',
};

export const dark = {
  scheme: 'dark' as 'dark' | 'light',
  ...shared,
  bg: '#0A0A0F',
  bgElevated: '#101017',
  surface: '#15151D',
  surface2: '#1C1C27',
  surface3: '#262633',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',
  text: '#F5F5F7',
  textMuted: '#A1A1AC',
  textFaint: '#6B6B78',
  accent: shared.ember,
  accentText: '#FFFFFF',
  accentSoft: 'rgba(255,106,61,0.14)',
  xp: shared.violet,
  xpSoft: 'rgba(157,140,255,0.16)',
  success: shared.mint,
  successSoft: 'rgba(52,211,153,0.14)',
  warning: shared.amber,
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.14)',
  overlay: 'rgba(0,0,0,0.62)',
  heat: ['rgba(255,255,255,0.05)', '#5A2A1C', '#A23B1C', '#E2541F', '#FF7A45'],
  shadow: '#000000',
};

export type Theme = typeof dark;

export const light: Theme = {
  scheme: 'light',
  ...shared,
  bg: '#F6F5F2',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F0EEEA',
  surface3: '#E5E2DC',
  border: 'rgba(20,20,24,0.08)',
  borderStrong: 'rgba(20,20,24,0.14)',
  text: '#131316',
  textMuted: '#5E5E69',
  textFaint: '#9A9AA4',
  accent: '#F2541B',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(242,84,27,0.10)',
  xp: '#6D5AE6',
  xpSoft: 'rgba(109,90,230,0.11)',
  success: '#10B981',
  successSoft: 'rgba(16,185,129,0.12)',
  warning: '#D97706',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.10)',
  overlay: 'rgba(15,15,20,0.45)',
  heat: ['rgba(20,20,24,0.06)', '#FFD7C7', '#FFA47F', '#FF7A45', '#E2541F'],
  shadow: '#4B3A2F',
};

export function useTheme(): Theme {
  const pref = useApp((s) => s.settings.theme);
  const system = useColorScheme();
  const scheme = pref === 'system' ? (system ?? 'dark') : pref;
  return scheme === 'light' ? light : dark;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const fonts = {
  display: 'Outfit_700Bold',
  displaySemi: 'Outfit_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Translucent version of a hex colour, e.g. alpha('#FF6A3D', 0.15). */
export function alpha(hex: string, a: number): string {
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
