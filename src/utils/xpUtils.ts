export const BASE_XP = 10;
export const DIFFICULTY_MULTIPLIER = { easy: 0.8, medium: 1.0, hard: 1.5 };

export const streakMultiplier = (streak: number) => Math.min(1 + streak / 10, 3.0);

export const MILESTONE_BONUSES: Record<number, number> = { 
  7: 50, 
  14: 100, 
  30: 200, 
  60: 500, 
  100: 1000, 
  365: 5000 
};

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 24000, 33000, 45000, 60000];

export function calculateXP(base: number, difficulty: 'easy'|'medium'|'hard', streak: number): number {
  return Math.round(base * DIFFICULTY_MULTIPLIER[difficulty] * streakMultiplier(streak));
}

export function getLevelFromXP(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1; // 1-indexed levels
    }
  }
  return 1;
}

export function getXPProgress(xp: number): { currentLevelXP: number, nextLevelXP: number, progress: number } {
  const level = getLevelFromXP(xp);
  const currentLevelMin = LEVEL_THRESHOLDS[level - 1];
  const nextLevelMin = LEVEL_THRESHOLDS[level] || currentLevelMin + 100000; // max level fallback
  
  const currentLevelXP = xp - currentLevelMin;
  const nextLevelXP = nextLevelMin - currentLevelMin;
  const progress = currentLevelXP / nextLevelXP;
  
  return { currentLevelXP, nextLevelXP, progress };
}
