import { describe, expect, it } from "vitest";
import { CHARACTERS, characterById, isCharacterUnlocked } from "../src/characters";

describe("character roster", () => {
  it("has unique ids and a level-1 default first", () => {
    const ids = CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CHARACTERS[0]!.id).toBe("dash");
    expect(CHARACTERS[0]!.minLevel).toBe(1);
  });

  it("falls back to the default for unknown ids", () => {
    expect(characterById("nope").id).toBe("dash");
    expect(characterById("prism").id).toBe("prism");
  });

  it("gives every character a unique aura style", () => {
    const styles = CHARACTERS.map((c) => c.aura.style);
    expect(new Set(styles).size).toBe(styles.length);
    for (const c of CHARACTERS) expect(c.aura.color).toBeGreaterThan(0);
  });

  it("unlocks by unlockedLevel threshold", () => {
    const blaze = characterById("blaze");
    expect(isCharacterUnlocked(blaze, 1)).toBe(false);
    expect(isCharacterUnlocked(blaze, 2)).toBe(true);
    // A fresh save always has at least one character available.
    expect(CHARACTERS.some((c) => isCharacterUnlocked(c, 1))).toBe(true);
  });
});
