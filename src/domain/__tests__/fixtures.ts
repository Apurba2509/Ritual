import { fromDayKey } from '../dates';
import { Entry, entryId, Habit } from '../types';

let n = 0;

export function habit(overrides: Partial<Habit> = {}): Habit {
  n++;
  return {
    id: overrides.id ?? `h${n}`,
    name: 'Meditate',
    emoji: '🧘',
    color: '#8B5CF6',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    reminders: [],
    auto: null,
    category: null,
    difficulty: 'medium',
    intention: null,
    order: 0,
    archived: false,
    challengeId: null,
    createdAt: fromDayKey('2026-01-01').getTime(),
    updatedAt: 0,
    ...overrides,
  };
}

export function entry(h: Habit, date: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id: entryId(h.id, date),
    habitId: h.id,
    date,
    value: h.target,
    skipped: false,
    note: null,
    mood: null,
    source: 'manual',
    completedAt: fromDayKey(date).getTime() + 12 * 3600_000,
    updatedAt: 0,
    ...overrides,
  };
}

export function byDay(entries: Entry[]) {
  return new Map(entries.map((e) => [e.date, e]));
}
