import type { FirebaseApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

/** Web: getAuth() uses IndexedDB → localStorage persistence by default. */
export function createAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}
