/**
 * @mg/firebase — lazy Firebase app init + anonymous auth for the shared
 * project. The SDK is only ever loaded via dynamic import, so it stays out
 * of initial bundles and vitest; games that never call getFirebase() ship
 * without it.
 *
 * All games reuse ONE Firebase project (config committed per game — a web
 * config is public by design; access control lives in firestore.rules,
 * deployed from the repo-root firebase/ directory).
 */
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

export type { Auth, Firestore };

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/** True once real values are pasted in (placeholders say "PASTE_ME"). */
export function firebaseConfigured(config: FirebaseConfig): boolean {
  return config.projectId !== "PASTE_ME";
}

/**
 * Firestore path convention for the shared project: every game's data lives
 * under games/{gameId}/... so titles never collide. Spread into doc() or
 * collection(): doc(db, ...gamePath("cube-dash", "players", uid)).
 */
export function gamePath(gameId: string, ...segments: string[]): [string, ...string[]] {
  return ["games", gameId, ...segments];
}

export interface FirebaseHandle {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  /**
   * Current auth uid — the document key for all per-player data. A live
   * getter (not a snapshot): linking/sign-in can change the uid mid-session.
   */
  readonly uid: string;
}

let handle: Promise<FirebaseHandle> | null = null;

/**
 * Loads the SDK, initializes the app, and ensures a signed-in user (the
 * persisted session if one exists — Google/Apple included — else a fresh
 * anonymous one). Memoized as a promise so concurrent callers share one init.
 */
export function getFirebase(config: FirebaseConfig): Promise<FirebaseHandle> {
  handle ??= (async () => {
    const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore }] =
      await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);
    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    // Wait for session restoration BEFORE deciding to mint an anonymous
    // user, or a persisted (possibly Google/Apple) session gets clobbered.
    await auth.authStateReady();
    const initialUid = auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
    return {
      app,
      db,
      auth,
      get uid(): string {
        return auth.currentUser?.uid ?? initialUid;
      },
    };
  })();
  return handle;
}

// ---- Login (provider-agnostic; Firebase Auth handles Google and Apple
// through the same API — only the provider object differs) ----

export type AuthProviderId = "google.com" | "apple.com";

export interface AuthProviderSpec {
  id: AuthProviderId;
  label: string;
  /** False until the provider is configured in the Firebase console. */
  enabled: boolean;
}

/**
 * Providers the games offer, in display order. Apple flips to enabled once
 * the Apple Developer Services ID is configured in the Firebase console
 * (required by App Store rules when Google sign-in ships on iOS) — no code
 * changes beyond this flag.
 */
export const AUTH_PROVIDERS: readonly AuthProviderSpec[] = [
  { id: "google.com", label: "Google", enabled: true },
  { id: "apple.com", label: "Apple", enabled: false },
];

export interface AuthUser {
  uid: string;
  /** True for the silent anonymous identity (not logged in). */
  isAnonymous: boolean;
  /** Display name from the provider, if any. */
  name: string | null;
}

/** The current user, or null before getFirebase() has ever resolved. */
export async function authUser(config: FirebaseConfig): Promise<AuthUser> {
  const { auth, uid } = await getFirebase(config);
  const u = auth.currentUser;
  return { uid, isAnonymous: u?.isAnonymous ?? true, name: u?.displayName ?? null };
}

export interface SignInResult {
  user: AuthUser;
  /**
   * True when the login landed on a DIFFERENT uid than before (the account
   * already existed, e.g. from another device) — callers must re-sync any
   * per-uid data. False when the anonymous account was upgraded in place.
   */
  uidChanged: boolean;
}

/**
 * Interactive login via a popup (web; native shells will use a plugin later).
 * An anonymous session is UPGRADED in place (uid — and with it leaderboard
 * rows — preserved); if the account already exists elsewhere, signs into it
 * instead (uidChanged: true). Returns null if the player closed the popup.
 */
export async function signInWith(
  config: FirebaseConfig,
  providerId: AuthProviderId,
): Promise<SignInResult | null> {
  const { auth } = await getFirebase(config);
  const {
    GoogleAuthProvider,
    OAuthProvider,
    linkWithPopup,
    signInWithCredential,
    signInWithPopup,
  } = await import("firebase/auth");
  const provider =
    providerId === "google.com" ? new GoogleAuthProvider() : new OAuthProvider(providerId);
  const before = auth.currentUser;
  try {
    const user = before?.isAnonymous
      ? (await linkWithPopup(before, provider)).user
      : (await signInWithPopup(auth, provider)).user;
    return {
      user: { uid: user.uid, isAnonymous: false, name: user.displayName },
      uidChanged: user.uid !== before?.uid,
    };
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    if (code === "auth/credential-already-in-use") {
      // This Google/Apple account is already a Firebase user (from another
      // device/install): sign into it, abandoning the anonymous uid.
      const cred =
        providerId === "google.com"
          ? GoogleAuthProvider.credentialFromError(e as Parameters<typeof GoogleAuthProvider.credentialFromError>[0])
          : OAuthProvider.credentialFromError(e as Parameters<typeof OAuthProvider.credentialFromError>[0]);
      if (cred) {
        const { user } = await signInWithCredential(auth, cred);
        return {
          user: { uid: user.uid, isAnonymous: false, name: user.displayName },
          uidChanged: true,
        };
      }
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return null;
    }
    throw e;
  }
}

/**
 * Logs out and drops back to a FRESH anonymous identity (the pre-login
 * anonymous uid is not recoverable), so leaderboards/saves keep working.
 */
export async function signOutToAnonymous(config: FirebaseConfig): Promise<AuthUser> {
  const { auth } = await getFirebase(config);
  const { signInAnonymously, signOut } = await import("firebase/auth");
  await signOut(auth);
  const { user } = await signInAnonymously(auth);
  return { uid: user.uid, isAnonymous: true, name: null };
}

let fs: Promise<typeof import("firebase/firestore")> | null = null;

/**
 * The firebase/firestore module itself (doc, setDoc, query, ...), loaded
 * lazily and memoized — so games never import "firebase/*" directly.
 */
export function firestore(): Promise<typeof import("firebase/firestore")> {
  fs ??= import("firebase/firestore");
  return fs;
}
