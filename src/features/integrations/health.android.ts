import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { addDays, DayKey, dayKeyFromTimestamp, fromDayKey, todayKey } from '@/domain/dates';
import type { HealthMetric } from '@/domain/types';

/**
 * Android Health Connect → steps, workouts and sleep habits that complete themselves.
 * Works with any app that writes to Health Connect (Google Fit, Samsung Health, Fitbit,
 * Strava, Garmin Connect, …).
 */

export const healthSupported = true;

const PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
];

let initialized = false;
async function ensureInit() {
  if (!initialized) initialized = await initialize();
  return initialized;
}

export async function healthAvailability(): Promise<'available' | 'needs-install' | 'unsupported'> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-install';
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (!(await ensureInit())) return false;
  const granted = await requestPermission(PERMISSIONS);
  return granted.length > 0;
}

async function hasPermission(recordType: string) {
  const granted = await getGrantedPermissions();
  return granted.some((p) => p.recordType === recordType && p.accessType === 'read');
}

const iso = (d: Date) => d.toISOString();

/** Daily totals for the last `days` days: steps → count, exercise/sleep → minutes. */
export async function fetchHealthDaily(metric: HealthMetric, days: number): Promise<Record<DayKey, number>> {
  if (!(await ensureInit())) throw new Error('Health Connect is not available on this device.');
  const today = todayKey();
  const start = fromDayKey(addDays(today, -(days - 1)));
  const end = fromDayKey(addDays(today, 1));
  const out: Record<DayKey, number> = {};

  if (metric === 'sleep') {
    if (!(await hasPermission('SleepSession'))) throw new Error('Allow Ritual to read sleep in Health Connect.');
    // Attribute a night's sleep to the morning you woke up.
    const res = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: iso(new Date(start.getTime() - 86_400_000)),
        endTime: iso(end),
      },
    });
    for (const r of res.records) {
      const minutes = (Date.parse(r.endTime) - Date.parse(r.startTime)) / 60_000;
      const day = dayKeyFromTimestamp(Date.parse(r.endTime));
      out[day] = Math.round((out[day] ?? 0) + minutes);
    }
    return out;
  }

  const recordType = metric === 'steps' ? 'Steps' : 'ExerciseSession';
  if (!(await hasPermission(recordType))) {
    throw new Error(`Allow Ritual to read ${metric === 'steps' ? 'steps' : 'exercise'} in Health Connect.`);
  }
  const groups = await aggregateGroupByPeriod({
    recordType,
    timeRangeFilter: { operator: 'between', startTime: iso(start), endTime: iso(end) },
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });
  for (const g of groups) {
    const day = dayKeyFromTimestamp(Date.parse(g.startTime));
    const result = g.result as { COUNT_TOTAL?: number; EXERCISE_DURATION_TOTAL?: { inSeconds: number } };
    const value =
      metric === 'steps'
        ? (result.COUNT_TOTAL ?? 0)
        : Math.round((result.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0) / 60);
    if (value > 0) out[day] = value;
  }
  return out;
}
