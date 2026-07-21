import type { FirebaseConfig } from "@mg/firebase";

/**
 * Firebase web config for the SHARED project (dash-937de) all games use.
 * Kept per-game so a breakout title can move to its own project later by
 * just changing this file. A Firebase WEB config is public by design (the
 * apiKey is an identifier, not a secret — access control lives in the
 * repo-root firebase/firestore.rules), so committing real values is fine.
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyAZ-vBRCPrJYxjm2IUfa2G6zZw96yR1OMU",
  authDomain: "dash-937de.firebaseapp.com",
  projectId: "dash-937de",
  storageBucket: "dash-937de.firebasestorage.app",
  messagingSenderId: "659438372273",
  appId: "1:659438372273:web:b98f92ad37d5ce46636990",
  measurementId: "G-6E86VV1CP3"
};
