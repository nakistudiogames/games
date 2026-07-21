import { describe, expect, it } from "vitest";
import { computeOverall } from "../src/leaderboardCore";

// Names, formatting, and the dirty queue are covered in @mg/leaderboard's
// own tests; only cube-dash-specific logic lives here.
describe("leaderboard core", () => {
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
});
