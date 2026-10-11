import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { HABIT_COLORS } from '@/domain/catalog';
import type { DayKey, WeekStart } from '@/domain/dates';
import { isEntryDone } from '@/domain/habits';
import { CategoryId, Entry, entryId, EntrySource, Habit, Mood } from '@/domain/types';
import { monotonicNow, newId } from '@/lib/ids';
import { zustandStorage } from '@/lib/storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ThemePref = 'system' | 'dark' | 'light';

export interface Settings {
  weekStart: WeekStart;
  theme: ThemePref;
  haptics: boolean;
  celebrations: boolean;
  morningBrief: { enabled: boolean; time: string };
  eveningNudge: { enabled: boolean; time: string };
}

export interface Profile {
  displayName: string;
  username: string | null;
  avatar: { emoji: string; color: string; photoUrl?: string | null };
  bio: string | null;
  goals: CategoryId[];
}

export type OutboxKind = 'habit' | 'entry' | 'user';

export interface OutboxOp {
  kind: OutboxKind;
  id: string;
  /** updatedAt of the doc when queued — an ack only clears the op if nothing changed since. */
  version: number;
}

export interface IntegrationState {
  github: { username: string; lastSyncAt: number | null; error: string | null } | null;
  leetcode: { username: string; lastSyncAt: number | null; error: string | null } | null;
  health: { lastSyncAt: number | null; error: string | null } | null;
}

export type NewHabit = Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'archived' | 'deleted'> &
  Partial<Pick<Habit, 'order'>>;

export interface EntryChange {
  wasDone: boolean;
  isDone: boolean;
  entry: Entry;
}

interface AppState {
  habits: Record<string, Habit>;
  entries: Record<string, Entry>;
  unlocked: Record<string, number>;
  lastLevelSeen: number;
  settings: Settings;
  profile: Profile;
  onboarded: boolean;
  /** User chose "continue without account". */
  guest: boolean;
  /** Firebase uid that owns the local data (null = guest/local-only data). */
  ownerUid: string | null;
  outbox: Record<string, OutboxOp>;
  /** Highest server timestamp (ms) pulled per collection. */
  cursors: { habits: number; entries: number };
  social: { friends: number; challengesJoined: number };
  integrations: IntegrationState;
  aiLogs: number;

  // habits
  createHabit: (h: NewHabit) => string;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  archiveHabit: (id: string, archived: boolean) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (ids: string[]) => void;

  // entries
  setEntry: (
    habitId: string,
    date: DayKey,
    patch: Partial<Pick<Entry, 'value' | 'skipped' | 'note' | 'mood'>>,
    source?: EntrySource,
  ) => EntryChange | null;
  addToEntry: (habitId: string, date: DayKey, delta: number, source?: EntrySource) => EntryChange | null;
  toggleDone: (habitId: string, date: DayKey, source?: EntrySource) => EntryChange | null;
  setNote: (habitId: string, date: DayKey, note: string | null, mood: Mood | null) => void;
  setPhoto: (habitId: string, date: DayKey, photoUrl: string | null) => void;
  /** Merge values reported by an integration (never lowers a manually logged value). */
  mergeAutoEntries: (habitId: string, values: Record<DayKey, number>, source: EntrySource) => number;

