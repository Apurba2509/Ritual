import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { create } from 'zustand';
import { weekId } from '@/domain/dates';
import type { Entry, Habit, Workout } from '@/domain/types';
import { firebase } from '@/lib/firebase';
import { getSnapshot, useClock } from './hooks';
import { OutboxOp, RemoteUserDoc, useApp } from './store';

/**
 * Sync engine
 * ───────────
 * Local-first: every mutation lands in MMKV instantly and is recorded in an outbox.
 * This engine drains the outbox to Firestore in batches, and streams remote changes
 * back with realtime listeners. Conflicts resolve last-write-wins on `updatedAt`
 * (see store.applyRemote). Writes are idempotent (deterministic doc ids), so a
 * crash mid-flush just means the same batch is sent again.
 */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export const useSyncStatus = create<{ status: SyncStatus; lastSyncAt: number | null; error: string | null }>(() => ({
  status: 'idle',
  lastSyncAt: null,
  error: null,
}));

const BATCH_LIMIT = 400;

function stripServerFields<T>(data: DocumentData): T {
  const { serverUpdatedAt: _s, ...rest } = data;
  return rest as T;
}

function tsMillis(v: unknown): number {
  return v instanceof Timestamp ? v.toMillis() : 0;
}

class SyncEngine {
  private uid: string | null = null;
  private unsubs: Unsubscribe[] = [];
  private flushing = false;
  private again = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private backoff = 2000;
  private lastPublished = '';

  get activeUid() {
    return this.uid;
  }

