import { GameStorage } from "@mg/core";
import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { firebaseConfig, firebaseConfigured } from "./firebaseConfig";
import { computeOverall, randomHandle, validName } from "./leaderboardCore";
import type { LevelEntry, OverallEntry } from "./leaderboardCore";

/**
 * Leaderboard service: Firestore + anonymous Firebase Auth behind an
 * interface with a Noop fallback (same pattern as @mg/ads), so the game is
 * bit-identical when offline or unconfigured. The Firebase SDK is loaded
 * lazily on first use — it never touches the initial bundle or vitest.
 *
 * Firestore layout:
 *   players/{uid}            { name }
 *   levels/{n}/scores/{uid}  { name, timeMs, at }   (each player's best only)
 *   overall/{uid}            { name, highestLevel, totalTimeMs, at }
 */
export interface LeaderboardService {
  /** False = unconfigured (Noop): UI shows a "not configured" state. */
  readonly ready: boolean;
  getName(): string;
  setName(name: string): Promise<void>;
  submitLevel(level: number, timeMs: number): Promise<void>;
  submitOverall(): Promise<void>;
  /** Retries anything that failed to submit (offline etc.). */
  syncDirty(): Promise<void>;
  topLevel(level: number, limit: number): Promise<LevelEntry[]>;
  topOverall(limit: number): Promise<OverallEntry[]>;
  /** 1-based world rank for my best on this level, or null. */
  myLevelRank(level: number): Promise<number | null>;
  /** My auth uid once signed in (for own-row highlighting), or null. */
  myUid(): string | null;
}

// Own GameStorage instance (same namespace) — importing MenuScene's export
// here would create an import cycle.
const store = new GameStorage("cube-dash");

interface Dirty {
  levels: number[];
  overall: boolean;
}

function getDirty(): Dirty {
  return store.get<Dirty>("lbDirty", { levels: [], overall: false });
}

function markDirty(patch: Partial<Dirty>): void {
  const d = getDirty();
  if (patch.levels) d.levels = [...new Set([...d.levels, ...patch.levels])];
  if (patch.overall) d.overall = true;
  store.set("lbDirty", d);
}

function localName(): string {
  let name = store.get("playerName", "");
  if (!name) {
    name = randomHandle();
    store.set("playerName", name);
  }
  return name;
}

/** Snapshot of local bests for computeOverall. */
function localBests(): Map<number, { pct: number; timeMs?: number }> {
  const bests = new Map<number, { pct: number; timeMs?: number }>();
  for (let level = 1; level <= 100; level++) {
    const pct = store.get(`bestPct:${level}`, 0);
    if (pct <= 0) continue;
    const timeMs = store.get(`bestTimeMs:${level}`, 0);
    bests.set(level, { pct, timeMs: timeMs > 0 ? timeMs : undefined });
  }
  return bests;
}

class NoopLeaderboard implements LeaderboardService {
  readonly ready = false;
  getName(): string {
    return localName();
  }
  async setName(name: string): Promise<void> {
    if (validName(name)) store.set("playerName", name.trim());
  }
  async submitLevel(): Promise<void> {}
  async submitOverall(): Promise<void> {}
  async syncDirty(): Promise<void> {}
  async topLevel(): Promise<LevelEntry[]> {
    return [];
  }
  async topOverall(): Promise<OverallEntry[]> {
    return [];
  }
  async myLevelRank(): Promise<number | null> {
    return null;
  }
  myUid(): string | null {
    return null;
  }
}

class FirebaseLeaderboard implements LeaderboardService {
  readonly ready = true;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private uid: string | null = null;

  /** Lazily loads the SDK, initializes the app, signs in anonymously. */
  private async init(): Promise<{ db: Firestore; uid: string }> {
    if (this.db && this.uid) return { db: this.db, uid: this.uid };
    const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore }] =
      await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);
    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    this.db = getFirestore(app);
    const cred = this.auth.currentUser ?? (await signInAnonymously(this.auth)).user;
    this.uid = cred.uid;
    return { db: this.db, uid: this.uid };
  }

  myUid(): string | null {
    return this.uid;
  }

  getName(): string {
    return localName();
  }

  async setName(name: string): Promise<void> {
    if (!validName(name)) return;
    const trimmed = name.trim();
    store.set("playerName", trimmed);
    try {
      const { db, uid } = await this.init();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "players", uid), { name: trimmed }, { merge: true });
      // Overall row carries the visible name — refresh it too.
      await this.submitOverall();
    } catch {
      // Local name is saved; remote copies update on the next sync/submit.
    }
  }

  async submitLevel(level: number, timeMs: number): Promise<void> {
    try {
      const { db, uid } = await this.init();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "levels", String(level), "scores", uid), {
        name: localName(),
        timeMs,
        at: Date.now(),
      });
    } catch {
      markDirty({ levels: [level] });
    }
  }

  async submitOverall(): Promise<void> {
    const { highestLevel, totalTimeMs } = computeOverall(localBests());
    if (highestLevel <= 0) return;
    try {
      const { db, uid } = await this.init();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "overall", uid), {
        name: localName(),
        highestLevel,
        totalTimeMs,
        at: Date.now(),
      });
    } catch {
      markDirty({ overall: true });
    }
  }

  async syncDirty(): Promise<void> {
    const d = getDirty();
    if (d.levels.length === 0 && !d.overall) return;
    store.set("lbDirty", { levels: [], overall: false } satisfies Dirty);
    for (const level of d.levels) {
      const timeMs = store.get(`bestTimeMs:${level}`, 0);
      if (timeMs > 0) await this.submitLevel(level, timeMs); // re-marks on failure
    }
    if (d.overall) await this.submitOverall();
  }

  async topLevel(level: number, limitN: number): Promise<LevelEntry[]> {
    const { db } = await this.init();
    const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
    const snap = await getDocs(
      query(collection(db, "levels", String(level), "scores"), orderBy("timeMs", "asc"), limit(limitN)),
    );
    return snap.docs.map((d) => ({
      uid: d.id,
      name: String(d.data().name ?? "???"),
      timeMs: Number(d.data().timeMs ?? 0),
    }));
  }

  async topOverall(limitN: number): Promise<OverallEntry[]> {
    const { db } = await this.init();
    const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
    const snap = await getDocs(
      query(
        collection(db, "overall"),
        orderBy("highestLevel", "desc"),
        orderBy("totalTimeMs", "asc"),
        limit(limitN),
      ),
    );
    return snap.docs.map((d) => ({
      uid: d.id,
      name: String(d.data().name ?? "???"),
      highestLevel: Number(d.data().highestLevel ?? 0),
      totalTimeMs: Number(d.data().totalTimeMs ?? 0),
    }));
  }

  async myLevelRank(level: number): Promise<number | null> {
    const mine = store.get(`bestTimeMs:${level}`, 0);
    if (mine <= 0) return null;
    try {
      const { db } = await this.init();
      const { collection, getCountFromServer, query, where } = await import("firebase/firestore");
      const snap = await getCountFromServer(
        query(collection(db, "levels", String(level), "scores"), where("timeMs", "<", mine)),
      );
      return snap.data().count + 1;
    } catch {
      return null;
    }
  }
}

let instance: LeaderboardService | null = null;

/** The app-wide leaderboard (Noop until Firebase is configured). */
export function leaderboard(): LeaderboardService {
  instance ??= firebaseConfigured() ? new FirebaseLeaderboard() : new NoopLeaderboard();
  return instance;
}
