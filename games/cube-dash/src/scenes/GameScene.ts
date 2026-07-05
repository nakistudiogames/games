import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import {
  GROUND_Y,
  PLAYER_SIZE,
  PLAYER_X,
  checkDeath,
  jump,
  minGapPx,
  pickPattern,
  speedForDistance,
  stepRunner,
  supportAt,
} from "../logic/runner";
import type { Obstacle, Runner } from "../logic/runner";
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

interface ObstacleView {
  obs: Obstacle;
  view: Phaser.GameObjects.Container;
}

type Phase = "ready" | "playing" | "dead";

export class GameScene extends Phaser.Scene {
  private runner!: Runner;
  private playerView!: Phaser.GameObjects.Container;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private obstacles: ObstacleView[] = [];
  private rng!: Rng;
  private phase: Phase = "ready";
  private distancePx = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private readyText: Phaser.GameObjects.Text | null = null;
  private muteButton!: Phaser.GameObjects.Text;
  private usedContinue = false;
  private invulnMs = 0;
  private jumpBufferMs = 0;
  private lastMilestone = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.runner = { y: GROUND_Y, vy: 0, grounded: true };
    this.obstacles = [];
    this.rng = new Rng();
    this.phase = "ready";
    this.distancePx = 0;
    this.usedContinue = false;
    this.invulnMs = 0;
    this.jumpBufferMs = 0;
    this.lastMilestone = 0;

