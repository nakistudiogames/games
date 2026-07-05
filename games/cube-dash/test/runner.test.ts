import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  GROUND_Y,
  JUMP_VELOCITY,
  MAX_SPEED,
  PATTERNS,
  PLAYER_SIZE,
  PLAYER_X,
  checkDeath,
  jump,
  jumpDistancePx,
  minGapPx,
  pickPattern,
  speedForDistance,
  stepRunner,
  supportAt,
} from "../src/logic/runner";
import type { Obstacle, Runner } from "../src/logic/runner";
import { Rng } from "@mg/core";

const onGround = (): Runner => ({ y: GROUND_Y, vy: 0, grounded: true });
const spike = (x: number): Obstacle => ({ x, w: 60, h: 60, kind: "spike" });
const block = (x: number, h = 60, w = 120): Obstacle => ({ x, w, h, kind: "block" });

describe("jump physics", () => {
  it("jumps only when grounded", () => {
    const r = onGround();
    jump(r);
    expect(r.vy).toBe(JUMP_VELOCITY);
    expect(r.grounded).toBe(false);
    const vyMidair = r.vy;
    jump(r); // ignored midair
    expect(r.vy).toBe(vyMidair);
  });

  it("completes a jump arc and lands back on the ground", () => {
    const r = onGround();
    jump(r);
    let peak = GROUND_Y;
    for (let i = 0; i < 200 && !r.grounded; i++) {
      stepRunner(r, 1 / 120, GROUND_Y);
      peak = Math.min(peak, r.y);
    }
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(GROUND_Y);
    // Analytic apex: vy² / 2g ≈ 200px above ground.
    expect(GROUND_Y - peak).toBeGreaterThan(180);
    expect(GROUND_Y - peak).toBeLessThan(215);
  });

  it("starts falling when the support drops away (walking off a block)", () => {
    const r: Runner = { y: GROUND_Y - 60, vy: 0, grounded: true };
    stepRunner(r, 1 / 60, GROUND_Y); // block ended; support is now the ground
    expect(r.grounded).toBe(false);
    for (let i = 0; i < 200 && !r.grounded; i++) stepRunner(r, 1 / 120, GROUND_Y);
    expect(r.y).toBe(GROUND_Y);
  });
});

describe("support and landing", () => {
  it("uses a block top as support when the player is above it", () => {
    const b = block(PLAYER_X);
    expect(supportAt(GROUND_Y - 120, [b])).toBe(GROUND_Y - 60);
  });

  it("ignores blocks the player is beside or below", () => {
    expect(supportAt(GROUND_Y, [block(PLAYER_X)])).toBe(GROUND_Y); // already below top
    expect(supportAt(GROUND_Y - 120, [block(PLAYER_X + 500)])).toBe(GROUND_Y); // no x overlap
  });

  it("lands a falling player exactly on the block top", () => {
    const b = block(PLAYER_X);
    const r: Runner = { y: GROUND_Y - 200, vy: 400, grounded: false };
    for (let i = 0; i < 200 && !r.grounded; i++) {
      stepRunner(r, 1 / 120, supportAt(r.y, [b]));
    }
    expect(r.y).toBe(GROUND_Y - 60);
  });
});

describe("death detection", () => {
  it("kills on spike overlap but forgives the inset margin", () => {
    // Spike just far enough that only the 16px inset region overlaps.
    expect(checkDeath(GROUND_Y, [spike(PLAYER_X + PLAYER_SIZE - 10)])).toBe(false);
    expect(checkDeath(GROUND_Y, [spike(PLAYER_X + 20)])).toBe(true);
  });

  it("does not kill when jumping over a spike", () => {
    expect(checkDeath(GROUND_Y - 100, [spike(PLAYER_X)])).toBe(false);
  });

  it("kills on block side hits but not when standing on top", () => {
    const b = block(PLAYER_X + 20);
    expect(checkDeath(GROUND_Y, [b])).toBe(true); // body inside block = side hit
    expect(checkDeath(GROUND_Y - 60, [b])).toBe(false); // standing exactly on top
  });
});

describe("difficulty and patterns", () => {
  it("speed ramps with distance and caps", () => {
    expect(speedForDistance(0)).toBe(BASE_SPEED);
    expect(speedForDistance(1200)).toBe(520);
    expect(speedForDistance(100000)).toBe(MAX_SPEED);
  });

  it("every spike-only pattern is clearable at its unlock speed", () => {
    for (const p of PATTERNS) {
      if (!p.obstacles.every((o) => o.kind === "spike")) continue;
      // Widest contiguous spike stretch must fit inside one jump.
      const speed = Math.max(p.minSpeed, BASE_SPEED);
      let run = 0;
      let widest = 0;
      let prevEnd: number | null = null;
      for (const o of p.obstacles) {
        run = prevEnd !== null && o.dx === prevEnd ? run + o.w : o.w;
        widest = Math.max(widest, run);
        prevEnd = o.dx + o.w;
      }
      expect(jumpDistancePx(speed)).toBeGreaterThan(widest + PLAYER_SIZE + 20);
    }
  });

  it("gates long patterns behind higher speeds", () => {
    const slowIds = new Set(
      Array.from({ length: 200 }, (_, i) => pickPattern(new Rng(i), BASE_SPEED).id),
    );
    expect(slowIds.has("spike3")).toBe(false);
    const fastIds = new Set(
      Array.from({ length: 200 }, (_, i) => pickPattern(new Rng(i), 560).id),
    );
    expect(fastIds.has("spike3")).toBe(true);
  });

  it("pattern gap leaves room to react and jump", () => {
    expect(minGapPx(BASE_SPEED)).toBeGreaterThan(jumpDistancePx(BASE_SPEED));
  });
});
