export interface AchievementStats {
  totalCompletions: number;
  activeHabits: number;
  bestStreakDays: number;
  perfectDays: number;
  bestPerfectRun: number;
  earlyBird: boolean;
  nightOwl: boolean;
  comeback: boolean;
  autoCompletions: number;
  aiLogs: number;
  focusSessions: number;
  notesWritten: number;
  friends: number;
  challengesJoined: number;
  level: number;
}

export type Tier = 'bronze' | 'silver' | 'gold' | 'legendary';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: Tier;
  xp: number;
  /** [current, goal] — drives the progress bar on locked badges. */
  progress: (s: AchievementStats) => [number, number];
}

const count =
  (pick: (s: AchievementStats) => number, goal: number) =>
  (s: AchievementStats): [number, number] => [Math.min(pick(s), goal), goal];
const flag =
  (pick: (s: AchievementStats) => boolean) =>
  (s: AchievementStats): [number, number] => [pick(s) ? 1 : 0, 1];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first habit.',
    icon: 'footprints',
    tier: 'bronze',
    xp: 25,
    progress: count((s) => s.totalCompletions, 1),
  },
  {
    id: 'architect',
    title: 'Architect',
    description: 'Run 3 habits at the same time.',
    icon: 'squares-four',
    tier: 'bronze',
    xp: 50,
    progress: count((s) => s.activeHabits, 3),
  },
  {
    id: 'streak_3',
    title: 'Warming Up',
    description: 'Reach a 3-day streak.',
    icon: 'fire',
    tier: 'bronze',
    xp: 30,
    progress: count((s) => s.bestStreakDays, 3),
  },
  {
    id: 'streak_7',
    title: 'One Week Strong',
    description: 'Reach a 7-day streak.',
    icon: 'calendar-check',
    tier: 'silver',
    xp: 75,
    progress: count((s) => s.bestStreakDays, 7),
  },
  {
    id: 'streak_30',
    title: 'Unbreakable',
    description: 'Reach a 30-day streak.',
    icon: 'hexagon',
    tier: 'gold',
    xp: 300,
    progress: count((s) => s.bestStreakDays, 30),
  },
  {
    id: 'streak_66',
    title: 'Second Nature',
    description: '66 days — the point where habits turn automatic.',
    icon: 'brain',
    tier: 'gold',
    xp: 600,
    progress: count((s) => s.bestStreakDays, 66),
  },
  {
    id: 'streak_365',
    title: 'Year of Rituals',
    description: 'Reach a 365-day streak.',
    icon: 'crown',
    tier: 'legendary',
    xp: 5000,
    progress: count((s) => s.bestStreakDays, 365),
  },
  {
    id: 'perfect_day',
    title: 'Flawless',
    description: 'Finish every habit due in a day.',
    icon: 'star',
    tier: 'bronze',
    xp: 40,
    progress: count((s) => s.perfectDays, 1),
  },
  {
    id: 'perfect_week',
    title: 'Perfect Week',
    description: '7 perfect days in a row.',
    icon: 'trophy',
    tier: 'gold',
    xp: 400,
    progress: count((s) => s.bestPerfectRun, 7),
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: '100 completions.',
    icon: 'check-circle',
    tier: 'silver',
    xp: 200,
    progress: count((s) => s.totalCompletions, 100),
  },
  {
    id: 'thousand',
    title: 'The Thousand',
    description: '1,000 completions.',
    icon: 'medal',
    tier: 'legendary',
    xp: 2000,
    progress: count((s) => s.totalCompletions, 1000),
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Complete a habit before 7 AM.',
    icon: 'sun-horizon',
    tier: 'bronze',
    xp: 40,
    progress: flag((s) => s.earlyBird),
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Complete a habit after 11 PM.',
    icon: 'moon',
    tier: 'bronze',
    xp: 40,
    progress: flag((s) => s.nightOwl),
  },
  {
    id: 'comeback',
    title: 'Comeback Kid',
    description: 'Restart a habit after a week off.',
    icon: 'arrow-counter-clockwise',
    tier: 'silver',
    xp: 100,
    progress: flag((s) => s.comeback),
  },
  {
    id: 'autopilot',
    title: 'Autopilot',
    description: '10 completions tracked automatically.',
    icon: 'lightning',
    tier: 'silver',
    xp: 150,
    progress: count((s) => s.autoCompletions, 10),
  },
  {
    id: 'whisperer',
    title: 'Habit Whisperer',
    description: 'Log habits by talking to Ritual 5 times.',
    icon: 'magic-wand',
    tier: 'silver',
    xp: 100,
    progress: count((s) => s.aiLogs, 5),
  },
  {
    id: 'deep_work',
    title: 'Deep Work',
    description: 'Finish 10 focus sessions.',
    icon: 'timer',
    tier: 'silver',
    xp: 150,
    progress: count((s) => s.focusSessions, 10),
  },
  {
    id: 'journaler',
    title: 'Journaler',
    description: 'Write 10 reflection notes.',
    icon: 'notebook',
    tier: 'bronze',
    xp: 75,
    progress: count((s) => s.notesWritten, 10),
  },
  {
    id: 'squad',
    title: 'Squad Up',
    description: 'Add 3 friends.',
    icon: 'users-three',
    tier: 'silver',
    xp: 100,
    progress: count((s) => s.friends, 3),
  },
  {
    id: 'challenger',
    title: 'Challenger',
    description: 'Join a community challenge.',
    icon: 'flag',
    tier: 'bronze',
    xp: 50,
    progress: count((s) => s.challengesJoined, 1),
  },
  {
    id: 'level_10',
    title: 'Double Digits',
    description: 'Reach level 10.',
    icon: 'rocket-launch',
    tier: 'gold',
    xp: 0,
    progress: count((s) => s.level, 10),
  },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function isUnlocked(a: Achievement, s: AchievementStats): boolean {
  const [cur, goal] = a.progress(s);
  return cur >= goal;
}

export const TIER_COLORS: Record<Tier, string> = {
  bronze: '#D9925B',
  silver: '#C3CAD6',
  gold: '#F2C94C',
  legendary: '#D4FF3F',
};
