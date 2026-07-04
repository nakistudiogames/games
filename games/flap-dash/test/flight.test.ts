import { describe, expect, it } from "vitest";
import {
  FLAP_VELOCITY,
  GATE_MARGIN,
  GATE_WIDTH,
  MAX_FALL_SPEED,
  PLAYER_RADIUS,
  PLAYER_X,
  WORLD_HEIGHT,
  flap,
  gapHeightForScore,
  hitsGate,
  makeGate,
  outOfBounds,
  speedForScore,
  stepPlayer,
} from "../src/logic/flight";
import type { Gate, PlayerState } from "../src/logic/flight";
import { Rng } from "@mg/core";

const gate = (x: number, gapCenter: number, gapHeight = 300): Gate => ({
  x,
  gapCenter,
  gapHeight,
  scored: false,
});

describe("player physics", () => {
  it("gravity accelerates the fall and moves the player", () => {
    const p: PlayerState = { y: 600, vy: 0 };
    stepPlayer(p, 0.1);
    expect(p.vy).toBeCloseTo(260);
    expect(p.y).toBeGreaterThan(600);
  });

  it("fall speed is clamped at terminal velocity", () => {
    const p: PlayerState = { y: 600, vy: MAX_FALL_SPEED };
    stepPlayer(p, 1);
    expect(p.vy).toBe(MAX_FALL_SPEED);
  });

  it("flap sets an upward velocity", () => {
    const p: PlayerState = { y: 600, vy: 500 };
    flap(p);
    expect(p.vy).toBe(FLAP_VELOCITY);
    stepPlayer(p, 0.016);
    expect(p.y).toBeLessThan(600);
  });
});

describe("difficulty ramp", () => {
  it("gap shrinks with score down to a floor", () => {
    expect(gapHeightForScore(0)).toBe(360);
    expect(gapHeightForScore(20)).toBe(300);
    expect(gapHeightForScore(500)).toBe(250);
  });

  it("speed ramps with score up to a cap", () => {
    expect(speedForScore(0)).toBe(320);
    expect(speedForScore(10)).toBe(360);
    expect(speedForScore(500)).toBe(540);
  });
});

describe("gate generation", () => {
  it("keeps the gap center within margins and is deterministic per seed", () => {
    for (let score = 0; score < 50; score += 10) {
      const g = makeGate(new Rng(score + 1), score, 800);
      expect(g.gapCenter).toBeGreaterThanOrEqual(GATE_MARGIN);
      expect(g.gapCenter).toBeLessThanOrEqual(WORLD_HEIGHT - GATE_MARGIN);
      expect(g.gapHeight).toBe(gapHeightForScore(score));
    }
    expect(makeGate(new Rng(9), 0, 800)).toEqual(makeGate(new Rng(9), 0, 800));
  });
});

describe("collisions", () => {
  it("is safe when the gate is not at the player's x", () => {
    expect(hitsGate(100, gate(PLAYER_X + 400, 600))).toBe(false);
    expect(hitsGate(100, gate(PLAYER_X - 400, 600))).toBe(false);
  });

  it("is safe inside the gap and fatal at its edges", () => {
    const g = gate(PLAYER_X - GATE_WIDTH / 2, 600, 300);
    expect(hitsGate(600, g)).toBe(false); // centered in gap
    expect(hitsGate(450 + PLAYER_RADIUS - 1, g)).toBe(true); // clipping gap top
    expect(hitsGate(750 - PLAYER_RADIUS + 1, g)).toBe(true); // clipping gap bottom
    expect(hitsGate(600, gate(PLAYER_X - GATE_WIDTH / 2, 200))).toBe(true); // gap far above
  });

  it("detects the world bounds", () => {
    expect(outOfBounds(PLAYER_RADIUS - 1)).toBe(true);
    expect(outOfBounds(WORLD_HEIGHT - PLAYER_RADIUS + 1)).toBe(true);
    expect(outOfBounds(WORLD_HEIGHT / 2)).toBe(false);
  });
});
