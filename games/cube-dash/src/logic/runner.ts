import type { Rng } from "@mg/core";

/** World units are game pixels (720x1280 canvas). y grows downward. */
export const GROUND_Y = 1000;
export const PLAYER_SIZE = 60;
/** Left edge of the player square. */
export const PLAYER_X = 180;

export const GRAVITY = 6000; // px/s²
export const JUMP_VELOCITY = -1550; // px/s

export const BASE_SPEED = 420; // px/s
export const MAX_SPEED = 600;

/** Total airtime of a full jump from flat ground. */
export const JUMP_AIRTIME_SEC = (2 * -JUMP_VELOCITY) / GRAVITY;

export interface Runner {
  /** Bottom edge of the player square. */
  y: number;
  vy: number;
  grounded: boolean;
  /** The one air jump (double-jump power-up) has been spent this airtime. */
  airJumpUsed: boolean;
}

/**
 * One new kind unlocks per world (see KIND_UNLOCK_LEVEL):
 * spike/block from world 1, saw (ground buzzsaw, circular hitbox) world 2,
 * pit (lava trench, lethal only at ground level) world 3, swing (spike ball
 * bobbing up/down as it scrolls) world 4, laser (thin tall pylon beam) world 5.
 */
export type ObstacleKind = "spike" | "block" | "saw" | "pit" | "swing" | "laser";

export interface Obstacle {
  /** Left edge in world pixels (scrolls toward the player). */
  x: number;
  w: number;
  /** Height of the obstacle body itself. */
  h: number;
  /** Bottom edge's height above the ground: 0 = grounded, >0 = floating. */
  elev: number;
  kind: ObstacleKind;
  /** Bob-cycle offset for "swing" obstacles (assigned from the level rng). */
  phase?: number;
}

// Swing mines bob as a pure function of x, so layouts stay deterministic and
// every attempt at a level shows the identical motion. The elev range
// [MID-AMP, MID+AMP] = [10, 130] is always clearable: ≤ 120 can be jumped
// over (apex ≈ 200), ≥ 80 can be run under — the bands overlap.
export const SWING_MID = 70;
export const SWING_AMP = 60;
/** One full bob per 500px of scroll. */
export const SWING_FREQ = (2 * Math.PI) / 500;

/** Current bottom-edge height of a swing mine above the ground. */
export function swingElev(o: Obstacle): number {
  return SWING_MID + SWING_AMP * Math.sin(o.x * SWING_FREQ + (o.phase ?? 0));
}

// ---------------------------------------------------------------------------
// Level system: discrete, selectable levels. Each is a fixed-length run with
// a finish line; clearing it unlocks the next. Difficulty and layout are a
// function of the level number, and the layout is seeded so every attempt at
// a level is identical — memorizable, Geometry-Dash style.

export const LEVEL_SPEED_STEP = 40;
export const LEVELS_PER_WORLD = 5;
const BASE_LEVEL_DURATION_SEC = 30;
const DURATION_STEP_SEC = 15;

/**
 * Level length is time-based: every world (5 levels) targets a duration —
 * 30s for levels 1-5, then +15s per world (45s, 60s, ...).
 */
export function levelDurationSec(level: number): number {
  return (
    BASE_LEVEL_DURATION_SEC +
    DURATION_STEP_SEC * Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD)
  );
}

/** Distance derived from the target duration at this level's scroll speed. */
export function levelLengthM(level: number): number {
  return Math.round((levelSpeed(level) * levelDurationSec(level)) / 10);
}

/** Deterministic seed per level so its obstacle layout never changes. */
export function levelSeed(level: number): number {
  return level * 7919;
}

export function levelSpeed(level: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + (level - 1) * LEVEL_SPEED_STEP);
}

/**
 * Scales the gap between obstacle patterns: early levels are roomy, later
 * ones tighten toward the floor. Floor keeps every level clearable (see test).
 */
export function levelGapScale(level: number): number {
  return Math.max(0.75, 1.2 - 0.06 * (level - 1));
}

/** Accent color per WORLD (5 levels each): teal, green, orange, cycling. */
export const LEVEL_COLORS: readonly number[] = [0x4dd0e1, 0x66bb6a, 0xff7043];

export function levelColor(level: number): number {
  const world = Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD);
  return LEVEL_COLORS[world % LEVEL_COLORS.length]!;
}

