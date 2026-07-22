import { describe, expect, it } from "vitest";
import { CHARACTERS, characterById, isCharacterUnlocked } from "../src/characters";
import { WORLDS } from "../src/worlds";

describe("character roster (one per world, unlocked by clearing it)", () => {
  it("has unique ids and a starter default first", () => {
    const ids = CHARACTERS.map((ch) => ch.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CHARACTERS[0]!.id).toBe("dash");
    expect(CHARACTERS[0]!.world).toBe(0);
    expect(CHARACTERS[0]!.minLevel).toBe(1);
  });

  it("covers every world exactly once, unlocking on that world's clear", () => {
    const worlds = CHARACTERS.filter((ch) => ch.world > 0).map((ch) => ch.world);
    expect(worlds.sort((a, b) => a - b)).toEqual(
      Array.from({ length: WORLDS.length }, (_, i) => i + 1),
    );
    for (const ch of CHARACTERS) {
      if (ch.world === 0) continue;
      // Clearing world N means unlockedLevel reached N*5 + 1.
      expect(ch.minLevel).toBe(ch.world * 5 + 1);
    }
  });

  it("maps the classic skins to their prescribed worlds", () => {
    expect(characterById("orb").world).toBe(2); // Crystal Caves
    expect(characterById("blaze").world).toBe(3); // Magma Core
    expect(characterById("prism").world).toBe(8); // Aurora Summit
    expect(characterById("bolt").world).toBe(10); // Volt Grid (electric)
  });

  it("falls back to the default for unknown ids", () => {
    expect(characterById("nope").id).toBe("dash");
    expect(characterById("prism").id).toBe("prism");
  });

  it("gives every character a distinct (shape, aura, trail) identity", () => {
    const triples = CHARACTERS.map((ch) => `${ch.shape}|${ch.aura.style}|${ch.trailStyle}`);
    expect(new Set(triples).size).toBe(triples.length);
    for (const ch of CHARACTERS) {
      expect(ch.aura.color).toBeGreaterThan(0);
      expect(ch.trail.length).toBeGreaterThan(0);
      expect(ch.name.length).toBeGreaterThan(2);
    }
  });

  it("unlocks by world-clear threshold", () => {
    const blaze = characterById("blaze");
    expect(isCharacterUnlocked(blaze, 15)).toBe(false); // world 3 not cleared
    expect(isCharacterUnlocked(blaze, 16)).toBe(true); // level 15 cleared
    const apex = characterById("apex");
    expect(isCharacterUnlocked(apex, 100)).toBe(false);
    expect(isCharacterUnlocked(apex, 101)).toBe(true); // full game cleared
    // A fresh save always has at least one character available.
    expect(CHARACTERS.some((ch) => isCharacterUnlocked(ch, 1))).toBe(true);
  });
});
