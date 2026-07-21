import { describe, expect, it } from "vitest";
import {
  NAME_MAX,
  NAME_MIN,
  computeOverall,
  formatTimeMs,
  randomHandle,
  validName,
} from "../src/leaderboardCore";

describe("leaderboard core", () => {
  it("random handles look right and are deterministic under an injected rand", () => {
    let calls = 0;
    const rand = (): number => [0.1, 0.5, 0.9][calls++ % 3]!;
    const h = randomHandle(rand);
    expect(h).toMatch(/^[A-Z][a-zA-Z]+\d{2}$/);
    calls = 0;
    expect(randomHandle(rand)).toBe(h);
    // Default rand also yields valid names.
    for (let i = 0; i < 20; i++) {
      const name = randomHandle();
      expect(validName(name)).toBe(true);
    }
  });

  it("validates names by trimmed length", () => {
    expect(validName("ab")).toBe(false);
    expect(validName("   abc   ")).toBe(true);
    expect(validName("a".repeat(NAME_MAX))).toBe(true);
    expect(validName("a".repeat(NAME_MAX + 1))).toBe(false);
    expect(NAME_MIN).toBe(3);
  });

  it("computes the overall standing from cleared levels only", () => {
    const bests = new Map([
      [1, { pct: 100, timeMs: 30_000 }],
      [2, { pct: 100, timeMs: 32_500 }],
      [3, { pct: 60, timeMs: 20_000 }], // not cleared — ignored entirely
      [5, { pct: 100 }], // cleared pre-time-tracking: counts for level, 0 time
    ]);
    expect(computeOverall(bests)).toEqual({ highestLevel: 5, totalTimeMs: 62_500 });
  });

  it("handles an empty profile", () => {
    expect(computeOverall(new Map())).toEqual({ highestLevel: 0, totalTimeMs: 0 });
  });

  it("formats times compactly", () => {
    expect(formatTimeMs(31_540)).toBe("31.5s");
    expect(formatTimeMs(95_000)).toBe("1:35.0");
    expect(formatTimeMs(600)).toBe("0.6s");
  });
});
