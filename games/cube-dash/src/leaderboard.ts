import { GameStorage } from "@mg/core";
import { firebaseConfigured, firestore, getFirebase } from "@mg/firebase";
import type { Firestore } from "@mg/firebase";
import { DirtySet, gamePath, localName, validName } from "@mg/leaderboard";
import { firebaseConfig } from "./firebaseConfig";
import { computeOverall } from "./leaderboardCore";
import type { LevelEntry, OverallEntry } from "./leaderboardCore";

/**
 * Cube-dash leaderboard service: Firestore + anonymous Firebase Auth behind
 * an interface with a Noop fallback (same pattern as @mg/ads), so the game is
 * bit-identical when offline or unconfigured. SDK loading/auth live in
 * @mg/firebase (lazy — never in the initial bundle or vitest); shared domain
 * logic (names, dirty queue, path convention) in @mg/leaderboard.
 *
 * Firestore layout (shared project, namespaced per game):
 *   games/cube-dash/players/{uid}            { name }
 *   games/cube-dash/levels/{n}/scores/{uid}  { name, timeMs, at }   (best only)
 *   games/cube-dash/overall/{uid}            { name, highestLevel, totalTimeMs, at }
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

const GAME_ID = "cube-dash";

// Own GameStorage instance (same namespace) — importing MenuScene's export
// here would create an import cycle.
const store = new GameStorage(GAME_ID);
const dirty = new DirtySet(store);

/** Rules rejected the write (e.g. remote already holds a better time). */
function isPermissionDenied(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === "permission-denied";
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
    return localName(store);
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
  private uid: string | null = null;

  private async init(): Promise<{ db: Firestore; uid: string }> {
    const { db, uid } = await getFirebase(firebaseConfig);
    this.uid = uid;
    return { db, uid };
  }

  myUid(): string | null {
    return this.uid;
  }

  getName(): string {
    return localName(store);
  }

  async setName(name: string): Promise<void> {
    if (!validName(name)) return;
    const trimmed = name.trim();
    store.set("playerName", trimmed);
    try {
      const { db, uid } = await this.init();
      const { doc, setDoc } = await firestore();
      await setDoc(doc(db, ...gamePath(GAME_ID, "players", uid)), { name: trimmed }, { merge: true });
      // Overall row carries the visible name — refresh it too.
      await this.submitOverall();
    } catch {
      // Local name is saved; remote copies update on the next sync/submit.
    }
  }

  async submitLevel(level: number, timeMs: number): Promise<void> {
    try {
      const { db, uid } = await this.init();
      const { doc, setDoc } = await firestore();
      await setDoc(doc(db, ...gamePath(GAME_ID, "levels", String(level), "scores", uid)), {
        name: localName(store),
        timeMs,
        at: Date.now(),
      });
    } catch (e) {
      // Rules reject non-improvements (another device was faster): remote is
      // already better, so retrying forever would never succeed — drop it.
      if (!isPermissionDenied(e)) dirty.add(`level:${level}`);
    }
  }

  async submitOverall(): Promise<void> {
    const { highestLevel, totalTimeMs } = computeOverall(localBests());
    if (highestLevel <= 0) return;
    try {
      const { db, uid } = await this.init();
      const { doc, setDoc } = await firestore();
      await setDoc(doc(db, ...gamePath(GAME_ID, "overall", uid)), {
        name: localName(store),
        highestLevel,
        totalTimeMs,
        at: Date.now(),
      });
    } catch (e) {
      if (!isPermissionDenied(e)) dirty.add("overall");
    }
  }

  async syncDirty(): Promise<void> {
    for (const tag of dirty.take()) {
      if (tag === "overall") {
        await this.submitOverall(); // re-adds itself on failure
      } else if (tag.startsWith("level:")) {
        const level = Number(tag.slice("level:".length));
        const timeMs = store.get(`bestTimeMs:${level}`, 0);
        if (level >= 1 && timeMs > 0) await this.submitLevel(level, timeMs);
      }
    }
  }

  async topLevel(level: number, limitN: number): Promise<LevelEntry[]> {
    const { db } = await this.init();
    const { collection, getDocs, limit, orderBy, query } = await firestore();
    const snap = await getDocs(
      query(
        collection(db, ...gamePath(GAME_ID, "levels", String(level), "scores")),
        orderBy("timeMs", "asc"),
        limit(limitN),
      ),
    );
    return snap.docs.map((d) => ({
      uid: d.id,
      name: String(d.data().name ?? "???"),
      timeMs: Number(d.data().timeMs ?? 0),
    }));
  }

  async topOverall(limitN: number): Promise<OverallEntry[]> {
    const { db } = await this.init();
    const { collection, getDocs, limit, orderBy, query } = await firestore();
    const snap = await getDocs(
      query(
        collection(db, ...gamePath(GAME_ID, "overall")),
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
      const { collection, getCountFromServer, query, where } = await firestore();
      const snap = await getCountFromServer(
        query(
          collection(db, ...gamePath(GAME_ID, "levels", String(level), "scores")),
          where("timeMs", "<", mine),
        ),
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
  instance ??= firebaseConfigured(firebaseConfig) ? new FirebaseLeaderboard() : new NoopLeaderboard();
  return instance;
}
