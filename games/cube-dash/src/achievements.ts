import type { GameStorage } from "@mg/core";
import { LEVELS_PER_WORLD } from "./logic/runner";

/**
 * Achievements — pure data + pure checks over a stats snapshot, no Phaser.
 * Grants are persisted as "ach:<id>" flags; newlyEarned() is the only
 * function that writes.
 */

export interface PlayerStats {
  /** Levels with a 100% best (cleared at least once). */
  cleared: ReadonlySet<number>;
  totalClears: number;
  totalMeters: number;
  nearMisses: number;
  shieldSaves: number;
  surgeUses: number;
  /** Ever cleared a 45s+ level without using the rewarded revive. */
  longNoRevive: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: (s: PlayerStats) => boolean;
}

/** True when every level of the 1-based world is cleared. */
function worldCleared(s: PlayerStats, world: number): boolean {
  const first = (world - 1) * LEVELS_PER_WORLD + 1;
  for (let lvl = first; lvl < first + LEVELS_PER_WORLD; lvl++) {
    if (!s.cleared.has(lvl)) return false;
  }
  return true;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-clear", name: "First Steps", desc: "Clear your first level", check: (s) => s.totalClears >= 1 },
  { id: "world-1", name: "Neon Graduate", desc: "Clear all of Neon City (levels 1-5)", check: (s) => worldCleared(s, 1) },
  { id: "world-4", name: "Frost Conqueror", desc: "Clear all of Frost Ridge (levels 16-20)", check: (s) => worldCleared(s, 4) },
  { id: "world-8", name: "Aurora Ascendant", desc: "Clear all of Aurora Summit (levels 36-40)", check: (s) => worldCleared(s, 8) },
  { id: "world-12", name: "Storm Chaser", desc: "Clear all of Storm Shelf (levels 56-60)", check: (s) => worldCleared(s, 12) },
  { id: "world-16", name: "Vault Breaker", desc: "Clear all of Neon Vault (levels 76-80)", check: (s) => worldCleared(s, 16) },
  { id: "world-20", name: "Chrome Champion", desc: "Clear all of Chrome Apex (levels 96-100)", check: (s) => worldCleared(s, 20) },
  { id: "halfway", name: "Halfway There", desc: "Clear level 50", check: (s) => s.cleared.has(50) },
  { id: "marathon", name: "Marathoner", desc: "Clear a 45s+ level without a revive", check: (s) => s.longNoRevive },
  { id: "daredevil", name: "Daredevil", desc: "Survive 100 near-misses", check: (s) => s.nearMisses >= 100 },
  { id: "guardian", name: "Guardian Angel", desc: "Let a shield absorb a hit", check: (s) => s.shieldSaves >= 1 },
  { id: "surgerider", name: "Surge Rider", desc: "Pick up a Speed Surge", check: (s) => s.surgeUses >= 1 },
  { id: "traveler", name: "World Traveler", desc: "Run 10,000m in total", check: (s) => s.totalMeters >= 10_000 },
];

/** Snapshot of everything the checks need, read from storage. */
export function collectStats(storage: GameStorage): PlayerStats {
  const cleared = new Set<number>();
  for (let lvl = 1; lvl <= 100; lvl++) {
    if (storage.get(`bestPct:${lvl}`, 0) >= 100) cleared.add(lvl);
  }
  return {
    cleared,
    totalClears: storage.get("totalClears", 0),
    totalMeters: storage.get("totalMeters", 0),
    nearMisses: storage.get("nearMisses", 0),
    shieldSaves: storage.get("shieldSaves", 0),
    surgeUses: storage.get("surgeUses", 0),
    longNoRevive: storage.get("longNoRevive", false),
  };
}

export function isEarned(storage: GameStorage, id: string): boolean {
  return storage.get(`ach:${id}`, false);
}

/** Grants every newly-satisfied achievement and returns them (for toasts). */
export function newlyEarned(storage: GameStorage): Achievement[] {
  const stats = collectStats(storage);
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!isEarned(storage, a.id) && a.check(stats)) {
      storage.set(`ach:${a.id}`, true);
      fresh.push(a);
    }
  }
  return fresh;
}
