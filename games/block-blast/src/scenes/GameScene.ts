import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import { Board, BOARD_CLEAR_BONUS, MONO_LINE_BONUS } from "../logic/board";
import { generateTray, shapeSize, SHAPES } from "../logic/pieces";
import type { Piece } from "../logic/pieces";
import { adsReady } from "../ads";
import { storage } from "./MenuScene";

const CELL = 80;
const BOARD_X = 40;
const BOARD_Y = 210;
const TRAY_Y = 1070;
const TRAY_XS = [140, 360, 580] as const;
const TRAY_SCALE = 0.5;
/** How far the dragged piece floats above the finger so it stays visible. */
const DRAG_LIFT = 70;

const COLORS = [0xef5350, 0xffa726, 0xffee58, 0x66bb6a, 0x42a5f5, 0xab47bc] as const;
const EMPTY_COLOR = 0x1e2230;

interface TrayEntry {
  piece: Piece;
  container: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  private board!: Board;
  private rng!: Rng;
  private tray!: (TrayEntry | null)[];
  private cellRects!: Phaser.GameObjects.Rectangle[][];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private usedContinue = false;
  private gameEnded = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.board = new Board();
    this.rng = new Rng();
    this.tray = [null, null, null];
    this.score = 0;
    this.usedContinue = false;
    this.gameEnded = false;

