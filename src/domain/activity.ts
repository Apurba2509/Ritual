import { DayKey, toDayKey } from './dates';
import type { Habit, Workout, WorkoutType } from './types';

/**
 * Turns raw on-device signals — activity-recognition transitions and recorded workouts — into
 * per-day values a habit understands (minutes, km, steps, sessions). Pure functions: the native
 * module only collects, all interpretation happens here where it's testable.
 */

export interface ActivityEvent {
  type: WorkoutType | 'other';
  enter: boolean;
  /** Wall-clock ms. */
  t: number;
}

export interface Segment {
  type: WorkoutType;
  start: number;
  end: number;
}

const MIN = 60_000;

/** Pair ENTER/EXIT transitions into segments. Very short blips are noise; runaway ones are capped. */
export function segmentsFromEvents(
  events: ActivityEvent[],
  now: number,
  opts: { minMs?: number; maxMs?: number } = {},
): Segment[] {
  const minMs = opts.minMs ?? 3 * MIN;
  const maxMs = opts.maxMs ?? 4 * 60 * MIN;
  const open = new Map<WorkoutType, number>();
  const out: Segment[] = [];
  const push = (type: WorkoutType, start: number, end: number) => {
    const len = Math.min(end - start, maxMs);
    if (len >= minMs) out.push({ type, start, end: start + len });
  };
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    if (e.type === 'other') continue;
    if (e.enter) {
      if (!open.has(e.type)) open.set(e.type, e.t);
    } else {
      const start = open.get(e.type);
      if (start !== undefined) {
        push(e.type, start, e.t);
        open.delete(e.type);
      }
    }
  }
  // Still going right now.
  for (const [type, start] of open) push(type, start, now);
  return out;
}

/** Union of overlapping intervals. */
export function mergeIntervals(list: [number, number][]): [number, number][] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Spread an interval over the local days it touches. */
function addByDay(acc: Record<DayKey, number>, start: number, end: number) {
  let cursor = start;
  while (cursor < end) {
    const d = new Date(cursor);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const stop = Math.min(midnight, end);
    const key = toDayKey(d);
    acc[key] = (acc[key] ?? 0) + (stop - cursor);
    cursor = stop;
  }
}

/** Active minutes per day for one activity type, without double-counting a recorded workout
 * that activity recognition also noticed. */
export function dailyMinutes(type: WorkoutType, workouts: Workout[], segments: Segment[]): Record<DayKey, number> {
  const intervals: [number, number][] = [
    ...workouts
      .filter((w) => w.type === type && !w.deleted)
      .map((w) => [w.startedAt, w.startedAt + w.movingSec * 1000] as [number, number]),
    ...segments.filter((s) => s.type === type).map((s) => [s.start, s.end] as [number, number]),
  ];
  const ms: Record<DayKey, number> = {};
  for (const [a, b] of mergeIntervals(intervals)) addByDay(ms, a, b);
  return Object.fromEntries(Object.entries(ms).map(([d, v]) => [d, Math.round(v / MIN)]));
}

export function dailyDistanceKm(type: WorkoutType, workouts: Workout[]): Record<DayKey, number> {
  const out: Record<DayKey, number> = {};
  for (const w of workouts) {
    if (w.type !== type || w.deleted || w.distanceM <= 0) continue;
    out[w.date] = Math.round(((out[w.date] ?? 0) + w.distanceM / 1000) * 100) / 100;
  }
  return out;
}

export function dailySessions(type: WorkoutType, workouts: Workout[]): Record<DayKey, number> {
  const out: Record<DayKey, number> = {};
  for (const w of workouts) if (w.type === type && !w.deleted) out[w.date] = (out[w.date] ?? 0) + 1;
  return out;
}

const KM = /\b(km|kms|kilomet)/i;
const MILES = /\b(mi|mile|miles)\b/i;
const STEPS = /step/i;

/** A check habit counts as done after this many minutes of the activity. */
export const CHECK_MINUTES = 10;

/**
 * Values for a device-tracked habit, in the habit's own unit:
 * duration → minutes · count in km / miles / steps → distance or steps · other counts → sessions ·
 * yes/no → done after CHECK_MINUTES.
 */
export function deviceValues(
  habit: Pick<Habit, 'kind' | 'unit' | 'target' | 'auto'>,
  data: { steps: Record<DayKey, number>; workouts: Workout[]; segments: Segment[] },
): Record<DayKey, number> {
  const auto = habit.auto;
  if (!auto || auto.provider !== 'device') return {};
  const unit = habit.unit ?? '';

  if (auto.metric === 'steps') {
    if (habit.kind === 'check') {
      return Object.fromEntries(Object.entries(data.steps).map(([d, v]) => [d, v >= 1000 ? 1 : 0]));
    }
    return data.steps;
  }

  const type = auto.metric;
  if (habit.kind === 'duration') return dailyMinutes(type, data.workouts, data.segments);
  if (habit.kind === 'check') {
    const minutes = dailyMinutes(type, data.workouts, data.segments);
    const sessions = dailySessions(type, data.workouts);
    const days = new Set([...Object.keys(minutes), ...Object.keys(sessions)]);
    return Object.fromEntries(
      [...days].map((d) => [d, (minutes[d] ?? 0) >= CHECK_MINUTES || (sessions[d] ?? 0) > 0 ? 1 : 0]),
    );
  }
  if (KM.test(unit)) return dailyDistanceKm(type, data.workouts);
  if (MILES.test(unit)) {
    const km = dailyDistanceKm(type, data.workouts);
    return Object.fromEntries(Object.entries(km).map(([d, v]) => [d, Math.round((v / 1.609344) * 100) / 100]));
  }
  if (STEPS.test(unit)) return data.steps;
  return dailySessions(type, data.workouts);
}

// ─── Formatting helpers shared by the recorder and summaries ────────────────

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/** 312 → 5'12" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm > 3600) return '–';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}

export function averagePace(w: Pick<Workout, 'movingSec' | 'distanceM'>): number | null {
  return w.distanceM >= 50 ? w.movingSec / (w.distanceM / 1000) : null;
}

/** Decode a Google encoded polyline into [lat, lon] pairs. */
export function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lon += delta;
    }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}
