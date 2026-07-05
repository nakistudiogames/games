import Phaser from "phaser";
import { GameStorage } from "@mg/core";
import { textButton } from "@mg/ui";
import { levelColor, levelLengthM, levelSpeed } from "../logic/runner";
import { CHARACTERS, characterById, isCharacterUnlocked } from "../characters";
import { attachAura, buildCharacterParts } from "../characterView";

export const storage = new GameStorage("cube-dash");

export class MenuScene extends Phaser.Scene {
  private selected = 1;
  private levelLabel!: Phaser.GameObjects.Text;
  private levelInfo!: Phaser.GameObjects.Text;
  private lockHint!: Phaser.GameObjects.Text;
  private charIndex = 0;
  private charPreview: Phaser.GameObjects.Container | null = null;
  private charName!: Phaser.GameObjects.Text;

  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this.scale;
    const unlocked = storage.get("unlockedLevel", 1);
    this.selected = Math.min(storage.get("lastPlayed", 1), unlocked);

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

    this.levelLabel = this.add
      .text(width / 2, height * 0.44, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 8, false, true);

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

    textButton(this, width / 2 - 220, height * 0.44, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.max(1, this.selected - 1);
      this.refresh();
    });
    textButton(this, width / 2 + 220, height * 0.44, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.min(storage.get("unlockedLevel", 1), this.selected + 1);
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

  private refresh(): void {
    const unlocked = storage.get("unlockedLevel", 1);
    const hex = `#${levelColor(this.selected).toString(16).padStart(6, "0")}`;
    this.levelLabel.setText(`LEVEL ${this.selected}`).setColor(hex);

    const best = storage.get(`bestPct:${this.selected}`, 0);
    const cleared = best >= 100;
    this.levelInfo.setText(
      `${levelLengthM(this.selected)}m  ·  speed ${levelSpeed(this.selected)}` +
        (best > 0 ? `  ·  ${cleared ? "✓ cleared" : `best ${best}%`}` : ""),
    );
    this.lockHint.setText(
      this.selected === unlocked && !cleared
        ? `clear this level to unlock level ${unlocked + 1}`
        : "",
    );
  }
}
