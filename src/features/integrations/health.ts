import type { DayKey } from '@/domain/dates';
import type { HealthMetric } from '@/domain/types';

/** Health data is Android-only (Health Connect) — see health.android.ts. */
export const healthSupported = false;

export async function healthAvailability(): Promise<'available' | 'needs-install' | 'unsupported'> {
  return 'unsupported';
}

export async function requestHealthPermissions(): Promise<boolean> {
  return false;
}

export async function fetchHealthDaily(_metric: HealthMetric, _days: number): Promise<Record<DayKey, number>> {
  return {};
}
