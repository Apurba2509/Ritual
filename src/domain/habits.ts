import { addDays, dayKeyFromTimestamp, DayKey, minKey, startOfWeek, WeekStart, weekdayOf } from './dates';
import type { Entry, EntryIndex, Habit, Schedule } from './types';

// ─── Progress ────────────────────────────────────────────────────────────────

export function isEntryDone(habit: Habit, entry: Entry | undefined): boolean {
  return !!entry && !entry.deleted && !entry.skipped && entry.value >= habit.target;
}

export function isEntrySkipped(entry: Entry | undefined): boolean {
  return !!entry && !entry.deleted && entry.skipped;
}

export function progressOf(habit: Habit, entry: Entry | undefined): number {
  if (!entry || entry.deleted || entry.skipped) return 0;
  return Math.min(1, entry.value / Math.max(1, habit.target));
}

export function buildEntryIndex(entries: Iterable<Entry>): EntryIndex {
  const index: EntryIndex = new Map();
  for (const e of entries) {
    if (e.deleted) continue;
    let byDay = index.get(e.habitId);
    if (!byDay) index.set(e.habitId, (byDay = new Map()));
    byDay.set(e.date, e);
  }
  return index;
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

/** Whether a specific day is one the habit is expected on (weekly habits: any day can count). */
export function isScheduledOn(schedule: Schedule, day: DayKey): boolean {
  switch (schedule.type) {
    case 'daily':
      return true;
    case 'days':
      return schedule.days.includes(weekdayOf(day));
    case 'weekly':
      return true;
  }
}

export function countDoneInWeek(
  habit: Habit,
  byDay: Map<DayKey, Entry> | undefined,
  day: DayKey,
  weekStart: WeekStart,
): number {
  if (!byDay) return 0;
  const start = startOfWeek(day, weekStart);
  let n = 0;
  for (let i = 0; i < 7; i++) if (isEntryDone(habit, byDay.get(addDays(start, i)))) n++;
  return n;
}

/**
 * Is the habit on today's list?  Weekly ("3× a week") habits stay on the list until the
 * weekly target is met, and also show on the day they were completed.
 */
export function isDueOn(
  habit: Habit,
  byDay: Map<DayKey, Entry> | undefined,
  day: DayKey,
  weekStart: WeekStart,
): boolean {
  if (habit.archived || habit.deleted) return false;
  if (habit.schedule.type !== 'weekly') return isScheduledOn(habit.schedule, day);
  const entry = byDay?.get(day);
  if (isEntryDone(habit, entry) || (entry && entry.value > 0)) return true;
  return countDoneInWeek(habit, byDay, day, weekStart) < habit.schedule.times;
}

export function scheduleLabel(schedule: Schedule): string {
  switch (schedule.type) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      return `${schedule.times}× a week`;
    case 'days': {
      const d = [...schedule.days].sort();
      if (d.length === 7) return 'Every day';
      if (d.join() === '1,2,3,4,5') return 'Weekdays';
      if (d.join() === '0,6') return 'Weekends';
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return d.map((i) => names[i]).join(' · ');
    }
  }
}

