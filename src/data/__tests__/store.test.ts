import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store persists to MMKV and makes ids with expo-crypto — stub both for Node.
vi.mock('react-native-mmkv', () => {
  const mem = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (k: string) => mem.get(k),
      set: (k: string, v: string) => mem.set(k, v),
      remove: (k: string) => mem.delete(k),
    }),
  };
});
vi.mock('expo-crypto', () => ({ randomUUID: () => Math.random().toString(16).slice(2).padEnd(32, '0') }));

const { useApp } = await import('../store');

const base = {
  icon: 'flower-lotus',
  color: 'lilac',
  kind: 'check' as const,
  target: 1,
  unit: null,
  schedule: { type: 'daily' as const },
  reminders: [],
  auto: null,
  category: null,
  difficulty: 'medium' as const,
  intention: null,
  challengeId: null,
};

describe('local-first store', () => {
  beforeEach(() => useApp.getState().resetForUser(null));

  it('queues every mutation in the outbox', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'Meditate' });
    useApp.getState().toggleDone(id, '2026-10-10');
    const keys = Object.keys(useApp.getState().outbox);
    expect(keys).toContain(`habit:${id}`);
    expect(keys).toContain(`entry:${id}_2026-10-10`);
  });

  it('reports when an entry crosses its target', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'Water', kind: 'count', target: 3, unit: 'glasses' });
    expect(useApp.getState().addToEntry(id, '2026-10-10', 2)!.isDone).toBe(false);
    const change = useApp.getState().addToEntry(id, '2026-10-10', 1)!;
    expect(change.wasDone).toBe(false);
    expect(change.isDone).toBe(true);
    expect(change.entry.completedAt).not.toBeNull();
  });

  it('tombstones emptied entries so deletes sync', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'Read' });
    useApp.getState().toggleDone(id, '2026-10-10');
    useApp.getState().toggleDone(id, '2026-10-10');
    expect(useApp.getState().entries[`${id}_2026-10-10`].deleted).toBe(true);
  });

  it('never lowers a manual value with integration data', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'Walk', kind: 'count', target: 8000, unit: 'steps' });
    useApp.getState().setEntry(id, '2026-10-09', { value: 9000 });
    const changed = useApp.getState().mergeAutoEntries(id, { '2026-10-09': 4000, '2026-10-10': 8500 }, 'health');
    expect(changed).toBe(1);
    expect(useApp.getState().entries[`${id}_2026-10-09`].value).toBe(9000);
    expect(useApp.getState().entries[`${id}_2026-10-10`].source).toBe('health');
  });
});

describe('sync merge (last-write-wins)', () => {
  beforeEach(() => useApp.getState().resetForUser('u1'));

  it('accepts newer remote docs and drops the stale outbox op', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'Local' });
    const local = useApp.getState().habits[id];
    useApp.getState().applyRemote('habit', [{ ...local, name: 'From phone', updatedAt: local.updatedAt + 1000 }], 5);
    expect(useApp.getState().habits[id].name).toBe('From phone');
    expect(useApp.getState().outbox[`habit:${id}`]).toBeUndefined();
    expect(useApp.getState().cursors.habits).toBe(5);
  });

  it('keeps newer local edits over older remote docs', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'Newest' });
    const local = useApp.getState().habits[id];
    useApp.getState().applyRemote('habit', [{ ...local, name: 'Old', updatedAt: local.updatedAt - 1000 }], 1);
    expect(useApp.getState().habits[id].name).toBe('Newest');
    expect(useApp.getState().outbox[`habit:${id}`]).toBeDefined();
  });

  it('only acks outbox ops whose version is unchanged', () => {
    const id = useApp.getState().createHabit({ ...base, name: 'A' });
    const sent = { ...useApp.getState().outbox[`habit:${id}`] };
    useApp.getState().updateHabit(id, { name: 'B' }); // edited while the batch was in flight
    useApp.getState().ackOutbox([sent]);
    expect(useApp.getState().outbox[`habit:${id}`]).toBeDefined();
    useApp.getState().ackOutbox([useApp.getState().outbox[`habit:${id}`]]);
    expect(useApp.getState().outbox[`habit:${id}`]).toBeUndefined();
  });

  it('migrates guest data into a new account', () => {
    useApp.getState().resetForUser(null);
    useApp.getState().setGuest(true);
    const id = useApp.getState().createHabit({ ...base, name: 'Guest habit' });
    useApp.getState().toggleDone(id, '2026-10-10');
    useApp.setState({ outbox: {} }); // pretend nothing was queued
    useApp.getState().adoptLocalData('new-user');
    const s = useApp.getState();
    expect(s.ownerUid).toBe('new-user');
    expect(s.guest).toBe(false);
    expect(Object.keys(s.outbox)).toEqual(expect.arrayContaining([`habit:${id}`, `entry:${id}_2026-10-10`, 'user:me']));
  });
});
