import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { habitIconKey, tintKey } from '@/domain/catalog';
import { addDays, DayKey, todayKey, WeekStart } from '@/domain/dates';
import type { NotifyStyle } from '@/domain/notifications';
import { buildDemoHistory, DEMO_HABITS } from '@/domain/demo';
import { computeSnapshot } from '@/domain/snapshot';
import { isEntryDone } from '@/domain/habits';
import { Adjustment, tinyVersion } from '@/domain/behavior';
import { CategoryId, Entry, entryId, EntrySource, Habit, Mood, Workout } from '@/domain/types';
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
  /** How chatty reminders are (see domain/notifications). */
  notifyStyle: NotifyStyle;
  quietHours: { enabled: boolean; start: string; end: string };
  /** Ping when a habit completes itself from sensors / GitHub / LeetCode while the app is closed. */
  autoAlerts: boolean;
}

export interface Profile {
  displayName: string;
  username: string | null;
  /** `emoji` is legacy (kept for the profile schema); avatars are a photo or initials now. */
  avatar: { emoji: string; color: string; photoUrl?: string | null };
  bio: string | null;
  goals: CategoryId[];
}

export type OutboxKind = 'habit' | 'entry' | 'workout' | 'user';

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

/** Mindful pause + screen time setup. Device-specific (package names), so it isn't synced. */
export interface GuardConfig {
  enabled: boolean;
  apps: string[];
  /** Windows where guarded apps open freely — a scheduled outlet for FOMO. */
  catchups: { start: string; end: string }[];
  bedtime: { enabled: boolean; start: string; end: string };
  allowMinutes: number;
  /** Habit offered as the swap on the pause screen ("2 minutes of reading instead"). */
  swapHabitId: string | null;
}

export const DEFAULT_GUARD: GuardConfig = {
  enabled: false,
  apps: [],
  catchups: [
    { start: '12:30', end: '13:00' },
    { start: '19:00', end: '19:30' },
  ],
  bedtime: { enabled: true, start: '23:00', end: '06:00' },
  allowMinutes: 5,
  swapHabitId: null,
};

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
  workouts: Record<string, Workout>;
  unlocked: Record<string, number>;
  lastLevelSeen: number;
  settings: Settings;
  profile: Profile;
  onboarded: boolean;
  /** User chose "continue without account". */
  guest: boolean;
  /** Exploring generated sample data (never synced, cleared before real use). */
  demo: boolean;
  /** Firebase uid that owns the local data (null = guest/local-only data). */
  ownerUid: string | null;
  outbox: Record<string, OutboxOp>;
  /** Highest server timestamp (ms) pulled per collection. */
  cursors: { habits: number; entries: number; workouts?: number };
  social: { friends: number; challengesJoined: number };
  integrations: IntegrationState;
  aiLogs: number;
  /** Easy mode: until this day (inclusive) the two-minute version of every habit counts in full. */
  easyUntil: DayKey | null;
  /** Coach cards the person waved away: key → hidden until (ms). */
  coachDismissed: Record<string, number>;
  guard: GuardConfig;

  // habits
  createHabit: (h: NewHabit) => string;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  archiveHabit: (id: string, archived: boolean) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (ids: string[]) => void;
  /** Accept a coach suggestion to make a goal lighter or heavier. */
  applyAdjustment: (adj: Adjustment) => void;

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
  /** Log the two-minute version: the day is held to the tiny goal and counts as done. */
  logTiny: (habitId: string, date: DayKey, source?: EntrySource) => EntryChange | null;

  // coach
  setEasyMode: (days: number | null) => void;
  dismissCoach: (key: string, days: number) => void;
  updateGuard: (patch: Partial<GuardConfig>) => void;
  /** Write exact values for auto-measured days (screen limits can flip from held to over). */
  setAutoEntries: (habitId: string, values: Record<DayKey, number>, source: EntrySource) => number;

  // workouts
  /** Add or replace recorded workouts (idempotent by id). Returns how many were new. */
  saveWorkouts: (list: Workout[]) => number;
  deleteWorkout: (id: string) => void;

  // gamification & profile
  markUnlocked: (ids: string[]) => void;
  setLastLevelSeen: (level: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setOnboarded: (v: boolean) => void;
  setGuest: (v: boolean) => void;
  loadDemo: (today: DayKey) => void;
  /** Throw away sample data and start fresh (keeps settings). */
  exitDemo: () => void;
  setSocialCounts: (patch: Partial<AppState['social']>) => void;
  setIntegration: <K extends keyof IntegrationState>(key: K, value: IntegrationState[K]) => void;
  bumpAiLogs: () => void;

  // sync plumbing
  applyRemote: (kind: 'habit' | 'entry' | 'workout', docs: (Habit | Entry | Workout)[], cursor: number) => void;
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
  notifyStyle: 'coach',
  quietHours: { enabled: true, start: '22:30', end: '07:30' },
  autoAlerts: true,
};

