import Phaser from "phaser";
import { Rng, sfx } from "@mg/core";
import { floatBanner, textButton } from "@mg/ui";
import {
  MAX_GUESSES,
  WORD_LENGTH,
  betterResult,
  evaluateGuess,
  isValidGuess,
  pickAnswer,
} from "../logic/words";
import type { LetterResult } from "../logic/words";
import { adsReady } from "../ads";
import { storage } from "./MenuScene";

const TILE = 120;
const TILE_GAP = 12;
const GRID_X = 36;
const GRID_Y = 150;

const KEY_W = 62;
const KEY_H = 84;
const KEY_GAP = 6;
const KEY_ROWS_Y = [960, 1054, 1148] as const;

const RESULT_COLORS: Record<LetterResult, number> = {
  hit: 0x66bb6a,
  near: 0xffca28,
  miss: 0x3a4150,
};
const TILE_EMPTY = 0x1e2230;
const TILE_TYPED = 0x2a3040;
const KEY_IDLE = 0x39424f;

interface TileView {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private answer!: string;
  private rng!: Rng;
  private currentRow = 0;
  private currentGuess = "";
  private tiles!: TileView[][];
  private keyRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private keyStates = new Map<string, LetterResult>();
  private streak = 0;
  private streakText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private hintButton: Phaser.GameObjects.Container | null = null;
  private usedHint = false;
  private locked = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.rng = new Rng();
    this.streak = 0;
    this.currentRow = 0;
    this.currentGuess = "";
    this.keyRects.clear();
    this.keyStates.clear();
    this.usedHint = false;
    this.locked = false;
    this.answer = pickAnswer(this.rng);

    this.streakText = this.add
      .text(40, 60, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "40px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);
    this.updateStreakText();

    this.hintText = this.add
      .text(this.scale.width / 2, GRID_Y + MAX_GUESSES * (TILE + TILE_GAP) + 14, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        color: "#80deea",
      })
      .setOrigin(0.5, 0);

    void adsReady.then((ads) => {
      if (ads.isRewardedReady()) {
        this.hintButton = textButton(
          this,
          580,
          60,
          "💡 HINT (AD)",
          { text: "#80deea", background: "#16283d" },
          () => this.requestHint(),
          "32px",
        );
      }
    });

