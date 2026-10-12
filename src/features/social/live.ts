import { collection, limit, onSnapshot, orderBy, query, Unsubscribe, where } from 'firebase/firestore';
import { useEffect } from 'react';
import { create } from 'zustand';
import { computeStreak, isEntryDone } from '@/domain/habits';
import { getSnapshot } from '@/data/hooks';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { useUI } from '@/data/ui';
import { firebase } from '@/lib/firebase';
import { getProfiles, millis, publishChallengeProgress, toActivity } from './api';
import type { Activity, Friendship, InboxItem, PublicProfile } from './types';

interface SocialState {
  friendships: Friendship[];
  profiles: Record<string, PublicProfile>;
  feed: Activity[];
  inbox: InboxItem[];
  ready: boolean;
  refreshProfiles: () => Promise<void>;
}

export const useSocial = create<SocialState>((set, get) => ({
  friendships: [],
  profiles: {},
  feed: [],
  inbox: [],
  ready: false,
  refreshProfiles: async () => {
    const uid = useSession.getState().user?.uid;
    if (!uid) return;
    const others = get().friendships.map((f) => f.uids.find((u) => u !== uid)!);
    try {
      const list = await getProfiles([uid, ...others]);
      set({ profiles: Object.fromEntries(list.map((p) => [p.uid, p])) });
    } catch (e) {
      if (__DEV__) console.warn('[social] profiles', e);
    }
  },
}));

export function friendUids(uid: string, friendships: Friendship[]) {
  return friendships.filter((f) => f.status === 'accepted').map((f) => f.uids.find((u) => u !== uid)!);
}

let unsubs: Unsubscribe[] = [];
let feedUnsubs: Unsubscribe[] = [];
let feedKey = '';

/** Firestore's `in` filter takes at most 30 values per query. */
const IN_LIMIT = 30;
const FEED_SIZE = 60;
let progressTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The feed: recent activity from you and your friends. Friends are split into groups of 30
 * (Firestore's `in` limit) with one listener each, merged newest-first. At real scale this
 * becomes a per-user feed written by a Cloud Function (fan-out on write); see README.
 */
function listenFeed(uid: string) {
  const fb = firebase();
  if (!fb) return;
  const ids = [uid, ...friendUids(uid, useSocial.getState().friendships)].sort();
  const key = ids.join(',');
  if (key === feedKey) return;
  feedKey = key;
  for (const u of feedUnsubs) u();
  feedUnsubs = [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_LIMIT) chunks.push(ids.slice(i, i + IN_LIMIT));
  const parts: Activity[][] = chunks.map(() => []);
  const publish = () => {
    const merged = parts
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, FEED_SIZE);
    useSocial.setState({ feed: merged });
  };
  chunks.forEach((chunk, i) => {
    feedUnsubs.push(
      onSnapshot(
        query(collection(fb.db, 'activity'), where('uid', 'in', chunk), orderBy('createdAt', 'desc'), limit(FEED_SIZE)),
        (snap) => {
          parts[i] = snap.docs.map((d) => toActivity(d.id, d.data()));
          publish();
        },
        (err) => __DEV__ && console.warn('[social] feed', err.message),
      ),
    );
  });
}

function start(uid: string) {
  const fb = firebase();
  if (!fb) return;
  stop();

  unsubs.push(
    onSnapshot(
      query(collection(fb.db, 'friendships'), where('uids', 'array-contains', uid)),
      (snap) => {
        const friendships: Friendship[] = snap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, uids: x.uids, requester: x.requester, status: x.status, createdAt: millis(x.createdAt) };
        });
        useSocial.setState({ friendships, ready: true });
        useApp.getState().setSocialCounts({ friends: friendUids(uid, friendships).length });
        useSocial.getState().refreshProfiles();
        listenFeed(uid);
      },
      (err) => __DEV__ && console.warn('[social] friendships', err.message),
    ),
  );

  let firstInbox = true;
  unsubs.push(
    onSnapshot(
      query(collection(fb.db, 'users', uid, 'inbox'), orderBy('createdAt', 'desc'), limit(40)),
      (snap) => {
        const inbox: InboxItem[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            from: x.from,
            fromName: x.fromName,
            fromAvatar: x.fromAvatar,
            type: x.type,
            text: x.text,
            createdAt: millis(x.createdAt),
            read: !!x.read,
          };
        });
        if (!firstInbox) {
          for (const change of snap.docChanges()) {
            if (change.type !== 'added') continue;
            const x = change.doc.data();
            if (x.type === 'nudge') useUI.getState().toast(`${x.fromName}: ${x.text}`, { icon: 'hand-waving' });
            else if (x.type === 'friend_accepted')
              useUI.getState().toast(`${x.fromName} is now your friend`, { icon: 'users-three' });
          }
        }
        firstInbox = false;
        useSocial.setState({ inbox });
      },
      (err) => __DEV__ && console.warn('[social] inbox', err.message),
    ),
  );

  // Challenge leaderboards: publish my progress whenever entries change.
  unsubs.push(
    useApp.subscribe((s, prev) => {
      if (s.entries === prev.entries && s.habits === prev.habits) return;
      if (progressTimer) clearTimeout(progressTimer);
      progressTimer = setTimeout(publishProgress, 3000);
    }),
  );
  publishProgress();
}

function publishProgress() {
  const app = useApp.getState();
  const habits = Object.values(app.habits).filter((h) => h.challengeId && !h.deleted);
  if (!habits.length) return;
  const snap = getSnapshot();
  publishChallengeProgress(
    habits.map((habit) => {
      const byDay = snap.index.get(habit.id);
      const doneDays = byDay
        ? [...byDay.entries()]
            .filter(([, e]) => isEntryDone(habit, e))
            .map(([d]) => d)
            .sort()
        : [];
      const streak = computeStreak(habit, byDay, snap.today, app.settings.weekStart);
      return {
        habit,
        daysDone: doneDays.length,
        streak: streak.current,
        lastDay: doneDays[doneDays.length - 1] ?? null,
      };
    }),
  );
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  for (const u of feedUnsubs) u();
  feedUnsubs = [];
  feedKey = '';
  useSocial.setState({ friendships: [], profiles: {}, feed: [], inbox: [], ready: false });
}

/** Mount once at the root: keeps social listeners in step with the signed-in user. */
export function useSocialLive() {
  const uid = useSession((s) => s.user?.uid ?? null);
  useEffect(() => {
    if (uid) start(uid);
    return () => stop();
  }, [uid]);
}
