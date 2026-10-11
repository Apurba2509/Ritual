/// <reference types="node" />
/**
 * Seeds the local Firebase emulators with demo accounts and ~10 weeks of realistic history.
 *
 *   npm run emulators            # terminal 1
 *   npm run seed                 # terminal 2
 *
 * Then sign in to the app (with EXPO_PUBLIC_FIREBASE_EMULATOR_HOST set) as demo@ritual.dev.
 * EMULATOR ONLY — these are throwaway local test accounts.
 */
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { addDays, fromDayKey, todayKey, weekId } from '../src/domain/dates';
import { computeSnapshot } from '../src/domain/snapshot';
import type { Entry, Habit } from '../src/domain/types';
import { DEMO_PASSWORD } from './emulator-config';

const app = initializeApp({
  apiKey: 'demo-key',
  projectId: 'demo-ritual',
  appId: 'demo-app',
  authDomain: 'demo-ritual.firebaseapp.com',
});
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8085);

type Spec = Pick<
  Habit,
  'name' | 'emoji' | 'color' | 'kind' | 'target' | 'unit' | 'schedule' | 'difficulty' | 'category'
> & {
  rate: number;
  reminders?: string[];
  auto?: Habit['auto'];
};

interface Person {
  email: string;
  username: string;
  displayName: string;
  avatar: { emoji: string; color: string };
  bio: string;
  habits: Spec[];
}

const PEOPLE: Person[] = [
  {
    email: 'demo@ritual.dev',
    username: 'demo',
    displayName: 'Apurba',
    avatar: { emoji: '🔥', color: '#FF6A3D' },
    bio: 'Shipping code and habits daily.',
    habits: [
      {
        name: 'Code every day',
        emoji: '👨‍💻',
        color: '#14B8A6',
        kind: 'check',
        target: 1,
        unit: null,
        schedule: { type: 'daily' },
        difficulty: 'medium',
        category: 'career',
        rate: 0.9,
        reminders: ['18:00'],
      },
      {
        name: 'Solve a LeetCode problem',
        emoji: '🧩',
        color: '#F59E0B',
        kind: 'count',
        target: 1,
        unit: 'problems',
        schedule: { type: 'daily' },
        difficulty: 'hard',
        category: 'career',
        rate: 0.72,
        reminders: ['21:00'],
      },
      {
        name: 'Walk 8,000 steps',
        emoji: '🚶',
        color: '#22C55E',
        kind: 'count',
        target: 8000,
        unit: 'steps',
        schedule: { type: 'daily' },
        difficulty: 'medium',
        category: 'fitness',
        rate: 0.78,
      },
      {
        name: 'Meditate',
        emoji: '🧘',
        color: '#8B5CF6',
        kind: 'duration',
        target: 10,
        unit: 'min',
        schedule: { type: 'daily' },
        difficulty: 'medium',
        category: 'mind',
        rate: 0.82,
        reminders: ['07:30'],
      },
      {
        name: 'Work out',
        emoji: '🏋️',
        color: '#FF6A3D',
        kind: 'duration',
        target: 30,
        unit: 'min',
        schedule: { type: 'weekly', times: 4 },
        difficulty: 'hard',
        category: 'fitness',
        rate: 0.6,
      },
      {
        name: 'Read',
        emoji: '📖',
        color: '#3B82F6',
        kind: 'count',
        target: 20,
        unit: 'pages',
        schedule: { type: 'days', days: [1, 2, 3, 4, 5] },
        difficulty: 'medium',
        category: 'learning',
        rate: 0.7,
      },
    ],
  },
  {
    email: 'maya@ritual.dev',
    username: 'maya',
    displayName: 'Maya',
    avatar: { emoji: '🌸', color: '#D946EF' },
    bio: 'Marathon in March 🏃‍♀️',
    habits: [
      {
        name: 'Go for a run',
        emoji: '🏃',
        color: '#FF6A3D',
        kind: 'check',
        target: 1,
        unit: null,
        schedule: { type: 'days', days: [1, 3, 5, 6] },
        difficulty: 'hard',
        category: 'fitness',
        rate: 0.88,
      },
      {
        name: 'Drink water',
        emoji: '💧',
        color: '#06B6D4',
        kind: 'count',
        target: 8,
        unit: 'glasses',
        schedule: { type: 'daily' },
        difficulty: 'easy',
        category: 'health',
        rate: 0.93,
      },
      {
        name: 'Stretch',
        emoji: '🤸',
        color: '#22C55E',
        kind: 'duration',
        target: 10,
        unit: 'min',
        schedule: { type: 'daily' },
        difficulty: 'easy',
        category: 'fitness',
        rate: 0.8,
      },
    ],
  },
  {
    email: 'rohan@ritual.dev',
    username: 'rohan',
    displayName: 'Rohan',
    avatar: { emoji: '🚀', color: '#3B82F6' },
    bio: 'DSA grind until offer letter.',
    habits: [
      {
        name: 'Solve a LeetCode problem',
        emoji: '🧩',
        color: '#F59E0B',
        kind: 'count',
        target: 2,
        unit: 'problems',
        schedule: { type: 'daily' },
        difficulty: 'hard',
        category: 'career',
        rate: 0.85,
      },
      {
        name: 'Code every day',
        emoji: '👨‍💻',
        color: '#14B8A6',
        kind: 'check',
        target: 1,
        unit: null,
        schedule: { type: 'daily' },
        difficulty: 'medium',
        category: 'career',
        rate: 0.8,
      },
      {
        name: 'Sleep 7+ hours',
        emoji: '😴',
        color: '#6366F1',
        kind: 'duration',
        target: 420,
        unit: 'min',
        schedule: { type: 'daily' },
        difficulty: 'medium',
        category: 'health',
        rate: 0.55,
      },
    ],
  },
  {
    email: 'kenji@ritual.dev',
    username: 'kenji',
    displayName: 'Kenji',
    avatar: { emoji: '🍵', color: '#84CC16' },
    bio: 'Slow and steady.',
    habits: [
      {
        name: 'Journal',
        emoji: '✍️',
        color: '#D946EF',
        kind: 'check',
        target: 1,
        unit: null,
        schedule: { type: 'daily' },
        difficulty: 'easy',
        category: 'mind',
        rate: 0.75,
      },
      {
        name: 'Practice Japanese',
        emoji: '🗣️',
        color: '#84CC16',
        kind: 'duration',
        target: 15,
        unit: 'min',
        schedule: { type: 'daily' },
        difficulty: 'medium',
        category: 'learning',
        rate: 0.9,
      },
    ],
  },
];

