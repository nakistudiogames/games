import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  GEYSER_FREQ,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  KIND_UNLOCK_LEVEL,
  LEVELS_PER_WORLD,
  MAX_SPEED,
  PATTERNS,
  PLAYER_SIZE,
  PLAYER_X,
  POWERUP_SIZE,
  SWING_AMP,
  SWING_FREQ,
  SWING_MID,
  TENTACLE_AMP,
  TENTACLE_FREQ,
  checkDeath,
  collectsPowerUp,
  geyserActive,
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
  obstacleKindsForLevel,
  pickPattern,
  powerUpGapPx,
  stepRunner,
  supportAt,
  swingElev,
  tentacleSway,
  tryJump,
} from "../src/logic/runner";
import type { Obstacle, ObstacleKind, PowerUp, Runner } from "../src/logic/runner";
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
      Array.from({ length: 300 }, (_, i) => pickPattern(new Rng(i), BASE_SPEED, 25).id),
    );
    for (const id of ["tunnel", "airMine", "skyway", "mineCombo"]) {
      expect(slowIds.has(id)).toBe(false);
    }
    const fastIds = new Set(
      Array.from({ length: 300 }, (_, i) => pickPattern(new Rng(i), 600, 25).id),
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
    const idsA = Array.from({ length: 20 }, () => pickPattern(a, 500, 3).id);
    const idsB = Array.from({ length: 20 }, () => pickPattern(b, 500, 3).id);
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
    for (let level = 1; level <= 40; level++) {
      const speed = levelSpeed(level);
      const gap = minGapPx(speed) * levelGapScale(level);
      expect(gap).toBeGreaterThan(jumpDistancePx(speed) + 0.2 * speed);
    }
  });

  it("shares one accent color per world, one per theme, cycling", () => {
    expect(LEVEL_COLORS).toHaveLength(8); // one per world theme
    expect(levelColor(1)).toBe(LEVEL_COLORS[0]); // teal
    expect(levelColor(5)).toBe(LEVEL_COLORS[0]);
    expect(levelColor(6)).toBe(LEVEL_COLORS[1]); // green
    expect(levelColor(11)).toBe(LEVEL_COLORS[2]); // orange
    expect(levelColor(16)).toBe(LEVEL_COLORS[3]); // ice blue
    expect(levelColor(36)).toBe(LEVEL_COLORS[7]); // magenta
    expect(levelColor(41)).toBe(LEVEL_COLORS[0]); // wraps with the worlds
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
      Array.from({ length: 200 }, (_, i) => pickPattern(new Rng(i), BASE_SPEED, 1).id),
    );
    expect(slowIds.has("spike3")).toBe(false);
    const fastIds = new Set(
      Array.from({ length: 300 }, (_, i) => pickPattern(new Rng(i), 560, 25).id),
    );
    expect(fastIds.has("spike3")).toBe(true);
  });

  it("pattern gap leaves room to react and jump", () => {
    expect(minGapPx(BASE_SPEED)).toBeGreaterThan(jumpDistancePx(BASE_SPEED));
  });
});

