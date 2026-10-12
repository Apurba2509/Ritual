// On-device sensing is Android-only; the web build gets the same types and a null module.
export type { AppInfo, FinishedWorkout, LiveWorkout, PauseEvent, ScreenDay, SensingCapabilities } from './native';

export const RitualSensing = null;
