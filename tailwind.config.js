/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#0C0E14',
        surface1: 'rgba(255, 255, 255, 0.06)',
        surface2: 'rgba(255, 255, 255, 0.10)',
        primary: '#7C3AED',
        secondary: '#10B981',
        warm: '#F59E0B',
        streakFire: '#FF6B35',
        textPrimary: '#F9FAFB',
        textSecondary: '#9CA3AF',
        border: 'rgba(255, 255, 255, 0.08)',
        danger: '#EF4444',
        success: '#10B981',
      },
      fontFamily: {
        hero: ['Inter-Black', 'sans-serif'],
        heading: ['Inter-SemiBold', 'sans-serif'],
        body: ['Inter-Regular', 'sans-serif'],
        stat: ['Inter-Medium', 'sans-serif'],
        mono: ['JetBrainsMono-Regular', 'monospace'],
      }
    },
  },
  plugins: [],
}
