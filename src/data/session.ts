import { onAuthStateChanged, User } from 'firebase/auth';
import { create } from 'zustand';
import { todayKey } from '@/domain/dates';
import { firebase } from '@/lib/firebase';
import { ensureProfile } from './identity';
import { useApp } from './store';
import { pullUserDoc, sync } from './sync';

export type SessionStatus = 'booting' | 'signedOut' | 'loading' | 'ready';

export interface SessionUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  provider: 'google' | 'password' | 'other';
}

export const useSession = create<{ status: SessionStatus; user: SessionUser | null }>(() => ({
  status: 'booting',
  user: null,
}));

const toSessionUser = (u: User): SessionUser => ({
  uid: u.uid,
  email: u.email,
  emailVerified: u.emailVerified,
  provider: u.providerData.some((p) => p.providerId === 'password')
    ? 'password'
    : u.providerData.some((p) => p.providerId === 'google.com')
      ? 'google'
      : 'other',
});

async function handleSignedIn(user: User) {
  const app = useApp.getState();
  useSession.setState({ user: toSessionUser(user) });

  if (app.ownerUid === user.uid) {
    useSession.setState({ status: 'ready' });
    sync.start(user.uid);
    ensureProfile(user).catch(() => {});
    return;
  }

  const hasLocalData = Object.values(app.habits).some((h) => !h.deleted);
  if (app.ownerUid === null && !app.demo && (app.guest || hasLocalData)) {
    // A guest just created/linked an account: their local history moves to the cloud.
    app.adoptLocalData(user.uid);
    useSession.setState({ status: 'ready' });
    sync.start(user.uid);
    ensureProfile(user).catch(() => {});
    return;
  }

  // Fresh device or a different account: start clean, fetch the profile before routing
  // so a returning user doesn't see onboarding again.
  app.resetForUser(user.uid);
  useSession.setState({ status: 'loading' });
  try {
    await pullUserDoc(user.uid);
  } catch {
    // offline — routing falls back to local state
  }
  useSession.setState({ status: 'ready' });
  sync.start(user.uid);
  ensureProfile(user).catch(() => {});
}

let started = false;

/** Called once from the root layout. */
export function startSession() {
  if (started) return;
  started = true;
  const fb = firebase();
  if (!fb) {
    useSession.setState({ status: useApp.getState().guest ? 'ready' : 'signedOut' });
    return;
  }
  onAuthStateChanged(fb.auth, (user) => {
    if (user) {
      handleSignedIn(user);
    } else {
      sync.stop();
      useSession.setState({ user: null, status: useApp.getState().guest ? 'ready' : 'signedOut' });
    }
  });
}

/** Enter the app without an account — optionally with sample data to look around. */
export function continueAsGuest(opts: { demo?: boolean } = {}) {
  const app = useApp.getState();
  if (app.ownerUid) app.resetForUser(null);
  if (opts.demo) app.loadDemo(todayKey());
  app.setGuest(true);
  useSession.setState({ status: 'ready' });
}

/** Drop the sample data and go back to the welcome screen. */
export function leaveDemo() {
  const app = useApp.getState();
  app.exitDemo();
  app.setGuest(false);
  useSession.setState({ status: 'signedOut' });
}

export const isSignedIn = () => !!useSession.getState().user;
