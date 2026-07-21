/**
 * Firebase web config — paste the real values from the Firebase console
 * following docs/firebase-setup.md. Until then the placeholders below keep
 * the leaderboard in "not configured" mode and the game fully playable.
 *
 * NOTE: a Firebase WEB config is public by design (the apiKey is an
 * identifier, not a secret — access control lives in firestore.rules), so
 * committing the real values is fine.
 */
export const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME.firebaseapp.com",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME.firebasestorage.app",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME",
};

/** True once real values are pasted in. */
export function firebaseConfigured(): boolean {
  return firebaseConfig.projectId !== "PASTE_ME";
}
