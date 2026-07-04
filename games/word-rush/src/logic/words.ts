import type { Rng } from "@mg/core";
import { ALLOWED, ANSWERS } from "../data/words";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type LetterResult = "hit" | "near" | "miss";

/**
 * Classic Wordle evaluation with correct duplicate-letter handling:
 * exact matches are consumed first, then remaining answer letters satisfy
 * "near" marks left to right. E.g. answer SPEED vs guess EERIE →
 * near, near, miss, miss, miss (only two Es in the answer to give).
 */
export function evaluateGuess(answer: string, guess: string): LetterResult[] {
  const a = answer.toLowerCase();
  const g = guess.toLowerCase();
  const result: LetterResult[] = new Array<LetterResult>(g.length).fill("miss");
  const remaining: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "hit";
    } else {
      remaining[a[i]!] = (remaining[a[i]!] ?? 0) + 1;
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "hit") continue;
    const ch = g[i]!;
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = "near";
      remaining[ch]!--;
    }
  }
  return result;
}

export function isValidGuess(guess: string): boolean {
  return guess.length === WORD_LENGTH && ALLOWED.has(guess.toLowerCase());
}

export function pickAnswer(rng: Rng): string {
  return rng.pick(ANSWERS);
}

/** Ranks keyboard key states so a key only ever upgrades (miss < near < hit). */
export function betterResult(a: LetterResult | undefined, b: LetterResult): LetterResult {
  const rank: Record<LetterResult, number> = { miss: 0, near: 1, hit: 2 };
  return a !== undefined && rank[a] >= rank[b] ? a : b;
}
