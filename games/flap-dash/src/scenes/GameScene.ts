import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import {
  GATE_SPACING_PX,
  GATE_WIDTH,
  PLAYER_RADIUS,
  PLAYER_X,
  WORLD_HEIGHT,
  flap,
  hitsGate,
  makeGate,
  outOfBounds,
  speedForScore,
  stepPlayer,
} from "../logic/flight";
import type { Gate, PlayerState } from "../logic/flight";
import { adsReady } from "../ads";
import { storage } from "./MenuScene";

const WORLD_WIDTH = 720;
const GATE_COLOR = 0x66bb6a;
const REVIVE_INVULN_MS = 1500;
/** Cap dt so a background tab doesn't teleport the player on resume. */
const MAX_DT_MS = 50;

interface GateView {
  gate: Gate;
  top: Phaser.GameObjects.Rectangle;
  bottom: Phaser.GameObjects.Rectangle;
}

type Phase = "ready" | "playing" | "dead";

export class GameScene extends Phaser.Scene {
  private player!: PlayerState;
  private playerView!: Phaser.GameObjects.Container;
  private gates: GateView[] = [];
  private rng!: Rng;
  private phase: Phase = "ready";
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private readyText: Phaser.GameObjects.Text | null = null;
  private usedContinue = false;
  private invulnMs = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.player = { y: WORLD_HEIGHT / 2, vy: 0 };
    this.gates = [];
    this.rng = new Rng();
    this.phase = "ready";
    this.score = 0;
    this.usedContinue = false;
    this.invulnMs = 0;

    // Hazard strips make the kill bounds visible.
    this.add.rectangle(0, 0, WORLD_WIDTH, 14, 0xef5350).setOrigin(0).setDepth(5);
    this.add
      .rectangle(0, WORLD_HEIGHT - 14, WORLD_WIDTH, 14, 0xef5350)
      .setOrigin(0)
      .setDepth(5);

    this.playerView = this.add.container(PLAYER_X, this.player.y, [
      this.add.circle(0, 0, PLAYER_RADIUS, 0xffca28),
      this.add.circle(10, -8, 6, 0xffffff),
      this.add.circle(12, -8, 3, 0x12141c),
    ]);
    this.playerView.setDepth(10);

    this.scoreText = this.add
      .text(WORLD_WIDTH / 2, 110, "0", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "84px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.readyText = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.62, "TAP TO FLAP", {
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

    this.input.on("pointerdown", () => this.onTap());
    this.input.keyboard?.on("keydown-SPACE", () => this.onTap());
  }

  private onTap(): void {
    if (this.phase === "ready") {
      this.phase = "playing";
      this.readyText?.destroy();
      this.readyText = null;
      flap(this.player);
      return;
    }
    if (this.phase === "playing") flap(this.player);
  }

  override update(_time: number, deltaMs: number): void {
    if (this.phase !== "playing") return;
    const dt = Math.min(deltaMs, MAX_DT_MS) / 1000;

    stepPlayer(this.player, dt);
    this.playerView.y = this.player.y;
    this.playerView.rotation = Phaser.Math.Clamp(this.player.vy / 1400, -0.5, 0.9);

    const speed = speedForScore(this.score);
    for (const view of this.gates) {
      view.gate.x -= speed * dt;
      view.top.x = view.gate.x;
      view.bottom.x = view.gate.x;
    }

    const last = this.gates[this.gates.length - 1];
    if (!last || last.gate.x < WORLD_WIDTH - GATE_SPACING_PX) {
      this.spawnGate();
    }
    while (this.gates.length > 0 && this.gates[0]!.gate.x + GATE_WIDTH < -20) {
      const gone = this.gates.shift()!;
      gone.top.destroy();
      gone.bottom.destroy();
    }

    for (const view of this.gates) {
      if (!view.gate.scored && view.gate.x + GATE_WIDTH < PLAYER_X - PLAYER_RADIUS) {
        view.gate.scored = true;
        this.score++;
        this.scoreText.setText(String(this.score));
        sfx.clear(1);
        if (this.score % 10 === 0) {
          floatBanner(this, `${this.score}!`, WORLD_HEIGHT * 0.35, "64px", "#ffca28");
        }
      }
    }

    if (this.invulnMs > 0) {
      this.invulnMs -= deltaMs;
      this.playerView.setAlpha(Math.sin(_time / 50) > 0 ? 0.4 : 1);
      // Keep the revived player inside the world instead of killing them.
      this.player.y = Phaser.Math.Clamp(
        this.player.y,
        PLAYER_RADIUS + 14,
        WORLD_HEIGHT - PLAYER_RADIUS - 14,
      );
      if (this.invulnMs <= 0) this.playerView.setAlpha(1);
      return;
    }

    if (outOfBounds(this.player.y) || this.gates.some((v) => hitsGate(this.player.y, v.gate))) {
      this.die();
    }
  }

  private spawnGate(): void {
    const gate = makeGate(this.rng, this.score, WORLD_WIDTH + 20);
    const gapTop = gate.gapCenter - gate.gapHeight / 2;
    const gapBottom = gate.gapCenter + gate.gapHeight / 2;
    const top = this.add.rectangle(gate.x, 0, GATE_WIDTH, gapTop, GATE_COLOR).setOrigin(0);
    const bottom = this.add
      .rectangle(gate.x, gapBottom, GATE_WIDTH, WORLD_HEIGHT - gapBottom, GATE_COLOR)
      .setOrigin(0);
    this.gates.push({ gate, top, bottom });
  }

  private die(): void {
    this.phase = "dead";
    sfx.gameOver();
    const best = storage.bumpHighScore(this.score);
    void adsReady.then((ads) => ads.maybeShowInterstitial());

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0));
    overlay.add(
      this.add
        .text(width / 2, height * 0.3, "GAME OVER", {
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
          `Score: ${this.score}\n${this.score >= best && this.score > 0 ? "New best!" : `Best: ${best}`}`,
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
              "🎬  KEEP FLYING (AD)",
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

  /** Rewarded-ad revive: clear nearby gates and grant brief invulnerability. */
  private revive(overlay: Phaser.GameObjects.Container): void {
    this.usedContinue = true;
    overlay.destroy();
    this.gates = this.gates.filter((view) => {
      const near = view.gate.x < PLAYER_X + 420;
      if (near) {
        view.top.destroy();
        view.bottom.destroy();
      }
      return !near;
    });
    this.player.y = WORLD_HEIGHT / 2;
    this.player.vy = 0;
    this.invulnMs = REVIVE_INVULN_MS;
    this.phase = "playing";
  }
}