    this.buildGrid();
    this.buildKeyboard();

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") this.pressKey("ENTER");
      else if (event.key === "Backspace") this.pressKey("BACK");
      else if (/^[a-zA-Z]$/.test(event.key)) this.pressKey(event.key.toLowerCase());
    });
  }

  private buildGrid(): void {
    this.tiles = [];
    for (let r = 0; r < MAX_GUESSES; r++) {
      const row: TileView[] = [];
      for (let c = 0; c < WORD_LENGTH; c++) {
        const x = GRID_X + c * (TILE + TILE_GAP) + TILE / 2;
        const y = GRID_Y + r * (TILE + TILE_GAP) + TILE / 2;
        const rect = this.add.rectangle(x, y, TILE, TILE, TILE_EMPTY);
        const text = this.add
          .text(x, y, "", {
            fontFamily: "Arial Black, sans-serif",
            fontSize: "60px",
            color: "#ffffff",
          })
          .setOrigin(0.5);
        row.push({ rect, text });
      }
      this.tiles.push(row);
    }
  }

  private buildKeyboard(): void {
    const rows: string[][] = [
      "qwertyuiop".split(""),
      "asdfghjkl".split(""),
      ["ENTER", ..."zxcvbnm".split(""), "BACK"],
    ];
    rows.forEach((keys, rowIdx) => {
      const widths = keys.map((k) => (k.length > 1 ? 94 : KEY_W));
      const totalW = widths.reduce((a, b) => a + b, 0) + KEY_GAP * (keys.length - 1);
      let x = (this.scale.width - totalW) / 2;
      keys.forEach((key, i) => {
        const w = widths[i]!;
        const cx = x + w / 2;
        const cy = KEY_ROWS_Y[rowIdx]!;
        const rect = this.add
          .rectangle(cx, cy, w, KEY_H, KEY_IDLE)
          .setInteractive({ useHandCursor: true });
        this.add
          .text(cx, cy, key.length > 1 ? (key === "BACK" ? "⌫" : "↵") : key.toUpperCase(), {
            fontFamily: "Arial, sans-serif",
            fontSize: key.length > 1 ? "40px" : "36px",
            color: "#ffffff",
          })
          .setOrigin(0.5);
        rect.on("pointerdown", () => this.pressKey(key));
        if (key.length === 1) this.keyRects.set(key, rect);
        x += w + KEY_GAP;
      });
    });
  }

  private updateStreakText(): void {
    this.streakText.setText(`Streak: ${this.streak}   Best: ${storage.get("highScore", 0)}`);
  }

  private pressKey(key: string): void {
    if (this.locked) return;
    if (key === "ENTER") {
      this.submitGuess();
      return;
    }
    if (key === "BACK") {
      if (this.currentGuess.length > 0) {
        this.currentGuess = this.currentGuess.slice(0, -1);
        this.renderCurrentRow();
      }
      return;
    }
    if (this.currentGuess.length < WORD_LENGTH) {
      this.currentGuess += key;
      this.renderCurrentRow();
    }
  }

  private renderCurrentRow(): void {
    const row = this.tiles[this.currentRow]!;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const ch = this.currentGuess[c] ?? "";
      row[c]!.text.setText(ch.toUpperCase());
      row[c]!.rect.setFillStyle(ch ? TILE_TYPED : TILE_EMPTY);
    }
  }

  private submitGuess(): void {
    if (this.currentGuess.length < WORD_LENGTH || !isValidGuess(this.currentGuess)) {
      this.shakeRow(this.currentRow);
      return;
    }
    const results = evaluateGuess(this.answer, this.currentGuess);
    const row = this.tiles[this.currentRow]!;
    results.forEach((res, c) => {
      row[c]!.rect.setFillStyle(RESULT_COLORS[res]);
      const ch = this.currentGuess[c]!;
      const better = betterResult(this.keyStates.get(ch), res);
      this.keyStates.set(ch, better);
      this.keyRects.get(ch)?.setFillStyle(RESULT_COLORS[better]);
    });

    if (results.every((r) => r === "hit")) {
      this.winRound();
      return;
    }
    this.currentRow++;
    this.currentGuess = "";
    if (this.currentRow >= MAX_GUESSES) {
      this.loseRound();
    } else {
      sfx.place();
    }
  }

  private shakeRow(rowIdx: number): void {
    const targets = this.tiles[rowIdx]!.flatMap((t) => [t.rect, t.text]);
    this.tweens.add({
      targets,
      x: "+=12",
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }

  private winRound(): void {
    this.locked = true;
    this.streak++;
    storage.bumpHighScore(this.streak);
    this.updateStreakText();
    sfx.clear(2);
    floatBanner(this, `STREAK ${this.streak}!`, 620, "80px", "#66bb6a");
    this.time.delayedCall(1400, () => this.nextRound());
  }

  private nextRound(): void {
    this.answer = pickAnswer(this.rng);
    this.currentRow = 0;
    this.currentGuess = "";
    this.usedHint = false;
    this.locked = false;
    this.hintText.setText("");
    this.keyStates.clear();
    for (const rect of this.keyRects.values()) rect.setFillStyle(KEY_IDLE);
    for (const row of this.tiles) {
      for (const t of row) {
        t.text.setText("");
        t.rect.setFillStyle(TILE_EMPTY);
      }
    }
  }

  private loseRound(): void {
    this.locked = true;
    sfx.gameOver();
    void adsReady.then((ads) => ads.maybeShowInterstitial());

    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.82).setOrigin(0));
    overlay.add(
      this.add
        .text(width / 2, height * 0.3, "OUT OF GUESSES", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "64px",
          color: "#ffffff",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(
          width / 2,
          height * 0.44,
          `The word was\n${this.answer.toUpperCase()}\n\nStreak: ${this.streak}   Best: ${storage.get("highScore", 0)}`,
          {
            fontFamily: "Arial, sans-serif",
            fontSize: "46px",
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
        height * 0.66,
        "▶  PLAY AGAIN",
        { text: "#a5d6a7", background: "#1e3320" },
        () => this.scene.restart(),
      ),
    );
  }

  /** Rewarded hint: reveals one not-yet-solved letter's position. */
  private requestHint(): void {
    if (this.locked || this.usedHint) return;
    void adsReady.then((ads) => {
      void ads.showRewarded().then((earned) => {
        if (!earned || this.locked || this.usedHint) return;
        this.usedHint = true;
        const solved = new Set<number>();
        for (let r = 0; r < this.currentRow; r++) {
          const guess = this.rowWord(r);
          evaluateGuess(this.answer, guess).forEach((res, i) => {
            if (res === "hit") solved.add(i);
          });
        }
        const unsolved = Array.from({ length: WORD_LENGTH }, (_, i) => i).filter(
          (i) => !solved.has(i),
        );
        if (unsolved.length === 0) return;
        const pos = unsolved[Math.floor(unsolved.length / 2)]!;
        this.hintText.setText(
          `Hint: letter ${pos + 1} is "${this.answer[pos]!.toUpperCase()}"`,
        );
        sfx.clear(1);
      });
    });
  }

  private rowWord(rowIdx: number): string {
    return this.tiles[rowIdx]!
      .map((t) => t.text.text.toLowerCase())
      .join("");
  }
}