// Deterministic PRNG so the demo looks the same on every machine.
let seed = 42;
const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

const DAYS = 70;
const NOTES = [
  'Felt great today',
  'Hard start, strong finish',
  'Did it before work',
  'Almost skipped — glad I didn’t',
  'New personal best!',
];

function buildHistory(uid: string, specs: Spec[]) {
  const today = todayKey();
  const start = addDays(today, -DAYS);
  const created = fromDayKey(start).getTime();
  const habits: Habit[] = specs.map((s, i) => ({
    id: `${uid.slice(0, 6)}h${i}`,
    name: s.name,
    emoji: s.emoji,
    color: s.color,
    kind: s.kind,
    target: s.target,
    unit: s.unit,
    schedule: s.schedule,
    reminders: s.reminders ?? [],
    auto: s.auto ?? null,
    category: s.category,
    difficulty: s.difficulty,
    intention: null,
    order: i,
    archived: false,
    challengeId: null,
    createdAt: created,
    updatedAt: Date.now(),
  }));

  const entries: Entry[] = [];
  for (const h of habits) {
    const spec = specs[habits.indexOf(h)];
    // Momentum: consistency improves over time (more recent = more likely), with a slump in week 3.
    for (let i = DAYS; i >= 0; i--) {
      const day = addDays(today, -i);
      const wd = new Date(`${day}T12:00:00`).getDay();
      if (h.schedule.type === 'days' && !h.schedule.days.includes(wd)) continue;
      if (h.schedule.type === 'weekly' && rand() > h.schedule.times / 7 + 0.1) continue;
      const progress = 1 - i / DAYS;
      const slump = i > 45 && i < 52 ? 0.35 : 0;
      const p = Math.min(0.98, spec.rate * (0.75 + 0.35 * progress) - slump);
      if (i === 0 && rand() > 0.5) continue; // today partially done
      if (rand() > p) continue;
      const value = h.kind === 'check' ? 1 : Math.round(h.target * (1 + rand() * 0.4));
      const completedAt = new Date(`${day}T${String(6 + Math.floor(rand() * 15)).padStart(2, '0')}:15:00`).getTime();
      entries.push({
        id: `${h.id}_${day}`,
        habitId: h.id,
        date: day,
        value,
        skipped: false,
        note: rand() > 0.9 ? NOTES[Math.floor(rand() * NOTES.length)] : null,
        mood: rand() > 0.6 ? ((3 + Math.floor(rand() * 3)) as Entry['mood']) : null,
        photoUrl: null,
        source:
          h.name.includes('LeetCode') || h.name.includes('Code') ? (rand() > 0.3 ? 'github' : 'manual') : 'manual',
        completedAt,
        updatedAt: completedAt,
      });
    }
  }
  return { habits, entries };
}

