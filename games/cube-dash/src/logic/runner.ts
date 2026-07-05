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
}

export type ObstacleKind = "spike" | "block";

export interface Obstacle {
  /** Left edge in world pixels (scrolls toward the player). */
  x: number;
  w: number;
  /** Height above the ground line. */
  h: number;
  kind: ObstacleKind;
}

export function speedForDistance(distancePx: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + distancePx / 12);
}

/** Horizontal distance covered during one full jump at the given speed. */
export function jumpDistancePx(speed: number): number {
  return speed * JUMP_AIRTIME_SEC;
}

export function jump(r: Runner): void {
  if (!r.grounded) return;
  r.vy = JUMP_VELOCITY;
  r.grounded = false;
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
    const top = GROUND_Y - o.h;
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
  } else {
    r.y = newY;
  }
}

/**
 * True when the player is fatally overlapping an obstacle.
 * Spikes use an inset hitbox for fairness; blocks kill only when the player's
 * body is inside them (i.e. hit the side) — standing on top is safe.
 */
export function checkDeath(bottomY: number, obstacles: readonly Obstacle[]): boolean {
  const pl = PLAYER_X;
  const pr = PLAYER_X + PLAYER_SIZE;
  for (const o of obstacles) {
    const top = GROUND_Y - o.h;
    if (o.kind === "spike") {
      const inset = 16;
      if (pr > o.x + inset && pl < o.x + o.w - inset && bottomY > top + 12) return true;
    } else {
      if (pr > o.x && pl < o.x + o.w && bottomY > top + 8) return true;
    }
  }
  return false;
}

/** An obstacle group spawned as a unit; dx is relative to the pattern start. */
export interface Pattern {
  id: string;
  obstacles: ReadonlyArray<{ dx: number; w: number; h: number; kind: ObstacleKind }>;
  /** Total footprint used for spacing to the next pattern. */
  width: number;
  /** Patterns needing longer jumps unlock at higher scroll speeds. */
  minSpeed: number;
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
];

export function pickPattern(rng: Rng, speed: number): Pattern {
  const available = PATTERNS.filter((p) => p.minSpeed <= speed);
  return rng.pick(available);
}

/** Breathing room between patterns: reaction time plus one full jump. */
export function minGapPx(speed: number): number {
  return 0.5 * speed + jumpDistancePx(speed);
}
