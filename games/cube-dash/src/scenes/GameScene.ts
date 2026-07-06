import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import type { MusicPlayer } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import {
  GROUND_Y,
  KINDS_WITH_PHASE,
  MIRROR_MIN_LEVEL,
  PLAYER_SIZE,
  PLAYER_X,
  POWER_UPS,
  checkDeath,
  collectsPowerUp,
  cometElev,
  crusherElev,
  droneElev,
  droneShift,
  gearShift,
  geyserActive,
  jump,
  levelColor,
  levelGapScale,
  levelLengthM,
  levelSeed,
  levelSpeed,
  makePowerUp,
  minGapPx,
  phantomSolid,
  pickPattern,
  powerUpGapPx,
  reaperActive,
  stepRunner,
  supportAt,
  swingElev,
  talonActive,
  tentacleSway,
  trackZones,
  tryJump,
  vineHeight,
  zoneKindAt,
} from "../logic/runner";
import type {
  Obstacle,
  ObstacleKind,
  PowerUp,
  Runner,
  TrackZone,
  TrackZoneKind,
} from "../logic/runner";
import { adsReady } from "../ads";
import { characterById } from "../characters";
import { attachAura, buildCharacterParts } from "../characterView";
import { musicForLevel, stopAllMusic } from "../music";
import { drawObstacle } from "../obstacleView";
import { worldForLevel } from "../worlds";
import type { WorldTheme } from "../worlds";
import { godModeOn, storage } from "./MenuScene";

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 1280;
const REVIVE_INVULN_MS = 1200;
const REVIVE_CLEAR_PX = 900;
const MAX_DT_MS = 50;
/** Tap slightly before landing still triggers a jump on touchdown. */
const JUMP_BUFFER_MS = 110;
/** Distance until the first pickup — early, so players learn the mechanic. */
const FIRST_POWERUP_PX = 1500;
/** No obstacles/pickups spawn once the finish is closer than this. */
const CLEAR_RUNWAY_PX = 1200;
/** Vertical mirror line for gravity-flip zones: ground 1000 ↔ ceiling 320. */
const FLIP_PIVOT_Y = 660;
const ZONE_COLORS: Record<TrackZoneKind, number> = { mirror: 0xeceff1, flip: 0xb388ff };

interface ObstacleView {
  obs: Obstacle;
  view: Phaser.GameObjects.Container;
}

interface PowerUpView {
  p: PowerUp;
  view: Phaser.GameObjects.Container;
}

type Phase = "ready" | "playing" | "paused" | "dead" | "complete";

export class GameScene extends Phaser.Scene {
  private levelNum = 1;
  private levelLengthPx = 0;
  private world!: WorldTheme;
  private bgm!: MusicPlayer;
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
  private bgMid2: Phaser.GameObjects.TileSprite | null = null;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private obstacles: ObstacleView[] = [];
  private powerUps: PowerUpView[] = [];
  private finishView: Phaser.GameObjects.Container | null = null;
  /**
   * Everything that scrolls with the track lives in this container. Mirror
   * and flip zones are ONE transform on it (scaleX/scaleY = -1) — physics
   * and layouts never change, only how they're presented.
   */
  private trackLayer!: Phaser.GameObjects.Container;
  /** Sub-container for spawned views (obstacles/pickups/finish/gates). */
  private trackObjects!: Phaser.GameObjects.Container;
  private zones: TrackZone[] = [];
  private activeZone: TrackZoneKind | null = null;
  private zoneGates: Array<{ at: number; view: Phaser.GameObjects.Container }> = [];
  private rng!: Rng;
  private phase: Phase = "ready";
  private distancePx = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private elapsedMs = 0;
  private levelText!: Phaser.GameObjects.Text;
  private powerBadge!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private readyText: Phaser.GameObjects.Text | null = null;
  private muteButton!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  /** Swallows the tap that pressed RESUME so it doesn't also jump. */
  private resumeGuardUntil = 0;
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
    this.world = worldForLevel(this.levelNum);
    this.bgm = musicForLevel(this.levelNum);
    this.levelLengthPx = levelLengthM(this.levelNum) * 10;
    this.runner = { y: GROUND_Y, vy: 0, grounded: true, airJumpUsed: false };
    this.obstacles = [];
    this.powerUps = [];
    this.finishView = null;
    // Seeded per level: every attempt at a level has the identical layout.
    this.rng = new Rng(levelSeed(this.levelNum));
    this.phase = "ready";
    this.distancePx = 0;
    this.elapsedMs = 0;
    this.usedContinue = false;
    this.invulnMs = 0;
    this.jumpBufferMs = 0;
    this.doubleJumpMs = 0;
    this.nextPowerUpAt = FIRST_POWERUP_PX;
    this.zones = this.levelNum >= MIRROR_MIN_LEVEL ? trackZones(this.levelNum, this.levelLengthPx) : [];
    this.activeZone = null;
    this.zoneGates = [];