async function ensureUser(email: string) {
  try {
    return (await createUserWithEmailAndPassword(auth, email, DEMO_PASSWORD)).user;
  } catch {
    return (await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD)).user;
  }
}

async function resetEmulators() {
  await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-ritual/databases/(default)/documents', {
    method: 'DELETE',
  });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-ritual/accounts', { method: 'DELETE' });
}

async function main() {
  await resetEmulators();
  const uids: Record<string, string> = {};
  const snapshots: Record<string, ReturnType<typeof computeSnapshot>> = {};

  for (const person of PEOPLE) {
    const user = await ensureUser(person.email);
    const uid = user.uid;
    uids[person.username] = uid;
    const { habits, entries } = buildHistory(uid, person.habits);
    const today = todayKey();
    const snap = computeSnapshot({
      habits,
      entries,
      today,
      weekStart: 1,
      unlocked: {},
      friends: 3,
      challengesJoined: 1,
    });
    snapshots[person.username] = snap;
    const unlocked = Object.fromEntries(snap.newlyUnlocked.map((id) => [id, Date.now()]));
    const final = computeSnapshot({ habits, entries, today, weekStart: 1, unlocked, friends: 3, challengesJoined: 1 });

    const writes: [string, Record<string, unknown>][] = [
      ...habits.map(
        (h) =>
          [`users/${uid}/habits/${h.id}`, { ...h, serverUpdatedAt: serverTimestamp() }] as [
            string,
            Record<string, unknown>,
          ],
      ),
      ...entries.map(
        (e) =>
          [`users/${uid}/entries/${e.id}`, { ...e, serverUpdatedAt: serverTimestamp() }] as [
            string,
            Record<string, unknown>,
          ],
      ),
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      writes.slice(i, i + 400).forEach(([path, data]) => batch.set(doc(db, path), data));
      await batch.commit();
    }
    await setDoc(doc(db, 'usernames', person.username), { uid, createdAt: serverTimestamp() });
    await setDoc(doc(db, 'users', uid), {
      profile: {
        displayName: person.displayName,
        username: person.username,
        avatar: person.avatar,
        bio: person.bio,
        goals: [],
      },
      settings: { weekStart: 1 },
      onboarded: true,
      unlocked,
      integrations: { github: null, leetcode: null },
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'profiles', uid), {
      uid,
      username: person.username,
      displayName: person.displayName,
      avatar: person.avatar,
      bio: person.bio,
      xp: final.xp,
      level: final.level.level,
      weeklyXP: final.weeklyXP,
      weekId: weekId(today),
      streak: final.bestStreak.days,
      perfectRun: final.perfectRun,
      totalCompletions: final.totalCompletions,
      achievements: Object.keys(unlocked).length,
      activeHabits: habits.length,
      updatedAt: serverTimestamp(),
    });
    console.log(
      `✔ ${person.displayName} (@${person.username}) — ${habits.length} habits, ${entries.length} check-ins, level ${final.level.level}, ${final.xp} XP`,
    );
    await signOut(auth);
  }

  // Friendships: demo ↔ everyone (accepted), maya ↔ rohan; kenji → demo pending would be redundant.
  const pair = (a: string, b: string) => [uids[a], uids[b]].sort();
  const friendships: [string, string, 'accepted' | 'pending'][] = [
    ['maya', 'demo', 'accepted'],
    ['rohan', 'demo', 'accepted'],
    ['kenji', 'demo', 'pending'],
    ['maya', 'rohan', 'accepted'],
  ];
  for (const [requester, other, status] of friendships) {
    await signInWithEmailAndPassword(auth, `${requester}@ritual.dev`, DEMO_PASSWORD);
    const ids = pair(requester, other);
    await setDoc(doc(db, 'friendships', ids.join('_')), {
      uids: ids,
      requester: uids[requester],
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await signOut(auth);
    if (status === 'accepted') {
      await signInWithEmailAndPassword(auth, `${other}@ritual.dev`, DEMO_PASSWORD);
      await setDoc(
        doc(db, 'friendships', ids.join('_')),
        { status: 'accepted', updatedAt: serverTimestamp() },
        { merge: true },
      );
      await signOut(auth);
    }
  }

  // Activity feed posts
  const posts: [string, string, string, number][] = [
    ['maya', '🏃', 'hit a 21-day streak on Go for a run', 3],
    ['rohan', '🧩', 'unlocked “Unbreakable”', 7],
    ['maya', '⚡', 'reached level 9', 20],
    ['rohan', '🌟', 'completed 7 perfect days in a row', 30],
    ['demo', '👨‍💻', 'hit a 30-day streak on Code every day', 50],
    ['kenji', '🗣️', 'joined the "30 Days of Code" challenge', 90],
  ];
  for (const [who, emoji, text, minsAgo] of posts) {
    await signInWithEmailAndPassword(auth, `${who}@ritual.dev`, DEMO_PASSWORD);
    const p = PEOPLE.find((x) => x.username === who)!;
    await addDoc(collection(db, 'activity'), {
      uid: uids[who],
      username: who,
      displayName: p.displayName,
      avatar: p.avatar,
      type: 'milestone',
      emoji,
      text,
      kudos: [],
      createdAt: Timestamp.fromMillis(Date.now() - minsAgo * 60_000),
    });
    await signOut(auth);
  }

  // A public challenge that demo, maya and rohan have joined
  await signInWithEmailAndPassword(auth, 'rohan@ritual.dev', DEMO_PASSWORD);
  const today = todayKey();
  const challengeRef = await addDoc(collection(db, 'challenges'), {
    title: '30 Days of Code',
    description: 'Ship something every day for a month. Commits, PRs, LeetCode — it all counts.',
    emoji: '👨‍💻',
    color: '#14B8A6',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    durationDays: 30,
    startDate: addDays(today, -12),
    endDate: addDays(today, 17),
    creatorUid: uids.rohan,
    creatorName: 'Rohan',
    memberCount: 0,
    isPublic: true,
    createdAt: serverTimestamp(),
  });
  await signOut(auth);
  const members: [string, number, number][] = [
    ['rohan', 12, 12],
    ['maya', 9, 4],
    ['demo', 11, 8],
  ];
  for (const [who, daysDone, streak] of members) {
    await signInWithEmailAndPassword(auth, `${who}@ritual.dev`, DEMO_PASSWORD);
    const p = PEOPLE.find((x) => x.username === who)!;
    await setDoc(doc(db, 'challenges', challengeRef.id, 'members', uids[who]), {
      username: who,
      displayName: p.displayName,
      avatar: p.avatar,
      daysDone,
      streak,
      lastDay: today,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // counter moves by exactly 1 per join (enforced by rules)
    await updateDoc(doc(db, 'challenges', challengeRef.id), { memberCount: increment(1) });
    await signOut(auth);
  }

  console.log(`\nSeeded. Sign in as demo@ritual.dev (password in scripts/emulator-config.ts).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
