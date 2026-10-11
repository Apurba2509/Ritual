import { habitIconKey, tintKey } from '@/domain/catalog';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  DocumentData,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { addDays, todayKey, weekId } from '@/domain/dates';
import type { Habit } from '@/domain/types';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { firebase, requireFirebase } from '@/lib/firebase';
import { Activity, ActivityType, Challenge, ChallengeMember, pairId, PublicProfile } from './types';

const me = () => useSession.getState().user?.uid ?? null;

export const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : Date.now());

export function toProfile(data: DocumentData): PublicProfile {
  return {
    uid: data.uid,
    username: data.username,
    displayName: data.displayName ?? data.username,
    avatar: data.avatar ?? { emoji: '', color: 'lime' },
    bio: data.bio ?? null,
    xp: data.xp ?? 0,
    level: data.level ?? 1,
    weeklyXP: data.weekId === weekId(todayKey()) ? (data.weeklyXP ?? 0) : 0,
    weekId: data.weekId ?? '',
    streak: data.streak ?? 0,
    perfectRun: data.perfectRun ?? 0,
    totalCompletions: data.totalCompletions ?? 0,
    achievements: data.achievements ?? 0,
    activeHabits: data.activeHabits ?? 0,
  };
}

function myCard() {
  const p = useApp.getState().profile;
  return {
    username: p.username ?? 'ritualist',
    displayName: p.displayName || p.username || 'Ritualist',
    avatar: p.avatar,
  };
}

// ─── Profiles & friends ─────────────────────────────────────────────────────

export async function findByUsername(raw: string): Promise<PublicProfile | null> {
  const { db } = requireFirebase();
  const username = raw.trim().toLowerCase().replace(/^@/, '');
  if (!username) return null;
  const handle = await getDoc(doc(db, 'usernames', username));
  if (!handle.exists()) return null;
  const prof = await getDoc(doc(db, 'profiles', handle.data().uid));
  return prof.exists() ? toProfile(prof.data()) : null;
}

export async function getProfile(uid: string): Promise<PublicProfile | null> {
  const { db } = requireFirebase();
  const snap = await getDoc(doc(db, 'profiles', uid));
  return snap.exists() ? toProfile(snap.data()) : null;
}

/** Profiles for many uids (Firestore `in` queries take up to 30 values). */
export async function getProfiles(uids: string[]): Promise<PublicProfile[]> {
  const { db } = requireFirebase();
  const unique = [...new Set(uids)];
  const out: PublicProfile[] = [];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, 'profiles'), where(documentId(), 'in', chunk)));
    snap.forEach((d) => out.push(toProfile(d.data())));
  }
  return out;
}

