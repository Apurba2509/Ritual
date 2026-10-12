import { describe, expect, it } from 'vitest';
import {
  analyzeAll,
  analyzeHabit,
  AUTOMATIC,
  habitStrength,
  niceAmount,
  suggestAdjustment,
  tinyVersion,
} from '../behavior';
import { coachCards, CoachInput } from '../coach';
import { addDays, fromDayKey } from '../dates';
import { buildEntryIndex, isEntryDone, isTinyEntry } from '../habits';
import type { Entry, Habit } from '../types';
import { byDay, entry, habit } from './fixtures';

const TODAY = '2026-10-14'; // Wednesday
const NOW = fromDayKey(TODAY).getTime() + 9 * 3600_000;
const created = (daysAgo: number) => fromDayKey(addDays(TODAY, -daysAgo)).getTime();

/** Entries for the last `days` days (excluding today) where `doneOn(i)` says if day i ago was done. */
function history(h: Habit, days: number, doneOn: (daysAgo: number) => boolean, over: Partial<Entry> = {}): Entry[] {
  const out: Entry[] = [];
  for (let i = days; i >= 1; i--) if (doneOn(i)) out.push(entry(h, addDays(TODAY, -i), over));
  return out;
}

describe('per-entry goals', () => {
  it('keeps history stable when the target changes', () => {
    const h = habit({ kind: 'count', target: 20, unit: 'pages' });
    const e = entry(h, '2026-10-01', { value: 20, goal: 20 });
    expect(isEntryDone({ ...h, target: 30 }, e)).toBe(true);
  });

  it('falls back to the current target for older entries', () => {
    const h = habit({ kind: 'count', target: 20, unit: 'pages' });
    const e = entry(h, '2026-10-01', { value: 20 });
    expect(isEntryDone({ ...h, target: 30 }, e)).toBe(false);
  });

  it('counts a tiny-version day in full and marks it as tiny', () => {
    const h = habit({ kind: 'duration', target: 30, unit: 'min' });
    const e = entry(h, '2026-10-01', { value: 2, goal: 2 });
    expect(isEntryDone(h, e)).toBe(true);
    expect(isTinyEntry(h, e)).toBe(true);
  });
});

describe('habit strength', () => {
  it('grows with consistency and reaches automatic after about five perfect weeks', () => {
    const h = habit({ createdAt: created(60) });
    const s = habitStrength(h, byDay(history(h, 60, () => true)), TODAY, 1);
    expect(s.value).toBeGreaterThan(AUTOMATIC);
    expect(s.phase).toBe('automatic');

    const fresh = habit({ createdAt: created(0) });
    expect(habitStrength(fresh, undefined, TODAY, 1).daysToAutomatic).toBeGreaterThan(30);
  });

  it('barely moves after a single miss (unlike a streak)', () => {
    const h = habit({ createdAt: created(40) });
    const all = habitStrength(h, byDay(history(h, 40, () => true)), TODAY, 1).value;
    const oneMiss = habitStrength(h, byDay(history(h, 40, (i) => i !== 1)), TODAY, 1).value;
    expect(all - oneMiss).toBeLessThan(0.06);
  });
});

describe('patterns', () => {
  it('spots a miss yesterday and a struggling habit', () => {
    const h = habit({ createdAt: created(30) });
    const p = analyzeHabit(h, byDay(history(h, 30, (i) => i % 3 === 0)), TODAY, 1);
    expect(p.missedYesterday).toBe(true);
    expect(p.state).toBe('struggling');
  });

  it('learns the usual time from self-logged completions', () => {
    const h = habit({ createdAt: created(30) });
    const es = history(h, 20, () => true).map((e, i) => ({
      ...e,
      completedAt: fromDayKey(e.date).getTime() + (7 * 60 + 5 + (i % 4) * 5) * 60_000,
    }));
    // Completions around 7:05–7:20 → a reminder slot just before: 7:00.
    expect(analyzeHabit(h, byDay(es), TODAY, 1).usualTime).toBe('07:00');
  });

  it('finds a clearly weaker weekday', () => {
    const h = habit({ createdAt: created(70) });
    // Fridays (weekday 5) are never done.
    const es = history(h, 60, (i) => fromDayKey(addDays(TODAY, -i)).getDay() !== 5);
    const p = analyzeHabit(h, byDay(es), TODAY, 1);
    expect(p.weakDay).toBe(5);
  });
});

