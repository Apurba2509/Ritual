import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, fromDayKey, todayKey } from '@/domain/dates';
import { isDueOn, isEntryDone, targetLabel } from '@/domain/habits';
import type { Habit } from '@/domain/types';
import { getSnapshot } from '@/data/hooks';
import { useApp } from '@/data/store';

/**
 * Reminders are scheduled as one-off DATE notifications for the next few days, rebuilt
 * whenever habits or entries change. That makes them *smart*: a reminder for a habit
 * you've already finished today simply isn't there, and the evening nudge knows how
 * many habits are left and how long your streak is.
 */

export const CATEGORY_HABIT = 'habit-reminder';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';
const CHANNEL = 'reminders';
const PREFIXES = ['habit:', 'brief:', 'evening:'];
const MAX_PENDING = 56; // iOS caps pending local notifications at 64

const supported = Platform.OS !== 'web';

export async function setupNotifications() {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Habit reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#FF6A3D',
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_HABIT, [
    { identifier: ACTION_DONE, buttonTitle: '✓ Done', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 1h', options: { opensAppToForeground: true } },
  ]);
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!supported) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function cancelAllReminders() {
  if (!supported) return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => PREFIXES.some((p) => n.identifier.startsWith(p)))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

function at(day: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = fromDayKey(day);
  d.setHours(h, m, 0, 0);
  return d;
}

const pickLine = (lines: string[], seed: number) => lines[seed % lines.length];

function reminderBody(habit: Habit, streak: number, seed: number) {
  if (streak >= 3) {
    return pickLine(
      [
        `Day ${streak + 1} is waiting. Keep the chain going 🔗`,
        `${streak}-day streak on the line — two minutes is enough to keep it.`,
        `You've shown up ${streak} times in a row. Make it ${streak + 1}.`,
      ],
      seed,
    );
  }
  return pickLine(
    [
      `Target: ${targetLabel(habit)}. Tap ✓ Done when it's finished.`,
      `Small reps, big results. Time for ${habit.name.toLowerCase()}.`,
      `Future you will thank you. ${targetLabel(habit)} today.`,
    ],
    seed,
  );
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced rebuild — call after anything that could change what should fire. */
export function rescheduleSoon(delay = 1500) {
  if (!supported) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    rescheduleAll().catch((e) => __DEV__ && console.warn('[notifications]', e));
  }, delay);
}

