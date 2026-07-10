import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  COMET_IMPACT_X,
  COYOTE_MS,
  nearMiss,
  COMET_SLOPE,
  CRUSHER_FREQ,
  DRONE_ELEV_AMP,
  DRONE_ELEV_MID,
  FLIP_MIN_LEVEL,
  GATE_GAP_HI,
  GATE_GAP_LO,
  GEAR_FREQ,
  GEAR_SHIFT_AMP,
  GEYSER_FREQ,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  KIND_UNLOCK_LEVEL,
  KINDS_WITH_PHASE,
  LEVELS_PER_WORLD,
  MAX_SPEED,
  MIRROR_MIN_LEVEL,
  PATTERNS,
  PHANTOM_FREQ,
  PLAYER_SIZE,
  PLAYER_X,
  POWERUP_SIZE,
  REAPER_FREQ,
  SWING_AMP,
  SWING_FREQ,
  SWING_MID,
  TALON_FREQ,
  TENTACLE_AMP,
  TENTACLE_FREQ,
  URCHIN_ELEV,
  DASH_LENGTH_PX,
  DASH_MUL,
  PAD_JUMP_VELOCITY,
  padLaunchSafe,
  POWERUP_UNLOCK_LEVEL,
  POWER_UPS,
  SLOWMO_MUL,
  isFinaleLevel,
  trackBoosts,
  VINE_AMP,
  VINE_FREQ,
  VINE_MID,
  checkDeath,
  collectsPowerUp,
  cometElev,
  crusherElev,
  droneElev,
  gearShift,
  geyserActive,
  phantomSolid,
  reaperActive,
  talonActive,
  trackZones,
  vineHeight,
  zoneKindAt,
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

  it("coyote time: a late jump after an edge drop still fires", () => {
    const r: Runner = { y: GROUND_Y - 60, vy: 0, grounded: true, airJumpUsed: false };
    stepRunner(r, 1 / 60, GROUND_Y); // walk off the block
    expect(r.grounded).toBe(false);
    stepRunner(r, 0.05, GROUND_Y); // 50ms falling — inside the window
    expect(tryJump(r, false)).toBe("ground");
    expect(r.vy).toBe(JUMP_VELOCITY);
    expect(r.coyoteMs).toBe(0); // consumed — no second coyote jump
    expect(tryJump(r, false)).toBeNull();
  });

  it("coyote time expires after COYOTE_MS", () => {
    // Tall block: 120ms of falling covers ~60px, so the runner stays airborne.
    const r: Runner = { y: GROUND_Y - 120, vy: 0, grounded: true, airJumpUsed: false };
    stepRunner(r, 1 / 60, GROUND_Y);
    for (let i = 0; i < 12; i++) stepRunner(r, 0.01, GROUND_Y);
    expect(r.grounded).toBe(false);
    expect(COYOTE_MS).toBeLessThan(120);
    expect(tryJump(r, false)).toBeNull();
  });

  it("a normal jump opens no coyote window", () => {
    const r = onGround();
    jump(r);
    stepRunner(r, 0.03, GROUND_Y);
    expect(tryJump(r, false)).toBeNull();
  });
});