    this.ensureTextures();
    // The track layer sits above the scenery (depths 0-3) and below the HUD
    // (20+); children render in add order, so build order = draw order.
    this.trackLayer = this.add.container(0, 0).setDepth(4);
    this.buildBackground();
    this.buildPlayer();
    this.buildZoneGates();
    this.buildHud();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.muteButton.getBounds().contains(p.x, p.y)) return;
      if (this.pauseButton.getBounds().contains(p.x, p.y)) return;
      this.onTap();
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.onTap());
    this.input.keyboard?.on("keydown-UP", () => this.onTap());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());

    // Auto-pause when the app is backgrounded or the window loses focus.
    // Phaser's HIDDEN maps to visibilitychange, which Capacitor WebViews also
    // fire on native app backgrounding — so this covers browser and mobile.
    const autoPause = (): void => {
      if (this.phase === "playing") this.pauseGame();
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
    });
  }

  private togglePause(): void {
    if (this.phase === "playing") this.pauseGame();
    else if (this.phase === "paused") this.resumeGame();
  }

  private pauseGame(): void {
    this.phase = "paused";
    this.trail.emitting = false;
    stopAllMusic();

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setInteractive());
    overlay.add(
      this.add
        .text(width / 2, height * 0.3, "PAUSED", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "80px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setShadow(0, 8, "#000000", 10, false, true),
    );
    overlay.add(
      this.add
        .text(width / 2, height * 0.4, `Level ${this.levelNum}  ·  ${this.progressPct()}%`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "40px",
          color: "#ffd54f",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.53,
        "▶  RESUME",
        { text: "#a5d6a7", background: "#1e3320" },
        () => this.resumeGame(),
      ),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.63,
        "↻  RESTART LEVEL",
        { text: "#ffd54f", background: "#332e1a" },
        () => this.scene.restart({ level: this.levelNum }),
        "44px",
      ),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.73,
        "☰  MENU",
        { text: "#90caf9", background: "#16283d" },
        () => {
          stopAllMusic();
          this.scene.start("menu");
        },
        "44px",
      ),
    );
    this.pauseOverlay = overlay;
  }

  private resumeGame(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.phase = "playing";
    this.resumeGuardUntil = this.time.now + 200;
    this.trail.emitting = true;
    if (!storage.get("musicMuted", false)) this.bgm.start();
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
    // World-specific silhouette (city buildings / crystal shards / rocks).
    const silKey = `sil-${this.world.id}`;
    if (!this.textures.exists(silKey)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      if (this.world.silhouette === "city") {
        const buildings: Array<[number, number, number]> = [
          [0, 70, 190], [80, 60, 260], [150, 90, 140], [250, 70, 300], [330, 55, 210],
        ];
        for (const [x, w, h] of buildings) {
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          g.fillStyle(this.world.silLight, 1);
          g.fillRect(x, 320 - h, w, 6);
        }
      } else if (this.world.silhouette === "crystals") {
        const shards: Array<[number, number, number]> = [
          [0, 70, 220], [50, 50, 300], [110, 80, 170], [180, 55, 260], [240, 90, 200],
          [310, 60, 310], [360, 50, 150],
        ];
        for (const [x, w, h] of shards) {
          g.fillStyle(this.world.silDark, 1);
          g.fillTriangle(x, 320, x + w / 2, 320 - h, x + w, 320);
          g.fillStyle(this.world.silLight, 0.8);
          g.fillTriangle(x + w / 2, 320 - h, x + w / 2 + 8, 320 - h + 40, x + w / 2 - 8, 320 - h + 40);
        }
      } else if (this.world.silhouette === "peaks") {
        const peaks: Array<[number, number, number]> = [
          [0, 130, 230], [90, 150, 300], [210, 120, 200], [280, 140, 280], [370, 90, 170],
        ];
        for (const [x, w, h] of peaks) {
          g.fillStyle(this.world.silDark, 1);
          g.fillTriangle(x, 320, x + w * 0.5, 320 - h, x + w, 320);
          // Snow cap hugging the summit.
          g.fillStyle(this.world.silLight, 0.9);
          g.fillTriangle(x + w * 0.5, 320 - h, x + w * 0.62, 320 - h * 0.82, x + w * 0.38, 320 - h * 0.82);
        }
      } else if (this.world.silhouette === "mushrooms") {
        const shrooms: Array<[number, number, number]> = [
          [10, 90, 180], [110, 130, 260], [230, 80, 150], [290, 120, 230],
        ];
        for (const [x, capW, h] of shrooms) {
          const cx = x + capW / 2;
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(cx - capW * 0.175, 320 - h, capW * 0.35, h); // stalk
          g.fillEllipse(cx, 320 - h, capW, capW * 0.55); // cap
          g.fillStyle(this.world.silLight, 0.8);
          g.fillEllipse(cx, 320 - h - capW * 0.08, capW * 0.6, capW * 0.2);
        }
      } else if (this.world.silhouette === "ruins") {
        const ruins: Array<[number, number]> = [
          [0, 150], [140, 200], [320, 130],
        ];
        const tierH = 46;
        for (const [x, baseW] of ruins) {
          const tiers = Math.round(baseW / 44);
          for (let t = 0; t < tiers; t++) {
            const w = baseW * (1 - t * 0.18);
            const cx = x + baseW / 2;
            g.fillStyle(this.world.silDark, 1);
            g.fillRect(cx - w / 2, 320 - tierH * (t + 1), w, tierH);
            g.fillStyle(this.world.silLight, 0.7);
            g.fillRect(cx - w / 2, 320 - tierH * (t + 1), w, 4);
          }
        }
      } else if (this.world.silhouette === "tendrils") {
        const tendrils: Array<[number, number, number, number]> = [
          [10, 34, 240, 40], [80, 26, 300, -30], [150, 40, 200, 25], [230, 30, 310, -45],
          [300, 36, 250, 35], [365, 24, 180, -20],
        ];
        for (const [x, w, h, lean] of tendrils) {
          g.fillStyle(this.world.silDark, 1);
          g.fillTriangle(x, 320, x + w / 2 + lean, 320 - h, x + w, 320);
          g.fillStyle(this.world.silLight, 0.5);
          g.fillTriangle(x + w * 0.3, 320, x + w / 2 + lean, 320 - h * 0.9, x + w * 0.55, 320);
        }
      } else if (this.world.silhouette === "spires") {
        const spires: Array<[number, number, number]> = [
          [10, 44, 210], [80, 60, 250], [170, 40, 170], [230, 70, 240], [330, 50, 220],
        ];
        for (const [x, w, h] of spires) {
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          g.fillTriangle(x, 320 - h, x + w / 2, 320 - h - w, x + w, 320 - h); // pointed tip
          g.fillStyle(this.world.silLight, 0.8);
          g.fillRect(x + w / 2 - 2, 320 - h, 4, h); // lit spine
        }
      } else if (this.world.silhouette === "arches") {
        for (const [x, w, h] of [[0, 130, 200], [130, 150, 260], [290, 120, 180]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          // Carved opening: a lighter arch reads as sky through the monument.
          g.fillStyle(this.world.silLight, 0.35);
          g.fillRect(x + w * 0.3, 320 - h * 0.62, w * 0.4, h * 0.62);
          g.fillEllipse(x + w / 2, 320 - h * 0.62, w * 0.4, h * 0.3);
          g.fillStyle(this.world.silLight, 0.9);
          g.fillRect(x, 320 - h, w, 5);
        }
      } else if (this.world.silhouette === "pines") {
        for (const [x, w, h] of [[0, 80, 180], [70, 110, 280], [180, 90, 220], [270, 120, 300], [380, 70, 160]] as const) {
          g.fillStyle(this.world.silDark, 1);
          for (let t = 0; t < 3; t++) {
            const tw = w * (1 - t * 0.25);
            const ty = 320 - (h / 3) * (t + 1);
            g.fillTriangle(x + (w - tw) / 2, 320 - (h / 3) * t, x + w - (w - tw) / 2, 320 - (h / 3) * t, x + w / 2, ty);
          }
          g.fillStyle(this.world.silLight, 0.7);
          g.fillTriangle(x + w * 0.35, 320 - h * 0.66, x + w / 2, 320 - h, x + w / 2, 320 - h * 0.66);
        }
      } else if (this.world.silhouette === "stacks") {
        for (const [x, w, h] of [[10, 60, 240], [110, 80, 180], [220, 55, 290], [320, 70, 210]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          g.fillRect(x - 8, 320 - h, w + 16, 14); // crown lip
          g.fillStyle(this.world.silLight, 0.8);
          g.fillRect(x, 320 - h, 6, h);
          // Smoke plume drifting off the stack.
          g.fillStyle(this.world.silLight, 0.3);
          g.fillEllipse(x + w / 2 + 18, 320 - h - 18, 46, 22);
          g.fillEllipse(x + w / 2 + 44, 320 - h - 34, 30, 16);
        }
      } else if (this.world.silhouette === "thunderheads") {
        for (const [x, y, s] of [[30, 240, 60], [140, 190, 80], [280, 230, 70], [370, 180, 50]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillEllipse(x, y, s * 2.4, s);
          g.fillEllipse(x + s, y - s * 0.5, s * 1.8, s * 0.9);
          g.fillStyle(this.world.silLight, 0.6);
          g.fillEllipse(x - s * 0.4, y - s * 0.36, s, s * 0.4);
          // Lightning drops to the horizon.
          g.lineStyle(3, this.world.silLight, 0.8);
          g.beginPath();
          g.moveTo(x + s * 0.4, y + s * 0.4);
          g.lineTo(x + s * 0.2, y + s * 0.9);
          g.lineTo(x + s * 0.5, y + s * 1.1);
          g.strokePath();
        }
      } else if (this.world.silhouette === "citadel") {
        for (const [x, w, h] of [[20, 90, 230], [140, 130, 300], [300, 90, 250]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          // Battlements + a spire — and mirrored towers hanging above, the
          // inverted-citadel motif.
          for (let bx = x; bx + 14 <= x + w; bx += 22) g.fillRect(bx, 320 - h - 10, 14, 10);
          g.fillTriangle(x + w / 2 - 12, 320 - h - 10, x + w / 2 + 12, 320 - h - 10, x + w / 2, 320 - h - 52);
          g.fillStyle(this.world.silLight, 0.35);
          g.fillRect(x + w * 0.18, 20, w * 0.64, 34);
          g.fillTriangle(x + w / 2 - 10, 54, x + w / 2 + 10, 54, x + w / 2, 86);
          g.fillStyle(this.world.silLight, 0.9);
          g.fillRect(x, 320 - h, w, 5);
        }
      } else if (this.world.silhouette === "coral") {
        for (const [x, w, h] of [[10, 70, 180], [100, 90, 260], [210, 60, 150], [290, 100, 230], [390, 40, 120]] as const) {
          g.fillStyle(this.world.silDark, 1);
          // Branching coral: a trunk with two forks.
          g.fillRect(x + w / 2 - 8, 320 - h * 0.55, 16, h * 0.55);
          g.fillTriangle(x + w / 2, 320 - h * 0.5, x, 320 - h, x + 26, 320 - h);
          g.fillTriangle(x + w / 2, 320 - h * 0.55, x + w, 320 - h * 0.9, x + w - 24, 320 - h * 0.86);
          g.fillStyle(this.world.silLight, 0.7);
          g.fillCircle(x + 13, 320 - h - 4, 7);
          g.fillCircle(x + w - 12, 320 - h * 0.9 - 4, 6);
        }
      } else if (this.world.silhouette === "ribs") {
        // A colossal ribcage arcing over the horizon.
        for (let i = 0; i < 6; i++) {
          const x = 20 + i * 68;
          const h = 180 + (i % 2) * 60 + (i < 3 ? i * 24 : (5 - i) * 24);
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, 22, h);
          g.fillEllipse(x + 24, 320 - h, 50, 26);
          g.fillStyle(this.world.silLight, 0.6);
          g.fillRect(x + 3, 320 - h, 5, h);
        }
      } else if (this.world.silhouette === "circuits") {
        for (const [x, w, h] of [[0, 110, 210], [130, 90, 280], [240, 130, 170], [390, 60, 240]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          // Trace lines + node dots, like a motherboard skyline.
          g.lineStyle(3, this.world.silLight, 0.7);
          g.lineBetween(x + 12, 320 - h + 16, x + 12, 320 - 20);
          g.lineBetween(x + 12, 320 - h + 16, x + w - 16, 320 - h + 16);
          g.fillStyle(this.world.silLight, 0.9);
          g.fillCircle(x + 12, 320 - h + 16, 5);
          g.fillCircle(x + w - 16, 320 - h + 16, 5);
        }
      } else if (this.world.silhouette === "obelisks") {
        for (const [x, w, h] of [[30, 46, 260], [120, 60, 310], [230, 40, 200], [310, 54, 280], [400, 30, 160]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillPoints(
            [{ x, y: 320 }, { x: x + w * 0.14, y: 320 - h }, { x: x + w * 0.86, y: 320 - h }, { x: x + w, y: 320 }],
            true,
          );
          g.fillTriangle(x + w * 0.14, 320 - h, x + w * 0.86, 320 - h, x + w / 2, 320 - h - w * 0.7);
          g.fillStyle(this.world.silLight, 0.8);
          g.fillRect(x + w / 2 - 2, 320 - h + 8, 4, h - 24);
        }
      } else if (this.world.silhouette === "flares") {
        // Prominence loops erupting off a molten horizon.
        g.fillStyle(this.world.silDark, 1);
        g.fillRect(0, 250, 400, 70);
        for (const [x, r] of [[70, 60], [200, 95], [330, 50]] as const) {
          g.lineStyle(14, this.world.silDark, 1);
          g.beginPath();
          g.arc(x, 260, r, Math.PI, 0);
          g.strokePath();
          g.lineStyle(5, this.world.silLight, 0.8);
          g.beginPath();
          g.arc(x, 260, r, Math.PI, 0);
          g.strokePath();
        }
      } else if (this.world.silhouette === "planets") {
        // Ringed giants and moons low on the horizon.
        for (const [x, y, r] of [[90, 210, 70], [280, 150, 46], [370, 250, 30]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillCircle(x, y, r);
          g.fillStyle(this.world.silLight, 0.5);
          g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4);
          g.lineStyle(6, this.world.silLight, 0.55);
          g.strokeEllipse(x, y + r * 0.1, r * 3, r * 0.7);
        }
      } else if (this.world.silhouette === "summit") {
        for (const [x, w, h] of [[0, 170, 260], [150, 210, 320], [330, 140, 230]] as const) {
          g.fillStyle(this.world.silDark, 1);
          g.fillTriangle(x, 320, x + w * 0.5, 320 - h, x + w, 320);
          // Chrome facet: the whole lit half gleams, final-world flourish.
          g.fillStyle(this.world.silLight, 0.85);
          g.fillTriangle(x + w * 0.5, 320 - h, x + w * 0.5, 320, x + w * 0.28, 320);
        }
      } else {
        const rocks: Array<[number, number, number]> = [
          [0, 160, 140], [100, 190, 210], [240, 170, 160], [320, 160, 120],
        ];
        for (const [x, w, h] of rocks) {
          g.fillStyle(this.world.silDark, 1);
          g.fillTriangle(x, 320, x + w * 0.45, 320 - h, x + w, 320);
          g.fillStyle(this.world.silLight, 0.55);
          g.fillTriangle(x + w * 0.45, 320 - h, x + w * 0.62, 320 - h * 0.55, x + w * 0.3, 320 - h * 0.55);
        }
      }
      g.generateTexture(silKey, 400, 320);
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
    const groundKey = `ground-${this.world.id}`;
    if (!this.textures.exists(groundKey)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(this.world.groundBase, 1);
      g.fillRect(0, 0, 80, 280);
      g.fillStyle(this.world.groundGrid, 1);
      g.fillRect(0, 0, 2, 280); // vertical grid line
      g.fillRect(0, 56, 80, 1); // faint horizontals
      g.fillRect(0, 140, 80, 1);
      g.generateTexture(groundKey, 80, 280);
      g.destroy();
    }
  }

  private buildBackground(): void {
    const accent = levelColor(this.levelNum);

    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(this.world.skyTop, this.world.skyTop, this.world.skyBottomA, this.world.skyBottomB, 1);
    sky.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);

    const silKey = `sil-${this.world.id}`;
    this.bgFar = this.add
      .tileSprite(0, 0, WORLD_WIDTH, GROUND_Y, "stars")
      .setOrigin(0)
      .setDepth(1)
      .setAlpha(0.7);
    this.bgMid = this.add
      .tileSprite(0, GROUND_Y - 320, WORLD_WIDTH, 320, silKey)
      .setOrigin(0)
      .setDepth(2)
      .setAlpha(0.55); // atmospheric haze pushes the silhouette into the distance
    // Extra depth layer appears as the levels progress.
    this.bgMid2 = null;
    if ((this.levelNum - 1) % 5 >= 2) {
      // Third level of each world onward gains a second, more distant layer.
      this.bgMid2 = this.add
        .tileSprite(0, GROUND_Y - 545, WORLD_WIDTH, 224, silKey)
        .setOrigin(0)
        .setDepth(1)
        .setAlpha(0.3);
      this.bgMid2.setTileScale(0.7);
    }

    const haze = this.add.graphics().setDepth(3);
    haze.fillGradientStyle(this.world.haze, this.world.haze, this.world.haze, this.world.haze, 0, 0, 0.35, 0.35);
    haze.fillRect(0, GROUND_Y - 320, WORLD_WIDTH, 320);

    this.groundTile = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y, `ground-${this.world.id}`)
      .setOrigin(0);
    // Ground falls away into darkness — reads as depth below the track.
    const groundFade = this.add.graphics();
    groundFade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.65, 0.65);
    groundFade.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

    // Neon edge on the ground plus a soft glow above it, in the level color.
    const glow = this.add.rectangle(0, GROUND_Y - 10, WORLD_WIDTH, 10, accent, 0.12).setOrigin(0);
    const edge = this.add.rectangle(0, GROUND_Y - 3, WORLD_WIDTH, 5, accent).setOrigin(0);
    // The whole track strip flips/mirrors with the zone transform.
    this.trackLayer.add([this.groundTile, groundFade, glow, edge]);
  }

  private buildPlayer(): void {
    const s = PLAYER_SIZE;
    const spec = characterById(storage.get("character", "dash"));
    // Gold overlay shown only while the double-jump power-up is active —
    // distinct from the character's always-on signature aura.
    this.aura = this.add.rectangle(0, 0, s + 18, s + 18, 0xffd54f, 0.28).setVisible(false);
    this.playerView = this.add.container(PLAYER_X + s / 2, GROUND_Y - s / 2, [
      this.aura,
      ...buildCharacterParts(this, spec, s),
    ]);
    attachAura(this, this.playerView, spec, s);

    this.playerShadow = this.add.image(PLAYER_X + s / 2, GROUND_Y + 9, "shadowtex");

    this.trail = this.add.particles(0, 0, "dot", {
      follow: this.playerView,
      speedX: { min: -40, max: -10 },
      speedY: { min: -20, max: 20 },
      lifespan: 350,
      frequency: 28,
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.45, end: 0 },
      tint: [...spec.trail],
      emitting: false,
    });

    this.dust = this.add.particles(0, 0, "dot", {
      speed: { min: 40, max: 140 },
      angle: { min: 200, max: 340 },
      lifespan: 300,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x9e9e9e,
      emitting: false,
    });

    this.sparkle = this.add.particles(0, 0, "dot", {
      speed: { min: 80, max: 260 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd54f, 0xfff59d, 0xffffff],
      emitting: false,
    });

    this.burst = this.add.particles(0, 0, "dot", {
      speed: { min: 120, max: 420 },
      lifespan: 600,
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 900,
      tint: [0x26c6da, 0xffffff, 0xef5350],
      emitting: false,
    });

    // Track-layer draw order: shadow under everything spawned, spawned views
    // under the trail/player, celebration particles on top.
    this.trackObjects = this.add.container(0, 0);
    this.trackLayer.add([
      this.playerShadow,
      this.trackObjects,
      this.trail,
      this.dust,
      this.playerView,
      this.sparkle,
      this.burst,
    ]);
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

    this.timerText = this.add
      .text(WORLD_WIDTH / 2 + 145, 110, "0.0s", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#8a93a8",
      })
      .setOrigin(0, 0.5)
      .setDepth(20);
    this.timerText.setShadow(0, 4, "#000000", 6, false, true);

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
      .text(40, 145, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "38px",
        color: "#ffd54f",
      })
      .setOrigin(0, 0.5)
      .setDepth(20);
    this.powerBadge.setShadow(0, 5, "#000000", 6, false, true);

    this.pauseButton = this.add
      .text(668, 70, "⏸", { fontSize: "48px" })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on("pointerdown", () => this.togglePause());

    const muted = storage.get("musicMuted", false);
    this.muteButton = this.add
      .text(52, 70, muted ? "🔇" : "🔊", { fontSize: "48px" })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.muteButton.on("pointerdown", () => {
      const nowMuted = !storage.get("musicMuted", false);
      storage.set("musicMuted", nowMuted);
      this.muteButton.setText(nowMuted ? "🔇" : "🔊");
      if (nowMuted) stopAllMusic();
      else if (this.phase === "playing") this.bgm.start();
    });

    this.readyText = this.add
      .text(WORLD_WIDTH / 2, 700, `${this.world.name}\nLEVEL ${this.levelNum}\nTAP TO START`, {
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
      if (!storage.get("musicMuted", false)) this.bgm.start();
      return;
    }
    if (this.phase !== "playing") return;
    if (this.time.now < this.resumeGuardUntil) return;
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
    this.elapsedMs += deltaMs;
    const dt = Math.min(deltaMs, MAX_DT_MS) / 1000;
    const speed = levelSpeed(this.levelNum);
    this.distancePx += speed * dt;

    // Parallax: far stars drift, skyline rolls, ground grid matches the track.
    this.bgFar.tilePositionX += speed * dt * 0.12;
    if (this.bgMid2) this.bgMid2.tilePositionX += speed * dt * 0.22;
    this.bgMid.tilePositionX += speed * dt * 0.4;
    this.groundTile.tilePositionX += speed * dt;

    for (const { obs, view } of this.obstacles) {
      obs.x -= speed * dt;
      view.x = obs.x;
      // Moving/timed kinds: keep every view on its hitbox — position follows
      // the motion function, visibility/alpha tracks the lethal state.
      switch (obs.kind) {
        case "swing":
          view.y = GROUND_Y - obs.h - swingElev(obs);
          break;
        case "tentacle":
          view.x = obs.x + tentacleSway(obs);
          break;
        case "geyser":
          (view.getData("column") as Phaser.GameObjects.Container).setVisible(geyserActive(obs));
          break;
        case "phantom":
          view.setAlpha(phantomSolid(obs) ? 1 : 0.28);
          break;
        case "vine":
          (view.getData("stalk") as Phaser.GameObjects.Container).scaleY = vineHeight(obs) / obs.h;
          break;
        case "gear":
          view.x = obs.x + gearShift(obs);
          break;
        case "crusher":
          view.y = GROUND_Y - obs.h - crusherElev(obs);
          break;
        case "talon":
          (view.getData("blade") as Phaser.GameObjects.Container).setVisible(talonActive(obs));
          break;
        case "drone":
          view.x = obs.x + droneShift(obs);
          view.y = GROUND_Y - obs.h - droneElev(obs);
          break;
        case "comet":
          view.y = GROUND_Y - obs.h - cometElev(obs);
          break;
        case "reaper":
          (view.getData("blade") as Phaser.GameObjects.Container).setVisible(reaperActive(obs));
          break;
      }
    }
    while (this.obstacles.length > 0 && this.obstacles[0]!.obs.x + this.obstacles[0]!.obs.w < -40) {
      this.obstacles.shift()!.view.destroy();
    }
    this.maybeSpawnPattern(speed);
    this.updatePowerUps(speed, dt, deltaMs);
    this.updateFinish();
    this.updateZones();

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
    this.timerText.setText(`${(this.elapsedMs / 1000).toFixed(1)}s`);
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

  /**
   * Mirror/flip zones: one transform on the track layer. Mirror reflects the
   * view about the canvas center (the cube appears to run right-to-left);
   * flip reflects it about FLIP_PIVOT_Y (the cube runs the ceiling track).
   */
  private updateZones(): void {
    // Portal gates scroll with the track; positioned in track coordinates so
    // the layer transform carries them too.
    for (const { at, view } of this.zoneGates) {
      const x = PLAYER_X + (at - this.distancePx);
      view.x = x;
      view.setVisible(x > -80 && x < WORLD_WIDTH + 80);
    }
    const kind = zoneKindAt(this.distancePx, this.zones);
    if (kind === this.activeZone) return;
    this.activeZone = kind;
    this.trackLayer.setScale(kind === "mirror" ? -1 : 1, kind === "flip" ? -1 : 1);
    this.trackLayer.setPosition(kind === "mirror" ? WORLD_WIDTH : 0, kind === "flip" ? FLIP_PIVOT_Y * 2 : 0);
    const c = Phaser.Display.Color.IntegerToColor(kind ? ZONE_COLORS[kind] : 0xffffff);
    this.cameras.main.flash(220, c.red, c.green, c.blue);
    sfx.clear(kind ? 2 : 1);
  }

  /** One shimmering portal pillar per zone boundary, telegraphed on-track. */
  private buildZoneGates(): void {
    for (const z of this.zones) {
      for (const at of [z.start, z.end]) {
        const color = ZONE_COLORS[z.kind];
        const gate = this.add.container(WORLD_WIDTH + 200, 0);
        gate.add(this.add.rectangle(0, GROUND_Y - 190, 30, 380, color, 0.1).setOrigin(0.5, 0));
        const beam = this.add.rectangle(0, GROUND_Y - 190, 10, 380, color, 0.55).setOrigin(0.5, 0);
        gate.add(beam);
        gate.add(this.add.circle(0, GROUND_Y - 190, 10, color, 0.9));
        this.tweens.add({ targets: beam, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
        gate.setVisible(false);
        this.trackObjects.add(gate);
        this.zoneGates.push({ at, view: gate });
      }
    }
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
    const container = this.add.container(WORLD_WIDTH + 200, 0);
    this.trackObjects.add(container);
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
    const container = this.add.container(p.x, p.y);
    this.trackObjects.add(container);
    const diamond = this.add.rectangle(0, 0, 40, 40, spec.color).setStrokeStyle(4, 0xffffff, 0.9);
    diamond.setAngle(45);
    // Gem facet: lit upper-left wedge gives the pickup depth as it spins.
    const facet = this.add.rectangle(-5, -5, 18, 18, 0xffffff, 0.35).setAngle(45);
    this.tweens.add({ targets: facet, angle: 405, duration: 1800, repeat: -1 });
    const glyph = this.add
      .text(0, 0, "⇈", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "26px",
        color: "#12141c",
      })
      .setOrigin(0.5);
    container.add([diamond, facet, glyph]);
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
    const pattern = pickPattern(this.rng, speed, this.levelNum);
    for (const spec of pattern.obstacles) {
      const obs: Obstacle = {
        x: startX + spec.dx,
        w: spec.w,
        h: spec.h,
        elev: spec.elev ?? 0,
        kind: spec.kind,
        // Seeded rng: motion phases are part of the level's fixed layout.
        phase: KINDS_WITH_PHASE.has(spec.kind) ? this.rng.next() * Math.PI * 2 : 0,
      };
      this.obstacles.push({ obs, view: this.buildObstacleView(obs) });
    }
  }

  private buildObstacleView(obs: Obstacle): Phaser.GameObjects.Container {
    const movingElev =
      obs.kind === "swing" ? swingElev(obs)
      : obs.kind === "crusher" ? crusherElev(obs)
      : obs.kind === "drone" ? droneElev(obs)
      : obs.kind === "comet" ? cometElev(obs)
      : obs.elev;
    const top = GROUND_Y - movingElev - obs.h;
    const container = this.add.container(obs.x, top);
    this.trackObjects.add(container);
    const { w, h } = obs;
    const floating = obs.elev > 0;

    // Shadow falls on the ground below — smaller/fainter for floating
    // objects. Holes, glowing hazards and everything that moves or draws its
    // own contact shading skips the cast shadow; solid statics keep it.
    const noShadow: readonly ObstacleKind[] = [
      "pit", "swing", "laser", "geyser", "tentacle", "arc",
      "phantom", "vine", "gear", "gate", "crusher", "urchin", "talon", "drone", "flare", "comet", "reaper",
    ];
    if (!noShadow.includes(obs.kind)) {
      const shadow = this.add
        .image(w / 2 + 8, h + obs.elev + 7, "shadowtex")
        .setScale(((w + 36) / 96) * (floating ? 0.7 : 1), floating ? 0.55 : 0.8)
        .setAlpha(floating ? 0.3 : 0.55);
      container.add(shadow);
    }

    // Art is shared with the menu's obstacle encyclopedia (obstacleView.ts).
    drawObstacle(this, container, obs.kind, w, h, floating);
    if (obs.kind === "geyser") {
      (container.getData("column") as Phaser.GameObjects.Container).setVisible(
        geyserActive(obs),
      );
    }
    return container;
  }

  private bumpBestPct(pct: number): number {
    const key = `bestPct:${this.levelNum}`;
    const best = Math.max(storage.get(key, 0), pct);
    // God-mode runs never persist — real progress stays exactly as it was.
    if (!godModeOn()) storage.set(key, best);
    return best;
  }

  private completeLevel(): void {
    this.phase = "complete";
    // Crossing the finish counts as the full level, not the floor()ed 99%.
    this.scoreText.setText("100%");
    this.progressFill.setScale(1, 1);
    this.trail.emitting = false;
    this.bumpBestPct(100);
    const unlocked = storage.get("unlockedLevel", 1);
    if (!godModeOn() && this.levelNum + 1 > unlocked) {
      storage.set("unlockedLevel", this.levelNum + 1);
    }
    sfx.clear(4);
    stopAllMusic();
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
        .text(width / 2, height * 0.44, `Level ${this.levelNum} cleared in ${(this.elapsedMs / 1000).toFixed(1)}s\nLevel ${this.levelNum + 1} unlocked!`, {
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
    stopAllMusic();
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
    if (!storage.get("musicMuted", false)) this.bgm.start();
  }
}