export async function rescheduleAll() {
  if (!supported) return;
  if ((await notificationPermission()) !== 'granted') return;
  await cancelAllReminders();

  const app = useApp.getState();
  const today = todayKey();
  const snap = getSnapshot(today);
  const now = Date.now();
  const habits = Object.values(app.habits).filter((h) => !h.deleted && !h.archived);
  const queue: Notifications.NotificationRequestInput[] = [];
  const reminderCount = habits.reduce((n, h) => n + h.reminders.length, 0);
  const horizon = Math.max(1, Math.min(7, Math.floor((MAX_PENDING - 14) / Math.max(1, reminderCount))));

  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    const dueHabits = habits.filter((h) => isDueOn(h, snap.index.get(h.id), day, app.settings.weekStart));

    // Per-habit reminders
    if (i < horizon) {
      for (const h of dueHabits) {
        const done = isEntryDone(h, snap.index.get(h.id)?.get(day));
        if (done) continue;
        const streak = snap.habitStats.get(h.id)?.streak.current ?? 0;
        for (const time of h.reminders) {
          const when = at(day, time);
          if (when.getTime() <= now + 30_000) continue;
          queue.push({
            identifier: `habit:${h.id}:${day}:${time}`,
            content: {
              title: `${h.emoji} ${h.name}`,
              body: reminderBody(h, streak, when.getDate() + h.name.length),
              categoryIdentifier: CATEGORY_HABIT,
              data: { type: 'habit', habitId: h.id, day },
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
          });
        }
      }
    }

    // Morning brief
    if (app.settings.morningBrief.enabled && dueHabits.length) {
      const when = at(day, app.settings.morningBrief.time);
      if (when.getTime() > now + 30_000) {
        const best = snap.bestStreak.days;
        queue.push({
          identifier: `brief:${day}`,
          content: {
            title: i === 0 ? 'Your ritual for today ☀️' : 'Good morning ☀️',
            body: `${dueHabits.length} habit${dueHabits.length > 1 ? 's' : ''} lined up${best >= 2 ? ` · best streak ${best} days 🔥` : ''}. ${dueHabits
              .slice(0, 3)
              .map((h) => h.emoji)
              .join(' ')}`,
            data: { type: 'brief' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
        });
      }
    }

    // Evening nudge — only when something is still open.
    if (app.settings.eveningNudge.enabled && dueHabits.length) {
      const when = at(day, app.settings.eveningNudge.time);
      const open = i === 0 ? dueHabits.filter((h) => !isEntryDone(h, snap.index.get(h.id)?.get(day))) : dueHabits;
      if (when.getTime() > now + 30_000 && open.length) {
        const atRisk = i === 0 ? open.filter((h) => snap.habitStats.get(h.id)?.streak.atRisk) : [];
        const longest = atRisk.reduce((m, h) => Math.max(m, snap.habitStats.get(h.id)?.streak.current ?? 0), 0);
        queue.push({
          identifier: `evening:${day}`,
          content: {
            title: longest >= 2 ? `🔥 ${longest}-day streak at risk` : 'Still time today',
            body:
              i === 0
                ? `${open.length} left: ${open
                    .slice(0, 3)
                    .map((h) => `${h.emoji} ${h.name}`)
                    .join(', ')}${open.length > 3 ? '…' : ''}`
                : 'Check in before the day ends to keep your streaks alive.',
            data: { type: 'evening' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
        });
      }
    }
  }

  queue.sort((a, b) => +(a.trigger as { date: Date }).date - +(b.trigger as { date: Date }).date);
  for (const req of queue.slice(0, MAX_PENDING)) {
    await Notifications.scheduleNotificationAsync(req);
  }
}

/** Demo/QA helper: fire a real habit reminder (with action buttons) in a few seconds. */
export async function sendTestReminder(): Promise<string | null> {
  if (!supported) return null;
  const app = useApp.getState();
  const today = todayKey();
  const snap = getSnapshot(today);
  const habits = Object.values(app.habits).filter((h) => !h.deleted && !h.archived);
  const habit = habits.find((h) => !isEntryDone(h, snap.index.get(h.id)?.get(today))) ?? habits[0];
  if (!habit) return null;
  const streak = snap.habitStats.get(habit.id)?.streak.current ?? 0;
  await Notifications.scheduleNotificationAsync({
    identifier: `test:${Date.now()}`,
    content: {
      title: `${habit.emoji} ${habit.name}`,
      body: reminderBody(habit, streak, Date.now()),
      categoryIdentifier: CATEGORY_HABIT,
      data: { type: 'habit', habitId: habit.id, day: today },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return habit.name;
}

export async function snoozeHabit(habitId: string, minutes = 60) {
  if (!supported) return;
  const h = useApp.getState().habits[habitId];
  if (!h) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze:${habitId}:${Date.now()}`,
    content: {
      title: `${h.emoji} ${h.name}`,
      body: 'Snoozed reminder — ready now?',
      categoryIdentifier: CATEGORY_HABIT,
      data: { type: 'habit', habitId, day: todayKey() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      channelId: CHANNEL,
    },
  });
}

/** One-shot local notification, e.g. when a focus session ends in the background. */
export async function scheduleAt(identifier: string, date: Date, title: string, body: string) {
  if (!supported) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: true, data: { type: 'focus' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
  });
}

export async function cancelNotification(identifier: string) {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}
