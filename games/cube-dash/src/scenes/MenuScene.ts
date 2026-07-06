import Phaser from "phaser";
import { GameStorage } from "@mg/core";
import { textButton } from "@mg/ui";
import { levelColor, levelDurationSec } from "../logic/runner";
import { worldForLevel } from "../worlds";
import { CHARACTERS, characterById, isCharacterUnlocked } from "../characters";
import { attachAura, buildCharacterParts } from "../characterView";

export const storage = new GameStorage("cube-dash");

// --- Dev-only god mode -------------------------------------------------
// Available ONLY on the Vite dev server; the toggle button never renders in
// a production/Capacitor build, and even a stale stored flag has no effect
// off localhost. While on, every level is selectable, and level completions
// do NOT touch stored progress (unlockedLevel/bestPct) — toggling off drops
// you back exactly where you really were.

/** Levels browsable in god mode (worlds cycle, so any cap works). */
const GOD_MODE_MAX_LEVEL = 99;

export function godModeAvailable(): boolean {
  return typeof location !== "undefined" && location.host === "localhost:5173";
}

export function godModeOn(): boolean {
  return godModeAvailable() && storage.get("godMode", false);
}

export class MenuScene extends Phaser.Scene {
  private selected = 1;
  private levelWord!: Phaser.GameObjects.Text;
  private levelLabel!: Phaser.GameObjects.Text;
  private levelInfo!: Phaser.GameObjects.Text;
  private lockHint!: Phaser.GameObjects.Text;
  private charIndex = 0;
  private charPreview: Phaser.GameObjects.Container | null = null;
  private charName!: Phaser.GameObjects.Text;

  constructor() {
    super("menu");
  }

  /** Highest selectable level: real progress, or everything in god mode. */
  private unlockedLevel(): number {
    return godModeOn() ? GOD_MODE_MAX_LEVEL : storage.get("unlockedLevel", 1);
  }

  create(): void {
    const { width, height } = this.scale;
    const unlocked = this.unlockedLevel();
    this.selected = Math.min(storage.get("lastPlayed", 1), unlocked);

    // Dev-only god mode toggle (never rendered off the Vite dev server).
    if (godModeAvailable()) {
      const on = storage.get("godMode", false);
      textButton(
        this,
        width - 120,
        56,
        on ? "⚡ GOD: ON" : "⚡ GOD: OFF",
        on
          ? { text: "#ffd54f", background: "#3a2f10" }
          : { text: "#5c667d", background: "#181d2b" },
        () => {
          storage.set("godMode", !on);
          this.scene.restart(); // re-reads progress → selection re-clamps
        },
        "26px",
      );
    }

    this.add
      .text(width / 2, height * 0.2, "CUBE\nDASH", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "110px",
        color: "#ffffff",
        align: "center",
        stroke: "#26c6da",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setShadow(0, 10, "#000000", 12, false, true);

    this.levelWord = this.add
      .text(width / 2, height * 0.395, "LEVEL", {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        color: "#8a93a8",
      })
      .setOrigin(0.5)
      .setShadow(0, 4, "#000000", 6, false, true);
    this.levelLabel = this.add
      .text(width / 2, height * 0.455, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 8, false, true);
    // Tapping the number opens the direct level-select grid.
    this.levelLabel.setInteractive({ useHandCursor: true });
    this.levelLabel.on("pointerdown", () => this.openLevelGrid());
    textButton(
      this,
      width / 2 + 310,
      height * 0.455,
      "⊞",
      { text: "#8a93a8", background: "#232b3e" },
      () => this.openLevelGrid(),
      "36px",
    );

    this.levelInfo = this.add
      .text(width / 2, height * 0.52, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "36px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);

    this.lockHint = this.add
      .text(width / 2, height * 0.585, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#5c667d",
      })
      .setOrigin(0.5);

    textButton(this, width / 2 - 220, height * 0.455, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.max(1, this.selected - 1);
      this.refresh();
    });
    textButton(this, width / 2 + 220, height * 0.455, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.min(this.unlockedLevel(), this.selected + 1);
      this.refresh();
    });

    textButton(
      this,
      width / 2,
      height * 0.68,
      "▶  PLAY",
      { text: "#a5d6a7", background: "#1e3320" },
      () => {
        storage.set("lastPlayed", this.selected);
        this.scene.start("game", { level: this.selected });
      },
      "60px",
    );

