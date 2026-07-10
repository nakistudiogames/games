import { Rng } from "@mg/core";
import {
  BOOST_FOOTPRINT,
  DASH_LENGTH_PX,
  DASH_MUL,
  GROUND_Y,
  KINDS_WITH_PHASE,
  PAD_JUMP_VELOCITY,
  PLAYER_X,
  POWER_UPS,
  SLOWMO_MUL,
  checkDeath,
  collectsPowerUp,
  levelDurationSec,
  levelGapScale,
  levelLengthM,
  levelSeed,
  levelSpeed,
  makePowerUp,
  minGapPx,
  padLaunchSafe,
  pickPattern,
  powerUpGapPx,
  stepRunner,
  supportAt,
  trackBoosts,
  tryJump,
} from "../src/logic/runner";
import type { Obstacle, PowerUp, Runner, TrackBoost } from "../src/logic/runner";

/**
 * Headless replica of GameScene's world evolution (fixed dt = 1/120), built
 * only on src/logic/runner exports — used by the bot playthrough test to
 * prove whole levels are beatable. Mirrors the scene's update() order:
 * scroll → cull → spawn pattern → power-ups → boosts → physics → finish →
 * death. Mirror/flip zones are render-only and irrelevant here.
 */

// GameScene-private constants, mirrored (see games/cube-dash/src/scenes/GameScene.ts).
const WORLD_WIDTH = 720;
const CLEAR_RUNWAY_PX = 1200;
const FIRST_POWERUP_PX = 1500;
const POWERUP_SPAWN_X = WORLD_WIDTH + 60;
const POWERUP_BLOCK_PAD = 160;
const SHIELD_INVULN_MS = 800;

export const SIM_DT = 1 / 120;

export class LevelSim {
  readonly level: number;
  readonly lengthPx: number;
  private readonly baseSpeed: number;

  distancePx = 0;
  runner: Runner = { y: GROUND_Y, vy: 0, grounded: true, airJumpUsed: false, coyoteMs: 0 };
  obstacles: Obstacle[] = [];
  powerUps: PowerUp[] = [];
  boosts: Array<{ b: TrackBoost; used: boolean }>;
  private rng: Rng;
  private nextPowerUpAt = FIRST_POWERUP_PX;
  private dashUntilPx = -1;
  private doubleJumpMs = 0;
  private shieldMs = 0;
  private slowmoMs = 0;
  private invulnMs = 0;
  shieldSaves = 0;
  dead = false;
  finished = false;
  /** Enable the boost-overlap probe (off by default so bot rollouts stay fast). */
  probeBoostOverlap = false;
  /** Worst boost-vs-obstacle footprint overlap seen on screen (test probe). */
  worstBoostOverlap = 0;
  /** Pads that actually fired — guards against firing rules going inert. */
  padLaunches = 0;

  constructor(level: number) {
    this.level = level;
    this.lengthPx = levelLengthM(level) * 10;
    this.baseSpeed = levelSpeed(level);
    this.rng = new Rng(levelSeed(level));
    this.boosts = trackBoosts(level, this.lengthPx).map((b) => ({ b, used: false }));
  }

  clone(): LevelSim {
    const c = Object.create(LevelSim.prototype) as LevelSim;
    Object.assign(c, this, {
      runner: { ...this.runner },
      obstacles: this.obstacles.map((o) => ({ ...o })),
      powerUps: this.powerUps.map((p) => ({ ...p })),
      // Deep-copy b: rollouts nudge b.at, which must NOT leak to the parent.
      boosts: this.boosts.map((x) => ({ b: { ...x.b }, used: x.used })),
      rng: this.rng.clone(),
      probeBoostOverlap: false, // rollouts skip the probe — keep them fast
    });
    return c;
  }

  /** Advances one frame; `jump` = the bot pressing this frame. */
  step(jump: boolean): void {
    if (this.dead || this.finished) return;
    const dt = SIM_DT;
    const deltaMs = dt * 1000;
    const dashing = this.distancePx < this.dashUntilPx;
    const speed = this.baseSpeed * (dashing ? DASH_MUL : 1);
    // Slow-mo scales the whole simulation clock — mirrors GameScene.
    const simDt = dt * (this.slowmoMs > 0 ? SLOWMO_MUL : 1);
    this.distancePx += speed * simDt;

    for (const o of this.obstacles) o.x -= speed * simDt;
    while (this.obstacles.length > 0 && this.obstacles[0]!.x + this.obstacles[0]!.w < -40) {
      this.obstacles.shift();
    }

    this.maybeSpawnPattern();
    this.updatePowerUps(speed, simDt, deltaMs);
    this.updateBoosts(speed);

    if (jump) tryJump(this.runner, this.doubleJumpMs > 0);
    stepRunner(this.runner, simDt, supportAt(this.runner.y, this.obstacles));

    if (this.lengthPx - this.distancePx <= 40) {
      this.finished = true;
      return;
    }
    if (this.invulnMs > 0) {
      this.invulnMs -= deltaMs;
      return;
    }
    if (checkDeath(this.runner.y, this.obstacles)) {
      if (this.shieldMs > 0) {
        this.shieldMs = 0;
        this.invulnMs = SHIELD_INVULN_MS;
        this.shieldSaves++;
      } else {
        this.dead = true;
      }
    }
  }

