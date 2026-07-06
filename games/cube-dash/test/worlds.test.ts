import { describe, expect, it } from "vitest";
import { LEVELS_PER_WORLD, WORLDS, worldForLevel, worldNumberForLevel } from "../src/worlds";
import { KIND_UNLOCK_LEVEL } from "../src/logic/runner";

describe("worlds", () => {
  it("groups levels into worlds of five", () => {
    expect(worldNumberForLevel(1)).toBe(1);
    expect(worldNumberForLevel(5)).toBe(1);
    expect(worldNumberForLevel(6)).toBe(2);
    expect(worldNumberForLevel(10)).toBe(2);
    expect(worldNumberForLevel(11)).toBe(3);
    expect(LEVELS_PER_WORLD).toBe(5);
  });

  it("maps levels 1-100 onto the twenty worlds, then cycles", () => {
    expect(WORLDS).toHaveLength(20);
    expect(worldForLevel(1).id).toBe("city");
    expect(worldForLevel(6).id).toBe("caves");
    expect(worldForLevel(11).id).toBe("magma");
    expect(worldForLevel(16).id).toBe("frost");
    expect(worldForLevel(21).id).toBe("swamp");
    expect(worldForLevel(26).id).toBe("dunes");
    expect(worldForLevel(31).id).toBe("abyss");
    expect(worldForLevel(36).id).toBe("aurora");
    expect(worldForLevel(41).id).toBe("mirage");
    expect(worldForLevel(46).id).toBe("verdant");
    expect(worldForLevel(51).id).toBe("foundry");
    expect(worldForLevel(56).id).toBe("storm");
    expect(worldForLevel(61).id).toBe("citadel");
    expect(worldForLevel(66).id).toBe("coral");
    expect(worldForLevel(71).id).toBe("bones");
    expect(worldForLevel(76).id).toBe("vault");
    expect(worldForLevel(81).id).toBe("obsidian");
    expect(worldForLevel(86).id).toBe("forge");
    expect(worldForLevel(91).id).toBe("nebula");
    expect(worldForLevel(96).id).toBe("apex");
    expect(worldForLevel(100).id).toBe("apex");
    expect(worldForLevel(101).id).toBe("city"); // wraps around
  });

  it("has unique ids, unique silhouettes, and complete 16-step music patterns", () => {
    const ids = WORLDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sils = WORLDS.map((w) => w.silhouette);
    expect(new Set(sils).size).toBe(sils.length);
    for (const w of WORLDS) {
      expect(w.music.bass).toHaveLength(16);
      expect(w.music.lead).toHaveLength(16);
      expect(w.music.kick).toHaveLength(16);
      expect(w.music.hat).toHaveLength(16);
      expect(w.music.bpm).toBeGreaterThan(60);
    }
  });

  it("MANDATORY: every world introduces an obstacle kind no earlier world had", () => {
    // Rule for adding worlds: each new WORLDS entry must come with a new
    // ObstacleKind unlocking at that world's first level (KIND_UNLOCK_LEVEL)
    // and an intro pattern gated to it (see runner.test.ts).
    const introWorlds = new Set(
      Object.values(KIND_UNLOCK_LEVEL).map(
        (lvl) => Math.floor((lvl - 1) / LEVELS_PER_WORLD) + 1,
      ),
    );
    for (let w = 1; w <= WORLDS.length; w++) {
      expect(introWorlds.has(w)).toBe(true);
    }
  });
});