describe("world obstacle unlocks (+1 kind per world)", () => {
  it("world 1 has 2 kinds, then one more unlocks per world", () => {
    expect(obstacleKindsForLevel(1).sort()).toEqual(["block", "spike"]);
    expect(obstacleKindsForLevel(5)).toHaveLength(2);
    expect(obstacleKindsForLevel(6)).toHaveLength(3); // + saw
    expect(obstacleKindsForLevel(6)).toContain("saw");
    expect(obstacleKindsForLevel(10)).toHaveLength(3);
    expect(obstacleKindsForLevel(11)).toHaveLength(4); // + pit
    expect(obstacleKindsForLevel(11)).toContain("pit");
    expect(obstacleKindsForLevel(16)).toHaveLength(5); // + swing
    expect(obstacleKindsForLevel(16)).toContain("swing");
    expect(obstacleKindsForLevel(21)).toHaveLength(6); // + laser
    expect(obstacleKindsForLevel(21)).toContain("laser");
    expect(obstacleKindsForLevel(26)).toHaveLength(7); // + geyser
    expect(obstacleKindsForLevel(26)).toContain("geyser");
    expect(obstacleKindsForLevel(31)).toHaveLength(8); // + tentacle
    expect(obstacleKindsForLevel(31)).toContain("tentacle");
    expect(obstacleKindsForLevel(36)).toHaveLength(9); // + arc
    expect(obstacleKindsForLevel(36)).toContain("arc");
  });

  it("MANDATORY: every unlockable kind gets an intro pattern at its unlock level", () => {
    // Companion to the worlds-side rule: a kind that unlocks but never
    // appears in a pattern would silently never spawn.
    for (const [kind, lvl] of Object.entries(KIND_UNLOCK_LEVEL)) {
      if (lvl === 1) continue; // world-1 kinds live in the base patterns
      const hasIntro = PATTERNS.some(
        (p) => (p.minLevel ?? 1) === lvl && p.obstacles.some((o) => o.kind === kind),
      );
      expect(hasIntro, `kind "${kind}" needs a pattern with minLevel ${lvl}`).toBe(true);
    }
  });

  it("unlock levels land on the first level of each world", () => {
    for (const level of Object.values(KIND_UNLOCK_LEVEL)) {
      expect((level - 1) % LEVELS_PER_WORLD).toBe(0);
    }
  });

  it("no pattern uses a kind before its world unlocks it", () => {
    for (const p of PATTERNS) {
      for (const o of p.obstacles) {
        expect(p.minLevel ?? 1).toBeGreaterThanOrEqual(KIND_UNLOCK_LEVEL[o.kind]);
      }
    }
  });

  it("pickPattern only deals unlocked kinds at each level", () => {
    const kindsAt = (level: number): Set<ObstacleKind> => {
      const s = new Set<ObstacleKind>();
      for (let i = 0; i < 500; i++) {
        for (const o of pickPattern(new Rng(i), levelSpeed(level), level).obstacles) {
          s.add(o.kind);
        }
      }
      return s;
    };
    const world1 = kindsAt(5);
    for (const k of ["saw", "pit", "swing", "laser"] as const) {
      expect(world1.has(k)).toBe(false);
    }
    const world2 = kindsAt(10);
    expect(world2.has("saw")).toBe(true);
    expect(world2.has("pit")).toBe(false);
    const world5 = kindsAt(25);
    for (const k of ["spike", "block", "saw", "pit", "swing", "laser"] as const) {
      expect(world5.has(k)).toBe(true);
    }
    expect(world5.has("geyser")).toBe(false);
    const world8 = kindsAt(40);
    for (const k of Object.keys(KIND_UNLOCK_LEVEL) as ObstacleKind[]) {
      expect(world8.has(k)).toBe(true);
    }
  });
});

describe("saw (world 2): round hitbox on the ground", () => {
  const saw = (x: number): Obstacle => ({ x, w: 90, h: 90, elev: 0, kind: "saw" });

  it("kills on body overlap", () => {
    expect(checkDeath(GROUND_Y, [saw(PLAYER_X)])).toBe(true);
  });

  it("forgives a bounding-box graze that misses the disc", () => {
    // 4px of box overlap at the leading edge: the circle is still 41px away.
    expect(checkDeath(GROUND_Y, [saw(PLAYER_X + PLAYER_SIZE - 4)])).toBe(false);
  });

  it("is cleared by a jump and gives no landing support", () => {
    expect(checkDeath(GROUND_Y - 160, [saw(PLAYER_X)])).toBe(false);
    expect(supportAt(GROUND_Y - 200, [saw(PLAYER_X)])).toBe(GROUND_Y);
  });
});

