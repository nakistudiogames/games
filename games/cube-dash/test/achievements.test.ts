import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../src/achievements";
import type { PlayerStats } from "../src/achievements";

const emptyStats = (over: Partial<PlayerStats> = {}): PlayerStats => ({
  cleared: new Set<number>(),
  totalClears: 0,
  totalMeters: 0,
  nearMisses: 0,
  shieldSaves: 0,
  slowmoUses: 0,
  longNoRevive: false,
  ...over,
});

describe("achievements", () => {
  it("has unique ids and real names/descriptions", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.desc.length).toBeGreaterThan(10);
    }
  });

  it("none are satisfied by a fresh profile", () => {
    const s = emptyStats();
    for (const a of ACHIEVEMENTS) {
      expect(a.check(s), a.id).toBe(false);
    }
  });

  it("world achievements need every level of the world", () => {
    const w1 = ACHIEVEMENTS.find((a) => a.id === "world-1")!;
    expect(w1.check(emptyStats({ cleared: new Set([1, 2, 3, 4]) }))).toBe(false);
    expect(w1.check(emptyStats({ cleared: new Set([1, 2, 3, 4, 5]) }))).toBe(true);
    const w20 = ACHIEVEMENTS.find((a) => a.id === "world-20")!;
    expect(w20.check(emptyStats({ cleared: new Set([96, 97, 98, 99, 100]) }))).toBe(true);
  });

  it("threshold achievements trip at their thresholds", () => {
    const by = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
    expect(by("first-clear").check(emptyStats({ totalClears: 1 }))).toBe(true);
    expect(by("daredevil").check(emptyStats({ nearMisses: 99 }))).toBe(false);
    expect(by("daredevil").check(emptyStats({ nearMisses: 100 }))).toBe(true);
    expect(by("traveler").check(emptyStats({ totalMeters: 10_000 }))).toBe(true);
    expect(by("marathon").check(emptyStats({ longNoRevive: true }))).toBe(true);
    expect(by("guardian").check(emptyStats({ shieldSaves: 1 }))).toBe(true);
    expect(by("timebender").check(emptyStats({ slowmoUses: 1 }))).toBe(true);
    expect(by("halfway").check(emptyStats({ cleared: new Set([50]) }))).toBe(true);
  });
});
