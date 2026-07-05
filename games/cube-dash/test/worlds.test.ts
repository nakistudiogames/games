import { describe, expect, it } from "vitest";
import { LEVELS_PER_WORLD, WORLDS, worldForLevel, worldNumberForLevel } from "../src/worlds";

describe("worlds", () => {
  it("groups levels into worlds of five", () => {
    expect(worldNumberForLevel(1)).toBe(1);
    expect(worldNumberForLevel(5)).toBe(1);
    expect(worldNumberForLevel(6)).toBe(2);
    expect(worldNumberForLevel(10)).toBe(2);
    expect(worldNumberForLevel(11)).toBe(3);
    expect(LEVELS_PER_WORLD).toBe(5);
  });

  it("cycles themes after the last world", () => {
    expect(worldForLevel(1).id).toBe("city");
    expect(worldForLevel(6).id).toBe("caves");
    expect(worldForLevel(11).id).toBe("magma");
    expect(worldForLevel(16).id).toBe("city"); // wraps around
  });

  it("has unique ids and complete 16-step music patterns", () => {
    const ids = WORLDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of WORLDS) {
      expect(w.music.bass).toHaveLength(16);
      expect(w.music.lead).toHaveLength(16);
      expect(w.music.kick).toHaveLength(16);
      expect(w.music.hat).toHaveLength(16);
      expect(w.music.bpm).toBeGreaterThan(60);
    }
  });
});
