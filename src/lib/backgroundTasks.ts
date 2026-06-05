import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { scheduleDailyReminder } from './notifications';
import { useHabitStore } from '../stores/habitStore';

const STREAK_AT_RISK_TASK = 'STREAK_AT_RISK_TASK';

TaskManager.defineTask(STREAK_AT_RISK_TASK, async () => {
  try {
    const { habits, completions } = useHabitStore.getState();
    const today = new Date().toISOString().split('T')[0];

    // Simple logic: check if there are habits due today that are not completed
    // and have a streak > 0
    let atRisk = false;
    
    // In a real scenario, we'd calculate streaks or check habit states
    // This is a placeholder for the logic
    for (const habit of Object.values(habits)) {
      if (habit.is_active) {
        const key = `${habit.id}_${today}`;
        if (!completions[key]) {
          atRisk = true;
          break;
        }
      }
    }

    if (atRisk) {
      // Schedule an immediate warning or schedule for later evening
      await scheduleDailyReminder(20, 0, "Don't break your streak! 🔥");
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Background task failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTasks() {
  try {
    await BackgroundFetch.registerTaskAsync(STREAK_AT_RISK_TASK, {
      minimumInterval: 60 * 60 * 4, // 4 hours
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("Background fetch registered");
  } catch (err) {
    console.log("Background fetch registration failed:", err);
  }
}