    this.ensureTextures();
    this.buildBackground();
    this.buildPlayer();
    this.buildHud();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // Ignore taps on the mute button.
      if (this.muteButton.getBounds().contains(p.x, p.y)) return;
      this.onTap();
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.onTap());
    this.input.keyboard?.on("keydown-UP", () => this.onTap());
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
      .setAlpha(0.9);

    this.groundTile = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y, "groundgrid")
      .setOrigin(0)
      .setDepth(4);
    // Neon edge on the ground plus a soft glow above it.
    this.add.rectangle(0, GROUND_Y - 10, WORLD_WIDTH, 10, 0x26c6da, 0.12).setOrigin(0).setDepth(5);
    this.add.rectangle(0, GROUND_Y - 3, WORLD_WIDTH, 5, 0x4dd0e1).setOrigin(0).setDepth(5);
  }

  private buildPlayer(): void {
    const s = PLAYER_SIZE;
    const body = this.add.rectangle(0, 0, s, s, PLAYER_COLOR).setStrokeStyle(5, 0x0a2a30);
    const face = this.add.rectangle(0, 0, s - 22, s - 22, 0x63e5f5);
    const eyeL = this.add.rectangle(-9, -6, 9, 14, 0x0a2a30);
    const eyeR = this.add.rectangle(11, -6, 9, 14, 0x0a2a30);
    const mouth = this.add.rectangle(1, 12, 22, 6, 0x0a2a30);
    this.playerView = this.add
      .container(PLAYER_X + s / 2, GROUND_Y - s / 2, [body, face, eyeL, eyeR, mouth])
      .setDepth(10);

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
    this.scoreText = this.add
      .text(WORLD_WIDTH / 2, 110, "0m", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(20);

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
      .text(WORLD_WIDTH / 2, 700, "TAP TO JUMP", {
        fontFamily: "Arial, sans-serif",
        fontSize: "52px",
        color: "#a5d6a7",
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
    if (this.runner.grounded) {
      jump(this.runner);
      sfx.place();
    } else {
      this.jumpBufferMs = JUMP_BUFFER_MS;
    }
  }

  override update(time: number, deltaMs: number): void {
    if (this.phase !== "playing") return;
    const dt = Math.min(deltaMs, MAX_DT_MS) / 1000;
    const speed = speedForDistance(this.distancePx);
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

    const meters = Math.floor(this.distancePx / 10);
    this.scoreText.setText(`${meters}m`);
    if (meters >= this.lastMilestone + 100) {
      this.lastMilestone += 100;
      floatBanner(this, `${this.lastMilestone}m!`, 420, "64px", "#26c6da");
      sfx.clear(1);
    }

    if (this.invulnMs > 0) {
      this.invulnMs -= deltaMs;
      this.playerView.setAlpha(Math.sin(time / 50) > 0 ? 0.4 : 1);
      if (this.invulnMs <= 0) this.playerView.setAlpha(1);
      return;
    }
    if (checkDeath(this.runner.y, obsList)) this.die();
  }

  private maybeSpawnPattern(speed: number): void {
    const last = this.obstacles[this.obstacles.length - 1];
    const lastEnd = last ? last.obs.x + last.obs.w : -Infinity;
    if (lastEnd > WORLD_WIDTH + 40 - minGapPx(speed)) return;
    const startX = Math.max(WORLD_WIDTH + 40, lastEnd + minGapPx(speed));
    const pattern = pickPattern(this.rng, speed);
    for (const spec of pattern.obstacles) {
      const obs: Obstacle = { x: startX + spec.dx, w: spec.w, h: spec.h, kind: spec.kind };
      this.obstacles.push({ obs, view: this.buildObstacleView(obs) });
    }
  }

  private buildObstacleView(obs: Obstacle): Phaser.GameObjects.Container {
    const top = GROUND_Y - obs.h;
    const container = this.add.container(obs.x, top).setDepth(8);
    if (obs.kind === "spike") {
      const spike = this.add
        .triangle(obs.w / 2, obs.h / 2, 0, obs.h, obs.w / 2, 0, obs.w, obs.h, 0xd32f2f)
        .setStrokeStyle(3, 0xff8a80);
      container.add(spike);
    } else {
      const body = this.add
        .rectangle(0, 0, obs.w, obs.h, 0x3949ab)
        .setOrigin(0)
        .setStrokeStyle(3, 0x7986cb);
      const bevel = this.add.rectangle(3, 3, obs.w - 6, 8, 0x9fa8da).setOrigin(0);
      container.add([body, bevel]);
    }
    return container;
  }

  private die(): void {
    this.phase = "dead";
    this.trail.emitting = false;
    this.burst.explode(28, this.playerView.x, this.playerView.y);
    this.playerView.setVisible(false);
    sfx.gameOver();
    music.stop();
    this.cameras.main.shake(200, 0.01);
    const meters = Math.floor(this.distancePx / 10);
    const best = storage.bumpHighScore(meters);
    void adsReady.then((ads) => ads.maybeShowInterstitial());

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0));
    overlay.add(
      this.add
        .text(width / 2, height * 0.3, "CRASHED!", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "80px",
          color: "#ffffff",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(
          width / 2,
          height * 0.42,
          `Distance: ${meters}m\n${meters >= best && meters > 0 ? "New best!" : `Best: ${best}m`}`,
          {
            fontFamily: "Arial, sans-serif",
            fontSize: "48px",
            color: "#ffd54f",
            align: "center",
          },
        )
        .setOrigin(0.5),
    );

    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.58,
        "▶  PLAY AGAIN",
        { text: "#a5d6a7", background: "#1e3320" },
        () => this.scene.restart(),
      ),
    );

    if (!this.usedContinue) {
      void adsReady.then((ads) => {
        if (this.phase === "dead" && ads.isRewardedReady()) {
          overlay.add(
            textButton(
              this,
              width / 2,
              height * 0.7,
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
      if (near) view.destroy();
      return !near;
    });
    this.runner.y = GROUND_Y;
    this.runner.vy = 0;
    this.runner.grounded = true;
    this.playerView.rotation = 0;
    this.playerView.setVisible(true);
    this.trail.emitting = true;
    this.invulnMs = REVIVE_INVULN_MS;
    this.phase = "playing";
    if (!storage.get("musicMuted", false)) music.start();
  }
}
