import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { todayKey } from '@/domain/dates';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { useUI } from '@/data/ui';
import { storage } from '@/lib/storage';
import { completeHabit } from '@/features/habits/actions';
import { ACTION_DONE, ACTION_SNOOZE, snoozeHabit } from './scheduler';

const HANDLED_KEY = 'notif:handled';

/** Handle taps on notification buttons (✓ Done / Snooze) and plain taps. */
export function useNotificationResponses() {
  const response = Notifications.useLastNotificationResponse();
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (!response || status !== 'ready') return;
    const req = response.notification.request;
    const key = `${req.identifier}:${response.actionIdentifier}:${response.notification.date}`;
    if (storage.getString(HANDLED_KEY) === key) return;
    storage.set(HANDLED_KEY, key);

    const data = (req.content.data ?? {}) as { habitId?: string; type?: string };
    const habit = data.habitId ? useApp.getState().habits[data.habitId] : undefined;
    Notifications.dismissNotificationAsync(req.identifier).catch(() => {});

    if (response.actionIdentifier === ACTION_DONE && habit) {
      completeHabit(habit.id, todayKey(), 'notification');
      useUI.getState().toast(`${habit.name} logged from your notification`, { emoji: '✅', tone: 'success' });
      return;
    }
    if (response.actionIdentifier === ACTION_SNOOZE && habit) {
      snoozeHabit(habit.id, 60);
      useUI.getState().toast(`Snoozed ${habit.name} for an hour`, { emoji: '⏰' });
      return;
    }
    if (habit) router.push(`/habit/${habit.id}`);
  }, [response, status]);
}
