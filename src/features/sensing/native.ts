import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/** Shape of modules/ritual-sensing (Android). */
export interface SensingCapabilities {
  stepCounter: boolean;
  barometer: boolean;
  activityPermission: boolean;
  locationPermission: boolean;
  stepsEnabled: boolean;
  activityDetectionEnabled: boolean;
  batteryUnrestricted: boolean;
  /** ms epoch of the last step-counter reading (0 = never). */
  lastStepSnapshotAt: number;
  workoutActive: boolean;
  usageAccess: boolean;
  screenTimeEnabled: boolean;
  pauseServiceEnabled: boolean;
  sdk: number;
  manufacturer: string;
}

/** One day of phone use, reconstructed from Android's usage log. */
export interface ScreenDay {
  day: string;
  totalMs: number;
  pickups: number;
  firstPickupAt: number;
  lastUseAt: number;
  longestMs: number;
  /** ms per hour of the day (24 buckets) */
  hourly: number[];
  apps: { pkg: string; ms: number; opens: number }[];
  /** The day is over (not today). */
  final: boolean;
  /** From Android's daily totals because the event log was empty (no hourly detail). */
  estimated?: boolean;
}

export interface AppInfo {
  pkg: string;
  label: string;
  category: 'social' | 'video' | 'game' | 'news' | 'audio' | 'image' | 'maps' | 'productivity' | 'other';
  distracting: boolean;
  /** data: URI (PNG) */
  icon?: string;
}

export interface PauseEvent {
  t: number;
  type: 'shown' | 'timesup' | 'closed' | 'left' | 'opened' | 'swap';
  pkg: string;
  intent?: string;
  minutes?: number;
  habitId?: string;
}

export interface LiveWorkout {
  id: string;
  type: 'walk' | 'run' | 'ride';
  startedAt: number;
  paused: boolean;
  movingSec: number;
  distanceM: number;
  distanceSource: 'gps' | 'steps' | 'none';
  paceSecPerKm: number | null;
  elevationGainM: number;
  elevationSource: 'barometer' | 'gps' | 'none';
  steps: number;
  gpsStatus: 'searching' | 'strong' | 'ok' | 'weak' | 'lost';
  splits: number[];
  /** Flat [lat, lon, lat, lon, …] */
  route: number[];
}

export interface FinishedWorkout {
  id: string;
  type: 'walk' | 'run' | 'ride';
  startedAt: number;
  endedAt: number;
  movingSec: number;
  distanceM: number;
  distanceSource: 'gps' | 'steps' | 'none';
  elevationGainM: number;
  elevationSource: 'barometer' | 'gps' | 'none';
  steps: number;
  splits: number[];
  route: string | null;
  elevationProfile: number[];
}

interface RitualSensingNative {
  capabilities(): SensingCapabilities;
  enableStepTracking(): Promise<boolean>;
  disableStepTracking(): void;
  dailySteps(days: number): Promise<Record<string, number>>;
  enableActivityDetection(): Promise<boolean>;
  disableActivityDetection(): void;
  activityEvents(sinceMs: number): { type: 'walk' | 'run' | 'ride' | 'other'; enter: boolean; t: number }[];
  startWorkout(type: string): void;
  pauseWorkout(): void;
  resumeWorkout(): void;
  finishWorkout(): FinishedWorkout | null;
  discardWorkout(): void;
  workoutState(): LiveWorkout | null;
  consumeFinishedWorkouts(): FinishedWorkout[];
  openBatterySettings(): void;
  openUsageAccessSettings(): void;
  setScreenTimeEnabled(on: boolean): void;
  screenDays(days: number): Promise<ScreenDay[]>;
  appInfo(pkgs: string[], withIcons: boolean): Promise<AppInfo[]>;
  distractingApps(withIcons: boolean): Promise<AppInfo[]>;
  setPauseConfig(json: string): void;
  pauseEvents(sinceMs: number): PauseEvent[];
  openAccessibilitySettings(): void;
  openAppDetails(): void;
  previewPause(pkg: string): void;
  openAutostartSettings(): boolean;
}

export const RitualSensing: RitualSensingNative | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<RitualSensingNative>('RitualSensing') : null;
