import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import {
  GROUND_Y,
  PLAYER_SIZE,
  PLAYER_X,
  POWER_UPS,
  checkDeath,
  collectsPowerUp,
  jump,
  levelColor,
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
} from "../logic/runner";
import type { Obstacle, PowerUp, Runner } from "../logic/runner";
import { adsReady } from "../ads";
import { music } from "../music";
import { storage } from "./MenuScene";

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 1280;
const PLAYER_COLOR = 0x26c6da;
const REVIVE_INVULN_MS = 1200;
const REVIVE_CLEAR_PX = 900;
const MAX_DT_MS = 50;
/** Tap slightly before landing still triggers a jump on touchdown. */
const JUMP_BUFFER_MS = 110;
/** Distance until the first pickup — early, so players learn the mechanic. */
const FIRST_POWERUP_PX = 1500;
/** No obstacles/pickups spawn once the finish is closer than this. */
const CLEAR_RUNWAY_PX = 1200;

interface ObstacleView {
  obs: Obstacle;
  view: Phaser.GameObjects.Container;
}

interface PowerUpView {
  p: PowerUp;
  view: Phaser.GameObjects.Container;
}

type Phase = "ready" | "playing" | "dead" | "complete";

export class GameScene extends Phaser.Scene {
  private levelNum = 1;
  private levelLengthPx = 0;
  private runner!: Runner;
  private playerView!: Phaser.GameObjects.Container;
  private playerShadow!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Rectangle;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private obstacles: ObstacleView[] = [];
  private powerUps: PowerUpView[] = [];
  private finishView: Phaser.GameObjects.Container | null = null;
  private rng!: Rng;
  private phase: Phase = "ready";
  private distancePx = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private powerBadge!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private readyText: Phaser.GameObjects.Text | null = null;
  private muteButton!: Phaser.GameObjects.Text;
  private usedContinue = false;
  private invulnMs = 0;
  private jumpBufferMs = 0;
  private doubleJumpMs = 0;
  private nextPowerUpAt = FIRST_POWERUP_PX;

  constructor() {
    super("game");
  }

  init(data: { level?: number }): void {
    this.levelNum = Math.max(1, data.level ?? 1);
  }

