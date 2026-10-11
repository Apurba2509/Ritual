import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  User,
  UserCredential,
} from 'firebase/auth';
import { requireFirebase } from './firebase';

/** Web: Firebase's own popup flow — no extra configuration needed beyond enabling the provider. */
export const googleSupported = true;

function provider() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

/** Resolves null if the person closed the popup. */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const { auth } = requireFirebase();
  try {
    return await signInWithPopup(auth, provider());
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    // Some mobile browsers block popups — fall back to a full-page redirect.
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider());
      return null;
    }
    throw e;
  }
}

export async function reauthenticateWithGoogle(user: User) {
  await reauthenticateWithPopup(user, provider());
}

export async function signOutGoogle() {
  // nothing cached on web beyond the Firebase session itself
}
