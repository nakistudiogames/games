import type { Rng } from "@mg/core";

/** World is measured in game pixels (720x1280 canvas). */
export const WORLD_HEIGHT = 1280;
export const PLAYER_X = 200;
export const PLAYER_RADIUS = 28;

export const GRAVITY = 2600; // px/s²
export const FLAP_VELOCITY = -850; // px/s
export const MAX_FALL_SPEED = 1400; // px/s

export const GATE_WIDTH = 120;
/** Vertical margin the gap center keeps from the top/bottom edges. */
export const GATE_MARGIN = 220;
export const GATE_SPACING_PX = 520;

export interface PlayerState {
  y: number;
  vy: number;
}

export interface Gate {
  /** Left edge, in world pixels. */
  x: number;
  gapCenter: number;
  gapHeight: number;
  scored: boolean;
}

export function stepPlayer(p: PlayerState, dtSec: number): void {
  p.vy = Math.min(p.vy + GRAVITY * dtSec, MAX_FALL_SPEED);
  p.y += p.vy * dtSec;
}

export function flap(p: PlayerState): void {
  p.vy = FLAP_VELOCITY;
}

/** Gap starts generous and tightens with score, bounded so runs stay winnable. */
export function gapHeightForScore(score: number): number {
  return Math.max(250, 360 - 3 * score);
}

/** Scroll speed ramps with score and caps. */
export function speedForScore(score: number): number {
  return Math.min(540, 320 + 4 * score);
}

export function makeGate(rng: Rng, score: number, x: number): Gate {
  const gapHeight = gapHeightForScore(score);
  const min = GATE_MARGIN;
  const max = WORLD_HEIGHT - GATE_MARGIN;
  return {
    x,
    gapCenter: min + rng.next() * (max - min),
    gapHeight,
    scored: false,
  };
}

/** Circle-vs-gate collision at the player's fixed x position. */
export function hitsGate(playerY: number, gate: Gate): boolean {
  const overlapsX =
    PLAYER_X + PLAYER_RADIUS > gate.x && PLAYER_X - PLAYER_RADIUS < gate.x + GATE_WIDTH;
  if (!overlapsX) return false;
  const gapTop = gate.gapCenter - gate.gapHeight / 2;
  const gapBottom = gate.gapCenter + gate.gapHeight / 2;
  return playerY - PLAYER_RADIUS < gapTop || playerY + PLAYER_RADIUS > gapBottom;
}

export function outOfBounds(playerY: number): boolean {
  return playerY - PLAYER_RADIUS < 0 || playerY + PLAYER_RADIUS > WORLD_HEIGHT;
}