describe("near-miss detection", () => {
  it("registers a graze just above a spike but not a clean clear", () => {
    const s = spike(PLAYER_X);
    // Player bottom 66px up: 6px above the spike's 60px tip = inside the
    // graze band (pad minus the spike's 12px fairness inset = 12px band).
    expect(checkDeath(GROUND_Y - 66, [s])).toBe(false);
    expect(nearMiss(GROUND_Y - 66, [s])).toBe(true);
    // 90px up clears the graze band entirely.
    expect(nearMiss(GROUND_Y - 90, [s])).toBe(false);
  });

  it("a lethal overlap is a death, not a near-miss", () => {
    expect(nearMiss(GROUND_Y, [spike(PLAYER_X)])).toBe(false);
    expect(checkDeath(GROUND_Y, [spike(PLAYER_X)])).toBe(true);
  });

  it("inactive timed hazards produce no graze", () => {
    const ghost: Obstacle = {
      x: PLAYER_X, w: 60, h: 110, elev: 0, kind: "phantom",
      phase: -Math.PI / 2 - PLAYER_X * PHANTOM_FREQ, // fully phased out
    };
    expect(nearMiss(GROUND_Y, [ghost])).toBe(false);
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
    for (let level = 1; level <= 99; level++) {
      const speed = levelSpeed(level);
      const gap = minGapPx(speed) * levelGapScale(level);
      expect(gap).toBeGreaterThan(jumpDistancePx(speed) + 0.2 * speed);
    }
  });

  it("shares one accent color per world, one per theme, cycling", () => {
    expect(LEVEL_COLORS).toHaveLength(20); // one per world theme
    expect(levelColor(1)).toBe(LEVEL_COLORS[0]); // teal
    expect(levelColor(5)).toBe(LEVEL_COLORS[0]);
    expect(levelColor(6)).toBe(LEVEL_COLORS[1]); // green
    expect(levelColor(11)).toBe(LEVEL_COLORS[2]); // orange
    expect(levelColor(16)).toBe(LEVEL_COLORS[3]); // ice blue
    expect(levelColor(36)).toBe(LEVEL_COLORS[7]); // magenta
    expect(levelColor(41)).toBe(LEVEL_COLORS[8]); // chrome (world 9)
    expect(levelColor(96)).toBe(LEVEL_COLORS[19]); // apex cyan
    expect(levelColor(101)).toBe(LEVEL_COLORS[0]); // wraps with the worlds
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
    // Worlds 9-20 keep the cadence going, one kind per world.
    const laterUnlocks: Array<[number, ObstacleKind]> = [
      [41, "phantom"], [46, "vine"], [51, "gear"], [56, "gate"],
      [61, "crusher"], [66, "urchin"], [71, "talon"], [76, "drone"],
      [81, "obelisk"], [86, "flare"], [91, "comet"], [96, "reaper"],
    ];
    laterUnlocks.forEach(([lvl, kind], i) => {
      expect(obstacleKindsForLevel(lvl)).toHaveLength(10 + i);
      expect(obstacleKindsForLevel(lvl)).toContain(kind);
      expect(obstacleKindsForLevel(lvl - 1)).not.toContain(kind);
    });
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
    for (const [k, lvl] of Object.entries(KIND_UNLOCK_LEVEL) as Array<[ObstacleKind, number]>) {
      expect(world8.has(k)).toBe(lvl <= 40);
    }
    const world20 = kindsAt(99);
    for (const k of Object.keys(KIND_UNLOCK_LEVEL) as ObstacleKind[]) {
      expect(world20.has(k)).toBe(true);
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

// --- worlds 9-20 kinds: same doctrine — deterministic motion, provable outs.

/** Phase that puts a sin cycle at +1 (sign 1) or -1 (sign -1) at x. */
const cyclePhase = (x: number, freq: number, sign: 1 | -1): number =>
  (sign * Math.PI) / 2 - x * freq;
const at600 = MAX_SPEED; // every world 9+ level runs at the speed cap

describe("phantom (world 9): phases solid/ghost as a function of x", () => {
  const phantom = (x: number, phase: number): Obstacle => ({
    x, w: 60, h: 110, elev: 0, kind: "phantom", phase,
  });

  it("is deterministic", () => {
    expect(phantomSolid(phantom(423, 2))).toBe(phantomSolid(phantom(423, 2)));
  });

  it("ghost form is harmless, solid form kills at track level", () => {
    expect(checkDeath(GROUND_Y, [phantom(PLAYER_X, cyclePhase(PLAYER_X, PHANTOM_FREQ, -1))])).toBe(false);
    expect(checkDeath(GROUND_Y, [phantom(PLAYER_X, cyclePhase(PLAYER_X, PHANTOM_FREQ, 1))])).toBe(true);
  });

  it("the solid form is jumpable with margin at the cap speed", () => {
    const solid = phantom(PLAYER_X, cyclePhase(PLAYER_X, PHANTOM_FREQ, 1));
    expect(checkDeath(GROUND_Y - 120, [solid])).toBe(false);
    expect(airWindowPx(at600, 110 - 6)).toBeGreaterThan(60 - 12 + PLAYER_SIZE + 30);
  });
});

describe("vine (world 10): lash height oscillates as a function of x", () => {
  const vine = (x: number, phase: number): Obstacle => ({
    x, w: 54, h: 140, elev: 0, kind: "vine", phase,
  });

  it("stays inside [40, 140] and is deterministic", () => {
    for (let x = 0; x < 1000; x += 43) {
      const h = vineHeight(vine(x, 0.9));
      expect(h).toBeGreaterThanOrEqual(VINE_MID - VINE_AMP);
      expect(h).toBeLessThanOrEqual(VINE_MID + VINE_AMP);
    }
    expect(VINE_MID - VINE_AMP).toBe(40);
    expect(VINE_MID + VINE_AMP).toBe(140);
    expect(vineHeight(vine(423, 2))).toBe(vineHeight(vine(423, 2)));
  });

  it("kills up to its current reach, cleared above it", () => {
    const tall = vine(PLAYER_X, cyclePhase(PLAYER_X, VINE_FREQ, 1)); // reach 140
    expect(checkDeath(GROUND_Y, [tall])).toBe(true);
    expect(checkDeath(GROUND_Y - 150, [tall])).toBe(false);
  });

  it("full stretch is jumpable with margin at the cap speed", () => {
    expect(airWindowPx(at600, 140 - 6)).toBeGreaterThan(54 - 16 + PLAYER_SIZE + 30);
  });
});

describe("gear (world 11): patrols the ground as a function of x", () => {
  const gear = (x: number, phase: number): Obstacle => ({
    x, w: 70, h: 70, elev: 0, kind: "gear", phase,
  });

  it("shift stays inside ±GEAR_SHIFT_AMP and is deterministic", () => {
    for (let x = 0; x < 1000; x += 37) {
      expect(Math.abs(gearShift(gear(x, 1.1)))).toBeLessThanOrEqual(GEAR_SHIFT_AMP);
    }
    expect(gearShift(gear(423, 2))).toBe(gearShift(gear(423, 2)));
  });

  it("kills where the patrol puts it, not at the anchor", () => {
    const x = PLAYER_X + PLAYER_SIZE + 12;
    expect(checkDeath(GROUND_Y, [gear(x, cyclePhase(x, GEAR_FREQ, -1))])).toBe(true);
    expect(checkDeath(GROUND_Y, [gear(x, cyclePhase(x, GEAR_FREQ, 1))])).toBe(false);
  });

  it("the whole patrol footprint fits inside one jump", () => {
    const killSpan = 2 * (70 / 2 - 8) + PLAYER_SIZE + 2 * GEAR_SHIFT_AMP;
    expect(airWindowPx(at600, 62)).toBeGreaterThan(killSpan + 30);
  });
});

describe("gate (world 12): jump through the window between the bars", () => {
  const gate = (x: number): Obstacle => ({ x, w: 24, h: 300, elev: 0, kind: "gate" });

  it("kills on the ground and at the apex, passes through the window", () => {
    expect(checkDeath(GROUND_Y, [gate(PLAYER_X)])).toBe(true); // bottom bar
    expect(checkDeath(GROUND_Y - 200, [gate(PLAYER_X)])).toBe(true); // top bar
    expect(checkDeath(GROUND_Y - 100, [gate(PLAYER_X)])).toBe(false); // window
  });

  it("the window fits the player with headroom", () => {
    expect(GATE_GAP_HI - GATE_GAP_LO - PLAYER_SIZE).toBeGreaterThanOrEqual(60);
  });
});

describe("crusher (world 13): bobs in the swing band", () => {
  const crusher = (x: number, phase: number): Obstacle => ({
    x, w: 90, h: 60, elev: 0, kind: "crusher", phase,
  });

  it("reuses the swing band [10, 130] — over when low, under when high", () => {
    for (let x = 0; x < 1000; x += 41) {
      const elev = crusherElev(crusher(x, 0.4));
      expect(elev).toBeGreaterThanOrEqual(SWING_MID - SWING_AMP);
      expect(elev).toBeLessThanOrEqual(SWING_MID + SWING_AMP);
    }
  });

  it("high point: run under; low point: fatal on the ground, jumpable", () => {
    const high = crusher(PLAYER_X, cyclePhase(PLAYER_X, CRUSHER_FREQ, 1)); // elev 130
    expect(checkDeath(GROUND_Y, [high])).toBe(false);
    expect(checkDeath(GROUND_Y - 140, [high])).toBe(true);
    const low = crusher(PLAYER_X, cyclePhase(PLAYER_X, CRUSHER_FREQ, -1)); // elev 10
    expect(checkDeath(GROUND_Y, [low])).toBe(true);
    expect(checkDeath(GROUND_Y - 160, [low])).toBe(false);
  });

  it("jump-over at the worst still-low elevation clears with margin", () => {
    // Below elev 80 the slab must be jumped; worst top = 80 + 60 = 140.
    expect(airWindowPx(at600, 140 - 6)).toBeGreaterThan(90 - 16 + PLAYER_SIZE + 30);
  });
});

describe("urchin (world 14): static floating ball, jump-over only", () => {
  const urchin = (x: number): Obstacle => ({ x, w: 80, h: 80, elev: 0, kind: "urchin" });

  it("too low to run under, cleared by a high jump", () => {
    expect(checkDeath(GROUND_Y, [urchin(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y - 170, [urchin(PLAYER_X)])).toBe(false);
  });

  it("its top stays inside single-jump reach with margin", () => {
    expect(URCHIN_ELEV + 80).toBeLessThanOrEqual(130);
    expect(airWindowPx(at600, URCHIN_ELEV + 80)).toBeGreaterThan(80 - 12 + PLAYER_SIZE + 30);
  });
});

describe("talon (world 15): erupts as a function of x", () => {
  const talon = (x: number, phase: number): Obstacle => ({
    x, w: 66, h: 120, elev: 0, kind: "talon", phase,
  });

  it("buried claw is harmless, erupted claw kills, and it's jumpable", () => {
    expect(checkDeath(GROUND_Y, [talon(PLAYER_X, cyclePhase(PLAYER_X, TALON_FREQ, -1))])).toBe(false);
    const up = talon(PLAYER_X, cyclePhase(PLAYER_X, TALON_FREQ, 1));
    expect(checkDeath(GROUND_Y, [up])).toBe(true);
    expect(checkDeath(GROUND_Y - 130, [up])).toBe(false);
    expect(airWindowPx(at600, 120 - 6)).toBeGreaterThan(66 - 12 + PLAYER_SIZE + 30);
  });

  it("is deterministic", () => {
    expect(talonActive(talon(423, 2))).toBe(talonActive(talon(423, 2)));
  });
});

describe("drone (world 16): hovers high enough to always run under", () => {
  const drone = (x: number, phase: number): Obstacle => ({
    x, w: 60, h: 60, elev: 0, kind: "drone", phase,
  });

  it("elevation never drops below the run-under threshold", () => {
    for (let x = 0; x < 2000; x += 29) {
      for (const phase of [0, 1, 2, 3, 4, 5]) {
        expect(droneElev(drone(x, phase))).toBeGreaterThanOrEqual(80);
      }
    }
    expect(DRONE_ELEV_MID - DRONE_ELEV_AMP).toBe(80);
  });

  it("a grounded player passes safely underneath", () => {
    for (const phase of [0, 1.3, 2.6, 4.1]) {
      expect(checkDeath(GROUND_Y, [drone(PLAYER_X, phase)])).toBe(false);
    }
  });

  it("kills inside its hover band", () => {
    expect(checkDeath(GROUND_Y - 130, [drone(PLAYER_X, 0)])).toBe(true);
  });
});

describe("obelisk (world 17): the tallest precise jump", () => {
  const obelisk = (x: number): Obstacle => ({ x, w: 30, h: 150, elev: 0, kind: "obelisk" });

  it("kills on overlap, cleared above, offers no landing support", () => {
    expect(checkDeath(GROUND_Y, [obelisk(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y - 160, [obelisk(PLAYER_X)])).toBe(false);
    expect(supportAt(GROUND_Y - 200, [obelisk(PLAYER_X)])).toBe(GROUND_Y);
  });

  it("clears under the apex with margin at the cap speed", () => {
    expect(airWindowPx(at600, 150 - 6)).toBeGreaterThan(30 - 12 + PLAYER_SIZE + 30);
  });
});

describe("flare (world 18): the widest committed jump", () => {
  const flare = (x: number): Obstacle => ({ x, w: 210, h: 24, elev: 0, kind: "flare" });

  it("kills near track level anywhere in the span, safe in the air", () => {
    expect(checkDeath(GROUND_Y, [flare(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y, [flare(PLAYER_X - 100)])).toBe(true);
    expect(checkDeath(GROUND_Y - 40, [flare(PLAYER_X)])).toBe(false);
  });

  it("forgives the edge insets", () => {
    expect(checkDeath(GROUND_Y, [flare(PLAYER_X + PLAYER_SIZE - 10)])).toBe(false);
    expect(checkDeath(GROUND_Y, [flare(PLAYER_X - 210 + 10)])).toBe(false);
  });

  it("is clearable in a single jump at the cap speed", () => {
    expect(airWindowPx(at600, 24 - 8)).toBeGreaterThan(210 - 20 + PLAYER_SIZE + 30);
  });
});

describe("comet (world 19): descends along the track, grounded early", () => {
  const comet = (x: number): Obstacle => ({ x, w: 54, h: 60, elev: 0, kind: "comet" });

  it("is airborne far out and grounded from the impact point on", () => {
    expect(cometElev(comet(COMET_IMPACT_X + 200))).toBeCloseTo(200 * COMET_SLOPE);
    expect(cometElev(comet(COMET_IMPACT_X))).toBe(0);
    expect(cometElev(comet(PLAYER_X)))
      .toBe(0); // grounded well before it reaches the player
  });

  it("kills inside its band; the grounded rock is a jumpable hurdle", () => {
    expect(checkDeath(GROUND_Y, [comet(PLAYER_X)])).toBe(true);
    expect(checkDeath(GROUND_Y - 80, [comet(PLAYER_X)])).toBe(false);
    expect(airWindowPx(at600, 60 - 6)).toBeGreaterThan(54 - 16 + PLAYER_SIZE + 30);
  });
});

describe("reaper (world 20): the blade sweeps as a function of x", () => {
  const reaper = (x: number, phase: number): Obstacle => ({
    x, w: 60, h: 90, elev: 0, kind: "reaper", phase,
  });

  it("resting post is safe, sweeping blade kills, and it's jumpable", () => {
    expect(checkDeath(GROUND_Y, [reaper(PLAYER_X, cyclePhase(PLAYER_X, REAPER_FREQ, -1))])).toBe(false);
    const sweep = reaper(PLAYER_X, cyclePhase(PLAYER_X, REAPER_FREQ, 1));
    expect(checkDeath(GROUND_Y, [sweep])).toBe(true);
    expect(checkDeath(GROUND_Y - 100, [sweep])).toBe(false);
    expect(airWindowPx(at600, 90 - 6)).toBeGreaterThan(60 - 12 + PLAYER_SIZE + 30);
  });

  it("is deterministic", () => {
    expect(reaperActive(reaper(423, 2))).toBe(reaperActive(reaper(423, 2)));
  });
});

describe("phase bookkeeping", () => {
  it("KINDS_WITH_PHASE lists exactly the motion/cycle kinds", () => {
    for (const k of ["swing", "geyser", "tentacle", "phantom", "vine", "gear", "crusher", "talon", "drone", "reaper"] as const) {
      expect(KINDS_WITH_PHASE.has(k)).toBe(true);
    }
    for (const k of ["spike", "block", "pit", "laser", "arc", "gate", "urchin", "obelisk", "flare", "comet"] as const) {
      expect(KINDS_WITH_PHASE.has(k)).toBe(false);
    }
  });
});

describe("track zones (mirror/flip render zones)", () => {
  const lengthFor = (level: number): number => levelLengthM(level) * 10;

  it("gates by level: none before 41, mirror-only 41-60, both from 61", () => {
    expect(MIRROR_MIN_LEVEL).toBe(41);
    expect(FLIP_MIN_LEVEL).toBe(61);
    expect(trackZones(40, lengthFor(40))).toHaveLength(0);
    for (const level of [41, 50, 55, 60]) {
      const zones = trackZones(level, lengthFor(level));
      expect(zones.length).toBeGreaterThanOrEqual(1);
      expect(zones.every((z) => z.kind === "mirror")).toBe(true);
    }
    for (const level of [61, 75, 99]) {
      const zones = trackZones(level, lengthFor(level));
      expect(zones.some((z) => z.kind === "mirror")).toBe(true);
      expect(zones.some((z) => z.kind === "flip")).toBe(true);
    }
  });

  it("zones are sorted, sized, spaced, and clear of the finish runway", () => {
    for (const level of [41, 47, 55, 61, 70, 83, 99]) {
      const len = lengthFor(level);
      const zones = trackZones(level, len);
      let prevEnd: number | null = null;
      for (const z of zones) {
        expect(z.start).toBeGreaterThanOrEqual(1200);
        if (prevEnd !== null) expect(z.start).toBeGreaterThanOrEqual(prevEnd + 800);
        expect(z.end - z.start).toBeGreaterThanOrEqual(1500);
        expect(z.end - z.start).toBeLessThanOrEqual(6000);
        expect(z.end).toBeLessThanOrEqual(len - 1600);
        prevEnd = z.end;
      }
    }
  });

  it("is deterministic per level", () => {
    expect(trackZones(70, lengthFor(70))).toEqual(trackZones(70, lengthFor(70)));
  });

  it("zoneKindAt reports the covering zone and null elsewhere", () => {
    const zones = trackZones(61, lengthFor(61));
    expect(zones.length).toBeGreaterThan(0);
    const z = zones[0]!;
    expect(zoneKindAt(0, zones)).toBeNull();
    expect(zoneKindAt(z.start + 1, zones)).toBe(z.kind);
    expect(zoneKindAt(z.end, zones)).not.toBe(z.kind === "mirror" ? "flip" : "mirror");
  });
});

describe("power-up pool (doubleJump / shield / slowmo)", () => {
  it("gates kinds by level and stays deterministic per seed", () => {
    expect(POWERUP_UNLOCK_LEVEL.doubleJump).toBe(1);
    const kindsSeen = (level: number): Set<string> => {
      const s = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) s.add(makePowerUp(new Rng(seed), 800, level).kind);
      return s;
    };
    expect(kindsSeen(1)).toEqual(new Set(["doubleJump"]));
    expect(kindsSeen(POWERUP_UNLOCK_LEVEL.shield)).toEqual(new Set(["doubleJump", "shield"]));
    expect(kindsSeen(POWERUP_UNLOCK_LEVEL.slowmo)).toEqual(new Set(["doubleJump", "shield", "slowmo"]));
    expect(makePowerUp(new Rng(7), 800, 20)).toEqual(makePowerUp(new Rng(7), 800, 20));
  });

  it("every spec has a duration, label, color and glyph", () => {
    for (const spec of Object.values(POWER_UPS)) {
      expect(spec.durationMs).toBeGreaterThan(1000);
      expect(spec.label.length).toBeGreaterThan(3);
      expect(spec.glyph.length).toBeGreaterThan(0);
    }
  });

  it("slow-mo only ever slows the world down", () => {
    expect(SLOWMO_MUL).toBeLessThan(1);
    expect(SLOWMO_MUL).toBeGreaterThan(0.5);
  });
});

describe("track boosts (launch pads / dash strips)", () => {
  const lengthFor = (level: number): number => levelLengthM(level) * 10;

  it("pads unlock at level 6, strips at level 9", () => {
    expect(trackBoosts(5, lengthFor(5))).toHaveLength(0);
    for (const level of [6, 7, 8]) {
      const boosts = trackBoosts(level, lengthFor(level));
      expect(boosts.length).toBeGreaterThanOrEqual(2);
      expect(boosts.every((b) => b.kind === "pad")).toBe(true);
    }
    // Strips appear somewhere from level 9 on (seeded coin flips).
    const stripLevels = [9, 10, 11, 12, 13, 14].filter((lvl) =>
      trackBoosts(lvl, lengthFor(lvl)).some((b) => b.kind === "strip"),
    );
    expect(stripLevels.length).toBeGreaterThan(0);
  });

  it("boosts are sorted, spaced, and clear of the start and runway", () => {
    for (const level of [6, 9, 20, 47, 80, 99]) {
      const len = lengthFor(level);
      const boosts = trackBoosts(level, len);
      let prev = -Infinity;
      for (const b of boosts) {
        expect(b.at).toBeGreaterThanOrEqual(1200);
        if (prev !== -Infinity) expect(b.at - prev).toBeGreaterThanOrEqual(900);
        const margin = b.kind === "strip" ? DASH_LENGTH_PX : 200;
        expect(b.at + margin).toBeLessThanOrEqual(len - 1600);
        prev = b.at;
      }
    }
  });

  it("is deterministic and pads launch strictly higher than a normal jump", () => {
    expect(trackBoosts(30, lengthFor(30))).toEqual(trackBoosts(30, lengthFor(30)));
    expect(PAD_JUMP_VELOCITY).toBeLessThan(JUMP_VELOCITY); // more negative = harder launch
    expect(DASH_MUL).toBeGreaterThan(1);
  });
});

describe("finale levels (every world's 5th)", () => {
  it("flags exactly the multiples of LEVELS_PER_WORLD", () => {
    expect(isFinaleLevel(5)).toBe(true);
    expect(isFinaleLevel(100)).toBe(true);
    expect(isFinaleLevel(4)).toBe(false);
    expect(isFinaleLevel(41)).toBe(false);
  });

  it("tightens gaps vs. its neighbors but respects the floor", () => {
    expect(levelGapScale(5)).toBeLessThan(levelGapScale(4));
    // From level 9 the base scale is already at the floor — finales stay there.
    expect(levelGapScale(10)).toBe(0.75);
    // The 1..99 clearability loop above already proves finales stay fair.
    expect(levelGapScale(100)).toBe(0.75);
  });
});

describe("padLaunchSafe (pads fire whenever the flight itself is fair)", () => {
  it("fires on an open track", () => {
    expect(padLaunchSafe([], 600)).toBe(true);
  });

  it("soars OVER a mid-flight obstacle (apex ≈ 312px beats an obelisk)", () => {
    const obelisk: Obstacle = { x: PLAYER_X + 190, w: 30, h: 150, elev: 0, kind: "obelisk" };
    expect(padLaunchSafe([obelisk], 600)).toBe(true);
  });

  it("holds fire when the landing zone is lethal", () => {
    // Spike parked where the pad flight touches down (~390px at 600 px/s).
    const spike: Obstacle = { x: PLAYER_X + 390, w: 60, h: 60, elev: 0, kind: "spike" };
    expect(padLaunchSafe([spike], 600)).toBe(false);
  });

  it("holds fire when touchdown leaves no time to react", () => {
    // Clean landing, but a spike inside the post-landing tail window.
    const spike: Obstacle = { x: PLAYER_X + 520, w: 60, h: 60, elev: 0, kind: "spike" };
    expect(padLaunchSafe([spike], 600)).toBe(false);
  });

  it("fires when the next hazard is far enough to react to", () => {
    const spike: Obstacle = { x: PLAYER_X + 900, w: 60, h: 60, elev: 0, kind: "spike" };
    expect(padLaunchSafe([spike], 600)).toBe(true);
  });
});