  // gamification & profile
  markUnlocked: (ids: string[]) => void;
  setLastLevelSeen: (level: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setOnboarded: (v: boolean) => void;
  setGuest: (v: boolean) => void;
  setSocialCounts: (patch: Partial<AppState['social']>) => void;
  setIntegration: <K extends keyof IntegrationState>(key: K, value: IntegrationState[K]) => void;
  bumpAiLogs: () => void;

  // sync plumbing
  applyRemote: (kind: 'habit' | 'entry', docs: (Habit | Entry)[], cursor: number) => void;
  applyRemoteUser: (doc: RemoteUserDoc) => void;
  ackOutbox: (acked: OutboxOp[]) => void;
  adoptLocalData: (uid: string) => void;
  resetForUser: (uid: string | null) => void;
}

/** Shape of users/{uid} in Firestore. */
export interface RemoteUserDoc {
  profile?: Profile;
  settings?: Partial<Settings>;
  onboarded?: boolean;
  unlocked?: Record<string, number>;
  integrations?: { github?: string | null; leetcode?: string | null };
  updatedAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  weekStart: 1,
  theme: 'system',
  haptics: true,
  celebrations: true,
  morningBrief: { enabled: true, time: '08:00' },
  eveningNudge: { enabled: true, time: '20:30' },
};

export const DEFAULT_PROFILE: Profile = {
  displayName: '',
  username: null,
  avatar: { emoji: '🔥', color: HABIT_COLORS[0] },
  bio: null,
  goals: [],
};

const EMPTY_INTEGRATIONS: IntegrationState = { github: null, leetcode: null, health: null };

const opKey = (kind: OutboxKind, id: string) => `${kind}:${id}`;

const enqueue = (outbox: Record<string, OutboxOp>, kind: OutboxKind, id: string, version: number) => ({
  ...outbox,
  [opKey(kind, id)]: { kind, id, version },
});

// ─── Store ───────────────────────────────────────────────────────────────────

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /** Write an entry, queue it for sync, and report whether it crossed the target. */
      const writeEntry = (
        habitId: string,
        date: DayKey,
        build: (prev: Entry) => Partial<Entry>,
        source: EntrySource,
      ): EntryChange | null => {
        const habit = get().habits[habitId];
        if (!habit || habit.deleted) return null;
        const id = entryId(habitId, date);
        const stored = get().entries[id];
        const prev: Entry =
          stored && !stored.deleted
            ? stored
            : {
                id,
                habitId,
                date,
                value: 0,
                skipped: false,
                note: null,
                mood: null,
                photoUrl: null,
                source,
                completedAt: null,
                updatedAt: stored?.updatedAt ?? 0,
              };
        const patch = build(prev);
        const next: Entry = {
          ...prev,
          ...patch,
          value: Math.max(0, Math.round((patch.value ?? prev.value) * 100) / 100),
          deleted: false,
          updatedAt: Math.max(monotonicNow(), prev.updatedAt + 1),
        };
        if (patch.value !== undefined && patch.value !== prev.value) next.source = source;
        if (next.skipped) next.value = 0;

        const wasDone = isEntryDone(habit, stored);
        const isDone = isEntryDone(habit, next);
        if (isDone && !wasDone) next.completedAt = Date.now();
        if (!isDone) next.completedAt = null;
        // An entry with nothing in it is just noise — tombstone it.
        if (next.value <= 0 && !next.skipped && !next.note && !next.mood && !next.photoUrl) next.deleted = true;

        set((s) => ({
          entries: { ...s.entries, [id]: next },
          outbox: enqueue(s.outbox, 'entry', id, next.updatedAt),
        }));
        return { wasDone, isDone, entry: next };
      };

      const touchUser = () => set((s) => ({ outbox: enqueue(s.outbox, 'user', 'me', monotonicNow()) }));

