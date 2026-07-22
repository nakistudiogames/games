import Phaser from "phaser";
import { Rng, haptics, sfx } from "@mg/core";
import type { MusicPlayer } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import {
  BOOST_FOOTPRINT,
  PAD_LANDING_GRACE_MS,
  DASH_LENGTH_PX,
  DASH_MUL,
  GROUND_Y,
  KINDS_WITH_PHASE,
  MIRROR_MIN_LEVEL,
  PAD_FLIGHT_SPEED_MUL,
  PAD_JUMP_VELOCITY,
  SLOWMO_MUL,
  PLAYER_SIZE,
  PLAYER_X,
  POWER_UPS,
  checkDeath,
  collectsPowerUp,
  cometElev,
  crusherElev,
  cycloneSway,
  droneElev,
  droneShift,
  fluxOn,
  gearShift,
  geyserActive,
  isFinaleLevel,
  jump,
  levelColor,
  levelDurationSec,
  levelGapScale,
  levelLengthM,
  levelSeed,
  levelSpeed,
  makePowerUp,
  minGapPx,
  nearMiss,
  novaSatPos,
  pendulShift,
  phantomSolid,
  pickPattern,
  powerUpGapPx,
  reaperActive,
  specterSolid,
  stepRunner,
  supportAt,
  swingElev,
  talonActive,
  tentacleSway,
  wispElev,
  trackBoosts,
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
  TrackBoost,
  TrackZone,
  TrackZoneKind,
} from "../logic/runner";
import { adsReady } from "../ads";
import { newlyEarned } from "../achievements";
import { leaderboard } from "../leaderboard";
import { saves } from "../account";
import { characterById } from "../characters";
import { TRAIL_AIR_BOOST, attachAura, buildCharacterParts, buildCharacterTrail } from "../characterView";
import { musicForLevel, stopAllMusic } from "../music";
import { drawObstacle } from "../obstacleView";
import {
  BOOST_PREVIEW,
  ZONE_COLORS,
  ZONE_GATE_SIZE,
  buildBoostView,
  buildPickupView,
  buildZoneGateView,
} from "../trackView";
import { ensureWorldTextures } from "../worldView";
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

interface ObstacleView {
  obs: Obstacle;
  view: Phaser.GameObjects.Container;
  /** Player entered this obstacle's graze band without dying. */
  grazed?: boolean;
  /** Near-miss celebration already paid out for this obstacle. */
  rewarded?: boolean;
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
  /** Scenery (sky/stars/silhouettes/haze) — mirrors/flips with the zones. */
  private bgLayer!: Phaser.GameObjects.Container;
  /** Sub-container for spawned views (obstacles/pickups/finish/gates). */
  private trackObjects!: Phaser.GameObjects.Container;
  private zones: TrackZone[] = [];
  private activeZone: TrackZoneKind | null = null;
  private zoneGates: Array<{ at: number; view: Phaser.GameObjects.Container }> = [];
  private attemptText: Phaser.GameObjects.Text | null = null;
  private squashTween: Phaser.Tweens.Tween | null = null;
  private shieldMs = 0;
  private slowmoMs = 0;
  private shieldRing!: Phaser.GameObjects.Arc;
  private boosts: Array<{ b: TrackBoost; view: Phaser.GameObjects.Container; used: boolean }> = [];
  /** Dash-strip effect runs until distancePx crosses this. */
  private dashUntilPx = -1;
  /** Mid-pad-launch: world streams at PAD_FLIGHT_SPEED_MUL, one free air jump. */
  private padFlight = false;
  /** Buttons on the death overlay — taps anywhere else instantly retry. */
  private deadButtons: Phaser.GameObjects.Container[] = [];
  private retryReadyAt = 0;
  private rng!: Rng;
  private phase: Phase = "ready";
  private distancePx = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private metersText!: Phaser.GameObjects.Text;
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

