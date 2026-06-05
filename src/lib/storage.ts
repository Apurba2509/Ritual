import { MMKV } from 'react-native-mmkv';

// @ts-ignore
export const storage = new MMKV({
  id: 'ritual-global-storage',
  encryptionKey: 'ritual-super-secure-key' // In a real app, securely generate and store this
});

export const getStorageItem = <T>(key: string): T | null => {
  const value = storage.getString(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as any as T;
  }
};

export const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof value === 'string') {
    storage.set(key, value);
  } else {
    storage.set(key, JSON.stringify(value));
  }
};

export const removeStorageItem = (key: string): void => {
  storage.delete(key);
};
