import { describe, expect, it } from "vitest";
import { runBot } from "./levelSim";

/**
 * Bot playthrough: a lookahead-search bot (test/levelSim.ts) plays every
 * level headlessly and must reach the finish without shield saves. Proves
 * whole levels are beatable as a system — pattern adjacency, pad
 * auto-launches, pickup speed effects and all — not just that each hazard
 * is clearable in isolation.
 */

describe("bot playthrough: every level is beatable end-to-end", () => {
  for (const [from, to] of [[1, 25], [26, 50], [51, 75], [76, 100]] as const) {
    // Late-world levels run up to 315 in-game seconds at 120 sim-fps.
    it(`clears levels ${from}-${to} without shields`, { timeout: 120_000 }, () => {
      for (let level = from; level <= to; level++) {
        const r = runBot(level);
        expect(
          r.finished,
          `level ${level} ${r.stalled ? "stalled" : "died"} at ${r.deathM}m near [${r.nearby}]`,
        ).toBe(true);
        expect(r.shieldSaves, `level ${level} needed ${r.shieldSaves} shield save(s)`).toBe(0);
      }
    });
  }
});
