import { Rng } from "@mg/core";

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
  /** Coyote-time budget: ms left to still ground-jump after an edge drop. */
  coyoteMs?: number;
}

/** Edge forgiveness: a jump still fires this long after walking off a ledge. */
export const COYOTE_MS = 90;

/**
 * One new kind unlocks per world (see KIND_UNLOCK_LEVEL):
 * spike/block from world 1, saw (ground buzzsaw, circular hitbox) world 2,
 * pit (lava trench, lethal only at ground level) world 3, swing (spike ball
 * bobbing up/down as it scrolls) world 4, laser (thin tall pylon beam) world 5,
 * geyser (vent whose flame column erupts on a fixed cycle) world 6, tentacle
 * (thin tall stalk swaying sideways) world 7, arc (wide low lightning span —
 * one full-commitment jump) world 8, phantom (crystal phasing solid/ghost)
 * world 9, vine (stalk whose lash height oscillates) world 10, gear (cog
 * patrolling ±x along the ground) world 11, gate (twin energy bars — jump
 * through the window between) world 12, crusher (wide slab bobbing in the
 * swing band) world 13, urchin (static floating spike ball, jump-over only)
 * world 14, talon (buried claw erupting on a cycle) world 15, drone (hovering
 * patroller, always run-under-able) world 16, obelisk (tall monolith, the
 * most precise jump) world 17, flare (wide ground fire ribbon, the longest
 * committed jump) world 18, comet (fireball descending along the track,
 * grounded by the time it reaches the player) world 19, reaper (scythe blade
 * sweeping the track on a cycle) world 20.
 */
export type ObstacleKind =
  | "spike"
  | "block"
  | "saw"
  | "pit"
  | "swing"
  | "laser"
  | "geyser"
  | "tentacle"
  | "arc"
  | "phantom"
  | "vine"
  | "gear"
  | "gate"
  | "crusher"
  | "urchin"
  | "talon"
  | "drone"
  | "obelisk"
  | "flare"
  | "comet"
  | "reaper";

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

// Geysers erupt as a pure function of x (same trick as swing mines), so the
// cycle is part of the level's fixed, memorizable layout. Roughly half-duty:
// run through during the lull, or jump the eruption — the column stays short
// enough that jumping over it always works (see test).
export const GEYSER_FREQ = (2 * Math.PI) / 700;

/** True while the geyser's column is erupting (lethal). */
export function geyserActive(o: Obstacle): boolean {
  return Math.sin(o.x * GEYSER_FREQ + (o.phase ?? 0)) > 0;
}

// Tentacles sway sideways as a pure function of x; the hitbox follows the
// sway. Amplitude is bounded so the worst-case footprint (w + 2*AMP) still
// fits inside one jump's airtime above the tip (see test).
export const TENTACLE_AMP = 24;
export const TENTACLE_FREQ = (2 * Math.PI) / 420;

/** Current sideways offset of a tentacle's stalk from its anchor x. */
export function tentacleSway(o: Obstacle): number {
  return TENTACLE_AMP * Math.sin(o.x * TENTACLE_FREQ + (o.phase ?? 0));
}

// ---------------------------------------------------------------------------
// Worlds 9-20 obstacle motion. All of it follows the swing/geyser doctrine:
// state is a pure function of the obstacle's x (plus its seeded phase), so
// layouts stay deterministic and memorizable, and clearability is provable.

/** On/off cycle shared by phantom, talon and reaper (≈half duty). */
function cycleOn(o: Obstacle, freq: number): boolean {
  return Math.sin(o.x * freq + (o.phase ?? 0)) > 0;
}

export const PHANTOM_FREQ = (2 * Math.PI) / 650;
/** True while the phantom crystal is solid (lethal); ghost form is harmless. */
export function phantomSolid(o: Obstacle): boolean {
  return cycleOn(o, PHANTOM_FREQ);
}

// Vine lash height oscillates 40..140 — always fits under a jump (see test).
export const VINE_MID = 90;
export const VINE_AMP = 50;
export const VINE_FREQ = (2 * Math.PI) / 460;
/** Current lash height of a vine above the ground. */
export function vineHeight(o: Obstacle): number {
  return VINE_MID + VINE_AMP * Math.sin(o.x * VINE_FREQ + (o.phase ?? 0));
}

