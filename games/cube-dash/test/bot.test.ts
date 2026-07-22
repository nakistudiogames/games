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
      let padLaunches = 0;
      for (let level = from; level <= to; level++) {
        const r = runBot(level);
        padLaunches += r.padLaunches;
        expect(
          r.finished,
          `level ${level} ${r.stalled ? "stalled" : "died"} at ${r.deathM}m near [${r.nearby}]`,
        ).toBe(true);
        expect(r.shieldSaves, `level ${level} needed ${r.shieldSaves} shield save(s)`).toBe(0);
        // Launch pads / dash strips must never sit on a hazard body — the
        // nudge in updateBoosts slides them into a gap first (≤0 = clean).
        expect(
          r.worstBoostOverlap,
          `level ${level} had a boost overlapping a hazard by ${r.worstBoostOverlap}px`,
        ).toBeLessThanOrEqual(0);
      }
      // Pads exist from level 6 and must actually FIRE, not just decorate
      // the track (an over-strict safety rule once made them inert).
      expect(
        padLaunches,
        `only ${padLaunches} pad launch(es) across levels ${from}-${to}`,
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
