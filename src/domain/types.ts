import type { DayKey } from './dates';

/** How progress on a habit is measured. */
export type HabitKind =
  | 'check' // done / not done
  | 'count' // reach N of something (glasses, pages, problems)
  | 'duration'; // reach N minutes

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Schedule =
  | { type: 'daily' }
  | { type: 'days'; days: number[] } // specific weekdays, 0 = Sunday
  | { type: 'weekly'; times: number }; // any N days per week

/** Where a habit's progress can come from automatically. */
export type AutoSource =
  | { provider: 'github'; username: string }
  | { provider: 'leetcode'; username: string }
  | { provider: 'health'; metric: HealthMetric };

export type HealthMetric = 'steps' | 'exercise' | 'sleep';

export type EntrySource = 'manual' | 'notification' | 'timer' | 'ai' | 'github' | 'leetcode' | 'health';

export type CategoryId =
  'health' | 'fitness' | 'mind' | 'learning' | 'career' | 'productivity' | 'social' | 'finance' | 'creativity' | 'home';

/** Fields every synced document carries. */
export interface SyncFields {
  /** Client clock (ms) of the last local change — drives last-write-wins merges. */
  updatedAt: number;
  /** Tombstone: deletes are synced as soft-deletes so other devices learn about them. */
  deleted?: boolean;
}

export interface Habit extends SyncFields {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: HabitKind;
  /** check → 1, count → N, duration → minutes */
  target: number;
  unit: string | null;
  schedule: Schedule;
  /** Local "HH:mm" reminder times. */
  reminders: string[];
  auto: AutoSource | null;
  category: CategoryId | null;
  difficulty: Difficulty;
  /** Optional "why" — shown on the detail screen and used by the AI coach. */
  intention: string | null;
  order: number;
  archived: boolean;
  /** Set when the habit was created by joining a community challenge. */
  challengeId: string | null;
  createdAt: number;
}

export type Mood = 1 | 2 | 3 | 4 | 5;

/** One record per habit per calendar day. id = `${habitId}_${date}` */
export interface Entry extends SyncFields {
  id: string;
  habitId: string;
  date: DayKey;
  value: number;
  /** An intentional rest day: doesn't count, doesn't break the streak. */
  skipped: boolean;
  note: string | null;
  mood: Mood | null;
  /** Optional photo proof (Cloudinary URL). */
  photoUrl?: string | null;
  source: EntrySource;
  /** When the target was first reached (ms) — used for early-bird / night-owl badges. */
  completedAt: number | null;
}

export const entryId = (habitId: string, date: DayKey) => `${habitId}_${date}`;

export type EntryIndex = Map<string, Map<DayKey, Entry>>; // habitId → day → entry