// Gear patrols ±40px along the ground around its anchor.
export const GEAR_SHIFT_AMP = 40;
export const GEAR_FREQ = (2 * Math.PI) / 520;
/** Current sideways offset of a gear from its anchor x. */
export function gearShift(o: Obstacle): number {
  return GEAR_SHIFT_AMP * Math.sin(o.x * GEAR_FREQ + (o.phase ?? 0));
}

// Gate: bottom bar up to 40, window 40..170 (fits the 60px player mid-jump),
// top bar 170..300. One obstacle spec (h = GATE_TOP) describes both bars.
export const GATE_GAP_LO = 40;
export const GATE_GAP_HI = 170;
export const GATE_TOP = 300;

// Crusher bobs in the swing band [10, 130]: same overlap invariant — low
// enough to jump over, or high enough (≥80) to run under.
export const CRUSHER_FREQ = (2 * Math.PI) / 560;
/** Current bottom-edge height of a crusher slab above the ground. */
export function crusherElev(o: Obstacle): number {
  return SWING_MID + SWING_AMP * Math.sin(o.x * CRUSHER_FREQ + (o.phase ?? 0));
}

/** Urchin floats at a fixed height; its top stays inside single-jump reach. */
export const URCHIN_ELEV = 40;

export const TALON_FREQ = (2 * Math.PI) / 720;
/** True while the buried talon is erupted (lethal at track level). */
export function talonActive(o: Obstacle): boolean {
  return cycleOn(o, TALON_FREQ);
}

// Drone hovers in [80, 130] (always run-under-able) while drifting ±40px.
export const DRONE_ELEV_MID = 105;
export const DRONE_ELEV_AMP = 25;
export const DRONE_ELEV_FREQ = (2 * Math.PI) / 480;
export const DRONE_SHIFT_AMP = 40;
export const DRONE_SHIFT_FREQ = (2 * Math.PI) / 380;
export function droneElev(o: Obstacle): number {
  return DRONE_ELEV_MID + DRONE_ELEV_AMP * Math.sin(o.x * DRONE_ELEV_FREQ + (o.phase ?? 0));
}
export function droneShift(o: Obstacle): number {
  return DRONE_SHIFT_AMP * Math.sin(o.x * DRONE_SHIFT_FREQ + (o.phase ?? 0) * 1.7);
}

// Comet descends along the track and is grounded from COMET_IMPACT_X on —
// well before it reaches the player (PLAYER_X + PLAYER_SIZE = 240).
export const COMET_IMPACT_X = 480;
export const COMET_SLOPE = 0.55;
/** Current bottom-edge height of a comet above the ground. */
export function cometElev(o: Obstacle): number {
  return Math.max(0, COMET_SLOPE * (o.x - COMET_IMPACT_X));
}

export const REAPER_FREQ = (2 * Math.PI) / 600;
/** True while the reaper's blade sweeps the track (lethal). */
export function reaperActive(o: Obstacle): boolean {
  return cycleOn(o, REAPER_FREQ);
}

/** Kinds whose motion/state uses a seeded phase, assigned at spawn. */
export const KINDS_WITH_PHASE: ReadonlySet<ObstacleKind> = new Set([
  "swing", "geyser", "tentacle",
  "phantom", "vine", "gear", "crusher", "talon", "drone", "reaper",
]);

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

/** Every world's 5th level is its finale: denser, faster music, gold gate. */
export function isFinaleLevel(level: number): boolean {
  return level >= 1 && level % LEVELS_PER_WORLD === 0;
}

/**
 * Scales the gap between obstacle patterns: early levels are roomy, later
 * ones tighten toward the floor; finales tighten a further 12%. The shared
 * floor keeps every level clearable (see test).
 */
export function levelGapScale(level: number): number {
  const s = Math.max(0.75, 1.2 - 0.06 * (level - 1));
  return isFinaleLevel(level) ? Math.max(0.75, s * 0.88) : s;
}

