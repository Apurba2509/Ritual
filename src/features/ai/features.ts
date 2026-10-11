import { Schema } from 'firebase/ai';
import { HABIT_TINT_KEYS, ICON_GROUPS } from '@/domain/catalog';
import { scheduleLabel, targetLabel } from '@/domain/habits';
import { localInsights } from '@/domain/insights';
import { parseQuickLog, ParsedLog } from '@/domain/quickLog';
import type { Snapshot } from '@/domain/snapshot';
import type { Difficulty, Habit, HabitKind, Schedule } from '@/domain/types';
import { aiConfigured, generateJSON } from './gemini';

// ─── Quick log: natural language → entries ──────────────────────────────────

export interface QuickLogPlan {
  logs: (ParsedLog & { note?: string | null })[];
  unmatched: string[];
  engine: 'ai' | 'local';
}

const quickLogSchema = Schema.object({
  properties: {
    logs: Schema.array({
      items: Schema.object({
        properties: {
          habitId: Schema.string({ description: 'id of the matching habit from the list' }),
          amount: Schema.number({
            description:
              'amount to ADD today in the habit unit (minutes for duration habits); use the target for yes/no habits',
          }),
          note: Schema.string({
            nullable: true,
            description: 'short reflection if the user shared feelings or context, else null',
          }),
        },
        optionalProperties: ['note'],
      }),
    }),
    unmatched: Schema.array({ items: Schema.string(), description: 'activities that match no habit' }),
  },
});

export async function planQuickLog(text: string, habits: Habit[]): Promise<QuickLogPlan> {
  const local = parseQuickLog(text, habits);
  if (!aiConfigured) return { ...local, engine: 'local' };

  const active = habits.filter((h) => !h.archived && !h.deleted);
  const list = active
    .map(
      (h) =>
        `- id=${h.id} | "${h.name}" | kind=${h.kind} | target=${targetLabel(h)}${h.unit ? ` (unit: ${h.unit})` : ''}`,
    )
    .join('\n');
  try {
    const res = await generateJSON<{
      logs: { habitId: string; amount: number; note?: string | null }[];
      unmatched: string[];
    }>({
      system: [
        "You turn a person's casual description of their day into habit check-ins.",
        'Rules:',
        '- Only use habit ids from the list. Match by meaning, not exact words: "did a 5k", "jogged", "went running" → a running habit; "drank 6 glasses" → a water habit.',
        `- amount = how much to ADD today, in the habit's own unit. Convert sensibly ("1.5 hours" → 90 for minute habits, "5k steps" → 5000).`,
        `- If the stated unit cannot be converted to the habit's unit (e.g. reading TIME for a PAGES habit), use the habit's target as the amount.`,
        '- Yes/no habits: amount 1.',
        `- Skipped or negated activities ("skipped", "didn't", "no time for") are NOT completions: leave them out entirely, including from unmatched.`,
        '- note: only feelings/context about that specific activity, otherwise null. Never copy the same note onto several habits.',
        '- unmatched: things the person DID that match no habit. Never invent activities.',
      ].join('\n'),
      prompt: `Habits:\n${list}\n\nWhat the user said: """${text.slice(0, 1200)}"""`,
      schema: quickLogSchema,
      tier: 'fast',
      temperature: 0.1,
      timeoutMs: 12_000,
    });
    const ids = new Set(active.map((h) => h.id));
    const logs = res.logs
      .filter((l) => ids.has(l.habitId) && Number.isFinite(l.amount) && l.amount > 0)
      .map((l) => ({ habitId: l.habitId, amount: l.amount, note: l.note ?? null, clause: '', confidence: 0.9 }));
    // Belt and braces: keep confident on-device matches the model missed.
    const seen = new Set(logs.map((l) => l.habitId));
    for (const l of local.logs) if (!seen.has(l.habitId) && l.confidence >= 0.5) logs.push({ ...l, note: null });
    const unmatched = (res.unmatched ?? []).filter(
      (u) => !local.logs.some((l) => l.clause.includes(u) || u.includes(l.clause)),
    );
    return { logs, unmatched, engine: 'ai' };
  } catch {
    return { ...local, engine: 'local' };
  }
}

// ─── Coach: goal → habit plan ───────────────────────────────────────────────

/** Every icon the habit picker offers — the model must choose one of these. */
const HABIT_ICONS = [...new Set(ICON_GROUPS.flatMap((g) => g.icons))];

export interface CoachHabit {
  name: string;
  icon: string;
  kind: HabitKind;
  target: number;
  unit: string | null;
  schedule: Schedule;
  difficulty: Difficulty;
  reminder: string | null;
  why: string;
  color: string;
}

export interface CoachPlan {
  title: string;
  summary: string;
  habits: CoachHabit[];
  tips: string[];
}