  start(uid: string) {
    if (this.uid === uid) return;
    this.stop();
    const fb = firebase();
    if (!fb) return;
    this.uid = uid;
    const { db } = fb;
    const app = useApp.getState();

    const listen = (kind: 'habit' | 'entry' | 'workout') => {
      const name = kind === 'habit' ? 'habits' : kind === 'entry' ? 'entries' : 'workouts';
      const cursor = app.cursors[name] ?? 0;
      const q = query(
        collection(db, 'users', uid, name),
        where('serverUpdatedAt', '>', Timestamp.fromMillis(cursor)),
        orderBy('serverUpdatedAt'),
      );
      return onSnapshot(
        q,
        (snap) => {
          const docs: (Habit | Entry | Workout)[] = [];
          let max = useApp.getState().cursors[name] ?? 0;
          for (const change of snap.docChanges()) {
            if (change.type === 'removed' || change.doc.metadata.hasPendingWrites) continue;
            const data = change.doc.data();
            max = Math.max(max, tsMillis(data.serverUpdatedAt));
            docs.push(stripServerFields(data));
          }
          if (docs.length) useApp.getState().applyRemote(kind, docs, max);
          useSyncStatus.setState({ lastSyncAt: Date.now() });
        },
        (err) => this.fail(err),
      );
    };

    this.unsubs.push(listen('habit'), listen('entry'), listen('workout'));
    this.unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (!snap.exists() || snap.metadata.hasPendingWrites) return;
          useApp.getState().applyRemoteUser(snap.data() as RemoteUserDoc);
        },
        (err) => this.fail(err),
      ),
    );

    // Flush whenever the outbox grows (debounced so rapid taps become one batch).
    this.unsubs.push(
      useApp.subscribe((s, prev) => {
        if (s.outbox !== prev.outbox && Object.keys(s.outbox).length) this.schedule(600);
        if (s.entries !== prev.entries || s.profile !== prev.profile || s.unlocked !== prev.unlocked) {
          this.schedulePublish();
        }
      }),
    );

    this.flush();
    this.schedulePublish();
  }

  stop() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.uid = null;
    this.lastPublished = '';
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.debounce) clearTimeout(this.debounce);
    if (this.publishTimer) clearTimeout(this.publishTimer);
  }

  private schedule(ms: number) {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.flush(), ms);
  }

  private fail(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const offline = /offline|network|unavailable/i.test(message);
    useSyncStatus.setState({ status: offline ? 'offline' : 'error', error: message });
    if (__DEV__) console.warn('[sync]', message);
  }

  /** Push the outbox. Safe to call any time; concurrent calls coalesce. */
  async flush(): Promise<void> {
    const uid = this.uid;
    const fb = firebase();
    if (!uid || !fb) return;
    if (this.flushing) {
      this.again = true;
      return;
    }
    this.flushing = true;
    useSyncStatus.setState({ status: 'syncing' });
    try {
      for (;;) {
        const s = useApp.getState();
        const ops = Object.values(s.outbox).slice(0, BATCH_LIMIT);
        if (!ops.length) break;
        const batch = writeBatch(fb.db);
        const sent: OutboxOp[] = [];
        for (const op of ops) {
          if (op.kind === 'habit') {
            const h = s.habits[op.id];
            if (h) batch.set(doc(fb.db, 'users', uid, 'habits', h.id), { ...h, serverUpdatedAt: serverTimestamp() });
          } else if (op.kind === 'entry') {
            const e = s.entries[op.id];
            if (e) batch.set(doc(fb.db, 'users', uid, 'entries', e.id), { ...e, serverUpdatedAt: serverTimestamp() });
          } else if (op.kind === 'workout') {
            const w = s.workouts[op.id];
            if (w) batch.set(doc(fb.db, 'users', uid, 'workouts', w.id), { ...w, serverUpdatedAt: serverTimestamp() });
          } else {
            const { theme: _theme, ...settings } = s.settings;
            const userDoc: RemoteUserDoc & { serverUpdatedAt: unknown } = {
              profile: s.profile,
              settings,
              onboarded: s.onboarded,
              unlocked: s.unlocked,
              integrations: {
                github: s.integrations.github?.username ?? null,
                leetcode: s.integrations.leetcode?.username ?? null,
              },
              updatedAt: Date.now(),
              serverUpdatedAt: serverTimestamp(),
            };
            batch.set(doc(fb.db, 'users', uid), userDoc, { merge: true });
          }
          sent.push(op);
        }
        await batch.commit();
        if (this.uid !== uid) return; // signed out mid-flight
        useApp.getState().ackOutbox(sent);
      }
      this.backoff = 2000;
      useSyncStatus.setState({ status: 'idle', lastSyncAt: Date.now(), error: null });
    } catch (err) {
      this.fail(err);
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.flush(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 60_000);
    } finally {
      this.flushing = false;
      if (this.again) {
        this.again = false;
        this.schedule(100);
      }
    }
  }

  // ── public profile (leaderboards, friends) ──
  private publishTimer: ReturnType<typeof setTimeout> | null = null;

  schedulePublish() {
    if (this.publishTimer) clearTimeout(this.publishTimer);
    this.publishTimer = setTimeout(() => this.publishProfile(), 2500);
  }

  async publishProfile() {
    const uid = this.uid;
    const fb = firebase();
    const s = useApp.getState();
    if (!uid || !fb || !s.profile.username) return;
    const today = useClock.getState().today;
    const snap = getSnapshot(today);
    const pub = {
      uid,
      username: s.profile.username,
      displayName: s.profile.displayName || s.profile.username,
      avatar: s.profile.avatar,
      bio: s.profile.bio,
      xp: snap.xp,
      level: snap.level.level,
      weeklyXP: snap.weeklyXP,
      weekId: weekId(today),
      streak: snap.bestStreak.days,
      perfectRun: snap.perfectRun,
      totalCompletions: snap.totalCompletions,
      achievements: Object.keys(s.unlocked).length,
      activeHabits: snap.achievementStats.activeHabits,
    };
    const key = JSON.stringify(pub);
    if (key === this.lastPublished) return;
    try {
      await setDoc(doc(fb.db, 'profiles', uid), { ...pub, updatedAt: serverTimestamp() }, { merge: true });
      this.lastPublished = key;
    } catch (err) {
      this.fail(err);
    }
  }
}

export const sync = new SyncEngine();

/** Fetch users/{uid} once (used before routing on a fresh device). */
export async function pullUserDoc(uid: string, timeoutMs = 7000): Promise<boolean> {
  const fb = firebase();
  if (!fb) return false;
  const result = await Promise.race([
    getDoc(doc(fb.db, 'users', uid)).then((snap) => {
      if (snap.exists()) useApp.getState().applyRemoteUser(snap.data() as RemoteUserDoc);
      return snap.exists();
    }),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
  return result;
}