/** Level at which each obstacle kind first appears: +1 kind per world. */
export const KIND_UNLOCK_LEVEL: Record<ObstacleKind, number> = {
  spike: 1,
  block: 1,
  saw: 1 + LEVELS_PER_WORLD, // world 2
  pit: 1 + LEVELS_PER_WORLD * 2, // world 3
  swing: 1 + LEVELS_PER_WORLD * 3, // world 4
  laser: 1 + LEVELS_PER_WORLD * 4, // world 5
};

export function obstacleKindsForLevel(level: number): ObstacleKind[] {
  return (Object.keys(KIND_UNLOCK_LEVEL) as ObstacleKind[]).filter(
    (k) => KIND_UNLOCK_LEVEL[k] <= level,
  );
}

/** Horizontal distance covered during one full jump at the given speed. */
export function jumpDistancePx(speed: number): number {
  return speed * JUMP_AIRTIME_SEC;
}

/**
 * Attempts a jump. Grounded jumps always work; one extra air jump is allowed
 * while the double-jump power-up is active. Returns what kind of jump
 * happened (null = nothing).
 */
export function tryJump(r: Runner, allowAirJump: boolean): "ground" | "air" | null {
  if (r.grounded) {
    r.vy = JUMP_VELOCITY;
    r.grounded = false;
    return "ground";
  }
  if (allowAirJump && !r.airJumpUsed) {
    r.vy = JUMP_VELOCITY;
    r.airJumpUsed = true;
    return "air";
  }
  return null;
}

export function jump(r: Runner): void {
  tryJump(r, false);
}

/**
 * The surface the player would land on at its current x: the ground, or the
 * top of a block the player is above (with a small tolerance so a pixel of
 * overlap doesn't drop the player through).
 */
export function supportAt(bottomY: number, obstacles: readonly Obstacle[]): number {
  let support = GROUND_Y;
  for (const o of obstacles) {
    if (o.kind !== "block") continue;
    const top = GROUND_Y - o.elev - o.h;
    const overlapsX = PLAYER_X + PLAYER_SIZE > o.x && PLAYER_X < o.x + o.w;
    if (overlapsX && bottomY <= top + 8) support = Math.min(support, top);
  }
  return support;
}

/** Advances physics one frame. Lands on `support` when falling through it. */
export function stepRunner(r: Runner, dtSec: number, support: number): void {
  if (r.grounded && r.y < support - 0.5) {
    // The surface under the player dropped away (walked off a block).
    r.grounded = false;
  }
  if (r.grounded) return;
  r.vy += GRAVITY * dtSec;
  const newY = r.y + r.vy * dtSec;
  if (r.vy > 0 && newY >= support) {
    r.y = support;
    r.vy = 0;
    r.grounded = true;
    r.airJumpUsed = false;
  } else {
    r.y = newY;
  }
}

/**
 * True when the player is fatally overlapping an obstacle.
 * Spikes use an inset hitbox for fairness; blocks kill only when the player's
 * body is inside them (i.e. hit the side) — standing on top is safe.
 * Floating obstacles only kill inside their vertical band, so the player can
 * run underneath them. Saws and swing mines are round (circle hitbox), pits
 * are lethal only at ground level (jump across), lasers on any beam overlap.
 */
export function checkDeath(bottomY: number, obstacles: readonly Obstacle[]): boolean {
  const pl = PLAYER_X;
  const pr = PLAYER_X + PLAYER_SIZE;
  const pt = bottomY - PLAYER_SIZE;
  for (const o of obstacles) {
    if (o.kind === "pit") {
      const inset = 22;
      if (bottomY >= GROUND_Y - 2 && pr > o.x + inset && pl < o.x + o.w - inset) return true;
      continue;
    }
    if (o.kind === "saw" || o.kind === "swing") {
      const elev = o.kind === "swing" ? swingElev(o) : o.elev;
      const r = o.w / 2 - (o.kind === "saw" ? 8 : 6);
      const cx = o.x + o.w / 2;
      const cy = GROUND_Y - elev - o.h / 2;
      // Circle vs player rect: distance from center to the nearest rect point.
      const nx = Math.max(pl, Math.min(cx, pr));
      const ny = Math.max(pt, Math.min(cy, bottomY));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) return true;
      continue;
    }
    const top = GROUND_Y - o.elev - o.h;
    const bottom = GROUND_Y - o.elev;
    if (o.kind === "laser") {
      const inset = 6;
      if (pr > o.x + inset && pl < o.x + o.w - inset && bottomY > top + 6 && pt < bottom) {
        return true;
      }
    } else if (o.kind === "spike") {
      const inset = 16;
      if (
        pr > o.x + inset &&
        pl < o.x + o.w - inset &&
        bottomY > top + 12 &&
        pt < bottom - 12
      ) {
        return true;
      }
    } else {
      if (pr > o.x && pl < o.x + o.w && bottomY > top + 8 && pt < bottom - 4) return true;
    }
  }
  return false;
}