const coachSchema = Schema.object({
  properties: {
    title: Schema.string({ description: 'short motivating plan name, max 5 words' }),
    summary: Schema.string({ description: '1-2 sentence overview of the strategy' }),
    habits: Schema.array({
      minItems: 2,
      maxItems: 5,
      items: Schema.object({
        properties: {
          name: Schema.string({ description: 'concise habit name, max 4 words, starts with a verb' }),
          icon: Schema.enumString({ enum: HABIT_ICONS, description: 'the icon that best depicts the habit' }),
          kind: Schema.enumString({ enum: ['check', 'count', 'duration'] }),
          target: Schema.number({ description: '1 for check; N for count; minutes for duration' }),
          unit: Schema.string({
            nullable: true,
            description: 'unit for count habits e.g. pages, glasses; "min" for duration; null for check',
          }),
          scheduleType: Schema.enumString({ enum: ['daily', 'days', 'weekly'] }),
          days: Schema.array({ items: Schema.integer(), description: 'weekdays 0=Sun..6=Sat when scheduleType=days' }),
          timesPerWeek: Schema.integer({ description: 'when scheduleType=weekly' }),
          difficulty: Schema.enumString({ enum: ['easy', 'medium', 'hard'] }),
          reminder: Schema.string({ nullable: true, description: 'best reminder time HH:mm (24h) or null' }),
          why: Schema.string({ description: 'one sentence on why this habit moves the goal forward' }),
        },
        optionalProperties: ['days', 'timesPerWeek'],
      }),
    }),
    tips: Schema.array({ items: Schema.string(), maxItems: 3 }),
  },
});

export async function coachPlan(goal: string, context: { existing: Habit[]; name?: string }): Promise<CoachPlan> {
  const existing = context.existing.map((h) => `${h.name} (${scheduleLabel(h.schedule)})`).join(', ') || 'none';
  type Raw = {
    title: string;
    summary: string;
    habits: (Omit<CoachHabit, 'schedule' | 'color' | 'icon'> & {
      icon?: string;
      scheduleType: Schedule['type'];
      days?: number[];
      timesPerWeek?: number;
    })[];
    tips: string[];
  };
  const raw = await generateJSON<Raw>({
    system:
      "You are Ritual's habit coach, grounded in behaviour science (tiny habits, implementation intentions, habit stacking). " +
      'Design 2-5 small, specific, measurable habits that compound toward the goal. Start easy — consistency beats intensity. ' +
      'Avoid duplicating habits the user already has. Be warm and concise.',
    prompt: `Goal: """${goal.slice(0, 600)}"""\nExisting habits: ${existing}`,
    schema: coachSchema,
    tier: 'smart',
    temperature: 0.7,
    timeoutMs: 30_000,
  });
  return {
    title: raw.title,
    summary: raw.summary,
    tips: raw.tips ?? [],
    habits: raw.habits.map((h, i) => {
      const schedule: Schedule =
        h.scheduleType === 'days' && h.days?.length
          ? { type: 'days', days: [...new Set(h.days.filter((d) => d >= 0 && d <= 6))] }
          : h.scheduleType === 'weekly'
            ? { type: 'weekly', times: Math.min(6, Math.max(1, h.timesPerWeek ?? 3)) }
            : { type: 'daily' };
      const kind: HabitKind = ['check', 'count', 'duration'].includes(h.kind) ? h.kind : 'check';
      return {
        name: h.name,
        icon: h.icon && HABIT_ICONS.includes(h.icon) ? h.icon : 'sparkle',
        kind,
        target: kind === 'check' ? 1 : Math.max(1, Math.round(h.target)),
        unit: kind === 'check' ? null : kind === 'duration' ? 'min' : h.unit || 'times',
        schedule,
        difficulty: h.difficulty ?? 'medium',
        reminder: h.reminder && /^\d{2}:\d{2}$/.test(h.reminder) ? h.reminder : null,
        why: h.why,
        color: HABIT_TINT_KEYS[(i * 2) % HABIT_TINT_KEYS.length],
      };
    }),
  };
}

// ─── Weekly review ──────────────────────────────────────────────────────────

export interface WeeklyReview {
  headline: string;
  wins: string[];
  focus: string;
  experiment: string;
}

const reviewSchema = Schema.object({
  properties: {
    headline: Schema.string({ description: 'one punchy sentence summarising the week' }),
    wins: Schema.array({ items: Schema.string(), maxItems: 3 }),
    focus: Schema.string({ description: 'the single most useful thing to focus on next week' }),
    experiment: Schema.string({ description: 'one tiny, concrete experiment to try next week' }),
  },
});

export async function weeklyReview(snapshot: Snapshot): Promise<WeeklyReview> {
  const stats = [...snapshot.habitStats.values()]
    .filter((s) => !s.habit.archived)
    .map(
      (s) =>
        `${s.habit.name}: streak ${s.streak.current} ${s.streak.unit}s (best ${s.streak.longest}), 30-day rate ${
          s.rate30 === null ? 'n/a' : Math.round(s.rate30 * 100) + '%'
        }, schedule ${scheduleLabel(s.habit.schedule)}`,
    )
    .join('\n');
  const facts = localInsights(snapshot)
    .map((i) => `- ${i.title}: ${i.body}`)
    .join('\n');
  return generateJSON<WeeklyReview>({
    system:
      'You are a supportive, data-driven habit coach. Use ONLY the provided numbers. Be specific, warm and brief. ' +
      'Celebrate real wins; frame gaps as experiments, never guilt.',
    prompt: `Level ${snapshot.level.level}, ${snapshot.weeklyXP} XP this week, perfect-day run ${snapshot.perfectRun}.\nHabits:\n${stats}\n\nObserved patterns:\n${facts || '- none yet'}`,
    schema: reviewSchema,
    tier: 'smart',
    temperature: 0.6,
  });
}