    this.deadButtons = [];
    this.retryReadyAt = 0;
    this.squashTween = null;
    this.shieldMs = 0;
    this.slowmoMs = 0;
    this.boosts = [];
    this.dashUntilPx = -1;
    this.padFlight = false;

    sfx.setMuted(storage.get("sfxMuted", false));
    haptics.setEnabled(!storage.get("hapticsOff", false));

    // Attempt bookkeeping (GD-style): every run of a level counts.
    const attempts = storage.get(`attempts:${this.levelNum}`, 0) + 1;
    storage.set(`attempts:${this.levelNum}`, attempts);
    storage.set("totalAttempts", storage.get("totalAttempts", 0) + 1);

    this.ensureTextures();
    // The track layer sits above the scenery and below the HUD (20+);
    // children render in add order, so build order = draw order. The
    // scenery gets its own layer so zone mirror/flip carries it too.
    this.bgLayer = this.add.container(0, 0).setDepth(0);
    this.trackLayer = this.add.container(0, 0).setDepth(4);
    this.buildBackground();
    this.buildPlayer();
    this.buildZoneGates();
    this.buildBoosts();
    this.buildHud();

    // "ATTEMPT N" tag sits on the track and scrolls away with it (the
    // TAP TO START block lives higher up, clear of it).
    this.attemptText = this.add
      .text(WORLD_WIDTH / 2, GROUND_Y - 320, `ATTEMPT ${attempts}`, {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "56px",
        color: this.levelColorHex(this.levelNum),
      })
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setShadow(0, 5, "#000000", 6, false, true);
    this.trackObjects.add(this.attemptText);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.phase === "dead") {
        this.tryInstantRetry(p);
        return;
      }
      if (this.muteButton.getBounds().contains(p.x, p.y)) return;
      if (this.pauseButton.getBounds().contains(p.x, p.y)) return;
      this.onTap();
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.phase === "dead") this.tryInstantRetry(null);
      else this.onTap();
    });
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

  /** Tap anywhere (but a button) on the death screen = instant restart. */
  private tryInstantRetry(p: Phaser.Input.Pointer | null): void {
    if (this.time.now < this.retryReadyAt) return; // swallow the death-mash
    if (p && this.deadButtons.some((b) => b.getBounds().contains(p.x, p.y))) return;
    this.scene.restart({ level: this.levelNum });
  }

  /** Squash/stretch punch on the player body; resolves back to 1:1. */
  private punchScale(sx: number, sy: number): void {
    this.squashTween?.stop();
    this.playerView.setScale(sx, sy);
    this.squashTween = this.tweens.add({
      targets: this.playerView,
      scaleX: 1,
      scaleY: 1,
      duration: 130,
      ease: "Back.easeOut",
    });
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
    const sfxMuted = storage.get("sfxMuted", false);
    overlay.add(
      textButton(
        this,
        width / 2,
        height * 0.83,
        sfxMuted ? "🔇  SFX OFF" : "🔊  SFX ON",
        { text: sfxMuted ? "#5c667d" : "#8a93a8", background: "#181d2b" },
        () => {
          storage.set("sfxMuted", !sfxMuted);
          sfx.setMuted(!sfxMuted);
          // Rebuild the overlay so the label reflects the new state.
          this.pauseOverlay?.destroy();
          this.pauseGame();
        },
        "36px",
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
    ensureWorldTextures(this, this.world);
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
  }

  private buildBackground(): void {
    const accent = levelColor(this.levelNum);

    const sky = this.add.graphics();
    sky.fillGradientStyle(this.world.skyTop, this.world.skyTop, this.world.skyBottomA, this.world.skyBottomB, 1);
    sky.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);

    const silKey = `sil-${this.world.id}`;
    this.bgFar = this.add
      .tileSprite(0, 0, WORLD_WIDTH, GROUND_Y, "stars")
      .setOrigin(0)
      .setAlpha(0.7);
    this.bgMid = this.add
      .tileSprite(0, GROUND_Y - 320, WORLD_WIDTH, 320, silKey)
      .setOrigin(0)
      .setAlpha(0.55); // atmospheric haze pushes the silhouette into the distance
    // Extra depth layer appears as the levels progress.
    this.bgMid2 = null;
    if ((this.levelNum - 1) % 5 >= 2) {
      // Third level of each world onward gains a second, more distant layer.
      this.bgMid2 = this.add
        .tileSprite(0, GROUND_Y - 545, WORLD_WIDTH, 224, silKey)
        .setOrigin(0)
        .setAlpha(0.3);
      this.bgMid2.setTileScale(0.7);
    }

    const haze = this.add.graphics();
    haze.fillGradientStyle(this.world.haze, this.world.haze, this.world.haze, this.world.haze, 0, 0, 0.35, 0.35);
    haze.fillRect(0, GROUND_Y - 320, WORLD_WIDTH, 320);

    // Whole scenery stack in one layer (paint order = old depth order 0-3)
    // so zone mirror/flip transforms it in lockstep with the track.
    this.bgLayer.add([
      sky,
      this.bgFar,
      ...(this.bgMid2 ? [this.bgMid2] : []),
      this.bgMid,
      haze,
    ]);

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
    this.shieldRing = this.add
      .circle(0, 0, s / 2 + 18)
      .setStrokeStyle(4, 0x4dd0e1, 0.85)
      .setVisible(false);
    this.playerView = this.add.container(PLAYER_X + s / 2, GROUND_Y - s / 2, [
      this.aura,
      this.shieldRing,
      ...buildCharacterParts(this, spec, s),
    ]);
    attachAura(this, this.playerView, spec, s);

    this.playerShadow = this.add.image(PLAYER_X + s / 2, GROUND_Y + 9, "shadowtex");

    // Signature per-character running trail (streaks/embers/bubbles/...),
    // streaming at this level's track speed so it lays along the ground.
    this.trail = buildCharacterTrail(this, this.playerView, spec, 1, levelSpeed(this.levelNum));

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

    // Distance run, mirroring the timer on the other side of the %.
    this.metersText = this.add
      .text(WORLD_WIDTH / 2 - 145, 110, "0m", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#8a93a8",
      })
      .setOrigin(1, 0.5)
      .setDepth(20);
    this.metersText.setShadow(0, 4, "#000000", 6, false, true);

    this.levelText = this.add
      .text(WORLD_WIDTH / 2, 172, `LEVEL ${this.levelNum}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        color: hex,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.levelText.setShadow(0, 4, "#000000", 6, false, true);
    if (isFinaleLevel(this.levelNum)) {
      this.add
        .text(WORLD_WIDTH / 2, 210, "★ FINALE ★", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "26px",
          color: "#ffd700",
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setShadow(0, 3, "#000000", 5, false, true);
    }

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
      .text(WORLD_WIDTH / 2, 460, `${this.world.name}\nLEVEL ${this.levelNum}\nTAP TO START`, {
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
    // One free air jump during a pad flight (besides the power-up's).
    const kind = tryJump(this.runner, this.doubleJumpMs > 0 || this.padFlight);
    if (kind === "ground") {
      sfx.place();
      haptics.tap();
      this.punchScale(0.86, 1.14); // take-off stretch
    } else if (kind === "air") {
      sfx.clear(1);
      haptics.tap();
      this.sparkle.explode(10, this.playerView.x, this.playerView.y + PLAYER_SIZE / 2);
    } else {
      this.jumpBufferMs = JUMP_BUFFER_MS;
    }
  }

  override update(time: number, deltaMs: number): void {
    if (this.phase !== "playing") return;
    this.elapsedMs += deltaMs;
    const dt = Math.min(deltaMs, MAX_DT_MS) / 1000;
    const baseSpeed = levelSpeed(this.levelNum);
    const dashing = this.distancePx < this.dashUntilPx;
    const speed =
      baseSpeed * (this.padFlight ? PAD_FLIGHT_SPEED_MUL : dashing ? DASH_MUL : 1);
    // Slow-mo scales the whole simulation clock (scroll AND physics), so
    // jump trajectories in px are unchanged and clearability is preserved.
    const simDt = dt * (this.slowmoMs > 0 ? SLOWMO_MUL : 1);
    this.distancePx += speed * simDt;

    // Parallax: far stars drift, skyline rolls, ground grid matches the track.
    this.bgFar.tilePositionX += speed * simDt * 0.12;
    if (this.bgMid2) this.bgMid2.tilePositionX += speed * simDt * 0.22;
    this.bgMid.tilePositionX += speed * simDt * 0.4;
    this.groundTile.tilePositionX += speed * simDt;

    for (const { obs, view } of this.obstacles) {
      obs.x -= speed * simDt;
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
        case "wisp":
          view.y = GROUND_Y - obs.h - wispElev(obs);
          break;
        case "flux":
          view.setAlpha(fluxOn(obs) ? 1 : 0.3);
          break;
        case "pendul":
          view.x = obs.x + pendulShift(obs);
          break;
        case "cyclone":
          view.x = obs.x + cycloneSway(obs);
          break;
        case "specter":
          view.setAlpha(specterSolid(obs) ? 1 : 0.25);
          break;
        case "nova": {
          const sat = novaSatPos(obs);
          (view.getData("satellite") as Phaser.GameObjects.Container).setPosition(
            obs.w / 2 + sat.dx,
            obs.h / 2 + sat.dy,
          );
          break;
        }
      }
    }
    while (this.obstacles.length > 0 && this.obstacles[0]!.obs.x + this.obstacles[0]!.obs.w < -40) {
      this.obstacles.shift()!.view.destroy();
    }
    if (this.attemptText) {
      this.attemptText.x -= speed * simDt;
      if (this.attemptText.x < -240) {
        this.attemptText.destroy();
        this.attemptText = null;
      }
    }

    // Spawning always uses the BASE speed: pattern choice and gap sizing must
    // be a pure function of track distance, or a collected slow-mo/dash would
    // change the layout and break the identical-every-attempt guarantee.
    this.maybeSpawnPattern(baseSpeed);
    this.updatePowerUps(speed, simDt, deltaMs);
    this.updateFinish();
    this.updateZones();
    this.updateBoosts(speed);

    const obsList = this.obstacles.map((o) => o.obs);
    const wasAirborne = !this.runner.grounded;
    stepRunner(this.runner, simDt, supportAt(this.runner.y, obsList));
    if (this.runner.grounded && this.padFlight) {
      // Flight ends on touchdown, with a short grace to clear the landing.
      this.padFlight = false;
      this.invulnMs = Math.max(this.invulnMs, PAD_LANDING_GRACE_MS);
    }
    // Trail burns hotter while airborne (only touch frequency on the
    // transition — setFrequency resets the emitter's flow counter).
    if (!this.runner.grounded !== wasAirborne) {
      const baseFreq = this.trail.getData("baseFrequency") as number;
      this.trail.setFrequency(this.runner.grounded ? baseFreq : baseFreq / TRAIL_AIR_BOOST);
    }
    if (this.runner.grounded && wasAirborne) {
      this.playerView.rotation = Math.round(this.playerView.rotation / (Math.PI / 2)) * (Math.PI / 2);
      this.dust.explode(6, this.playerView.x, this.runner.y - 4);
      // Landing feel lives on the CUBE only (squash + dust) — camera kicks
      // on landings read as the world wobbling and were removed per user.
      this.punchScale(1.18, 0.82);
      if (this.jumpBufferMs > 0) {
        jump(this.runner);
        sfx.place();
        this.punchScale(0.86, 1.14);
      }
    }
    this.jumpBufferMs = Math.max(0, this.jumpBufferMs - deltaMs);
    if (!this.runner.grounded) this.playerView.rotation += 6 * simDt;
    this.playerView.y = this.runner.y - PLAYER_SIZE / 2;

    // Ground shadow shrinks and fades as the cube gains height.
    const airHeight = GROUND_Y - this.runner.y;
    const shadowF = Math.max(0.25, 1 - airHeight / 500);
    this.playerShadow.setScale(1.25 * shadowF, shadowF).setAlpha(0.35 + 0.45 * shadowF);

    this.scoreText.setText(`${this.progressPct()}%`);
    this.timerText.setText(`${(this.elapsedMs / 1000).toFixed(1)}s`);
    this.metersText.setText(`${Math.floor(this.distancePx / 10)}m`);
    this.progressFill.setScale(Math.min(1, this.distancePx / this.levelLengthPx), 1);

    // Music builds with the run: sparse start, hat joins at 33%, full at 66%.
    const prog = this.distancePx / this.levelLengthPx;
    this.bgm.setVoiceGain("hat", prog >= 0.33 ? 1 : 0);
    this.bgm.setVoiceGain("lead", prog >= 0.66 ? 1 : prog >= 0.33 ? 0.85 : 0.6);

    if (this.remainingPx() <= 40) {
      this.completeLevel();
      return;
    }

    if (this.padFlight) return; // untouchable for the whole cannon flight
    if (this.invulnMs > 0) {
      this.invulnMs -= deltaMs;
      this.playerView.setAlpha(Math.sin(time / 50) > 0 ? 0.4 : 1);
      if (this.invulnMs <= 0) this.playerView.setAlpha(1);
      return;
    }
    if (checkDeath(this.runner.y, obsList)) {
      if (this.shieldMs > 0) {
        // The shield takes the hit: break it, blink through, keep running.
        this.shieldMs = 0;
        this.invulnMs = 800;
        storage.set("shieldSaves", storage.get("shieldSaves", 0) + 1);
        sfx.clear(3);
        this.sparkle.explode(18, this.playerView.x, this.playerView.y);
        floatBanner(this, "⛨ SAVED!", 520, "56px", "#4dd0e1");
      } else {
        this.die();
      }
      return;
    }
    // Near-miss: mark obstacles grazed, celebrate once safely past them.
    for (const ov of this.obstacles) {
      if (!ov.grazed && nearMiss(this.runner.y, [ov.obs])) ov.grazed = true;
      if (ov.grazed && !ov.rewarded && ov.obs.x + ov.obs.w < PLAYER_X) {
        ov.rewarded = true;
        this.sparkle.explode(8, ov.obs.x + ov.obs.w / 2, this.playerView.y);
        sfx.place();
        storage.set("nearMisses", storage.get("nearMisses", 0) + 1);
      }
    }
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
    // Track AND scenery share the reflection, so the whole world reverses/
    // flips together (background parallax streams the mirrored way too).
    for (const layer of [this.trackLayer, this.bgLayer]) {
      layer.setScale(kind === "mirror" ? -1 : 1, kind === "flip" ? -1 : 1);
      layer.setPosition(kind === "mirror" ? WORLD_WIDTH : 0, kind === "flip" ? FLIP_PIVOT_Y * 2 : 0);
    }
    const c = Phaser.Display.Color.IntegerToColor(kind ? ZONE_COLORS[kind] : 0xffffff);
    this.cameras.main.flash(220, c.red, c.green, c.blue);
    sfx.clear(kind ? 2 : 1);
  }

  /** One shimmering portal pillar per zone boundary, telegraphed on-track. */
  private buildZoneGates(): void {
    for (const z of this.zones) {
      for (const at of [z.start, z.end]) {
        const gate = this.add.container(WORLD_WIDTH + 200, 0);
        // Shared art (trackView) — the guide previews the identical pillar.
        const pillar = buildZoneGateView(this, z.kind);
        pillar.setPosition(-ZONE_GATE_SIZE.w / 2, GROUND_Y - 190);
        gate.add(pillar);
        gate.setVisible(false);
        this.trackObjects.add(gate);
        this.zoneGates.push({ at, view: gate });
      }
    }
  }

  /** Launch pads and dash strips: helper track elements, never hazards. */
  private buildBoosts(): void {
    for (const b of trackBoosts(this.levelNum, this.levelLengthPx)) {
      const view = this.add.container(WORLD_WIDTH + 400, 0).setVisible(false);
      // Shared art (trackView) — the guide previews the identical element.
      const { w, h } = BOOST_PREVIEW[b.kind];
      const art = buildBoostView(this, b.kind);
      art.setPosition(-w / 2, GROUND_Y - h);
      view.add(art);
      this.trackObjects.add(view);
      this.boosts.push({ b, view, used: false });
    }
  }

  private updateBoosts(speed: number): void {
    for (const bo of this.boosts) {
      let x = PLAYER_X + (bo.b.at - this.distancePx);
      // Seeded boost placements don't know the obstacle layout — slide any
      // boost that would sit on/next to a hazard further down the track
      // until it lands in a gap. Layouts are deterministic, so the settled
      // spot is identical every run (mirrored in test/levelSim.ts).
      if (!bo.used && x > -100 && x < WORLD_WIDTH + 300) {
        const half = BOOST_FOOTPRINT[bo.b.kind] / 2 + 30;
        while (this.obstacles.some(({ obs }) => obs.x < x + half && obs.x + obs.w > x - half)) {
          bo.b.at += 40;
          x += 40;
          if (bo.b.at > this.levelLengthPx - CLEAR_RUNWAY_PX - 400) {
            // No room left before the finish runway — retire this boost.
            bo.used = true;
            bo.b.at = this.levelLengthPx + 100_000;
            x = PLAYER_X + (bo.b.at - this.distancePx);
            break;
          }
        }
      }
      bo.view.x = x;
      bo.view.setVisible(x > -300 && x < WORLD_WIDTH + 300);
      if (bo.used || this.distancePx < bo.b.at) continue;
      bo.used = true;
      if (bo.b.kind === "strip") {
        this.dashUntilPx = bo.b.at + DASH_LENGTH_PX;
        sfx.clear(2);
        this.sparkle.explode(12, this.playerView.x, this.playerView.y);
      } else if (this.runner.grounded) {
        // CANNON SHOT — pads always fire when run over. The world streams
        // past at PAD_FLIGHT_SPEED_MUL until touchdown, and the player
        // keeps one free mid-air jump to steer the landing.
        this.runner.vy = PAD_JUMP_VELOCITY;
        this.runner.grounded = false;
        this.runner.coyoteMs = 0;
        this.runner.airJumpUsed = false;
        this.padFlight = true;
        sfx.clear(2);
        haptics.tap();
        this.punchScale(0.7, 1.3);
        this.dust.explode(14, this.playerView.x, GROUND_Y - 4);
        this.sparkle.explode(10, this.playerView.x, this.playerView.y);
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
    // Finale gates are gold — the world's crowning run.
    const accent = isFinaleLevel(this.levelNum) ? 0xffd700 : levelColor(this.levelNum);
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
        const p = makePowerUp(this.rng, x, this.levelNum);
        this.powerUps.push({ p, view: this.buildPowerUpView(p) });
        this.nextPowerUpAt = this.distancePx + powerUpGapPx(this.rng);
      }
    }

    // Tick down active effects and rebuild the badge column.
    this.doubleJumpMs = Math.max(0, this.doubleJumpMs - deltaMs);
    this.shieldMs = Math.max(0, this.shieldMs - deltaMs);
    this.slowmoMs = Math.max(0, this.slowmoMs - deltaMs);
    const badges: string[] = [];
    if (this.doubleJumpMs > 0) badges.push(`⇈ ${Math.ceil(this.doubleJumpMs / 1000)}s`);
    if (this.shieldMs > 0) badges.push(`⛨ ${Math.ceil(this.shieldMs / 1000)}s`);
    if (this.slowmoMs > 0) badges.push(`⏳ ${Math.ceil(this.slowmoMs / 1000)}s`);
    this.powerBadge.setText(badges.join("\n"));
    this.aura.setVisible(this.doubleJumpMs > 0);
    if (this.doubleJumpMs > 0) this.aura.setAlpha(0.2 + 0.12 * Math.sin(this.time.now / 110));
    this.shieldRing.setVisible(this.shieldMs > 0);
    if (this.shieldMs > 0) {
      this.shieldRing.setAlpha(this.shieldMs < 3000 ? 0.35 + 0.5 * Math.abs(Math.sin(this.time.now / 90)) : 0.85);
    }
  }

  private collectPowerUp(p: PowerUp): void {
    const spec = POWER_UPS[p.kind];
    if (p.kind === "doubleJump") {
      this.doubleJumpMs = spec.durationMs;
    } else if (p.kind === "shield") {
      this.shieldMs = spec.durationMs;
    } else {
      this.slowmoMs = spec.durationMs;
      storage.set("slowmoUses", storage.get("slowmoUses", 0) + 1);
    }
    sfx.clear(2);
    this.sparkle.explode(16, PLAYER_X + PLAYER_SIZE / 2, p.y);
    floatBanner(this, `${spec.label}!`, 520, "60px", `#${spec.color.toString(16).padStart(6, "0")}`);
  }

  private buildPowerUpView(p: PowerUp): Phaser.GameObjects.Container {
    // Shared art (trackView) — the guide previews the identical gem.
    const container = this.add.container(p.x, p.y, [buildPickupView(this, p.kind)]);
    this.trackObjects.add(container);
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
      : obs.kind === "wisp" ? wispElev(obs)
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
      // Air hazards: all floating/glowing — no cast shadows.
      "halo", "wisp", "lance", "swarm", "flux", "pendul", "rails", "cyclone", "specter", "nova",
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
    haptics.win();
    stopAllMusic();
    this.sparkle.explode(30, this.playerView.x, this.playerView.y);
    if (isFinaleLevel(this.levelNum)) {
      // World finale: proper confetti send-off.
      for (const [delay, x] of [[200, 200], [400, 520], [650, 360]] as const) {
        this.time.delayedCall(delay, () => this.sparkle.explode(24, x, 400 + Math.random() * 200));
      }
    }
    void adsReady.then((ads) => ads.maybeShowInterstitial());
    storage.set("totalClears", storage.get("totalClears", 0) + 1);
    storage.set("totalPlayMs", storage.get("totalPlayMs", 0) + this.elapsedMs);
    storage.set("totalMeters", storage.get("totalMeters", 0) + levelLengthM(this.levelNum));
    if (levelDurationSec(this.levelNum) >= 45 && !this.usedContinue) {
      storage.set("longNoRevive", true);
    }
    this.toastAchievements();

    // Leaderboard: record + submit the best clear time (never in god mode).
    let improvedTime = false;
    if (!godModeOn()) {
      const timeKey = `bestTimeMs:${this.levelNum}`;
      const prevBest = storage.get(timeKey, 0);
      const timeMs = Math.round(this.elapsedMs);
      if (prevBest <= 0 || timeMs < prevBest) {
        improvedTime = true;
        storage.set(timeKey, timeMs);
        const lb = leaderboard();
        void lb
          .submitLevel(this.levelNum, timeMs)
          .then(() => lb.submitOverall())
          .catch(() => {});
      }
    }
    // Cloud save: persist the new progress to the account (dirty-retried).
    void saves.push();

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

    if (improvedTime) {
      floatBanner(this, "NEW BEST TIME!", 300, "52px", "#80deea", 120);
      // World rank arrives async; skip silently when offline/unconfigured.
      const rankText = this.add
        .text(width / 2, height * 0.51, "", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "34px",
          color: "#ffd700",
        })
        .setOrigin(0.5);
      overlay.add(rankText);
      void leaderboard()
        .myLevelRank(this.levelNum)
        .then((rank) => {
          if (rank && rankText.active) rankText.setText(`🌍 WORLD RANK #${rank}`);
        })
        .catch(() => {});
    }
  }

  private die(): void {
    this.phase = "dead";
    this.trail.emitting = false;
    stopAllMusic();
    // Freeze-frame: hold the crash pose a beat, THEN detonate — the pause
    // makes the explosion land harder (ported from the Unity v2 feel pass).
    this.time.delayedCall(80, () => this.explodeAndShowDeathOverlay());
  }

  private explodeAndShowDeathOverlay(): void {
    this.burst.explode(28, this.playerView.x, this.playerView.y);
    this.playerView.setVisible(false);
    this.playerShadow.setVisible(false);
    this.aura.setVisible(false);
    this.powerBadge.setText("");
    sfx.gameOver();
    haptics.thud();
    this.cameras.main.shake(180, 0.012);
    // Zoom punch: a quick push-in sells the impact.
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.06,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    const pct = this.progressPct();
    const best = this.bumpBestPct(pct);
    void adsReady.then((ads) => ads.maybeShowInterstitial());
    storage.set("totalDeaths", storage.get("totalDeaths", 0) + 1);
    storage.set("totalPlayMs", storage.get("totalPlayMs", 0) + this.elapsedMs);
    storage.set("totalMeters", storage.get("totalMeters", 0) + Math.floor(this.distancePx / 10));
    this.toastAchievements();
    this.deadButtons = [];
    this.retryReadyAt = this.time.now + 400; // swallow panic taps

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

    const retryBtn = textButton(
      this,
      width / 2,
      height * 0.56,
      "↻  RETRY",
      { text: "#a5d6a7", background: "#1e3320" },
      () => this.scene.restart({ level: this.levelNum }),
    );
    const menuBtn = textButton(
      this,
      width / 2,
      height * 0.75,
      "☰  MENU",
      { text: "#90caf9", background: "#16283d" },
      () => this.scene.start("menu"),
      "40px",
    );
    overlay.add([retryBtn, menuBtn]);
    this.deadButtons.push(retryBtn, menuBtn);
    overlay.add(
      this.add
        .text(width / 2, height * 0.85, "or tap anywhere to retry", {
          fontFamily: "Arial, sans-serif",
          fontSize: "30px",
          color: "#5c667d",
        })
        .setOrigin(0.5),
    );

    if (!this.usedContinue) {
      void adsReady.then((ads) => {
        if (this.phase === "dead" && ads.isRewardedReady()) {
          const adBtn = textButton(
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
          );
          overlay.add(adBtn);
          this.deadButtons.push(adBtn);
        }
      });
    }
  }

  /** Toast any achievements this run just unlocked, above the end overlay. */
  private toastAchievements(): void {
    newlyEarned(storage).forEach((a, i) => {
      this.time.delayedCall(500 + i * 950, () =>
        floatBanner(this, `🏆 ${a.name}`, 180, "48px", "#ffd54f", 120),
      );
    });
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
    this.squashTween?.stop();
    this.playerView.setScale(1, 1);
    this.playerView.rotation = 0;
    this.playerView.setVisible(true);
    this.playerShadow.setVisible(true);
    this.trail.emitting = true;
    // Revive skips the landing transition — drop any airborne trail boost.
    this.trail.setFrequency(this.trail.getData("baseFrequency") as number);
    this.invulnMs = REVIVE_INVULN_MS;
    this.phase = "playing";
    if (!storage.get("musicMuted", false)) this.bgm.start();
  }
}