/** An obstacle group spawned as a unit; dx is relative to the pattern start. */
export interface Pattern {
  id: string;
  obstacles: ReadonlyArray<{ dx: number; w: number; h: number; kind: ObstacleKind; elev?: number }>;
  /** Total footprint used for spacing to the next pattern. */
  width: number;
  /** Patterns needing longer jumps unlock at higher scroll speeds. */
  minSpeed: number;
  /**
   * Patterns built on later worlds' obstacle kinds unlock at that world's
   * first level (default 1). Must be ≥ KIND_UNLOCK_LEVEL of every kind used.
   */
  minLevel?: number;
}

export const PATTERNS: readonly Pattern[] = [
  { id: "spike1", obstacles: [{ dx: 0, w: 60, h: 60, kind: "spike" }], width: 60, minSpeed: 0 },
  {
    id: "spike2",
    obstacles: [
      { dx: 0, w: 60, h: 60, kind: "spike" },
      { dx: 60, w: 60, h: 60, kind: "spike" },
    ],
    width: 120,
    minSpeed: 0,
  },
  {
    id: "spike3",
    obstacles: [
      { dx: 0, w: 60, h: 60, kind: "spike" },
      { dx: 60, w: 60, h: 60, kind: "spike" },
      { dx: 120, w: 60, h: 60, kind: "spike" },
    ],
    width: 180,
    minSpeed: 540,
  },
  { id: "blockLow", obstacles: [{ dx: 0, w: 120, h: 60, kind: "block" }], width: 120, minSpeed: 0 },
  { id: "blockTall", obstacles: [{ dx: 0, w: 90, h: 120, kind: "block" }], width: 90, minSpeed: 0 },
  {
    id: "spikeGapSpike",
    obstacles: [
      { dx: 0, w: 60, h: 60, kind: "spike" },
      { dx: 300, w: 60, h: 60, kind: "spike" },
    ],
    width: 360,
    minSpeed: 0,
  },
  // --- layered patterns, unlocked as levels speed up ---
  {
    // Two-step climb: hop up, hop again (or one big jump to the top).
    id: "stairs",
    obstacles: [
      { dx: 0, w: 90, h: 60, kind: "block" },
      { dx: 90, w: 90, h: 120, kind: "block" },
    ],
    width: 180,
    minSpeed: 460, // level 2+
  },
  {
    // Overhead slab: forces the player to STAY LOW, then hop a spike after.
    id: "tunnel",
    obstacles: [
      { dx: 0, w: 240, h: 60, kind: "block", elev: 90 },
      { dx: 360, w: 60, h: 60, kind: "spike" },
    ],
    width: 420,
    minSpeed: 500, // level 3+
  },
  {
    // Floating mine at jump height: safe to run under, fatal to jump into.
    id: "airMine",
    obstacles: [{ dx: 0, w: 54, h: 54, kind: "spike", elev: 110 }],
    width: 54,
    minSpeed: 500, // level 3+
  },
  {
    // Elevated skyway over a spike field: jump onto the platform, ride it,
    // hop off over the last spikes.
    id: "skyway",
    obstacles: [
      { dx: 0, w: 240, h: 30, kind: "block", elev: 120 },
      { dx: 60, w: 120, h: 60, kind: "spike" },
      { dx: 180, w: 120, h: 60, kind: "spike" },
    ],
    width: 320,
    minSpeed: 540, // level 4+
  },
  {
    // Ground spike, then a mine hanging over the landing zone: jump EARLY.
    id: "mineCombo",
    obstacles: [
      { dx: 0, w: 60, h: 60, kind: "spike" },
      { dx: 210, w: 54, h: 54, kind: "spike", elev: 130 },
    ],
    width: 264,
    minSpeed: 580, // level 5+
  },
  // --- new obstacle KINDS, one unlocking per world (KIND_UNLOCK_LEVEL) ---
  {
    // Spinning buzzsaw: taller than a spike, round hitbox — jump it clean.
    id: "saw1",
    obstacles: [{ dx: 0, w: 90, h: 90, kind: "saw" }],
    width: 90,
    minSpeed: 0,
    minLevel: 6, // world 2
  },
  {
    // Saw, breather, spike: two distinct jumps in rhythm.
    id: "sawSpike",
    obstacles: [
      { dx: 0, w: 90, h: 90, kind: "saw" },
      { dx: 390, w: 60, h: 60, kind: "spike" },
    ],
    width: 450,
    minSpeed: 0,
    minLevel: 8,
  },
  {
    // Lava trench: harmless in the air, fatal to touch down in — jump across.
    id: "pit1",
    obstacles: [{ dx: 0, w: 150, h: 24, kind: "pit" }],
    width: 150,
    minSpeed: 0,
    minLevel: 11, // world 3
  },
  {
    // Trench then saw: land the crossing, immediately set up the next jump.
    id: "pitSaw",
    obstacles: [
      { dx: 0, w: 150, h: 24, kind: "pit" },
      { dx: 450, w: 90, h: 90, kind: "saw" },
    ],
    width: 540,
    minSpeed: 0,
    minLevel: 13,
  },
  {
    // Bobbing spike mine: read its height — jump over when low, run under
    // when high (every point of its cycle is clearable one way or the other).
    id: "swing1",
    obstacles: [{ dx: 0, w: 54, h: 54, kind: "swing" }],
    width: 54,
    minSpeed: 0,
    minLevel: 16, // world 4
  },
  {
    // Mine guarding a trench: judge the bob, then commit to the crossing.
    id: "swingPit",
    obstacles: [
      { dx: 0, w: 54, h: 54, kind: "swing" },
      { dx: 330, w: 150, h: 24, kind: "pit" },
    ],
    width: 480,
    minSpeed: 0,
    minLevel: 18,
  },
  {
    // Plasma pylon: thin but tall — a late, precise jump.
    id: "laser1",
    obstacles: [{ dx: 0, w: 24, h: 130, kind: "laser" }],
    width: 24,
    minSpeed: 0,
    minLevel: 21, // world 5
  },
  {
    // Twin pylons: two precise jumps back to back.
    id: "laserRow",
    obstacles: [
      { dx: 0, w: 24, h: 130, kind: "laser" },
      { dx: 420, w: 24, h: 130, kind: "laser" },
    ],
    width: 444,
    minSpeed: 0,
    minLevel: 23,
  },
];

