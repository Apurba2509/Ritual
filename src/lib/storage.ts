import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * MMKV is a synchronous, memory-mapped key-value store (~30× faster than AsyncStorage).
 * Synchronous reads mean the app state is hydrated before the first frame — no loading
 * flash, no "empty list then data" flicker.
 */
export const storage = createMMKV({ id: 'ritual' });

export const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};

/** Async facade used by Firebase Auth's React Native persistence. */
export const asyncKV = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  setItem: async (key: string, value: string) => storage.set(key, value),
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};