describe('right-sizing goals', () => {
  it('shrinks a missed amount goal toward what the person really does', () => {
    const h = habit({ name: 'Walk 8,000 steps', kind: 'count', target: 8000, unit: 'steps', createdAt: created(40) });
    const es = history(h, 14, () => true, { value: 5200 });
    const p = analyzeHabit(h, byDay(es), TODAY, 1);
    const adj = suggestAdjustment(h, p, NOW);
    expect(adj?.direction).toBe('easier');
    expect(adj?.target).toBe(5000);
  });

  it('turns a missed daily check habit into N× a week', () => {
    const h = habit({ createdAt: created(40) });
    const p = analyzeHabit(h, byDay(history(h, 14, (i) => i % 4 === 0)), TODAY, 1);
    const adj = suggestAdjustment(h, p, NOW);
    expect(adj?.schedule?.type).toBe('weekly');
  });

  it('steps up toward the goal when it has become easy, never past it', () => {
    const h = habit({
      name: 'Read',
      kind: 'count',
      target: 10,
      unit: 'pages',
      goalTarget: 12,
      createdAt: created(40),
    });
    const p = analyzeHabit(h, byDay(history(h, 30, () => true, { value: 10 })), TODAY, 1);
    const adj = suggestAdjustment(h, p, NOW);
    expect(adj?.direction).toBe('harder');
    expect(adj?.target).toBe(12);
  });

  it('waits a week between changes', () => {
    const h = habit({
      kind: 'count',
      target: 8000,
      unit: 'steps',
      createdAt: created(40),
      adjustedAt: NOW - 86_400_000,
    });
    const p = analyzeHabit(h, byDay(history(h, 14, () => true, { value: 3000 })), TODAY, 1);
    expect(suggestAdjustment(h, p, NOW)).toBeNull();
  });

  it('rounds to goals people actually set', () => {
    expect(niceAmount({ kind: 'count', unit: 'steps' }, 5234)).toBe(5000);
    expect(niceAmount({ kind: 'duration', unit: 'min' }, 23)).toBe(25);
    expect(niceAmount({ kind: 'count', unit: 'pages' }, 7.4)).toBe(7);
  });
});

describe('tiny versions', () => {
  it('suggests a two-minute version that fits the habit', () => {
    expect(tinyVersion(habit({ name: 'Morning run' })).label).toMatch(/running shoes/);
    expect(tinyVersion(habit({ kind: 'duration', target: 30, unit: 'min' })).amount).toBe(2);
    expect(tinyVersion(habit({ kind: 'count', target: 8000, unit: 'steps' })).amount).toBe(1000);
    expect(tinyVersion(habit({ tiny: 'One push-up' })).label).toBe('One push-up');
  });
});

describe('coach', () => {
  function coach(habits: Habit[], entries: Entry[], over: Partial<CoachInput> = {}) {
    const index = buildEntryIndex(entries);
    const { patterns, user } = analyzeAll(habits, index, TODAY, 1, NOW);
    return coachCards({
      habits,
      index,
      patterns,
      user,
      streaks: new Map(),
      today: TODAY,
      now: NOW,
      weekStart: 1,
      easyUntil: null,
      dismissed: {},
      ...over,
    });
  }

  it('welcomes people back after a lapse before anything else', () => {
    const h = habit({ createdAt: created(40) });
    const cards = coach(
      [h],
      history(h, 40, (i) => i > 6),
    );
    expect(cards[0].kind).toBe('welcome-back');
    expect(cards[0].primary.action).toEqual({ type: 'easy-mode', days: 3 });
  });

  it('offers the tiny version the day after a miss', () => {
    const h = habit({ name: 'Read', createdAt: created(30) });
    const cards = coach(
      [h],
      history(h, 30, (i) => i !== 1),
    );
    expect(cards[0].kind).toBe('never-miss-twice');
    expect(cards[0].primary.action).toEqual({ type: 'log-tiny', habitId: h.id });
  });

  it('respects dismissals', () => {
    const h = habit({ name: 'Read', createdAt: created(30) });
    const es = history(h, 30, (i) => i !== 1);
    const key = coach([h], es)[0].key;
    expect(coach([h], es, { dismissed: { [key]: NOW + 1000 } }).find((c) => c.key === key)).toBeUndefined();
  });
});