export function pickPattern(rng: Rng, speed: number, level: number): Pattern {
  const available = PATTERNS.filter(
    (p) => p.minSpeed <= speed && (p.minLevel ?? 1) <= level,
  );
  return rng.pick(available);
}

/** Breathing room between patterns: reaction time plus one full jump. */
export function minGapPx(speed: number): number {
  return 0.5 * speed + jumpDistancePx(speed);
}

// ---------------------------------------------------------------------------
// Power-ups: temporary timed abilities collected as floating pickups.

export type PowerUpKind = "doubleJump";

export interface PowerUpSpec {
  durationMs: number;
  label: string;
  color: number;
}

export const POWER_UPS: Record<PowerUpKind, PowerUpSpec> = {
  doubleJump: { durationMs: 10_000, label: "DOUBLE JUMP", color: 0xffd54f },
};

export const POWERUP_SIZE = 56;

export interface PowerUp {
  /** Center of the pickup, in world pixels. */
  x: number;
  y: number;
  kind: PowerUpKind;
}

/** Pickups float within single-jump reach (apex ≈ 200px above ground). */
export function makePowerUp(rng: Rng, x: number): PowerUp {
  return {
    x,
    y: GROUND_Y - 90 - rng.next() * 90,
    kind: "doubleJump",
  };
}

/** World-pixel gap between pickup spawns. */
export function powerUpGapPx(rng: Rng): number {
  return 2400 + rng.next() * 1600;
}

export function collectsPowerUp(bottomY: number, p: PowerUp): boolean {
  const half = POWERUP_SIZE / 2;
  return (
    PLAYER_X + PLAYER_SIZE > p.x - half &&
    PLAYER_X < p.x + half &&
    bottomY > p.y - half &&
    bottomY - PLAYER_SIZE < p.y + half
  );
}
