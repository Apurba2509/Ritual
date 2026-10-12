import { DayKey, fromDayKey } from './dates';
import type { Habit } from './types';

/**
 * Screen-time analytics: pure functions over the per-day usage the phone records.
 * Kept separate from the native module so the logic is testable and the same everywhere.
 */

export interface ScreenDayData {
  day: DayKey;
  totalMs: number;
  pickups: number;
  firstPickupAt: number;
  lastUseAt: number;
  longestMs: number;
  hourly: number[];
  apps: { pkg: string; ms: number; opens: number }[];
  final: boolean;
  estimated?: boolean;
}

export interface PauseEventData {
  t: number;
  type: 'shown' | 'timesup' | 'closed' | 'left' | 'opened' | 'swap';
  pkg: string;
  intent?: string;
}

export const MIN = 60_000;

export function guardedMs(day: ScreenDayData, guarded: ReadonlySet<string>): number {
  return day.apps.reduce((n, a) => (guarded.has(a.pkg) ? n + a.ms : n), 0);
}

/** Minutes for a screen-limit habit on a day. */
export function screenMinutes(day: ScreenDayData, scope: 'all' | 'guarded', guarded: ReadonlySet<string>): number {
  return Math.round((scope === 'all' ? day.totalMs : guardedMs(day, guarded)) / MIN);
}

/**
 * Entry values for a screen-limit habit: 1 (held the line) or 0 (went over). Today counts as
 * held while you're still under, and flips if you go over: keeping it is the motivation.
 */
export function limitValues(habit: Habit, days: ScreenDayData[], guarded: ReadonlySet<string>): Record<DayKey, number> {
  const auto = habit.auto;
  if (auto?.provider !== 'screen') return {};
  const out: Record<DayKey, number> = {};
  for (const d of days) {
    // A day with no data at all is "unknown", not a win (the phone may have been off, or access missing).
    if (d.totalMs <= 0 && d.final) continue;
    out[d.day] = screenMinutes(d, auto.scope, guarded) <= auto.limitMin ? 1 : 0;
  }
  return out;
}

export interface ScreenSummary {
  today: ScreenDayData | null;
  /** Average over finished days with data (up to 7). */
  avgMs: number | null;
  avgPickups: number | null;
  /** Today vs the average, as a fraction (−0.2 = 20% less). */
  vsAvg: number | null;
  /** Hour of day with the most use across the week. */
  peakHour: number | null;
  /** Average ms per day between 23:00 and 05:00. */
  lateNightMs: number;
  topApps: { pkg: string; ms: number; opens: number; share: number }[];
}

export function summarize(days: ScreenDayData[]): ScreenSummary {
  const today = days.find((d) => !d.final) ?? null;
  const past = days.filter((d) => d.final && d.totalMs > 0).slice(-7);
  const avgMs = past.length ? past.reduce((n, d) => n + d.totalMs, 0) / past.length : null;
  const avgPickups = past.length ? past.reduce((n, d) => n + d.pickups, 0) / past.length : null;

  const hours = new Array(24).fill(0);
  for (const d of past.length ? past : today ? [today] : []) d.hourly.forEach((ms, h) => (hours[h] += ms));
  const max = Math.max(...hours);
  const peakHour = max > 0 ? hours.indexOf(max) : null;
  const late = (d: ScreenDayData) => d.hourly.reduce((n, ms, h) => (h >= 23 || h < 5 ? n + ms : n), 0);
  const lateNightMs = past.length ? past.reduce((n, d) => n + late(d), 0) / past.length : 0;

  const source = today ?? past[past.length - 1] ?? null;
  const total = source?.totalMs ?? 0;
  const topApps = (source?.apps ?? []).slice(0, 8).map((a) => ({ ...a, share: total ? a.ms / total : 0 }));

  // Compare today with the same point in the day on average, so mornings don't look amazing.
  let vsAvg: number | null = null;
  if (today && avgMs && past.length >= 3) {
    const nowHour = new Date().getHours();
    const sameTime =
      past.reduce((n, d) => n + d.hourly.slice(0, nowHour + 1).reduce((a, b) => a + b, 0), 0) / past.length;
    if (sameTime > 10 * MIN) vsAvg = today.totalMs / sameTime - 1;
  }

  return { today, avgMs, avgPickups, vsAvg, peakHour, lateNightMs, topApps };
}

