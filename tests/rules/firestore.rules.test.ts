/// <reference types="node" />
/**
 * Firestore security rules tests — run against the local emulator:
 *   npm run emulators        (in one terminal)
 *   npm run test:rules       (in another)
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const avatar = { emoji: '🔥', color: '#FF6A3D' };
const db = (uid?: string) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

/** Seed data bypassing rules. */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ritual-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});
afterAll(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

describe('private user data', () => {
  const habit = { id: 'h1', name: 'Read', updatedAt: 1 };

  it('lets owners read and write their own habits', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/habits/h1'), habit));
    await assertSucceeds(getDoc(doc(db('alice'), 'users/alice/habits/h1')));
  });

  it('blocks other users and anonymous access', async () => {
    await seed('users/alice/habits/h1', habit);
    await assertFails(getDoc(doc(db('mallory'), 'users/alice/habits/h1')));
    await assertFails(setDoc(doc(db('mallory'), 'users/alice/habits/h2'), { ...habit, id: 'h2' }));
    await assertFails(getDoc(doc(db(), 'users/alice/habits/h1')));
  });

  it('validates entry shape (no negative values, id must match)', async () => {
    const entry = { id: 'h1_2026-10-10', date: '2026-10-10', value: 1, updatedAt: 1 };
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/entries/h1_2026-10-10'), entry));
    await assertFails(
      setDoc(doc(db('alice'), 'users/alice/entries/h1_2026-10-11'), { ...entry, id: 'h1_2026-10-11', value: -5 }),
    );
    await assertFails(setDoc(doc(db('alice'), 'users/alice/entries/x'), entry));
  });
});

describe('usernames', () => {
  it('can be checked by anyone but only claimed for yourself', async () => {
    await assertSucceeds(getDoc(doc(db(), 'usernames/alice')));
    await assertSucceeds(setDoc(doc(db('alice'), 'usernames/alice'), { uid: 'alice' }));
    await assertFails(setDoc(doc(db('mallory'), 'usernames/bob'), { uid: 'bob' }));
  });

  it('cannot be stolen or renamed', async () => {
    await seed('usernames/alice', { uid: 'alice' });
    await assertFails(setDoc(doc(db('mallory'), 'usernames/alice'), { uid: 'mallory' }));
    await assertFails(deleteDoc(doc(db('mallory'), 'usernames/alice')));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'usernames/alice')));
  });

  it('rejects invalid handles', async () => {
    await assertFails(setDoc(doc(db('alice'), 'usernames/A B'), { uid: 'alice' }));
    await assertFails(setDoc(doc(db('alice'), 'usernames/ab'), { uid: 'alice' }));
  });
});

describe('public profiles', () => {
  const profile = (uid: string) => ({ uid, username: uid, displayName: uid, avatar, xp: 10, level: 1 });

  it('are readable by signed-in users only', async () => {
    await seed('profiles/alice', profile('alice'));
    await assertSucceeds(getDoc(doc(db('bob'), 'profiles/alice')));
    await assertFails(getDoc(doc(db(), 'profiles/alice')));
  });

  it('can only be written by their owner', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'profiles/alice'), profile('alice')));
    await assertFails(setDoc(doc(db('mallory'), 'profiles/alice'), { ...profile('alice'), xp: 999999 }));
  });
});

describe('friendships', () => {
  const pending = { uids: ['alice', 'bob'], requester: 'alice', status: 'pending' };

  it('requester creates a pending request with a canonical id', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'friendships/alice_bob'), pending));
    await assertFails(setDoc(doc(db('alice'), 'friendships/bob_alice'), pending));
    await assertFails(setDoc(doc(db('alice'), 'friendships/alice_bob'), { ...pending, status: 'accepted' }));
    await assertFails(setDoc(doc(db('mallory'), 'friendships/alice_bob'), pending));
  });

  it('only the addressee can accept', async () => {
    await seed('friendships/alice_bob', pending);
    await assertFails(updateDoc(doc(db('alice'), 'friendships/alice_bob'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(db('mallory'), 'friendships/alice_bob'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(db('bob'), 'friendships/alice_bob'), { status: 'accepted' }));
  });

  it('members can check for a request that does not exist yet (transaction pre-read)', async () => {
    await assertSucceeds(getDoc(doc(db('alice'), 'friendships/alice_bob')));
    await assertFails(getDoc(doc(db('mallory'), 'friendships/alice_bob')));
  });

  it('is private to its two members', async () => {
    await seed('friendships/alice_bob', pending);
    await assertSucceeds(getDoc(doc(db('bob'), 'friendships/alice_bob')));
    await assertFails(getDoc(doc(db('mallory'), 'friendships/alice_bob')));
  });

  it('members can list their own friendships, but not query everyone else’s', async () => {
    await seed('friendships/alice_bob', pending);
    await assertSucceeds(
      getDocs(query(collection(db('alice'), 'friendships'), where('uids', 'array-contains', 'alice'))),
    );
    await assertFails(getDocs(collection(db('mallory'), 'friendships')));
  });
});