/** Accent color per WORLD (5 levels each), cycling — one per world theme. */
export const LEVEL_COLORS: readonly number[] = [
  0x4dd0e1, 0x66bb6a, 0xff7043, 0x90caf9, 0xc0ca33, 0xffca28, 0x7986cb, 0xea80fc,
  0xeceff1, 0x81c784, 0xffab40, 0x40c4ff, 0xb388ff, 0xff8a80, 0xd7ccc8, 0x69f0ae,
  0x7e57c2, 0xffd740, 0xf48fb1, 0x00e5ff,
];

export function levelColor(level: number): number {
  const world = Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD);
  return LEVEL_COLORS[world % LEVEL_COLORS.length]!;
}

/**
 * Level at which each obstacle kind first appears: +1 kind per world.
 *
 * MANDATORY RULE: every world must introduce an obstacle kind no earlier
 * world had — when adding a world to WORLDS, add a kind here that unlocks at
 * that world's first level, plus an intro pattern with that minLevel.
 * Enforced by tests (worlds.test.ts / runner.test.ts).
 */
export const KIND_UNLOCK_LEVEL: Record<ObstacleKind, number> = {
  spike: 1,
  block: 1,
  saw: 1 + LEVELS_PER_WORLD, // world 2
  pit: 1 + LEVELS_PER_WORLD * 2, // world 3
  swing: 1 + LEVELS_PER_WORLD * 3, // world 4
  laser: 1 + LEVELS_PER_WORLD * 4, // world 5
  geyser: 1 + LEVELS_PER_WORLD * 5, // world 6
  tentacle: 1 + LEVELS_PER_WORLD * 6, // world 7
  arc: 1 + LEVELS_PER_WORLD * 7, // world 8
  phantom: 1 + LEVELS_PER_WORLD * 8, // world 9
  vine: 1 + LEVELS_PER_WORLD * 9, // world 10
  gear: 1 + LEVELS_PER_WORLD * 10, // world 11
  gate: 1 + LEVELS_PER_WORLD * 11, // world 12
  crusher: 1 + LEVELS_PER_WORLD * 12, // world 13
  urchin: 1 + LEVELS_PER_WORLD * 13, // world 14
  talon: 1 + LEVELS_PER_WORLD * 14, // world 15
  drone: 1 + LEVELS_PER_WORLD * 15, // world 16
  obelisk: 1 + LEVELS_PER_WORLD * 16, // world 17
  flare: 1 + LEVELS_PER_WORLD * 17, // world 18
  comet: 1 + LEVELS_PER_WORLD * 18, // world 19
  reaper: 1 + LEVELS_PER_WORLD * 19, // world 20
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
  if (r.grounded || (r.coyoteMs ?? 0) > 0) {
    r.vy = JUMP_VELOCITY;
    r.grounded = false;
    r.coyoteMs = 0;
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
    // The surface under the player dropped away (walked off a block) —
    // open the coyote window so a marginally late jump still counts.
    r.grounded = false;
    r.coyoteMs = COYOTE_MS;
  }
  if (r.grounded) return;
  r.coyoteMs = Math.max(0, (r.coyoteMs ?? 0) - dtSec * 1000);
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
 * Geysers kill only while erupting, tentacles kill where the sway puts them,
 * arcs kill anywhere inside their span below the beam. Worlds 9-20 kinds
 * follow the same doctrine: timed kinds (phantom/talon/reaper) kill only in
 * their active state, moving kinds (vine/gear/crusher/drone/comet) kill where
 * their motion function currently puts them, gates kill outside the window,
 * urchins/obelisks/flares are static rects/circles with fairness insets.
 */
function overlapsHazard(bottomY: number, obstacles: readonly Obstacle[], pad: number): boolean {
  // `pad` expands the player box uniformly — pad 0 is the lethal test,
  // a positive pad is the near-miss graze band.
  const pl = PLAYER_X - pad;
  const pr = PLAYER_X + PLAYER_SIZE + pad;
  const pt = bottomY - PLAYER_SIZE - pad;
  const pb = bottomY + pad;
  for (const o of obstacles) {
    if (o.kind === "pit") {
      const inset = 22;
      if (pb >= GROUND_Y - 2 && pr > o.x + inset && pl < o.x + o.w - inset) return true;
      continue;
    }
    if (o.kind === "phantom" || o.kind === "talon" || o.kind === "reaper") {
      // Timed hazards: harmless while phased out / retracted.
      const on =
        o.kind === "phantom" ? phantomSolid(o) : o.kind === "talon" ? talonActive(o) : reaperActive(o);
      if (!on) continue;
      const inset = 6;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > GROUND_Y - o.h + 6) {
        return true;
      }
      continue;
    }
    if (o.kind === "vine") {
      // The lash height oscillates — only the current reach kills.
      const inset = 8;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > GROUND_Y - vineHeight(o) + 6) {
        return true;
      }
      continue;
    }
    if (o.kind === "gate") {
      // Twin energy bars; the 130px window between them is the way through.
      const inset = 6;
      if (pr > o.x + inset && pl < o.x + o.w - inset) {
        if (pb > GROUND_Y - GATE_GAP_LO + 4) return true; // bottom bar
        if (pt < GROUND_Y - GATE_GAP_HI - 4) return true; // top bar
      }
      continue;
    }
    if (o.kind === "gear" || o.kind === "urchin" || o.kind === "drone") {
      // Round hazards; gear and drone hitboxes follow their patrol motion.
      const shift = o.kind === "gear" ? gearShift(o) : o.kind === "drone" ? droneShift(o) : 0;
      const elev = o.kind === "urchin" ? URCHIN_ELEV : o.kind === "drone" ? droneElev(o) : 0;
      const r = o.w / 2 - (o.kind === "gear" ? 8 : 6);
      const cx = o.x + shift + o.w / 2;
      const cy = GROUND_Y - elev - o.h / 2;
      const nx = Math.max(pl, Math.min(cx, pr));
      const ny = Math.max(pt, Math.min(cy, pb));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) return true;
      continue;
    }
    if (o.kind === "crusher" || o.kind === "comet") {
      // Rects whose height above ground is a function of x.
      const elev = o.kind === "crusher" ? crusherElev(o) : cometElev(o);
      const inset = 8;
      const top = GROUND_Y - elev - o.h;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > top + 6 && pt < GROUND_Y - elev - 4) {
        return true;
      }
      continue;
    }
    if (o.kind === "flare") {
      // Ground fire ribbon: arc-style — lethal only near track level.
      const inset = 10;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > GROUND_Y - o.h + 8) {
        return true;
      }
      continue;
    }
    if (o.kind === "geyser") {
      // The vent itself is harmless — only the erupting column kills.
      if (!geyserActive(o)) continue;
      const inset = 6;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > GROUND_Y - o.h + 6) {
        return true;
      }
      continue;
    }
    if (o.kind === "tentacle") {
      // The hitbox follows the sway, not the anchor.
      const sx = o.x + tentacleSway(o);
      const inset = 8;
      if (pr > sx + inset && pl < sx + o.w - inset && pb > GROUND_Y - o.h + 6) {
        return true;
      }
      continue;
    }
    if (o.kind === "arc") {
      const inset = 10;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > GROUND_Y - o.h + 8) {
        return true;
      }
      continue;
    }
    if (o.kind === "saw" || o.kind === "swing") {
      const elev = o.kind === "swing" ? swingElev(o) : o.elev;
      const r = o.w / 2 - (o.kind === "saw" ? 8 : 6);
      const cx = o.x + o.w / 2;
      const cy = GROUND_Y - elev - o.h / 2;
      // Circle vs player rect: distance from center to the nearest rect point.
      const nx = Math.max(pl, Math.min(cx, pr));
      const ny = Math.max(pt, Math.min(cy, pb));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) return true;
      continue;
    }
    const top = GROUND_Y - o.elev - o.h;
    const bottom = GROUND_Y - o.elev;
    if (o.kind === "laser" || o.kind === "obelisk") {
      const inset = 6;
      if (pr > o.x + inset && pl < o.x + o.w - inset && pb > top + 6 && pt < bottom) {
        return true;
      }
    } else if (o.kind === "spike") {
      const inset = 16;
      if (
        pr > o.x + inset &&
        pl < o.x + o.w - inset &&
        pb > top + 12 &&
        pt < bottom - 12
      ) {
        return true;
      }
    } else {
      if (pr > o.x && pl < o.x + o.w && pb > top + 8 && pt < bottom - 4) return true;
    }
  }
  return false;
}

