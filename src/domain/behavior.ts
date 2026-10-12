import { addDays, DayKey, diffDays, startOfWeek, WeekStart, weekdayOf } from './dates';
import {
  completionRate,
  countDoneInWeek,
  habitStartDay,
  isEntryDone,
  isEntrySkipped,
  isScheduledOn,
  progressOf,
  targetLabel,
} from './habits';
import type { Entry, EntryIndex, Habit, Schedule } from './types';

/**
 * Ritual's behaviour engine: pure, on-device, no network and no AI required.
 *
 * It reads a habit's history the way a good coach would and answers four questions:
 *   1. How strong is this habit really? (habit strength, not a fragile streak)
 *   2. How is it going right now? (state + trend)
 *   3. When does this person actually do it? (learned time, weak weekdays)
 *   4. Is the goal the right size? (shrink when it hurts, grow when it's easy)
 *
 * Grounded in habit research: automaticity builds gradually and a single miss barely dents it
 * (Lally et al., 2010), so strength decays slowly instead of resetting; starting tiny and scaling
 * up beats ambitious starts (Fogg; the "two-minute rule"); and the day after a miss is the one
 * that matters ("never miss twice").
 */

// ─── Habit strength ─────────────────────────────────────────────────────────

/** Strength at which we call a habit automatic. */
export const AUTOMATIC = 0.85;
/** Per scheduled day: half-life of 13 scheduled days. */
const DAY_KEEP = Math.pow(0.5, 1 / 13);
/** Per week for "N× a week" habits: half-life of 4 weeks. */
const WEEK_KEEP = Math.pow(0.5, 1 / 4);

export type HabitPhase = 'starting' | 'building' | 'forming' | 'automatic';

export interface Strength {
  /** 0..1 — an exponential moving average of showing up. */
  value: number;
  phase: HabitPhase;
  /** Perfect days (or weeks, for weekly habits) still needed to reach "automatic". */
  stepsToAutomatic: number;
  /** Rough calendar days to automatic if every scheduled day from now is done. */
  daysToAutomatic: number;
}

function phaseOf(value: number, steps: number): HabitPhase {
  if (value >= AUTOMATIC) return 'automatic';
  if (steps < 4) return 'starting';
  if (value < 0.4) return 'building';
  return 'forming';
}

/**
 * Habit strength in the spirit of Loop Habit Tracker: every scheduled day nudges the score
 * toward 1 (done) or 0 (missed) with a long memory. Partial progress counts partially, rest
 * days are neutral, and today only counts once it's done.
 */
export function habitStrength(
  habit: Habit,
  byDay: Map<DayKey, Entry> | undefined,
  today: DayKey,
  weekStart: WeekStart,
): Strength {
  const start = habitStartDay(habit, byDay);
  const floor = addDays(today, -400);
  let value = 0;
  let steps = 0;

  if (habit.schedule.type === 'weekly') {
    const times = habit.schedule.times;
    const thisWeek = startOfWeek(today, weekStart);
    for (let w = startOfWeek(start > floor ? start : floor, weekStart); w <= thisWeek; w = addDays(w, 7)) {
      const n = countDoneInWeek(habit, byDay, w, weekStart);
      if (w === thisWeek && n < times) break; // the current week counts once it's met
      value = value * WEEK_KEEP + Math.min(1, n / times) * (1 - WEEK_KEEP);
      steps++;
    }
    const need = stepsNeeded(value, WEEK_KEEP);
    return { value, phase: phaseOf(value, steps), stepsToAutomatic: need, daysToAutomatic: need * 7 };
  }

  for (let d = start > floor ? start : floor; d <= today; d = addDays(d, 1)) {
    const entry = byDay?.get(d);
    const done = isEntryDone(habit, entry);
    if (!done && !isScheduledOn(habit.schedule, d)) continue;
    if (isEntrySkipped(entry)) continue;
    if (d === today && !done) continue;
    value = value * DAY_KEEP + (done ? 1 : progressOf(habit, entry) * 0.5) * (1 - DAY_KEEP);
    steps++;
  }
  const need = stepsNeeded(value, DAY_KEEP);
  const perWeek = habit.schedule.type === 'days' ? Math.max(1, habit.schedule.days.length) : 7;
  return {
    value,
    phase: phaseOf(value, steps),
    stepsToAutomatic: need,
    daysToAutomatic: Math.ceil((need * 7) / perWeek),
  };
}