export async function sendFriendRequest(target: string) {
  const { db } = requireFirebase();
  const uid = me();
  if (!uid || uid === target) throw new Error("You can't add yourself.");
  const id = pairId(uid, target);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'friendships', id);
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === 'accepted') throw new Error("You're already friends.");
      if (data.requester !== uid) {
        // They already asked us — accepting is the friendly thing to do.
        tx.update(ref, { status: 'accepted', updatedAt: serverTimestamp() });
        return;
      }
      throw new Error('Request already sent.');
    }
    tx.set(ref, {
      uids: [uid, target].sort(),
      requester: uid,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function acceptFriend(friendshipId: string) {
  const { db } = requireFirebase();
  await updateDoc(doc(db, 'friendships', friendshipId), { status: 'accepted', updatedAt: serverTimestamp() });
  const other = friendshipId.split('_').find((u) => u !== me());
  if (other) {
    const card = myCard();
    addDoc(collection(db, 'users', other, 'inbox'), {
      from: me(),
      fromName: card.displayName,
      fromAvatar: card.avatar,
      type: 'friend_accepted',
      text: 'accepted your friend request',
      createdAt: serverTimestamp(),
      read: false,
    }).catch(() => {});
  }
}

export async function removeFriendship(friendshipId: string) {
  const { db } = requireFirebase();
  await deleteDoc(doc(db, 'friendships', friendshipId));
}

export async function sendNudge(target: string, text: string) {
  const { db } = requireFirebase();
  const card = myCard();
  await addDoc(collection(db, 'users', target, 'inbox'), {
    from: me(),
    fromName: card.displayName,
    fromAvatar: card.avatar,
    type: 'nudge',
    text,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function markInboxRead(ids: string[]) {
  const fb = firebase();
  const uid = me();
  if (!fb || !uid || !ids.length) return;
  const batch = writeBatch(fb.db);
  ids.forEach((id) => batch.update(doc(fb.db, 'users', uid, 'inbox', id), { read: true }));
  await batch.commit().catch(() => {});
}

// ─── Activity feed ──────────────────────────────────────────────────────────

/** Fire-and-forget: share a moment with friends. No-op for guests. */
export function postActivity(a: { type: ActivityType; text: string }) {
  const fb = firebase();
  const uid = me();
  if (!fb || !uid || !useApp.getState().profile.username) return;
  addDoc(collection(fb.db, 'activity'), {
    uid,
    ...myCard(),
    ...a,
    kudos: [],
    createdAt: serverTimestamp(),
  }).catch((e) => __DEV__ && console.warn('[activity]', e));
}

export function toActivity(id: string, d: DocumentData): Activity {
  return {
    id,
    uid: d.uid,
    username: d.username,
    displayName: d.displayName,
    avatar: d.avatar,
    type: d.type,
    text: d.text,
    createdAt: millis(d.createdAt),
    kudos: d.kudos ?? [],
  };
}

export async function toggleKudos(activity: Activity) {
  const { db } = requireFirebase();
  const uid = me();
  if (!uid) return;
  const has = activity.kudos.includes(uid);
  await updateDoc(doc(db, 'activity', activity.id), { kudos: has ? arrayRemove(uid) : arrayUnion(uid) });
  if (!has && activity.uid !== uid) {
    const card = myCard();
    addDoc(collection(db, 'users', activity.uid, 'inbox'), {
      from: uid,
      fromName: card.displayName,
      fromAvatar: card.avatar,
      type: 'kudos',
      text: `cheered "${activity.text}"`,
      createdAt: serverTimestamp(),
      read: false,
    }).catch(() => {});
  }
}

export async function deleteActivity(id: string) {
  const { db } = requireFirebase();
  await deleteDoc(doc(db, 'activity', id));
}

// ─── Leaderboards ───────────────────────────────────────────────────────────

export async function globalLeaderboard(kind: 'week' | 'all'): Promise<PublicProfile[]> {
  const { db } = requireFirebase();
  const q =
    kind === 'all'
      ? query(collection(db, 'profiles'), orderBy('xp', 'desc'), limit(50))
      : query(
          collection(db, 'profiles'),
          where('weekId', '==', weekId(todayKey())),
          orderBy('weeklyXP', 'desc'),
          limit(50),
        );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProfile(d.data()));
}

// ─── Challenges ─────────────────────────────────────────────────────────────

export function toChallenge(id: string, d: DocumentData): Challenge {
  return {
    id,
    title: d.title,
    description: d.description ?? '',
    icon: habitIconKey(d),
    color: tintKey(d.color),
    kind: d.kind,
    target: d.target,
    unit: d.unit ?? null,
    schedule: d.schedule ?? { type: 'daily' },
    durationDays: d.durationDays,
    startDate: d.startDate,
    endDate: d.endDate,
    creatorUid: d.creatorUid,
    creatorName: d.creatorName,
    memberCount: d.memberCount ?? 0,
    isPublic: !!d.isPublic,
    createdAt: millis(d.createdAt),
  };
}

export async function listChallenges(): Promise<Challenge[]> {
  const { db } = requireFirebase();
  const snap = await getDocs(
    query(collection(db, 'challenges'), where('isPublic', '==', true), orderBy('memberCount', 'desc'), limit(40)),
  );
  return snap.docs.map((d) => toChallenge(d.id, d.data()));
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { db } = requireFirebase();
  const snap = await getDoc(doc(db, 'challenges', id));
  return snap.exists() ? toChallenge(snap.id, snap.data()) : null;
}

export async function challengeMembers(id: string): Promise<ChallengeMember[]> {
  const { db } = requireFirebase();
  const snap = await getDocs(
    query(collection(db, 'challenges', id, 'members'), orderBy('daysDone', 'desc'), limit(100)),
  );
  return snap.docs.map((d) => {
    const m = d.data();
    return {
      uid: d.id,
      username: m.username,
      displayName: m.displayName,
      avatar: m.avatar,
      daysDone: m.daysDone ?? 0,
      streak: m.streak ?? 0,
      lastDay: m.lastDay ?? null,
      joinedAt: millis(m.joinedAt),
    };
  });
}

export async function createChallenge(
  input: Omit<Challenge, 'id' | 'creatorUid' | 'creatorName' | 'memberCount' | 'createdAt' | 'endDate'>,
): Promise<string> {
  const { db } = requireFirebase();
  const uid = me();
  if (!uid) throw new Error('Sign in to create challenges.');
  const ref = await addDoc(collection(db, 'challenges'), {
    ...input,
    endDate: addDays(input.startDate, input.durationDays - 1),
    creatorUid: uid,
    creatorName: myCard().displayName,
    memberCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Join: member doc + counter, and a local habit linked to the challenge. */
export async function joinChallenge(c: Challenge): Promise<string> {
  const { db } = requireFirebase();
  const uid = me();
  if (!uid) throw new Error('Sign in to join challenges.');
  const card = myCard();
  const memberRef = doc(db, 'challenges', c.id, 'members', uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(memberRef);
    if (existing.exists()) return;
    tx.set(memberRef, {
      ...card,
      daysDone: 0,
      streak: 0,
      lastDay: null,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'challenges', c.id), { memberCount: increment(1) });
  });

  const app = useApp.getState();
  const existingHabit = Object.values(app.habits).find((h) => h.challengeId === c.id && !h.deleted);
  const habitId =
    existingHabit?.id ??
    app.createHabit({
      name: c.title,
      icon: c.icon,
      color: c.color,
      kind: c.kind,
      target: c.target,
      unit: c.unit,
      schedule: c.schedule,
      reminders: ['19:00'],
      auto: null,
      category: null,
      difficulty: 'medium',
      intention: c.description || null,
      challengeId: c.id,
    });
  app.setSocialCounts({ challengesJoined: app.social.challengesJoined + 1 });
  postActivity({ type: 'challenge_join', text: `joined the "${c.title}" challenge` });
  return habitId;
}

export async function leaveChallenge(c: Challenge) {
  const { db } = requireFirebase();
  const uid = me();
  if (!uid) return;
  const memberRef = doc(db, 'challenges', c.id, 'members', uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(memberRef);
    if (!existing.exists()) return;
    tx.delete(memberRef);
    tx.update(doc(db, 'challenges', c.id), { memberCount: increment(-1) });
  });
  const habit = Object.values(useApp.getState().habits).find((h) => h.challengeId === c.id && !h.deleted);
  if (habit) useApp.getState().updateHabit(habit.id, { challengeId: null });
}

/** Push my progress for every challenge-linked habit (called by the social live layer). */
export async function publishChallengeProgress(
  items: { habit: Habit; daysDone: number; streak: number; lastDay: string | null }[],
) {
  const fb = firebase();
  const uid = me();
  if (!fb || !uid || !items.length) return;
  const card = myCard();
  const batch = writeBatch(fb.db);
  for (const it of items) {
    if (!it.habit.challengeId) continue;
    batch.set(
      doc(fb.db, 'challenges', it.habit.challengeId, 'members', uid),
      { ...card, daysDone: it.daysDone, streak: it.streak, lastDay: it.lastDay, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit().catch((e) => __DEV__ && console.warn('[challenges]', e));
}

export async function setChallengeVisibility(id: string, isPublic: boolean) {
  const { db } = requireFirebase();
  await setDoc(doc(db, 'challenges', id), { isPublic }, { merge: true });
}
