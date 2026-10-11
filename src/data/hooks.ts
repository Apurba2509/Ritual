import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { DayKey, todayKey } from '@/domain/dates';
import { isDueOn } from '@/domain/habits';
import { computeSnapshot, Snapshot } from '@/domain/snapshot';
import type { Entry, Habit } from '@/domain/types';
import { useApp } from './store';

// ─── Clock: "today" that rolls over at midnight and when the app resumes ────

export const useClock = create<{ today: DayKey; refresh: () => void }>((set, get) => ({
  today: todayKey(),
  refresh: () => {
    const now = todayKey();
    if (now !== get().today) set({ today: now });
  },
}));

export function useClockDriver() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      timer = setTimeout(() => {
        useClock.getState().refresh();
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') useClock.getState().refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
}

export const useToday = () => useClock((s) => s.today);

// ─── Snapshot (memoised across all components) ──────────────────────────────

let cache: { deps: unknown[]; value: Snapshot } | null = null;

export function getSnapshot(today: DayKey = useClock.getState().today): Snapshot {
  const s = useApp.getState();
  const deps = [s.habits, s.entries, s.unlocked, s.social, s.settings.weekStart, today];
  if (cache && deps.every((d, i) => d === cache!.deps[i])) return cache.value;
  const value = computeSnapshot({
    habits: Object.values(s.habits),
    entries: Object.values(s.entries),
    today,
    weekStart: s.settings.weekStart,
    unlocked: s.unlocked,
    friends: s.social.friends,
    challengesJoined: s.social.challengesJoined,
  });
  cache = { deps, value };
  return value;
}

export function useSnapshot(): Snapshot {
  const today = useToday();
  const habits = useApp((s) => s.habits);
  const entries = useApp((s) => s.entries);
  const unlocked = useApp((s) => s.unlocked);
  const social = useApp((s) => s.social);
  const weekStart = useApp((s) => s.settings.weekStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getSnapshot(today), [today, habits, entries, unlocked, social, weekStart]);
}

// ─── Habit lists ─────────────────────────────────────────────────────────────

export function sortHabits(habits: Habit[]) {
  return habits.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function useHabitList(opts: { archived?: boolean } = {}): Habit[] {
  const habits = useApp((s) => s.habits);
  const archived = !!opts.archived;
  return useMemo(
    () => sortHabits(Object.values(habits).filter((h) => !h.deleted && h.archived === archived)),
    [habits, archived],
  );
}

export function useHabit(id: string | undefined): Habit | undefined {
  return useApp((s) => (id ? s.habits[id] : undefined));
}

export interface DayItem {
  habit: Habit;
  entry: Entry | undefined;
  due: boolean;
}

/** Habits for a given day: due ones first (in user order), then optional ones. */
export function useDayList(day: DayKey): DayItem[] {
  const snapshot = useSnapshot();
  const habits = useHabitList();
  const weekStart = useApp((s) => s.settings.weekStart);
  return useMemo(
    () =>
      habits.map((habit) => {
        const byDay = snapshot.index.get(habit.id);
        return { habit, entry: byDay?.get(day), due: isDueOn(habit, byDay, day, weekStart) };
      }),
    [habits, snapshot, day, weekStart],
  );
}
