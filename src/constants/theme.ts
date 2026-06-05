export const theme = {
  colors: {
    background: '#0C0E14',
    surface1: 'rgba(255, 255, 255, 0.06)',
    surface2: 'rgba(255, 255, 255, 0.10)',
    primary: '#7C3AED', // Electric violet
    secondary: '#10B981', // Mint green
    warm: '#F59E0B', // Amber
    streakFire: '#FF6B35',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: 'rgba(255, 255, 255, 0.08)',
    danger: '#EF4444',
    success: '#10B981',
  },
  typography: {
    hero: {
      fontFamily: 'Inter-Black',
      fontWeight: '900' as const,
      fontSize: 64,
    },
    heading: {
      fontFamily: 'Inter-SemiBold',
      fontWeight: '600' as const,
      fontSize: 24,
    },
    body: {
      fontFamily: 'Inter-Regular',
      fontWeight: '400' as const,
      fontSize: 16,
    },
    statLabel: {
      fontFamily: 'Inter-Medium',
      fontWeight: '500' as const,
      fontSize: 12,
      letterSpacing: 0.6, // roughly 0.05em for 12px
      textTransform: 'uppercase' as const,
    },
    mono: {
      fontFamily: 'JetBrainsMono-Regular',
      fontSize: 14,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999,
  },
};