function stepsNeeded(value: number, keep: number): number {
  if (value >= AUTOMATIC) return 0;
  return Math.ceil(Math.log((1 - AUTOMATIC) / (1 - value)) / Math.log(keep));
}

// ─── Patterns ───────────────────────────────────────────────────────────────

export type HabitState = 'new' | 'thriving' | 'steady' | 'slipping' | 'struggling' | 'dormant';
export type Trend = 'up' | 'flat' | 'down';

export interface HabitPattern {
  habitId: string;
  strength: Strength;
  state: HabitState;
  trend: Trend;
  rate7: number | null;
  rate14: number | null;
  rate28: number | null;
  /** Scheduled days (or weekly slots) that counted in the last 14 days. */
  due14: number;
  done14: number;
  /** Yesterday was scheduled and nothing happened. */
  missedYesterday: boolean;
  /** Consecutive scheduled misses ending yesterday. */
  missRun: number;
  daysSinceDone: number | null;
  /** Typical time the person completes it themselves, as "HH:mm" (rounded down to 15 min). */
  usualTime: string | null;
  /** Weekday (0 = Sun) that's clearly harder than the rest, if any. */
  weakDay: number | null;
  weakDayRate: number | null;
  /** Median amount logged on days with any progress (count / duration habits). */
  typicalAmount: number | null;
  /** Weekly habits: can't hit the target this week any more without doubling up. */
  weekBehind: boolean;
}

