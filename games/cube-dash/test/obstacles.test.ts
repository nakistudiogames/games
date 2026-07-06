import { describe, expect, it } from "vitest";
import { OBSTACLE_INFO } from "../src/obstacles";
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

  it("display names are unique", () => {
    const names = Object.values(OBSTACLE_INFO).map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
