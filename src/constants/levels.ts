export interface Level {
  name: string;
  minXP: number;
  icon: string;
  color: string;
}

export const LEVELS: Level[] = [
  { name: 'Novice', minXP: 0, icon: '🥚', color: '#9CA3AF' },
  { name: 'Apprentice', minXP: 100, icon: '🐣', color: '#10B981' },
  { name: 'Seeker', minXP: 250, icon: '🌱', color: '#3B82F6' },
  { name: 'Initiate', minXP: 500, icon: '🌿', color: '#6366F1' },
  { name: 'Adept', minXP: 1000, icon: '⚔️', color: '#8B5CF6' },
  { name: 'Expert', minXP: 2000, icon: '🛡️', color: '#EC4899' },
  { name: 'Master', minXP: 3500, icon: '🔥', color: '#F43F5E' },
  { name: 'Grandmaster', minXP: 5500, icon: '⚡', color: '#F59E0B' },
  { name: 'Legend', minXP: 8000, icon: '🌟', color: '#EAB308' },
  { name: 'Mythic', minXP: 12000, icon: '🔮', color: '#14B8A6' },
  { name: 'Divine', minXP: 17000, icon: '👑', color: '#A855F7' },
  { name: 'Celestial', minXP: 24000, icon: '🌌', color: '#0EA5E9' },
  { name: 'Cosmic', minXP: 33000, icon: '🌠', color: '#D946EF' },
  { name: 'Ascendant', minXP: 45000, icon: '🌈', color: '#F43F5E' },
  { name: 'Omniscient', minXP: 60000, icon: '👁️', color: '#FFFFFF' },
];
