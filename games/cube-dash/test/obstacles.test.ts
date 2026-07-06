import { describe, expect, it } from "vitest";
import { BOOST_INFO, OBSTACLE_INFO, POWERUP_INFO, ZONE_INFO } from "../src/obstacles";
import { KIND_UNLOCK_LEVEL } from "../src/logic/runner";
import type { ObstacleKind } from "../src/logic/runner";

describe("obstacle encyclopedia", () => {
  it("MANDATORY: every obstacle kind has a real encyclopedia entry", () => {
    // Record<ObstacleKind, …> already fails the typecheck on a missing key;
    // this guards against placeholder/empty entries sneaking in.
    for (const kind of Object.keys(KIND_UNLOCK_LEVEL) as ObstacleKind[]) {
      const info = OBSTACLE_INFO[kind];
      expect(info.name.length, `"${kind}" needs a display name`).toBeGreaterThan(2);
      expect(info.blurb.length, `"${kind}" needs a strategy blurb`).toBeGreaterThan(20);
    }
  });

  it("MANDATORY: every power-up, booster and zone has a real guide entry", () => {
    // Record<Kind, …> already fails the typecheck on a missing key; this
    // guards against placeholder/empty entries sneaking in.
    for (const record of [POWERUP_INFO, BOOST_INFO, ZONE_INFO]) {
      for (const [kind, info] of Object.entries(record)) {
        expect(info.name.length, `"${kind}" needs a display name`).toBeGreaterThan(2);
        expect(info.blurb.length, `"${kind}" needs a guide blurb`).toBeGreaterThan(20);
      }
    }
    expect(Object.keys(POWERUP_INFO)).toHaveLength(3);
    expect(Object.keys(BOOST_INFO)).toHaveLength(2);
    expect(Object.keys(ZONE_INFO)).toHaveLength(2);
  });

  it("display names are unique across the whole guide", () => {
    const names = [OBSTACLE_INFO, POWERUP_INFO, BOOST_INFO, ZONE_INFO].flatMap((r) =>
      Object.values(r).map((i) => i.name),
    );
    expect(new Set(names).size).toBe(names.length);
  });
});