/** Sources where the completion time reflects when the person chose to act. */
const SELF_SOURCES = new Set(['manual', 'notification', 'timer', 'ai']);

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function analyzeHabit(
  habit: Habit,
  byDay: Map<DayKey, Entry> | undefined,
  today: DayKey,
  weekStart: WeekStart,
): HabitPattern {
  const strength = habitStrength(habit, byDay, today, weekStart);
  const rate7 = completionRate(habit, byDay, addDays(today, -6), today, today, weekStart);
  const rate14 = completionRate(habit, byDay, addDays(today, -13), today, today, weekStart);
  const rate28 = completionRate(habit, byDay, addDays(today, -27), today, today, weekStart);
  const prior = completionRate(habit, byDay, addDays(today, -27), addDays(today, -7), today, weekStart);
  const start = habitStartDay(habit, byDay);
  const age = diffDays(start, today);

  // Due / done in the last 14 days (daily-style habits), for copy like "3 of the last 9 days".
  let due14 = 0;
  let done14 = 0;
  if (habit.schedule.type !== 'weekly') {
    for (let d = addDays(today, -13); d <= today; d = addDays(d, 1)) {
      if (d < start) continue;
      const e = byDay?.get(d);
      const done = isEntryDone(habit, e);
      if ((!isScheduledOn(habit.schedule, d) && !done) || isEntrySkipped(e) || (d === today && !done)) continue;
      due14++;
      if (done) done14++;
    }
  } else if (rate14 !== null) {
    due14 = habit.schedule.times * 2;
    done14 = Math.round(rate14 * due14);
  }

  // Misses ending yesterday.
  let missRun = 0;
  if (habit.schedule.type !== 'weekly') {
    for (let d = addDays(today, -1); d >= start && missRun < 60; d = addDays(d, -1)) {
      if (!isScheduledOn(habit.schedule, d)) continue;
      const e = byDay?.get(d);
      if (isEntryDone(habit, e) || isEntrySkipped(e)) break;
      missRun++;
    }
  }
  const yesterday = addDays(today, -1);
  const missedYesterday =
    habit.schedule.type !== 'weekly' &&
    yesterday >= start &&
    isScheduledOn(habit.schedule, yesterday) &&
    !isEntryDone(habit, byDay?.get(yesterday)) &&
    !isEntrySkipped(byDay?.get(yesterday));

  let lastDone: DayKey | null = null;
  if (byDay)
    for (const [d, e] of byDay) if (d <= today && isEntryDone(habit, e) && (!lastDone || d > lastDone)) lastDone = d;
  const daysSinceDone = lastDone ? diffDays(lastDone, today) : null;
  // Any progress at all — someone logging 5,000 of 8,000 steps every day is trying, not gone.
  let lastActive: DayKey | null = null;
  if (byDay)
    for (const [d, e] of byDay) if (d <= today && e.value > 0 && (!lastActive || d > lastActive)) lastActive = d;
  const daysSinceActive = lastActive ? diffDays(lastActive, today) : null;

  // Usual time: minutes-of-day of self-initiated completions in the last 60 days.
  const minutes: number[] = [];
  if (byDay) {
    const from = addDays(today, -60);
    for (const [d, e] of byDay) {
      if (d < from || !e.completedAt || !SELF_SOURCES.has(e.source) || !isEntryDone(habit, e)) continue;
      const t = new Date(e.completedAt);
      minutes.push(t.getHours() * 60 + t.getMinutes());
    }
  }
  let usualTime: string | null = null;
  if (minutes.length >= 4) {
    // Use the densest 2-hour window so a few outliers don't drag the median around.
    let best: number[] = [];
    for (const m of minutes) {
      const win = minutes.filter((x) => x >= m && x < m + 120);
      if (win.length > best.length) best = win;
    }
    if (best.length >= Math.max(3, minutes.length * 0.5)) {
      const mid = Math.max(0, Math.floor((median(best)! - 10) / 15) * 15);
      usualTime = `${pad(Math.floor(mid / 60))}:${pad(mid % 60)}`;
    }
  }

  // Weak weekday over the last 8 weeks (day-based schedules only).
  let weakDay: number | null = null;
  let weakDayRate: number | null = null;
  if (habit.schedule.type !== 'weekly') {
    const per = Array.from({ length: 7 }, () => ({ due: 0, done: 0 }));
    for (let d = addDays(today, -56); d < today; d = addDays(d, 1)) {
      if (d < start || !isScheduledOn(habit.schedule, d)) continue;
      const e = byDay?.get(d);
      if (isEntrySkipped(e)) continue;
      const w = per[weekdayOf(d)];
      w.due++;
      if (isEntryDone(habit, e)) w.done++;
    }
    const totalDue = per.reduce((n, w) => n + w.due, 0);
    const overall = totalDue ? per.reduce((n, w) => n + w.done, 0) / totalDue : 0;
    per.forEach((w, i) => {
      if (w.due < 4) return;
      const r = w.done / w.due;
      if (overall >= 0.45 && r <= overall - 0.3 && (weakDayRate === null || r < weakDayRate)) {
        weakDay = i;
        weakDayRate = r;
      }
    });
  }

  // Typical amount on days with any progress in the last 14 days.
  let typicalAmount: number | null = null;
  if (habit.kind !== 'check' && byDay) {
    const vals: number[] = [];
    for (let d = addDays(today, -13); d <= today; d = addDays(d, 1)) {
      const e = byDay.get(d);
      if (e && !e.skipped && e.value > 0) vals.push(e.value);
    }
    typicalAmount = vals.length >= 3 ? median(vals) : null;
  }

  let weekBehind = false;
  if (habit.schedule.type === 'weekly') {
    const ws = startOfWeek(today, weekStart);
    const done = countDoneInWeek(habit, byDay, today, weekStart);
    const daysLeft = 7 - diffDays(ws, today); // including today
    weekBehind = done < habit.schedule.times && habit.schedule.times - done > daysLeft;
  }

  let trend: Trend = 'flat';
  if (rate7 !== null && prior !== null) {
    if (rate7 - prior >= 0.15) trend = 'up';
    else if (rate7 - prior <= -0.15) trend = 'down';
  }

  let state: HabitState;
  if (age < 5 || (rate14 === null && daysSinceDone === null && age < 7)) state = 'new';
  else if ((daysSinceActive === null && age >= 7) || (daysSinceActive !== null && daysSinceActive >= 7))
    state = 'dormant';
  else if ((rate14 ?? 0) < 0.4 || missRun >= 3) state = 'struggling';
  else if (trend === 'down' || missedYesterday || (rate14 ?? 1) < 0.65 || weekBehind) state = 'slipping';
  else if ((rate14 ?? 0) >= 0.85 && (rate28 ?? 0) >= 0.8 && due14 >= 6) state = 'thriving';
  else state = 'steady';

  return {
    habitId: habit.id,
    strength,
    state,
    trend,
    rate7,
    rate14,
    rate28,
    due14,
    done14,
    missedYesterday,
    missRun,
    daysSinceDone,
    usualTime,
    weakDay,
    weakDayRate,
    typicalAmount,
    weekBehind,
  };
}

