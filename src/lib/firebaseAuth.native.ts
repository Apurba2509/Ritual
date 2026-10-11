import type { FirebaseApp } from 'firebase/app';
import { Auth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { asyncKV } from './storage';

/** Native: persist the Firebase session in MMKV so users stay signed in across launches. */
export function createAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, { persistence: getReactNativePersistence(asyncKV) });
}
