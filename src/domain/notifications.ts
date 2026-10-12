import { addDays, DayKey, fromDayKey, WeekStart } from './dates';
import { isDueOn, isEntryDone, targetLabel } from './habits';
import type { CategoryId, EntryIndex, Habit } from './types';

/**
 * Notification planner — a pure function from "habits + history + settings" to the exact list of
 * notifications to schedule for the next few days. Rebuilt whenever anything changes, so nothing
 * stale ever fires: finish a habit and its nudges disappear.
 *
 * Styles:
 *   calm      morning brief, your own reminder times, evening nudge
 *   balanced  + midday check-in, weekly recap
 *   coach     + smart nudges for habits without a time, afternoon movement push, last-call streak saver
 */

export type NotifyStyle = 'calm' | 'balanced' | 'coach';

export type PlannedKind =
  'reminder' | 'nudge' | 'brief' | 'midday' | 'movement' | 'evening' | 'lastcall' | 'weekly' | 'rescue';

/** What the behaviour engine knows about this person (see domain/behavior). */
export interface PersonalSignals {
  /** Learned time each habit usually gets done ("HH:mm"). */
  usualTime: Map<string, string>;
  /** Habits that were missed yesterday (never-miss-twice). */
  missedYesterday: Set<string>;
  /** Two-minute version of each habit. */
  tiny: Map<string, string>;
  mood: 'new' | 'thriving' | 'steady' | 'slipping' | 'struggling' | 'returning';
  /** Easy mode is on today: tiny versions count. */
  easy: boolean;
}

export interface PlannedNotification {
  id: string;
  kind: PlannedKind;
  at: number;
  title: string;
  body: string;
  habitId?: string;
  day: DayKey;
}

export interface PlannerInput {
  habits: Habit[];
  index: EntryIndex;
  streaks: Map<string, { current: number; atRisk: boolean }>;
  today: DayKey;
  now: number;
  weekStart: WeekStart;
  style: NotifyStyle;
  morningBrief: { enabled: boolean; time: string };
  eveningNudge: { enabled: boolean; time: string };
  quietHours: { start: string; end: string } | null;
  /** Steps counted so far today, if the phone is tracking them. */
  stepsToday?: number | null;
  days?: number;
  personal?: PersonalSignals;
}

/** Sensible time of day to nudge a habit that has no reminder set, by what kind of habit it is. */
const SMART_TIME: Record<CategoryId, string> = {
  health: '11:00',
  fitness: '17:30',
  mind: '08:15',
  learning: '19:30',
  career: '15:00',
  productivity: '10:00',
  social: '18:30',
  finance: '21:00',
  creativity: '19:00',
  home: '18:00',
};

