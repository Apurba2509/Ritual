export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  condition?: (stats: any) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    key: 'first_habit',
    title: 'The Journey Begins',
    description: 'Created your first habit.',
    icon: '🌱',
  },
  {
    key: 'streak_3',
    title: 'Gaining Momentum',
    description: 'Hit a 3-day streak on any habit.',
    icon: '🔥',
  },
  {
    key: 'streak_7',
    title: 'One Week Strong',
    description: 'Maintained a 7-day streak.',
    icon: '🚀',
  },
  {
    key: 'streak_30',
    title: 'Unstoppable',
    description: 'Reached a massive 30-day streak.',
    icon: '💎',
  },
  {
    key: 'perfect_week',
    title: 'Flawless Victory',
    description: 'Completed all active habits for 7 days straight.',
    icon: '👑',
  },
  {
    key: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Added 5 friends.',
    icon: '🦋',
  },
];
