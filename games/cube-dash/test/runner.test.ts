import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  GROUND_Y,
  JUMP_VELOCITY,
  MAX_SPEED,
  PATTERNS,
  PLAYER_SIZE,
  PLAYER_X,
  POWERUP_SIZE,
  checkDeath,
  collectsPowerUp,
  jump,
  jumpDistancePx,
  makePowerUp,
  minGapPx,
  pickPattern,
  powerUpGapPx,
  speedForDistance,
  stepRunner,
  supportAt,
  tryJump,
} from "../src/logic/runner";
import type { Obstacle, PowerUp, Runner } from "../src/logic/runner";
import { Rng } from "@mg/core";

const onGround = (): Runner => ({ y: GROUND_Y, vy: 0, grounded: true, airJumpUsed: false });
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
    const r: Runner = { y: GROUND_Y - 60, vy: 0, grounded: true, airJumpUsed: false };
    stepRunner(r, 1 / 60, GROUND_Y); // block ended; support is now the ground
    expect(r.grounded).toBe(false);
    for (let i = 0; i < 200 && !r.grounded; i++) stepRunner(r, 1 / 120, GROUND_Y);
    expect(r.y).toBe(GROUND_Y);
  });
});

describe("double jump power-up", () => {
  it("allows exactly one extra jump midair while active", () => {
    const r = onGround();
    expect(tryJump(r, true)).toBe("ground");
    stepRunner(r, 0.05, GROUND_Y);
    expect(tryJump(r, true)).toBe("air");
    expect(tryJump(r, true)).toBeNull(); // air jump already spent
  });

  it("denies air jumps when the power-up is not active", () => {
    const r = onGround();
    tryJump(r, false);
    expect(tryJump(r, false)).toBeNull();
  });

  it("air jump resets its velocity even while falling fast", () => {
    const r: Runner = { y: 600, vy: 1200, grounded: false, airJumpUsed: false };
    expect(tryJump(r, true)).toBe("air");
    expect(r.vy).toBe(JUMP_VELOCITY);
  });

  it("recharges the air jump on landing", () => {
    const r = onGround();
    tryJump(r, true);
    tryJump(r, true); // spend the air jump
    for (let i = 0; i < 400 && !r.grounded; i++) stepRunner(r, 1 / 120, GROUND_Y);
    expect(r.grounded).toBe(true);
    expect(r.airJumpUsed).toBe(false);
    stepRunner(r, 0.01, GROUND_Y);
    tryJump(r, true);
    expect(tryJump(r, true)).toBe("air");
  });
});

describe("power-up pickups", () => {
  const pickupAt = (x: number, y: number): PowerUp => ({ x, y, kind: "doubleJump" });

  it("collects when the player overlaps the pickup box", () => {
    const y = GROUND_Y - 120;
    expect(collectsPowerUp(y + PLAYER_SIZE / 2, pickupAt(PLAYER_X + 20, y))).toBe(true);
  });

  it("does not collect when horizontally or vertically clear", () => {
    expect(collectsPowerUp(GROUND_Y, pickupAt(PLAYER_X + 300, GROUND_Y - 30))).toBe(false);
    // Player on the ground; pickup floating well above its head.
    expect(
      collectsPowerUp(GROUND_Y, pickupAt(PLAYER_X, GROUND_Y - PLAYER_SIZE - POWERUP_SIZE)),
    ).toBe(false);
  });

  it("spawns within single-jump reach, deterministically per seed", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = makePowerUp(new Rng(seed), 800);
      expect(GROUND_Y - p.y).toBeGreaterThanOrEqual(90);
      expect(GROUND_Y - p.y).toBeLessThanOrEqual(180);
    }
    expect(makePowerUp(new Rng(5), 800)).toEqual(makePowerUp(new Rng(5), 800));
    const gap = powerUpGapPx(new Rng(5));
    expect(gap).toBeGreaterThanOrEqual(2400);
    expect(gap).toBeLessThanOrEqual(4000);
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
    const r: Runner = { y: GROUND_Y - 200, vy: 400, grounded: false, airJumpUsed: false };
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
