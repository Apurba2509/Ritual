import { PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';
import { dailyMinutes, segmentsFromEvents, type Segment } from '@/domain/activity';
import { DayKey, toDayKey, todayKey } from '@/domain/dates';
import type { Workout, WorkoutType } from '@/domain/types';
import { useApp } from '@/data/store';
import { FinishedWorkout, LiveWorkout, RitualSensing, SensingCapabilities } from './native';

/**
 * On-device sensing — the part of Ritual that works with the app closed, offline and without GPS:
 *   • steps: the hardware step counter, snapshotted every ~15 min by a background worker
 *   • activity: Android's activity recognition notices walks, runs and rides on its own
 *   • workouts: a GPS + barometer + step recorder running as a foreground service
 * Everything is collected natively and interpreted in domain/activity.ts.
 */

export const sensingSupported = !!RitualSensing;

export type { LiveWorkout, SensingCapabilities };

export function capabilities(): SensingCapabilities | null {
  try {
    return RitualSensing?.capabilities() ?? null;
  } catch {
    return null;
  }
}

async function request(
  permission: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS],
) {
  if (Platform.OS !== 'android') return false;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

export const requestActivityPermission = () =>
  Platform.OS === 'android' && Number(Platform.Version) < 29
    ? Promise.resolve(true)
    : request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);

export const requestLocationPermission = () => request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

/** Turn on background step counting and activity detection. */
export async function enableAutoSensing(): Promise<{ steps: boolean; activity: boolean }> {
  if (!RitualSensing) return { steps: false, activity: false };
  if (!(await requestActivityPermission())) return { steps: false, activity: false };
  const [steps, activity] = await Promise.all([
    RitualSensing.enableStepTracking().catch(() => false),
    RitualSensing.enableActivityDetection().catch(() => false),
  ]);
  await refreshSensing();
  return { steps, activity };
}

export function disableAutoSensing() {
  RitualSensing?.disableStepTracking();
  RitualSensing?.disableActivityDetection();
  refreshSensing();
}

export function openBatterySettings() {
  RitualSensing?.openBatterySettings();
}

// ─── Reading data ───────────────────────────────────────────────────────────

export async function dailySteps(days = 30): Promise<Record<DayKey, number>> {
  if (!RitualSensing || !capabilities()?.stepsEnabled) return {};
  return RitualSensing.dailySteps(days).catch(() => ({}));
}

export function activitySegments(sinceMs: number): Segment[] {
  if (!RitualSensing) return [];
  try {
    return segmentsFromEvents(RitualSensing.activityEvents(sinceMs), Date.now());
  } catch {
    return [];
  }
}

export function workoutList(): Workout[] {
  return Object.values(useApp.getState().workouts).filter((w) => !w.deleted);
}

/** Everything the auto-tracking engine needs to compute device-tracked habits. */
export async function deviceData(days = 30) {
  importFinishedWorkouts();
  return {
    steps: await dailySteps(days),
    workouts: workoutList(),
    segments: activitySegments(Date.now() - days * 86_400_000),
  };
}

// ─── Workouts ───────────────────────────────────────────────────────────────

function toWorkout(f: FinishedWorkout): Workout {
  return {
    id: f.id,
    type: f.type,
    date: toDayKey(new Date(f.startedAt)),
    startedAt: f.startedAt,
    endedAt: f.endedAt,
    movingSec: f.movingSec,
    distanceM: f.distanceM,
    distanceSource: f.distanceSource,
    elevationGainM: f.elevationGainM,
    elevationSource: f.elevationSource,
    steps: f.steps,
    splits: f.splits ?? [],
    route: f.route ?? null,
    elevationProfile: f.elevationProfile ?? [],
    updatedAt: Date.now(),
  };
}

/** Pull workouts finished natively (including ones stopped from the notification). */
export function importFinishedWorkouts(): Workout[] {
  if (!RitualSensing) return [];
  let finished: FinishedWorkout[] = [];
  try {
    finished = RitualSensing.consumeFinishedWorkouts();
  } catch {
    return [];
  }
  const list = finished.map(toWorkout);
  if (list.length) useApp.getState().saveWorkouts(list);
  return list;
}

export async function startWorkout(type: WorkoutType): Promise<'gps' | 'steps-only' | 'denied'> {
  if (!RitualSensing) return 'denied';
  const location = await requestLocationPermission();
  const activity = await requestActivityPermission();
  if (!location && !activity) return 'denied';
  RitualSensing.startWorkout(type);
  return location ? 'gps' : 'steps-only';
}

export const pauseWorkout = () => RitualSensing?.pauseWorkout();
export const resumeWorkout = () => RitualSensing?.resumeWorkout();
export const discardWorkout = () => RitualSensing?.discardWorkout();

export function liveWorkout(): LiveWorkout | null {
  try {
    return RitualSensing?.workoutState() ?? null;
  } catch {
    return null;
  }
}

/** Stop recording and save. Returns the saved workout (null if it was too short to keep). */
export function finishWorkout(): Workout | null {
  if (!RitualSensing) return null;
  RitualSensing.finishWorkout();
  const saved = importFinishedWorkouts();
  return saved[saved.length - 1] ?? null;
}

// ─── Today's movement, for the UI ───────────────────────────────────────────

interface SensingState {
  caps: SensingCapabilities | null;
  stepsToday: number | null;
  activeMinutesToday: number;
  refreshedAt: number;
}

export const useSensing = create<SensingState>(() => ({
  caps: null,
  stepsToday: null,
  activeMinutesToday: 0,
  refreshedAt: 0,
}));

export async function refreshSensing() {
  if (!sensingSupported) return;
  const caps = capabilities();
  const today = todayKey();
  const steps = caps?.stepsEnabled ? await dailySteps(1) : {};
  const segments = activitySegments(Date.now() - 86_400_000);
  const workouts = workoutList();
  const minutes = (['walk', 'run', 'ride'] as WorkoutType[]).reduce(
    (sum, type) => sum + (dailyMinutes(type, workouts, segments)[today] ?? 0),
    0,
  );
  useSensing.setState({
    caps,
    stepsToday: caps?.stepsEnabled ? (steps[today] ?? 0) : null,
    activeMinutesToday: minutes,
    refreshedAt: Date.now(),
  });
}
