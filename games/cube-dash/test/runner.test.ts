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
  LEVEL_COLORS,
  levelColor,
  levelDurationSec,
  levelGapScale,
  levelLengthM,
  levelSeed,
  levelSpeed,
  makePowerUp,
  minGapPx,
  pickPattern,
  powerUpGapPx,
  stepRunner,
  supportAt,
  tryJump,
} from "../src/logic/runner";
import type { Obstacle, PowerUp, Runner } from "../src/logic/runner";
import { Rng } from "@mg/core";

const onGround = (): Runner => ({ y: GROUND_Y, vy: 0, grounded: true, airJumpUsed: false });
const spike = (x: number, elev = 0): Obstacle => ({ x, w: 60, h: 60, elev, kind: "spike" });
const block = (x: number, h = 60, w = 120, elev = 0): Obstacle => ({ x, w, h, elev, kind: "block" });

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

describe("floating obstacles (vertical layer)", () => {
  it("lets the player run under a floating block, but not jump through it", () => {
    const slab = block(PLAYER_X, 60, 240, 90); // tunnel slab: band 90-150 up
    expect(checkDeath(GROUND_Y, [slab])).toBe(false); // running underneath
    expect(checkDeath(GROUND_Y - 100, [slab])).toBe(true); // jumped into the band
  });

  it("air mines are safe underneath and fatal inside their band", () => {
    const mine = spike(PLAYER_X, 110); // band 110-170 up
    expect(checkDeath(GROUND_Y, [mine])).toBe(false); // grounded, safe
    expect(checkDeath(GROUND_Y - 140, [mine])).toBe(true); // mid-jump collision
  });

  it("elevated platforms act as landing support from above only", () => {
    const platform = block(PLAYER_X, 30, 240, 120); // skyway: top at 150 up
    expect(supportAt(GROUND_Y - 200, [platform])).toBe(GROUND_Y - 150);
    expect(supportAt(GROUND_Y, [platform])).toBe(GROUND_Y); // below it: no support
    const r: Runner = { y: GROUND_Y - 250, vy: 300, grounded: false, airJumpUsed: false };
    for (let i = 0; i < 200 && !r.grounded; i++) {
      stepRunner(r, 1 / 120, supportAt(r.y, [platform]));
    }
    expect(r.y).toBe(GROUND_Y - 150);
  });

  it("every elevated platform in the pattern set is reachable by one jump", () => {
    for (const p of PATTERNS) {
      for (const o of p.obstacles) {
        if (o.kind === "block" && (o.elev ?? 0) > 0) {
          // Jump apex ≈ 200px: platform tops must sit below it with margin.
          expect((o.elev ?? 0) + o.h).toBeLessThanOrEqual(190);
        }
        if ((o.elev ?? 0) > 0) {
          // Anything floating must leave run-under clearance for the player.
          expect(o.elev ?? 0).toBeGreaterThanOrEqual(PLAYER_SIZE + 20);
        }
      }
    }
  });

  it("gates layered patterns behind higher speeds", () => {
    const slowIds = new Set(
      Array.from({ length: 300 }, (_, i) => pickPattern(new Rng(i), BASE_SPEED).id),
    );
    for (const id of ["tunnel", "airMine", "skyway", "mineCombo"]) {
      expect(slowIds.has(id)).toBe(false);
    }
    const fastIds = new Set(
      Array.from({ length: 300 }, (_, i) => pickPattern(new Rng(i), 600).id),
    );
    expect(fastIds.has("skyway")).toBe(true);
    expect(fastIds.has("tunnel")).toBe(true);
  });
});

describe("level system", () => {
  it("targets 30s for the first world, +15s per world after", () => {
    expect(levelDurationSec(1)).toBe(30);
    expect(levelDurationSec(5)).toBe(30);
    expect(levelDurationSec(6)).toBe(45);
    expect(levelDurationSec(10)).toBe(45);
    expect(levelDurationSec(11)).toBe(60);
  });

  it("derives length from duration at the level's speed", () => {
    expect(levelLengthM(1)).toBe(1260); // 420 px/s * 30s
    expect(levelLengthM(2)).toBe(1380); // 460 px/s * 30s
    expect(levelLengthM(6)).toBe(2700); // capped 600 px/s * 45s
    expect(levelLengthM(11)).toBe(3600); // 600 px/s * 60s
  });

  it("level layouts are deterministic: same seed, same pattern sequence", () => {
    expect(levelSeed(3)).not.toBe(levelSeed(4));
    const a = new Rng(levelSeed(3));
    const b = new Rng(levelSeed(3));
    const idsA = Array.from({ length: 20 }, () => pickPattern(a, 500).id);
    const idsB = Array.from({ length: 20 }, () => pickPattern(b, 500).id);
    expect(idsA).toEqual(idsB);
  });

  it("speed steps up per level and caps", () => {
    expect(levelSpeed(1)).toBe(BASE_SPEED);
    expect(levelSpeed(2)).toBe(BASE_SPEED + 40);
    expect(levelSpeed(4)).toBe(540); // unlocks triple spikes
    expect(levelSpeed(50)).toBe(MAX_SPEED);
  });

  it("pattern gaps tighten per level but never below the floor", () => {
    expect(levelGapScale(1)).toBeCloseTo(1.2);
    expect(levelGapScale(2)).toBeGreaterThan(levelGapScale(3));
    expect(levelGapScale(30)).toBe(0.75);
  });

  it("every level stays clearable: scaled gap still fits a reaction + jump", () => {
    for (let level = 1; level <= 25; level++) {
      const speed = levelSpeed(level);
      const gap = minGapPx(speed) * levelGapScale(level);
      expect(gap).toBeGreaterThan(jumpDistancePx(speed) + 0.2 * speed);
    }
  });

  it("shares one accent color per world: teal, green, orange, cycling", () => {
    expect(levelColor(1)).toBe(LEVEL_COLORS[0]); // teal
    expect(levelColor(5)).toBe(LEVEL_COLORS[0]);
    expect(levelColor(6)).toBe(LEVEL_COLORS[1]); // green
    expect(levelColor(10)).toBe(LEVEL_COLORS[1]);
    expect(levelColor(11)).toBe(LEVEL_COLORS[2]); // orange
    expect(levelColor(16)).toBe(LEVEL_COLORS[0]); // wraps with the worlds
  });
});

describe("difficulty and patterns", () => {

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
