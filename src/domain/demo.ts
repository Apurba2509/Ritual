import { addDays, DayKey, fromDayKey } from './dates';
import type { Entry, Habit } from './types';

/**
 * Realistic sample history — used by "Look around first" in the app and by the emulator seed
 * script. Deterministic (seeded PRNG), with momentum: consistency improves over time and
 * there's a slump three weeks in, so charts and insights have something real to say.
 */

export type DemoHabitSpec = Pick<
  Habit,
  'name' | 'icon' | 'color' | 'kind' | 'target' | 'unit' | 'schedule' | 'difficulty' | 'category'
> & {
  /** Rough completion probability. */
  rate: number;
  reminders?: string[];
  auto?: Habit['auto'];
  /** Source to stamp on completions (to show off auto-tracking). */
  source?: Entry['source'];
};

export const DEMO_HABITS: DemoHabitSpec[] = [
  {
    name: 'Ship code',
    icon: 'git-commit',
    color: 'lime',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    difficulty: 'medium',
    category: 'career',
    rate: 0.9,
    reminders: ['18:00'],
    source: 'github',
  },
  {
    name: 'Walk 8,000 steps',
    icon: 'footprints',
    color: 'mint',
    kind: 'count',
    target: 8000,
    unit: 'steps',
    schedule: { type: 'daily' },
    difficulty: 'medium',
    category: 'fitness',
    rate: 0.78,
    source: 'health',
  },
  {
    name: 'Drink water',
    icon: 'drop',
    color: 'sky',
    kind: 'count',
    target: 8,
    unit: 'glasses',
    schedule: { type: 'daily' },
    difficulty: 'easy',
    category: 'health',
    rate: 0.85,
  },
  {
    name: 'Meditate',
    icon: 'flower-lotus',
    color: 'lilac',
    kind: 'duration',
    target: 10,
    unit: 'min',
    schedule: { type: 'daily' },
    difficulty: 'medium',
    category: 'mind',
    rate: 0.8,
    reminders: ['07:30'],
  },
  {
    name: 'Read',
    icon: 'book-open-text',
    color: 'butter',
    kind: 'count',
    target: 20,
    unit: 'pages',
    schedule: { type: 'days', days: [1, 2, 3, 4, 5] },
    difficulty: 'medium',
    category: 'learning',
    rate: 0.7,
  },
  {
    name: 'Work out',
    icon: 'barbell',
    color: 'coral',
    kind: 'duration',
    target: 30,
    unit: 'min',
    schedule: { type: 'weekly', times: 4 },
    difficulty: 'hard',
    category: 'fitness',
    rate: 0.62,
  },
];

const NOTES = [
  'Felt great today',
  'Hard start, strong finish',
  'Did it before work',
  'Almost skipped — glad I didn’t',
  'New personal best',
];

export function buildDemoHistory(opts: {
  idPrefix: string;
  specs: DemoHabitSpec[];
  today: DayKey;
  days?: number;
  seed?: number;
  now?: number;
}): { habits: Habit[]; entries: Entry[] } {
  const { idPrefix, specs, today } = opts;
  const days = opts.days ?? 70;
  const now = opts.now ?? Date.now();
  let seed = opts.seed ?? 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  const created = fromDayKey(addDays(today, -days)).getTime();
  const habits: Habit[] = specs.map((s, i) => ({
    id: `${idPrefix}h${i}`,
    name: s.name,
    icon: s.icon,
    color: s.color,
    kind: s.kind,
    target: s.target,
    unit: s.unit,
    schedule: s.schedule,
    reminders: s.reminders ?? [],
    auto: s.auto ?? null,
    category: s.category,
    difficulty: s.difficulty,
    intention: null,
    order: i,
    archived: false,
    challengeId: null,
    createdAt: created,
    updatedAt: now,
  }));

  const entries: Entry[] = [];
  habits.forEach((h, idx) => {
    const spec = specs[idx];
    for (let i = days; i >= 0; i--) {
      const day = addDays(today, -i);
      const wd = fromDayKey(day).getDay();
      if (h.schedule.type === 'days' && !h.schedule.days.includes(wd)) continue;
      if (h.schedule.type === 'weekly' && rand() > h.schedule.times / 7 + 0.1) continue;
      const progress = 1 - i / days;
      const slump = i > 45 && i < 52 ? 0.35 : 0;
      const p = Math.min(0.98, spec.rate * (0.75 + 0.35 * progress) - slump);
      if (i === 0 && idx % 2 === 1) continue; // leave part of today to do
      if (rand() > p) continue;
      const value = h.kind === 'check' ? 1 : Math.round(h.target * (1 + rand() * 0.4));
      const hour = 6 + Math.floor(rand() * 15);
      const completedAt = fromDayKey(day).getTime() + hour * 3_600_000 + 15 * 60_000;
      entries.push({
        id: `${h.id}_${day}`,
        habitId: h.id,
        date: day,
        value,
        skipped: false,
        note: rand() > 0.92 ? NOTES[Math.floor(rand() * NOTES.length)] : null,
        mood: rand() > 0.6 ? ((3 + Math.floor(rand() * 3)) as Entry['mood']) : null,
        photoUrl: null,
        source: spec.source && rand() > 0.15 ? spec.source : 'manual',
        completedAt,
        updatedAt: Math.min(completedAt, now),
      });
    }
  });
  return { habits, entries };
}
