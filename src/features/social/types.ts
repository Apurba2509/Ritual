import type { DayKey } from '@/domain/dates';
import type { HabitKind, Schedule } from '@/domain/types';

export interface PublicProfile {
  uid: string;
  username: string;
  displayName: string;
  avatar: { emoji: string; color: string; photoUrl?: string | null };
  bio: string | null;
  xp: number;
  level: number;
  weeklyXP: number;
  weekId: string;
  streak: number;
  perfectRun: number;
  totalCompletions: number;
  achievements: number;
  activeHabits: number;
}

export interface Friendship {
  id: string; // `${uidA}_${uidB}` with uids sorted
  uids: [string, string];
  requester: string;
  status: 'pending' | 'accepted';
  createdAt: number;
}

export type ActivityType =
  'milestone' | 'achievement' | 'level' | 'perfect' | 'challenge_join' | 'challenge_done' | 'joined';

export interface Activity {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  avatar: { emoji: string; color: string; photoUrl?: string | null };
  type: ActivityType;
  text: string;
  createdAt: number;
  kudos: string[];
}

export interface InboxItem {
  id: string;
  from: string;
  fromName: string;
  fromAvatar: { emoji: string; color: string; photoUrl?: string | null };
  type: 'nudge' | 'kudos' | 'friend_accepted';
  text: string;
  createdAt: number;
  read: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  /** Icon key + tint key, same as habits. */
  icon: string;
  color: string;
  kind: HabitKind;
  target: number;
  unit: string | null;
  schedule: Schedule;
  durationDays: number;
  startDate: DayKey;
  endDate: DayKey;
  creatorUid: string;
  creatorName: string;
  memberCount: number;
  isPublic: boolean;
  createdAt: number;
}

export interface ChallengeMember {
  uid: string;
  username: string;
  displayName: string;
  avatar: { emoji: string; color: string; photoUrl?: string | null };
  daysDone: number;
  streak: number;
  lastDay: DayKey | null;
  joinedAt: number;
}

export const pairId = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);
