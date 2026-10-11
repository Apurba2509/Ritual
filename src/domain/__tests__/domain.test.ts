import { describe, expect, it } from 'vitest';
import { addDays, diffDays, startOfWeek, weekId, weekdayOf } from '../dates';
import { completionRate, computeStreak, isDueOn } from '../habits';
import { parseQuickLog } from '../quickLog';
import { computeSnapshot } from '../snapshot';
import { completionXP, levelForXP, levelProgress, xpForLevel } from '../xp';
import { byDay, entry, habit } from './fixtures';

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('diffs days', () => {
    expect(diffDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(diffDays('2026-03-08', '2026-03-09')).toBe(1); // DST change week in the US
  });

  it('finds week starts', () => {
    // 2026-10-10 is a Saturday
    expect(weekdayOf('2026-10-10')).toBe(6);
    expect(startOfWeek('2026-10-10', 1)).toBe('2026-10-05');
    expect(startOfWeek('2026-10-10', 0)).toBe('2026-10-04');
    expect(startOfWeek('2026-10-05', 1)).toBe('2026-10-05');
  });

  it('computes ISO week ids', () => {
    expect(weekId('2026-01-01')).toBe('2026-W01');
    expect(weekId('2026-10-10')).toBe('2026-W41');
  });
});

describe('daily streaks', () => {
  const today = '2026-10-10';

  it('counts consecutive days and keeps the streak alive while today is pending', () => {
    const h = habit();
    const e = ['2026-10-07', '2026-10-08', '2026-10-09'].map((d) => entry(h, d));
    const s = computeStreak(h, byDay(e), today, 1);
    expect(s.current).toBe(3);
    expect(s.atRisk).toBe(true);
  });

  it('includes today once done', () => {
    const h = habit();
    const e = ['2026-10-08', '2026-10-09', '2026-10-10'].map((d) => entry(h, d));
    const s = computeStreak(h, byDay(e), today, 1);
    expect(s.current).toBe(3);
    expect(s.atRisk).toBe(false);
  });

  it('breaks on a missed day and remembers the longest run', () => {
    const h = habit();
    const e = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-06', '2026-10-09'].map((d) =>
      entry(h, d),
    );
    const s = computeStreak(h, byDay(e), today, 1);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(4);
  });

  it('treats skipped days as neutral rest days', () => {
    const h = habit();
    const e = [entry(h, '2026-10-07'), entry(h, '2026-10-08', { skipped: true, value: 0 }), entry(h, '2026-10-09')];
    expect(computeStreak(h, byDay(e), today, 1).current).toBe(2);
  });

  it('ignores unscheduled days for specific-weekday habits', () => {
    // Mon/Wed/Fri habit. 2026-10-05 Mon, 07 Wed, 09 Fri.
    const h = habit({ schedule: { type: 'days', days: [1, 3, 5] } });
    const e = ['2026-10-05', '2026-10-07', '2026-10-09'].map((d) => entry(h, d));
    const s = computeStreak(h, byDay(e), today, 1);
    expect(s.current).toBe(3);
    expect(s.atRisk).toBe(false); // Saturday isn't scheduled
  });

  it('requires the target for count habits', () => {
    const h = habit({ kind: 'count', target: 8, unit: 'glasses' });
    const e = [entry(h, '2026-10-08', { value: 8 }), entry(h, '2026-10-09', { value: 5 })];
    const s = computeStreak(h, byDay(e), today, 1);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(1);
  });

  it('counts imported history before the habit was created', () => {
    const h = habit({ createdAt: new Date(2026, 9, 10).getTime() });
    const e = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((d) => entry(h, d));
    expect(computeStreak(h, byDay(e), today, 1).current).toBe(5);
  });
});

describe('weekly streaks', () => {
  it('counts weeks where the target was hit', () => {
    const h = habit({ schedule: { type: 'weekly', times: 2 } });
    const e = [
      entry(h, '2026-09-22'),
      entry(h, '2026-09-24'), // week of 21st: 2 ✓
      entry(h, '2026-09-29'),
      entry(h, '2026-10-01'), // week of 28th: 2 ✓
      entry(h, '2026-10-06'), // current week: 1, in progress
    ];
    const s = computeStreak(h, byDay(e), '2026-10-10', 1);
    expect(s.unit).toBe('week');
    expect(s.current).toBe(2);
  });

  it('stays due until the weekly target is met', () => {
    const h = habit({ schedule: { type: 'weekly', times: 2 } });
    const e = byDay([entry(h, '2026-10-05'), entry(h, '2026-10-06')]);
    expect(isDueOn(h, e, '2026-10-07', 1)).toBe(false);
    expect(isDueOn(h, e, '2026-10-06', 1)).toBe(true); // shows on the day it was done
    expect(isDueOn(h, byDay([entry(h, '2026-10-05')]), '2026-10-07', 1)).toBe(true);
  });
});