// ─── The person, not just the habits ────────────────────────────────────────

export type UserMood = 'new' | 'thriving' | 'steady' | 'slipping' | 'struggling' | 'returning';

export interface UserState {
  mood: UserMood;
  /** Days since any habit was checked in (null: never). */
  quietDays: number | null;
  active: number;
  /** Too many habits for how things are going right now. */
  overloaded: boolean;
  /** Average 14-day completion across habits with enough history. */
  rate14: number | null;
}

export function analyzeUser(
  habits: Habit[],
  patterns: Map<string, HabitPattern>,
  index: EntryIndex,
  today: DayKey,
  now: number,
): UserState {
  const active = habits.filter((h) => !h.archived && !h.deleted);
  let lastAny: DayKey | null = null;
  for (const h of active) {
    const byDay = index.get(h.id);
    if (!byDay) continue;
    for (const [d, e] of byDay) if (d <= today && e.value > 0 && (!lastAny || d > lastAny)) lastAny = d;
  }
  const quietDays = lastAny ? diffDays(lastAny, today) : null;
  const rates = active.map((h) => patterns.get(h.id)?.rate14).filter((r): r is number => r !== null && r !== undefined);
  const rate14 = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const struggling = active.filter((h) => {
    const s = patterns.get(h.id)?.state;
    return s === 'struggling' || s === 'dormant';
  }).length;
  const overloaded = active.length >= 5 && rate14 !== null && rate14 < 0.5;

  let mood: UserMood;
  const oldest = active.reduce<number | null>((m, h) => (m === null || h.createdAt < m ? h.createdAt : m), null);
  const brandNew = !active.length || (oldest !== null && now - oldest < 3 * 86_400_000 && quietDays === null);
  if (brandNew) mood = 'new';
  else if (quietDays === null || quietDays >= 3) mood = 'returning';
  else if (rate14 !== null && rate14 >= 0.85) mood = 'thriving';
  else if (rate14 !== null && (rate14 < 0.4 || struggling >= Math.max(2, active.length / 2))) mood = 'struggling';
  else if (rate14 !== null && rate14 < 0.65) mood = 'slipping';
  else mood = 'steady';

  return { mood, quietDays, active: active.length, overloaded, rate14 };
}

// ─── Right-sizing goals ─────────────────────────────────────────────────────