export const DEFAULT_PROFILE: Profile = {
  displayName: '',
  username: null,
  avatar: { emoji: '', color: 'lime', photoUrl: null },
  bio: null,
  goals: [],
};

/** Upgrade habits written by older versions (emoji icons, hex colours) to the current shape. */
export function normalizeHabit(raw: Habit & { emoji?: string }): Habit {
  const { emoji, ...rest } = raw;
  return { ...rest, icon: habitIconKey({ icon: raw.icon, emoji }), color: tintKey(raw.color) };
}

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
        // Record the goal this day is held to, so later target changes never rewrite history.
        const goal =
          typeof patch.goal === 'number' && patch.goal > 0
            ? patch.goal
            : typeof prev.goal === 'number' && prev.goal > 0
              ? prev.goal
              : habit.target;
        const next: Entry = {
          ...prev,
          ...patch,
          goal,
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
        workouts: {},
        unlocked: {},
        lastLevelSeen: 1,
        settings: DEFAULT_SETTINGS,
        profile: DEFAULT_PROFILE,
        onboarded: false,
        guest: false,
        demo: false,
        ownerUid: null,
        outbox: {},
        cursors: { habits: 0, entries: 0, workouts: 0 },
        social: { friends: 0, challengesJoined: 0 },
        integrations: EMPTY_INTEGRATIONS,
        aiLogs: 0,
        easyUntil: null,
        coachDismissed: {},
        guard: DEFAULT_GUARD,

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
          // Today follows the new target (past days keep the goal they were held to).
          if (patch.target !== undefined && patch.target !== prev.target) {
            const today = todayKey();
            const e = get().entries[entryId(id, today)];
            if (e && !e.deleted && (e.goal == null || e.goal === prev.target)) {
              writeEntry(id, today, () => ({ goal: patch.target }), e.source);
            }
          }
        },

        applyAdjustment: (adj) => {
          const prev = get().habits[adj.habitId];
          if (!prev) return;
          const patch: Partial<Habit> = { adjustedAt: Date.now() };
          if (adj.target !== undefined) {
            patch.target = adj.target;
            // Lowering a goal remembers where you were heading, so the coach can climb back.
            if (adj.direction === 'easier' && !prev.goalTarget) patch.goalTarget = prev.target;
          }
          if (adj.schedule) patch.schedule = adj.schedule;
          get().updateHabit(adj.habitId, patch);
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

        logTiny: (habitId, date, source = 'manual') => {
          const habit = get().habits[habitId];
          if (!habit) return null;
          const tiny = tinyVersion(habit);
          return writeEntry(
            habitId,
            date,
            (prev) => ({ value: Math.max(prev.value, tiny.amount), goal: tiny.amount, skipped: false }),
            source,
          );
        },

        // ── coach ──
        setEasyMode: (days) => set({ easyUntil: days && days > 0 ? addDays(todayKey(), days - 1) : null }),
        dismissCoach: (key, days) =>
          set((s) => {
            const now = Date.now();
            // Drop expired dismissals so this never grows without bound.
            const kept = Object.fromEntries(Object.entries(s.coachDismissed).filter(([, until]) => until > now));
            return { coachDismissed: { ...kept, [key]: now + days * 86_400_000 } };
          }),

        updateGuard: (patch) => set((s) => ({ guard: { ...s.guard, ...patch } })),

        setAutoEntries: (habitId, values, source) => {
          let changed = 0;
          for (const [date, value] of Object.entries(values)) {
            const prev = get().entries[entryId(habitId, date)];
            if (prev && !prev.deleted && prev.skipped) continue; // an intentional rest day wins
            const current = prev && !prev.deleted ? prev.value : 0;
            if (current === value) continue;
            writeEntry(habitId, date, () => ({ value }), source);
            changed++;
          }
          return changed;
        },

        // ── workouts ──
        saveWorkouts: (list) => {
          let added = 0;
          set((s) => {
            const workouts = { ...s.workouts };
            let outbox = s.outbox;
            for (const w of list) {
              if (!workouts[w.id]) added++;
              const next = { ...w, updatedAt: Math.max(monotonicNow(), (workouts[w.id]?.updatedAt ?? 0) + 1) };
              workouts[w.id] = next;
              outbox = enqueue(outbox, 'workout', w.id, next.updatedAt);
            }
            return { workouts, outbox };
          });
          return added;
        },
        deleteWorkout: (id) => {
          const prev = get().workouts[id];
          if (!prev) return;
          const updatedAt = Math.max(monotonicNow(), prev.updatedAt + 1);
          set((s) => ({
            workouts: { ...s.workouts, [id]: { ...prev, deleted: true, updatedAt } },
            outbox: enqueue(s.outbox, 'workout', id, updatedAt),
          }));
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
        loadDemo: (today) => {
          const { habits, entries } = buildDemoHistory({ idPrefix: 'demo', specs: DEMO_HABITS, today, days: 180 });
          // Pre-mark what the history already earned so loading it doesn't fire a storm of celebrations.
          const snap = computeSnapshot({
            habits,
            entries,
            today,
            weekStart: get().settings.weekStart,
            unlocked: {},
            friends: 0,
            challengesJoined: 0,
          });
          const now = Date.now();
          set({
            habits: Object.fromEntries(habits.map((h) => [h.id, h])),
            entries: Object.fromEntries(entries.map((e) => [e.id, e])),
            unlocked: Object.fromEntries(snap.newlyUnlocked.map((id) => [id, now])),
            lastLevelSeen: snap.level.level,
            profile: { ...DEFAULT_PROFILE, displayName: 'Alex' },
            onboarded: true,
            guest: true,
            demo: true,
            ownerUid: null,
            outbox: {},
            aiLogs: 0,
          });
        },
        exitDemo: () =>
          set((s) => ({
            habits: {},
            entries: {},
            workouts: {},
            unlocked: {},
            lastLevelSeen: 1,
            profile: DEFAULT_PROFILE,
            demo: false,
            outbox: {},
            aiLogs: 0,
            easyUntil: null,
            coachDismissed: {},
            settings: s.settings,
          })),
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
            const key = kind === 'habit' ? 'habits' : kind === 'entry' ? 'entries' : 'workouts';
            const coll: Record<string, Habit | Entry | Workout> = { ...s[key] };
            const outbox = { ...s.outbox };
            for (const raw of docs) {
              const local = coll[raw.id];
              if (local && local.updatedAt >= raw.updatedAt) continue; // local is newer or equal
              const doc = kind === 'habit' ? normalizeHabit(raw as Habit) : raw;
              coll[doc.id] = doc;
              delete outbox[opKey(kind, doc.id)]; // remote won last-write-wins
            }
            const cursors = { ...s.cursors, [key]: Math.max(cursor, s.cursors[key] ?? 0) };
            return { [key]: coll, outbox, cursors } as Partial<AppState>;
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
              settings: doc.settings ? { ...DEFAULT_SETTINGS, ...s.settings, ...doc.settings } : s.settings,
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
            for (const w of Object.values(s.workouts)) outbox = enqueue(outbox, 'workout', w.id, w.updatedAt);
            outbox = enqueue(outbox, 'user', 'me', monotonicNow());
            return { ownerUid: uid, guest: false, demo: false, outbox };
          });
        },

        resetForUser: (uid) =>
          set((s) => ({
            habits: {},
            entries: {},
            workouts: {},
            unlocked: {},
            lastLevelSeen: 1,
            profile: DEFAULT_PROFILE,
            onboarded: false,
            guest: false,
            demo: false,
            ownerUid: uid,
            outbox: {},
            cursors: { habits: 0, entries: 0, workouts: 0 },
            social: { friends: 0, challengesJoined: 0 },
            integrations: EMPTY_INTEGRATIONS,
            aiLogs: 0,
            easyUntil: null,
            coachDismissed: {},
            settings: s.settings,
          })),
      };
    },
    {
      name: 'ritual-app',
      version: 4,
      storage: createJSONStorage(() => zustandStorage),
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppState>;
        if (version < 2 && state.habits) {
          // 2.0 → 2.1: emoji icons became icon keys, hex colours became tint keys.
          state.habits = Object.fromEntries(
            Object.entries(state.habits).map(([id, h]) => [id, normalizeHabit(h as Habit & { emoji?: string })]),
          );
          if (state.profile) state.profile = { ...state.profile, avatar: { ...state.profile.avatar, emoji: '' } };
        }
        // New settings get their defaults without touching the ones people already chose.
        state.settings = { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) };
        state.easyUntil = state.easyUntil ?? null;
        state.coachDismissed = state.coachDismissed ?? {};
        state.guard = { ...DEFAULT_GUARD, ...(state.guard ?? {}) };
        return state as AppState;
      },
      partialize: ({
        habits,
        entries,
        workouts,
        unlocked,
        lastLevelSeen,
        settings,
        profile,
        onboarded,
        guest,
        demo,
        ownerUid,
        outbox,
        cursors,
        social,
        integrations,
        aiLogs,
        easyUntil,
        coachDismissed,
        guard,
      }) => ({
        habits,
        entries,
        workouts,
        unlocked,
        lastLevelSeen,
        settings,
        profile,
        onboarded,
        guest,
        demo,
        ownerUid,
        outbox,
        cursors,
        social,
        integrations,
        aiLogs,
        easyUntil,
        coachDismissed,
        guard,
      }),
    },
  ),
);
