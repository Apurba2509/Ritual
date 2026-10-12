import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { todayKey } from '@/domain/dates';
import { isEntryDone, targetLabel } from '@/domain/habits';
import { tinyVersion } from '@/domain/behavior';
import { PersonalSignals, PlannedKind, planNotifications } from '@/domain/notifications';
import type { Habit } from '@/domain/types';
import { getBehavior, getSnapshot } from '@/data/hooks';
import { useApp } from '@/data/store';
import { useSensing } from '@/features/sensing';

/**
 * Local notifications, planned by domain/notifications and rebuilt whenever habits, entries or
 * settings change. Everything is a one-off DATE notification for the next few days, so nothing
 * stale fires: finish a habit and its nudges are gone.
 */

export const CATEGORY_HABIT = 'habitreminder';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';

const CHANNELS = {
  reminders: 'reminders',
  coach: 'coach',
  auto: 'autotracking',
} as const;

const OWNED_PREFIXES = ['habit:', 'nudge:', 'brief:', 'midday:', 'move:', 'evening:', 'lastcall:', 'weekly:'];
// Android allows ~500 pending alarms per app; iOS caps at 64. Stay well under both.
const MAX_PENDING = 60;

const supported = Platform.OS !== 'web';

const channelFor = (kind: PlannedKind) =>
  kind === 'reminder' || kind === 'lastcall' ? CHANNELS.reminders : CHANNELS.coach;

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
    await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
      name: 'Habit reminders',
      description: 'The times you set for your habits, and streak-saving last calls',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#D4FF3F',
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.coach, {
      name: 'Coaching',
      description: 'Morning brief, check-ins, movement nudges and weekly recap',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      lightColor: '#D4FF3F',
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.auto, {
      name: 'Auto-tracking',
      description: 'When a habit completes itself from your phone, GitHub or LeetCode',
      importance: Notifications.AndroidImportance.LOW,
      lightColor: '#D4FF3F',
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_HABIT, [
    { identifier: ACTION_DONE, buttonTitle: 'Done', options: { opensAppToForeground: true } },
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
      .filter((n) => OWNED_PREFIXES.some((p) => n.identifier.startsWith(p)))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
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
  const streaks = new Map(
    [...snap.habitStats.entries()].map(([id, s]) => [id, { current: s.streak.current, atRisk: s.streak.atRisk }]),
  );
  const { settings } = app;
  const plan = planNotifications({
    habits: Object.values(app.habits),
    index: snap.index,
    streaks,
    today,
    now: Date.now(),
    weekStart: settings.weekStart,
    style: settings.notifyStyle ?? 'coach',
    morningBrief: settings.morningBrief,
    eveningNudge: settings.eveningNudge,
    quietHours: settings.quietHours?.enabled ? settings.quietHours : null,
    stepsToday: useSensing.getState().stepsToday,
    personal: personalSignals(snap),
  });

  for (const n of plan.slice(0, MAX_PENDING)) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        title: n.title,
        body: n.body,
        sound: true,
        // Habit-specific pings get Done / Snooze buttons right in the notification.
        ...(n.habitId ? { categoryIdentifier: CATEGORY_HABIT } : {}),
        data: { type: n.kind, habitId: n.habitId, day: n.day },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: channelFor(n.kind) },
    });
  }
}

/** A habit just completed itself (sensors, GitHub, LeetCode) — say so if the app isn't open. */
/** Feed the planner what the behaviour engine has learned about this person. */
function personalSignals(snap: ReturnType<typeof getSnapshot>): PersonalSignals {
  const { patterns, user } = getBehavior(snap);
  const app = useApp.getState();
  const usualTime = new Map<string, string>();
  const missedYesterday = new Set<string>();
  const tiny = new Map<string, string>();
  for (const [id, p] of patterns) {
    if (p.usualTime) usualTime.set(id, p.usualTime);
    if (p.missedYesterday && p.missRun <= 2) missedYesterday.add(id);
    const h = app.habits[id];
    if (h) tiny.set(id, tinyVersion(h).label);
  }
  return {
    usualTime,
    missedYesterday,
    tiny,
    mood: user.mood,
    easy: !!app.easyUntil && app.easyUntil >= snap.today,
  };
}

export async function notifyAutoComplete(habit: Habit, detail: string, opts: { title?: string } = {}) {
  if (!supported || !useApp.getState().settings.autoAlerts) return;
  if ((await notificationPermission()) !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    identifier: `auto:${habit.id}:${todayKey()}${opts.title ? ':alt' : ''}`,
    content: {
      title: opts.title ?? `${habit.name} · done`,
      body: detail,
      data: { type: 'auto', habitId: habit.id },
    },
    trigger: { channelId: CHANNELS.auto },
  });
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
  await Notifications.scheduleNotificationAsync({
    identifier: `test:${Date.now()}`,
    content: {
      title: habit.name,
      body: `${targetLabel(habit)} today. Tap Done when it's finished.`,
      categoryIdentifier: CATEGORY_HABIT,
      data: { type: 'reminder', habitId: habit.id, day: today },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CHANNELS.reminders,
    },
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
      title: h.name,
      body: 'Snoozed reminder. Ready now?',
      categoryIdentifier: CATEGORY_HABIT,
      data: { type: 'reminder', habitId, day: todayKey() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      channelId: CHANNELS.reminders,
    },
  });
}

/** One-shot local notification, e.g. when a focus session ends in the background. */
export async function scheduleAt(identifier: string, date: Date, title: string, body: string) {
  if (!supported) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: true, data: { type: 'focus' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNELS.reminders },
  });
}

export async function cancelNotification(identifier: string) {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}
