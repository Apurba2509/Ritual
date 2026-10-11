import { AppState } from 'react-native';
import type { DayKey } from '@/domain/dates';
import { isScheduledOn } from '@/domain/habits';
import type { EntrySource } from '@/domain/types';
import { milestoneBonus } from '@/domain/xp';
import { getSnapshot, useClock } from '@/data/hooks';
import { EntryChange, useApp } from '@/data/store';
import { useUI } from '@/data/ui';
import { haptic } from '@/lib/haptics';
import { notifyAutoComplete, rescheduleSoon } from '@/features/notifications/scheduler';
import { autoLabel, formatProgress } from './format';
import { postActivity } from '@/features/social/api';

/**
 * Every way of logging progress (tap, +1, timer, notification, AI, integrations) funnels
 * through here so feedback — haptics, milestone celebrations, perfect-day confetti,
 * activity posts, reminder refresh — is consistent.
 */
function afterChange(habitId: string, day: DayKey, change: EntryChange | null, opts: { quiet?: boolean } = {}) {
  if (!change) return;
  rescheduleSoon();
  const today = useClock.getState().today;

  if (change.isDone && !change.wasDone) {
    if (!opts.quiet) haptic.success();
    if (day !== today) return;
    const snap = getSnapshot(today);
    const stats = snap.habitStats.get(habitId);
    if (!stats) return;
    const { current, unit } = stats.streak;
    const bonus = milestoneBonus(unit, current);
    const ui = useUI.getState();
    if (bonus > 0 && !opts.quiet) {
      ui.burst();
      ui.celebrate({
        kind: 'milestone',
        habitName: stats.habit.name,
        icon: stats.habit.icon,
        color: stats.habit.color,
        streak: current,
        unit,
        bonus,
      });
      postActivity({
        type: 'milestone',
        text: `hit a ${current}-${unit} streak on ${stats.habit.name}`,
      });
    }
    const todaySummary = snap.days.get(today);
    // Only a *required* habit can complete the day; finishing a bonus habit afterwards shouldn't re-announce it.
    const required = stats.habit.schedule.type !== 'weekly' && isScheduledOn(stats.habit.schedule, today);
    if (required && todaySummary && todaySummary.due > 1 && todaySummary.done === todaySummary.due && !opts.quiet) {
      ui.burst();
      ui.toast(`Perfect day! Everything done${snap.perfectRun > 1 ? ` · ${snap.perfectRun} in a row` : ''}`, {
        icon: 'star',
        tone: 'success',
      });
      if (snap.perfectRun === 7 || snap.perfectRun === 30) {
        postActivity({ type: 'perfect', text: `completed ${snap.perfectRun} perfect days in a row` });
      }
    }
  } else if (!change.isDone && change.wasDone) {
    if (!opts.quiet) haptic.light();
  } else if (!opts.quiet) {
    haptic.tap();
  }
}

export function toggleHabit(habitId: string, day: DayKey, source: EntrySource = 'manual') {
  const change = useApp.getState().toggleDone(habitId, day, source);
  afterChange(habitId, day, change);
  return change;
}

export function addProgress(habitId: string, day: DayKey, delta: number, source: EntrySource = 'manual') {
  const change = useApp.getState().addToEntry(habitId, day, delta, source);
  afterChange(habitId, day, change);
  return change;
}

export function setProgress(habitId: string, day: DayKey, value: number, source: EntrySource = 'manual') {
  const change = useApp.getState().setEntry(habitId, day, { value, skipped: false }, source);
  afterChange(habitId, day, change);
  return change;
}

export function completeHabit(habitId: string, day: DayKey, source: EntrySource) {
  const h = useApp.getState().habits[habitId];
  if (!h) return null;
  const current = useApp.getState().entries[`${habitId}_${day}`];
  const value = Math.max(h.target, current && !current.deleted ? current.value : 0);
  return setProgress(habitId, day, value, source);
}

export function skipHabit(habitId: string, day: DayKey, skipped: boolean) {
  const change = useApp.getState().setEntry(habitId, day, { skipped, value: 0 });
  rescheduleSoon();
  haptic.light();
  return change;
}

/** Apply integration data quietly (no confetti storms for a year of backfill). */
export function applyAutoValues(habitId: string, values: Record<DayKey, number>, source: EntrySource) {
  const today = useClock.getState().today;
  const todayBefore = useApp.getState().entries[`${habitId}_${today}`];
  const changed = useApp.getState().mergeAutoEntries(habitId, values, source);
  if (changed) {
    rescheduleSoon();
    const todayAfter = useApp.getState().entries[`${habitId}_${today}`];
    if (todayAfter && todayAfter !== todayBefore) {
      const h = useApp.getState().habits[habitId];
      const wasDone = !!todayBefore && !todayBefore.deleted && todayBefore.value >= (h?.target ?? 1);
      const isDone = !todayAfter.deleted && todayAfter.value >= (h?.target ?? 1);
      afterChange(habitId, today, { wasDone, isDone, entry: todayAfter }, { quiet: true });
      // Completed itself while you weren't looking: tell you (in the app it shows as a toast instead).
      if (h && isDone && !wasDone) {
        const detail = `${h.kind === 'check' ? 'Done' : formatProgress(h, todayAfter.value)} · ${autoLabel(h.auto) ?? 'auto-tracked'}`;
        if (AppState.currentState === 'active')
          useUI.getState().toast(`${h.name} completed itself`, { icon: 'lightning', tone: 'success' });
        else notifyAutoComplete(h, detail).catch(() => {});
      }
    }
  }
  return changed;
}
