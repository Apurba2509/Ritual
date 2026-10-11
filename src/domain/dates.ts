/**
 * Calendar-day helpers.
 *
 * Every habit entry is keyed by a *local* calendar day ("yyyy-MM-dd"), never by a
 * timestamp. Keys sort lexicographically, survive timezone changes, and make
 * entry ids deterministic (`${habitId}_${dayKey}`), which keeps sync idempotent.
 */

export type DayKey = string; // yyyy-MM-dd
export type WeekStart = 0 | 1; // 0 = Sunday, 1 = Monday

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function addDays(key: DayKey, days: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  // Constructing from components keeps us on local midnight across DST changes.
  return toDayKey(new Date(y, m - 1, d + days));
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  const da = fromDayKey(a);
  const db = fromDayKey(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key: DayKey): number {
  return fromDayKey(key).getDay();
}

export function startOfWeek(key: DayKey, weekStart: WeekStart = 1): DayKey {
  const wd = weekdayOf(key);
  const offset = (wd - weekStart + 7) % 7;
  return addDays(key, -offset);
}

export function minKey(a: DayKey, b: DayKey): DayKey {
  return a < b ? a : b;
}

export function maxKey(a: DayKey, b: DayKey): DayKey {
  return a > b ? a : b;
}

/** Inclusive list of day keys from start to end. */
export function dayRange(start: DayKey, end: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** ISO-ish week id used for weekly leaderboards, e.g. "2026-W41" (weeks start Monday). */
export function weekId(key: DayKey): string {
  const monday = startOfWeek(key, 1);
  const thursday = fromDayKey(addDays(monday, 3));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart.getTime()) / 86_400_000 / 7) + 1;
  return `${thursday.getFullYear()}-W${pad(week)}`;
}

export function dayKeyFromTimestamp(ms: number): DayKey {
  return toDayKey(new Date(ms));
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weekday indices in display order for the given week start. */
export function orderedWeekdays(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
}