      return {
        habits: {},
        entries: {},
        unlocked: {},
        lastLevelSeen: 1,
        settings: DEFAULT_SETTINGS,
        profile: DEFAULT_PROFILE,
        onboarded: false,
        guest: false,
        ownerUid: null,
        outbox: {},
        cursors: { habits: 0, entries: 0 },
        social: { friends: 0, challengesJoined: 0 },
        integrations: EMPTY_INTEGRATIONS,
        aiLogs: 0,

        // ── habits ──
        createHabit: (input) => {
          const id = newId();
          const now = monotonicNow();
          const order =
            input.order ?? Object.values(get().habits).reduce((m, h) => (h.deleted ? m : Math.max(m, h.order + 1)), 0);
          const habit: Habit = { ...input, id, order, archived: false, createdAt: now, updatedAt: now };
          set((s) => ({
            habits: { ...s.habits, [id]: habit },
            outbox: enqueue(s.outbox, 'habit', id, now),
          }));
          return id;
        },

        updateHabit: (id, patch) => {
          const prev = get().habits[id];
          if (!prev) return;
          const updatedAt = Math.max(monotonicNow(), prev.updatedAt + 1);
          const next = { ...prev, ...patch, id, updatedAt };
          set((s) => ({
            habits: { ...s.habits, [id]: next },
            outbox: enqueue(s.outbox, 'habit', id, updatedAt),
          }));
        },

        archiveHabit: (id, archived) => get().updateHabit(id, { archived }),

        deleteHabit: (id) => {
          const now = monotonicNow();
          set((s) => {
            const prev = s.habits[id];
            if (!prev) return s;
            let outbox = enqueue(s.outbox, 'habit', id, now);
            const entries = { ...s.entries };
            for (const e of Object.values(s.entries)) {
              if (e.habitId === id && !e.deleted) {
                entries[e.id] = { ...e, deleted: true, updatedAt: now };
                outbox = enqueue(outbox, 'entry', e.id, now);
              }
            }
            return { habits: { ...s.habits, [id]: { ...prev, deleted: true, updatedAt: now } }, entries, outbox };
          });
        },

        reorderHabits: (ids) => {
          const now = monotonicNow();
          set((s) => {
            const habits = { ...s.habits };
            let outbox = s.outbox;
            ids.forEach((id, order) => {
              const h = habits[id];
              if (h && h.order !== order) {
                habits[id] = { ...h, order, updatedAt: now };
                outbox = enqueue(outbox, 'habit', id, now);
              }
            });
            return { habits, outbox };
          });
        },

        // ── entries ──
        setEntry: (habitId, date, patch, source = 'manual') => writeEntry(habitId, date, () => patch, source),

        addToEntry: (habitId, date, delta, source = 'manual') =>
          writeEntry(habitId, date, (prev) => ({ value: prev.value + delta, skipped: false }), source),

        toggleDone: (habitId, date, source = 'manual') => {
          const habit = get().habits[habitId];
          if (!habit) return null;
          return writeEntry(
            habitId,
            date,
            (prev) => ({ value: isEntryDone(habit, prev) ? 0 : habit.target, skipped: false }),
            source,
          );
        },

        setNote: (habitId, date, note, mood) => {
          writeEntry(habitId, date, () => ({ note: note?.trim() || null, mood }), 'manual');
        },

        setPhoto: (habitId, date, photoUrl) => {
          writeEntry(habitId, date, () => ({ photoUrl }), 'manual');
        },

        mergeAutoEntries: (habitId, values, source) => {
          const habit = get().habits[habitId];
          if (!habit) return 0;
          let changed = 0;
          for (const [date, value] of Object.entries(values)) {
            const prev = get().entries[entryId(habitId, date)];
            const current = prev && !prev.deleted ? prev.value : 0;
            if (value > current && !(prev && !prev.deleted && prev.skipped)) {
              writeEntry(habitId, date, () => ({ value }), source);
              changed++;
            }
          }
          return changed;
        },

        // ── gamification / profile ──
        markUnlocked: (ids) => {
          if (!ids.length) return;
          const now = Date.now();
          set((s) => {
            const unlocked = { ...s.unlocked };
            for (const id of ids) if (!unlocked[id]) unlocked[id] = now;
            return { unlocked };
          });
          touchUser();
        },
        setLastLevelSeen: (level) => set({ lastLevelSeen: level }),
        updateSettings: (patch) => {
          set((s) => ({ settings: { ...s.settings, ...patch } }));
          touchUser();
        },
        updateProfile: (patch) => {
          set((s) => ({ profile: { ...s.profile, ...patch } }));
          touchUser();
        },
        setOnboarded: (onboarded) => {
          set({ onboarded });
          touchUser();
        },
        setGuest: (guest) => set({ guest }),
        setSocialCounts: (patch) => set((s) => ({ social: { ...s.social, ...patch } })),
        setIntegration: (key, value) => {
          const prev = get().integrations[key] as { username?: string } | null;
          set((s) => ({ integrations: { ...s.integrations, [key]: value } }));
          // Only account links are synced, not per-run status.
          if (key !== 'health' && prev?.username !== (value as { username?: string } | null)?.username) touchUser();
        },
        bumpAiLogs: () => set((s) => ({ aiLogs: s.aiLogs + 1 })),

        // ── sync plumbing ──
        applyRemote: (kind, docs, cursor) => {
          set((s) => {
            const coll: Record<string, Habit | Entry> = kind === 'habit' ? { ...s.habits } : { ...s.entries };
            const outbox = { ...s.outbox };
            for (const doc of docs) {
              const local = coll[doc.id];
              if (local && local.updatedAt >= doc.updatedAt) continue; // local is newer or equal
              coll[doc.id] = doc;
              delete outbox[opKey(kind, doc.id)]; // remote won last-write-wins
            }
            const cursors = {
              ...s.cursors,
              [kind === 'habit' ? 'habits' : 'entries']: Math.max(
                cursor,
                s.cursors[kind === 'habit' ? 'habits' : 'entries'],
              ),
            };
            return kind === 'habit'
              ? { habits: coll as Record<string, Habit>, outbox, cursors }
              : { entries: coll as Record<string, Entry>, outbox, cursors };
          });
        },

        applyRemoteUser: (doc) => {
          set((s) => {
            if (s.outbox[opKey('user', 'me')]) {
              // Local profile edits are pending; only take additive data.
              return { unlocked: { ...doc.unlocked, ...s.unlocked }, onboarded: s.onboarded || !!doc.onboarded };
            }
            const integrations = { ...s.integrations };
            if (doc.integrations?.github && !integrations.github)
              integrations.github = { username: doc.integrations.github, lastSyncAt: null, error: null };
            if (doc.integrations?.leetcode && !integrations.leetcode)
              integrations.leetcode = { username: doc.integrations.leetcode, lastSyncAt: null, error: null };
            return {
              profile: doc.profile ? { ...DEFAULT_PROFILE, ...doc.profile } : s.profile,
              settings: doc.settings ? { ...s.settings, ...doc.settings } : s.settings,
              onboarded: s.onboarded || !!doc.onboarded,
              unlocked: { ...doc.unlocked, ...s.unlocked },
              integrations,
            };
          });
        },

        ackOutbox: (acked) => {
          set((s) => {
            const outbox = { ...s.outbox };
            for (const op of acked) {
              const key = opKey(op.kind, op.id);
              if (outbox[key] && outbox[key].version === op.version) delete outbox[key];
            }
            return { outbox };
          });
        },

        adoptLocalData: (uid) => {
          set((s) => {
            let outbox = { ...s.outbox };
            for (const h of Object.values(s.habits)) outbox = enqueue(outbox, 'habit', h.id, h.updatedAt);
            for (const e of Object.values(s.entries)) outbox = enqueue(outbox, 'entry', e.id, e.updatedAt);
            outbox = enqueue(outbox, 'user', 'me', monotonicNow());
            return { ownerUid: uid, guest: false, outbox };
          });
        },

        resetForUser: (uid) =>
          set((s) => ({
            habits: {},
            entries: {},
            unlocked: {},
            lastLevelSeen: 1,
            profile: DEFAULT_PROFILE,
            onboarded: false,
            guest: false,
            ownerUid: uid,
            outbox: {},
            cursors: { habits: 0, entries: 0 },
            social: { friends: 0, challengesJoined: 0 },
            integrations: EMPTY_INTEGRATIONS,
            aiLogs: 0,
            settings: s.settings,
          })),
      };
    },
    {
      name: 'ritual-app',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({
        habits,
        entries,
        unlocked,
        lastLevelSeen,
        settings,
        profile,
        onboarded,
        guest,
        ownerUid,
        outbox,
        cursors,
        social,
        integrations,
        aiLogs,
      }) => ({
        habits,
        entries,
        unlocked,
        lastLevelSeen,
        settings,
        profile,
        onboarded,
        guest,
        ownerUid,
        outbox,
        cursors,
        social,
        integrations,
        aiLogs,
      }),
    },
  ),
);