export function targetLabel(habit: Pick<Habit, 'kind' | 'target' | 'unit'>): string {
  if (habit.kind === 'check') return 'Done';
  if (habit.kind === 'duration') return `${habit.target} min`;
  // Locale-independent thousands separator so output is stable in tests and on every device.
  const n = String(habit.target).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n} ${habit.unit ?? ''}`.trim();
}

// ─── Streaks ─────────────────────────────────────────────────────────────────

export interface StreakInfo {
  current: number;
  longest: number;
  unit: 'day' | 'week';
  /** Today is a scheduled day, not done yet, and there is a streak to lose. */
  atRisk: boolean;
  /** streak value reached on each completed day (used to compute XP & milestones). */
  runByDay: Map<DayKey, number>;
}

/** First day we have to consider: creation day, or earlier if history was imported. */
export function habitStartDay(habit: Habit, byDay: Map<DayKey, Entry> | undefined): DayKey {
  let start = dayKeyFromTimestamp(habit.createdAt);
  if (byDay) for (const k of byDay.keys()) start = minKey(start, k);
  return start;
}

/**
 * Streak rules
 *  - Day-based habits: consecutive *scheduled* days completed. Unscheduled days are
 *    ignored, a completion on an unscheduled day still counts, skipped (rest) days are
 *    neutral, and today never breaks a streak while it is still in progress.
 *  - Weekly habits ("N× a week"): consecutive weeks where the target was hit; the
 *    current week only counts once it is met.
 */
export function computeStreak(
  habit: Habit,
  byDay: Map<DayKey, Entry> | undefined,
  today: DayKey,
  weekStart: WeekStart,
): StreakInfo {
  const runByDay = new Map<DayKey, number>();
  const start = habitStartDay(habit, byDay);

  if (habit.schedule.type === 'weekly') {
    const times = habit.schedule.times;
    let run = 0;
    let longest = 0;
    const thisWeek = startOfWeek(today, weekStart);
    for (let w = startOfWeek(start, weekStart); w <= thisWeek; w = addDays(w, 7)) {
      const doneDays: DayKey[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(w, i);
        if (d > today) break;
        if (isEntryDone(habit, byDay?.get(d))) doneDays.push(d);
      }
      if (doneDays.length >= times) {
        run++;
        longest = Math.max(longest, run);
        for (const d of doneDays) runByDay.set(d, run);
      } else if (w === thisWeek) {
        // In progress — completions so far still earn XP at the would-be streak.
        for (const d of doneDays) runByDay.set(d, run);
      } else {
        for (const d of doneDays) runByDay.set(d, 0);
        run = 0;
      }
    }
    return { current: run, longest, unit: 'week', atRisk: false, runByDay };
  }

  let run = 0;
  let longest = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const entry = byDay?.get(d);
    if (isEntryDone(habit, entry)) {
      run++;
      longest = Math.max(longest, run);
      runByDay.set(d, run);
      continue;
    }
    if (!isScheduledOn(habit.schedule, d)) continue;
    if (isEntrySkipped(entry)) continue;
    if (d === today) continue; // still time left today
    run = 0;
  }

  const todayEntry = byDay?.get(today);
  const atRisk =
    run > 0 && isScheduledOn(habit.schedule, today) && !isEntryDone(habit, todayEntry) && !isEntrySkipped(todayEntry);

  return { current: run, longest, unit: 'day', atRisk, runByDay };
}

/** Share of scheduled days completed in [from, to] (skipped days excluded). */
export function completionRate(
  habit: Habit,
  byDay: Map<DayKey, Entry> | undefined,
  from: DayKey,
  to: DayKey,
  today: DayKey,
  weekStart: WeekStart,
): number | null {
  const start = habitStartDay(habit, byDay);
  const lo = from > start ? from : start;
  if (lo > to) return null;

  if (habit.schedule.type === 'weekly') {
    let due = 0;
    let done = 0;
    for (let w = startOfWeek(lo, weekStart); w <= to; w = addDays(w, 7)) {
      const n = countDoneInWeek(habit, byDay, w, weekStart);
      const isCurrent = w === startOfWeek(today, weekStart);
      if (isCurrent && n < habit.schedule.times) continue;
      due += habit.schedule.times;
      done += Math.min(n, habit.schedule.times);
    }
    return due ? done / due : null;
  }

  let due = 0;
  let done = 0;
  for (let d = lo; d <= to; d = addDays(d, 1)) {
    const entry = byDay?.get(d);
    const isDone = isEntryDone(habit, entry);
    if (!isScheduledOn(habit.schedule, d) && !isDone) continue;
    if (isEntrySkipped(entry)) continue;
    if (d === today && !isDone) continue;
    due++;
    if (isDone) done++;
  }
  return due ? done / due : null;
}
