import { describe, expect, it } from 'vitest';
import { fromDayKey } from '../dates';
import { buildEntryIndex } from '../habits';
import { inQuietHours, NotifyStyle, planNotifications, PlannerInput } from '../notifications';
import { entry, habit } from './fixtures';

const TODAY = '2026-10-14'; // a Wednesday
const morning = fromDayKey(TODAY).getTime() + 7 * 3600_000; // 07:00

function input(style: NotifyStyle, over: Partial<PlannerInput> = {}): PlannerInput {
  return {
    habits: [],
    index: new Map(),
    streaks: new Map(),
    today: TODAY,
    now: morning,
    weekStart: 1,
    style,
    morningBrief: { enabled: true, time: '08:00' },
    eveningNudge: { enabled: true, time: '20:30' },
    quietHours: { start: '22:30', end: '07:30' },
    days: 1,
    ...over,
  };
}

const kinds = (list: { kind: string }[]) => list.map((n) => n.kind);

describe('notification planner', () => {
  const read = habit({ id: 'read', name: 'Read', category: 'learning' });
  const run = habit({ id: 'run', name: 'Run', category: 'fitness', reminders: ['07:15', '18:00'] });

  it('calm keeps it to the essentials', () => {
    const plan = planNotifications(input('calm', { habits: [read, run] }));
    expect(kinds(plan)).toEqual(['reminder', 'brief', 'reminder', 'evening']);
  });

  it('coach adds smart nudges, a midday check-in and more', () => {
    const plan = planNotifications(input('coach', { habits: [read, run] }));
    expect(kinds(plan)).toEqual(['reminder', 'brief', 'midday', 'reminder', 'nudge', 'evening']);
    expect(plan.find((n) => n.kind === 'nudge')?.habitId).toBe('read');
  });

  it('drops everything about a habit once it is done', () => {
    const index = buildEntryIndex([entry(read, TODAY), entry(run, TODAY)]);
    const plan = planNotifications(input('coach', { habits: [read, run], index }));
    expect(kinds(plan)).toEqual(['brief']);
  });

  it('respects quiet hours, except for times you chose yourself', () => {
    const late = habit({ id: 'late', name: 'Journal', reminders: ['23:00'], category: 'mind' });
    const plan = planNotifications(input('coach', { habits: [late], eveningNudge: { enabled: true, time: '23:15' } }));
    expect(plan.some((n) => n.kind === 'reminder')).toBe(true);
    expect(plan.some((n) => n.kind === 'evening')).toBe(false);
  });

  it('sends a last call only when a real streak is at risk', () => {
    const streaks = new Map([['read', { current: 12, atRisk: true }]]);
    const plan = planNotifications(input('coach', { habits: [read], streaks, quietHours: null }));
    const last = plan.find((n) => n.kind === 'lastcall');
    expect(last?.title).toBe('Last call: 12-day streak');
  });

  it('pushes a walk when steps are behind', () => {
    const steps = habit({
      id: 'steps',
      name: 'Walk 8,000 steps',
      kind: 'count',
      target: 8000,
      unit: 'steps',
      auto: { provider: 'device', metric: 'steps' },
    });
    const behind = planNotifications(input('coach', { habits: [steps], stepsToday: 2000 }));
    expect(behind.find((n) => n.kind === 'movement')?.title).toBe('2,000 steps so far');
    const fine = planNotifications(input('coach', { habits: [steps], stepsToday: 7000 }));
    expect(fine.some((n) => n.kind === 'movement')).toBe(false);
  });

  it('never stacks two pings within 20 minutes', () => {
    const a = habit({ id: 'a', name: 'A', category: 'social' }); // nudge 18:30
    const plan = planNotifications(input('coach', { habits: [a], eveningNudge: { enabled: true, time: '18:40' } }));
    expect(kinds(plan).filter((k) => k === 'nudge' || k === 'evening')).toEqual(['evening']);
  });

  it('handles quiet hours that wrap past midnight', () => {
    const q = { start: '22:30', end: '07:30' };
    expect(inQuietHours(new Date(2026, 0, 1, 23, 0), q)).toBe(true);
    expect(inQuietHours(new Date(2026, 0, 1, 6, 59), q)).toBe(true);
    expect(inQuietHours(new Date(2026, 0, 1, 12, 0), q)).toBe(false);
  });
});
