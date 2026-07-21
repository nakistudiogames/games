/**
 * Cube-dash-specific leaderboard domain logic — pure, no Firebase imports
 * (vitest-safe). Shared pieces (names, formatting, dirty queue, paths) live
 * in @mg/leaderboard; the Firebase-backed service in leaderboard.ts.
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