  create(): void {
    this.levelLengthPx = levelLengthM(this.levelNum) * 10;
    this.runner = { y: GROUND_Y, vy: 0, grounded: true, airJumpUsed: false };
    this.obstacles = [];
    this.powerUps = [];
    this.finishView = null;
    // Seeded per level: every attempt at a level has the identical layout.
    this.rng = new Rng(levelSeed(this.levelNum));
    this.phase = "ready";
    this.distancePx = 0;
    this.usedContinue = false;
    this.invulnMs = 0;
    this.jumpBufferMs = 0;
    this.doubleJumpMs = 0;
    this.nextPowerUpAt = FIRST_POWERUP_PX;

    this.ensureTextures();
    this.buildBackground();
    this.buildPlayer();
    this.buildHud();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.muteButton.getBounds().contains(p.x, p.y)) return;
      this.onTap();
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.onTap());
    this.input.keyboard?.on("keydown-UP", () => this.onTap());
  }

  private remainingPx(): number {
    return this.levelLengthPx - this.distancePx;
  }

  private progressPct(): number {
    return Math.min(100, Math.floor((this.distancePx / this.levelLengthPx) * 100));
  }

  private levelColorHex(level: number): string {
    return `#${levelColor(level).toString(16).padStart(6, "0")}`;
  }

  /** All art is generated at runtime — no image assets to load or license. */
  private ensureTextures(): void {
    if (!this.textures.exists("dot")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 8, 8);
      g.generateTexture("dot", 8, 8);
      g.destroy();
    }
    if (!this.textures.exists("stars")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const pts: Array<[number, number, number, number]> = [
        [14, 30, 2, 0.9], [70, 12, 3, 0.5], [120, 55, 2, 0.7], [40, 90, 2, 0.4],
        [95, 120, 3, 0.8], [150, 100, 2, 0.5], [25, 140, 2, 0.6], [130, 20, 2, 0.35],
      ];
      for (const [x, y, s, a] of pts) {
        g.fillStyle(0xffffff, a);
        g.fillRect(x, y, s, s);
      }
      g.generateTexture("stars", 160, 160);
      g.destroy();
    }
    if (!this.textures.exists("skyline")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const buildings: Array<[number, number, number]> = [
        [0, 70, 190], [80, 60, 260], [150, 90, 140], [250, 70, 300], [330, 55, 210],
      ];
      for (const [x, w, h] of buildings) {
        g.fillStyle(0x181f38, 1);
        g.fillRect(x, 320 - h, w, h);
        g.fillStyle(0x232c4e, 1);
        g.fillRect(x, 320 - h, w, 6);
      }
      g.generateTexture("skyline", 400, 320);
      g.destroy();
    }
    if (!this.textures.exists("shadowtex")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // Layered ellipses approximate a soft radial shadow.
      g.fillStyle(0x000000, 0.1);
      g.fillEllipse(48, 14, 96, 28);
      g.fillStyle(0x000000, 0.14);
      g.fillEllipse(48, 14, 74, 21);
      g.fillStyle(0x000000, 0.2);
      g.fillEllipse(48, 14, 50, 14);
      g.generateTexture("shadowtex", 96, 28);
      g.destroy();
    }
    if (!this.textures.exists("groundgrid")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x10142a, 1);
      g.fillRect(0, 0, 80, 280);
      g.fillStyle(0x1c2547, 1);
      g.fillRect(0, 0, 2, 280); // vertical grid line
      g.fillRect(0, 56, 80, 1); // faint horizontals
      g.fillRect(0, 140, 80, 1);
      g.generateTexture("groundgrid", 80, 280);
      g.destroy();
    }
  }

  private buildBackground(): void {
    const accent = levelColor(this.levelNum);

    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x0b0e24, 0x0b0e24, 0x2a1650, 0x1a1240, 1);
    sky.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);

    this.bgFar = this.add
      .tileSprite(0, 0, WORLD_WIDTH, GROUND_Y, "stars")
      .setOrigin(0)
      .setDepth(1)
      .setAlpha(0.7);
    this.bgMid = this.add
      .tileSprite(0, GROUND_Y - 320, WORLD_WIDTH, 320, "skyline")
      .setOrigin(0)
      .setDepth(2)
      .setAlpha(0.55); // atmospheric haze pushes the skyline into the distance
    const haze = this.add.graphics().setDepth(3);
    haze.fillGradientStyle(0x2a1650, 0x2a1650, 0x2a1650, 0x2a1650, 0, 0, 0.35, 0.35);
    haze.fillRect(0, GROUND_Y - 320, WORLD_WIDTH, 320);

    this.groundTile = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y, "groundgrid")
      .setOrigin(0)
      .setDepth(4);
    // Ground falls away into darkness — reads as depth below the track.
    const groundFade = this.add.graphics().setDepth(4);
    groundFade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.65, 0.65);
    groundFade.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

    // Neon edge on the ground plus a soft glow above it, in the level color.
    this.add.rectangle(0, GROUND_Y - 10, WORLD_WIDTH, 10, accent, 0.12).setOrigin(0).setDepth(5);
    this.add.rectangle(0, GROUND_Y - 3, WORLD_WIDTH, 5, accent).setOrigin(0).setDepth(5);
  }

  private buildPlayer(): void {
    const s = PLAYER_SIZE;
    this.aura = this.add.rectangle(0, 0, s + 18, s + 18, 0xffd54f, 0.28).setVisible(false);
    const body = this.add.rectangle(0, 0, s, s, PLAYER_COLOR).setStrokeStyle(5, 0x0a2a30);
    // Bevel: lit top/left edges, shaded bottom/right — light from the top-left.
    const litTop = this.add.rectangle(0, -s / 2 + 7, s - 12, 5, 0x9ef3fc);
    const litLeft = this.add.rectangle(-s / 2 + 7, 0, 5, s - 12, 0x9ef3fc);
    const shadeBottom = this.add.rectangle(0, s / 2 - 7, s - 12, 5, 0x0d7d8f);
    const shadeRight = this.add.rectangle(s / 2 - 7, 0, 5, s - 12, 0x0d7d8f);
    const face = this.add.rectangle(0, 0, s - 26, s - 26, 0x63e5f5);
    const eyeL = this.add.rectangle(-9, -6, 9, 14, 0x0a2a30);
    const eyeR = this.add.rectangle(11, -6, 9, 14, 0x0a2a30);
    const mouth = this.add.rectangle(1, 12, 22, 6, 0x0a2a30);
    this.playerView = this.add
      .container(PLAYER_X + s / 2, GROUND_Y - s / 2, [
        this.aura, body, litTop, litLeft, shadeBottom, shadeRight, face, eyeL, eyeR, mouth,
      ])
      .setDepth(10);

    this.playerShadow = this.add
      .image(PLAYER_X + s / 2, GROUND_Y + 9, "shadowtex")
      .setDepth(6);

    this.trail = this.add.particles(0, 0, "dot", {
      follow: this.playerView,
      speedX: { min: -40, max: -10 },
      speedY: { min: -20, max: 20 },
      lifespan: 350,
      frequency: 28,
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.45, end: 0 },
      tint: [0x26c6da, 0x4dd0e1, 0xffffff],
      emitting: false,
    });
    this.trail.setDepth(9);

    this.dust = this.add.particles(0, 0, "dot", {
      speed: { min: 40, max: 140 },
      angle: { min: 200, max: 340 },
      lifespan: 300,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x9e9e9e,
      emitting: false,
    });
    this.dust.setDepth(9);

    this.sparkle = this.add.particles(0, 0, "dot", {
      speed: { min: 80, max: 260 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd54f, 0xfff59d, 0xffffff],
      emitting: false,
    });
    this.sparkle.setDepth(12);

    this.burst = this.add.particles(0, 0, "dot", {
      speed: { min: 120, max: 420 },
      lifespan: 600,
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 900,
      tint: [0x26c6da, 0xffffff, 0xef5350],
      emitting: false,
    });
    this.burst.setDepth(12);
  }

  private buildHud(): void {
    const hex = this.levelColorHex(this.levelNum);

    this.scoreText = this.add
      .text(WORLD_WIDTH / 2, 110, "0%", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.scoreText.setShadow(0, 6, "#000000", 8, false, true);

    this.levelText = this.add
      .text(WORLD_WIDTH / 2, 172, `LEVEL ${this.levelNum}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        color: hex,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.levelText.setShadow(0, 4, "#000000", 6, false, true);

    // Progress bar across the top, GD-style.
    this.add.rectangle(160, 36, 400, 10, 0x232b3e).setOrigin(0, 0.5).setDepth(20);
    this.progressFill = this.add
      .rectangle(160, 36, 400, 10, levelColor(this.levelNum))
      .setOrigin(0, 0.5)
      .setScale(0, 1)
      .setDepth(21);

    this.powerBadge = this.add
      .text(40, 70, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "38px",
        color: "#ffd54f",
      })
      .setOrigin(0, 0.5)
      .setDepth(20);
    this.powerBadge.setShadow(0, 5, "#000000", 6, false, true);

    const muted = storage.get("musicMuted", false);
    this.muteButton = this.add
      .text(660, 70, muted ? "🔇" : "🔊", { fontSize: "48px" })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.muteButton.on("pointerdown", () => {
      const nowMuted = !storage.get("musicMuted", false);
      storage.set("musicMuted", nowMuted);
      this.muteButton.setText(nowMuted ? "🔇" : "🔊");
      if (nowMuted) music.stop();
      else if (this.phase === "playing") music.start();
    });

    this.readyText = this.add
      .text(WORLD_WIDTH / 2, 700, `LEVEL ${this.levelNum}\nTAP TO START`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "52px",
        color: "#a5d6a7",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: this.readyText,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  private onTap(): void {
    if (this.phase === "ready") {
      this.phase = "playing";
      this.readyText?.destroy();
      this.readyText = null;
      this.trail.emitting = true;
      if (!storage.get("musicMuted", false)) music.start();
      return;
    }
    if (this.phase !== "playing") return;
    const kind = tryJump(this.runner, this.doubleJumpMs > 0);
    if (kind === "ground") {
      sfx.place();
    } else if (kind === "air") {
      sfx.clear(1);
      this.sparkle.explode(10, this.playerView.x, this.playerView.y + PLAYER_SIZE / 2);
    } else {
      this.jumpBufferMs = JUMP_BUFFER_MS;
    }
  }

  override update(time: number, deltaMs: number): void {
    if (this.phase !== "playing") return;
    const dt = Math.min(deltaMs, MAX_DT_MS) / 1000;
    const speed = levelSpeed(this.levelNum);
    this.distancePx += speed * dt;

    // Parallax: far stars drift, skyline rolls, ground grid matches the track.
    this.bgFar.tilePositionX += speed * dt * 0.12;
    this.bgMid.tilePositionX += speed * dt * 0.4;
    this.groundTile.tilePositionX += speed * dt;

    for (const { obs, view } of this.obstacles) {
      obs.x -= speed * dt;
      view.x = obs.x;
    }
    while (this.obstacles.length > 0 && this.obstacles[0]!.obs.x + this.obstacles[0]!.obs.w < -40) {
      this.obstacles.shift()!.view.destroy();
    }
    this.maybeSpawnPattern(speed);
    this.updatePowerUps(speed, dt, deltaMs);
    this.updateFinish();

    const obsList = this.obstacles.map((o) => o.obs);
    const wasAirborne = !this.runner.grounded;
    stepRunner(this.runner, dt, supportAt(this.runner.y, obsList));
    if (this.runner.grounded && wasAirborne) {
      this.playerView.rotation = Math.round(this.playerView.rotation / (Math.PI / 2)) * (Math.PI / 2);
      this.dust.explode(6, this.playerView.x, this.runner.y - 4);
      if (this.jumpBufferMs > 0) {
        jump(this.runner);
        sfx.place();
      }
    }
    this.jumpBufferMs = Math.max(0, this.jumpBufferMs - deltaMs);
    if (!this.runner.grounded) this.playerView.rotation += 6 * dt;
    this.playerView.y = this.runner.y - PLAYER_SIZE / 2;

    // Ground shadow shrinks and fades as the cube gains height.
    const airHeight = GROUND_Y - this.runner.y;
    const shadowF = Math.max(0.25, 1 - airHeight / 500);
    this.playerShadow.setScale(1.25 * shadowF, shadowF).setAlpha(0.35 + 0.45 * shadowF);

    this.scoreText.setText(`${this.progressPct()}%`);
    this.progressFill.setScale(Math.min(1, this.distancePx / this.levelLengthPx), 1);

    if (this.remainingPx() <= 40) {
      this.completeLevel();
      return;
    }

    if (this.invulnMs > 0) {
      this.invulnMs -= deltaMs;
      this.playerView.setAlpha(Math.sin(time / 50) > 0 ? 0.4 : 1);
      if (this.invulnMs <= 0) this.playerView.setAlpha(1);
      return;
    }
    if (checkDeath(this.runner.y, obsList)) this.die();
  }

  /** The finish line scrolls in with the track once it's within reach. */
  private updateFinish(): void {
    const remaining = this.remainingPx();
    if (!this.finishView && remaining < WORLD_WIDTH + 400) {
      this.finishView = this.buildFinishView();
    }
    if (this.finishView) {
      this.finishView.x = PLAYER_X + remaining;
    }
  }

  private buildFinishView(): Phaser.GameObjects.Container {
    const container = this.add.container(WORLD_WIDTH + 200, 0).setDepth(8);
    const accent = levelColor(this.levelNum);
    // Glowing pole from ground to sky with a checkered flag block.
    container.add(this.add.rectangle(0, GROUND_Y - 420, 26, 420, 0x0c0e14, 0.6).setOrigin(0.5, 0));
    container.add(this.add.rectangle(0, GROUND_Y - 420, 8, 420, accent).setOrigin(0.5, 0));
    const cell = 16;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const dark = (r + c) % 2 === 0;
        container.add(
          this.add
            .rectangle(8 + c * cell, GROUND_Y - 420 + r * cell, cell, cell, dark ? 0x111111 : 0xffffff)
            .setOrigin(0, 0),
        );
      }
    }
    return container;
  }

  private updatePowerUps(speed: number, dt: number, deltaMs: number): void {
    for (const { p, view } of this.powerUps) {
      p.x -= speed * dt;
      view.x = p.x;
    }
    this.powerUps = this.powerUps.filter(({ p, view }) => {
      if (p.x < -80) {
        view.destroy();
        return false;
      }
      if (collectsPowerUp(this.runner.y, p)) {
        this.collectPowerUp(p);
        view.destroy();
        return false;
      }
      return true;
    });

    // Spawn the next pickup once due, in a spot clear of obstacles,
    // and never on the finish runway.
    if (this.distancePx >= this.nextPowerUpAt && this.remainingPx() > CLEAR_RUNWAY_PX) {
      const x = WORLD_WIDTH + 60;
      const blocked = this.obstacles.some(
        ({ obs }) => obs.x < x + 160 && obs.x + obs.w > x - 160,
      );
      if (!blocked) {
        const p = makePowerUp(this.rng, x);
        this.powerUps.push({ p, view: this.buildPowerUpView(p) });
        this.nextPowerUpAt = this.distancePx + powerUpGapPx(this.rng);
      }
    }

    // Tick down the active effect.
    if (this.doubleJumpMs > 0) {
      this.doubleJumpMs = Math.max(0, this.doubleJumpMs - deltaMs);
      this.powerBadge.setText(`⇈ ${Math.ceil(this.doubleJumpMs / 1000)}s`);
      this.aura.setVisible(true);
      this.aura.setAlpha(0.2 + 0.12 * Math.sin(this.time.now / 110));
      if (this.doubleJumpMs === 0) {
        this.powerBadge.setText("");
        this.aura.setVisible(false);
      }
    }
  }

  private collectPowerUp(p: PowerUp): void {
    const spec = POWER_UPS[p.kind];
    this.doubleJumpMs = spec.durationMs;
    sfx.clear(2);
    this.sparkle.explode(16, PLAYER_X + PLAYER_SIZE / 2, p.y);
    floatBanner(this, `${spec.label}!`, 520, "60px", "#ffd54f");
  }

  private buildPowerUpView(p: PowerUp): Phaser.GameObjects.Container {
    const spec = POWER_UPS[p.kind];
    const container = this.add.container(p.x, p.y).setDepth(9);
    const diamond = this.add.rectangle(0, 0, 40, 40, spec.color).setStrokeStyle(4, 0xffffff, 0.9);
    diamond.setAngle(45);
    const glyph = this.add
      .text(0, 0, "⇈", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "26px",
        color: "#12141c",
      })
      .setOrigin(0.5);
    container.add([diamond, glyph]);
    this.tweens.add({ targets: diamond, angle: 405, duration: 1800, repeat: -1 });
    // Visual bob only — the logic-side pickup box stays at p.y.
    this.tweens.add({
      targets: container,
      y: p.y - 12,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    return container;
  }

  private maybeSpawnPattern(speed: number): void {
    // Leave a clean runway before the finish line.
    if (this.remainingPx() < CLEAR_RUNWAY_PX) return;
    const gap = minGapPx(speed) * levelGapScale(this.levelNum);
    const last = this.obstacles[this.obstacles.length - 1];
    const lastEnd = last ? last.obs.x + last.obs.w : -Infinity;
    if (lastEnd > WORLD_WIDTH + 40 - gap) return;
    const startX = Math.max(WORLD_WIDTH + 40, lastEnd + gap);
    const pattern = pickPattern(this.rng, speed);
    for (const spec of pattern.obstacles) {
      const obs: Obstacle = { x: startX + spec.dx, w: spec.w, h: spec.h, kind: spec.kind };
      this.obstacles.push({ obs, view: this.buildObstacleView(obs) });
    }
  }

  private buildObstacleView(obs: Obstacle): Phaser.GameObjects.Container {
    const top = GROUND_Y - obs.h;
    const container = this.add.container(obs.x, top).setDepth(8);
    const { w, h } = obs;

    const shadow = this.add
      .image(w / 2 + 8, h + 7, "shadowtex")
      .setScale((w + 36) / 96, 0.8)
      .setAlpha(0.55);
    container.add(shadow);

    const g = this.add.graphics();
    if (obs.kind === "spike") {
      // Two-tone faces: lit left, shaded right — same light as the cube bevel.
      g.fillStyle(0xef5350);
      g.fillPoints([{ x: 0, y: h }, { x: w / 2, y: 0 }, { x: w / 2, y: h }], true);
      g.fillStyle(0x8e2320);
      g.fillPoints([{ x: w / 2, y: 0 }, { x: w, y: h }, { x: w / 2, y: h }], true);
      g.lineStyle(3, 0xff8a80, 0.9);
      g.strokePoints([{ x: 0, y: h }, { x: w / 2, y: 0 }, { x: w, y: h }], false);
    } else {
      // 2.5D box: shaded right face and lit top face extruded up-right.
      const d = 14;
      g.fillStyle(0x252e6e);
      g.fillPoints(
        [{ x: w, y: 0 }, { x: w + d, y: -d }, { x: w + d, y: h - d }, { x: w, y: h }],
        true,
      );
      g.fillStyle(0x8d97dd);
      g.fillPoints(
        [{ x: 0, y: 0 }, { x: d, y: -d }, { x: w + d, y: -d }, { x: w, y: 0 }],
        true,
      );
      g.fillStyle(0x3949ab);
      g.fillRect(0, 0, w, h);
      g.fillStyle(0x5262c4);
      g.fillRect(0, 0, w, 7);
      g.lineStyle(2, 0x171d45, 1);
      g.strokeRect(0, 0, w, h);
    }
    container.add(g);
    return container;
  }

  private bumpBestPct(pct: number): number {
    const key = `bestPct:${this.levelNum}`;
    const best = Math.max(storage.get(key, 0), pct);
    storage.set(key, best);
    return best;
  }

  private completeLevel(): void {
    this.phase = "complete";
    this.trail.emitting = false;
    this.bumpBestPct(100);
    const unlocked = storage.get("unlockedLevel", 1);
    if (this.levelNum + 1 > unlocked) storage.set("unlockedLevel", this.levelNum + 1);
    sfx.clear(4);
    music.stop();
    this.sparkle.explode(30, this.playerView.x, this.playerView.y);
    void adsReady.then((ads) => ads.maybeShowInterstitial());

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0));
    overlay.add(
      this.add
        .text(width / 2, height * 0.28, "LEVEL\nCOMPLETE!", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "84px",
          color: this.levelColorHex(this.levelNum),
          align: "center",
        })
        .setOrigin(0.5)
        .setShadow(0, 8, "#000000", 10, false, true),
    );
    overlay.add(
      this.add
        .text(width / 2, height * 0.44, `Level ${this.levelNum} cleared\nLevel ${this.levelNum + 1} unlocked!`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "44px",
          color: "#ffd54f",
          align: "center",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.58,
        "▶  NEXT LEVEL",
        { text: "#a5d6a7", background: "#1e3320" },
        () => this.scene.restart({ level: this.levelNum + 1 }),
      ),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.68,
        "↻  REPLAY",
        { text: "#ffd54f", background: "#332e1a" },
        () => this.scene.restart({ level: this.levelNum }),
        "44px",
      ),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.77,
        "☰  MENU",
        { text: "#90caf9", background: "#16283d" },
        () => this.scene.start("menu"),
        "40px",
      ),
    );
  }

  private die(): void {
    this.phase = "dead";
    this.trail.emitting = false;
    this.burst.explode(28, this.playerView.x, this.playerView.y);
    this.playerView.setVisible(false);
    this.playerShadow.setVisible(false);
    this.aura.setVisible(false);
    this.powerBadge.setText("");
    sfx.gameOver();
    music.stop();
    this.cameras.main.shake(200, 0.01);
    const pct = this.progressPct();
    const best = this.bumpBestPct(pct);
    void adsReady.then((ads) => ads.maybeShowInterstitial());

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0));
    overlay.add(
      this.add
        .text(width / 2, height * 0.28, `CRASHED\nAT ${pct}%`, {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "80px",
          color: "#ffffff",
          align: "center",
        })
        .setOrigin(0.5)
        .setShadow(0, 8, "#000000", 10, false, true),
    );
    overlay.add(
      this.add
        .text(width / 2, height * 0.43, `Level ${this.levelNum}  ·  Best: ${best}%`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "46px",
          color: "#ffd54f",
        })
        .setOrigin(0.5),
    );

    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.56,
        "↻  RETRY",
        { text: "#a5d6a7", background: "#1e3320" },
        () => this.scene.restart({ level: this.levelNum }),
      ),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.75,
        "☰  MENU",
        { text: "#90caf9", background: "#16283d" },
        () => this.scene.start("menu"),
        "40px",
      ),
    );

    if (!this.usedContinue) {
      void adsReady.then((ads) => {
        if (this.phase === "dead" && ads.isRewardedReady()) {
          overlay.add(
            textButton(
              this,
              width / 2,
              height * 0.655,
              "🎬  KEEP RUNNING (AD)",
              { text: "#90caf9", background: "#16283d" },
              () => {
                void ads.showRewarded().then((earned) => {
                  if (earned) this.revive(overlay);
                });
              },
              "44px",
            ),
          );
        }
      });
    }
  }

  /** Rewarded revive: clear the obstacles ahead and blink through briefly. */
  private revive(overlay: Phaser.GameObjects.Container): void {
    this.usedContinue = true;
    overlay.destroy();
    this.obstacles = this.obstacles.filter(({ obs, view }) => {
      const near = obs.x < PLAYER_X + REVIVE_CLEAR_PX;
      if (near) {
        view.destroy();
        return false;
      }
      return true;
    });
    this.runner.y = GROUND_Y;
    this.runner.vy = 0;
    this.runner.grounded = true;
    this.playerView.rotation = 0;
    this.playerView.setVisible(true);
    this.playerShadow.setVisible(true);
    this.trail.emitting = true;
    this.invulnMs = REVIVE_INVULN_MS;
    this.phase = "playing";
    if (!storage.get("musicMuted", false)) music.start();
  }
}
