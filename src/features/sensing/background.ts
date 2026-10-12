import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { todayKey } from '@/domain/dates';
import { runAutoTracking } from '@/features/integrations/engine';
import { storage } from '@/lib/storage';
import { rescheduleAll } from '@/features/notifications/scheduler';
import { importFinishedWorkouts, sensingSupported } from './index';

/**
 * Runs every ~15 minutes while the app is closed (Android WorkManager under the hood): pulls what
 * the phone sensed, completes habits, and refreshes reminders, so you aren't nagged to walk
 * after you already walked. Changes sync the next time the app opens.
 */
export const BACKGROUND_TASK = 'ritual-background-sense';

const PLANNED_DAY = 'bg.plannedDay';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    importFinishedWorkouts();
    const changed = await runAutoTracking({ reason: 'background', force: true });
    // Re-plan when data changed, and at least once a day, so the coach notices a lapse (and
    // switches to a gentle fresh-start tone) even if the app hasn't been opened for days.
    const today = todayKey();
    if (changed || storage.getString(PLANNED_DAY) !== today) {
      await rescheduleAll();
      storage.set(PLANNED_DAY, today);
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSensing() {
  if (!sensingSupported) return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 15 });
  } catch {
    // background execution unavailable (e.g. restricted by the OS) — foreground sync still works
  }
}
