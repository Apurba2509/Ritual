import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ACHIEVEMENT_BY_ID } from '@/domain/achievements';
import { useSnapshot } from '@/data/hooks';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { sync } from '@/data/sync';
import { useUI } from '@/data/ui';
import { runAutoTracking } from './integrations/engine';
import { rescheduleSoon } from './notifications/scheduler';
import { postActivity } from './social/api';

/** Achievement unlocks & level-ups are derived from the snapshot and celebrated once. */
export function useGamificationWatcher() {
  const snapshot = useSnapshot();
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (status !== 'ready') return;
    const app = useApp.getState();
    const ui = useUI.getState();
    const ids = snapshot.newlyUnlocked;
    if (ids.length) {
      app.markUnlocked(ids);
      if (ids.length <= 2) {
        for (const id of ids) {
          ui.celebrate({ kind: 'achievement', id });
          const a = ACHIEVEMENT_BY_ID.get(id);
          if (a) postActivity({ type: 'achievement', emoji: a.emoji, text: `unlocked “${a.title}”` });
        }
      } else {
        ui.toast(`${ids.length} achievements unlocked`, { emoji: '🏅', tone: 'success' });
      }
    }
    const level = snapshot.level.level;
    if (level > app.lastLevelSeen) {
      if (level - app.lastLevelSeen <= 2) {
        ui.burst();
        ui.celebrate({ kind: 'level', level });
        postActivity({ type: 'level', emoji: '⚡', text: `reached level ${level}` });
      }
      app.setLastLevelSeen(level);
    }
  }, [snapshot, status]);
}

/** Foreground housekeeping: refresh reminders, flush sync, pull integrations. */
export function useForegroundTasks() {
  const status = useSession((s) => s.status);
  useEffect(() => {
    if (status !== 'ready') return;
    rescheduleSoon(800);
    runAutoTracking({ reason: 'launch' });
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      rescheduleSoon(800);
      sync.flush();
      runAutoTracking({ reason: 'foreground' });
    });
    const unsubHabits = useApp.subscribe((s, prev) => {
      if (s.habits !== prev.habits || s.settings !== prev.settings) rescheduleSoon();
    });
    return () => {
      sub.remove();
      unsubHabits();
    };
  }, [status]);
}

export { useNotificationResponses } from './notifications/responses';