    this.scoreText = this.add
      .text(this.scale.width / 2, 90, "0", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.bestText = this.add
      .text(this.scale.width / 2, 155, `Best: ${storage.get("highScore", 0)}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);

    this.createGrid();
    this.dealTray();
    this.setupDrag();
  }

  private createGrid(): void {
    this.add
      .rectangle(BOARD_X - 8, BOARD_Y - 8, CELL * 8 + 16, CELL * 8 + 16, 0x0c0e14)
      .setOrigin(0);
    this.cellRects = [];
    for (let r = 0; r < 8; r++) {
      const row: Phaser.GameObjects.Rectangle[] = [];
      for (let c = 0; c < 8; c++) {
        row.push(
          this.add
            .rectangle(
              BOARD_X + c * CELL + CELL / 2,
              BOARD_Y + r * CELL + CELL / 2,
              CELL - 6,
              CELL - 6,
              EMPTY_COLOR,
            )
            .setOrigin(0.5),
        );
      }
      this.cellRects.push(row);
    }
  }

  private refreshGrid(): void {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const color = this.board.cells[r]![c] ?? null;
        const rect = this.cellRects[r]![c]!;
        rect.setFillStyle(color === null ? EMPTY_COLOR : COLORS[color]!);
        rect.setAlpha(1);
      }
    }
  }

  private buildPieceContainer(piece: Piece): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    for (const [dr, dc] of piece.shape.cells) {
      container.add(
        this.add
          .rectangle(dc * CELL + CELL / 2, dr * CELL + CELL / 2, CELL - 6, CELL - 6, COLORS[piece.colorIndex]!)
          .setOrigin(0.5),
      );
    }
    const { rows, cols } = shapeSize(piece.shape);
    container.setSize(cols * CELL, rows * CELL);
    container.setInteractive(
      new Phaser.Geom.Rectangle((cols * CELL) / 2, (rows * CELL) / 2, cols * CELL, rows * CELL),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(container);
    return container;
  }

  private trayHome(slot: number, piece: Piece): { x: number; y: number } {
    const { rows, cols } = shapeSize(piece.shape);
    return {
      x: TRAY_XS[slot]! - (cols * CELL * TRAY_SCALE) / 2,
      y: TRAY_Y - (rows * CELL * TRAY_SCALE) / 2,
    };
  }

  private putInTray(slot: number, piece: Piece): void {
    const container = this.buildPieceContainer(piece);
    const home = this.trayHome(slot, piece);
    container.setScale(TRAY_SCALE).setPosition(home.x, home.y);
    container.setData("slot", slot);
    this.tray[slot] = { piece, container };
  }

  private dealTray(pieces?: Piece[]): void {
    const deal = pieces ?? generateTray(this.rng);
    deal.forEach((piece, i) => this.putInTray(i, piece));
  }

  /** Grid cell under the container's current top-left, or null if off-board. */
  private gridTarget(container: Phaser.GameObjects.Container): { row: number; col: number } | null {
    const col = Math.round((container.x - BOARD_X) / CELL);
    const row = Math.round((container.y - BOARD_Y) / CELL);
    if (row < -1 || col < -1 || row > 8 || col > 8) return null;
    return { row, col };
  }

  private setupDrag(): void {
    this.input.on(
      "dragstart",
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        if (this.gameEnded) return;
        obj.setScale(1);
        this.children.bringToTop(obj);
      },
    );

    this.input.on(
      "drag",
      (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        if (this.gameEnded) return;
        obj.x = pointer.x - obj.width / 2;
        obj.y = pointer.y - obj.height - DRAG_LIFT;
        this.refreshGrid();
        this.showPreview(obj);
      },
    );

    this.input.on(
      "dragend",
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        if (this.gameEnded) return;
        this.handleDrop(obj);
      },
    );
  }

  private entryFor(container: Phaser.GameObjects.Container): TrayEntry | null {
    const slot = container.getData("slot") as number;
    return this.tray[slot] ?? null;
  }

  private showPreview(container: Phaser.GameObjects.Container): void {
    const entry = this.entryFor(container);
    const target = this.gridTarget(container);
    if (!entry || !target || !this.board.canPlace(entry.piece.shape, target.row, target.col)) {
      return;
    }
    for (const [dr, dc] of entry.piece.shape.cells) {
      const rect = this.cellRects[target.row + dr]![target.col + dc]!;
      rect.setFillStyle(COLORS[entry.piece.colorIndex]!);
      rect.setAlpha(0.4);
    }
  }

  private handleDrop(container: Phaser.GameObjects.Container): void {
    const slot = container.getData("slot") as number;
    const entry = this.entryFor(container);
    if (!entry) return;
    const target = this.gridTarget(container);

    if (!target || !this.board.canPlace(entry.piece.shape, target.row, target.col)) {
      const home = this.trayHome(slot, entry.piece);
      this.tweens.add({
        targets: container,
        x: home.x,
        y: home.y,
        scale: TRAY_SCALE,
        duration: 150,
        ease: "Back.easeOut",
      });
      this.refreshGrid();
      return;
    }

    const result = this.board.place(entry.piece, target.row, target.col);
    container.destroy();
    this.tray[slot] = null;
    this.refreshGrid();

    this.score += result.points;
    this.scoreText.setText(String(this.score));
    const lines = result.clearedRows.length + result.clearedCols.length;
    if (lines > 0) {
      sfx.clear(lines);
      this.flashClears(result.clearedRows, result.clearedCols);
      this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 100, yoyo: true });
      if (result.monoLines > 0) {
        floatBanner(
          this,
          `COLOR LINE! +${MONO_LINE_BONUS * result.monoLines}`,
          BOARD_Y + CELL * 2.5,
          "56px",
          "#80deea",
        );
      }
      if (result.boardCleared) {
        sfx.clear(4);
        floatBanner(this, `BOARD CLEAR!\n+${BOARD_CLEAR_BONUS}`, BOARD_Y + CELL * 4);
      }
    } else {
      sfx.place();
    }

    if (this.tray.every((t) => t === null)) {
      this.dealTray();
    }

    const remaining = this.tray.filter((t): t is TrayEntry => t !== null).map((t) => t.piece);
    if (!this.board.anyFits(remaining)) {
      this.endGame();
    }
  }

  private flashClears(rows: number[], cols: number[]): void {
    const flashes: Phaser.GameObjects.Rectangle[] = [];
    for (const r of rows) {
      flashes.push(
        this.add
          .rectangle(BOARD_X, BOARD_Y + r * CELL, CELL * 8, CELL, 0xffffff)
          .setOrigin(0)
          .setAlpha(0.8),
      );
    }
    for (const c of cols) {
      flashes.push(
        this.add
          .rectangle(BOARD_X + c * CELL, BOARD_Y, CELL, CELL * 8, 0xffffff)
          .setOrigin(0)
          .setAlpha(0.8),
      );
    }
    this.tweens.add({
      targets: flashes,
      alpha: 0,
      duration: 300,
      onComplete: () => flashes.forEach((f) => f.destroy()),
    });
  }

  private endGame(): void {
    this.gameEnded = true;
    sfx.gameOver();
    const best = storage.bumpHighScore(this.score);
    void adsReady.then((ads) => ads.maybeShowInterstitial());

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0);
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

    const playAgain = textButton(
      this,
      width / 2,
      height * 0.58,
      "▶  PLAY AGAIN",
      { text: "#a5d6a7", background: "#1e3320" },
      () => this.scene.restart(),
    );
    overlay.add(playAgain);

    if (!this.usedContinue) {
      void adsReady.then((ads) => {
        if (this.gameEnded && ads.isRewardedReady()) {
          const continueBtn = textButton(
            this,
            width / 2,
            height * 0.7,
            "🎬  SECOND CHANCE (AD)",
            { text: "#90caf9", background: "#16283d" },
            () => {
              void ads.showRewarded().then((earned) => {
                if (earned) this.continueWithFreshPieces(overlay);
              });
            },
            "44px",
          );
          overlay.add(continueBtn);
        }
      });
    }
  }

  /** Rewarded-ad continue: swap the stuck tray for three small pieces. */
  private continueWithFreshPieces(overlay: Phaser.GameObjects.Container): void {
    this.usedContinue = true;
    this.gameEnded = false;
    overlay.destroy();
    for (const entry of this.tray) entry?.container.destroy();
    this.tray = [null, null, null];
    const small = ["dot", "h2", "v2"].map((id) => ({
      shape: SHAPES.find((s) => s.id === id)!,
      colorIndex: this.rng.int(COLORS.length),
    }));
    this.dealTray(small);
  }
}
