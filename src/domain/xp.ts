import type { DayKey } from './dates';
import type { Difficulty } from './types';

/**
 * XP is *derived* from history rather than stored as a running counter, so it can never
 * drift between devices: same entries in → same XP out.
 */

export const BASE_XP: Record<Difficulty, number> = { easy: 10, medium: 15, hard: 25 };

/** Longer streaks pay more — up to 2× at a 30 (day or week) streak. */
export function completionXP(difficulty: Difficulty, streak: number): number {
  const mult = 1 + Math.min(Math.max(streak - 1, 0), 30) / 30;
  return Math.round(BASE_XP[difficulty] * mult);
}

export const DAY_MILESTONES: Record<number, number> = {
  7: 50,
  21: 150,
  30: 250,
  66: 500, // research-backed average for a behaviour to become automatic
  100: 1000,
  200: 2000,
  365: 5000,
};

export const WEEK_MILESTONES: Record<number, number> = {
  4: 100,
  12: 300,
  26: 750,
  52: 2000,
};

export function milestoneBonus(unit: 'day' | 'week', streak: number): number {
  return (unit === 'day' ? DAY_MILESTONES : WEEK_MILESTONES)[streak] ?? 0;
}

export function nextMilestone(unit: 'day' | 'week', streak: number): number | null {
  const keys = Object.keys(unit === 'day' ? DAY_MILESTONES : WEEK_MILESTONES).map(Number);
  return keys.find((k) => k > streak) ?? null;
}

export interface XPLedgerItem {
  day: DayKey;
  amount: number;
  kind: 'completion' | 'milestone';
  habitId: string;
  streak: number;
}

// ─── Levels ──────────────────────────────────────────────────────────────────

/** Total XP needed to reach `level`: 0, 100, 300, 600, 1000, 1500 … (triangular curve). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXP(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 12.5)) / 2));
}

export function levelProgress(xp: number) {
  const level = levelForXP(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    into: xp - floor,
    span: ceil - floor,
    toNext: ceil - xp,
    ratio: (xp - floor) / (ceil - floor),
  };
}

export interface Rank {
  minLevel: number;
  title: string;
  emoji: string;
  color: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1, title: 'Spark', emoji: '✨', color: '#A1A1AA' },
  { minLevel: 3, title: 'Kindling', emoji: '🪵', color: '#F59E0B' },
  { minLevel: 5, title: 'Flame', emoji: '🔥', color: '#FF6A3D' },
  { minLevel: 8, title: 'Blaze', emoji: '☄️', color: '#F43F5E' },
  { minLevel: 12, title: 'Inferno', emoji: '🌋', color: '#E11D48' },
  { minLevel: 16, title: 'Phoenix', emoji: '🦅', color: '#A855F7' },
  { minLevel: 21, title: 'Supernova', emoji: '💫', color: '#6366F1' },
  { minLevel: 30, title: 'Eternal', emoji: '🌌', color: '#22D3EE' },
];

export function rankForLevel(level: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) rank = r;
  return rank;
}