describe('activity feed', () => {
  const post = { uid: 'alice', text: 'hit a 7-day streak', kudos: [] as string[] };

  it('users post only as themselves, with no pre-filled kudos', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'activity/a1'), post));
    await assertFails(setDoc(doc(db('mallory'), 'activity/a2'), post));
    await assertFails(setDoc(doc(db('alice'), 'activity/a3'), { ...post, kudos: ['bob', 'carol'] }));
  });

  it('others can add only their own kudos and nothing else', async () => {
    await seed('activity/a1', post);
    await assertSucceeds(updateDoc(doc(db('bob'), 'activity/a1'), { kudos: arrayUnion('bob') }));
    await assertFails(updateDoc(doc(db('bob'), 'activity/a1'), { kudos: arrayUnion('carol') }));
    await assertFails(updateDoc(doc(db('bob'), 'activity/a1'), { text: 'hacked' }));
  });
});

describe('nudges (inbox)', () => {
  const nudge = (from: string) => ({ from, type: 'nudge', text: 'You got this 💪', read: false });

  it('only friends can nudge', async () => {
    await seed('friendships/alice_bob', { uids: ['alice', 'bob'], requester: 'alice', status: 'accepted' });
    await assertSucceeds(setDoc(doc(db('alice'), 'users/bob/inbox/n1'), nudge('alice')));
    await assertFails(setDoc(doc(db('mallory'), 'users/bob/inbox/n2'), nudge('mallory')));
    await assertFails(setDoc(doc(db('alice'), 'users/bob/inbox/n3'), nudge('bob')));
  });

  it('only the owner reads the inbox, and may only mark items read', async () => {
    await seed('users/bob/inbox/n1', nudge('alice'));
    await assertFails(getDoc(doc(db('alice'), 'users/bob/inbox/n1')));
    await assertSucceeds(updateDoc(doc(db('bob'), 'users/bob/inbox/n1'), { read: true }));
    await assertFails(updateDoc(doc(db('bob'), 'users/bob/inbox/n1'), { text: 'edited' }));
  });
});

describe('challenges', () => {
  const challenge = { title: '30 Days of Code', creatorUid: 'alice', durationDays: 30, memberCount: 0 };

  it('creators start at zero members', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'challenges/c1'), challenge));
    await assertFails(setDoc(doc(db('alice'), 'challenges/c2'), { ...challenge, memberCount: 500 }));
    await assertFails(setDoc(doc(db('mallory'), 'challenges/c3'), challenge));
  });

  it('member counter moves by exactly one', async () => {
    await seed('challenges/c1', challenge);
    await assertSucceeds(updateDoc(doc(db('bob'), 'challenges/c1'), { memberCount: increment(1) }));
    await assertFails(updateDoc(doc(db('bob'), 'challenges/c1'), { memberCount: increment(50) }));
    await assertFails(updateDoc(doc(db('bob'), 'challenges/c1'), { title: 'Mine now' }));
  });

  it('members write only their own progress', async () => {
    await seed('challenges/c1', challenge);
    const me = { username: 'bob', displayName: 'Bob', avatar, daysDone: 3 };
    await assertSucceeds(setDoc(doc(db('bob'), 'challenges/c1/members/bob'), me));
    await assertFails(setDoc(doc(db('mallory'), 'challenges/c1/members/bob'), { ...me, daysDone: 0 }));
  });
});
