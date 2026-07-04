import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import { Grid, GRID_SIZE } from "../logic/grid";
import type { Direction } from "../logic/grid";
import { adsReady } from "../ads";
import { storage } from "./MenuScene";

const CELL = 150;
const GAP = 16;
const GRID_X = 20;
const GRID_Y = 320;
const SWIPE_MIN_PX = 60;
const SLIDE_MS = 90;

/** Tile fill color and label color by value; values above 2048 share one style. */
const TILE_STYLE: Record<number, { fill: number; text: string }> = {
  2: { fill: 0xeee4da, text: "#776e65" },
  4: { fill: 0xede0c8, text: "#776e65" },
  8: { fill: 0xf2b179, text: "#ffffff" },
  16: { fill: 0xf59563, text: "#ffffff" },
  32: { fill: 0xf67c5f, text: "#ffffff" },
  64: { fill: 0xf65e3b, text: "#ffffff" },
  128: { fill: 0xedcf72, text: "#ffffff" },
  256: { fill: 0xedcc61, text: "#ffffff" },
  512: { fill: 0xedc850, text: "#ffffff" },
  1024: { fill: 0xedc53f, text: "#ffffff" },
  2048: { fill: 0xedc22e, text: "#ffffff" },
};
const BIG_TILE_STYLE = { fill: 0x3c3a32, text: "#ffffff" };

function cellCenter(r: number, c: number): { x: number; y: number } {
  return {
    x: GRID_X + GAP + c * (CELL + GAP) + CELL / 2,
    y: GRID_Y + GAP + r * (CELL + GAP) + CELL / 2,
  };
}

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private rng!: Rng;
  private views!: (Phaser.GameObjects.Container | null)[][];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private animating = false;
  private gameEnded = false;
  private usedContinue = false;
  private reached2048 = false;
  private swipeStart: { x: number; y: number } | null = null;

  constructor() {
    super("game");
  }

  create(): void {
    this.grid = new Grid();
    this.rng = new Rng();
    this.score = 0;
    this.animating = false;
    this.gameEnded = false;
    this.usedContinue = false;
    this.reached2048 = false;

    this.scoreText = this.add
      .text(this.scale.width / 2, 110, "0", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, 180, `Best: ${storage.get("highScore", 0)}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, 1180, "Swipe to move tiles", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#5c667d",
      })
      .setOrigin(0.5);

    this.drawBoardBackground();
    this.views = Array.from({ length: GRID_SIZE }, () =>
      Array<Phaser.GameObjects.Container | null>(GRID_SIZE).fill(null),
    );
    this.grid.spawn(this.rng);
    this.grid.spawn(this.rng);
    this.rebuildViews();
    this.setupInput();
  }

  private drawBoardBackground(): void {
    const size = GRID_SIZE * CELL + (GRID_SIZE + 1) * GAP;
    this.add.rectangle(GRID_X, GRID_Y, size, size, 0x0c0e14).setOrigin(0);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const { x, y } = cellCenter(r, c);
        this.add.rectangle(x, y, CELL, CELL, 0x1e2230);
      }
    }
  }

  private buildTile(r: number, c: number, value: number): Phaser.GameObjects.Container {
    const { x, y } = cellCenter(r, c);
    const style = TILE_STYLE[value] ?? BIG_TILE_STYLE;
    const fontSize = value < 100 ? "64px" : value < 1000 ? "56px" : "44px";
    const container = this.add.container(x, y, [
      this.add.rectangle(0, 0, CELL, CELL, style.fill),
      this.add
        .text(0, 0, String(value), {
          fontFamily: "Arial Black, sans-serif",
          fontSize,
          color: style.text,
        })
        .setOrigin(0.5),
    ]);
    container.setDepth(10);
    return container;
  }

  private rebuildViews(
    popCells: Array<readonly [number, number]> = [],
  ): void {
    for (const row of this.views) {
      for (const view of row) view?.destroy();
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const value = this.grid.cells[r]![c]!;
        this.views[r]![c] = value === 0 ? null : this.buildTile(r, c, value);
      }
    }
    for (const [r, c] of popCells) {
      const view = this.views[r]![c];
      if (!view) continue;
      view.setScale(0.5);
      this.tweens.add({ targets: view, scale: 1, duration: 120, ease: "Back.easeOut" });
    }
  }

  private setupInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const dir = (
        {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
        } as Record<string, Direction>
      )[event.key];
      if (dir) this.tryMove(dir);
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
      const dir: Direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      this.tryMove(dir);
    });
  }

  private tryMove(dir: Direction): void {
    if (this.animating || this.gameEnded) return;
    const result = this.grid.move(dir);
    if (!result.moved) return;

    this.animating = true;
    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    for (const m of result.moves) {
      const view = this.views[m.fromR]![m.fromC];
      if (!view || (m.fromR === m.toR && m.fromC === m.toC)) continue;
      const { x, y } = cellCenter(m.toR, m.toC);
      tweens.push({ targets: view, x, y, duration: SLIDE_MS });
    }

    const finish = (): void => {
      const spawned = this.grid.spawn(this.rng);
      const pop = [...result.mergedCells, ...(spawned ? [spawned] : [])];
      this.rebuildViews(pop);

      this.score += result.gained;
      this.scoreText.setText(String(this.score));
      if (result.gained > 0) {
        sfx.clear(1);
        this.tweens.add({ targets: this.scoreText, scale: 1.15, duration: 90, yoyo: true });
      } else {
        sfx.place();
      }

      if (!this.reached2048 && this.grid.maxTile() >= 2048) {
        this.reached2048 = true;
        sfx.clear(4);
        floatBanner(this, "2048!", GRID_Y + 2 * (CELL + GAP));
      }

      this.animating = false;
      if (!this.grid.canMove()) this.endGame();
    };

    if (tweens.length === 0) {
      finish();
      return;
    }
    let remaining = tweens.length;
    for (const cfg of tweens) {
      this.tweens.add({
        ...cfg,
        onComplete: () => {
          remaining--;
          if (remaining === 0) finish();
        },
      });
    }
  }

  private endGame(): void {
    this.gameEnded = true;
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
        if (this.gameEnded && ads.isRewardedReady()) {
          overlay.add(
            textButton(
              this,
              width / 2,
              height * 0.7,
              "🎬  SECOND CHANCE (AD)",
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

  /** Rewarded-ad revive: wipe the small tiles so the board opens back up. */
  private revive(overlay: Phaser.GameObjects.Container): void {
    this.usedContinue = true;
    this.gameEnded = false;
    overlay.destroy();
    let removed = this.grid.clearTilesBelow(16);
    if (removed === 0) {
      removed = this.grid.clearTilesBelow(Math.max(32, this.grid.maxTile() / 4));
    }
    this.rebuildViews();
  }
}
