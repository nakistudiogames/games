import type { MergeRule } from "@mg/cloudsave";

/**
 * Which cube-dash storage keys sync to the cloud save, and how they merge
 * across devices — pure, tested. null = device-local (dev flags, dirty
 * queues, anything unknown a future version might add unreviewed).
 */

const MAX_KEYS = new Set([
  "unlockedLevel",
  "lastPlayed",
  // Stat counters can't be summed without double counting — max is the
  // best cross-device approximation.
  "totalAttempts",
  "totalDeaths",
  "totalClears",
  "totalPlayMs",
  "totalMeters",
  "nearMisses",
  "shieldSaves",
  "surgeUses",
]);

const OR_KEYS = new Set(["longNoRevive"]);

/** Cosmetic preferences: the most recently active device wins. */
const NEWER_KEYS = new Set(["character", "sfxMuted", "musicMuted", "hapticsOff", "playerName"]);

export function saveRule(key: string): MergeRule | null {
  if (MAX_KEYS.has(key)) return "max";
  if (OR_KEYS.has(key)) return "or";
  if (NEWER_KEYS.has(key)) return "newer";
  if (key.startsWith("bestPct:") || key.startsWith("attempts:")) return "max";
  if (key.startsWith("bestTimeMs:")) return "minPos";
  if (key.startsWith("ach:")) return "or";
  return null; // godMode, lbDirty, saveDirty, saveAt, unknown keys
}
