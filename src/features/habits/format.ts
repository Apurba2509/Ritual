import type { AutoSource, Habit } from '@/domain/types';
import type { IconName } from '@/ui/icons';

export function formatAmount(habit: Pick<Habit, 'kind' | 'unit'>, value: number): string {
  if (habit.kind === 'duration') {
    if (value >= 60) {
      const h = Math.floor(value / 60);
      const m = Math.round(value % 60);
      return m ? `${h}h ${m}m` : `${h}h`;
    }
    return `${Math.round(value)} min`;
  }
  if (habit.kind === 'count') {
    const n =
      value >= 10000
        ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
        : (Math.round(value * 10) / 10).toLocaleString();
    if (!habit.unit) return n;
    const unit = value === 1 && /[^s]s$/.test(habit.unit) ? habit.unit.slice(0, -1) : habit.unit;
    return `${n} ${unit}`;
  }
  return value > 0 ? 'Done' : '—';
}

/** Compact "done / target" label, e.g. "800 / 8,000 steps" or "15 / 30 min". */
export function formatProgress(habit: Pick<Habit, 'kind' | 'unit' | 'target'>, value: number): string {
  if (habit.kind === 'duration') {
    return habit.target >= 60
      ? `${formatAmount(habit, value)} / ${formatAmount(habit, habit.target)}`
      : `${Math.round(value)} / ${habit.target} min`;
  }
  if (habit.kind === 'count') {
    const n =
      value >= 10000
        ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
        : (Math.round(value * 10) / 10).toLocaleString();
    return `${n} / ${formatAmount(habit, habit.target)}`;
  }
  return value > 0 ? 'Done' : 'Not yet';
}

/** Sensible "+1" step: 1 for small targets, ~10% for big ones (e.g. 8,000 steps → +500). */
export function stepFor(habit: Pick<Habit, 'kind' | 'target'>): number {
  if (habit.kind === 'duration') return habit.target >= 60 ? 15 : 5;
  if (habit.target <= 20) return 1;
  const raw = habit.target / 10;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.max(1, Math.round(raw / mag) * mag);
}

export function autoLabel(auto: AutoSource | null): string | null {
  if (!auto) return null;
  switch (auto.provider) {
    case 'github':
      return 'GitHub';
    case 'leetcode':
      return 'LeetCode';
    case 'health':
      return auto.metric === 'steps' ? 'Steps' : auto.metric === 'sleep' ? 'Sleep' : 'Workouts';
    case 'device':
      return auto.metric === 'steps'
        ? 'Phone steps'
        : auto.metric === 'run'
          ? 'Runs'
          : auto.metric === 'ride'
            ? 'Rides'
            : 'Walks';
  }
}

export function autoIcon(auto: AutoSource | null): IconName | null {
  if (!auto) return null;
  switch (auto.provider) {
    case 'github':
      return 'github-logo';
    case 'leetcode':
      return 'code';
    case 'health':
      return auto.metric === 'steps' ? 'footprints' : auto.metric === 'sleep' ? 'moon-stars' : 'heartbeat';
    case 'device':
      return auto.metric === 'steps'
        ? 'footprints'
        : auto.metric === 'run'
          ? 'person-simple-run'
          : auto.metric === 'ride'
            ? 'person-simple-bike'
            : 'person-simple-walk';
  }
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function timeAgo(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const MOODS: { value: 1 | 2 | 3 | 4 | 5; icon: IconName; label: string }[] = [
  { value: 1, icon: 'smiley-sad', label: 'Rough' },
  { value: 2, icon: 'smiley-meh', label: 'Meh' },
  { value: 3, icon: 'smiley-blank', label: 'Okay' },
  { value: 4, icon: 'smiley', label: 'Good' },
  { value: 5, icon: 'smiley-wink', label: 'Great' },
];