/** Round to numbers people actually set as goals. */
export function niceAmount(habit: Pick<Habit, 'kind' | 'unit'>, v: number): number {
  const unit = (habit.unit ?? '').toLowerCase();
  if (habit.kind === 'duration') {
    if (v < 10) return Math.max(1, Math.round(v));
    if (v < 60) return Math.round(v / 5) * 5;
    return Math.round(v / 10) * 10;
  }
  if (/step/.test(unit)) return Math.max(500, Math.round(v / 500) * 500);
  if (v <= 20) return Math.max(1, Math.round(v));
  if (v <= 100) return Math.round(v / 5) * 5;
  if (v <= 1000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}

function minimumAmount(habit: Pick<Habit, 'kind' | 'unit'>): number {
  if (habit.kind === 'duration') return 2;
  if (/step/.test((habit.unit ?? '').toLowerCase())) return 1000;
  return 1;
}

export interface Adjustment {
  habitId: string;
  direction: 'easier' | 'harder';
  target?: number;
  schedule?: Schedule;
  title: string;
  body: string;
  /** Short label for the accept button, e.g. "Make it 5,000". */
  action: string;
}

const COOLDOWN_MS = 7 * 86_400_000;

/**
 * Should this goal change size? Shrinks a goal that keeps getting missed to something
 * repeatable, and grows one that's become easy, a step at a time toward `goalTarget`.
 */
export function suggestAdjustment(habit: Habit, p: HabitPattern, now: number): Adjustment | null {
  if (habit.auto?.provider === 'screen') return null;
  if (habit.adjustedAt && now - habit.adjustedAt < COOLDOWN_MS) return null;
  if (now - habit.createdAt < COOLDOWN_MS) return null;
  const label = (target: number) => targetLabel({ ...habit, target });

  const tooHard = p.state === 'struggling' || (p.state === 'slipping' && (p.rate14 ?? 1) < 0.5);
  if (tooHard && p.due14 >= 5) {
    const record = `You've managed it on ${p.done14} of the last ${p.due14} days.`;
    if (habit.kind !== 'check') {
      const base = p.typicalAmount && p.typicalAmount < habit.target ? p.typicalAmount : habit.target * 0.5;
      let next = niceAmount(habit, Math.max(minimumAmount(habit), base));
      if (next > habit.target * 0.8) next = niceAmount(habit, Math.max(minimumAmount(habit), habit.target * 0.6));
      if (next >= habit.target) return null;
      return {
        habitId: habit.id,
        direction: 'easier',
        target: next,
        title: `Make ${habit.name.toLowerCase()} lighter for now?`,
        body: `${record} ${label(next)} is a win you can repeat, and repeating is what builds the habit. We'll raise it again once it sticks.`,
        action: `Make it ${label(next)}`,
      };
    }
    const s = habit.schedule;
    const perWeek = s.type === 'daily' ? 7 : s.type === 'days' ? s.days.length : s.times;
    if (perWeek <= 2) return null;
    const times = Math.max(2, Math.min(perWeek - 1, Math.round(7 * (p.rate14 ?? 0.3)) + 1));
    return {
      habitId: habit.id,
      direction: 'easier',
      schedule: { type: 'weekly', times },
      title: `${habit.name}: fewer days, more wins?`,
      body: `${record} ${times}× a week on any days you like is easier to keep, and keeping it is the whole game.`,
      action: `Make it ${times}× a week`,
    };
  }

  const easy = p.state === 'thriving' && (p.rate14 ?? 0) >= 0.9 && p.due14 >= 8;
  if (easy) {
    if (habit.kind !== 'check') {
      const goal = habit.goalTarget && habit.goalTarget > habit.target ? habit.goalTarget : null;
      if (!goal && habit.goalTarget && habit.goalTarget <= habit.target) return null; // reached the goal
      let next = niceAmount(habit, habit.target * (goal ? 1.25 : 1.15));
      if (next <= habit.target) next = habit.target + (habit.kind === 'duration' ? 5 : 1);
      if (goal) next = Math.min(goal, next);
      return {
        habitId: habit.id,
        direction: 'harder',
        target: next,
        title: `Ready for ${label(next)}?`,
        body: `${p.done14} of your last ${p.due14} days done. A small step up keeps it interesting${goal ? `, on the way to ${label(goal)}` : ''}.`,
        action: `Go to ${label(next)}`,
      };
    }
    if (habit.schedule.type === 'weekly' && habit.schedule.times < 7) {
      const times = habit.schedule.times + 1;
      return {
        habitId: habit.id,
        direction: 'harder',
        schedule: { type: 'weekly', times },
        title: `${habit.name} ${times}× a week?`,
        body: `You've hit ${habit.schedule.times}× a week for two weeks running. One more day is the next step.`,
        action: `Make it ${times}× a week`,
      };
    }
  }
  return null;
}

// ─── Two-minute versions ────────────────────────────────────────────────────

const TINY_CHECK: [RegExp, string][] = [
  [/run|jog/, 'Put on your running shoes and step outside'],
  [/walk/, 'Walk to the end of the street'],
  [/work ?out|gym|lift|exercise|train/, 'Do one set'],
  [/push.?up/, 'Do one push-up'],
  [/stretch|yoga|mobility/, 'One slow stretch'],
  [/meditat|mindful|breath/, 'Three slow breaths'],
  [/journal|diary|write/, 'Write one sentence'],
  [/read|book/, 'Read one page'],
  [/code|ship|commit|program|leetcode/, 'Open your editor and change one line'],
  [/sleep|bed/, 'Plug your phone in outside the bedroom'],
  [/water|hydrat/, 'Drink one glass of water'],
  [/clean|tidy|declutter/, 'Put away one thing'],
  [/gratitude|thank/, 'Name one good thing from today'],
  [/floss/, 'Floss one tooth'],
  [/language|duolingo|spanish|french|german|japanese/, 'Learn one word'],
  [/budget|money|spend|finance/, 'Check one transaction'],
  [/call|text|friend|family/, 'Send one message'],
  [/cold shower/, 'Ten seconds of cold at the end'],
  [/vitamin|pill|supplement/, 'Put the bottle next to your toothbrush'],
];

export interface Tiny {
  label: string;
  /** Amount that counts as done in tiny mode (check habits: 1). */
  amount: number;
}

/** The smallest version of a habit that still counts: easy enough to do on your worst day. */
export function tinyVersion(habit: Pick<Habit, 'name' | 'kind' | 'target' | 'unit' | 'tiny'>): Tiny {
  const amount =
    habit.kind === 'check'
      ? 1
      : habit.kind === 'duration'
        ? Math.min(habit.target, habit.target <= 5 ? 1 : 2)
        : Math.min(
            habit.target,
            /step/.test((habit.unit ?? '').toLowerCase()) ? 1000 : Math.max(1, Math.round(habit.target * 0.1)),
          );
  if (habit.tiny?.trim()) return { label: habit.tiny.trim(), amount };
  if (habit.kind === 'duration') return { label: `Just ${amount} minute${amount > 1 ? 's' : ''}`, amount };
  if (habit.kind === 'count') {
    const unit = (habit.unit ?? '').toLowerCase();
    if (/step/.test(unit)) return { label: 'A 10-minute walk', amount };
    if (/page/.test(unit)) return { label: amount === 1 ? 'Read one page' : `Read ${amount} pages`, amount };
    if (/glass/.test(unit)) return { label: amount === 1 ? 'One glass of water' : `${amount} glasses`, amount };
    return { label: `Just ${amount} ${habit.unit ?? ''}`.trim(), amount };
  }
  const name = habit.name.toLowerCase();
  for (const [re, label] of TINY_CHECK) if (re.test(name)) return { label, amount };
  return { label: 'Do the first two minutes', amount };
}

// ─── Convenience ────────────────────────────────────────────────────────────

export function analyzeAll(habits: Habit[], index: EntryIndex, today: DayKey, weekStart: WeekStart, now: number) {
  const patterns = new Map<string, HabitPattern>();
  for (const h of habits)
    if (!h.deleted && !h.archived) patterns.set(h.id, analyzeHabit(h, index.get(h.id), today, weekStart));
  return { patterns, user: analyzeUser(habits, patterns, index, today, now) };
}

export const PHASE_LABEL: Record<HabitPhase, string> = {
  starting: 'Just starting',
  building: 'Building',
  forming: 'Forming',
  automatic: 'Automatic',
};
