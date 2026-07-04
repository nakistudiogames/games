import { describe, expect, it } from "vitest";
import {
  betterResult,
  evaluateGuess,
  isValidGuess,
  pickAnswer,
  WORD_LENGTH,
} from "../src/logic/words";
import { ANSWERS, ALLOWED } from "../src/data/words";
import { Rng } from "@mg/core";

describe("evaluateGuess", () => {
  it("marks exact matches as hits", () => {
    expect(evaluateGuess("crane", "crane")).toEqual(["hit", "hit", "hit", "hit", "hit"]);
  });

  it("marks wrong-position letters as near and absent letters as miss", () => {
    expect(evaluateGuess("crane", "nacre")).toEqual(["near", "near", "near", "near", "hit"]);
    expect(evaluateGuess("crane", "light")).toEqual(["miss", "miss", "miss", "miss", "miss"]);
  });

  it("handles duplicate guess letters against a single answer letter", () => {
    // Answer has two Es (positions 2,3); guess EERIE has three Es.
    expect(evaluateGuess("speed", "eerie")).toEqual(["near", "near", "miss", "miss", "miss"]);
    // Both answer Es are available, so both guess Es (0 and 4) are near.
    expect(evaluateGuess("speed", "erase")).toEqual(["near", "miss", "miss", "near", "near"]);
  });

  it("does not mark a duplicate as near when hits already consumed it", () => {
    // Answer ABBEY vs BABES: B(2) and E(3) are exact hits; leading B and A are near.
    expect(evaluateGuess("abbey", "babes")).toEqual(["near", "near", "hit", "hit", "miss"]);
    // Answer MAJOR: guess ARRAY → second A/R must not double-count.
    expect(evaluateGuess("major", "array")).toEqual(["near", "near", "miss", "miss", "miss"]);
  });
});

describe("dictionary", () => {
  it("bundles the expected list sizes", () => {
    expect(ANSWERS.length).toBe(2315);
    expect(ALLOWED.size).toBe(2315 + 10657);
    expect(ANSWERS.every((w) => w.length === WORD_LENGTH)).toBe(true);
  });

  it("accepts answers and allowed guesses, rejects junk", () => {
    expect(isValidGuess("crane")).toBe(true);
    expect(isValidGuess("aahed")).toBe(true); // allowed but never an answer
    expect(isValidGuess("zzzzz")).toBe(false);
    expect(isValidGuess("cat")).toBe(false);
  });

  it("picks answers deterministically per seed from the answer list", () => {
    const w = pickAnswer(new Rng(3));
    expect(ANSWERS).toContain(w);
    expect(pickAnswer(new Rng(3))).toBe(w);
  });
});

describe("betterResult", () => {
  it("only upgrades keyboard key state", () => {
    expect(betterResult(undefined, "miss")).toBe("miss");
    expect(betterResult("miss", "near")).toBe("near");
    expect(betterResult("near", "hit")).toBe("hit");
    expect(betterResult("hit", "near")).toBe("hit");
    expect(betterResult("near", "miss")).toBe("near");
  });
});
