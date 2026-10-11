import { todayKey } from '@/domain/dates';
import { buildEntryIndex, isDueOn, isEntryDone, progressOf } from '@/domain/habits';
import type { Habit } from '@/domain/types';
import { useApp } from '@/data/store';

export interface WidgetHabit {
  id: string;
  name: string;
  progress: number;
  done: boolean;
}

export interface WidgetState {
  total: number;
  done: number;
  segments: number[];
  next: WidgetHabit[];
  empty: boolean;
}

/** Today's state, read straight from the local store (works in the headless widget task too). */
export function widgetState(): WidgetState {
  const app = useApp.getState();
  const today = todayKey();
  const index = buildEntryIndex(Object.values(app.entries).filter((e) => !e.deleted));
  const habits = Object.values(app.habits)
    .filter((h) => !h.deleted && !h.archived)
    .sort((a, b) => a.order - b.order);
  const due = habits.filter(
    (h) =>
      isDueOn(h, index.get(h.id), today, app.settings.weekStart) &&
      !(h.schedule.type === 'weekly' && !isEntryDone(h, index.get(h.id)?.get(today))),
  );
  const toItem = (h: Habit): WidgetHabit => {
    const entry = index.get(h.id)?.get(today);
    return { id: h.id, name: h.name, progress: progressOf(h, entry), done: isEntryDone(h, entry) };
  };
  const items = due.map(toItem);
  return {
    total: items.length,
    done: items.filter((i) => i.done).length,
    segments: items.map((i) => i.progress),
    next: items.filter((i) => !i.done).slice(0, 3),
    empty: habits.length === 0,
  };
}
