import { deviceValues } from '@/domain/activity';
import type { DayKey } from '@/domain/dates';
import type { EntrySource, Habit } from '@/domain/types';
import { useApp } from '@/data/store';
import { applyAutoValues } from '@/features/habits/actions';
import { deviceData, sensingSupported } from '@/features/sensing';
import { fetchGithubDaily } from './github';
import { fetchHealthDaily, healthSupported } from './health';
import { fetchLeetcodeDaily, leetcodeSupported } from './leetcode';

/**
 * Auto-tracking engine: for every habit with an `auto` source, pull daily values from
 * the provider and merge them into entries. Runs on launch, on foreground and on demand;
 * throttled per provider so it stays cheap.
 */

const MIN_INTERVAL = 10 * 60_000;
const lastRun: Record<string, number> = {};
let running: Promise<number> | null = null;

/** Values from an integration, mapped onto the habit's unit (check habits: any activity = done). */
function normalize(habit: Habit, values: Record<DayKey, number>): Record<DayKey, number> {
  if (habit.kind !== 'check') return values;
  return Object.fromEntries(Object.entries(values).map(([d, v]) => [d, v > 0 ? habit.target : 0]));
}

async function fetchFor(habit: Habit): Promise<{ values: Record<DayKey, number>; source: EntrySource } | null> {
  const auto = habit.auto;
  if (!auto) return null;
  switch (auto.provider) {
    case 'github':
      return { values: await fetchGithubDaily(auto.username), source: 'github' };
    case 'leetcode':
      if (!leetcodeSupported) return null;
      return { values: await fetchLeetcodeDaily(auto.username), source: 'leetcode' };
    case 'health':
      if (!healthSupported) return null;
      return { values: await fetchHealthDaily(auto.metric, 30), source: 'health' };
    case 'device':
      if (!sensingSupported) return null;
      return {
        values: deviceValues(habit, await deviceData(30)),
        source: auto.metric === 'steps' ? 'device' : 'workout',
      };
  }
}

export async function syncHabitNow(habit: Habit): Promise<number> {
  const res = await fetchFor(habit);
  if (!res) return 0;
  return applyAutoValues(habit.id, normalize(habit, res.values), res.source);
}

export function runAutoTracking(
  opts: { reason: 'launch' | 'foreground' | 'manual' | 'background'; force?: boolean } = { reason: 'manual' },
) {
  if (running) return running;
  running = (async () => {
    const app = useApp.getState();
    const habits = Object.values(app.habits).filter((h) => h.auto && !h.deleted && !h.archived);
    let total = 0;
    const now = Date.now();
    // Group by provider+account so one fetch serves several habits.
    const cache = new Map<string, Promise<{ values: Record<DayKey, number>; source: EntrySource } | null>>();

    for (const habit of habits) {
      const auto = habit.auto!;
      const key =
        auto.provider === 'health'
          ? `health:${auto.metric}`
          : auto.provider === 'device'
            ? `device:${auto.metric}:${habit.kind}:${habit.unit ?? ''}`
            : `${auto.provider}:${auto.username.toLowerCase()}`;
      // On-device data is local and cheap, so it refreshes far more often than network providers.
      const interval = auto.provider === 'device' ? 30_000 : MIN_INTERVAL;
      if (!opts.force && now - (lastRun[key] ?? 0) < interval) continue;
      if (!cache.has(key)) cache.set(key, fetchFor(habit));
      try {
        const res = await cache.get(key)!;
        lastRun[key] = now;
        if (!res) continue;
        total += applyAutoValues(habit.id, normalize(habit, res.values), res.source);
        if (auto.provider !== 'device') markIntegration(auto.provider, null);
      } catch (e) {
        if (auto.provider !== 'device') markIntegration(auto.provider, e instanceof Error ? e.message : String(e));
      }
    }
    return total;
  })().finally(() => {
    running = null;
  });
  return running;
}

function markIntegration(provider: 'github' | 'leetcode' | 'health', error: string | null) {
  const app = useApp.getState();
  if (provider === 'health') {
    const current = app.integrations.health;
    app.setIntegration('health', { lastSyncAt: error ? (current?.lastSyncAt ?? null) : Date.now(), error });
    return;
  }
  const link = provider === 'github' ? app.integrations.github : app.integrations.leetcode;
  if (link) {
    app.setIntegration(provider, { ...link, lastSyncAt: error ? link.lastSyncAt : Date.now(), error });
  }
}