export function checkDeath(bottomY: number, obstacles: readonly Obstacle[]): boolean {
  return overlapsHazard(bottomY, obstacles, 0);
}

/**
 * Graze band width around every hazard for the near-miss reward. Wider than
 * the per-kind fairness insets (up to 16px), so a real band remains after
 * the insets are subtracted.
 */
export const NEAR_MISS_PAD = 24;

/**
 * True when the player is inside a hazard's graze band without actually
 * dying — the "that was close" moment worth celebrating.
 */
export function nearMiss(bottomY: number, obstacles: readonly Obstacle[]): boolean {
  return (
    !overlapsHazard(bottomY, obstacles, 0) &&
    overlapsHazard(bottomY, obstacles, NEAR_MISS_PAD)
  );
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
  {
    // Flame geyser: the vent is harmless, the column erupts on a fixed
    // cycle — run through the lull or jump the eruption.
    id: "geyser1",
    obstacles: [{ dx: 0, w: 60, h: 110, kind: "geyser" }],
    width: 60,
    minSpeed: 0,
    minLevel: 26, // world 6
  },
  {
    // Geyser guarding a trench: clear the eruption, then commit to the jump.
    id: "geyserPit",
    obstacles: [
      { dx: 0, w: 60, h: 110, kind: "geyser" },
      { dx: 390, w: 150, h: 24, kind: "pit" },
    ],
    width: 540,
    minSpeed: 0,
    minLevel: 28,
  },
  {
    // Abyssal tentacle: thin and tall like a pylon, but it sways — jump
    // where it WILL be, not where it is.
    id: "tentacle1",
    obstacles: [{ dx: 0, w: 30, h: 120, kind: "tentacle" }],
    width: 78, // sway footprint: w + 2 * TENTACLE_AMP
    minSpeed: 0,
    minLevel: 31, // world 7
  },
  {
    // Tentacle, then a buzzsaw waiting on the landing.
    id: "tentacleSaw",
    obstacles: [
      { dx: 0, w: 30, h: 120, kind: "tentacle" },
      { dx: 450, w: 90, h: 90, kind: "saw" },
    ],
    width: 540,
    minSpeed: 0,
    minLevel: 33,
  },
  {
    // Tesla arc: a wide, low lightning span with nothing to land on inside
    // it — one full-commitment jump clears the whole thing.
    id: "arc1",
    obstacles: [{ dx: 0, w: 200, h: 50, kind: "arc" }],
    width: 200,
    minSpeed: 0,
    minLevel: 36, // world 8
  },
  {
    // Arc into a bobbing mine: land the long jump, then read the bob.
    id: "arcMine",
    obstacles: [
      { dx: 0, w: 200, h: 50, kind: "arc" },
      { dx: 500, w: 54, h: 54, kind: "swing" },
    ],
    width: 554,
    minSpeed: 0,
    minLevel: 38,
  },
  // --- worlds 9-20: one new kind per world, intro + combo each ---
  {
    // Phasing crystal: jump it while solid, or stroll through the ghost.
    id: "phantom1",
    obstacles: [{ dx: 0, w: 60, h: 110, kind: "phantom" }],
    width: 60,
    minSpeed: 0,
    minLevel: 41, // world 9
  },
  {
    id: "phantomPair",
    obstacles: [
      { dx: 0, w: 60, h: 110, kind: "phantom" },
      { dx: 440, w: 60, h: 110, kind: "phantom" },
    ],
    width: 500,
    minSpeed: 0,
    minLevel: 43,
  },
  {
    // Lashing vine: h is the MAX lash height; the live height oscillates.
    id: "vine1",
    obstacles: [{ dx: 0, w: 54, h: 140, kind: "vine" }],
    width: 54,
    minSpeed: 0,
    minLevel: 46, // world 10
  },
  {
    id: "vineSaw",
    obstacles: [
      { dx: 0, w: 54, h: 140, kind: "vine" },
      { dx: 430, w: 90, h: 90, kind: "saw" },
    ],
    width: 520,
    minSpeed: 0,
    minLevel: 48,
  },
  {
    // Patrolling cog: the hitbox wanders ±40px around the anchor.
    id: "gear1",
    obstacles: [{ dx: 0, w: 70, h: 70, kind: "gear" }],
    width: 150, // patrol footprint: w + 2 * GEAR_SHIFT_AMP
    minSpeed: 0,
    minLevel: 51, // world 11
  },
  {
    id: "gearPit",
    obstacles: [
      { dx: 0, w: 70, h: 70, kind: "gear" },
      { dx: 470, w: 150, h: 24, kind: "pit" },
    ],
    width: 620,
    minSpeed: 0,
    minLevel: 53,
  },
  {
    // Energy gate: thread the jump through the window between the bars.
    id: "gate1",
    obstacles: [{ dx: 0, w: 24, h: 300, kind: "gate" }],
    width: 24,
    minSpeed: 0,
    minLevel: 56, // world 12
  },
  {
    id: "gateSpike",
    obstacles: [
      { dx: 0, w: 24, h: 300, kind: "gate" },
      { dx: 420, w: 60, h: 60, kind: "spike" },
    ],
    width: 480,
    minSpeed: 0,
    minLevel: 58,
  },
  {
    // Bobbing slab: swing-band rules — over when low, under when high.
    id: "crusher1",
    obstacles: [{ dx: 0, w: 90, h: 60, kind: "crusher" }],
    width: 90,
    minSpeed: 0,
    minLevel: 61, // world 13
  },
  {
    id: "crusherPit",
    obstacles: [
      { dx: 0, w: 90, h: 60, kind: "crusher" },
      { dx: 450, w: 150, h: 24, kind: "pit" },
    ],
    width: 600,
    minSpeed: 0,
    minLevel: 63,
  },
  {
    // Floating spike ball at fixed height: a clean jump-over, no run-under.
    id: "urchin1",
    obstacles: [{ dx: 0, w: 80, h: 80, kind: "urchin" }],
    width: 80,
    minSpeed: 0,
    minLevel: 66, // world 14
  },
  {
    id: "urchinPair",
    obstacles: [
      { dx: 0, w: 80, h: 80, kind: "urchin" },
      { dx: 460, w: 80, h: 80, kind: "urchin" },
    ],
    width: 540,
    minSpeed: 0,
    minLevel: 68,
  },
  {
    // Buried claw: erupts on a cycle — cross during the lull or jump it.
    id: "talon1",
    obstacles: [{ dx: 0, w: 66, h: 120, kind: "talon" }],
    width: 66,
    minSpeed: 0,
    minLevel: 71, // world 15
  },
  {
    id: "talonSaw",
    obstacles: [
      { dx: 0, w: 66, h: 120, kind: "talon" },
      { dx: 450, w: 90, h: 90, kind: "saw" },
    ],
    width: 540,
    minSpeed: 0,
    minLevel: 73,
  },
  {
    // Hover-drone: drifts but never dips below 80 — always run-under-able.
    id: "drone1",
    obstacles: [{ dx: 0, w: 60, h: 60, kind: "drone" }],
    width: 140, // patrol footprint: w + 2 * DRONE_SHIFT_AMP
    minSpeed: 0,
    minLevel: 76, // world 16
  },
  {
    id: "droneSpike",
    obstacles: [
      { dx: 0, w: 60, h: 60, kind: "drone" },
      { dx: 260, w: 60, h: 60, kind: "spike" },
    ],
    width: 320,
    minSpeed: 0,
    minLevel: 78,
  },
  {
    // Monolith: the tallest solid — the most precise single jump.
    id: "obelisk1",
    obstacles: [{ dx: 0, w: 30, h: 150, kind: "obelisk" }],
    width: 30,
    minSpeed: 0,
    minLevel: 81, // world 17
  },
  {
    id: "obeliskRow",
    obstacles: [
      { dx: 0, w: 30, h: 150, kind: "obelisk" },
      { dx: 440, w: 30, h: 150, kind: "obelisk" },
    ],
    width: 470,
    minSpeed: 0,
    minLevel: 83,
  },
  {
    // Fire ribbon: wider than an arc — the longest committed jump.
    id: "flare1",
    obstacles: [{ dx: 0, w: 210, h: 24, kind: "flare" }],
    width: 210,
    minSpeed: 0,
    minLevel: 86, // world 18
  },
  {
    id: "flareUrchin",
    obstacles: [
      { dx: 0, w: 210, h: 24, kind: "flare" },
      { dx: 560, w: 80, h: 80, kind: "urchin" },
    ],
    width: 640,
    minSpeed: 0,
    minLevel: 88,
  },
  {
    // Comet: streaks down from the sky, grounded well before the player.
    id: "comet1",
    obstacles: [{ dx: 0, w: 54, h: 60, kind: "comet" }],
    width: 54,
    minSpeed: 0,
    minLevel: 91, // world 19
  },
  {
    id: "cometPair",
    obstacles: [
      { dx: 0, w: 54, h: 60, kind: "comet" },
      { dx: 430, w: 54, h: 60, kind: "comet" },
    ],
    width: 484,
    minSpeed: 0,
    minLevel: 93,
  },
  {
    // Sweeping scythe: present/absent at track level on a cycle.
    id: "reaper1",
    obstacles: [{ dx: 0, w: 60, h: 90, kind: "reaper" }],
    width: 60,
    minSpeed: 0,
    minLevel: 96, // world 20
  },
  {
    id: "reaperGate",
    obstacles: [
      { dx: 0, w: 60, h: 90, kind: "reaper" },
      { dx: 470, w: 24, h: 300, kind: "gate" },
    ],
    width: 494,
    minSpeed: 0,
    minLevel: 98,
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
// Track zones: seeded stretches where the RENDERING flips — "mirror" (world
// 9+) mirrors the view horizontally so the cube appears to run right-to-left;
// "flip" (world 13+) mirrors it vertically so the cube runs a ceiling track.
// Purely visual: physics, layouts and progress are untouched, so every
// clearability guarantee holds inside a zone.

export type TrackZoneKind = "mirror" | "flip";

export interface TrackZone {
  /** Distance along the level, in px. */
  start: number;
  end: number;
  kind: TrackZoneKind;
}

export const MIRROR_MIN_LEVEL = 1 + LEVELS_PER_WORLD * 8; // world 9 (level 41)
export const FLIP_MIN_LEVEL = 1 + LEVELS_PER_WORLD * 12; // world 13 (level 61)

const ZONE_MIN_PX = 1500;
const ZONE_MAX_PX = 6000;
const ZONE_FIRST_PX = 1200;
/** Zones end at least this far before the finish (clear of the runway). */
const ZONE_END_CLEAR_PX = 1600;
const ZONE_GAP_PX = 800;

/**
 * Zones for a level: 1-2 mirror (level ≥ 41) and 1-2 flip (level ≥ 61),
 * each 12-20% of the level clamped to [1500, 6000]px, non-overlapping,
 * ≥800px apart, sorted, never inside the finish runway. Seeded separately
 * from the layout rng so existing levels' layouts are unchanged.
 */
export function trackZones(level: number, lengthPx: number): TrackZone[] {
  const rng = new Rng((levelSeed(level) ^ 0x51af) >>> 0);
  const wanted: TrackZoneKind[] = [];
  if (level >= MIRROR_MIN_LEVEL) {
    wanted.push("mirror");
    if (rng.next() < 0.4) wanted.push("mirror");
  }
  if (level >= FLIP_MIN_LEVEL) {
    wanted.push("flip");
    if (rng.next() < 0.4) wanted.push("flip");
  }
  // Seeded shuffle so mirror/flip interleave differently per level.
  for (let i = wanted.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [wanted[i], wanted[j]] = [wanted[j]!, wanted[i]!];
  }
  const zones: TrackZone[] = [];
  let cursor = ZONE_FIRST_PX;
  for (const kind of wanted) {
    const len = Math.min(ZONE_MAX_PX, Math.max(ZONE_MIN_PX, lengthPx * (0.12 + rng.next() * 0.08)));
    const start = cursor + rng.next() * 900;
    if (start + len > lengthPx - ZONE_END_CLEAR_PX) break;
    zones.push({ start, end: start + len, kind });
    cursor = start + len + ZONE_GAP_PX;
  }
  return zones;
}

/** The zone kind covering this distance, or null on the normal track. */
export function zoneKindAt(distancePx: number, zones: readonly TrackZone[]): TrackZoneKind | null {
  for (const z of zones) {
    if (distancePx >= z.start && distancePx < z.end) return z.kind;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Track boosts: launch pads (auto high jump on contact) and dash strips
// (temporary speed-up). Helpers, never hazards: a pad adds air clearance and
// a strip lengthens the jump distance, so px-gap clearability only improves.

export type BoostKind = "pad" | "strip";

export interface TrackBoost {
  /** Distance along the level, in px. */
  at: number;
  kind: BoostKind;
}

/** Pad jumps launch 25% harder: apex ≈ 312px vs the normal ≈ 200px. */
export const PAD_JUMP_VELOCITY = JUMP_VELOCITY * 1.25;
export const DASH_MUL = 1.2;
export const DASH_LENGTH_PX = 1600;
export const PAD_MIN_LEVEL = 6;
export const STRIP_MIN_LEVEL = 9;

/**
 * Seeded boost placements: 2-4 per level from PAD_MIN_LEVEL (strips join at
 * STRIP_MIN_LEVEL), one per even segment of the track so they're ≥900px
 * apart, all clear of the start and the finish runway. Separate rng stream —
 * layouts unchanged.
 */
export function trackBoosts(level: number, lengthPx: number): TrackBoost[] {
  if (level < PAD_MIN_LEVEL) return [];
  const rng = new Rng((levelSeed(level) ^ 0xb005) >>> 0);
  const count = 2 + Math.floor(rng.next() * 3);
  const start = 1200;
  const end = lengthPx - 1600;
  const seg = (end - start) / count;
  const boosts: TrackBoost[] = [];
  for (let i = 0; i < count; i++) {
    const kind: BoostKind = level >= STRIP_MIN_LEVEL && rng.next() < 0.5 ? "strip" : "pad";
    const margin = kind === "strip" ? DASH_LENGTH_PX : 200;
    const lo = start + i * seg;
    const hi = Math.min(start + (i + 1) * seg - 900, end - margin);
    if (hi <= lo) continue;
    boosts.push({ at: lo + rng.next() * (hi - lo), kind });
  }
  return boosts;
}

// ---------------------------------------------------------------------------
// Power-ups: temporary timed abilities collected as floating pickups.

export type PowerUpKind = "doubleJump" | "shield" | "slowmo";

export interface PowerUpSpec {
  durationMs: number;
  label: string;
  color: number;
  /** HUD/pickup glyph. */
  glyph: string;
}

export const POWER_UPS: Record<PowerUpKind, PowerUpSpec> = {
  doubleJump: { durationMs: 10_000, label: "DOUBLE JUMP", color: 0xffd54f, glyph: "⇈" },
  shield: { durationMs: 15_000, label: "SHIELD", color: 0x4dd0e1, glyph: "⛨" },
  slowmo: { durationMs: 6_000, label: "SLOW-MO", color: 0xb388ff, glyph: "⏳" },
};

/** Level at which each power-up kind joins the pickup pool. */
export const POWERUP_UNLOCK_LEVEL: Record<PowerUpKind, number> = {
  doubleJump: 1,
  shield: 6,
  slowmo: 16,
};

/** World-speed multiplier while Slow-Mo is active — only ever easier. */
export const SLOWMO_MUL = 0.85;

export const POWERUP_SIZE = 56;

export interface PowerUp {
  /** Center of the pickup, in world pixels. */
  x: number;
  y: number;
  kind: PowerUpKind;
}

/** Pickups float within single-jump reach (apex ≈ 200px above ground). */
export function makePowerUp(rng: Rng, x: number, level = 1): PowerUp {
  const kinds = (Object.keys(POWERUP_UNLOCK_LEVEL) as PowerUpKind[]).filter(
    (k) => POWERUP_UNLOCK_LEVEL[k] <= level,
  );
  return {
    x,
    y: GROUND_Y - 90 - rng.next() * 90,
    kind: rng.pick(kinds),
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
