import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runAutoTracking } from '@/features/integrations/engine';
import { rescheduleAll } from '@/features/notifications/scheduler';
import { importFinishedWorkouts, sensingSupported } from './index';

/**
 * Runs every ~15 minutes while the app is closed (Android WorkManager under the hood): pulls what
 * the phone sensed, completes habits, and refreshes reminders, so you aren't nagged to walk
 * after you already walked. Changes sync the next time the app opens.
 */
export const BACKGROUND_TASK = 'ritual-background-sense';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    importFinishedWorkouts();
    const changed = await runAutoTracking({ reason: 'background', force: true });
    if (changed) await rescheduleAll();
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