export interface PauseStats {
  shown: number;
  /** Chose not to open: closed, walked away, or swapped for a habit. */
  resisted: number;
  opened: number;
  swapped: number;
}

export function pauseStats(events: PauseEventData[], since: number): PauseStats {
  const s: PauseStats = { shown: 0, resisted: 0, opened: 0, swapped: 0 };
  for (const e of events) {
    if (e.t < since) continue;
    if (e.type === 'shown') s.shown++;
    else if (e.type === 'opened') s.opened++;
    else if (e.type === 'closed' || e.type === 'left') s.resisted++;
    else if (e.type === 'swap') {
      s.resisted++;
      s.swapped++;
    }
  }
  return s;
}

export function formatMinutes(ms: number): string {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

export interface ScreenInsight {
  id: string;
  icon: string;
  title: string;
  body: string;
  /** What we suggest doing about it. */
  action?: 'bedtime' | 'guard' | 'catchup' | 'limit-habit';
}

/** Observations worth acting on, phrased as facts, not judgement. */
export function screenInsights(
  days: ScreenDayData[],
  labels: Record<string, string>,
  guarded: ReadonlySet<string>,
  opts: { bedtimeOn: boolean; hasLimitHabit: boolean; selfPkg?: string },
): ScreenInsight[] {
  const s = summarize(days);
  const out: ScreenInsight[] = [];
  const past = days.filter((d) => d.final && d.totalMs > 0);
  if (!past.length && !s.today) return out;

  if (s.lateNightMs >= 30 * MIN && !opts.bedtimeOn) {
    out.push({
      id: 'late',
      icon: 'moon',
      title: `${formatMinutes(s.lateNightMs)} a night after 11 PM`,
      body: 'Late-night scrolling pushes sleep back and makes the next day harder. A bedtime pause adds a longer breath before apps after 11.',
      action: 'bedtime',
    });
  }

  // Ritual itself never counts as the app pulling you in.
  const top = s.topApps.find(
    (a) => a.pkg !== opts.selfPkg && !guarded.has(a.pkg) && a.share >= 0.25 && a.ms >= 30 * MIN,
  );
  if (top) {
    out.push({
      id: `top:${top.pkg}`,
      icon: 'hourglass-high',
      title: `${labels[top.pkg] ?? 'One app'} is ${Math.round(top.share * 100)}% of your screen time`,
      body: `That's ${formatMinutes(top.ms)} ${s.today ? 'today' : 'yesterday'}. Guarding it adds a breath before it opens, so you choose each time.`,
      action: 'guard',
    });
  }

  if (s.avgPickups !== null && s.avgPickups >= 60) {
    out.push({
      id: 'pickups',
      icon: 'device-mobile',
      title: `You pick up your phone about ${Math.round(s.avgPickups)} times a day`,
      body: 'Most pickups are a reflex to check for something new. Two catch-up windows a day give that urge a time and a place, so nothing feels missed.',
      action: 'catchup',
    });
  }

  if (s.peakHour !== null && !out.some((i) => i.id === 'late')) {
    out.push({
      id: 'peak',
      icon: 'chart-bar',
      title: `Your heaviest hour is around ${hourLabel(s.peakHour)}`,
      body: 'Plan something for that hour: a walk, a habit, or putting the phone in another room.',
    });
  }

  if (!opts.hasLimitHabit && s.avgMs !== null && s.avgMs >= 3 * 60 * MIN) {
    const goal = Math.max(60, Math.round((s.avgMs * 0.8) / MIN / 15) * 15);
    out.push({
      id: 'limit',
      icon: 'target',
      title: `About ${formatMinutes(s.avgMs)} a day on average`,
      body: `Make it a habit you can win: stay under ${formatMinutes(goal * MIN)}. That's 20% less, not a detox.`,
      action: 'limit-habit',
    });
  }

  return out;
}

/** "2026-10-14" → "Wed" */
export const dayShort = (d: DayKey) => fromDayKey(d).toLocaleDateString(undefined, { weekday: 'short' });