    // Character picker
    this.add
      .text(width / 2, height * 0.78, "CHARACTER", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        color: "#5c667d",
      })
      .setOrigin(0.5);
    this.charName = this.add
      .text(width / 2, height * 0.915, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const savedId = storage.get("character", "dash");
    this.charIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === savedId));
    textButton(this, width / 2 - 160, height * 0.85, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
      this.charIndex = (this.charIndex + CHARACTERS.length - 1) % CHARACTERS.length;
      this.refreshCharacter();
    }, "40px");
    textButton(this, width / 2 + 160, height * 0.85, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
      this.charIndex = (this.charIndex + 1) % CHARACTERS.length;
      this.refreshCharacter();
    }, "40px");

    this.refresh();
    this.refreshCharacter();
  }

  private refreshCharacter(): void {
    const { width, height } = this.scale;
    const spec = CHARACTERS[this.charIndex]!;
    const unlocked = isCharacterUnlocked(spec, storage.get("unlockedLevel", 1));

    this.charPreview?.destroy();
    this.charPreview = this.add
      .container(width / 2, height * 0.85, buildCharacterParts(this, spec, 60))
      .setAlpha(unlocked ? 1 : 0.35);
    attachAura(this, this.charPreview, spec, 60);

    const hex = `#${spec.color.toString(16).padStart(6, "0")}`;
    if (unlocked) {
      this.charName.setText(spec.name).setColor(hex);
      // Browsing an unlocked character selects it immediately.
      storage.set("character", spec.id);
    } else {
      this.charName
        .setText(`🔒 ${spec.name} — clear level ${spec.minLevel - 1}`)
        .setColor("#5c667d");
    }
  }

  /** Overlay grid to jump straight to any unlocked level. */
  private openLevelGrid(): void {
    const { width, height } = this.scale;
    const unlocked = this.unlockedLevel();
    const total = godModeOn() ? unlocked : unlocked + 4; // peek a few locked levels ahead
    const perPage = 20; // 5 x 4 tiles
    const pages = Math.ceil(total / perPage);
    let page = Math.min(Math.floor((this.selected - 1) / perPage), pages - 1);

    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(
      this.add.rectangle(0, 0, width, height, 0x0b0e18, 0.95).setOrigin(0).setInteractive(),
    );
    overlay.add(
      this.add
        .text(width / 2, 150, "SELECT LEVEL", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "52px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setShadow(0, 6, "#000000", 8, false, true),
    );
    const tiles = this.add.container(0, 0);
    overlay.add(tiles);
    const pageText = this.add
      .text(width / 2, height - 165, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);
    overlay.add(pageText);

    const renderPage = (): void => {
      tiles.removeAll(true);
      const start = page * perPage;
      for (let i = 0; i < perPage; i++) {
        const lvl = start + i + 1;
        if (lvl > total) break;
        const x = width / 2 - 248 + (i % 5) * 124;
        const y = 330 + Math.floor(i / 5) * 130;
        const isUnlocked = lvl <= unlocked;
        const best = storage.get(`bestPct:${lvl}`, 0);
        const tile = this.add
          .rectangle(x, y, 110, 110, isUnlocked ? 0x1b2233 : 0x141824)
          .setStrokeStyle(3, isUnlocked ? levelColor(lvl) : 0x2a3040);
        const label = this.add
          .text(x, y - 8, isUnlocked ? String(lvl) : "🔒", {
            fontFamily: "Arial Black, sans-serif",
            fontSize: "40px",
            color: isUnlocked ? "#ffffff" : "#5c667d",
          })
          .setOrigin(0.5);
        tiles.add(tile);
        tiles.add(label);
        if (isUnlocked && best > 0) {
          tiles.add(
            this.add
              .text(x, y + 34, best >= 100 ? "✓" : `${best}%`, {
                fontFamily: "Arial, sans-serif",
                fontSize: "24px",
                color: best >= 100 ? "#a5d6a7" : "#8a93a8",
              })
              .setOrigin(0.5),
          );
        }
        if (isUnlocked) {
          tile.setInteractive({ useHandCursor: true });
          tile.on("pointerdown", () => {
            this.selected = lvl;
            this.refresh();
            overlay.destroy();
          });
        }
      }
      pageText.setText(pages > 1 ? `page ${page + 1} / ${pages}` : "");
    };

    if (pages > 1) {
      overlay.add(
        textButton(this, width / 2 - 150, height - 165, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
          page = Math.max(0, page - 1);
          renderPage();
        }, "32px"),
      );
      overlay.add(
        textButton(this, width / 2 + 150, height - 165, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
          page = Math.min(pages - 1, page + 1);
          renderPage();
        }, "32px"),
      );
    }
    overlay.add(
      textButton(
        this,
        width / 2,
        height - 80,
        "✕  CLOSE",
        { text: "#ef9a9a", background: "#331e1e" },
        () => overlay.destroy(),
        "34px",
      ),
    );
    renderPage();
  }

  private refresh(): void {
    const unlocked = this.unlockedLevel();
    const hex = `#${levelColor(this.selected).toString(16).padStart(6, "0")}`;
    this.levelWord.setColor(hex);
    this.levelLabel.setText(`${this.selected}`).setColor(hex);

    const best = storage.get(`bestPct:${this.selected}`, 0);
    const cleared = best >= 100;
    this.levelInfo.setText(
      `${worldForLevel(this.selected).name}  ·  ${levelDurationSec(this.selected)}s` +
        (best > 0 ? `  ·  ${cleared ? "✓ cleared" : `best ${best}%`}` : ""),
    );
    this.lockHint.setText(
      this.selected === unlocked && !cleared
        ? `clear this level to unlock level ${unlocked + 1}`
        : "",
    );
  }
}