describe("pit (world 3): lava trench, lethal only at ground level", () => {
  const pit = (x: number): Obstacle => ({ x, w: 150, h: 24, elev: 0, kind: "pit" });

  it("kills a grounded player over the trench, not an airborne one", () => {
    expect(checkDeath(GROUND_Y, [pit(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y - 40, [pit(PLAYER_X)])).toBe(false);
  });

  it("forgives the edge inset on both lips", () => {
    expect(checkDeath(GROUND_Y, [pit(PLAYER_X + PLAYER_SIZE - 22)])).toBe(false);
    expect(checkDeath(GROUND_Y, [pit(PLAYER_X - 150 + 22)])).toBe(false);
  });

  it("every pit pattern is jumpable at its unlock speed", () => {
    for (const p of PATTERNS) {
      for (const o of p.obstacles) {
        if (o.kind !== "pit") continue;
        const speed = levelSpeed(p.minLevel ?? 1);
        expect(jumpDistancePx(speed)).toBeGreaterThan(o.w + PLAYER_SIZE + 20);
      }
    }
  });
});

describe("swing mine (world 4): bobs as a pure function of x", () => {
  const mineAt = (x: number, phase: number): Obstacle => ({
    x, w: 54, h: 54, elev: 0, kind: "swing", phase,
  });
  /** Phase that puts the bob at its highest (+) or lowest (-) point at x. */
  const phaseFor = (x: number, sign: 1 | -1): number =>
    (sign * Math.PI) / 2 - x * SWING_FREQ;

  it("stays inside a band that is always clearable one way or the other", () => {
    // [10, 130]: ≤120 fits under a jump (apex ≈ 200), ≥80 allows run-under —
    // the two bands overlap, so every height on the cycle is passable.
    for (let x = 0; x < 1000; x += 37) {
      const elev = swingElev(mineAt(x, 1.3));
      expect(elev).toBeGreaterThanOrEqual(SWING_MID - SWING_AMP);
      expect(elev).toBeLessThanOrEqual(SWING_MID + SWING_AMP);
    }
    expect(SWING_MID - SWING_AMP).toBe(10);
    expect(SWING_MID + SWING_AMP).toBe(130);
  });

  it("is deterministic: same x and phase, same height", () => {
    expect(swingElev(mineAt(423, 2))).toBe(swingElev(mineAt(423, 2)));
  });

  it("high point: safe to run under, fatal to jump into", () => {
    const high = mineAt(PLAYER_X, phaseFor(PLAYER_X, 1)); // elev 130
    expect(swingElev(high)).toBeCloseTo(130);
    expect(checkDeath(GROUND_Y, [high])).toBe(false);
    expect(checkDeath(GROUND_Y - 140, [high])).toBe(true);
  });

  it("low point: fatal on the ground, cleared by a jump", () => {
    const low = mineAt(PLAYER_X, phaseFor(PLAYER_X, -1)); // elev 10
    expect(swingElev(low)).toBeCloseTo(10);
    expect(checkDeath(GROUND_Y, [low])).toBe(true);
    expect(checkDeath(GROUND_Y - 150, [low])).toBe(false);
  });
});

describe("laser pylon (world 5): thin, tall, always on", () => {
  const laser = (x: number): Obstacle => ({ x, w: 24, h: 130, elev: 0, kind: "laser" });

  it("kills on beam contact, cleared by a well-timed jump", () => {
    expect(checkDeath(GROUND_Y, [laser(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y - 140, [laser(PLAYER_X)])).toBe(false);
  });

  it("every laser in the pattern set fits under the jump apex with margin", () => {
    for (const p of PATTERNS) {
      for (const o of p.obstacles) {
        if (o.kind === "laser") expect(o.h).toBeLessThanOrEqual(150);
      }
    }
  });
});

/**
 * Px traveled at `speed` while a full jump stays at or above `minHeight` —
 * the horizontal room available to clear a hazard of that height.
 */
const airWindowPx = (speed: number, minHeight: number): number => {
  const disc = JUMP_VELOCITY ** 2 - 2 * GRAVITY * minHeight;
  return disc <= 0 ? 0 : (speed * 2 * Math.sqrt(disc)) / GRAVITY;
};

describe("geyser (world 6): erupts as a pure function of x", () => {
  const geyser = (x: number, phase: number): Obstacle => ({
    x, w: 60, h: 110, elev: 0, kind: "geyser", phase,
  });
  /** Phase that puts the cycle at full eruption (+) or full lull (-) at x. */
  const phaseFor = (x: number, sign: 1 | -1): number =>
    (sign * Math.PI) / 2 - x * GEYSER_FREQ;

  it("is deterministic: same x and phase, same state", () => {
    expect(geyserActive(geyser(423, 2))).toBe(geyserActive(geyser(423, 2)));
  });

  it("dormant vent is harmless, eruption kills at ground level", () => {
    expect(checkDeath(GROUND_Y, [geyser(PLAYER_X, phaseFor(PLAYER_X, -1))])).toBe(false);
    expect(checkDeath(GROUND_Y, [geyser(PLAYER_X, phaseFor(PLAYER_X, 1))])).toBe(true);
  });

  it("a full eruption clears with a jump over the column", () => {
    const erupting = geyser(PLAYER_X, phaseFor(PLAYER_X, 1));
    expect(checkDeath(GROUND_Y - 120, [erupting])).toBe(false);
    // Airtime above the column tip out-spans the kill zone with margin,
    // so the jump-over route works no matter the cycle.
    const speed = levelSpeed(KIND_UNLOCK_LEVEL.geyser); // 600 by world 6
    const killSpan = 60 - 2 * 6 + PLAYER_SIZE; // width minus insets + player
    expect(airWindowPx(speed, 110 - 6)).toBeGreaterThan(killSpan + 30);
  });
});

describe("tentacle (world 7): sways sideways as a pure function of x", () => {
  const tentacle = (x: number, phase: number): Obstacle => ({
    x, w: 30, h: 120, elev: 0, kind: "tentacle", phase,
  });
  /** Phase for full sway toward (+AMP) or away (-AMP) at x. */
  const phaseFor = (x: number, sign: 1 | -1): number =>
    (sign * Math.PI) / 2 - x * TENTACLE_FREQ;

  it("sway stays inside ±TENTACLE_AMP and is deterministic", () => {
    for (let x = 0; x < 1000; x += 41) {
      const sway = tentacleSway(tentacle(x, 0.7));
      expect(Math.abs(sway)).toBeLessThanOrEqual(TENTACLE_AMP);
    }
    expect(tentacleSway(tentacle(423, 2))).toBe(tentacleSway(tentacle(423, 2)));
  });

  it("kills where the sway puts it, not where it is anchored", () => {
    // Anchored just past the player: lethal only when swaying toward them.
    const x = PLAYER_X + PLAYER_SIZE + 10;
    expect(checkDeath(GROUND_Y, [tentacle(x, phaseFor(x, -1))])).toBe(true);
    expect(checkDeath(GROUND_Y, [tentacle(x, phaseFor(x, 1))])).toBe(false);
  });

  it("worst-case sway footprint still fits inside one jump", () => {
    const speed = levelSpeed(KIND_UNLOCK_LEVEL.tentacle); // 600 by world 7
    const killSpan = 30 + 2 * TENTACLE_AMP - 2 * 8 + PLAYER_SIZE;
    expect(airWindowPx(speed, 120 - 6)).toBeGreaterThan(killSpan + 30);
  });
});

describe("arc (world 8): wide low span, one full-commitment jump", () => {
  const arc = (x: number): Obstacle => ({ x, w: 200, h: 50, elev: 0, kind: "arc" });

  it("kills anywhere inside the span at beam height, cleared above it", () => {
    expect(checkDeath(GROUND_Y, [arc(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y, [arc(PLAYER_X - 100)])).toBe(true); // mid-span
    expect(checkDeath(GROUND_Y - 70, [arc(PLAYER_X)])).toBe(false);
  });

  it("forgives the pylon inset at both edges", () => {
    expect(checkDeath(GROUND_Y, [arc(PLAYER_X + PLAYER_SIZE - 10)])).toBe(false);
    expect(checkDeath(GROUND_Y, [arc(PLAYER_X - 200 + 10)])).toBe(false);
  });

  it("every arc in the pattern set is clearable in a single jump", () => {
    const speed = levelSpeed(KIND_UNLOCK_LEVEL.arc); // 600 by world 8
    for (const p of PATTERNS) {
      for (const o of p.obstacles) {
        if (o.kind !== "arc") continue;
        const killSpan = o.w - 2 * 10 + PLAYER_SIZE;
        expect(airWindowPx(speed, o.h - 8)).toBeGreaterThan(killSpan + 30);
      }
    }
  });
});
