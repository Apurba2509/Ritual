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
}

export const RitualSensing: RitualSensingNative | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<RitualSensingNative>('RitualSensing') : null;
