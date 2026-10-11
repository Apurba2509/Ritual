import type { User } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { requireFirebase } from '@/lib/firebase';
import { useApp } from './store';
import { sync } from './sync';

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { db, auth } = requireFirebase();
  const snap = await getDoc(doc(db, 'usernames', username));
  return !snap.exists() || snap.data()?.uid === auth.currentUser?.uid;
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

/** "Apurba Das" / "apurba.das2509@gmail.com" → "apurbadas" (always a valid username stem). */
export function usernameStem(source: string): string {
  const base = source
    .split('@')[0]
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 14);
  return base.length >= 3 ? base : `${base}ritual`.slice(0, 14);
}

/** Google profile photos come tiny (s96) by default — ask for a crisp one. */
export function largerGooglePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/=s\d+-c$/, '=s400-c');
}

let pendingName: string | null = null;
/** Lets email sign-up hand over the typed name before Firebase reports the new user. */
export function setPendingDisplayName(name: string | null) {
  pendingName = name;
}

let ensuring: Promise<void> | null = null;

/**
 * Fill in whatever the profile is missing from the auth account — name and photo from Google,
 * and an auto-generated username — so nobody has to fill out a form to get started.
 */
export function ensureProfile(user: User): Promise<void> {
  if (ensuring) return ensuring;
  ensuring = (async () => {
    const app = useApp.getState();
    const name = app.profile.displayName || pendingName || user.displayName || '';
    const patch: Parameters<typeof app.updateProfile>[0] = {};
    if (!app.profile.displayName && name) patch.displayName = name.trim();
    const photo = largerGooglePhoto(user.photoURL);
    if (!app.profile.avatar.photoUrl && photo) patch.avatar = { ...app.profile.avatar, photoUrl: photo };
    if (Object.keys(patch).length) app.updateProfile(patch);

    if (!useApp.getState().profile.username) {
      const stem = usernameStem(name || user.email || 'ritual');
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = attempt === 0 ? stem : `${stem}${Math.floor(10 + Math.random() * (attempt < 3 ? 90 : 9990))}`;
        try {
          if (await isUsernameAvailable(candidate)) {
            await claimUsername(candidate);
            break;
          }
        } catch {
          // taken in a race or offline — try the next candidate; Account lets people fix it later
        }
      }
    }
    sync.schedulePublish();
  })().finally(() => {
    ensuring = null;
    pendingName = null;
  });
  return ensuring;
}