  /** Spawning uses the BASE speed — layout is a pure function of distance. */
  private maybeSpawnPattern(): void {
    if (this.lengthPx - this.distancePx < CLEAR_RUNWAY_PX) return;
    const gap = minGapPx(this.baseSpeed) * levelGapScale(this.level);
    const last = this.obstacles[this.obstacles.length - 1];
    const lastEnd = last ? last.x + last.w : -Infinity;
    if (lastEnd > WORLD_WIDTH + 40 - gap) return;
    const startX = Math.max(WORLD_WIDTH + 40, lastEnd + gap);
    const pattern = pickPattern(this.rng, this.baseSpeed, this.level);
    for (const spec of pattern.obstacles) {
      this.obstacles.push({
        x: startX + spec.dx,
        w: spec.w,
        h: spec.h,
        elev: spec.elev ?? 0,
        kind: spec.kind,
        phase: KINDS_WITH_PHASE.has(spec.kind) ? this.rng.next() * Math.PI * 2 : 0,
      });
    }
  }

  private updatePowerUps(speed: number, dt: number, deltaMs: number): void {
    for (const p of this.powerUps) p.x -= speed * dt;
    this.powerUps = this.powerUps.filter((p) => {
      if (p.x < -80) return false;
      if (collectsPowerUp(this.runner.y, p)) {
        const spec = POWER_UPS[p.kind];
        if (p.kind === "doubleJump") this.doubleJumpMs = spec.durationMs;
        else if (p.kind === "shield") this.shieldMs = spec.durationMs;
        else this.slowmoMs = spec.durationMs;
        return false;
      }
      return true;
    });
    if (this.distancePx >= this.nextPowerUpAt && this.lengthPx - this.distancePx > CLEAR_RUNWAY_PX) {
      const x = POWERUP_SPAWN_X;
      const blocked = this.obstacles.some(
        (o) => o.x < x + POWERUP_BLOCK_PAD && o.x + o.w > x - POWERUP_BLOCK_PAD,
      );
      if (!blocked) {
        this.powerUps.push(makePowerUp(this.rng, x, this.level));
        this.nextPowerUpAt = this.distancePx + powerUpGapPx(this.rng);
      }
    }
    this.doubleJumpMs = Math.max(0, this.doubleJumpMs - deltaMs);
    this.shieldMs = Math.max(0, this.shieldMs - deltaMs);
    this.slowmoMs = Math.max(0, this.slowmoMs - deltaMs);
  }

