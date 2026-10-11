import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDocs,
  increment,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebase, requireFirebase } from '@/lib/firebase';
import { reauthenticateWithGoogle, signInWithGoogle, signOutGoogle } from '@/lib/googleAuth';
import { cancelAllReminders } from '@/features/notifications/scheduler';
import { setPendingDisplayName } from './identity';
import { useApp } from './store';
import { sync } from './sync';

export { claimUsername, isUsernameAvailable, normalizeUsername, USERNAME_RE } from './identity';

/** Human-friendly messages for Firebase Auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks off.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.';
    case 'auth/weak-password':
      return 'Use at least 8 characters for your password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Take a breather and try again in a minute.';
    case 'auth/network-request-failed':
      return "You're offline. Connect to the internet and try again.";
    case 'auth/requires-recent-login':
      return 'For security, please sign in again first.';
    case 'auth/account-exists-with-different-credential':
      return 'This email already uses a password. Sign in with email, then link Google from Account.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the project yet.';
    case 'auth/unauthorized-domain':
      return "This website isn't allowed to use Google sign-in yet.";
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow popups and try again.';
    default:
      return (err as Error)?.message?.replace(/^Firebase: /, '') || 'Something went wrong.';
  }
}

export async function signUp(params: { email: string; password: string; displayName: string }) {
  const { auth } = requireFirebase();
  const name = params.displayName.trim();
  setPendingDisplayName(name);
  const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  await fbUpdateProfile(cred.user, { displayName: name });
  useApp.getState().updateProfile({ displayName: name });
  sendEmailVerification(cred.user).catch(() => {});
}

/** One tap: Google account → Firebase session. Resolves false if the person cancelled. */
export async function continueWithGoogle(): Promise<boolean> {
  const cred = await signInWithGoogle();
  return !!cred;
}

export async function signIn(email: string, password: string) {
  const { auth } = requireFirebase();
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetPassword(email: string) {
  const { auth } = requireFirebase();
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOut() {
  const { auth } = requireFirebase();
  // Give pending changes a moment to reach the server before local data is cleared.
  await Promise.race([sync.flush(), new Promise((r) => setTimeout(r, 4000))]);
  sync.stop();
  await cancelAllReminders();
  useApp.getState().resetForUser(null);
  await signOutGoogle();
  await fbSignOut(auth);
}

/** How the signed-in account authenticates — decides how we ask for re-authentication. */
export function signInMethod(): 'google' | 'password' | null {
  const user = firebase()?.auth.currentUser;
  if (!user) return null;
  return user.providerData.some((p) => p.providerId === 'password') ? 'password' : 'google';
}

/** Permanently delete the account and all cloud data (Play Store & GDPR requirement). */
export async function deleteAccount(password?: string) {
  const { auth, db } = requireFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  if (signInMethod() === 'password') {
    if (!user.email || !password) throw new Error('Enter your password to confirm.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await reauthenticateWithGoogle(user);
  }
  const uid = user.uid;
  sync.stop();

  const deleteAll = async (refs: { ref: DocumentReference }[]) => {
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  };
  for (const sub of ['habits', 'entries', 'workouts', 'inbox']) {
    await deleteAll((await getDocs(collection(db, 'users', uid, sub))).docs);
  }
  // Public traces: feed posts, friendships and challenge memberships.
  await deleteAll((await getDocs(query(collection(db, 'activity'), where('uid', '==', uid)))).docs).catch(() => {});
  await deleteAll(
    (await getDocs(query(collection(db, 'friendships'), where('uids', 'array-contains', uid)))).docs,
  ).catch(() => {});
  const challengeIds = new Set(
    Object.values(useApp.getState().habits)
      .map((h) => h.challengeId)
      .filter((c): c is string => !!c),
  );
  for (const cid of challengeIds) {
    await runTransaction(db, async (tx) => {
      const member = doc(db, 'challenges', cid, 'members', uid);
      if (!(await tx.get(member)).exists()) return;
      tx.delete(member);
      tx.update(doc(db, 'challenges', cid), { memberCount: increment(-1) });
    }).catch(() => {});
  }
  const username = useApp.getState().profile.username;
  if (username) await deleteDoc(doc(db, 'usernames', username)).catch(() => {});
  await deleteDoc(doc(db, 'profiles', uid)).catch(() => {});
  await deleteDoc(doc(db, 'users', uid));
  await cancelAllReminders();
  useApp.getState().resetForUser(null);
  await signOutGoogle();
  await deleteUser(user);
}
