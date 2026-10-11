import { addDays, DayKey, WEEKDAY_LONG, weekdayOf } from './dates';
import { isEntryDone } from './habits';
import type { Snapshot } from './snapshot';
import { nextMilestone } from './xp';

export function periodRate(snapshot: Snapshot, from: DayKey, to: DayKey): number | null {
  let due = 0;
  let done = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = snapshot.days.get(d);
    if (!s) continue;
    if (d === snapshot.today && s.done < s.due) {
      // Don't punish today while it's in progress: only count what's done.
      due += s.done;
      done += s.done;
      continue;
    }
    due += s.due;
    done += Math.min(s.done, s.due);
  }
  return due ? done / due : null;
}

/** Completion rate per weekday (0 = Sunday) over the last `days` days. */
export function weekdayRates(snapshot: Snapshot, days = 84): (number | null)[] {
  const due = Array(7).fill(0);
  const done = Array(7).fill(0);
  for (let i = 1; i <= days; i++) {
    const d = addDays(snapshot.today, -i);
    const s = snapshot.days.get(d);
    if (!s || s.due === 0) continue;
    const wd = weekdayOf(d);
    due[wd] += s.due;
    done[wd] += Math.min(s.done, s.due);
  }
  return due.map((n, i) => (n ? done[i] / n : null));
}

export interface MoodLink {
  habitId: string;
  withHabit: number;
  without: number;
  samples: number;
}

/** Average logged mood on days a habit was done vs. not done. */
export function moodLinks(snapshot: Snapshot): MoodLink[] {
  const moodByDay = new Map<DayKey, number[]>();
  for (const byDay of snapshot.index.values()) {
    for (const [day, e] of byDay) {
      if (e.mood) {
        const arr = moodByDay.get(day) ?? [];
        arr.push(e.mood);
        moodByDay.set(day, arr);
      }
    }
  }
  if (moodByDay.size < 5) return [];
  const dayMood = new Map([...moodByDay].map(([d, m]) => [d, m.reduce((a, b) => a + b, 0) / m.length]));

  const out: MoodLink[] = [];
  for (const { habit } of snapshot.habitStats.values()) {
    const byDay = snapshot.index.get(habit.id);
    let wSum = 0,
      wN = 0,
      oSum = 0,
      oN = 0;
    for (const [day, mood] of dayMood) {
      if (isEntryDone(habit, byDay?.get(day))) {
        wSum += mood;
        wN++;
      } else {
        oSum += mood;
        oN++;
      }
    }
    if (wN >= 3 && oN >= 3) {
      out.push({ habitId: habit.id, withHabit: wSum / wN, without: oSum / oN, samples: wN + oN });
    }
  }
  return out.sort((a, b) => b.withHabit - b.without - (a.withHabit - a.without));
}

export interface Insight {
  id: string;
  emoji: string;
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'info';
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Rule-based insights — work offline and give the AI coach grounded facts to build on. */
export function localInsights(snapshot: Snapshot): Insight[] {
  const out: Insight[] = [];
  const stats = [...snapshot.habitStats.values()].filter((s) => !s.habit.archived);
  if (stats.length === 0) return out;

  const thisWeek = periodRate(snapshot, addDays(snapshot.today, -6), snapshot.today);
  const lastWeek = periodRate(snapshot, addDays(snapshot.today, -13), addDays(snapshot.today, -7));
  if (thisWeek !== null && lastWeek !== null && Math.abs(thisWeek - lastWeek) >= 0.1) {
    const up = thisWeek > lastWeek;
    out.push({
      id: 'trend',
      emoji: up ? '📈' : '📉',
      title: up ? 'Trending up' : 'Slipping a little',
      body: `${pct(thisWeek)} of habits done in the last 7 days vs ${pct(lastWeek)} the week before.`,
      tone: up ? 'good' : 'warn',
    });
  }

  const rates = weekdayRates(snapshot);
  const ranked = rates.map((r, i) => ({ r, i })).filter((x): x is { r: number; i: number } => x.r !== null);
  if (ranked.length >= 5) {
    ranked.sort((a, b) => b.r - a.r);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best.r - worst.r >= 0.15) {
      out.push({
        id: 'weekday',
        emoji: '🗓️',
        title: `${WEEKDAY_LONG[worst.i]}s are your weak spot`,
        body: `You hit ${pct(worst.r)} on ${WEEKDAY_LONG[worst.i]}s vs ${pct(best.r)} on ${WEEKDAY_LONG[best.i]}s. Try a lighter plan or an earlier reminder that day.`,
        tone: 'info',
      });
    }
  }

  const withRate = stats.filter((s) => s.rate30 !== null && s.totalDone >= 3);
  if (withRate.length >= 2) {
    const sorted = [...withRate].sort((a, b) => b.rate30! - a.rate30!);
    const top = sorted[0];
    const low = sorted[sorted.length - 1];
    out.push({
      id: 'top',
      emoji: top.habit.emoji,
      title: `${top.habit.name} is locked in`,
      body: `${pct(top.rate30!)} over the last 30 days — your most consistent habit.`,
      tone: 'good',
    });
    if (low.rate30! < 0.6) {
      out.push({
        id: 'low',
        emoji: low.habit.emoji,
        title: `${low.habit.name} needs attention`,
        body: `Only ${pct(low.rate30!)} in 30 days. Shrink it: a smaller target you can't fail beats a big one you skip.`,
        tone: 'warn',
      });
    }
  }

  for (const s of stats) {
    const next = nextMilestone(s.streak.unit, s.streak.current);
    if (next && s.streak.current > 0 && next - s.streak.current <= 3) {
      out.push({
        id: `milestone-${s.habit.id}`,
        emoji: '🎯',
        title: `${next - s.streak.current} ${s.streak.unit}${next - s.streak.current > 1 ? 's' : ''} to a milestone`,
        body: `${s.habit.name} is at ${s.streak.current}. Hit ${next} for bonus XP.`,
        tone: 'info',
      });
      break;
    }
  }

  const mood = moodLinks(snapshot)[0];
  if (mood && mood.withHabit - mood.without >= 0.4) {
    const h = snapshot.habitStats.get(mood.habitId)!.habit;
    out.push({
      id: 'mood',
      emoji: '😊',
      title: `${h.name} lifts your mood`,
      body: `Average mood ${mood.withHabit.toFixed(1)}/5 on days you do it vs ${mood.without.toFixed(1)}/5 when you don't.`,
      tone: 'good',
    });
  }

  return out;
}
