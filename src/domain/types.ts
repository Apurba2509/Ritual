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
  | { provider: 'health'; metric: HealthMetric }
  | { provider: 'device'; metric: DeviceMetric }
  /** Screen-time limit: done for the day while usage stays at or under `limitMin`. */
  | { provider: 'screen'; scope: ScreenScope; limitMin: number };

/** `all` = total screen time, `guarded` = only the apps you chose to guard (social, video, games…). */
export type ScreenScope = 'all' | 'guarded';

export type HealthMetric = 'steps' | 'exercise' | 'sleep';

/** Sensed on the phone itself: the step counter, or walk / run / ride time and distance. */
export type DeviceMetric = 'steps' | WorkoutType;

export type EntrySource =
  'manual' | 'notification' | 'timer' | 'ai' | 'github' | 'leetcode' | 'health' | 'device' | 'workout' | 'screen';

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
  /** Icon key (see ui/icons). */
  icon: string;
  /** Tint key (see domain/catalog HABIT_TINT_KEYS). */
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
  /**
   * Where this habit is heading. `target` is today's step on the ladder; the coach raises it
   * toward `goalTarget` as the habit sticks (and lowers it when it's too much).
   */
  goalTarget?: number | null;
  /** Implementation intention, e.g. "After my morning coffee". */
  cue?: string | null;
  /** The two-minute version, in the user's own words (falls back to a smart default). */
  tiny?: string | null;
  /** Last time the coach changed the target or schedule — spaces out further suggestions. */
  adjustedAt?: number | null;
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
  /**
   * The goal this day was held to. Recorded at write time so changing a habit's target never
   * rewrites history, and a "tiny version" day can count in full. Missing on older entries,
   * which fall back to the habit's current target.
   */
  goal?: number | null;
}

export const entryId = (habitId: string, date: DayKey) => `${habitId}_${date}`;

export type EntryIndex = Map<string, Map<DayKey, Entry>>; // habitId → day → entry

// ─── Workouts (recorded on the phone: GPS, barometer and steps) ────────────────

export type WorkoutType = 'walk' | 'run' | 'ride';

export interface Workout extends SyncFields {
  id: string;
  type: WorkoutType;
  /** Local day the workout started on. */
  date: DayKey;
  startedAt: number;
  endedAt: number;
  movingSec: number;
  distanceM: number;
  /** How distance was measured: GPS track, or steps × stride when there was no GPS. */
  distanceSource: 'gps' | 'steps' | 'none';
  elevationGainM: number;
  elevationSource: 'barometer' | 'gps' | 'none';
  steps: number;
  /** Seconds taken for each full kilometre. */
  splits: number[];
  /** Google encoded polyline of the simplified route (null without GPS). */
  route: string | null;
  /** Altitude samples (metres) across the session, for the elevation chart. */
  elevationProfile: number[];
}