describe('completion rate', () => {
  it('ignores today while pending and skipped days', () => {
    const h = habit();
    const e = byDay([
      entry(h, '2026-10-07'),
      entry(h, '2026-10-08', { skipped: true, value: 0 }),
      entry(h, '2026-10-09'),
    ]);
    // 6th missed, 7th done, 8th skipped, 9th done, 10th (today) pending → 2/3
    expect(completionRate(h, e, '2026-10-06', '2026-10-10', '2026-10-10', 1)).toBeCloseTo(2 / 3);
  });
});

describe('xp & levels', () => {
  it('rewards streaks up to 2×', () => {
    expect(completionXP('medium', 1)).toBe(15);
    expect(completionXP('medium', 31)).toBe(30);
    expect(completionXP('medium', 500)).toBe(30);
  });

  it('maps xp to levels on a triangular curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(5)).toBe(1000);
    expect(levelForXP(0)).toBe(1);
    expect(levelForXP(99)).toBe(1);
    expect(levelForXP(100)).toBe(2);
    expect(levelForXP(1000)).toBe(5);
    for (let lvl = 1; lvl < 60; lvl++) {
      expect(levelForXP(xpForLevel(lvl))).toBe(lvl);
      expect(levelForXP(xpForLevel(lvl + 1) - 1)).toBe(lvl);
    }
    expect(levelProgress(150).ratio).toBeCloseTo(0.25);
  });
});

describe('snapshot', () => {
  it('derives xp, perfect days and achievements deterministically', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b', name: 'Read', kind: 'count', target: 20, unit: 'pages' });
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-10-04', i)); // 4th..10th
    const entries = [...days.map((d) => entry(a, d)), ...days.map((d) => entry(b, d, { value: 20 }))];
    const snap = computeSnapshot({
      habits: [a, b],
      entries,
      today: '2026-10-10',
      weekStart: 1,
      unlocked: {},
      friends: 0,
      challengesJoined: 0,
    });
    expect(snap.totalCompletions).toBe(14);
    expect(snap.habitStats.get('a')!.streak.current).toBe(7);
    expect(snap.perfectRun).toBe(7);
    expect(snap.newlyUnlocked).toEqual(
      expect.arrayContaining(['first_step', 'streak_3', 'streak_7', 'perfect_day', 'perfect_week']),
    );
    // Same input → same output
    const again = computeSnapshot({
      habits: [a, b],
      entries: [...entries].reverse(),
      today: '2026-10-10',
      weekStart: 1,
      unlocked: {},
      friends: 0,
      challengesJoined: 0,
    });
    expect(again.xp).toBe(snap.xp);
    expect(snap.xp).toBeGreaterThan(0);
  });

  it('does not let one unfinished habit hide today from the perfect-run count', () => {
    const a = habit({ id: 'a' });
    const snap = computeSnapshot({
      habits: [a],
      entries: [entry(a, '2026-10-08'), entry(a, '2026-10-09')],
      today: '2026-10-10',
      weekStart: 1,
      unlocked: {},
      friends: 0,
      challengesJoined: 0,
    });
    expect(snap.perfectRun).toBe(2);
  });
});

describe('quick log parser', () => {
  const habits = [
    habit({ id: 'run', name: 'Go for a run' }),
    habit({ id: 'read', name: 'Read', kind: 'count', target: 20, unit: 'pages' }),
    habit({ id: 'med', name: 'Meditate', kind: 'duration', target: 10, unit: 'min' }),
    habit({ id: 'water', name: 'Drink water', kind: 'count', target: 8, unit: 'glasses' }),
    habit({ id: 'sugar', name: 'No added sugar' }),
  ];

  it('splits clauses and extracts amounts', () => {
    const r = parseQuickLog('Ran 5k, read 30 pages and meditated for 1h 15m', habits);
    const by = Object.fromEntries(r.logs.map((l) => [l.habitId, l.amount]));
    expect(by.run).toBe(1);
    expect(by.read).toBe(30);
    expect(by.med).toBe(75);
  });

  it('ignores skipped or negated activities', () => {
    const r = parseQuickLog("skipped meditation, didn't run, but read 10 pages", habits);
    expect(r.logs.map((l) => l.habitId)).toEqual(['read']);
    expect(r.unmatched).toEqual([]);
  });

  it('understands synonyms and leaves unknown clauses unmatched', () => {
    const r = parseQuickLog('drank 3 glasses of water; no sweets today; played guitar', habits);
    const by = Object.fromEntries(r.logs.map((l) => [l.habitId, l.amount]));
    expect(by.water).toBe(3);
    expect(by.sugar).toBe(1);
    expect(r.unmatched).toEqual(['played guitar']);
  });
});
