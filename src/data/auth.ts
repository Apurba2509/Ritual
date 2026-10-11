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
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { requireFirebase } from '@/lib/firebase';
import { cancelAllReminders } from '@/features/notifications/scheduler';
import { useSession } from './session';
import { useApp } from './store';
import { sync } from './sync';

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

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
      return 'For security, please enter your password again.';
    default:
      return (err as Error)?.message?.replace(/^Firebase: /, '') || 'Something went wrong.';
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { db } = requireFirebase();
  const snap = await getDoc(doc(db, 'usernames', username));
  return !snap.exists() || snap.data()?.uid === useSession.getState().user?.uid;
}

/** Atomically reserve a username for the signed-in user (releasing their old one). */
export async function claimUsername(username: string) {
  const { db, auth } = requireFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!USERNAME_RE.test(username)) throw new Error('Usernames are 3–20 characters: letters, numbers, _ or .');
  const previous = useApp.getState().profile.username;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'usernames', username);
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().uid !== uid) throw new Error('That username is taken.');
    tx.set(ref, { uid, createdAt: serverTimestamp() });
    if (previous && previous !== username) tx.delete(doc(db, 'usernames', previous));
  });
  useApp.getState().updateProfile({ username });
  sync.schedulePublish();
}

export async function signUp(params: { email: string; password: string; displayName: string; username: string }) {
  const { auth } = requireFirebase();
  const username = normalizeUsername(params.username);
  if (!USERNAME_RE.test(username)) throw new Error('Usernames are 3–20 characters: letters, numbers, _ or .');
  if (!(await isUsernameAvailable(username))) throw new Error('That username is taken.');

  const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  await fbUpdateProfile(cred.user, { displayName: params.displayName.trim() });
  useApp.getState().updateProfile({ displayName: params.displayName.trim() });
  await claimUsername(username);
  sendEmailVerification(cred.user).catch(() => {});
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
  await fbSignOut(auth);
}

/** Permanently delete the account and all cloud data (Play Store & GDPR requirement). */
export async function deleteAccount(password: string) {
  const { auth, db } = requireFirebase();
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const uid = user.uid;
  sync.stop();

  for (const sub of ['habits', 'entries', 'inbox']) {
    const snap = await getDocs(collection(db, 'users', uid, sub));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  const username = useApp.getState().profile.username;
  if (username) await deleteDoc(doc(db, 'usernames', username)).catch(() => {});
  await deleteDoc(doc(db, 'profiles', uid)).catch(() => {});
  await deleteDoc(doc(db, 'users', uid));
  await cancelAllReminders();
  useApp.getState().resetForUser(null);
  await deleteUser(user);
}
