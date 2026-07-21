/**
 * Leaderboard domain logic — pure, no Firebase imports (vitest-safe).
 * The Firebase-backed service lives in leaderboard.ts.
 */

export interface LevelEntry {
  uid: string;
  name: string;
  timeMs: number;
}

export interface OverallEntry {
  uid: string;
  name: string;
  highestLevel: number;
  totalTimeMs: number;
}

export const NAME_MIN = 3;
export const NAME_MAX = 20;

/** True when a display name is acceptable (also enforced by Firestore rules). */
export function validName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
}

const ADJECTIVES = [
  "Swift", "Neon", "Turbo", "Cosmic", "Blazing", "Frosty", "Shadow", "Golden",
  "Rapid", "Mighty", "Sonic", "Lucky", "Stellar", "Rogue", "Hyper", "Prime",
];
const NOUNS = [
  "Prism", "Cube", "Comet", "Dasher", "Bolt", "Nova", "Vector", "Pixel",
  "Racer", "Spark", "Falcon", "Rocket", "Glider", "Phantom", "Meteor", "Blade",
];

/**
 * Anonymous-but-friendly handle, e.g. "SwiftPrism42". `rand` defaults to
 * Math.random; injectable for deterministic tests.
 */
export function randomHandle(rand: () => number = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)]!;
  const num = 10 + Math.floor(rand() * 90);
  return `${adj}${noun}${num}`;
}

/**
 * Overall standing from local bests: highest CLEARED level, and the sum of
 * best clear times across all cleared levels (missing times — clears from
 * before time-tracking existed — contribute 0).
 */
export function computeOverall(
  bests: ReadonlyMap<number, { pct: number; timeMs?: number }>,
): { highestLevel: number; totalTimeMs: number } {
  let highestLevel = 0;
  let totalTimeMs = 0;
  for (const [level, b] of bests) {
    if (b.pct < 100) continue;
    if (level > highestLevel) highestLevel = level;
    totalTimeMs += b.timeMs ?? 0;
  }
  return { highestLevel, totalTimeMs };
}

/** "1:23.4" (m:ss.t); hours are unrealistic for clear times, minutes cap it. */
export function formatTimeMs(ms: number): string {
  const totalTenths = Math.round(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`
    : `${seconds}.${tenths}s`;
}
