import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  User,
  UserCredential,
} from 'firebase/auth';
import { requireFirebase } from './firebase';

/**
 * Native: the Google account picker comes from Play services, then its ID token is exchanged
 * for a Firebase session. Needs the *Web* OAuth client ID from Firebase → Auth → Google, and the
 * app's SHA-1 fingerprint registered in the Firebase project (see README → Google sign-in).
 */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleSupported = !!webClientId;

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId, profileImageSize: 400 });
  configured = true;
}

async function googleIdToken(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null; // picker dismissed
    if (!res.data.idToken) throw new Error('Google sign-in is missing its web client ID.');
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
        throw new Error('Google Play services are needed for Google sign-in on this device.');
      // DEVELOPER_ERROR (code 10) = SHA-1 / client ID mismatch in the Firebase project.
      if (String(e.code) === '10' || /DEVELOPER_ERROR/.test(String(e.message)))
        throw new Error("Google sign-in isn't set up for this build yet (SHA-1 fingerprint missing in Firebase).");
    }
    throw e;
  }
}

/** Resolves null if the person backed out of the account picker. */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const { auth } = requireFirebase();
  const idToken = await googleIdToken();
  if (!idToken) return null;
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function reauthenticateWithGoogle(user: User) {
  const idToken = await googleIdToken();
  if (!idToken) throw new Error('Cancelled');
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
}

export async function signOutGoogle() {
  if (!configured) return;
  await GoogleSignin.signOut().catch(() => {});
}
