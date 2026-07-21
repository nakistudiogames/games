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

export interface FirebaseHandle {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  /** Anonymous-auth uid — the document key for all per-player data. */
  uid: string;
}

let handle: Promise<FirebaseHandle> | null = null;

/**
 * Loads the SDK, initializes the app, and signs in anonymously — memoized
 * as a promise so concurrent callers share one init.
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
    const cred = auth.currentUser ?? (await signInAnonymously(auth)).user;
    return { app, db, auth, uid: cred.uid };
  })();
  return handle;
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
