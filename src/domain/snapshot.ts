import { ACHIEVEMENTS, AchievementStats, isUnlocked } from './achievements';
import { addDays, DayKey, diffDays, startOfWeek, WeekStart } from './dates';
import {
  buildEntryIndex,
  completionRate,
  computeStreak,
  habitStartDay,
  isEntryDone,
  isEntrySkipped,
  isScheduledOn,
  StreakInfo,
} from './habits';
import type { Entry, EntryIndex, Habit } from './types';
import { completionXP, levelProgress, milestoneBonus } from './xp';

export interface HabitStats {
  habit: Habit;
  streak: Omit<StreakInfo, 'runByDay'>;
  rate30: number | null;
  totalDone: number;
  xp: number;
}

export interface DaySummary {
  due: number;
  done: number;
}

export interface SnapshotInput {
  habits: Habit[];
  entries: Entry[];
  today: DayKey;
  weekStart: WeekStart;
  unlocked: Record<string, number>;
  friends: number;
  challengesJoined: number;
}

export interface Snapshot {
  today: DayKey;
  index: EntryIndex;
  habitStats: Map<string, HabitStats>;
  xp: number;
  weeklyXP: number;
  level: ReturnType<typeof levelProgress>;
  totalCompletions: number;
  days: Map<DayKey, DaySummary>;
  perfectDays: number;
  perfectRun: number;
  bestPerfectRun: number;
  bestStreak: { days: number; habitId: string | null };
  achievementStats: AchievementStats;
  /** Achievements whose conditions are met but which aren't recorded as unlocked yet. */
  newlyUnlocked: string[];
}

const AUTO_SOURCES = new Set(['github', 'leetcode', 'health']);

export function computeSnapshot(input: SnapshotInput): Snapshot {
  const { today, weekStart } = input;
  const habits = input.habits.filter((h) => !h.deleted);
  const index = buildEntryIndex(input.entries);
  const weekBegin = startOfWeek(today, weekStart);
  const from30 = addDays(today, -29);

  const habitStats = new Map<string, HabitStats>();
  let habitXP = 0;
  let weeklyXP = 0;
  let totalCompletions = 0;
  let bestStreak = { days: 0, habitId: null as string | null };
  let bestStreakDays = 0;
  let earlyBird = false;
  let nightOwl = false;
  let comeback = false;
  let autoCompletions = 0;
  let aiLogs = 0;
  let focusSessions = 0;
  let notesWritten = 0;

  for (const habit of habits) {
    const byDay = index.get(habit.id);
    const streak = computeStreak(habit, byDay, today, weekStart);
    let xp = 0;
    let totalDone = 0;
    let lastDone: DayKey | null = null;

    // Walk completed days in order: XP, milestones, and badge signals.
    const days = byDay ? [...byDay.keys()].sort() : [];
    for (const day of days) {
      const entry = byDay!.get(day)!;
      if (entry.note) notesWritten++;
      if (!isEntryDone(habit, entry)) continue;
      totalDone++;
      const run = streak.runByDay.get(day) ?? 1;
      const gained = completionXP(habit.difficulty, run) + milestoneBonus(streak.unit, run);
      xp += gained;
      if (day >= weekBegin && day <= today) weeklyXP += gained;

      if (AUTO_SOURCES.has(entry.source)) autoCompletions++;
      if (entry.source === 'ai') aiLogs++;
      if (entry.source === 'timer') focusSessions++;
      if (entry.completedAt && entry.source !== 'github' && entry.source !== 'leetcode') {
        const hour = new Date(entry.completedAt).getHours();
        if (hour < 7 && hour >= 4) earlyBird = true;
        if (hour >= 23) nightOwl = true;
      }
      if (lastDone && diffDays(lastDone, day) >= 8) comeback = true;
      lastDone = day;
    }

    habitXP += xp;
    totalCompletions += totalDone;
    if (streak.unit === 'day') {
      bestStreakDays = Math.max(bestStreakDays, streak.longest);
      if (!habit.archived && streak.current > bestStreak.days) {
        bestStreak = { days: streak.current, habitId: habit.id };
      }
    }

    const { runByDay: _ignored, ...streakPublic } = streak;
    habitStats.set(habit.id, {
      habit,
      streak: streakPublic,
      rate30: completionRate(habit, byDay, from30, today, today, weekStart),
      totalDone,
      xp,
    });
  }

  // Daily summaries (heatmap, perfect days). Covers ~1 year back.
  const days = new Map<DayKey, DaySummary>();
  let earliest = today;
  for (const h of habits) {
    const s = habitStartDay(h, index.get(h.id));
    if (s < earliest) earliest = s;
  }
  const floor = addDays(today, -370);
  if (earliest < floor) earliest = floor;

  let perfectDays = 0;
  let run = 0;
  let bestPerfectRun = 0;
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    let due = 0;
    let done = 0;
    for (const h of habits) {
      const byDay = index.get(h.id);
      const entry = byDay?.get(d);
      const isDone = isEntryDone(h, entry);
      if (isDone) {
        done++;
        due++;
        continue;
      }
      if (h.archived || h.schedule.type === 'weekly') continue;
      if (d < habitStartDay(h, byDay)) continue;
      if (isEntrySkipped(entry)) continue;
      if (isScheduledOn(h.schedule, d)) due++;
    }
    days.set(d, { due, done });
    if (due === 0) continue; // nothing expected — neutral
    if (done >= due) {
      perfectDays++;
      run++;
      bestPerfectRun = Math.max(bestPerfectRun, run);
    } else if (d !== today) {
      run = 0;
    }
  }

  const friends = input.friends;
  const challengesJoined = Math.max(input.challengesJoined, habits.filter((h) => h.challengeId).length);

  // Achievement XP is included in the level, so resolve unlocks iteratively (max 2 passes).
  const unlocked = new Set(Object.keys(input.unlocked));
  const achievementXP = () => ACHIEVEMENTS.reduce((sum, a) => (unlocked.has(a.id) ? sum + a.xp : sum), 0);

  const baseStats = {
    totalCompletions,
    activeHabits: habits.filter((h) => !h.archived).length,
    bestStreakDays,
    perfectDays,
    bestPerfectRun,
    earlyBird,
    nightOwl,
    comeback,
    autoCompletions,
    aiLogs,
    focusSessions,
    notesWritten,
    friends,
    challengesJoined,
  };

  const newlyUnlocked: string[] = [];
  let stats: AchievementStats = { ...baseStats, level: levelProgress(habitXP + achievementXP()).level };
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.has(a.id) && isUnlocked(a, stats)) {
        unlocked.add(a.id);
        newlyUnlocked.push(a.id);
        changed = true;
      }
    }
    stats = { ...baseStats, level: levelProgress(habitXP + achievementXP()).level };
    if (!changed) break;
  }

  const xp = habitXP + achievementXP();

  return {
    today,
    index,
    habitStats,
    xp,
    weeklyXP,
    level: levelProgress(xp),
    totalCompletions,
    days,
    perfectDays,
    perfectRun: run,
    bestPerfectRun,
    bestStreak,
    achievementStats: stats,
    newlyUnlocked,
  };
}
