import { create } from 'zustand';
import { tinyVersion } from '@/domain/behavior';
import { PauseEventData, ScreenDayData } from '@/domain/screen';
import { GuardConfig, useApp } from '@/data/store';
import type { AppInfo } from '@/features/sensing/native';
import { RitualSensing } from '@/features/sensing/native';

/**
 * Screen time + mindful pause (Android). The phone records usage itself; we read it on demand
 * and when the background worker runs, so tracking continues with the app closed and offline.
 */

export const screenSupported = !!RitualSensing;

interface ScreenState {
  days: ScreenDayData[];
  apps: Record<string, AppInfo>;
  /** Installed social / video / game apps, suggested for guarding. */
  suggested: AppInfo[];
  events: PauseEventData[];
  access: boolean;
  serviceOn: boolean;
  loadedAt: number;
}

export const useScreen = create<ScreenState>(() => ({
  days: [],
  apps: {},
  suggested: [],
  events: [],
  access: false,
  serviceOn: false,
  loadedAt: 0,
}));

function caps() {
  try {
    return RitualSensing?.capabilities() ?? null;
  } catch {
    return null;
  }
}

/** Re-read permissions (call when the app returns from Settings). */
export function refreshScreenStatus() {
  const c = caps();
  useScreen.setState({ access: !!c?.usageAccess, serviceOn: !!c?.pauseServiceEnabled });
  return c;
}

let inflight: Promise<ScreenDayData[]> | null = null;

/** Usage for the last `count` days (oldest first). Cheap to call; de-duplicated while running. */
export function screenDays(count = 7): Promise<ScreenDayData[]> {
  if (!RitualSensing || !caps()?.usageAccess) return Promise.resolve([]);
  inflight ??= RitualSensing.screenDays(count)
    .then((d) => d as ScreenDayData[])
    .catch(() => [])
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function refreshScreen(count = 7) {
  const c = refreshScreenStatus();
  if (!RitualSensing || !c?.usageAccess) return;
  const days = await screenDays(count);
  const pkgs = new Set<string>(useApp.getState().guard.apps);
  for (const d of days.slice(-3)) for (const a of d.apps.slice(0, 12)) pkgs.add(a.pkg);
  const known = useScreen.getState().apps;
  const missing = [...pkgs].filter((p) => !known[p]);
  let apps = known;
  if (missing.length) {
    const info = await RitualSensing.appInfo(missing, true).catch(() => [] as AppInfo[]);
    apps = { ...known, ...Object.fromEntries(info.map((i) => [i.pkg, i])) };
  }
  const since = Date.now() - 8 * 86_400_000;
  let events: PauseEventData[] = [];
  try {
    events = RitualSensing.pauseEvents(since) as PauseEventData[];
  } catch {
    // older native build
  }
  let suggested = useScreen.getState().suggested;
  if (!suggested.length) {
    suggested = await (RitualSensing.distractingApps?.(true) ?? Promise.resolve([])).catch(() => [] as AppInfo[]);
    apps = { ...apps, ...Object.fromEntries(suggested.map((i) => [i.pkg, i])) };
  }
  useScreen.setState({ days, apps, suggested, events, loadedAt: Date.now() });
}

/** Turn screen time on: ask for Usage access (opens Settings) and keep finished days cached. */
export function enableScreenTime(): boolean {
  if (!RitualSensing) return false;
  RitualSensing.setScreenTimeEnabled(true);
  if (!caps()?.usageAccess) {
    RitualSensing.openUsageAccessSettings();
    return false;
  }
  return true;
}

export function openPauseSettings() {
  RitualSensing?.openAccessibilitySettings();
}

export function openAppDetails() {
  RitualSensing?.openAppDetails();
}

export function previewPause(pkg: string) {
  RitualSensing?.previewPause(pkg);
}

/** Push the guard config to the native side (the pause runs without the JS app). */
export function syncPauseConfig(guard: GuardConfig = useApp.getState().guard) {
  if (!RitualSensing) return;
  const habit = guard.swapHabitId ? useApp.getState().habits[guard.swapHabitId] : null;
  const swap =
    habit && !habit.deleted && !habit.archived
      ? { habitId: habit.id, name: habit.name, label: tinyVersion(habit).label }
      : null;
  RitualSensing.setPauseConfig(
    JSON.stringify({
      enabled: guard.enabled,
      apps: guard.apps,
      catchups: guard.catchups,
      bedtime: guard.bedtime,
      allowMinutes: guard.allowMinutes,
      swap,
    }),
  );
}

export function updateGuard(patch: Partial<GuardConfig>) {
  useApp.getState().updateGuard(patch);
  syncPauseConfig();
}

/**
 * On Android 13+, apps installed outside the Play Store must be allowed "restricted settings"
 * before an accessibility service can be turned on.
 */
export function needsRestrictedSettingsStep(): boolean {
  return (caps()?.sdk ?? 0) >= 33;
}
