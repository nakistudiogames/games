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
  apiKey: "AIzaSyAZ-vBRCPrJYxjm2IUfa2G6zZw96yR1OMU",
  authDomain: "dash-937de.firebaseapp.com",
  projectId: "dash-937de",
  storageBucket: "dash-937de.firebasestorage.app",
  messagingSenderId: "659438372273",
  appId: "1:659438372273:web:b98f92ad37d5ce46636990",
  measurementId: "G-6E86VV1CP3"
};

/** True once real values are pasted in. */
export function firebaseConfigured(): boolean {
  return firebaseConfig.projectId !== "PASTE_ME";
}

// const analytics = getAnalytics(app);