  private updateBoosts(speed: number): void {
    for (const bo of this.boosts) {
      // Slide boosts out from under hazards — mirrors GameScene.updateBoosts.
      let x = PLAYER_X + (bo.b.at - this.distancePx);
      if (!bo.used && x > -100 && x < WORLD_WIDTH + 300) {
        const half = BOOST_FOOTPRINT[bo.b.kind] / 2 + 30;
        while (this.obstacles.some((o) => o.x < x + half && o.x + o.w > x - half)) {
          bo.b.at += 40;
          x += 40;
          if (bo.b.at > this.lengthPx - CLEAR_RUNWAY_PX - 400) {
            bo.used = true;
            bo.b.at = this.lengthPx + 100_000;
            break;
          }
        }
      }
      // Probe: after settling, a visible boost must not overlap a hazard's
      // body (a ±30px graze margin is fine, not the body).
      if (this.probeBoostOverlap && !bo.used && x > -BOOST_FOOTPRINT[bo.b.kind] && x < WORLD_WIDTH) {
        const bl = x - BOOST_FOOTPRINT[bo.b.kind] / 2;
        const br = x + BOOST_FOOTPRINT[bo.b.kind] / 2;
        for (const o of this.obstacles) {
          const overlap = Math.min(br, o.x + o.w) - Math.max(bl, o.x);
          if (overlap > this.worstBoostOverlap) this.worstBoostOverlap = overlap;
        }
      }
      if (bo.used || this.distancePx < bo.b.at) continue;
      bo.used = true;
      if (bo.b.kind === "strip") {
        this.dashUntilPx = bo.b.at + DASH_LENGTH_PX;
      } else if (this.runner.grounded && padLaunchSafe(this.obstacles, speed)) {
        this.runner.vy = PAD_JUMP_VELOCITY;
        this.runner.grounded = false;
        this.runner.coyoteMs = 0;
        this.padLaunches++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The bot: lookahead-search player used by bot.test.ts (and debug traces).

const H = 100; // no-jump probe horizon, frames (~0.83s)
const PROBE_MARGIN = 40; // re-probe this many frames before the cache expires
const MAX_DELAY = 90; // latest considered takeoff, frames after detection

export interface BotResult {
  finished: boolean;
  deathM: number;
  nearby: string;
  shieldSaves: number;
  stalled: boolean;
  /** Worst boost-vs-hazard body overlap seen on screen (≤0 = clean gap). */
  worstBoostOverlap: number;
  /** Pads that actually fired during the run. */
  padLaunches: number;
}

/**
 * A hit counts as a death for planning even when a shield would absorb it —
 * otherwise active shields blind the probe and the bot coasts into hits.
 */
function hit(c: LevelSim, shieldSavesBefore: number): boolean {
  return c.dead || c.shieldSaves > shieldSavesBefore;
}

/** Frames until a no-jump clone gets hit; -1 if it survives the horizon. */
function probeDeath(sim: LevelSim, horizon: number): number {
  const c = sim.clone();
  const saves = c.shieldSaves;
  for (let i = 0; i < horizon; i++) {
    c.step(false);
    if (hit(c, saves)) return i;
    if (c.finished) return -1;
  }
  return -1;
}

/**
 * Post-plan breathing room: a plan only counts when its final jump ends in
 * a state that stays hit-free for a full flight plus this tail — enough for
 * execution to land, re-probe, and plan the next threat with full range.
 * (Horizon-capped scoring instead of this rule accepted chains that died
 * one frame past their horizon.)
 */
const SAFE_TAIL = 55;
const SAFE_H = 62 + SAFE_TAIL; // jump airtime + tail

/**
 * Every hazard's takeoff window opens no earlier than ~32 frames before
 * impact, so a state whose next death is at least this far out is always
 * recoverable by the next replan cycle — the search may treat it as good.
 */
const REPLAN_MIN = 35;

/**
 * Finds a chain of jumps whose links each land either SAFE_H-safe, at the
 * finish, or (at the depth floor) with ≥ REPLAN_MIN frames of warning for
 * the next replan — hazard chains can be arbitrarily long (spike, spike,
 * laser, laser…), but execution replans at every landing, so only the near
 * links need precise verification. Returns the first jump's delay, or null
 * when no such chain exists yet (takeoff window still approaching — caller
 * waits). Deeper levels try takeoffs on a 2-frame stride — every real
 * takeoff window is ≥6 frames wide, and success short-circuits the search.
 */
function findSafePlan(sim: LevelSim, jumps: number): { delay: number } | null {
  const deathAt = probeDeath(sim, SAFE_H);
  if (deathAt < 0) return { delay: -1 }; // already safe from here
  if (jumps <= 0) return deathAt >= REPLAN_MIN ? { delay: -1 } : null;
  const stride = jumps >= 3 ? 1 : 2;
  const saves = sim.shieldSaves;
  // Shared no-jump prefix advanced incrementally across candidates.
  const prefix = sim.clone();
  for (let d = 0; d <= Math.min(deathAt - 1, MAX_DELAY); d++) {
    if (d > 0) {
      prefix.step(false);
      if (hit(prefix, saves) || prefix.finished) break;
    }
    if (d % stride !== 0) continue;
    if (!prefix.runner.grounded) continue; // can't take off mid-air
    const c = prefix.clone();
    c.step(true);
    if (hit(c, saves)) continue;
    if (c.finished) return { delay: d };
    if (findSafePlan(c, jumps - 1)) return { delay: d }; // earliest safe chain
  }
  return null;
}

/** Depth-1 max-survival fallback for when death is imminent and no safe
 * chain exists — the least-bad jump buys frames for the next replan. */
function bestEffortDelay(sim: LevelSim, deathAt: number): number {
  const horizon = deathAt + 80;
  let bestFrames = -1;
  let bestDelay = -1;
  const saves = sim.shieldSaves;
  const prefix = sim.clone();
  for (let d = 0; d <= Math.min(deathAt - 1, MAX_DELAY); d++) {
    if (d > 0) {
      prefix.step(false);
      if (hit(prefix, saves) || prefix.finished) break;
    }
    if (!prefix.runner.grounded) continue;
    const c = prefix.clone();
    c.step(true);
    if (hit(c, saves)) continue;
    let survived = d + 1;
    for (let i = d + 1; i <= horizon; i++) {
      c.step(false);
      survived++;
      if (c.finished) return d;
      if (hit(c, saves)) break;
    }
    if (survived > bestFrames) {
      bestFrames = survived;
      bestDelay = d;
    }
  }
  return bestDelay;
}

export function runBot(level: number, trace?: (msg: string) => void): BotResult {
  const sim = new LevelSim(level);
  sim.probeBoostOverlap = true; // watch that pads never sit on a hazard
  const maxFrames = Math.ceil(levelDurationSec(level) * 120 * 1.3);
  let nextProbeAt = 0;
  let plannedJumpIn = -1;
  let wasGrounded = true;

  for (let frame = 0; frame < maxFrames; frame++) {
    let jump = false;
    // Landing after any airtime (own jump or pad launch) invalidates the
    // safety cache — the world may look different from the new footing.
    if (sim.runner.grounded && !wasGrounded) {
      nextProbeAt = frame;
      trace?.(`f${frame} LAND`);
    }
    wasGrounded = sim.runner.grounded;

    if (plannedJumpIn === 0) {
      jump = true;
      plannedJumpIn = -1;
      nextProbeAt = frame; // re-assess after this jump resolves
      trace?.(`f${frame} JUMP (planned)`);
    } else if (plannedJumpIn > 0) {
      plannedJumpIn--;
    } else if (sim.runner.grounded && frame >= nextProbeAt) {
      const deathAt = probeDeath(sim, H);
      if (deathAt < 0) {
        // Safe for the horizon as long as we don't act — cache it.
        nextProbeAt = frame + H - PROBE_MARGIN;
      } else {
        const plan = findSafePlan(sim, 3);
        trace?.(
          `f${frame} probe death@${deathAt} plan=${plan ? plan.delay : "none"} ` +
            `obs=${describeNearby(sim)} y=${Math.round(sim.runner.y)}`,
        );
        // Commit only to safe-tailed plans. When none exists yet (the
        // takeoff window may still be approaching), wait; when death is
        // imminent, take the least-bad jump and let the next replan fight.
        const commitDelay =
          plan && plan.delay >= 0
            ? plan.delay
            : deathAt <= 30
              ? bestEffortDelay(sim, deathAt)
              : -1;
        if (commitDelay === 0) {
          jump = true;
          nextProbeAt = frame;
        } else if (commitDelay > 0) {
          plannedJumpIn = commitDelay - 1; // this frame is the first wait step
        } else {
          nextProbeAt = frame + 4; // wait; the takeoff window is approaching
        }
      }
    }

    const savesBefore = sim.shieldSaves;
    sim.step(jump);
    if (sim.shieldSaves > savesBefore) {
      trace?.(
        `SAVE f${frame} y=${Math.round(sim.runner.y)} vy=${Math.round(sim.runner.vy)} ` +
          `grounded=${sim.runner.grounded} obs=${describeNearby(sim)}`,
      );
    }
    if (sim.finished) {
      return {
        finished: true,
        deathM: -1,
        nearby: "",
        shieldSaves: sim.shieldSaves,
        stalled: false,
        worstBoostOverlap: sim.worstBoostOverlap,
        padLaunches: sim.padLaunches,
      };
    }
    if (sim.dead) {
      trace?.(
        `DEAD f${frame} y=${Math.round(sim.runner.y)} vy=${Math.round(sim.runner.vy)} ` +
          `grounded=${sim.runner.grounded} obs=` +
          sim.obstacles.map((o) => `${o.kind}@${Math.round(o.x)}e${o.elev}`).join(","),
      );
      return {
        finished: false,
        deathM: Math.floor(sim.distancePx / 10),
        nearby: describeNearby(sim),
        shieldSaves: sim.shieldSaves,
        stalled: false,
        worstBoostOverlap: sim.worstBoostOverlap,
        padLaunches: sim.padLaunches,
      };
    }
  }
  return {
    finished: false,
    deathM: Math.floor(sim.distancePx / 10),
    nearby: describeNearby(sim),
    shieldSaves: sim.shieldSaves,
    stalled: true,
    worstBoostOverlap: sim.worstBoostOverlap,
    padLaunches: sim.padLaunches,
  };
}

function describeNearby(sim: LevelSim): string {
  return (
    sim.obstacles
      .filter((o) => o.x + o.w > PLAYER_X - 150 && o.x < PLAYER_X + 450)
      .map((o) => `${o.kind}@${Math.round(o.x)}`)
      .join(", ") || "(no obstacles in view)"
  );
}

