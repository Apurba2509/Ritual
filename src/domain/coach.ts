import { Adjustment, HabitPattern, suggestAdjustment, tinyVersion, UserState } from './behavior';
import { addDays, DayKey, fromDayKey, WEEKDAY_LONG } from './dates';
import { isDueOn, isEntryDone } from './habits';
import type { EntryIndex, Habit } from './types';
import { DAY_MILESTONES } from './xp';

/**
 * The coach decides what single thing is most worth saying right now, and says it kindly.
 *
 * One card at a time on Today (a feed of advice is just more noise). Priorities follow what
 * actually keeps people going: re-entry after a lapse first, then the day after a miss, then
 * right-sizing goals, then timing and encouragement. Dismissed cards stay quiet for a while.
 */

export type CoachAction =
  | { type: 'easy-mode'; days: number }
  | { type: 'log-tiny'; habitId: string }
  | { type: 'adjust'; adjustment: Adjustment }
  | { type: 'set-reminder'; habitId: string; time: string }
  | { type: 'focus'; habitId: string; minutes: number }
  | { type: 'open-habit'; habitId: string }
  | { type: 'archive-picker' }
  | { type: 'dismiss' };

export type CoachTone = 'care' | 'win' | 'tip';

export interface CoachCard {
  /** Stable key for dismissal ("kind:habit:day" or similar). */
  key: string;
  kind:
    | 'welcome-back'
    | 'never-miss-twice'
    | 'easier'
    | 'harder'
    | 'overloaded'
    | 'fresh-start'
    | 'best-time'
    | 'weak-day'
    | 'milestone-near'
    | 'start-small';
  habitId?: string;
  tone: CoachTone;
  icon: string;
  title: string;
  body: string;
  primary: { label: string; action: CoachAction };
  secondary?: { label: string; action: CoachAction };
  priority: number;
}

