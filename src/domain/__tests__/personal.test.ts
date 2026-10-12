import { describe, expect, it } from 'vitest';
import { addDays, fromDayKey } from '../dates';
import { buildEntryIndex } from '../habits';
import { PersonalSignals, planNotifications, PlannerInput } from '../notifications';
import { limitValues, pauseStats, ScreenDayData, screenInsights, summarize } from '../screen';
import { entry, habit } from './fixtures';

const TODAY = '2026-10-14';
const morning = fromDayKey(TODAY).getTime() + 7 * 3600_000;

function signals(over: Partial<PersonalSignals> = {}): PersonalSignals {
  return { usualTime: new Map(), missedYesterday: new Set(), tiny: new Map(), mood: 'steady', easy: false, ...over };
}

function input(over: Partial<PlannerInput> = {}): PlannerInput {
  return {
    habits: [],
    index: new Map(),
    streaks: new Map(),
    today: TODAY,
    now: morning,
    weekStart: 1,
    style: 'coach',
    morningBrief: { enabled: true, time: '08:00' },
    eveningNudge: { enabled: true, time: '20:30' },
    quietHours: { start: '22:30', end: '07:30' },
    days: 1,
    ...over,
  };
}

describe('personalised notifications', () => {
  const read = habit({ id: 'read', name: 'Read', category: 'learning' });

  it('nudges at the time the person actually does it', () => {
    const plan = planNotifications(
      input({ habits: [read], personal: signals({ usualTime: new Map([['read', '07:45']]) }) }),
    );
    const nudge = plan.find((n) => n.kind === 'nudge')!;
    expect(new Date(nudge.at).getHours()).toBe(7);
    expect(new Date(nudge.at).getMinutes()).toBe(45);
  });

  it('sends one kind never-miss-twice nudge with the tiny version', () => {
    const plan = planNotifications(
      input({
        habits: [read],
        personal: signals({ missedYesterday: new Set(['read']), tiny: new Map([['read', 'Read one page']]) }),
      }),
    );
    const rescue = plan.find((n) => n.kind === 'rescue')!;
    expect(rescue.title).toMatch(/twice/);
    expect(rescue.body).toMatch(/read one page/);
  });

  it('goes quiet for someone who is struggling', () => {
    const habits = [read, habit({ id: 'water', name: 'Water', category: 'health' })];
    const loud = planNotifications(input({ habits, personal: signals() }));
    const gentle = planNotifications(input({ habits, personal: signals({ mood: 'struggling' }) }));
    expect(gentle.length).toBeLessThan(loud.length);
    expect(gentle.some((n) => n.kind === 'midday' || n.kind === 'nudge')).toBe(false);
  });

  it('frames a return as a fresh start, not a backlog', () => {
    const plan = planNotifications(
      input({ habits: [read], personal: signals({ mood: 'returning', tiny: new Map([['read', 'Read one page']]) }) }),
    );
    expect(plan.find((n) => n.kind === 'brief')?.title).toBe('A fresh start');
  });

  it('does not double up when a habit already has a reminder', () => {
    const r = habit({ id: 'r2', name: 'Read', reminders: ['09:00'] });
    const idx = buildEntryIndex([entry(r, addDays(TODAY, -1), { value: 0 })]);
    const plan = planNotifications(input({ habits: [r], index: idx, personal: signals() }));
    expect(plan.filter((n) => n.habitId === 'r2' && n.kind === 'nudge')).toHaveLength(0);
  });
});

function day(d: string, totalMin: number, apps: [string, number][], final = true, hourly?: number[]): ScreenDayData {
  return {
    day: d,
    totalMs: totalMin * 60_000,
    pickups: 70,
    firstPickupAt: 0,
    lastUseAt: 0,
    longestMs: 0,
    hourly: hourly ?? Array.from({ length: 24 }, (_, h) => (h === 21 ? totalMin * 60_000 : 0)),
    apps: apps.map(([pkg, m]) => ({ pkg, ms: m * 60_000, opens: 5 })),
    final,
  };
}

describe('screen time', () => {
  const limit = habit({ id: 'cap', name: 'Under 2h', auto: { provider: 'screen', scope: 'all', limitMin: 120 } });
  const social = habit({ id: 'soc', name: 'Social', auto: { provider: 'screen', scope: 'guarded', limitMin: 30 } });

  it('holds the line under the limit and flips when over', () => {
    const days = [
      day('2026-10-12', 100, [['ig', 50]]),
      day('2026-10-13', 150, [['ig', 20]]),
      day(TODAY, 40, [], false),
    ];
    expect(limitValues(limit, days, new Set())).toEqual({ '2026-10-12': 1, '2026-10-13': 0, [TODAY]: 1 });
  });

  it('counts only guarded apps for a guarded limit', () => {
    const days = [
      day('2026-10-12', 300, [
        ['ig', 20],
        ['maps', 200],
      ]),
    ];
    expect(limitValues(social, days, new Set(['ig']))).toEqual({ '2026-10-12': 1 });
  });

  it('does not award a day with no data', () => {
    expect(limitValues(limit, [day('2026-10-12', 0, [])], new Set())).toEqual({});
  });

  it('summarises a week and finds the peak hour', () => {
    const days = [day('2026-10-12', 200, [['ig', 100]]), day('2026-10-13', 220, [['ig', 100]])];
    const s = summarize(days);
    expect(Math.round((s.avgMs ?? 0) / 60_000)).toBe(210);
    expect(s.peakHour).toBe(21);
  });

  it('suggests guarding the app that dominates the day', () => {
    const days = [
      day('2026-10-13', 200, [
        ['ig', 120],
        ['yt', 30],
      ]),
      day(TODAY, 150, [['ig', 90]], false),
    ];
    const insights = screenInsights(days, { ig: 'Instagram' }, new Set(), { bedtimeOn: false, hasLimitHabit: true });
    expect(insights.find((i) => i.action === 'guard')?.title).toMatch(/Instagram/);
  });

  it('counts walking away from the pause as a win', () => {
    const t = morning;
    const stats = pauseStats(
      [
        { t, type: 'shown', pkg: 'ig' },
        { t, type: 'closed', pkg: 'ig' },
        { t, type: 'shown', pkg: 'ig' },
        { t, type: 'left', pkg: 'ig' },
        { t, type: 'shown', pkg: 'ig' },
        { t, type: 'swap', pkg: 'ig' },
        { t, type: 'shown', pkg: 'ig' },
        { t, type: 'opened', pkg: 'ig' },
      ],
      0,
    );
    expect(stats).toEqual({ shown: 4, resisted: 3, opened: 1, swapped: 1 });
  });
});