const PRIORITY: Record<PlannedKind, number> = {
  reminder: 9,
  rescue: 8,
  lastcall: 8,
  evening: 7,
  movement: 6,
  nudge: 5,
  midday: 4,
  weekly: 3,
  brief: 2,
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function inQuietHours(date: Date, quiet: { start: string; end: string } | null): boolean {
  if (!quiet) return false;
  const m = date.getHours() * 60 + date.getMinutes();
  const s = minutesOf(quiet.start);
  const e = minutesOf(quiet.end);
  return s < e ? m >= s && m < e : m >= s || m < e;
}

function at(day: DayKey, hhmm: string): Date {
  const d = fromDayKey(day);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

const pick = <T>(list: T[], seed: number) => list[Math.abs(seed) % list.length];

function seedOf(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function reminderCopy(h: Habit, streak: number, seed: number) {
  if (streak >= 3) {
    return pick(
      [
        `Day ${streak + 1} is waiting. Keep the chain going.`,
        `${streak} days in a row. Two minutes keeps it alive.`,
        `You've shown up ${streak} times straight. Make it ${streak + 1}.`,
      ],
      seed,
    );
  }
  return pick(
    [
      `${targetLabel(h)} today. Tap Done when it's finished.`,
      `Small reps, big results. Time for ${h.name.toLowerCase()}.`,
      `Future you says thanks. ${targetLabel(h)} today.`,
      `This is the moment. ${h.name}, then you're free.`,
    ],
    seed,
  );
}

function nudgeCopy(h: Habit, seed: number) {
  return pick(
    [
      `Still open today: ${h.name.toLowerCase()}.`,
      `Got 10 minutes? ${h.name} is still waiting.`,
      `Quick one before the day runs away: ${h.name.toLowerCase()}.`,
    ],
    seed,
  );
}

const list = (hs: Habit[]) =>
  `${hs
    .slice(0, 3)
    .map((h) => h.name)
    .join(', ')}${hs.length > 3 ? '…' : ''}`;

export function planNotifications(input: PlannerInput): PlannedNotification[] {
  const { habits, index, streaks, today, now, weekStart, style } = input;
  const days = input.days ?? 7;
  const personal = input.personal;
  // When someone is struggling, more pings make it worse. Fewer, kinder ones.
  const gentle = personal?.mood === 'struggling' || personal?.mood === 'returning';
  const coach = style === 'coach' && !gentle;
  const balanced = style !== 'calm' && !gentle;
  const out: PlannedNotification[] = [];
  const push = (n: Omit<PlannedNotification, 'at'> & { at: Date }, allowInQuiet = false) => {
    if (n.at.getTime() <= now + 30_000) return;
    if (!allowInQuiet && inQuietHours(n.at, input.quietHours)) return;
    out.push({ ...n, at: n.at.getTime() });
  };

  const active = habits.filter((h) => !h.deleted && !h.archived);

  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const isToday = i === 0;
    const due = active.filter((h) => isDueOn(h, index.get(h.id), day, weekStart));
    if (!due.length) continue;
    const open = isToday ? due.filter((h) => !isEntryDone(h, index.get(h.id)?.get(day))) : due;
    const doneCount = due.length - open.length;
    const seed = seedOf(day);

    // Morning brief
    if (input.morningBrief.enabled) {
      push({
        id: `brief:${day}`,
        kind: 'brief',
        day,
        at: at(day, input.morningBrief.time),
        title:
          isToday && personal?.mood === 'returning'
            ? 'A fresh start'
            : isToday && personal?.easy
              ? 'Easy mode today'
              : pick(['Your ritual for today', 'Good morning', 'Today’s lineup'], seed),
        body:
          isToday && personal?.mood === 'returning'
            ? `No catching up needed. Just one tiny thing today: ${(personal.tiny.get(due[0].id) ?? due[0].name).toLowerCase()}.`
            : isToday && personal?.easy
              ? `Tiny versions count today. ${list(due)}.`
              : `${due.length} habit${due.length > 1 ? 's' : ''}: ${list(due)}`,
      });
    }

    if (!open.length) continue;

    // Your own reminder times — always kept, even in quiet hours (you chose them).
    for (const h of open) {
      const streak = streaks.get(h.id)?.current ?? 0;
      for (const time of h.reminders) {
        push(
          {
            id: `habit:${h.id}:${day}:${time}`,
            kind: 'reminder',
            day,
            habitId: h.id,
            at: at(day, time),
            title: h.name,
            body:
              isToday && personal?.easy && personal.tiny.get(h.id)
                ? `Easy mode: ${personal.tiny.get(h.id)!.toLowerCase()} counts today.`
                : reminderCopy(h, streak, seed + h.name.length),
          },
          true,
        );
      }
    }

    // Smart nudges for habits you didn't give a time (coach)
    if (coach) {
      for (const h of open) {
        if (h.reminders.length || h.auto) continue;
        const time = personal?.usualTime.get(h.id) ?? ((h.category && SMART_TIME[h.category]) || '12:30');
        push({
          id: `nudge:${h.id}:${day}`,
          kind: 'nudge',
          day,
          habitId: h.id,
          at: at(day, time),
          title: h.name,
          body: nudgeCopy(h, seed + h.name.length),
        });
      }
    }

    // Never miss twice: one kind nudge with the two-minute version, at the time they usually do it.
    if (isToday && personal) {
      const missed = open.find((h) => personal.missedYesterday.has(h.id) && !h.auto);
      if (missed) {
        const tiny = personal.tiny.get(missed.id);
        push({
          id: `rescue:${missed.id}:${day}`,
          kind: 'rescue',
          day,
          habitId: missed.id,
          at: at(day, personal.usualTime.get(missed.id) ?? '18:00'),
          title: `Don't miss ${missed.name.toLowerCase()} twice`,
          body: tiny
            ? `Yesterday slipped. That's fine. Today the tiny version counts: ${tiny.toLowerCase()}.`
            : 'Yesterday slipped. That’s fine. Two minutes today keeps the habit alive.',
        });
      }
    }

    // Midday check-in
    if (balanced && due.length >= 2) {
      const next = open[0];
      push({
        id: `midday:${day}`,
        kind: 'midday',
        day,
        habitId: next.id,
        at: at(day, '13:00'),
        title: isToday && doneCount ? `${doneCount} of ${due.length} done` : 'Halfway through the day',
        body: `Next up: ${next.name}.${open.length > 1 ? ` ${open.length - 1} more after that.` : ''}`,
      });
    }

    // Afternoon movement push (coach): when a steps habit is behind
    const stepsHabit = open.find(
      (h) => h.auto?.provider === 'device' && h.auto.metric === 'steps' && h.kind === 'count',
    );
    if (coach && stepsHabit) {
      const steps = isToday ? (input.stepsToday ?? null) : null;
      const behind = steps === null || steps < stepsHabit.target * 0.6;
      if (behind) {
        const gap = steps !== null ? Math.max(0, stepsHabit.target - steps) : null;
        push({
          id: `move:${day}`,
          kind: 'movement',
          day,
          habitId: stepsHabit.id,
          at: at(day, '16:30'),
          title: steps !== null ? `${steps.toLocaleString()} steps so far` : 'Afternoon walk?',
          body:
            gap !== null
              ? `${gap.toLocaleString()} to go. A ${Math.max(10, Math.round(gap / 110))}-minute walk closes it.`
              : `Your goal is ${stepsHabit.target.toLocaleString()} steps. Your phone counts every one.`,
        });
      }
    }

    // Evening nudge
    if (input.eveningNudge.enabled) {
      const atRisk = isToday ? open.filter((h) => streaks.get(h.id)?.atRisk) : [];
      const longest = atRisk.reduce((m, h) => Math.max(m, streaks.get(h.id)?.current ?? 0), 0);
      push({
        id: `evening:${day}`,
        kind: 'evening',
        day,
        at: at(day, input.eveningNudge.time),
        title: longest >= 2 ? `${longest}-day streak at risk` : 'Still time today',
        body: isToday
          ? `${open.length} left: ${list(open)}`
          : 'Check in before the day ends to keep your streaks alive.',
      });
    }

    // Last call (coach, today only): a real streak is about to break
    if (coach && isToday) {
      const risky = open
        .map((h) => ({ h, s: streaks.get(h.id) }))
        .filter((x) => x.s?.atRisk && x.s.current >= 3)
        .sort((a, b) => (b.s?.current ?? 0) - (a.s?.current ?? 0))[0];
      if (risky) {
        push(
          {
            id: `lastcall:${day}`,
            kind: 'lastcall',
            day,
            habitId: risky.h.id,
            at: at(day, '22:00'),
            title: `Last call: ${risky.s!.current}-day streak`,
            body: `${risky.h.name} is the only thing between you and day ${risky.s!.current + 1}.`,
          },
          true,
        );
      }
    }

    // Weekly recap on the last day of the week
    const lastDayOfWeek = fromDayKey(day).getDay() === (weekStart === 1 ? 0 : 6);
    if (balanced && lastDayOfWeek) {
      push({
        id: `weekly:${day}`,
        kind: 'weekly',
        day,
        at: at(day, '19:00'),
        title: 'Your week in Ritual',
        body: 'See your consistency, best streaks and one experiment for next week.',
      });
    }
  }

  // Never stack two pings within 20 minutes — keep the more important one.
  out.sort((a, b) => a.at - b.at || PRIORITY[b.kind] - PRIORITY[a.kind]);
  const kept: PlannedNotification[] = [];
  for (const n of out) {
    const clash = kept.find(
      (k) => Math.abs(k.at - n.at) < 20 * 60_000 && k.kind !== 'reminder' && n.kind !== 'reminder',
    );
    if (!clash) kept.push(n);
    else if (PRIORITY[n.kind] > PRIORITY[clash.kind]) kept[kept.indexOf(clash)] = n;
  }
  return kept.sort((a, b) => a.at - b.at);
}