export interface CoachInput {
  habits: Habit[];
  index: EntryIndex;
  patterns: Map<string, HabitPattern>;
  user: UserState;
  streaks: Map<string, number>;
  today: DayKey;
  now: number;
  weekStart: 0 | 1;
  /** Easy mode is on until this day (inclusive). */
  easyUntil: DayKey | null;
  /** key → ms until which the card stays hidden */
  dismissed: Record<string, number>;
}

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  // Non-breaking space, so "1:00 PM" never splits across lines.
  return `${h % 12 || 12}:${m < 10 ? `0${m}` : m}\u00A0${suffix}`;
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function coachCards(input: CoachInput): CoachCard[] {
  const { habits, index, patterns, user, today, now, weekStart } = input;
  const active = habits.filter((h) => !h.deleted && !h.archived);
  const easy = !!input.easyUntil && input.easyUntil >= today;
  const cards: CoachCard[] = [];
  const due = active.filter((h) => isDueOn(h, index.get(h.id), today, weekStart));
  const openToday = due.filter((h) => !isEntryDone(h, index.get(h.id)?.get(today)));

  // 1 · Coming back after a lapse: no guilt, smallest possible restart.
  if (user.mood === 'returning' && user.quietDays !== null && !easy) {
    cards.push({
      key: `welcome-back:${today}`,
      kind: 'welcome-back',
      tone: 'care',
      icon: 'hand-heart',
      title: 'Welcome back',
      body:
        user.quietDays >= 7
          ? `It's been ${user.quietDays} days. That's normal, and nothing is lost: habits pick up faster the second time. Let's restart small: for three days, the two-minute version of each habit counts in full.`
          : 'A few quiet days happen to everyone. Restart small: for three days, the two-minute version of each habit counts in full.',
      primary: { label: 'Restart small', action: { type: 'easy-mode', days: 3 } },
      secondary: { label: 'Not now', action: { type: 'dismiss' } },
      priority: 100,
    });
  }

  // 2 · Never miss twice.
  for (const h of openToday) {
    const p = patterns.get(h.id);
    if (!p?.missedYesterday || p.missRun > 2) continue;
    const tiny = tinyVersion(h);
    const streakBefore = p.missRun === 1 ? 'One miss barely moves a habit. Two in a row starts a new pattern.' : '';
    cards.push({
      key: `nmt:${h.id}:${today}`,
      kind: 'never-miss-twice',
      habitId: h.id,
      tone: 'care',
      icon: 'arrow-u-up-left',
      title: `Don't miss ${h.name.toLowerCase()} twice`,
      body: `${streakBefore} Today, the tiny version counts: ${tiny.label.toLowerCase()}.`.trim(),
      primary: { label: 'Did the tiny version', action: { type: 'log-tiny', habitId: h.id } },
      secondary: { label: 'Start 2-min timer', action: { type: 'focus', habitId: h.id, minutes: 2 } },
      priority: 90 + Math.min(5, input.streaks.get(h.id) ?? 0),
    });
  }

  // 3 · Too many habits for how things are going.
  if (user.overloaded && !easy) {
    cards.push({
      key: `overloaded:${addDays(today, -((fromDayKey(today).getDay() + 6) % 7))}`,
      kind: 'overloaded',
      tone: 'care',
      icon: 'stack-minus',
      title: 'Fewer habits, more wins',
      body: `You're juggling ${user.active} habits. People who focus on two or three build them faster. Pause the rest; they'll wait for you.`,
      primary: { label: 'Choose what to pause', action: { type: 'archive-picker' } },
      secondary: { label: 'Keep all', action: { type: 'dismiss' } },
      priority: 78,
    });
  }

  // 4 · Right-size goals.
  for (const h of active) {
    const p = patterns.get(h.id);
    if (!p) continue;
    const adj = suggestAdjustment(h, p, now);
    if (!adj) continue;
    cards.push({
      key: `adjust:${h.id}:${adj.direction}`,
      kind: adj.direction,
      habitId: h.id,
      tone: adj.direction === 'easier' ? 'care' : 'win',
      icon: adj.direction === 'easier' ? 'arrow-down-right' : 'trend-up',
      title: adj.title,
      body: adj.body,
      primary: { label: adj.action, action: { type: 'adjust', adjustment: adj } },
      secondary: { label: adj.direction === 'easier' ? 'Keep it' : 'Not yet', action: { type: 'dismiss' } },
      priority: adj.direction === 'easier' ? 80 : 45,
    });
  }

  // 5 · Fresh start: a new week is a natural reset point.
  const weekday = fromDayKey(today).getDay();
  const isWeekStart = weekday === (weekStart === 1 ? 1 : 0);
  if (isWeekStart && (user.mood === 'slipping' || user.mood === 'struggling') && !easy) {
    cards.push({
      key: `fresh:${today}`,
      kind: 'fresh-start',
      tone: 'care',
      icon: 'sun-horizon',
      title: 'New week, clean slate',
      body: 'Fresh starts are real: people are more likely to follow through at the start of a week. Make this one easy to win: tiny versions count for 7 days.',
      primary: { label: 'Make this week easy', action: { type: 'easy-mode', days: 7 } },
      secondary: { label: 'Not now', action: { type: 'dismiss' } },
      priority: 60,
    });
  }

  // 6 · Remind at the time they actually do it.
  for (const h of active) {
    const p = patterns.get(h.id);
    if (!p?.usualTime || h.auto) continue;
    const usual = minutesOf(p.usualTime);
    const close = h.reminders.some((r) => Math.abs(minutesOf(r) - usual) <= 60);
    if (close) continue;
    cards.push({
      key: `time:${h.id}:${p.usualTime}`,
      kind: 'best-time',
      habitId: h.id,
      tone: 'tip',
      icon: 'clock-countdown',
      title: `Remind you at ${fmt12(p.usualTime)}?`,
      body: `That's when you usually do ${h.name.toLowerCase()}${
        h.reminders.length ? `, not ${fmt12(h.reminders[0])}` : ''
      }. A nudge when you're actually ready works better than a fixed time.`,
      primary: {
        label: `Move it to ${fmt12(p.usualTime)}`,
        action: { type: 'set-reminder', habitId: h.id, time: p.usualTime },
      },
      secondary: { label: 'Leave it', action: { type: 'dismiss' } },
      priority: 50,
    });
  }

  // 7 · A clearly harder weekday.
  for (const h of active) {
    const p = patterns.get(h.id);
    if (p?.weakDay === null || p?.weakDay === undefined || p.weakDayRate === null) continue;
    const day = WEEKDAY_LONG[p.weakDay];
    const tiny = tinyVersion(h);
    cards.push({
      key: `weak:${h.id}:${p.weakDay}`,
      kind: 'weak-day',
      habitId: h.id,
      tone: 'tip',
      icon: 'calendar-x',
      title: `${day}s are your hard day for ${h.name.toLowerCase()}`,
      body: `You do it ${Math.round((p.rate28 ?? 0) * 100)}% of the time overall, but only ${Math.round(p.weakDayRate * 100)}% on ${day}s. Plan the tiny version for ${day}s: ${tiny.label.toLowerCase()}.`,
      primary: { label: 'Got it', action: { type: 'dismiss' } },
      priority: 40,
    });
  }

  // 8 · A milestone is close (goal-gradient: effort rises near the finish line).
  for (const h of openToday) {
    const streak = input.streaks.get(h.id) ?? 0;
    const next = Object.keys(DAY_MILESTONES)
      .map(Number)
      .find((m) => m > streak);
    if (!next || next - streak > 2 || streak < 3) continue;
    cards.push({
      key: `milestone:${h.id}:${next}`,
      kind: 'milestone-near',
      habitId: h.id,
      tone: 'win',
      icon: 'flag-banner',
      title: `${next - streak === 1 ? 'Tomorrow' : 'Two days to'}: ${next}-day ${h.name.toLowerCase()}`,
      body:
        next === 66
          ? '66 days is roughly when a behaviour becomes automatic. You are nearly there.'
          : `Today keeps it alive. Day ${next} comes with a bonus.`,
      primary: { label: 'Open habit', action: { type: 'open-habit', habitId: h.id } },
      priority: 35,
    });
  }

  // 9 · Brand-new: start smaller than feels necessary.
  if (user.mood === 'new' && active.length) {
    cards.push({
      key: 'start-small',
      kind: 'start-small',
      tone: 'tip',
      icon: 'plant',
      title: 'Start smaller than feels necessary',
      body: 'For the first two weeks, showing up matters more than the amount. If a day gets hard, the two-minute version still counts.',
      primary: { label: 'Got it', action: { type: 'dismiss' } },
      priority: 30,
    });
  }

  return cards
    .filter((c) => !(input.dismissed[c.key] && input.dismissed[c.key] > now))
    .sort((a, b) => b.priority - a.priority);
}
