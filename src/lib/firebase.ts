import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, initializeFirestore } from 'firebase/firestore';
import { createAuth } from './firebaseAuth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** The app is fully usable offline/guest without Firebase; cloud features light up when configured. */
export const isFirebaseConfigured = !!(config.apiKey && config.projectId && config.appId);

/**
 * Local development against the Firebase Emulator Suite (`npm run emulators`).
 * Set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=localhost (Android: also `adb reverse tcp:9099 tcp:9099` and tcp:8085).
 */
const EMULATOR_HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
export const usingEmulators = !!EMULATOR_HOST;

interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: FirebaseHandles | null = null;

export function firebase(): FirebaseHandles | null {
  if (!isFirebaseConfigured) return null;
  if (handles) return handles;
  const app = getApps()[0] ?? initializeApp(config);
  const auth = createAuth(app);
  // Long-polling auto-detection keeps realtime listeners reliable on React Native networks.
  const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
  if (EMULATOR_HOST) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8085);
  }
  handles = { app, auth, db };
  return handles;
}

/** Throws if Firebase isn't configured — use in code paths that are only reachable with an account. */
export function requireFirebase(): FirebaseHandles {
  const h = firebase();
  if (!h) throw new Error('Cloud features are not configured.');
  return h;
}
